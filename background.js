/**
 * DSH — Aviso de aprovação (background.js / service worker).
 *
 * O content script avisa quando uma interação do DeepSeek Harness começa
 * (`interaction-pending`) ou termina (`interaction-resolved`). Aqui mantemos
 * uma notificação do Chrome por pedido — no Windows ela vira um toast.
 *
 * Comportamentos que evitam o "aviso perdido" e o "aviso demais":
 *
 *  - chave por pedido: a mesma interação nunca duplica, e responder encerra;
 *  - agregação: com vários pendentes, o rodapé informa quantos são;
 *  - badge: o ícone mostra quantos pedidos esperam decisão;
 *  - lembrete: o pedido sem resposta é reexibido a cada 90s, no máximo três
 *    vezes (usa `chrome.alarms`, porque o service worker dorme);
 *  - horário de silêncio: fora da janela o aviso é segurado e entregue quando
 *    ela termina — ou descartado, se o pedido já foi respondido. Aprovação
 *    que trava o agente pode furar a janela (configurável).
 */

try {
  // Script clássico: publica globalThis.DshQuietHours.
  if (typeof importScripts === 'function') importScripts('quiet-hours.js');
} catch (error) {
  console.warn('[dsh-approval-notifier] horário de silêncio indisponível', error);
}

const Quiet = globalThis.DshQuietHours ?? null;

const NOTIFICATION_PREFIX = 'dsh-approval:';
const ALARM_PREFIX = 'dsh-remind:';
const HOLD_PREFIX = 'dsh-hold:';
const ICON_URL = 'icons/icon128.png';
const DEFAULT_MESSAGE = 'Uma operação está esperando sua decisão na conversa.';
const REMIND_DELAY_MINUTES = 1.5;
const MAX_REMINDERS = 3;

const TITLES = {
  approval: 'DSH aguardando sua aprovação',
  question: 'DSH aguardando sua resposta',
  plan: 'DSH aguardando revisão do plano',
};
const FALLBACK_TITLE = 'DSH aguardando você';

/** "tipo:chave" -> { notificationId, kind, key, text, tabId, reminders, held } */
const pending = new Map();
/** id da notificação -> aba de origem */
const notificationTabs = new Map();
/** abas onde o content script se apresentou -> instante do hello */
const liveTabs = new Map();
/** instante do último aviso efetivamente criado */
let lastNotificationAt = null;
/** último erro que impediu um aviso */
let lastError = null;

async function isEnabled() {
  const { enabled = true } = await chrome.storage.local.get({ enabled: true });
  return enabled === true;
}

async function readQuietSettings() {
  const defaults = Quiet?.DEFAULTS ?? {
    quietEnabled: false,
    quietStart: '22:00',
    quietEnd: '08:00',
    quietBypassApproval: true,
  };
  return chrome.storage.local.get(defaults);
}

function sanitizeId(value) {
  return String(value ?? '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 100);
}

function truncate(text, max = 220) {
  const clean = String(text ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  if (clean.length === 0) return '';
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

function mapKey(kind, key) {
  return `${sanitizeId(kind)}:${sanitizeId(key)}`;
}

function titleFor(kind) {
  return TITLES[kind] ?? FALLBACK_TITLE;
}

function contextFor(count) {
  if (count > 1) return `${count} pedidos pendentes — clique para abrir`;
  return 'Clique para abrir a conversa';
}

async function createNotification(notificationId, title, message, count) {
  await chrome.notifications.create(notificationId, {
    type: 'basic',
    iconUrl: ICON_URL,
    title,
    message,
    contextMessage: contextFor(count),
    requireInteraction: true,
    priority: 2,
    silent: false,
  });
}

/** Espelha os pedidos pendentes no ícone: o "badge do Dock" deste ecossistema. */
function updateBadge() {
  const size = pending.size;
  try {
    chrome.action?.setBadgeText({ text: size > 0 ? String(size) : '' });
    if (size > 0) {
      chrome.action?.setBadgeBackgroundColor?.({ color: '#E6A447' });
      chrome.action?.setTitle?.({ title: `DSH — ${size} pedido(s) esperando decisão` });
    } else {
      chrome.action?.setTitle?.({ title: 'DSH — Aviso de aprovação' });
    }
  } catch {
    /* sem action (teste, contexto antigo): o badge é acessório */
  }
}

function pruneLiveTabs() {
  // Abas fechadas não avisam: descartamos quem sumiu da lista do Chrome.
  chrome.tabs
    .query({})
    .then((tabs) => {
      const open = new Set(tabs.map((tab) => tab.id));
      for (const id of liveTabs.keys()) {
        if (!open.has(id)) liveTabs.delete(id);
      }
    })
    .catch(() => {});
}

function alarmName(mapId, attempt) {
  return `${ALARM_PREFIX}${mapId}:${attempt}`;
}

async function scheduleReminder(mapId, attempt) {
  try {
    await chrome.alarms.create(alarmName(mapId, attempt), {
      delayInMinutes: REMIND_DELAY_MINUTES * attempt,
    });
  } catch (error) {
    // Sem alarmes o toast principal continua valendo; só perdemos o lembrete.
    console.warn('[dsh-approval-notifier] não foi possível agendar lembrete', error);
  }
}

async function clearReminders(mapId, attempts) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await chrome.alarms.clear(alarmName(mapId, attempt));
    } catch {
      /* alarme já disparado */
    }
  }
}

