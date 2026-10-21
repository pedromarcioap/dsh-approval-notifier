/**
 * DSH — Aviso de aprovação (background.js / service worker).
 *
 * O content script avisa quando uma interação do DeepSeek Harness começa
 * (`interaction-pending`) ou termina (`interaction-resolved`). Aqui mantemos
 * uma única notificação do Chrome por pedido — no Windows ela vira um toast.
 *
 * Também guardamos um diagnóstico mínimo (abas com o script ativo e o instante
 * do último aviso) que o popup mostra, para separar "não avisou" de
 * "avisou mas o Windows não exibiu".
 */

const NOTIFICATION_PREFIX = 'dsh-approval:';
const ICON_URL = 'icons/icon128.png';
const DEFAULT_MESSAGE = 'Uma operação está esperando sua decisão na conversa.';

const TITLES = {
  approval: 'DSH aguardando sua aprovação',
  question: 'DSH aguardando sua resposta',
  plan: 'DSH aguardando revisão do plano',
};
const FALLBACK_TITLE = 'DSH aguardando você';

/** "tipo:chave" -> id da notificação criada */
const pendingInteractions = new Map();
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

async function createNotification(notificationId, title, message) {
  await chrome.notifications.create(notificationId, {
    type: 'basic',
    iconUrl: ICON_URL,
    title,
    message,
    contextMessage: 'Clique para abrir a conversa',
    requireInteraction: true,
    priority: 2,
    silent: false,
  });
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

async function showPending({ kind, key, text, tabId }) {
  if (!(await isEnabled())) return false;

  const mapId = mapKey(kind, key);
  if (sanitizeId(key) === '') return false;
  if (pendingInteractions.has(mapId)) return false;

  const notificationId = NOTIFICATION_PREFIX + mapId;
  const message = truncate(text) || DEFAULT_MESSAGE;

  try {
    await createNotification(notificationId, titleFor(kind), message);
    pendingInteractions.set(mapId, notificationId);
    lastNotificationAt = Date.now();
    lastError = null;
    if (typeof tabId === 'number' && tabId >= 0) {
      notificationTabs.set(notificationId, tabId);
    }
    return true;
  } catch (error) {
    lastError = String(error);
    console.error('[dsh-approval-notifier] falha ao criar notificação', error);
    return false;
  }
}

async function forgetPending({ kind, key }) {
  const mapId = mapKey(kind, key);
  const notificationId = pendingInteractions.get(mapId);
  if (notificationId === undefined) return false;

  pendingInteractions.delete(mapId);
  notificationTabs.delete(notificationId);
  try {
    await chrome.notifications.clear(notificationId);
  } catch (error) {
    console.warn('[dsh-approval-notifier] falha ao limpar notificação', error);
  }
  return true;
}

async function focusTab(notificationId) {
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

chrome.notifications.onClicked.addListener((notificationId) => {
  void (async () => {
    await focusTab(notificationId);
    for (const [mapId, id] of pendingInteractions) {
      if (id === notificationId) {
        pendingInteractions.delete(mapId);
        break;
      }
    }
    notificationTabs.delete(notificationId);
    try {
      await chrome.notifications.clear(notificationId);
    } catch {
      /* a notificação já pode ter sido fechada pelo usuário */
    }
  })();
});

chrome.notifications.onClosed.addListener((notificationId) => {
  // Mantemos a chave em pendingInteractions: o pedido continua pendente no
  // Host, então não re-notificamos a cada mutação do DOM. Só esquecemos a aba.
  notificationTabs.delete(notificationId);
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
        pending: pendingInteractions.size,
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
