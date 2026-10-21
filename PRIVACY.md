# Política de privacidade — DSH Aviso de aprovação

Última atualização: 2026-10-20

Esta extensão **não coleta, não transmite e não vende dados pessoais**. Não há
servidor, conta, análise de uso, telemetria ou rastreamento de qualquer tipo.

## O que a extensão acessa

- **A página local do DeepSeek Harness** (`http://127.0.0.1:3080` e
  `http://localhost:3080`). A extensão lê o DOM dessa página apenas para
  identificar quando um painel de aprovação, pergunta ou revisão de plano está
  pendente, e qual texto ele exibe. Nenhum outro site é acessado.
- **Preferências locais.** Duas configurações — avisos ligados/desligados e o
  modo “só quando a janela não estiver em foco” — ficam em
  `chrome.storage.local`, no seu próprio navegador.

## O que a extensão não faz

- Não envia conteúdo de conversas, comandos, caminhos de arquivo ou qualquer
  outro dado para fora do seu computador.
- Não usa serviços de análise, publicidade ou rastreamento.
- Não injeta código remoto: todo o código executado vem do pacote instalado.
- Não acessa abas, histórico, favoritos, downloads ou credenciais.

## Dados temporários em memória

Enquanto o service worker está ativo, a extensão mantém em memória o texto do
pedido pendente, a contagem de pedidos e o instante do último aviso, para evitar
notificações duplicadas e alimentar o diagnóstico do popup. Nada disso é
gravado em disco nem transmitido, e desaparece quando o navegador encerra o
service worker.

## Permissões e por que existem

| Permissão | Motivo |
|---|---|
| `notifications` | Exibir o aviso nativo quando a conversa local espera uma decisão. |
| `storage` | Guardar as duas preferências locais citadas acima. |
| Acesso a `127.0.0.1:3080` / `localhost:3080` | Observar os painéis da página local do DeepSeek Harness. |

## Alterações

Mudanças nesta política serão publicadas neste arquivo, no mesmo repositório, e
aparecerão no histórico de commits.

## Contato

Dúvidas ou problemas: abra uma issue em
<https://github.com/pedromarcioap/dsh-approval-notifier/issues>.

---

# Privacy policy — DSH Approval notifier (English)

This extension **does not collect, transmit, or sell personal data**. There is
no server, account, usage analytics, telemetry, or tracking of any kind.

- It reads the DOM of the local DeepSeek Harness page (`127.0.0.1:3080` and
  `localhost:3080`) only to detect pending approval, question, or plan-review
  panels.
- It stores two preferences (alerts on/off, "only when unfocused") in
  `chrome.storage.local` in your own browser.
- Pending-request text and the last-notification timestamp live only in the
  service worker's memory and disappear when it stops.
- No remote code, no other sites, no browser history, no credentials.

Contact: <https://github.com/pedromarcioap/dsh-approval-notifier/issues>
