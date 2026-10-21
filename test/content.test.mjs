/**
 * Teste de fumaça do content script, com DOM e APIs do Chrome simulados.
 * Roda com: node test/content.test.mjs
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, '..', 'content.js'), 'utf8');

const PANEL_SHAPES = {
  approval: {
    attribute: 'data-approval-key',
    selector: '[data-approval-key]',
    scroll: '[data-approval-scroll]',
  },
  question: {
    attribute: 'data-question-key',
    selector: '[data-question-key]',
    scroll: '[data-question-scroll]',
  },
  plan: {
    attribute: 'data-plan-review-key',
    selector: '[data-plan-review-key]',
    scroll: null,
  },
};

/**
 * DOM mínimo: no máximo um painel na tela, como no compositor real.
 * `state.panel = { kind, key, answered, text }` ou null.
 */
function createPage() {
  const state = {
    panel: null,
    focused: true,
  };

  function buildPanel() {
    const shape = PANEL_SHAPES[state.panel.kind];

    return {
      getAttribute(name) {
        if (name === shape.attribute) return state.panel.key;
        if (name === 'aria-busy') return state.panel.answered ? 'true' : 'false';
        return null;
      },
      querySelector(selector) {
        if (selector !== shape.scroll) return null;
        return { innerText: state.panel.text, textContent: state.panel.text };
      },
      get textContent() {
        return state.panel.text;
      },
    };
  }

  const document = {
    title: 'DeepSeek Harness',
    hidden: false,
    hasFocus: () => state.focused,
    querySelector(selector) {
      if (state.panel === null) return null;
      const shape = PANEL_SHAPES[state.panel.kind];
      return selector === shape.selector ? buildPanel() : null;
    },
    documentElement: {},
  };

  return { state, document };
}

function createChrome({ enabled = true, onlyWhenUnfocused = false } = {}) {
  const messages = [];
  const chrome = {
    runtime: {
      id: 'test-extension',
      lastError: null,
      sendMessage: (message) => {
        messages.push(message);
        return Promise.resolve({ ok: true });
      },
    },
    storage: {
      local: {
        get: (_defaults, callback) => callback({ enabled, onlyWhenUnfocused }),
      },
      onChanged: { addListener: () => {} },
    },
  };
  return { messages, chrome };
}

/**
 * Executa o content script num contexto isolado. Devolve gatilhos para
 * simular mutações do DOM e mudança de foco, como o navegador faria.
 */
function load({ document, chrome, AudioContext: AudioCtor }) {
  let observerCallback = null;
  const windowListeners = new Map();

  const context = {
    document: Object.assign(document, {
      addEventListener: () => {},
    }),
    chrome,
    window: {
      AudioContext: AudioCtor,
      webkitAudioContext: undefined,
      addEventListener: (type, callback) => windowListeners.set(type, callback),
    },
    MutationObserver: class {
      constructor(callback) {
        observerCallback = callback;
      }
      observe() {}
      disconnect() {}
    },
    // rAF imediato, para o teste ser determinístico.
    requestAnimationFrame: (callback) => callback(),
    setTimeout,
    console,
  };

  vm.runInNewContext(source, context, { filename: 'content.js' });

  return {
    tick() {
      observerCallback?.([]);
    },
    blur() {
      windowListeners.get('blur')?.();
    },
    gesture(type) {
      windowListeners.get(type)?.();
    },
  };
}

const messagesByType = (runtime, type) =>
  runtime.messages.filter((message) => message.type === type);

const results = [];
function assert(condition, description) {
  results.push({ ok: Boolean(condition), description });
  console.log(`${condition ? 'ok  ' : 'FALHOU'} ${description}`);
  if (!condition) process.exitCode = 1;
}

function scenario(name, run) {
  console.log(`\n# ${name}`);
  run();
}

scenario('página sem interação pendente', () => {
  const page = createPage();
  const runtime = createChrome();
  load({ document: page.document, chrome: runtime.chrome });
  assert(messagesByType(runtime, 'interaction-pending').length === 0, 'nenhuma notificação ao carregar');
  assert(messagesByType(runtime, 'hello').length === 1, 'content script se apresenta ao service worker');
  assert(page.document.title === 'DeepSeek Harness', 'título intacto');
});

scenario('aprovação pendente', () => {
  const page = createPage();
  const runtime = createChrome();
  page.state.panel = {
    kind: 'approval',
    key: '1',
    answered: false,
    text: 'Permitir acesso a C:\\fora-do-workspace',
  };
  load({ document: page.document, chrome: runtime.chrome });

  const pending = messagesByType(runtime, 'interaction-pending');
  assert(pending.length === 1, 'uma mensagem interaction-pending');
  assert(pending[0].kind === 'approval', 'tipo approval identificado');
  assert(pending[0].key === '1', 'chave do pedido propagada');
  assert(
    pending[0].text === 'Permitir acesso a C:\\fora-do-workspace',
    `texto extraído: "${pending[0].text}"`,
  );
  assert(page.document.title.startsWith('⚠ '), 'título marcado com ⚠');
});

scenario('pergunta do ask_user_question', () => {
  const page = createPage();
  const runtime = createChrome();
  page.state.panel = {
    kind: 'question',
    key: '2',
    answered: false,
    text: 'Qual formato de saída você prefere?',
  };
  load({ document: page.document, chrome: runtime.chrome });

  const pending = messagesByType(runtime, 'interaction-pending');
  assert(pending.length === 1, 'uma mensagem interaction-pending');
  assert(pending[0].kind === 'question', 'tipo question identificado');
});

