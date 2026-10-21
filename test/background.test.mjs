/**
 * Teste do service worker com as APIs do Chrome simuladas.
 * Roda com: node test/background.test.mjs
 *
 * Cobre o que o content script não pode provar: agregação de pedidos, badge,
 * lembretes via `chrome.alarms`, horário de silêncio e encerramento dos
 * lembretes quando o pedido é respondido ou o toast é fechado.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const here = dirname(fileURLToPath(import.meta.url));
const backgroundSource = readFileSync(join(here, '..', 'background.js'), 'utf8');
const quietSource = readFileSync(join(here, '..', 'quiet-hours.js'), 'utf8');

function createChrome({ settings = {} } = {}) {
  const notifications = new Map();
  const created = [];
  const cleared = [];
  const alarms = new Map();
  const badges = [];
  const titles = [];
  const listeners = { message: [], clicked: [], closed: [], alarm: [] };

  const chrome = {
    storage: {
      local: {
        get: async (defaults = {}) => ({ ...defaults, ...settings }),
      },
    },
    notifications: {
      async create(id, options) {
        notifications.set(id, options);
        created.push({ id, options });
      },
      async clear(id) {
        notifications.delete(id);
        cleared.push(id);
        return true;
      },
      onClicked: { addListener: (fn) => listeners.clicked.push(fn) },
      onClosed: { addListener: (fn) => listeners.closed.push(fn) },
    },
    alarms: {
      async create(name, info) {
        alarms.set(name, info);
      },
      async clear(name) {
        alarms.delete(name);
        return true;
      },
      onAlarm: { addListener: (fn) => listeners.alarm.push(fn) },
    },
    action: {
      setBadgeText: ({ text }) => badges.push(text),
      setBadgeBackgroundColor: () => {},
      setTitle: ({ title }) => titles.push(title),
    },
    tabs: {
      async query() {
        return [];
      },
      async update() {
        return { windowId: 1 };
      },
    },
    windows: {
      async update() {},
    },
    runtime: {
      onMessage: { addListener: (fn) => listeners.message.push(fn) },
    },
  };

  const context = vm.createContext({ chrome, console, setTimeout, clearTimeout });
  vm.runInContext(quietSource, context, { filename: 'quiet-hours.js' });
  vm.runInContext(backgroundSource, context, { filename: 'background.js' });

  return {
    chrome,
    created,
    cleared,
    alarms,
    badges,
    /** Envia uma mensagem e espera a resposta do listener. */
    send(message, sender = { tab: { id: 7 } }) {
      return new Promise((resolve) => {
        listeners.message[0](message, sender, resolve);
      });
    },
    click(notificationId) {
      for (const listener of listeners.clicked) listener(notificationId);
    },
    close(notificationId) {
      for (const listener of listeners.closed) listener(notificationId);
    },
    fireAlarm(name) {
      for (const listener of listeners.alarm) listener({ name });
    },
  };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const results = [];
function assert(condition, description) {
  results.push({ ok: Boolean(condition), description });
  console.log(`${condition ? 'ok  ' : 'FALHOU'} ${description}`);
  if (!condition) process.exitCode = 1;
}

function scenario(name) {
  console.log(`\n# ${name}`);
}

const pendingMessage = (key, text, kind = 'approval') => ({
  type: 'interaction-pending',
  kind,
  key,
  text,
});

