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
  const BANNER_ATTR = 'data-dsh-notifier-stale';

  const settings = { enabled: true, onlyWhenUnfocused: false };
  /** Interações já avisadas nesta página, para não repetir a cada mutação. */
  const notifiedKeys = new Set();
  let active = null; // { kind, key }
  let titleDirty = false;
  let scheduled = false;
  let audioContext = null;
  let bannerShown = false;

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
  /* Aviso de contexto órfão                                             */
  /* ------------------------------------------------------------------ */

  /**
   * Recarregar a extensão no chrome://extensions invalida o contexto deste
   * script nas abas já abertas: ele continua na página, mas não fala mais com
   * o service worker. Sem isto, a extensão falharia em silêncio.
   */
  function showStaleBanner() {
    if (bannerShown) return;
    bannerShown = true;
    try {
      if (document.querySelector(`[${BANNER_ATTR}]`) !== null) return;
      const banner = document.createElement('div');
      banner.setAttribute(BANNER_ATTR, '');
      banner.textContent = 'Aviso de aprovação inativo — recarregue a página (F5)';
      banner.setAttribute(
        'style',
        [
          'position:fixed',
          'z-index:2147483647',
          'right:16px',
          'bottom:16px',
          'padding:10px 14px',
          'border-radius:10px',
          'border:1px solid #E6A447',
          'background:#1E2128',
          'color:#F4E3C8',
          'font:500 13px/1.4 "Segoe UI",system-ui,sans-serif',
          'box-shadow:0 8px 24px rgba(0,0,0,.45)',
          'pointer-events:none',
        ].join(';'),
      );
      (document.body ?? document.documentElement).appendChild(banner);
    } catch {
      /* se nem o aviso visual for possível, seguimos calados */
    }
  }

  /* ------------------------------------------------------------------ */
  /* Comunicação com o service worker                                    */
  /* ------------------------------------------------------------------ */

  function hasRuntime() {
    try {
      return Boolean(chrome.runtime?.id);
    } catch {
      return false;
    }
  }

  function send(message) {
    if (!hasRuntime()) {
      showStaleBanner();
      return false;
    }
    try {
      const result = chrome.runtime.sendMessage(message);
      if (result && typeof result.catch === 'function') {
        result.catch(() => {
          /* service worker dormindo: o toast é um extra, não um requisito */
        });
      }
      return true;
    } catch {
      showStaleBanner();
      return false;
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

  function armAudio() {
    try {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return;
      audioContext = audioContext ?? new Ctor();
      if (audioContext.state === 'suspended') {
        void audioContext.resume().catch(() => {});
      }
    } catch {
      audioContext = null;
    }
  }

  function beep() {
    // Sem um gesto do usuário na página o Chrome mantém o contexto suspenso e
    // registra um aviso no console; nesse caso ficamos só com o toast.
    if (audioContext === null || audioContext.state !== 'running') return;
    try {
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
      /* contexto fechado ou áudio bloqueado — o toast continua valendo */
    }
  }

  // O áudio do Chrome só é liberado dentro de um gesto do usuário, então
  // preparamos o contexto no primeiro clique/tecla e o reativamos se preciso.
  for (const gesture of ['pointerdown', 'keydown']) {
    window.addEventListener(gesture, armAudio, { capture: true, passive: true });
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

  // Apresenta-se ao service worker: o popup usa isso para saber se o script
  // está vivo em alguma aba.
  send({ type: 'hello' });

  // A interação pode já estar na tela quando este script entra (reload).
  sync();
})();