/**
 * Fora da janela de silêncio: guarda o pedido e agenda a entrega para o fim
 * da janela. Se ele for respondido antes, nada é entregue.
 */
async function holdForQuietHours(mapId, minutes) {
  const record = pending.get(mapId);
  if (record === undefined) return;
  record.held = true;
  try {
    await chrome.alarms.create(`${HOLD_PREFIX}${mapId}`, {
      delayInMinutes: Math.max(minutes, 0.5),
    });
  } catch (error) {
    // Sem alarme, ainda entregamos no próximo ciclo de foco do service worker.
    console.warn('[dsh-approval-notifier] não foi possível agendar a entrega', error);
    record.held = false;
  }
}

async function deliverHeld(mapId) {
  const record = pending.get(mapId);
  if (record === undefined || record.held !== true) return;

  record.held = false;
  try {
    await chrome.alarms.clear(`${HOLD_PREFIX}${mapId}`);
  } catch {
    /* já disparado */
  }

  const notificationId = NOTIFICATION_PREFIX + mapId;
  try {
    await createNotification(notificationId, titleFor(record.kind), record.text, pending.size);
    record.notificationId = notificationId;
    lastNotificationAt = Date.now();
    lastError = null;
    if (typeof record.tabId === 'number') notificationTabs.set(notificationId, record.tabId);
    await scheduleReminder(mapId, 1);
  } catch (error) {
    lastError = String(error);
    console.warn('[dsh-approval-notifier] entrega retida falhou', error);
  }
}

async function showPending({ kind, key, text, tabId }) {
  if (!(await isEnabled())) return false;

  const mapId = mapKey(kind, key);
  if (sanitizeId(key) === '') return false;
  if (pending.has(mapId)) return false;

  const notificationId = NOTIFICATION_PREFIX + mapId;
  const message = truncate(text) || DEFAULT_MESSAGE;
  const count = pending.size + 1;

  // Silêncio: decidido no envio, com o pedido já registrado para poder ser
  // respondido (e descartado) enquanto espera.
  const quiet = Quiet === null ? null : await readQuietSettings();
  const sleeping =
    quiet !== null &&
    quiet.quietEnabled === true &&
    Quiet.inQuietHours(new Date(), quiet.quietStart, quiet.quietEnd) &&
    !Quiet.bypasses(kind, quiet);

  if (sleeping) {
    pending.set(mapId, {
      notificationId: null,
      kind,
      key,
      text: message,
      tabId: typeof tabId === 'number' && tabId >= 0 ? tabId : null,
      reminders: 0,
      held: true,
    });
    updateBadge();
    const minutes = Quiet.minutesUntilEnd(new Date(), quiet.quietStart, quiet.quietEnd);
    await holdForQuietHours(mapId, minutes);
    return true;
  }

  try {
    await createNotification(notificationId, titleFor(kind), message, count);
    pending.set(mapId, {
      notificationId,
      kind,
      key,
      text: message,
      tabId: typeof tabId === 'number' && tabId >= 0 ? tabId : null,
      reminders: 0,
      held: false,
    });
    lastNotificationAt = Date.now();
    lastError = null;
    if (typeof tabId === 'number' && tabId >= 0) {
      notificationTabs.set(notificationId, tabId);
    }
    updateBadge();
    await scheduleReminder(mapId, 1);
    return true;
  } catch (error) {
    lastError = String(error);
    console.error('[dsh-approval-notifier] falha ao criar notificação', error);
    return false;
  }
}

async function forgetPending({ kind, key }, { clearNotification = true } = {}) {
  const mapId = mapKey(kind, key);
  const record = pending.get(mapId);
  if (record === undefined) return false;

  pending.delete(mapId);
  if (record.notificationId !== null) notificationTabs.delete(record.notificationId);
  await clearReminders(mapId, MAX_REMINDERS);
  try {
    await chrome.alarms.clear(`${HOLD_PREFIX}${mapId}`);
  } catch {
    /* sem alarme de espera */
  }

  if (clearNotification && record.notificationId !== null) {
    try {
      await chrome.notifications.clear(record.notificationId);
    } catch (error) {
      console.warn('[dsh-approval-notifier] falha ao limpar notificação', error);
    }
  }

  updateBadge();
  return true;
}

