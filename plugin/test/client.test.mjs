/**
 * Teste do plugin de cliente, com o carregador de módulos, o contexto Cordis,
 * a API de notificações, os timers e o relógio simulados.
 * Roda com: node test/client.test.mjs
 *
 * O arquivo testado é exatamente o que o navegador carrega
 * (client/lib/client.js) — nada é reimplementado aqui.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, '..', 'client', 'lib', 'client.js'), 'utf8');

/** 21/10/2026 23:30 no fuso local: dentro da janela 22:00→08:00. */
const NIGHT = new Date(2026, 9, 21, 23, 30, 0, 0).getTime();
/** Mesmo dia ao meio-dia: fora daquela janela. */
const NOON = new Date(2026, 9, 21, 12, 0, 0, 0).getTime();

function loadPlugin({ permission = 'granted', clock = NOON } = {}) {
  const created = [];
  const states = { title: 'DeepSeek Harness', hidden: false, focused: true, now: clock };
  const timers = new Map();
  let sequence = 0;

  class FakeDate extends Date {
    constructor(...args) {
      super(...(args.length > 0 ? args : [states.now]));
    }
    static now() {
      return states.now;
    }
  }

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
    Date: FakeDate,
    setTimeout: (fn, ms) => {
      sequence += 1;
      timers.set(sequence, { fn, ms });
      return sequence;
    },
    clearTimeout: (id) => {
      timers.delete(id);
    },
    console,
  }, { filename: 'client.js' });

  return {
    exported,
    created,
    states,
    Notification: FakeNotification,
    /** Executa todos os timers pendentes (lembrete ou fim da janela). */
    runTimers() {
      const pendingTimers = [...timers.values()];
      timers.clear();
      for (const timer of pendingTimers) timer.fn();
    },
    timerCount: () => timers.size,
    timerDelays: () => [...timers.values()].map((timer) => timer.ms),
    fire(type) {
      windowListeners.get(type)?.();
    },
  };
}

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

  ctx.setPending('s1', { kind: 'question', key: 'q1' });
  ctx.emit();
  ctx.setPending('s1', { kind: 'plan', key: 'p1' });
  ctx.emit();

  assert(created[0].title === 'DSH aguardando sua resposta', `pergunta: "${created[0].title}"`);
  assert(created[1].title === 'DSH aguardando revisão do plano', `plano: "${created[1].title}"`);
});

scenario('mesma chave não duplica', () => {
  const { exported, created } = loadPlugin();
  const ctx = createContext();
  exported.apply(ctx, {});

  ctx.setPending('s1', { kind: 'approval', key: 'a1' });
  ctx.emit();
  ctx.emit();
  ctx.emit();

  assert(created.length === 1, 'mutações repetidas não criam outra notificação');
});

scenario('interação resolvida fecha o aviso', () => {
  const { exported, created, states, timerCount } = loadPlugin();
  const ctx = createContext();
  exported.apply(ctx, {});

  ctx.setPending('s1', { kind: 'approval', key: 'a1' });
  ctx.emit();
  ctx.clearPending('s1');
  ctx.emit();

  assert(created[0].closed === true, 'notificação anterior fechada');
  assert(states.title === 'DeepSeek Harness', 'título restaurado');
  assert(timerCount() === 0, 'lembrete cancelado ao resolver');
});

scenario('interação nova substitui a anterior', () => {
  const { exported, created } = loadPlugin();
  const ctx = createContext();
  exported.apply(ctx, {});

  ctx.setPending('s1', { kind: 'approval', key: 'a1' });
  ctx.emit();
  ctx.setPending('s1', { kind: 'question', key: 'q1' });
  ctx.emit();

  assert(created.length === 2, 'duas notificações no total');
  assert(created[0].closed === true, 'a primeira foi fechada ao trocar');
  assert(created[1].closed === false, 'a nova segue aberta');
});

scenario('modo "só fora de foco"', () => {
  const { exported, created, states, fire } = loadPlugin();
  const ctx = createContext();
  exported.apply(ctx, { onlyWhenUnfocused: true });

  ctx.setPending('s1', { kind: 'approval', key: 'a1' });
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

  ctx.setPending('s1', { kind: 'approval', key: 'a1' });
  ctx.emit();

  assert(created.length === 0, 'não cria notificação sem permissão');
  assert(states.title.startsWith('⚠ '), 'cai no selo do título como reserva');
});

scenario('agregação de pedidos pendentes', () => {
  const { exported, created } = loadPlugin();
  const ctx = createContext();
  exported.apply(ctx, {});

  ctx.setPending('s1', { kind: 'approval', key: 'a1' });
  ctx.emit();
  assert(created[0].options.body === 'Clique para voltar à conversa.', 'corpo simples com um pedido');

  ctx.setPending('s2', { kind: 'question', key: 'b2' });
  ctx.emit();

  assert(
    created[1].options.body.includes('2 pedidos pendentes'),
    `corpo agregado: "${created[1].options.body}"`,
  );
});

