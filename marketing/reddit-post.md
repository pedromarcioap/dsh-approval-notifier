# Post para r/DeepSeekHarness

**Título**

```
Free & open source: a native toast the moment DeepSeek Harness waits on your approval
```

**Corpo**

```
I kept walking away during long runs and coming back to an agent that had been
blocked for ten minutes waiting for a decision. So I built two things for it: a
Chrome extension and a native DSH plugin.

**What they do**

- Watch the three states that block a turn — tool approval, `ask_user_question`,
  and plan review — and fire a native notification the moment one appears.
- Clicking the toast focuses the chat.
- One notification per request, and it disappears when you answer.
- Badge showing how many requests are waiting.
- Optional reminder every ~90s (max 3) if nobody answers.
- Quiet hours (off by default): alerts are held and delivered when the window
  ends — and dropped if you answer first. Approvals can bypass it, since they
  block the agent.

**Two ways to run it**

*Chrome extension* — for when you use the DSH web UI. It doesn't scrape CSS
classes: each panel publishes a stable attribute (`data-approval-key`,
`data-question-key`, `data-plan-review-key`), so a restyle doesn't silently
break detection. Works on any port of 127.0.0.1 / localhost, so it survives the
app picking a random one.

*Native plugin* — for the desktop app, or if you'd rather not run an extension.
It subscribes to the session status snapshot instead of the DOM, so there is
nothing to detect visually.

**Install**

The extension isn't on the Chrome Web Store yet. Honestly, I wanted to know if
there's interest before going through the review process — the code is MIT and
ready. **If people here want it, say so and I'll publish it to the Web Store
and share the link.** Until then:

1. clone the repo
2. `chrome://extensions` → enable Developer mode
3. **Load unpacked** → pick the extension folder
4. reload the DSH tab (F5)

The plugin's browser half is already published on npm
(`dsh-plugin-approval-notifier-client`); the bundle that wires it into a profile
is still in npm's review queue, so `dsh plugin add` won't work until that clears.
I'll update this thread when it does.

**It's free**

MIT licensed. No account, no telemetry, no paid tier, nothing leaves your
machine. It's a notifier, not an approver: it never answers anything for you —
the decision stays in the chat.

126 automated checks run in CI (fake DOM, fake Chrome APIs, simulated clock).

Feedback welcome, especially: which other states deserve a notification?
Subagent failures and long-task completion are the two I'm unsure about.

GitHub: https://github.com/pedromarcioap/dsh-approval-notifier
```

## Antes de postar

- Confira as regras de autopromoção do subreddit (alguns exigem flair ou
  participação prévia).
- A primeira linha deixa claro que você é o autor ("I built") — mantenha.
- Se alguém pedir a extensão na Web Store, cumpra: publique e responda no mesmo
  thread. É o tipo de promessa que, não cumprida, queima o canal.
