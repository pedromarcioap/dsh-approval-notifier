# dsh-plugin-approval-notifier-client

Metade **browser** do [Aviso de aprovação do DSH](https://github.com/pedromarcioap/dsh-approval-notifier#readme).

Não instale este pacote sozinho: ele é carregado pela linha de cliente que o
bundle `dsh-plugin-approval-notifier` insere no profile. O comando é:

```
dsh plugin add dsh-plugin-approval-notifier
```

## O que ele faz

Assina `ctx.uiSession.sessionStatus` — o snapshot que o próprio DSH publica com
o estado de cada sessão — e dispara uma `Notification` quando existe uma
interação pendente (aprovação de ferramenta, pergunta ou revisão de plano).

Sem observação de DOM, sem depender de porta, sem alterar o Host.

- Uma notificação por pedido, identificada pela chave da interação.
- Fecha quando o pedido é resolvido.
- Marca o título da aba com `⚠` quando a permissão de notificação é negada,
  para nunca ficar em silêncio absoluto.
- `onlyWhenUnfocused: true` silencia com a janela em foco e avisa quando ela
  perde o foco.

MIT.