scenario('lembrete reexibe o pedido e respeita o limite', () => {
  const { exported, created, timerDelays, runTimers } = loadPlugin();
  const ctx = createContext();
  exported.apply(ctx, {});

  ctx.setPending('s1', { kind: 'approval', key: 'a1' });
  ctx.emit();
  assert(timerDelays()[0] === 90000, 'primeiro lembrete em 90s');

  runTimers();
  assert(created.length === 2, 'notificação reexibida no lembrete');
  assert(created[0].closed === true, 'a anterior foi fechada');

  runTimers();
  runTimers();
  runTimers();

  // 1 original + no máximo 3 lembretes.
  assert(created.length === 4, `total de exibições: ${created.length} (esperado 4)`);
});

scenario('lembrete para de existir quando o pedido é respondido', () => {
  const { exported, created, runTimers, timerCount } = loadPlugin();
  const ctx = createContext();
  exported.apply(ctx, {});

  ctx.setPending('s1', { kind: 'question', key: 'q1' });
  ctx.emit();
  ctx.clearPending('s1');
  ctx.emit();

  runTimers();
  assert(created.length === 1, 'nenhum lembrete depois de responder');
  assert(timerCount() === 0, 'sem timers pendentes');
});

scenario('horário de silêncio segura pergunta e entrega no fim da janela', () => {
  const environment = loadPlugin({ clock: NIGHT });
  const ctx = createContext();
  environment.exported.apply(ctx, {
    quietEnabled: true,
    quietStart: '22:00',
    quietEnd: '08:00',
  });

  ctx.setPending('s1', { kind: 'question', key: 'q1' });
  ctx.emit();

  assert(environment.created.length === 0, 'nada é exibido durante o silêncio');
  assert(environment.states.title.startsWith('⚠ '), 'título marcado mesmo calado');
  assert(environment.timerDelays()[0] > 0, 'entrega agendada para o fim da janela');

  // Simula a chegada do fim da janela.
  environment.states.now = new Date(2026, 9, 22, 8, 1, 0, 0).getTime();
  environment.runTimers();

  assert(environment.created.length === 1, 'toast entregue quando a janela termina');
});

scenario('silêncio descarta o pedido respondido durante a espera', () => {
  const environment = loadPlugin({ clock: NIGHT });
  const ctx = createContext();
  environment.exported.apply(ctx, {
    quietEnabled: true,
    quietStart: '22:00',
    quietEnd: '08:00',
  });

  ctx.setPending('s1', { kind: 'question', key: 'q1' });
  ctx.emit();
  ctx.clearPending('s1');
  ctx.emit();

  environment.states.now = new Date(2026, 9, 22, 8, 1, 0, 0).getTime();
  environment.runTimers();

  assert(environment.created.length === 0, 'nem o aviso retido é entregue');
});

scenario('aprovação fura o silêncio', () => {
  const environment = loadPlugin({ clock: NIGHT });
  const ctx = createContext();
  environment.exported.apply(ctx, {
    quietEnabled: true,
    quietStart: '22:00',
    quietEnd: '08:00',
    quietBypassApproval: true,
  });

  ctx.setPending('s1', { kind: 'approval', key: 'a1' });
  ctx.emit();

  assert(environment.created.length === 1, 'aprovação notifica mesmo no silêncio');

  const blocked = loadPlugin({ clock: NIGHT });
  const blockedCtx = createContext();
  blocked.exported.apply(blockedCtx, {
    quietEnabled: true,
    quietStart: '22:00',
    quietEnd: '08:00',
    quietBypassApproval: false,
  });
  blockedCtx.setPending('s1', { kind: 'approval', key: 'a1' });
  blockedCtx.emit();
  assert(blocked.created.length === 0, 'com o bypass desligado, aprovação também espera');
});

scenario('matemática da janela de silêncio', () => {
  const { exported } = loadPlugin();
  const { quiet } = exported;

  assert(quiet.parseHHMM('22:00') === 1320, 'interpreta HH:MM');
  assert(quiet.parseHHMM('24:00') === null, 'rejeita hora inválida');
  assert(quiet.inQuietHours(new Date(2026, 9, 21, 23, 0), '22:00', '08:00') === true, 'dentro da janela que virou o dia');
  assert(quiet.inQuietHours(new Date(2026, 9, 21, 8, 0), '22:00', '08:00') === false, 'no fim, exclusivo');
  assert(quiet.minutesUntilEnd(new Date(2026, 9, 21, 23, 0), '22:00', '08:00') === 540, 'faltam 9h');
});

scenario('snapshot com várias sessões', () => {
  const { exported, created } = loadPlugin();
  const ctx = createContext();
  exported.apply(ctx, {});

  ctx.setPending('s1', null);
  ctx.setPending('s2', { kind: 'question', key: 'q9' });
  ctx.emit();

  assert(created.length === 1, 'ignora sessões sem pendência');
  assert(created[0].title === 'DSH aguardando sua resposta', 'usa a sessão com pendência');
});

const failed = results.filter((result) => !result.ok).length;
console.log(`\n${results.length - failed}/${results.length} verificações passaram.`);
