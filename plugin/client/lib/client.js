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
 *
 * Comportamentos (mesma política da extensão):
 *  - um aviso por pedido, identificado pela chave da interação;
 *  - fecha sozinha quando não há mais nada pendente;
 *  - lembrete a cada 90s, no máximo três vezes;
 *  - horário de silêncio conferido no envio, segurando em vez de descartar;
 *  - aprovação que trava o agente pode furar o silêncio;
 *  - agregação: o corpo informa quantos pedidos estão pendentes.
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
    const REMIND_DELAY_MS = 90 * 1000;
    const MAX_REMINDERS = 3;

    /* ------------------------------------------------------------------ */
    /* Horário de silêncio — mesma regra da extensão                       */
    /* ------------------------------------------------------------------ */

    function parseHHMM(value) {
      const match = /^(\d{1,2}):(\d{2})$/.exec(String(value ?? "").trim());
      if (match === null) return null;
      const hours = Number(match[1]);
      const minutes = Number(match[2]);
      if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
      if (hours > 23 || minutes > 59) return null;
      return hours * 60 + minutes;
    }

    function minutesOfDay(date) {
      return date.getHours() * 60 + date.getMinutes();
    }

    function inQuietHours(date, start, end) {
      const from = parseHHMM(start);
      const to = parseHHMM(end);
      if (from === null || to === null) return false;
      // Janela vazia significa "sem silêncio", não "o dia inteiro".
      if (from === to) return false;
      const now = minutesOfDay(date);
      return from < to ? now >= from && now < to : now >= from || now < to;
    }

    function minutesUntilEnd(date, start, end) {
      if (!inQuietHours(date, start, end)) return 0;
      const to = parseHHMM(end);
      if (to === null) return 0;
      let difference = to - minutesOfDay(date);
      if (difference <= 0) difference += 24 * 60;
      return difference;
    }

    /* ------------------------------------------------------------------ */
    /* Leitura do snapshot                                                 */
    /* ------------------------------------------------------------------ */

    function collectPending(snapshot) {
      const found = [];
      if (!snapshot || typeof snapshot.forEach !== "function") return found;
      snapshot.forEach((status, sessionId) => {
        const pending = status?.pendingInteraction;
        if (!pending) return;
        found.push({
          sessionId: String(sessionId),
          kind: typeof pending.kind === "string" ? pending.kind : "approval",
          key: String(pending.key ?? sessionId + ":" + (pending.kind ?? "approval")),
        });
      });
      return found;
    }

    /** Primeira interação pendente do snapshot. */
    function findPending(snapshot) {
      return collectPending(snapshot)[0] ?? null;
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

    /* ------------------------------------------------------------------ */
    /* Notificação                                                         */
    /* ------------------------------------------------------------------ */

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
          /* alguns contextos recusam; o selo na aba continua */
        }
      }

      function open(kind, count) {
        markTitle(true);
        const permission = supported()
          ? "sem-api"
          : typeof Notification.permission === "string"
            ? Notification.permission
            : "desconhecida";
        log("tentando notificar:", kind, "| permissão:", permission, "| pendentes:", count);

        // Fallback universal: o selo no título não depende de permissão.
        if (supported() || Notification.permission !== "granted") return null;

        const body = count > 1 ? count + " pedidos pendentes — " + BODY : BODY;
        try {
          const notification = new Notification(TITLES[kind] ?? FALLBACK_TITLE, {
            body,
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
        if (state.notification !== null) {
          try {
            state.notification.close();
          } catch {
            /* já fechada */
          }
          state.notification = null;
        }
        markTitle(false);
      }

      return { open, close, requestPermission };
    }

    /* ------------------------------------------------------------------ */
    /* Plugin                                                              */
    /* ------------------------------------------------------------------ */

    /**
     * Instala o aviso sobre o snapshot de status das sessões.
     * @param ctx - Contexto raiz do cliente.
     * @param config - Opções do profile: `onlyWhenUnfocused`, horário de
     *   silêncio (`quietEnabled`, `quietStart`, `quietEnd`,
     *   `quietBypassApproval`) e `debug`.
     */
    function apply(ctx, config) {
      const options = {
        onlyWhenUnfocused: config?.onlyWhenUnfocused === true,
        quietEnabled: config?.quietEnabled === true,
        quietStart: String(config?.quietStart ?? "22:00"),
        quietEnd: String(config?.quietEnd ?? "08:00"),
        quietBypassApproval: config?.quietBypassApproval !== false,
        debug: config?.debug === true,
      };
      const log = (...args) => {
        if (!options.debug) return;
        try {
          console.info("[approval-notifier]", ...args);
        } catch {
          /* console indisponível */
        }
      };

      const source = ctx.uiSession.sessionStatus;
      const state = {
        /** Chaves já anunciadas nesta sessão de página. */
        announced: new Set(),
        /** Última chave anunciada, alvo preferencial do lembrete. */
        lastKey: null,
        /** Chave retida pelo horário de silêncio. */
        heldKey: null,
        notification: null,
        reminders: 0,
      };
      const timers = { remind: null, hold: null };
      const notifier = createNotifier(options, state, log);

      notifier.requestPermission();

      function clearTimers() {
        if (timers.remind !== null) {
          clearTimeout(timers.remind);
          timers.remind = null;
        }
        if (timers.hold !== null) {
          clearTimeout(timers.hold);
          timers.hold = null;
        }
      }

      function reset() {
        state.announced.clear();
        state.lastKey = null;
        state.heldKey = null;
        state.reminders = 0;
        clearTimers();
        notifier.close();
      }

      /** Reexibe o pedido ainda pendente; recriar é o que chama atenção. */
      function scheduleReminder() {
        if (timers.remind !== null) clearTimeout(timers.remind);
        timers.remind = setTimeout(() => {
          timers.remind = null;
          const pendings = collectPending(source.getSnapshot());
          if (pendings.length === 0) return;
          if (state.reminders >= MAX_REMINDERS) return;

          const target = pendings.find((item) => item.key === state.lastKey) ?? pendings[0];
          state.reminders += 1;
          notifier.close();
          state.notification = notifier.open(target.kind, pendings.length);
          log("lembrete", state.reminders, "de", MAX_REMINDERS);
          if (state.reminders < MAX_REMINDERS) scheduleReminder();
        }, REMIND_DELAY_MS);
      }

      /** Segura o aviso até a janela terminar — e o descarta se resolvido. */
      function holdUntilWindowEnd() {
        const minutes = minutesUntilEnd(new Date(), options.quietStart, options.quietEnd);
        if (timers.hold !== null) clearTimeout(timers.hold);
        timers.hold = setTimeout(() => {
          timers.hold = null;
          state.heldKey = null;
          sync();
        }, Math.max(minutes, 1) * 60 * 1000);
        log("silêncio: entrega em", minutes, "min");
      }

      function quietNow() {
        if (!options.quietEnabled) return false;
        return inQuietHours(new Date(), options.quietStart, options.quietEnd);
      }

      function bypassesQuiet(kind) {
        return options.quietBypassApproval && kind === "approval";
      }

      function sync() {
        const snapshot = source.getSnapshot();
        const pendings = collectPending(snapshot);

        if (pendings.length === 0) {
          reset();
          return;
        }

        // Pedidos resolvidos deixam de contar; se voltarem com chave nova,
        // são anunciados de novo.
        for (const key of [...state.announced]) {
          if (!pendings.some((item) => item.key === key)) state.announced.delete(key);
        }

        const fresh = pendings.find((item) => !state.announced.has(item.key));
        if (fresh === undefined) return;

        // Silenciado por foco: não marca como anunciado, para os listeners de
        // blur avisarem quando a janela sair de foco.
        if (shouldStayQuiet(options)) {
          markTitle(true);
          return;
        }

        if (quietNow() && !bypassesQuiet(fresh.kind)) {
          state.heldKey = fresh.key;
          markTitle(true);
          holdUntilWindowEnd();
          return;
        }

        log(
          "anunciando:",
          fresh.kind,
          "| pendentes:",
          pendings.length,
          "| sessões:",
          snapshot?.size ?? 0,
        );

        state.announced.add(fresh.key);
        state.lastKey = fresh.key;
        state.reminders = 0;
        notifier.close();
        state.notification = notifier.open(fresh.kind, pendings.length);
        scheduleReminder();
      }

      ctx.effect(() => {
        const dispose = source.subscribe(sync);
        window.addEventListener("blur", sync);
        window.addEventListener("focus", sync);
        sync();
        return () => {
          dispose();
          clearTimers();
          window.removeEventListener("blur", sync);
          window.removeEventListener("focus", sync);
        };
      }, "approval-notifier: session status");

      // Diagnóstico: confirma pelo DevTools se o plugin carregou e o que ele vê.
      try {
        globalThis.__dshApprovalNotifier = {
          version: "0.1.1",
          sessions: () => source.getSnapshot()?.size ?? 0,
          pending: () => collectPending(source.getSnapshot()).length,
          announced: () => [...state.announced],
          state: () => ({
            lastKey: state.lastKey,
            heldKey: state.heldKey,
            reminders: state.reminders,
            notification: state.notification === null ? null : "aberta",
          }),
          quietNow: () => quietNow(),
        };
      } catch {
        /* console indisponível: seguir sem diagnóstico */
      }
    }

    exports.apply = apply;
    exports.inject = ["uiSession"];
    exports.findPending = findPending;
    exports.collectPending = collectPending;
    exports.quiet = { parseHHMM, inQuietHours, minutesUntilEnd };
    return module.exports;
  },
});
