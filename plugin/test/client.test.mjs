/**
 * Teste do plugin de cliente, com o carregador de módulos, o contexto Cordis e
 * a API de notificações simulados. Roda com: node test/client.test.mjs
 *
 * O arquivo testado é exatamente o que o navegador carrega
 * (plugin/client/lib/client.js) — nada é reimplementado aqui.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, '..', 'client', 'lib', 'client.js'), 'utf8');

/** Cria o ambiente do navegador e devolve os módulos exportados pelo plugin. */
function loadPlugin({ permission = 'granted' } = {}) {
  const created = [];
  const states = { title: 'DeepSeek Harness', hidden: false, focused: true };

  class FakeNotification {
    static permission = permission;
    static requestPermission() {
      FakeNotification.permission = 'granted';
      return Promise.resolve('granted');
    }
    constructor(title, options) {
      this.title = title;
      this.options = options;
      this.closed = false;
      created.push(this);
    }
    close() {
      this.closed = true;
    }
  }

  let exported = null;
  const windowListeners = new Map();
  const window = {
    __ModuleLoader__: {
      load: ({ id, factory }) => {
        exported = factory(() => ({}));
      },
    },
    focus() {},
    addEventListener: (type, listener) => windowListeners.set(type, listener),
    removeEventListener: (type) => windowListeners.delete(type),
  };
  const document = {
    get title() {
      return states.title;
    },
    set title(value) {
      states.title = value;
    },
    get hidden() {
      return states.hidden;
    },
    hasFocus: () => states.focused,
  };

  vm.runInNewContext(source, {
    window,
    document,
    Notification: FakeNotification,
    console,
  }, { filename: 'client.js' });

  return {
    exported,
    created,
    states,
    Notification: FakeNotification,
    /** Simula a janela perdendo ou ganhando foco. */
    fire(type) {
      windowListeners.get(type)?.();
    },
  };
}

/** Contexto Cordis mínimo: `effect`, `uiSession.sessionStatus` observável. */
function createContext() {
  const snapshot = new Map();
  const listeners = new Set();

  return {
    effect(fn) {
      return fn();
    },
    uiSession: {
      sessionStatus: {
        getSnapshot: () => snapshot,
        subscribe: (listener) => {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
      },
    },
    setPending(sessionId, pendingInteraction) {
      snapshot.set(sessionId, { running: false, pendingInteraction });
    },
    clearPending(sessionId) {
      snapshot.delete(sessionId);
    },
    emit() {
      for (const listener of listeners) listener();
    },
  };
}

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

scenario('sem interação pendente', () => {
  const { exported, created, states } = loadPlugin();
  const ctx = createContext();
  exported.apply(ctx, {});

  assert(created.length === 0, 'nenhuma notificação criada');
  assert(states.title === 'DeepSeek Harness', 'título intacto');
  assert(exported.inject.includes('uiSession'), 'declara injeção de uiSession');
});

scenario('aprovação pendente', () => {
  const { exported, created, states } = loadPlugin();
  const ctx = createContext();
  exported.apply(ctx, {});

  ctx.setPending('session-1', { kind: 'approval', key: 'a1' });
  ctx.emit();

  assert(created.length === 1, 'uma notificação criada');
  assert(created[0].title === 'DSH aguardando sua aprovação', 'título de aprovação');
  assert(states.title.startsWith('⚠ '), 'título da aba marcado');
});

scenario('pergunta e plano usam títulos próprios', () => {
  const { exported, created } = loadPlugin();
  const ctx = createContext();
  exported.apply(ctx, {});

  ctx.setPending('session-1', { kind: 'question', key: 'q1' });
  ctx.emit();
  ctx.setPending('session-1', { kind: 'plan', key: 'p1' });
  ctx.emit();

  assert(
    created[0].title === 'DSH aguardando sua resposta',
    `título da pergunta: "${created[0].title}"`,
  );
  assert(
    created[1].title === 'DSH aguardando revisão do plano',
    `título do plano: "${created[1].title}"`,
  );
});

scenario('mesma chave não duplica', () => {
  const { exported, created } = loadPlugin();
  const ctx = createContext();
  exported.apply(ctx, {});

  ctx.setPending('session-1', { kind: 'approval', key: 'a1' });
  ctx.emit();
  ctx.emit();
  ctx.emit();

  assert(created.length === 1, 'mutações repetidas não criam outra notificação');
});

scenario('interação resolvida fecha o aviso', () => {
  const { exported, created, states } = loadPlugin();
  const ctx = createContext();
  exported.apply(ctx, {});

  ctx.setPending('session-1', { kind: 'approval', key: 'a1' });
  ctx.emit();
  ctx.clearPending('session-1');
  ctx.emit();

  assert(created[0].closed === true, 'notificação anterior fechada');
  assert(states.title === 'DeepSeek Harness', 'título restaurado');
});

scenario('interação nova substitui a anterior', () => {
  const { exported, created } = loadPlugin();
  const ctx = createContext();
  exported.apply(ctx, {});

  ctx.setPending('session-1', { kind: 'approval', key: 'a1' });
  ctx.emit();
  ctx.setPending('session-1', { kind: 'question', key: 'q1' });
  ctx.emit();

  assert(created.length === 2, 'duas notificações no total');
  assert(created[0].closed === true, 'a primeira foi fechada ao trocar');
  assert(created[1].closed === false, 'a nova segue aberta');
});

scenario('modo "só fora de foco"', () => {
  const { exported, created, states, fire } = loadPlugin();
  const ctx = createContext();
  exported.apply(ctx, { onlyWhenUnfocused: true });

  ctx.setPending('session-1', { kind: 'approval', key: 'a1' });
  ctx.emit();
  assert(created.length === 0, 'silencia com a janela em foco');
  assert(states.title.startsWith('⚠ '), 'ainda marca o título');

  states.focused = false;
  fire('blur');
  assert(created.length === 1, 'avisa quando a janela perde o foco');
});

scenario('permissão de notificação negada', () => {
  const { exported, created, states } = loadPlugin({ permission: 'denied' });
  const ctx = createContext();
  exported.apply(ctx, {});

  ctx.setPending('session-1', { kind: 'approval', key: 'a1' });
  ctx.emit();

  assert(created.length === 0, 'não cria notificação sem permissão');
  assert(states.title.startsWith('⚠ '), 'cai no selo do título como reserva');
});

scenario('snapshot com várias sessões', () => {
  const { exported, created } = loadPlugin();
  const ctx = createContext();
  exported.apply(ctx, {});

  ctx.setPending('session-1', null);
  ctx.setPending('session-2', { kind: 'question', key: 'q9' });
  ctx.emit();

  assert(created.length === 1, 'ignora sessões sem pendência');
  assert(created[0].title === 'DSH aguardando sua resposta', 'usa a sessão com pendência');
});

const failed = results.filter((result) => !result.ok).length;
console.log(`\n${results.length - failed}/${results.length} verificações passaram.`);
