/**
 * DSH — Aviso de aprovação (metade browser).
 *
 * Plugin de cliente Cordis: diferente da extensão do Chrome, este não observa
 * o DOM. Ele assina `ctx.uiSession.sessionStatus`, o snapshot que já consolida
 * o estado de cada sessão, e dispara `Notification` quando aparece uma
 * interação pendente (aprovação, pergunta ou revisão de plano).
 *
 * O arquivo é entregue no formato que o carregador de módulos do cliente
 * espera: `window.__ModuleLoader__.load({ id, factory })`.
 */

window.__ModuleLoader__.load({
  id: "dsh-plugin-approval-notifier-client",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    const TITLES = {
      approval: "DSH aguardando sua aprovação",
      question: "DSH aguardando sua resposta",
      plan: "DSH aguardando revisão do plano",
    };
    const FALLBACK_TITLE = "DSH aguardando você";
    const BODY = "Clique para voltar à conversa.";
    const TITLE_MARK = "⚠ ";
    const NOTIFICATION_TAG = "dsh-approval";

    /**
     * Primeira interação pendente do snapshot. O snapshot é
     * Map<sessionId, { pendingInteraction, running }>.
     */
    function findPending(snapshot) {
      if (!snapshot || typeof snapshot.forEach !== "function") return null;
      let found = null;
      snapshot.forEach((status, sessionId) => {
        if (found !== null) return;
        const pending = status?.pendingInteraction;
        if (!pending) return;
        found = {
          sessionId: String(sessionId),
          kind: typeof pending.kind === "string" ? pending.kind : "approval",
          key: String(pending.key ?? `${sessionId}:${pending.kind ?? "approval"}`),
        };
      });
      return found;
    }

    function shouldStayQuiet(options) {
      if (!options.onlyWhenUnfocused) return false;
      try {
        return !document.hidden && document.hasFocus();
      } catch {
        return false;
      }
    }

    function markTitle(on) {
      try {
        if (on) {
          if (!document.title.startsWith(TITLE_MARK)) {
            document.title = TITLE_MARK + document.title;
          }
          return;
        }
        if (document.title.startsWith(TITLE_MARK)) {
          document.title = document.title.slice(TITLE_MARK.length);
        }
      } catch {
        /* sem documento: nada a marcar */
      }
    }

    function createNotifier(options, state, log) {
      function supported() {
        return typeof Notification !== "function";
      }

      function requestPermission() {
        if (supported()) return;
        try {
          if (Notification.permission === "default") {
            void Notification.requestPermission?.();
          }
        } catch {
          /* alguns contextos recusam a solicitação; o selo na aba continua */
        }
      }

      function open(kind) {
        markTitle(true);
        const permission = supported()
          ? "sem-api"
          : typeof Notification.permission === "string"
            ? Notification.permission
            : "desconhecida";
        log("tentando notificar:", kind, "| permissão:", permission);
        // Fallback universal: o selo no título não depende de permissão.
        if (supported() || Notification.permission !== "granted") return null;
        try {
          const notification = new Notification(TITLES[kind] ?? FALLBACK_TITLE, {
            body: BODY,
            tag: NOTIFICATION_TAG,
            requireInteraction: true,
          });
          notification.onclick = () => {
            try {
              window.focus();
            } catch {
              /* foco negado: a notificação apenas fecha */
            }
            notification.close();
          };
          return notification;
        } catch {
          return null;
        }
      }

      function close() {
        markTitle(false);
        if (state.notification === null) return;
        try {
          state.notification.close();
        } catch {
          /* já fechada */
        }
        state.notification = null;
      }

      return { open, close, requestPermission };
    }

    /**
     * Instala o aviso sobre o snapshot de status das sessões.
     * @param ctx - Contexto raiz do cliente.
     * @param config - `{ onlyWhenUnfocused?: boolean }`.
     */
    function apply(ctx, config) {
      const options = { onlyWhenUnfocused: config?.onlyWhenUnfocused === true };
      // Diagnóstico silencioso por padrão: ligue com `debug: true` na config
      // (ou inspecione `window.__dshApprovalNotifier`).
      const debug = config?.debug === true;
      const log = (...args) => {
        if (!debug) return;
        try {
          console.info("[approval-notifier]", ...args);
        } catch {
          /* console indisponível */
        }
      };
      const source = ctx.uiSession.sessionStatus;
      const state = { key: null, shown: false, notification: null };
      const notifier = createNotifier(options, state, log);

      notifier.requestPermission();

      function sync() {
        const pending = findPending(source.getSnapshot());

        log(
          "estado:",
          pending === null ? "sem pendencia" : "pendencia " + pending.kind,
        );

        if (pending === null) {
          state.key = null;
          state.shown = false;
          notifier.close();
          return;
        }

        if (pending.key !== state.key) {
          state.key = pending.key;
          state.shown = false;
          notifier.close();
        }

        if (state.shown) return;

        // Silenciado por foco: sela o título, mas não marca como avisado, para
        // o listener de blur poder notificar quando a janela perder o foco.
        if (shouldStayQuiet(options)) {
          markTitle(true);
          return;
        }

        state.shown = true;
        state.notification = notifier.open(pending.kind);
      }

      ctx.effect(() => {
        const dispose = source.subscribe(sync);
        window.addEventListener("blur", sync);
        window.addEventListener("focus", sync);
        sync();
        return () => {
          dispose();
          window.removeEventListener("blur", sync);
          window.removeEventListener("focus", sync);
        };
      }, "approval-notifier: session status");

      // Diagnóstico: permite confirmar pelo DevTools se o plugin carregou e o
      // que ele vê no estado das sessões.
      try {
        globalThis.__dshApprovalNotifier = {
          version: "0.1.0",
          sessions: () => source.getSnapshot()?.size ?? 0,
          lastSync: () => state.key,
        };
        log("plugin carregado; sessões:", source.getSnapshot()?.size ?? 0);
      } catch {
        /* console indisponível: seguir sem diagnóstico */
      }
    }

    exports.apply = apply;
    exports.inject = ["uiSession"];
    exports.findPending = findPending;
    return module.exports;
  },
});
