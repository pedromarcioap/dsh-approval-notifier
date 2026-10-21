# DSH — Aviso de aprovação

Extensão do Chrome (Manifest V3) que mostra uma **notificação nativa** — no
Windows, um toast do sistema — quando o DeepSeek Harness está bloqueado
esperando uma decisão sua na conversa.

## Quando ela dispara

A extensão observa os painéis que assumem o compositor do chat. Cada um publica
um atributo estável, então nada depende de classes CSS geradas:

| Painel | Marcador observado | Notificação |
|---|---|---|
| Aprovação de ferramenta / escalação de sandbox | `[data-approval-key]` | “DSH aguardando sua aprovação” |
| Pergunta do `ask_user_question` | `[data-question-key]` | “DSH aguardando sua resposta” |
| Revisão de plano (plan mode) | `[data-plan-review-key]` | “DSH aguardando revisão do plano” |

Comportamento:

- **Uma notificação por pedido.** Mutações repetidas do DOM não duplicam o aviso.
- **Fecha sozinha** quando você responde, ou quando o painel sai da tela.
- **Bipe curto** junto com o toast (sujeito à política de autoplay do Chrome).
- **Título da aba** ganha um `⚠ ` enquanto houver algo pendente.
- Clicar na notificação **foca a aba** do DSH.

## Instalação

1. Abra `chrome://extensions` no Chrome.
2. Ative o **Modo do desenvolvedor** (canto superior direito).
3. Clique em **Carregar sem compactação** e selecione esta pasta
   (`dsh-approval-notifier`).
4. **Recarregue a aba do DSH** (`F5`) — o content script só entra em páginas
   carregadas depois da instalação.
5. Clique no ícone da extensão e use **Enviar notificação de teste** para
   confirmar que o Chrome e o Windows estão deixando o aviso passar.

> A extensão fica instalada enquanto esta pasta existir. Se mover ou apagar a
> pasta, remova e carregue de novo.

## Configurações (popup)

- **Ativar avisos** — liga/desliga sem remover a extensão.
- **Só quando a janela não estiver em foco** — evita o aviso redundante quando
  você já está olhando o chat. Se um pedido chegar com a janela em foco, ele
  ainda avisa no momento em que você troca de janela.

## Se a notificação não aparecer

1. `chrome://settings/content/notifications` → o site `127.0.0.1:3080` (ou o
   Chrome inteiro) precisa estar liberado.
2. Windows → Configurações → Sistema → Notificações: permita o Chrome e
   desative o **Assistente de Foco** durante o horário de trabalho.
3. Confirme que a porta no `manifest.json` bate com a do harness (hoje
   `3080`). Se o DSH subir em outra porta, ajuste `matches` e recarregue a
   extensão.

## Limitações conhecidas

- **Precisa da aba aberta.** A extensão observa o DOM; com o navegador fechado
  não há aviso (nesse caso o pedido também não teria onde ser respondido).
- **Só a página do DSH.** Não interfere em outras abas nem em outros sites.
- **Não é um canal de aprovação.** Ela avisa; a decisão continua sendo tomada no
  painel do chat (a aprovação é de uso único, sem “permitir sempre”).

## Estrutura

```
dsh-approval-notifier/
├── manifest.json      # MV3, permissões notifications + storage
├── background.js      # service worker: cria/limpa o toast, deduplica por pedido
├── content.js         # observa os painéis, extrai o texto, bipa, marca o título
├── popup.html/.css/.js# liga/desliga, modo “só fora de foco”, teste
├── icons/             # 16, 48, 128 px
└── test/              # teste de fumaça do content script (DOM + chrome simulados)
```

## Testes

```powershell
cd dsh-approval-notifier
node test/content.test.mjs
```

Cobre: detecção dos três tipos de painel, resolução por resposta ou remoção,
troca de pedido, não duplicação, preferência desativada e o modo “só fora de
foco” (incluindo o aviso ao perder o foco).

## Requisitos

- Google Chrome com suporte a Manifest V3 (qualquer versão atual).
- DeepSeek Harness servindo o Web GUI em `127.0.0.1:3080` — se a porta mudar,
  ajuste `matches` no `manifest.json` e recarregue a extensão.
- No Windows, notificações do Chrome liberadas (veja acima).

## Licença

MIT — veja [LICENSE](LICENSE).

