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
└── test/client.test.mjs  # 21 verificações, sem navegador
```

Dois pacotes seguem a convenção do ecossistema: o **bundle** é a camada de
patch que o `dsh plugin add` instala; o **client** é a linha de UI que ele
insere no profile.

## Como funciona

1. `apply(ctx, config)` assina `ctx.uiSession.sessionStatus` — um snapshot
   `Map<sessionId, { pendingInteraction, running }>`.
2. A primeira sessão com `pendingInteraction` vira um aviso.
3. A chave do pedido evita duplicar; quando ela muda ou some, a notificação
   anterior fecha.
4. Sem permissão de notificação, a extensão ainda marca o título da aba com
   `⚠`, então nunca fica totalmente silenciosa.

### Configuração

```yaml
- id: approval-notifier
  name: 'dsh-plugin-approval-notifier-client'
  config:
    onlyWhenUnfocused: true   # padrão: false
```

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

## Estado

O plugin ainda **não está publicado no npm**. Para instalar hoje seria preciso
apontar para o repositório e ter os dois pacotes resolvidos no profile. A
publicação (`npm publish` nos dois pacotes) é o próximo passo antes de submeter
aos catálogos da comunidade.
