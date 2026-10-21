# Chrome Web Store listing — English

## Name (max 45 chars)

```
DSH — Approval notifier
```

## Short description (max 132 chars)

```
Native Chrome/Windows notification when DeepSeek Harness waits for your approval, answer, or plan review.
```

## Category

`Productivity`. Acceptable alternative: `Developer Tools`.

## Detailed description

```
DeepSeek Harness blocks the turn whenever it needs a decision from you: approve a tool call, answer a question, or review a plan. If you are in another window, the agent just sits there — and nothing tells you.

This extension turns that block into a native Chrome notification, which Windows shows as a system toast.

WHAT IT DOES
• Alerts you when an approval, question, or plan-review panel takes over the chat composer.
• Shows one notification per request — screen updates do not duplicate the alert.
• Clears the notification by itself when you answer or the panel goes away.
• Plays a short beep, only after you interact with the page.
• Prefixes the tab title with ⚠ while something is pending.
• Clicking the notification focuses the DSH tab.

CONTROL
• Turn alerts on or off without removing the extension.
• "Only when the window is not focused" mode: stays quiet if you are already looking at the chat, and alerts the moment you switch away.
• Popup diagnostics: how many tabs have the script active, how many requests are pending, and how long ago the last notification fired.
• Test notification button, to tell an extension failure apart from a system block.

PRIVACY
The extension sends nothing to any server. No analytics, telemetry, account, or tracking. It only reads the panels of the local DeepSeek Harness page and stores two preferences in your own browser.

REQUIREMENTS
• DeepSeek Harness running locally at http://127.0.0.1 or http://localhost (any port, including DSH Desktop, which picks a free port).
• A Manifest V3 capable Chrome.
• On Windows, Chrome notifications allowed and Focus Assist off while you work.

OPEN SOURCE
Source, tests and releases: https://github.com/pedromarcioap/dsh-approval-notifier
MIT licensed.
```

## Single purpose statement

```
The extension has a single purpose: notify the user, through a native browser notification, when the local DeepSeek Harness is blocked waiting for their decision (tool approval, question, or plan review).
```

## Permission justifications

**`notifications`**

```
This is the core purpose: show a native alert when the local DeepSeek Harness conversation waits for a user decision. Without this permission there is no way to alert someone who is in another window.
```

**`storage`**

```
Stores two local preferences (alerts on/off and the "only when unfocused" mode) with chrome.storage.local. Nothing is synced or sent to any server.
```

**Site access `127.0.0.1` / `localhost`**

```
The extension must observe the DOM of the local DeepSeek Harness page to detect when an approval, question, or plan-review panel is pending. Access is limited to these two local addresses, on any port; no other site is read or modified.
```

**`alarms`**

```
Re-shows a request that is still unanswered, at most three times, so a missed toast does not stay missed. No data leaves the browser.
```

## Data usage declaration

- Collects user data? **No.**
- Sells data to third parties? **No.**
- Uses data for purposes unrelated to the single purpose? **No.**
- Uses or transfers data to determine creditworthiness? **No.**
- Remote code: **No** (all code ships in the package).
- Privacy policy: `https://github.com/pedromarcioap/dsh-approval-notifier/blob/main/PRIVACY.md`
