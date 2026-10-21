/** DSH — Aviso de aprovação (popup). */

const enabledInput = document.getElementById('enabled');
const onlyWhenUnfocusedInput = document.getElementById('onlyWhenUnfocused');
const statusElement = document.getElementById('status');
const testButton = document.getElementById('test');
const diagTabs = document.getElementById('diag-tabs');
const diagPending = document.getElementById('diag-pending');
const diagLast = document.getElementById('diag-last');
const diagHint = document.getElementById('diag-hint');

function relativeTime(timestamp) {
  if (typeof timestamp !== 'number' || timestamp <= 0) return 'nunca';
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (seconds < 60) return `há ${seconds}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `há ${minutes} min`;
  return `há ${Math.round(minutes / 60)} h`;
}

function renderState(state) {
  if (!state) {
    statusElement.textContent = 'Não foi possível falar com a extensão. Recarregue a página do DSH.';
    diagTabs.textContent = '—';
    diagPending.textContent = '—';
    diagLast.textContent = '—';
    diagHint.textContent = '';
    return;
  }

  const tabs = Number(state.tabs ?? 0);
  const pending = Number(state.pending ?? 0);

  diagTabs.textContent = tabs === 0 ? 'nenhuma aba' : `${tabs} aba(s)`;
  diagPending.textContent = String(pending);
  diagLast.textContent = relativeTime(state.lastNotificationAt);

  if (state.lastError) {
    diagHint.textContent = `Última falha: ${state.lastError}`;
  } else if (tabs === 0) {
    diagHint.textContent =
      'Nenhuma aba do DSH conversando com a extensão: recarregue a página (F5) para ativar o aviso.';
  } else {
    diagHint.textContent =
      'Se o teste abaixo também não aparecer, o bloqueio é do Chrome/Windows, não da extensão.';
  }

  statusElement.textContent = state.enabled
    ? `Avisos ativos · ${pending === 0 ? 'nenhum pedido pendente' : `${pending} pendente(s)`}`
    : `Avisos desativados · ${pending} pendente(s)`;
}

async function refresh() {
  const state = await chrome.runtime.sendMessage({ type: 'get-state' }).catch(() => null);
  renderState(state);
}

async function loadSettings() {
  const { enabled = true, onlyWhenUnfocused = false } = await chrome.storage.local.get({
    enabled: true,
    onlyWhenUnfocused: false,
  });
  enabledInput.checked = enabled !== false;
  onlyWhenUnfocusedInput.checked = onlyWhenUnfocused === true;
}

enabledInput.addEventListener('change', async () => {
  await chrome.storage.local.set({ enabled: enabledInput.checked });
  await refresh();
});

onlyWhenUnfocusedInput.addEventListener('change', async () => {
  await chrome.storage.local.set({ onlyWhenUnfocused: onlyWhenUnfocusedInput.checked });
});

testButton.addEventListener('click', async () => {
  testButton.disabled = true;
  const result = await chrome.runtime.sendMessage({ type: 'test-notification' }).catch(() => null);
  testButton.disabled = false;
  if (!result?.ok) {
    statusElement.textContent = 'O teste falhou: o Chrome não aceitou a notificação.';
  }
  await refresh();
});

void loadSettings().then(refresh);
