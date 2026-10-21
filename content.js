/**
 * DSH — Aviso de aprovação (content script).
 *
 * Observa os painéis que tomam conta do compositor quando o DeepSeek Harness
 * espera uma decisão humana. Cada painel publica um atributo estável, então
 * não dependemos de classes CSS geradas:
 *
 *   [data-approval-key]      aprovação de ferramenta / escalação de sandbox
 *   [data-question-key]      pergunta do ask_user_question
 *   [data-plan-review-key]   revisão de plano (plan mode)
 */

(() => {
  const PANELS = [
    { kind: 'approval', attribute: 'data-approval-key', selector: '[data-approval-key]' },
    { kind: 'question', attribute: 'data-question-key', selector: '[data-question-key]' },
    { kind: 'plan', attribute: 'data-plan-review-key', selector: '[data-plan-review-key]' },
  ];
  const SCROLL_SELECTORS = ['[data-approval-scroll]', '[data-question-scroll]'];
  const TITLE_MARK = '⚠ ';
  const MESSAGE_LIMIT = 300;

  const settings = { enabled: true, onlyWhenUnfocused: false };
  /** Interações já avisadas nesta página, para não repetir a cada mutação. */
  const notifiedKeys = new Set();
  let active = null; // { kind, key }
  let titleDirty = false;
  let scheduled = false;
  let audioContext = null;

  /* ------------------------------------------------------------------ */
  /* Preferências                                                        */
  /* ------------------------------------------------------------------ */

  function applySettings(values) {
    settings.enabled = values.enabled !== false;
    settings.onlyWhenUnfocused = values.onlyWhenUnfocused === true;
  }

  try {
    chrome.storage.local.get({ enabled: true, onlyWhenUnfocused: false }, (values) => {
      if (chrome.runtime.lastError) return;
      applySettings(values);
      sync();
    });

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return;
      if (changes.enabled) settings.enabled = changes.enabled.newValue !== false;
      if (changes.onlyWhenUnfocused) {
        settings.onlyWhenUnfocused = changes.onlyWhenUnfocused.newValue === true;
      }
    });
  } catch (error) {
    console.warn('[dsh-approval-notifier] preferências indisponíveis', error);
  }

  /* ------------------------------------------------------------------ */
  /* Comunicação com o service worker                                    */
  /* ------------------------------------------------------------------ */

  function send(message) {
    try {
      // Depois de recarregar a extensão, o contexto antigo perde runtime.id.
      if (!chrome.runtime?.id) return;
      const result = chrome.runtime.sendMessage(message);
      if (result && typeof result.catch === 'function') {
        result.catch(() => {
          /* service worker dormindo: o toast é um extra, não um requisito */
        });
      }
    } catch {
      /* contexto invalidado */
    }
  }

  function shouldAlert() {
    if (!settings.enabled) return false;
    if (!settings.onlyWhenUnfocused) return true;
    return document.hidden || !document.hasFocus();
  }

  /* ------------------------------------------------------------------ */
  /* Leitura do painel                                                   */
  /* ------------------------------------------------------------------ */

  function findPanel() {
    for (const spec of PANELS) {
      const element = document.querySelector(spec.selector);
      if (element) {
        const key = element.getAttribute(spec.attribute) ?? '';
        if (key !== '') return { spec, element, key };
      }
    }
    return null;
  }

  function describe(element) {
    let text = '';
    for (const selector of SCROLL_SELECTORS) {
      const scroll = element.querySelector(selector);
      const candidate = scroll?.innerText?.trim() ?? scroll?.textContent?.trim() ?? '';
      if (candidate !== '') {
        text = candidate;
        break;
      }
    }
    if (text === '') text = element.textContent ?? '';
    return text.replace(/\s+/g, ' ').trim().slice(0, MESSAGE_LIMIT);
  }

  function isAnswered(element) {
    return element.getAttribute('aria-busy') === 'true';
  }

  function markTitle(on) {
    if (on) {
      if (document.title.startsWith(TITLE_MARK)) return;
      document.title = TITLE_MARK + document.title;
      titleDirty = true;
      return;
    }
    if (!titleDirty) return;
    if (document.title.startsWith(TITLE_MARK)) {
      document.title = document.title.slice(TITLE_MARK.length);
    }
    titleDirty = false;
  }

  function beep() {
    try {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return;
      audioContext = audioContext ?? new Ctor();
      if (audioContext.state === 'suspended') {
        void audioContext.resume().catch(() => {});
      }
      const start = audioContext.currentTime;
      [880, 1180].forEach((frequency, index) => {
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.value = frequency;
        const at = start + index * 0.18;
        gain.gain.setValueAtTime(0.0001, at);
        gain.gain.exponentialRampToValueAtTime(0.14, at + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.16);
        oscillator.connect(gain).connect(audioContext.destination);
        oscillator.start(at);
        oscillator.stop(at + 0.18);
      });
    } catch {
      /* áudio bloqueado por política de autoplay — seguimos com o toast */
    }
  }

  /* ------------------------------------------------------------------ */
  /* Sincronização                                                       */
  /* ------------------------------------------------------------------ */

  function forget() {
    if (active === null) return;
    notifiedKeys.delete(active.key);
    active = null;
  }

  function clearActive() {
    if (active === null) return;
    send({ type: 'interaction-resolved', key: active.key });
    forget();
  }

  function sync() {
    const panel = findPanel();

    if (panel === null || isAnswered(panel.element)) {
      clearActive();
      markTitle(false);
      return;
    }

    markTitle(true);

    if (active === null || active.key !== panel.key) {
      // Interação nova: a anterior, se havia, saiu sem ser respondida.
      if (active !== null) {
        send({ type: 'interaction-resolved', key: active.key });
        notifiedKeys.delete(active.key);
      }
      active = { kind: panel.spec.kind, key: panel.key };
    }

    if (notifiedKeys.has(panel.key)) return;
    // Silenciado por foco: não marca como avisado, para os listeners de
    // blur/visibilidade avisarem quando a janela sair de foco.
    if (!shouldAlert()) return;

    notifiedKeys.add(panel.key);
    send({
      type: 'interaction-pending',
      kind: panel.spec.kind,
      key: panel.key,
      text: describe(panel.element),
    });
    beep();
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      sync();
    });
  }

  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: [
      'data-approval-key',
      'data-question-key',
      'data-plan-review-key',
      'aria-busy',
    ],
  });

  // Um pedido que chega com a janela em foco ainda precisa avisar quando ela
  // perde o foco, então reavaliamos o estado nesses eventos.
  window.addEventListener('blur', schedule);
  window.addEventListener('focus', schedule);
  document.addEventListener('visibilitychange', schedule);

  // A interação pode já estar na tela quando este script entra (reload).
  sync();
})();
