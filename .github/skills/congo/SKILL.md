---
name: congo
description: "Product discovery and rapid prototyping with Congo: make running prototypes from real, working apps and screens in the Congo Library, keep them in Congo files, and pull the ones the user wants into a code project. Use for /congo and for requests like prototype a CRM for realtors, make this for dentists, show me a few directions for my dashboard, what could compete with this product, find me business ideas, open the Congo workspace, or pull that prototype into my project. Ordinary selected-element edits, critique, polish and the other Impeccable commands stay with the impeccable skill."
version: 4.8.0
user-invocable: true
argument-hint: "[what to prototype, or open the workspace]"
license: Apache-2.0
---

Congo is a workspace for product discovery and rapid prototyping. Its Library holds real, working apps and their screens with source ([gocongo.ai](https://gocongo.ai)). A prototype that starts from a real app looks like a real product and can be clicked through in minutes. You are the only AI. This chat stays the conversation.

`.github/skills/congo/scripts` below is this skill's `scripts` folder: resolve it from the directory that contains this SKILL.md (the base directory the runtime reports for the skill), and use the written path only when none is reported. `WS` below means `node .github/skills/congo/scripts/workspace.mjs`.

## How to work

- **Do what the user asked.** There is no fixed routine and there are no built-in ways in: ideas, research, a competitor, a redesign, a prototype from things they selected are all just requests. No rounds of options, interviews or decision pages before you make something.
- **One prototype by default.** Several side by side only when the user asks ("a few directions", "three ideas").
- **The user's request decides how much you build.** If they want a whole app, adapt the whole app; if they want a screen, adapt that screen. These are their call, and a whole app is worth their wait.
- **When it is open, prefer a main screen.** For ideas, options, a few directions, or anything that does not say how much, prefer pulling the main screen of the closest app (its home screen, or the screen the product lives in) and adapting just that. It gets something real in front of the user fastest, and Expand builds out from there once they choose. This is a preference to keep you fast, not a rule: use your judgment.
- Say in one line what is adapted and what is still the source app's.
- **Be quick about the first result.** `WS prepare` prints a `map` of the app it copied: its guide, where routes are declared, and the folders that hold screens and sample data. Go from that map straight to the screen you are adapting and its data; do not tour the rest of the app. Change names, content, sample data and labels in place with your file-editing tools (shell heredocs break on quotes), do not restructure, and do not polish before showing it. While `WS prepare` runs for the first time, do your reading of anything else in parallel.
- **Whole app or screens as the base is your call** when nothing is selected: search the Library and choose from what it holds today.
- **Adapt before building.** Change the real source's names, content, sample data, labels and wiring for the user's product. Write new pieces only where the Library has nothing close, from the app's own components and styles.
- **Prototypes go into Congo files,** never straight into a code project. Only **Pull into a project** changes the user's code.
- **Ask only when it matters.** Otherwise make a sensible choice and say what you chose.

The entry skills are `/congo`, `/congo-ideas`, `/congo-compete` and `/congo-redesign`. They are ways in, not the only ones: any request in plain words works.

The Congo CLI commands, sign-in and subscription rules are in Impeccable's `reference/congo.md`. Library source comes only through Congo's CLI or MCP under the user's own sign-in; never ask for or handle their credentials. Never name specific Congo apps from memory: choose from what `congo templates --json` and `congo search` return today.

## Without a Congo subscription

Library source needs a subscription: every source pull (`congo create`, `congo add`, `WS prepare`) only works for a signed-in account with one. Explore, search, screenshots and previews are free and need no account. `congo whoami --json` shows `subscription.active`. Prototyping does not need it.

When the user is not signed in or has no subscription, do not stop and do not fail the request:

1. Tell them once, in a line: Library source needs a Congo subscription (`congo login` if they have one, [gocongo.ai/pricing](https://gocongo.ai/pricing) if not), and you are building this one with your own tools.
2. Build the prototype yourself: `WS new`, then write a static, clickable `preview/index.html` for the main screen with its styles and only the scripts its interactions need, and set `status` to `ready` in `prototype.json`. A redesign of their own project works from their code as usual.
3. It lands in Prototypes like any other, and Pull into a project still works.

Never try to get Library source another way.

## Congo files

Prototypes are kept in Congo files: folders ending in `.congo` in the user's `Documents/Congo` (for example `Realtor ideas.congo`). Each prototype is a folder inside one, with `prototype.json`, its running `preview/`, its working `source/` and `history.jsonl`. They are plain folders: safe to back up or move, and you can read and change them directly.

- `WS files --json` lists every Congo file and its prototypes, with their folders.
- `WS new --title "<name>" [--file <path to a .congo folder>] --json` makes a new prototype folder (in a new Congo file unless you name one) and prints its paths.
- `WS prepare <template-id> --into <prototype folder> --json` puts a Congo app's source into `source/`. The first use of an app downloads and installs it with the user's Congo CLI; after that the installed copy is reused, so this takes seconds.
- `WS preview <prototype folder> --status main|ready --json` builds `source/` into `preview/` and records the status: `main` when the main screen is adapted, `ready` when the whole prototype is.

[reference/workspace.md](reference/workspace.md) has the prototype format, briefs, Expand and Pull into a project.

## Making a prototype

1. Find the closest app or screens (`congo templates --json`, `congo search --kind screen --query "<words>" --json`), unless the user selected them.
2. `WS new`, then `WS prepare <template-id> --into <prototype folder>`.
3. Adapt as much as the request asks for (above) in `source/`.
4. `WS preview <prototype folder> --status main` when only a screen is adapted, or `--status ready` when the whole app is. Write the title and a one-sentence summary into `prototype.json`, and for a product idea a `brief` (see the reference).
5. Tell the user it is in Prototypes, and offer to open the workspace: `WS open --view prototypes`.

This works with the workspace closed: the prototype is in its Congo file and shows up when the workspace next opens.

## With the workspace open

When the user wants to explore and pick, asks for the workspace, or sends from it:

1. Connect (it opens on Explore). Pass `--project` when the user has a project they may pull prototypes into:

   ```sh
   WS connect [--project <project folder>] --browser
   ```

   Show the user the `url` it prints. It starts Impeccable's live helper on the workspace's working area and prints that `area` and the poll launcher (with `--json`: `poll.launcher`, and `poll.windowsLauncher` for a Windows shell without `sh`).
2. Start Impeccable's poll from `area`, following the harness policy in Impeccable's `reference/live.md` (Claude Code: a background task; Codex: a foreground session; Cursor: a background terminal). In a non-interactive run, keep the poll in the foreground so the session stays alive:

   ```sh
   cd <area> && <poll launcher> live-poll
   ```

3. Everything the user does in the workspace arrives at your poll as `Congo workspace request <id> (<type>)`. Handle each with [reference/workspace.md](reference/workspace.md), then poll again. The workspace has no chat of its own: say here what arrived and what you did, as if they had typed it to you.

A request made here in chat while the workspace is open ("show me a few directions for my dashboard") goes in with `WS request --text "<the user's words>"`, so its card appears at once, and comes back to your poll like any other.

`WS status` reports the workspace; `WS stop` closes it.