scenario('revisão de plano', () => {
  const page = createPage();
  const runtime = createChrome();
  page.state.panel = {
    kind: 'plan',
    key: '3',
    answered: false,
    text: 'Revisar plano de implementação',
  };
  load({ document: page.document, chrome: runtime.chrome });

  const pending = messagesByType(runtime, 'interaction-pending');
  assert(pending.length === 1 && pending[0].kind === 'plan', 'tipo plan identificado');
});

scenario('interação respondida limpa o alerta', () => {
  const page = createPage();
  const runtime = createChrome();
  page.state.panel = {
    kind: 'approval',
    key: '4',
    answered: false,
    text: 'Rodar comando com acesso total',
  };
  const script = load({ document: page.document, chrome: runtime.chrome });

  page.state.panel.answered = true;
  script.tick();

  const resolved = messagesByType(runtime, 'interaction-resolved');
  assert(resolved.length === 1 && resolved[0].key === '4', 'envia interaction-resolved');
  assert(page.document.title === 'DeepSeek Harness', 'título restaurado');
});

scenario('interação removida da tela', () => {
  const page = createPage();
  const runtime = createChrome();
  page.state.panel = {
    kind: 'question',
    key: '5',
    answered: false,
    text: 'Escolha uma opção',
  };
  const script = load({ document: page.document, chrome: runtime.chrome });

  page.state.panel = null;
  script.tick();

  const resolved = messagesByType(runtime, 'interaction-resolved');
  assert(resolved.length === 1 && resolved[0].key === '5', 'resolve ao sumir o painel');
});

scenario('interação nova substitui a anterior', () => {
  const page = createPage();
  const runtime = createChrome();
  page.state.panel = {
    kind: 'approval',
    key: '6',
    answered: false,
    text: 'Primeiro pedido',
  };
  const script = load({ document: page.document, chrome: runtime.chrome });

  page.state.panel = { kind: 'question', key: '7', answered: false, text: 'Segundo pedido' };
  script.tick();

  const resolved = messagesByType(runtime, 'interaction-resolved');
  const pending = messagesByType(runtime, 'interaction-pending');
  assert(resolved.some((m) => m.key === '6'), 'encerra o pedido anterior');
  assert(pending.some((m) => m.key === '7' && m.kind === 'question'), 'avisa o novo pedido');
});

scenario('mesma interação não duplica notificação', () => {
  const page = createPage();
  const runtime = createChrome();
  page.state.panel = {
    kind: 'approval',
    key: '8',
    answered: false,
    text: 'Pedido estável',
  };
  const script = load({ document: page.document, chrome: runtime.chrome });

  script.tick();
  script.tick();

  assert(
    messagesByType(runtime, 'interaction-pending').length === 1,
    'mutação repetida não repete o aviso',
  );
});

scenario('avisos desativados nas preferências', () => {
  const page = createPage();
  const runtime = createChrome({ enabled: false });
  page.state.panel = {
    kind: 'approval',
    key: '9',
    answered: false,
    text: 'Não deve notificar',
  };
  const script = load({ document: page.document, chrome: runtime.chrome });
  script.tick();

  assert(messagesByType(runtime, 'interaction-pending').length === 0, 'nenhuma notificação com enabled: false');
});

scenario('modo "só fora de foco"', () => {
  const page = createPage();
  const runtime = createChrome({ onlyWhenUnfocused: true });
  page.state.panel = {
    kind: 'approval',
    key: '10',
    answered: false,
    text: 'Esperando decisão',
  };
  const script = load({ document: page.document, chrome: runtime.chrome });

  script.tick();
  assert(messagesByType(runtime, 'interaction-pending').length === 0, 'silencia com a janela em foco');

  page.state.focused = false;
  script.blur();
  assert(
    messagesByType(runtime, 'interaction-pending').some((m) => m.key === '10'),
    'avisa quando a janela perde o foco',
  );
});

scenario('áudio só toca depois de um gesto do usuário', () => {
  const page = createPage();
  const runtime = createChrome();
  let created = 0;
  let plays = 0;

  class FakeAudioContext {
    constructor() {
      created += 1;
      this.state = 'suspended';
      this.currentTime = 0;
      this.destination = {};
    }
    resume() {
      this.state = 'running';
      return Promise.resolve();
    }
    createOscillator() {
      const node = { type: '', frequency: { value: 0 }, start: () => { plays += 1; }, stop: () => {} };
      node.connect = () => node;
      return node;
    }
    createGain() {
      const node = { gain: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} } };
      node.connect = () => node;
      return node;
    }
  }

  page.state.panel = { kind: 'approval', key: '11', answered: false, text: 'Pedido' };
  const script = load({
    document: page.document,
    chrome: runtime.chrome,
    AudioContext: FakeAudioContext,
  });

  assert(created === 0, 'nenhum contexto criado sem gesto (evita o aviso do Chrome)');
  assert(plays === 0, 'nenhum som tentado sem gesto');

  script.gesture('pointerdown');
  assert(created === 1, 'contexto criado dentro do gesto');
  assert(
    messagesByType(runtime, 'interaction-pending').length === 1,
    'toast/aviso continuou valendo mesmo sem áudio',
  );
});

const failed = results.filter((result) => !result.ok).length;
console.log(`\n${results.length - failed}/${results.length} verificações passaram.`);
