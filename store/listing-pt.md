# Listagem na Chrome Web Store — Português (pt-BR)

Campos prontos para colar no formulário do Developer Dashboard.

## Nome (até 45 caracteres)

```
DSH — Aviso de aprovação
```

## Descrição curta (até 132 caracteres)

```
Notificação nativa do Chrome/Windows quando o DeepSeek Harness espera sua aprovação, resposta ou revisão de plano.
```

## Categoria

`Productivity` (Produtividade). Alternativa aceitável: `Developer Tools`.

## Idioma

Português (Brasil), com listagem secundária em inglês.

## Descrição detalhada

```
O DeepSeek Harness bloqueia o turno quando precisa de uma decisão sua: aprovar uma ferramenta, responder a uma pergunta ou revisar um plano. Se você estiver em outra janela, o agente simplesmente fica parado — e nada avisa.

Esta extensão transforma esse bloqueio em uma notificação nativa do Chrome, que no Windows aparece como um toast do sistema.

O QUE ELA FAZ
• Avisa quando um painel de aprovação, pergunta ou revisão de plano assume o compositor do chat.
• Mostra uma única notificação por pedido — atualizações da tela não duplicam o aviso.
• Fecha o aviso sozinha quando você responde ou quando o painel desaparece.
• Toca um bipe curto, liberado apenas depois de você interagir com a página.
• Marca o título da aba com ⚠ enquanto há algo pendente.
• Ao clicar na notificação, foca a aba do DSH.

CONTROLE
• Liga e desliga os avisos sem remover a extensão.
• Modo "só quando a janela não estiver em foco": fica quieta se você já está olhando o chat, e avisa no instante em que você troca de janela.
• Diagnóstico no popup: em quantas abas o script está ativo, quantos pedidos estão pendentes e há quanto tempo foi o último aviso.
• Botão de notificação de teste, para separar falha da extensão de bloqueio do sistema.

PRIVACIDADE
A extensão não envia nada para nenhum servidor. Não há análise, telemetria, conta ou rastreamento. Ela só lê os painéis da página local do DeepSeek Harness e guarda duas preferências no seu próprio navegador.

REQUISITOS
• DeepSeek Harness rodando localmente em http://127.0.0.1 ou http://localhost (qualquer porta — inclusive o DSH Desktop, que escolhe uma porta livre).
• Chrome com suporte a Manifest V3.
• No Windows, notificações do Chrome liberadas e o Assistente de Foco desativado durante o uso.

CÓDIGO ABERTO
Código-fonte, testes e releases: https://github.com/pedromarcioap/dsh-approval-notifier
Licença MIT.
```

## Finalidade única (single purpose) — resposta obrigatória

```
A extensão tem uma única finalidade: avisar o usuário, por meio de uma notificação nativa do navegador, quando o DeepSeek Harness local está bloqueado esperando uma decisão dele (aprovação de ferramenta, pergunta ou revisão de plano).
```

## Justificativa de permissões

**`notifications`**

```
É o propósito central da extensão: exibir o aviso nativo quando a conversa local do DeepSeek Harness espera uma decisão do usuário. Sem esta permissão não há como alertar quem está em outra janela.
```

**`storage`**

```
Guarda duas preferências locais (avisos ligados/desligados e o modo "só fora de foco") com chrome.storage.local. Nada é sincronizado nem enviado a servidores.
```

**`alarms`**

```
Reexibe um pedido que continua sem resposta, no máximo três vezes, para que um toast perdido não fique perdido. Nenhum dado sai do navegador.
```

**Acesso ao site `127.0.0.1` / `localhost` (content script)**

```
A extensão precisa observar o DOM da página local do DeepSeek Harness para detectar quando um painel de aprovação, pergunta ou revisão de plano está pendente. O acesso é restrito a esses dois endereços locais, em qualquer porta; nenhum outro site é lido ou modificado.
```

## Declaração de uso de dados

- Coleta dados do usuário? **Não.**
- Vende dados a terceiros? **Não.**
- Usa dados para fins não relacionados à finalidade única? **Não.**
- Usa ou transfere dados para determinar credibilidade? **Não.**
- Código remoto: **Não** (todo o código vai no pacote).
- Política de privacidade: `https://github.com/pedromarcioap/dsh-approval-notifier/blob/main/PRIVACY.md`

## Capturas de tela (1280×800)

1. `store/screenshots/01-notificacao.png`
2. `store/screenshots/02-popup.png`
3. `store/screenshots/03-paineis.png`

## Ícone da loja

`icons/icon128.png`

## Arquivo para upload

`dist/dsh-approval-notifier-<versão>.zip` (gerado por `tools/build-release.ps1`).
