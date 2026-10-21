# Plugin nativo do DSH — Aviso de aprovação

A mesma ideia da extensão do Chrome, mas como **plugin de cliente do DeepSeek
Harness**. Em vez de observar o DOM, assina o snapshot de status das sessões que
o próprio app publica.

## Por que existe

| | Extensão do Chrome | Plugin nativo |
|---|---|---|
| Detecção | Observa atributos `data-*-key` no DOM | Assina `ctx.uiSession.sessionStatus` |
| Depende da porta 3080 | Sim | Não |
| Instalação | "Carregar sem compactação" + F5 | `dsh plugin add` |
| Atualização | Manual (recarregar extensão) | Pelo profile |
| Funciona no Desktop (Electron) | Não | Sim |

Se você usa o DSH no navegador e quer independência do app, use a extensão.
Se quer instalação de um comando e integração nativa, use o plugin.

## Estrutura

```
plugin/
├── package.json          # bundle: declara dsh.bundle.patch
├── cordis.patch.yml      # insere a linha de cliente no profile
├── lib/index.js          # main vazio (o bundle não roda no Host)
├── client/
│   ├── package.json      # dsh.client: inject uiSession, platform web
│   └── lib/client.js     # o plugin: assina sessionStatus e notifica
└── test/client.test.mjs  # 42 verificações, sem navegador
```

Dois pacotes seguem a convenção do ecossistema: o **bundle** é a camada de
patch que o `dsh plugin add` instala; o **client** é a linha de UI que ele
insere no profile.

## Como funciona

1. `apply(ctx, config)` assina `ctx.uiSession.sessionStatus` — um snapshot
   `Map<sessionId, { pendingInteraction, running }>`.
2. Cada pedido com `pendingInteraction` é anunciado uma vez, pela chave da
   interação; o conjunto de chaves já anunciadas evita repetir.
3. Quando não sobra nada pendente, o aviso fecha.
4. Sem permissão de notificação, o plugin ainda marca o título da aba com
   `⚠`, então nunca fica totalmente silencioso.
5. **Lembrete**: o pedido sem resposta é reexibido a cada 90s, no máximo três
   vezes.
6. **Agregação**: com mais de um pedido pendente, o corpo informa o total.
7. **Horário de silêncio**: fora da janela o aviso é segurado e entregue no fim
   dela — ou descartado, se você responder antes. Aprovação que trava o agente
   pode furar a janela.

### Configuração

```yaml
- id: approval-notifier
  name: 'dsh-plugin-approval-notifier-client'
  config:
    onlyWhenUnfocused: true    # padrão: false
    quietEnabled: false        # padrão: false
    quietStart: '22:00'
    quietEnd: '08:00'
    quietBypassApproval: true  # aprovação fura o silêncio
    debug: false               # padrão: false (liga logs no console)
```

Com `debug: true`, o plugin registra no console do cliente o que ele vê a cada
mudança de estado. Sem o flag, o único ponto de inspeção é
`window.__dshApprovalNotifier` no DevTools, que existe sempre e não polui o log.

### Se não funcionar

O modo de falha é **silencioso**: sem o mapa `exports` com `"./client"` no
`package.json`, o carregador do DSH não acha `lib/client.js` e não avisa. O
validador `plugin/tools/check-package.mjs` cobre isso — se ele passar, o
caminho de carregamento está correto.

Para confirmar no app: abra o DevTools (`Ctrl+Shift+I`) e digite
`window.__dshApprovalNotifier`. `undefined` significa que o plugin não carregou.

## Testes

```powershell
node plugin/test/client.test.mjs
```

O teste carrega `client/lib/client.js` num `node:vm` com
`window.__ModuleLoader__`, um contexto Cordis falso e uma `Notification`
simulada — ou seja, exercita o arquivo que o navegador realmente carrega.

Cobre: ausência de pendência, os três tipos de título, deduplicação por chave,
troca de pedido, fechamento ao resolver, modo "só fora de foco" (inclusive o
aviso ao perder o foco), permissão negada e snapshot com várias sessões.

## Publicação no npm

São dois pacotes, e a ordem importa — o bundle depende do cliente, então o
cliente precisa existir primeiro no registro.

```powershell
npm login                      # uma vez, no seu terminal

cd plugin/client
npm publish --access public    # dsh-plugin-approval-notifier-client@0.1.0

cd ..
npm publish --access public    # dsh-plugin-approval-notifier@0.1.0
```

Antes de publicar, confira o que entraria no pacote:

```powershell
npm pack --dry-run --json
```

Depois de publicado, o usuário instala com:

```powershell
dsh plugin add dsh-plugin-approval-notifier@0.1.0
```

## Estado

Código, metadados, licença e testes estão prontos, e o conteúdo dos dois
pacotes foi conferido com `npm pack --dry-run`: bundle com `cordis.patch.yml`,
`lib/index.js`, README e LICENSE; cliente com `lib/client.js`, `lib/index.js`,
README e LICENSE.

Falta apenas o `npm publish`, que exige a sua conta — o registro exige
autenticação e eu não tenho (nem devo ter) a sua credencial.
