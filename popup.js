/** DSH — Aviso de aprovação (popup). */

const enabledInput = document.getElementById('enabled');
const onlyWhenUnfocusedInput = document.getElementById('onlyWhenUnfocused');
const statusElement = document.getElementById('status');
const testButton = document.getElementById('test');

function renderStatus(state) {
  if (!state) {
    statusElement.textContent = 'Não foi possível falar com a extensão. Recarregue a página do DSH.';
    return;
  }
  const pending = Number(state.pending ?? 0);
  const suffix = pending === 0 ? 'nenhum pedido pendente' : `${pending} pedido(s) pendente(s)`;
  statusElement.textContent = state.enabled
    ? `Avisos ativos · ${suffix}`
    : `Avisos desativados · ${suffix}`;
}

async function refresh() {
  const state = await chrome.runtime
    .sendMessage({ type: 'get-state' })
    .catch(() => null);
  renderStatus(state);
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
  const result = await chrome.runtime
    .sendMessage({ type: 'test-notification' })
    .catch(() => null);
  testButton.disabled = false;
  if (!result?.ok) {
    statusElement.textContent = 'O teste falhou: o Chrome não aceitou a notificação.';
  }
});

void loadSettings().then(refresh);
