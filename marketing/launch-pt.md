# Textos de lançamento — Português

## TabNews (post principal)

**Título**

```
Fiz uma extensão que avisa quando o agente de código para esperando minha aprovação
```

**Corpo**

```
Uso o DeepSeek Harness no dia a dia e sempre caía no mesmo buraco: o agente bloqueia o turno quando precisa de uma decisão minha — aprovar uma ferramenta, responder uma pergunta, revisar um plano — e, se eu estiver em outra janela, ele simplesmente fica parado. Sem aviso, sem som, nada.

O sintoma é bobo, o custo não é: você volta 10 minutos depois e descobre que o agente estava esperando desde o primeiro minuto.

Resolvi com uma extensão do Chrome, o DSH — Aviso de aprovação:

• Detecta os três tipos de painel que assumem o compositor do chat (aprovação, pergunta e revisão de plano).
• Dispara uma notificação nativa — no Windows, um toast do sistema.
• Mostra uma única notificação por pedido; atualizações da tela não duplicam o aviso.
• Fecha sozinha quando você responde; clicar no aviso foca a aba do DSH.
• Tem um modo "só quando a janela não estiver em foco", para não virar barulho se você já está olhando.

Uma decisão de engenharia que valeu a pena: em vez de depender de classes CSS do React (que mudam a cada deploy), a extensão observa atributos estáveis que os próprios painéis publicam — data-approval-key, data-question-key e data-plan-review-key. Se o painel aparece, o atributo está lá; não é preciso caçar seletor.

Também escrevi 24 verificações automatizadas que rodam no GitHub Actions a cada push, com DOM e APIs do Chrome simulados — sem abrir navegador. E o popup tem diagnóstico: em quantas abas o script está ativo, quantos pedidos estão pendentes e há quanto tempo foi o último aviso. Isso nasceu de um bug real: recarregar a extensão deixa o script das abas antigas órfão, e ele falhava em silêncio absoluto. Agora aparece uma faixa na página pedindo F5.

Código aberto, MIT: https://github.com/pedromarcioap/dsh-approval-notifier

Se você usa agente de código com aprovação humana no meio do caminho, o problema é o mesmo — só muda a ferramenta.
```

## LinkedIn

```
Meu agente de código ficava parado esperando aprovação e eu não ficava sabendo.

O DeepSeek Harness bloqueia o turno quando precisa de uma decisão minha. Se eu estava em outra janela, nada acontecia: sem aviso, sem som. O agente esperava, e eu também.

Fiz uma extensão do Chrome que resolve isso — notificação nativa (toast do Windows) sempre que um painel de aprovação, pergunta ou revisão de plano está pendente.

O detalhe técnico que mais gostei: em vez de rastrear classes CSS que mudam a cada build, observo atributos estáveis que os próprios painéis publicam. E o popup tem diagnóstico, porque "parou de funcionar sem erro" era exatamente o pior sintoma possível.

Código aberto (MIT), com CI rodando 24 verificações: https://github.com/pedromarcioap/dsh-approval-notifier

#opensource #desenvolvimento #IA #agentes
```

## X / Twitter

```
Meu agente de código bloqueava esperando minha aprovação — e eu só descobria 10 minutos depois.

Fiz uma extensão que avisa: notificação nativa (toast no Windows) quando o DeepSeek Harness espera uma decisão minha.

Open source, MIT ↓
https://github.com/pedromarcioap/dsh-approval-notifier
```
