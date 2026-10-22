# Post para r/DeepSeekHarness

**Título**

```
Free & open source: a Windows toast the moment DeepSeek Harness waits on your approval
```

**Corpo**

```
I kept walking away during long runs and coming back to an agent that had been
blocked for ten minutes waiting for a decision. So I built a small notifier.

**What it does**

- Watches the three panels that take over the composer — tool approval,
  `ask_user_question`, and plan review — and fires a native notification the
  moment one appears.
- Clicking the toast focuses the DSH tab.
- One notification per request, and it disappears when you answer.
- Badge on the icon showing how many requests are waiting.
- Optional reminder every ~90s (max 3) if nobody answers.
- Quiet hours (off by default): alerts are held and delivered when the window
  ends — and dropped if you answer first. Approvals can bypass it, since they
  block the agent.
- Works on any port of 127.0.0.1 / localhost, so it doesn't break when the app
  picks a random one.

**How it works**

It doesn't scrape CSS classes. Each panel publishes a stable attribute
(`data-approval-key`, `data-question-key`, `data-plan-review-key`), so a
restyle doesn't silently break detection. There are 126 automated checks in CI
(fake DOM, fake Chrome APIs, no browser needed).

**Install**

Not on the Chrome Web Store yet — the submission is pending review. For now:

1. clone the repo
2. `chrome://extensions` → enable Developer mode
3. **Load unpacked** → pick the extension folder
4. reload the DSH tab (F5)

**It's free**

MIT licensed. No account, no telemetry, no paid tier, nothing leaves your
machine. It's a notifier, not an approver: it never answers anything for you —
the decision stays in the chat.

There's also a native plugin version for people who'd rather not run a browser
extension (it subscribes to the session status snapshot instead of the DOM).

Feedback welcome, especially: which other states deserve a notification?
Subagent failures and long-task completion are the two I'm unsure about.

GitHub: https://github.com/pedromarcioap/dsh-approval-notifier
```

## Antes de postar

- Confira as regras de autopromoção do subreddit (alguns exigem flair ou
  participação prévia).
- Deixe claro na primeira linha que você é o autor — o texto já faz isso
  ("I built"), não esconda.
- Se a Chrome Web Store liberar a extensão, atualize o link de instalação na
  primeira hora: é a pergunta mais provável nos comentários.
