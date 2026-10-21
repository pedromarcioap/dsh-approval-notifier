# Launch copy — English

## Show HN

**Title**

```
Show HN: Chrome extension that alerts you when a coding agent waits for approval
```

**Body**

```
My coding agent kept stalling on me. DeepSeek Harness blocks the turn whenever it needs a decision — approve a tool call, answer a question, review a plan — and if I was in another window, nothing told me. The agent waited, and so did I.

So I wrote a small Chrome extension: it watches the three panels that take over the chat composer and fires a native notification (a Windows toast on Windows) when one of them is pending.

A few choices worth mentioning:

- No CSS-class scraping. Each panel publishes a stable attribute (data-approval-key, data-question-key, data-plan-review-key), so a restyle doesn't break detection.
- One notification per request, cleared automatically when you answer. Clicking it focuses the tab.
- "Only when unfocused" mode, so it stays quiet when you're already looking at the chat.
- The popup has diagnostics: how many tabs have the content script alive, pending count, and how long ago the last notification fired. That came from a real bug — reloading the extension orphans the content script in open tabs, and it failed completely silently. Now it shows a banner asking for F5.

Tests run in CI on every push (24 assertions, fake DOM + fake Chrome APIs, no browser needed).

MIT, source: https://github.com/pedromarcioap/dsh-approval-notifier

Happy to hear how others handle the "agent blocked on a human" visibility problem — it seems to hit every human-in-the-loop setup.
```

## Reddit (r/LocalLLaMA or similar)

**Title**

```
I built a notifier for coding agents that block on human approval
```

**Body**

```
Every human-in-the-loop agent setup has the same failure mode: the agent stops to ask for approval, and if you're in another window you find out ten minutes later.

This is a small Chrome extension for DeepSeek Harness that turns those blocks into native notifications (Windows toasts). It covers tool approval, ask_user_question prompts and plan review.

It works off stable data attributes the panels publish, not CSS classes, and it runs entirely locally — no server, no telemetry.

Diagnostics were the interesting part: "stopped working, no error" turned out to be a stale content script after reloading the extension, so the popup now reports whether any tab is actually talking to it.

MIT: https://github.com/pedromarcioap/dsh-approval-notifier

Curious whether people here solved this at the editor/terminal level instead — a terminal bell, tmux, or a webhook to the phone.
```

## X / Twitter

```
Your coding agent blocks for approval. If you're in another window, you find out 10 minutes later.

Built a Chrome extension that sends a native notification (Windows toast) the moment DeepSeek Harness waits on you.

MIT, open source: https://github.com/pedromarcioap/dsh-approval-notifier
```

## dev.to / blog (outline)

1. **The symptom** — agent stalled, nobody told me.
2. **Why it happens** — approval is a blocking, one-shot human decision by design.
3. **Detection without scraping** — stable `data-*-key` attributes.
4. **The silent failure** — orphaned content script after extension reload; why diagnostics beat retries.
5. **Testing without a browser** — `node:vm` + fake DOM/Chrome; what it does and does not prove.
6. **What I'd do differently** — package it as a native plugin instead of DOM observation.