async function main() {
  scenario('pedido pendente vira notificação');
  {
    const env = createChrome();
    await env.send(pendingMessage('a1', 'Ferramenta pwsh quer rodar: npm test'));
    assert(env.created.length === 1, 'uma notificação criada');
    assert(
      env.created[0].options.title === 'DSH aguardando sua aprovação',
      `título por tipo: "${env.created[0].options.title}"`,
    );
    assert(
      env.created[0].options.message === 'Ferramenta pwsh quer rodar: npm test',
      'texto do painel vai como mensagem',
    );
    assert(
      env.created[0].options.contextMessage === 'Clique para abrir a conversa',
      'rodapé de pedido único',
    );
  }

  scenario('badge acompanha os pedidos pendentes');
  {
    const env = createChrome();
    await env.send(pendingMessage('a1', 'Pedido'));
    assert(env.badges.at(-1) === '1', `badge com 1: "${env.badges.at(-1)}"`);
    await env.send({ type: 'interaction-resolved', kind: 'approval', key: 'a1' });
    assert(env.badges.at(-1) === '', 'badge limpo ao responder');
  }

  scenario('mesma chave não duplica');
  {
    const env = createChrome();
    await env.send(pendingMessage('a1', 'Pedido'));
    await env.send(pendingMessage('a1', 'Pedido'));
    assert(env.created.length === 1, 'apenas uma notificação para a mesma chave');
  }

  scenario('vários pedidos informam a quantidade');
  {
    const env = createChrome();
    await env.send(pendingMessage('a1', 'Primeiro'));
    await env.send(pendingMessage('b2', 'Segundo', 'question'));
    assert(env.created.length === 2, 'duas notificações');
    assert(
      env.created[1].options.contextMessage === '2 pedidos pendentes — clique para abrir',
      `rodapé agregado: "${env.created[1].options.contextMessage}"`,
    );
  }

  scenario('lembrete reexibe o pedido pendente');
  {
    const env = createChrome();
    await env.send(pendingMessage('a1', 'Ferramenta pwsh quer rodar'));
    assert(env.alarms.size === 1, 'alarme de lembrete agendado');

    const [alarmName] = [...env.alarms.keys()];
    env.fireAlarm(alarmName);
    await flush();

    assert(env.created.length === 2, 'notificação reexibida');
    assert(env.cleared.includes(env.created[0].id), 'a anterior foi limpa antes de reexibir');
    assert(env.created[1].id.endsWith(':r1'), `id do lembrete: ${env.created[1].id}`);
    assert(
      env.created[1].options.message === env.created[0].options.message,
      'texto preservado entre lembretes',
    );
  }

  scenario('lembretes param depois do limite');
  {
    const env = createChrome();
    await env.send(pendingMessage('a1', 'Pedido'));

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const names = [...env.alarms.keys()];
      if (names.length === 0) break;
      env.fireAlarm(names[names.length - 1]);
      await flush();
    }

    // 1 notificação original + no máximo 3 lembretes.
    assert(env.created.length === 4, `total de exibições: ${env.created.length} (esperado 4)`);
  }

  scenario('responder encerra a notificação e os lembretes');
  {
    const env = createChrome();
    await env.send(pendingMessage('a1', 'Pedido'));
    await env.send({ type: 'interaction-resolved', kind: 'approval', key: 'a1' });

    assert(env.cleared.includes(env.created[0].id), 'notificação limpa ao responder');
    assert(env.alarms.size === 0, 'nenhum lembrete pendente');
  }

  scenario('fechar o toast cancela os lembretes');
  {
    const env = createChrome();
    await env.send(pendingMessage('a1', 'Pedido'));
    env.close(env.created[0].id);
    await flush();

    assert(env.alarms.size === 0, 'alarme cancelado ao fechar');

    const before = env.created.length;
    env.fireAlarm('dsh-remind:approval:a1:1');
    await flush();
    assert(env.created.length === before, 'alarme órfão não reexibe o toast');
  }

  scenario('horário de silêncio segura pergunta, mas não aprovação');
  {
    const settings = {
      quietEnabled: true,
      quietStart: '00:00',
      quietEnd: '23:59',
      quietBypassApproval: true,
    };

    const quietEnv = createChrome({ settings });
    await quietEnv.send(pendingMessage('q1', 'Qual formato de saída?', 'question'));
    assert(quietEnv.created.length === 0, 'pergunta não vira toast durante o silêncio');
    assert(
      [...quietEnv.alarms.keys()].some((name) => name.startsWith('dsh-hold:')),
      'entrega agendada para o fim da janela',
    );
    const state = await quietEnv.send({ type: 'get-state' });
    assert(state.pending === 1 && state.held === 1, 'pedido registrado como em espera');
    assert(quietEnv.badges.at(-1) === '1', 'badge mostra o pedido em espera');

    const bypassEnv = createChrome({ settings });
    await bypassEnv.send(pendingMessage('a1', 'Comando com acesso total', 'approval'));
    assert(bypassEnv.created.length === 1, 'aprovação fura o silêncio');
  }

  scenario('pedido em espera é descartado se respondido');
  {
    const settings = {
      quietEnabled: true,
      quietStart: '00:00',
      quietEnd: '23:59',
      quietBypassApproval: false,
    };
    const env = createChrome({ settings });
    await env.send(pendingMessage('q1', 'Pergunta', 'question'));
    const holdAlarm = [...env.alarms.keys()].find((name) => name.startsWith('dsh-hold:'));

    await env.send({ type: 'interaction-resolved', kind: 'question', key: 'q1' });
    env.fireAlarm(holdAlarm);
    await flush();

    assert(env.created.length === 0, 'nada é entregue depois de respondido');
    assert(env.alarms.size === 0, 'o alarme de espera foi cancelado');
  }

  scenario('entrega retida chega quando a janela termina');
  {
    const settings = {
      quietEnabled: true,
      quietStart: '00:00',
      quietEnd: '23:59',
      quietBypassApproval: false,
    };
    const env = createChrome({ settings });
    await env.send(pendingMessage('q1', 'Pergunta', 'question'));
    const holdAlarm = [...env.alarms.keys()].find((name) => name.startsWith('dsh-hold:'));

    env.fireAlarm(holdAlarm);
    await flush();

    assert(env.created.length === 1, 'toast entregue ao fim da janela');
    assert(
      env.created[0].options.message === 'Pergunta',
      'texto original preservado na entrega retida',
    );
  }

  scenario('diagnóstico do popup');
  {
    const env = createChrome();
    await env.send(pendingMessage('a1', 'Pedido'));
    const state = await env.send({ type: 'get-state' });
    assert(state.ok === true && state.pending === 1, 'estado reporta 1 pedido pendente');
    assert(state.held === 0, 'nada em espera fora do silêncio');
    assert(typeof state.lastNotificationAt === 'number', 'instante do último aviso registrado');
    assert(state.lastError === null, 'sem erro registrado');
  }

  const failed = results.filter((result) => !result.ok).length;
  console.log(`\n${results.length - failed}/${results.length} verificações passaram.`);
}

await main();
