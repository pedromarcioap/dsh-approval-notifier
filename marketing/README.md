# Plano de divulgação

Ordem recomendada, do mais barato ao mais caro em esforço. A regra geral: o
público é quem **já usa** o DSH. Profundidade nesses lugares vale mais que
amplitude genérica.

## 1. Antes de qualquer post

- [ ] Publicar na Chrome Web Store (ver `store/CHECKLIST.md`) — sem link de
      instalação, quase todo post morre no primeiro comentário.
- [ ] Edge Add-ons, se possível (segundo link, sem custo).
- [ ] Colocar os links no topo do README.
- [ ] Conferir o social preview do repositório (Settings → General → Social
      preview): a imagem `docs/notification.png` funciona bem.
- [ ] Fixar o repositório no perfil do GitHub.

## 2. Comunidades do ecossistema DSH (maior conversão)

- Catálogos de plugins: ver trilha B. Hoje a extensão **não** é um plugin DSH,
  então ela não entra no `dsh plugin add` nem no Discover do app. Isso só muda
  quando o plugin nativo existir.
- Onde houver espaço para "ferramentas da comunidade", apresente como
  *integração* e não como plugin.

## 3. Comunidades de desenvolvedores (alcance)

| Canal | Idioma | Observação |
|---|---|---|
| TabNews | PT | Melhor vitrine brasileira para open source; o post de `launch-pt.md` já está no tom da plataforma |
| LinkedIn | PT | Público profissional; funciona bem com o enquadramento "agente parado" |
| X/Twitter | PT/EN | Thread curta com uma imagem; fixe o post |
| Hacker News (Show HN) | EN | Poste em dia de semana, manhã no horário do Leste dos EUA; responda todos os comentários nas primeiras horas |
| Reddit (r/LocalLLaMA, r/DeepSeek, r/chrome_extensions) | EN | Leia as regras de autopromoção de cada subreddit — algumas exigem participação prévia |

## 4. Regras de etiqueta que evitam queimar o canal

- Poste **uma vez** por comunidade. Repostar o mesmo link em vários lugares no
  mesmo dia costuma render banimento.
- Responda comentários; o tráfego de um post dura ~48h.
- Não peça estrelas. Peça feedback sobre o problema, não sobre o repositório.
- Ao falar de limitações, seja específico (precisa da aba aberta, porta 3080):
  isso gera confiança e evita review negativo na loja.

## 5. Medição

- **GitHub**: Insights → Traffic (views, clones, referrers) mostra qual canal
  converteu.
- **Releases**: a API expõe `download_count` por asset.
- **Loja**: o dashboard da Chrome Web Store mostra instalações semanais.
