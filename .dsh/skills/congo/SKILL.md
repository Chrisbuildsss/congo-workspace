---
name: congo
description: "Product discovery and rapid prototyping with Congo: make running prototypes from real, working apps and screens in the Congo Library, keep them in Congo files, and pull the ones the user wants into a code project. Use for /congo and for requests like prototype a CRM for realtors, make this for dentists, show me a few directions for my dashboard, what could compete with this product, find me business ideas, open the Congo workspace, or pull that prototype into my project. Ordinary selected-element edits, critique, polish and the other Impeccable commands stay with the impeccable skill."
version: 4.8.0
user-invocable: true
license: Apache-2.0
---

Congo is a workspace for product discovery and rapid prototyping. Its Library holds real, working apps and their screens with source ([buildwithcongo.com](https://buildwithcongo.com)). A prototype that starts from a real app looks like a real product and can be clicked through in minutes. You are the only AI. This chat stays the conversation.

`.dsh/skills/congo/scripts` below is this skill's `scripts` folder: resolve it from the directory that contains this SKILL.md (the base directory the runtime reports for the skill), and use the written path only when none is reported. `WS` below means `node .dsh/skills/congo/scripts/workspace.mjs`.

## How to work

- **Do what the user asked.** There is no fixed routine and there are no built-in ways in: ideas, research, a competitor, a redesign, a prototype from things they selected are all just requests. No rounds of options, interviews or decision pages before you make something.
- **One prototype by default.** Several side by side only when the user asks ("a few directions", "three ideas").
- **Main screen first.** Adapt the main screen or the main workflow, build the preview and show it. The rest of the app stays as the original until the user asks to Expand it. Say in one line what is adapted and what is still the source app's.
- **Whole app or screens is your call,** from what the user selected and said. With nothing selected, search the Library and choose from what it holds today.
- **Adapt before building.** Change the real source's names, content, sample data, labels and wiring for the user's product. Write new pieces only where the Library has nothing close, from the app's own components and styles.
- **Prototypes go into Congo files,** never straight into a code project. Only **Pull into a project** changes the user's code.
- **Ask only when it matters.** Otherwise make a sensible choice and say what you chose.

The Congo CLI commands, sign-in and subscription rules are in Impeccable's `reference/congo.md`. Library source comes only through Congo's CLI or MCP under the user's own sign-in; never ask for or handle their credentials. Never name specific Congo apps from memory: choose from what `congo templates --json` and `congo search` return today.

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
3. Adapt the main screen or workflow in `source/` to the user's product.
4. `WS preview <prototype folder> --status main`, write the title and a one-sentence summary into `prototype.json`, and for a product idea a `brief` (see the reference).
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

3. Everything the user does in the workspace arrives at your poll as `Congo workspace request <id> (<type>)`. Handle each with [reference/workspace.md](reference/workspace.md), then poll again.

A request made here in chat while the workspace is open ("show me a few directions for my dashboard") goes in with `WS request --text "<the user's words>"`, so its card appears at once, and comes back to your poll like any other.

`WS status` reports the workspace; `WS stop` closes it.