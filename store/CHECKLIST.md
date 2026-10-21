# Checklist de publicação — Chrome Web Store e Edge

## Antes de enviar

- [ ] `manifest.json` com a versão que será publicada (hoje `1.0.1`).
- [ ] `pwsh -File tools/build-release.ps1 -Version <versão>` gera
      `dist/dsh-approval-notifier-<versão>.zip` com o `manifest.json` na raiz.
- [ ] `node test/content.test.mjs` passando; CI verde no GitHub.
- [ ] Screenshots em 1280×800 em `store/screenshots/`.
- [ ] Ícone 128×128 em `icons/icon128.png`.
- [ ] `PRIVACY.md` publicado no repositório (a URL pública é a da política).

## Chrome Web Store

1. **Conta de desenvolvedor** — <https://chrome.google.com/webstore/devconsole>.
   Taxa única de US$ 5 por conta; exige verificação de e-mail e, às vezes,
   verificação de identidade.
2. **Novo item** → envie o `.zip` de `dist/`.
3. **Preencha a listagem** com `store/listing-pt.md` (idioma principal) e
   `store/listing-en.md` como tradução.
4. **Privacy practices**:
   - Finalidade única: cole o bloco *single purpose* do arquivo de listagem.
   - Justificativa de cada permissão: `notifications` e `storage`.
   - Uso de dados: marque **não coleta** em todas as categorias.
   - URL da política de privacidade: a do `PRIVACY.md`.
   - Código remoto: **não**.
5. **Envie para revisão.** Prazo típico: de algumas horas a poucos dias.
   Rejeições comuns neste perfil de extensão:
   - descrição prometendo algo que a extensão não faz;
   - permissão sem justificativa convincente;
   - screenshot que não representa a interface real.
6. **Publicação**: por padrão fica público ao passar na revisão. É possível
   publicar para um grupo restrito antes, para testar com conhecidos.

### Atualizações

Cada nova versão é um upload novo do `.zip` com `manifest.json` de versão maior.
A revisão de atualização costuma ser mais rápida.

## Microsoft Edge Add-ons (opcional, gratuito)

1. **Partner Center** — <https://partner.microsoft.com/dashboard/microsoftedge>.
   Sem taxa.
2. Envie o mesmo `.zip` (o Edge aceita pacotes Chromium).
3. Reaproveite os textos de `store/listing-en.md`; o Edge exige listagem em
   inglês.
4. As capturas de tela do Edge são 1280×800 — as mesmas servem.

## Depois de publicado

- [ ] Adicionar os dois links (Chrome e Edge) ao topo do `README.md`.
- [ ] Criar uma release no GitHub citando a loja.
- [ ] Divulgar (ver `marketing/README.md`).
- [ ] Acompanhar instalações e avaliações; responder reviews negativas.

## Riscos e mitigação

| Risco | Mitigação |
|---|---|
| Rejeição por “permissão excessiva” | Acesso restrito a `127.0.0.1` e `localhost` (qualquer porta), com justificativa explícita no formulário |
| Rejeição por screenshot enganoso | As capturas mostram a UI real (popup renderizado do próprio CSS) e a notificação real |
| Extensão não casa com a porta do DSH | Não é mais um risco: `content_scripts.matches` cobre qualquer porta em `127.0.0.1` e `localhost` (o DSH Desktop sobe em porta aleatória) |
| Lembrete virar spam | Máximo de três lembretes por pedido, cancelados ao responder ou ao fechar o toast |
| DMCA/marca | O nome cita “DSH” como compatibilidade, não como afiliação; deixar claro no texto que é projeto independente |
