---
name: congo
description: "Build with real apps from the Congo Library: start from a real, working app or screen and adapt its source instead of building from scratch, with or without the local Congo workspace. Use for /congo and for requests like build me a CRM for realtors from Congo, start a new app, add a settings page like this one, redesign my dashboard, show me a few directions, or open the Congo workspace. In the workspace people select apps and screens and send them; you return running prototypes, and Use this puts one into their app. Ordinary selected-element edits, critique, polish and the other Impeccable commands stay with the impeccable skill."
version: 4.8.0
user-invocable: true
argument-hint: "[what to build, or open the workspace]"
license: Apache-2.0
---

Congo gives you real apps to build from: full editable app templates and their screens, with working source, from the Congo Library ([buildwithcongo.com](https://buildwithcongo.com)). Starting from the closest real app and adapting it is faster than writing from scratch, and the result looks like a real product. You are the only AI. This chat stays the conversation.

`.trae-cn/skills/congo/scripts` below is this skill's `scripts` folder: resolve it from the directory that contains this SKILL.md (the base directory the runtime reports for the skill), and use the written path only when none is reported. Keep the working directory at the user's project, or at the folder they work in when there is no project yet.

## How to work

- **Do what the user asked.** There is no fixed routine: no rounds of options, interviews or decision pages before you build.
- **One result by default.** Make several side by side only when the user asks for them ("show me a few directions", a redesign where they want to choose).
- **Whole app or screens is your call,** from what the user selected and said. A new product usually starts from the closest whole app; a new page in an existing app starts from the closest screen. When nothing is selected, search the Library and choose from what it holds today.
- **Adapt before building.** Change the real source's names, content, sample data, labels, routes and wiring for the user's product. Write new pieces only where the Library has nothing close, and build them from the app's own components and styles.
- **Ask only when it matters.** If the product or the target app is genuinely unclear, ask one short question here. Otherwise make reasonable choices and say what you chose.
- **Keep it quick.** Adapt the screens the product's main workflow uses first, show the result, and say which parts are still the source app's; rework or remove the rest when the user asks. Install and build once, open the main routes to check them, and run deeper reviews (critique, polish, audit) only when asked.

The Congo CLI commands, sign-in and subscription rules, and how to adapt installed source are in Impeccable's `reference/congo.md`. Library source comes only through Congo's CLI or MCP under the user's own sign-in; never ask for or handle their credentials.

## Without the workspace

A clear request in this chat ("build me a CRM for realtors from Congo", "add a billing page like Congo's to my app") needs no workspace:

1. Find the closest app or screens: `congo templates --json`, `congo search --kind screen --query "<words>" --json`.
2. **A new app:** `congo create <template-id> --project <new folder>` (the folder the user named, or a new folder named after the product in the current folder). **An existing app:** add the screens to it with `congo add` as `congo.md` describes.
3. Adapt it, install its dependencies, build once and open the main routes.
4. Offer to show it running in the workspace's My app: `node .trae-cn/skills/congo/scripts/workspace.mjs connect --project <folder> --view live --browser`.

## With the workspace

When the user wants to browse and pick, asks for the workspace, or sends from it:

1. Connect and open the workspace (it opens on the Library). Pass `--project` when the user has an app:

   ```sh
   node .trae-cn/skills/congo/scripts/workspace.mjs connect [--project <app folder>] --browser
   ```

   Show the user the `url` it prints. It starts Impeccable's live helper on the workspace's working area and prints that `area` and the poll launcher (with `--json`: `poll.launcher`, and `poll.windowsLauncher` for a Windows shell without `sh`).
2. Start Impeccable's poll from `area`, following the harness policy in Impeccable's `reference/live.md` (Claude Code: a background task; Codex: a foreground session; Cursor: a background terminal). In a non-interactive run, keep the poll in the foreground so the session stays alive:

   ```sh
   cd <area> && <poll launcher> live-poll
   ```

3. Everything the user does in the workspace arrives at your poll as `Congo workspace request <id> (<type>)`. Handle each with [reference/workspace.md](reference/workspace.md), then poll again.

What you make for the workspace lands in **Prototypes** as running code, in the workspace's working area. Only **Use this** (a `build` request) and edits the user accepts in My app change their project.

A request made here in chat that should become a prototype ("show me a few directions for my dashboard" while the workspace is open) goes in with `node .trae-cn/skills/congo/scripts/workspace.mjs request --text "<the user's words>" [--project <app folder>]` and comes back to your poll like any other.

`node .trae-cn/skills/congo/scripts/workspace.mjs status` reports the workspace; `stop` closes it.