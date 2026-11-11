---
name: redesign
description: "Redesign a screen, page or whole app with working alternatives in the local Congo workspace. Use for /redesign and for requests like help redesign my contacts page, make this page look better, show me other takes on the pricing page, or redesign the app. Opens the workspace on Compose; the user's own AI builds every alternative. Ordinary selected-element edits, critique, polish and the other Impeccable commands stay with the impeccable skill."
license: Apache-2.0
user-invocable: true
argument-hint: "[screen, page, or app request]"
---

Redesign runs in the local Congo workspace: the user sees and compares your alternatives as running code on Compose, and every action they take there comes back to you. You are the only AI. This chat stays the conversation.

## Start

1. Resolve what to redesign from this conversation and the code: the app (its folder), the page or route, and the intent. If the app, page or intent is missing, ask here in one short question before going on. A narrow request (one section, one page) stays narrow; "redesign the app" means one coherent direction across the affected screens and shared components.
2. Connect and open the workspace on Compose:

   ```sh
   node {{scripts_path}}/workspace.mjs connect --project <app folder> --browser
   ```

   Show the user the `url` it prints. It starts Impeccable's live helper on the workspace's working area and prints that `area`.
3. Start Impeccable's poll from `area`, following the harness policy in Impeccable's `reference/live.md` (Claude Code: a background task; Codex: a foreground session; Cursor: a background terminal):

   ```sh
   <impeccable skill>/scripts/impeccable live-poll
   ```

4. Put the request into Compose, in the user's words:

   ```sh
   node {{scripts_path}}/workspace.mjs request --text "<the redesign request>" --project <app folder>
   ```

   It arrives at your poll as `Congo workspace request <id> (compose)`. Handle it, and every later workspace request, with [reference/workspace.md](reference/workspace.md). Keep polling after each reply.

The user can also open the workspace themselves (`congo workspace`) and type into Compose; those requests reach you the same way once you are polling.

## While the workspace is open

- Tweaks, Build this, Library picks, Edit and Live App all arrive as requests or as Impeccable live events. `workspace.md` says how to answer each; Impeccable's `live.md` covers its own live-editor events.
- Only Build this changes the user's project. Alternatives, tweaks and Library adaptations are written in the workspace's working area.
- Library source comes only through Congo's CLI or MCP, under the user's own sign-in. Never ask for or handle their credentials.
- Keep product behavior, routes, data bindings, forms and actions working, and the user's unrelated edits intact. Report what changed after Build this in one line in the workspace and in more detail here.

`node {{scripts_path}}/workspace.mjs status` reports the workspace; `stop` closes it.
