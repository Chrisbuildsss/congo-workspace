---
name: congo
description: "Design and build with real apps in the local Congo workspace: start a new app from the closest Congo apps, design a new screen, or redesign a page or a whole app, with working alternatives the user compares on Compose. Use for /congo and for requests like build me a CRM for realtors, start a new app, help redesign my contacts page, make this page look better, show me other takes on the pricing page, or redesign the app. The user's own AI builds every alternative. Ordinary selected-element edits, critique, polish and the other Impeccable commands stay with the impeccable skill."
version: 4.8.0
user-invocable: true
license: Apache-2.0
---

The Congo skill runs in the local Congo workspace: the user sees and compares your alternatives as running code on Compose, and every action they take there comes back to you. You are the only AI. This chat stays the conversation.

`.vibe/skills/congo/scripts` below is this skill's `scripts` folder: resolve it from the directory that contains this SKILL.md (the base directory the runtime reports for the skill), and use the written path only when none is reported. Keep the working directory at the user's project, or at the folder they work in when there is no project yet.

## Start

1. Decide which kind of request this is, from this conversation and the folder:
   - **A new app**: there is no app yet (an empty or unrelated folder), or the user asks for a new product ("build me a CRM for realtors", "start a new app"). Resolve what the product does and who uses it; you need no app folder yet.
   - **An existing app**: a new screen, a page redesign or a whole-app redesign. Resolve the app (its folder), the page or route, and the intent.

   If what you need is missing, ask here in one short question before going on. A narrow request (one section, one page) stays narrow; "redesign the app" means one coherent direction across the affected screens and shared components.
2. Connect and open the workspace on Compose. Pass `--project` only for an existing app:

   ```sh
   node .vibe/skills/congo/scripts/workspace.mjs connect [--project <app folder>] --browser
   ```

   Show the user the `url` it prints. It starts Impeccable's live helper on the workspace's working area and prints that `area` and the poll launcher (with `--json`: `poll.launcher`, and `poll.windowsLauncher` for a Windows shell without `sh`).
3. Start Impeccable's poll from `area`, following the harness policy in Impeccable's `reference/live.md` (Claude Code: a background task; Codex: a foreground session; Cursor: a background terminal):

   ```sh
   cd <area> && <poll launcher> live-poll
   ```

4. Put the request into Compose, in the user's words:

   ```sh
   node .vibe/skills/congo/scripts/workspace.mjs request --text "<the request>" [--project <app folder>]
   ```

   It arrives at your poll as `Congo workspace request <id> (compose)`. Handle it, and every later workspace request, with [reference/workspace.md](reference/workspace.md). Keep polling after each reply.

The user can also open the workspace themselves (`congo workspace`) and type into Compose; those requests reach you the same way once you are polling.

## A new app

For a new app, Compose starts from real apps, not invented directions. Follow the reference round in Impeccable's `reference/congo.md` ("New products and whole surfaces: real apps first"): pick the Congo apps closest to what the product does, adapt each one's main screen to the product, and show them on Compose as running code. When the user picks one with **Build this**, create the new app from that Congo app and carry the approved adaptation through it, as `workspace.md` describes under `build`. Then attach the new folder to the workspace and offer to start it in Live App.

## While the workspace is open

- Tweaks, Build this, Library picks, Edit and Live App all arrive as requests or as Impeccable live events. `workspace.md` says how to answer each; Impeccable's `live.md` covers its own live-editor events.
- Only Build this changes or creates the user's project. Alternatives, tweaks and Library adaptations are written in the workspace's working area.
- Library source comes only through Congo's CLI or MCP, under the user's own sign-in. Never ask for or handle their credentials.
- Keep product behavior, routes, data bindings, forms and actions working, and the user's unrelated edits intact. Report what changed after Build this in one line in the workspace and in more detail here.

`node .vibe/skills/congo/scripts/workspace.mjs status` reports the workspace; `stop` closes it.