async function focusTabByNotification(notificationId) {
  const tabId = notificationTabs.get(notificationId);
  if (typeof tabId !== 'number') return;
  try {
    const tab = await chrome.tabs.update(tabId, { active: true });
    if (tab && typeof tab.windowId === 'number') {
      await chrome.windows.update(tab.windowId, { focused: true });
    }
  } catch (error) {
    console.warn('[dsh-approval-notifier] não foi possível focar a aba', error);
  }
}

function findMapIdByNotification(notificationId) {
  for (const [mapId, record] of pending) {
    if (record.notificationId === notificationId) return mapId;
  }
  return null;
}

/**
 * Reexibe o pedido ainda pendente. Recriar com outro id é o que faz o Windows
 * voltar a exibir o toast — atualizar a mesma notificação não chama atenção.
 */
async function remind(mapId) {
  const record = pending.get(mapId);
  if (record === undefined || record.held === true) return;

  const previousId = record.notificationId;
  const attempt = record.reminders + 1;
  if (attempt > MAX_REMINDERS) return;

  const notificationId = `${NOTIFICATION_PREFIX}${mapId}:r${attempt}`;
  try {
    if (previousId !== null) await chrome.notifications.clear(previousId);
    await createNotification(notificationId, titleFor(record.kind), record.text, pending.size);
    record.reminders = attempt;
    record.notificationId = notificationId;
    if (typeof record.tabId === 'number') {
      if (previousId !== null) notificationTabs.delete(previousId);
      notificationTabs.set(notificationId, record.tabId);
    }
    if (attempt < MAX_REMINDERS) await scheduleReminder(mapId, attempt + 1);
  } catch (error) {
    lastError = String(error);
    console.warn('[dsh-approval-notifier] lembrete falhou', error);
  }
}

chrome.notifications.onClicked.addListener((notificationId) => {
  void (async () => {
    await focusTabByNotification(notificationId);
    const mapId = findMapIdByNotification(notificationId);
    if (mapId !== null) {
      const record = pending.get(mapId);
      await forgetPending({ kind: record.kind, key: record.key });
    } else {
      notificationTabs.delete(notificationId);
    }
  })();
});

chrome.notifications.onClosed.addListener((notificationId) => {
  // Fechar o toast não responde o pedido: mantemos a chave para não
  // re-notificar a cada mutação do DOM, mas paramos os lembretes e
  // esquecemos a aba — fechar é um "já vi".
  notificationTabs.delete(notificationId);
  const mapId = findMapIdByNotification(notificationId);
  if (mapId !== null) {
    const record = pending.get(mapId);
    record.reminders = MAX_REMINDERS;
    void clearReminders(mapId, MAX_REMINDERS);
  }
});

chrome.alarms?.onAlarm.addListener((alarm) => {
  if (alarm.name.startsWith(HOLD_PREFIX)) {
    void deliverHeld(alarm.name.slice(HOLD_PREFIX.length));
    return;
  }
  if (!alarm.name.startsWith(ALARM_PREFIX)) return;
  const rest = alarm.name.slice(ALARM_PREFIX.length);
  const mapId = rest.slice(0, rest.lastIndexOf(':'));
  void remind(mapId);
});

async function handleMessage(message, sender) {
  if (!message || typeof message !== 'object') return { ok: false };

  switch (message.type) {
    case 'hello': {
      const tabId = sender?.tab?.id;
      if (typeof tabId === 'number') {
        liveTabs.set(tabId, Date.now());
        pruneLiveTabs();
      }
      return { ok: true };
    }
    case 'interaction-pending':
      return {
        ok: await showPending({
          kind: message.kind,
          key: message.key,
          text: message.text,
          tabId: sender?.tab?.id,
        }),
      };
    case 'interaction-resolved':
      return { ok: await forgetPending({ kind: message.kind, key: message.key }) };
    case 'test-notification': {
      const notificationId = `${NOTIFICATION_PREFIX}test`;
      try {
        await createNotification(
          notificationId,
          'Aviso de teste',
          'Se você está vendo isto, os avisos estão funcionando.',
          1,
        );
        lastNotificationAt = Date.now();
        lastError = null;
        setTimeout(() => {
          chrome.notifications.clear(notificationId).catch(() => {});
        }, 8000);
        return { ok: true };
      } catch (error) {
        lastError = String(error);
        console.error('[dsh-approval-notifier] teste falhou', error);
        return { ok: false, error: String(error) };
      }
    }
    case 'get-state':
      return {
        ok: true,
        enabled: await isEnabled(),
        pending: pending.size,
        held: [...pending.values()].filter((record) => record.held === true).length,
        tabs: liveTabs.size,
        lastNotificationAt,
        lastError,
      };
    default:
      return { ok: false, error: 'unknown-message' };
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender)
    .then(sendResponse)
    .catch((error) => {
      lastError = String(error);
      console.error('[dsh-approval-notifier] mensagem falhou', error);
      sendResponse({ ok: false, error: String(error) });
    });
  return true;
});
