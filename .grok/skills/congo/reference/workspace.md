# Congo workspace requests and Congo files

The workspace sends the user's actions to you through Impeccable's live helper as `steer` events. You do the work with your normal tools and Impeccable's references, then reply on the same helper. There is no other AI and no second chat: questions go to the user in this conversation.

`WS` means `node .grok/skills/congo/scripts/workspace.mjs` (the request file gives the same script as `workspace.helper`).

## Connect

1. `WS connect [--project <the user's project folder>]`. It opens or reuses the workspace, starts Impeccable's live helper on the workspace's working area, and prints JSON with `area` (the working area) and `url` (show it to the user if they have not opened it).
2. Run Impeccable's poll from `area` as the working directory with the launcher `connect` printed: `<poll launcher> live-poll` (`poll.windowsLauncher` on a Windows shell without `sh`). Follow the harness policy in Impeccable's `reference/live.md`. Never pass a short `--timeout`. Poll again right after every event and every reply.
3. A steer whose message starts with `Congo workspace request <id>` is a workspace request: handle it below. Every other event (`generate`, `accept`, `discard`, `prefetch`, `exit`, ...) is Impeccable's live editor: handle it exactly as `live.md` says.

## Every request

- Read the request file named in the message (`requests/<id>.json` in the working area). It holds the type, the user's words (`request`), the project it is for (`app.path`, or null), any Library `items` or `item`, the prototype (`design`), the `action`, and `outputs`.
- **How much to build is the user's call,** read from what they picked and said: a whole app when they want an app, a screen when they want a screen. When it is open (ideas, options, anything unclear), prefer one main screen of the closest app, adapted fast; Expand does the rest once they choose. Finish with `--status ready` when the whole prototype is adapted and `--status main` when it started from a screen, which gives the user Expand.
- Each output is a prototype folder in a Congo file: `outputs[i].dir`, with `preview` (where the running build goes), `source` (the working source) and `meta` (`prototype.json`). The workspace already shows a placeholder card for it.
- **Prototypes never go into the user's project.** Only `build` (Pull into a project) changes code.
- **One prototype per request.** When the user asked for several, make more folders beside `outputs[0].dir` named `<id>-2`, `<id>-3` in the same Congo file.
- Reply exactly once: `impeccable live-poll --reply <id> steer_done "<one short line for the user>"`. On failure: `--reply <id> error "<short reason>"`. Then poll again.
- Missing context is asked in this chat. Keep the request open while you wait.

## A prototype

A folder in a Congo file:

| File | What it is |
| --- | --- |
| `prototype.json` | `title`, `status`, and optionally `summary` (one sentence), `format` (`desktop` or `mobile`), `brief`, `source` (`kind`, `id`, `version`, `app` of the Congo item it starts from), `sources` (every Congo item used), `notices`. |
| `preview/` | The running build: `index.html` and its assets. The card and the open view show this. |
| `source/` | The working source of a whole app. Its `node_modules` is a link to a prepared copy; never copy dependencies into a Congo file. |
| `history.jsonl` | One line per event. The helpers add to it; you may add `{"at": "<iso time>", "type": "note", "text": "..."}` lines. |

`status` is `main` when one screen (or a few) is adapted and the rest is still the source app, which shows the user an Expand action; `ready` when the whole prototype is done. The helpers set it; set it yourself when you write a preview by hand.

**The steps, in this order:**

1. `WS prepare <template-id> --into <outputs[0].dir> --json`. It copies the app's source into `source/`, links its dependencies and commits it once as "congo source", so later changes are a clean diff. The first use of an app downloads and installs it (the user's Congo sign-in and subscription apply); later uses reuse it and take seconds. It prints a `map` of the source (guides, route files, folders with screens and data): start from it.
2. Adapt as much as the user asked for in `source/`: the product's name, content, sample data, labels and the obvious actions. Keep the app's design and behavior. For one screen, read only the files that screen needs, change them in place and leave the other screens as they are; make the prototype open on that screen.
3. `WS preview <outputs[0].dir> --status main|ready --json`, then add `title`, `summary`, `source`, `sources` and `notices` to `prototype.json` (keep the fields already there).
4. Reply with one line: what is adapted and, for `main`, that Expand builds out the rest.

**One page or screen** (no whole app needed): write a static `preview/index.html` that holds the page's markup, with its stylesheets, fonts and images beside it and only the scripts its interactions need, then set `status` to `ready`. Keep the markup in the file, one element per line, so Impeccable's editor can pick in it.

**A brief** goes on product ideas only (something the user could build a business or product on), never on design-only prototypes such as a redesign or a quick action. In `prototype.json`:

```json
"brief": {
  "who": "Who needs it, in a sentence or two.",
  "why": "Why it fits this user: their work, their projects, what they asked.",
  "supports": "What supports the opportunity: what you found, with sources named.",
  "next": "What to look into next."
}
```

Keep each to a few plain sentences. Say only what you checked or can see; mark guesses as guesses.

Congo files are private to this computer. Never copy paid Congo source anywhere public.

## `send`: Explore items with notes

The user selected apps and screens in Explore and pressed Send. `items` lists each with its catalog identity (`kind`: `template` for a whole app, or `screen`; `id`; `version`; `app`), `title`, `route` and the user's `note`; `request` is the note for the whole request; `app` is the project it is meant for (null: something new).

1. **Decide whole app or screens** from the items and notes:
   - a whole app selected, or a new product: start from the whole app (the selected one, else the app the selected screens come from, else the closest template);
   - screens for the user's existing project: start from a copy of that project's page when you can read it, else from the screen's app, matched to the project's styles;
   - screens from several apps: start from the app that fits the product best and fit the others into it, in its tokens;
   - nothing selected: search the Library for the closest app or screens.
2. **Get the source** with `WS prepare` for the app you start from. For a screen from another app, read it from a scratch project (`congo init --new`, then `congo add`) and rebuild it in the app's own code, keeping its notices; `congo add` into the app is fine when it accepts the screen. If `congo whoami` shows the user is not signed in or not subscribed, tell them here to run `congo login` themselves or subscribe, and reply `error "Needs Congo sign-in and a subscription"`.
3. **Build as much as they asked for** (above).

## `library`: one Explore item

Prototype this, or a quick action, on an Explore card. `item` is the app or screen; `action` is set for a quick action. Handle it like `send` with that one item, then apply the action (as in `tweak`).

## `compose`: a request typed in Prototypes, or sent from your chat

Make one prototype for the user's words (several only when asked). It can be anything: a new product, a competitor to something, ideas from the user's work, a redesign.

- **Something new:** start from the closest Congo app or screens, as much as they asked for (above). Add a brief when it is a product idea.
- **A redesign of the user's project** (`app.path`): read the real page's source and build the redesigned page from a copy of it, as a static page. When the user asked for several directions, read Impeccable's `live.md` section "Plan three variants" for the identity lock and give each direction a different primary axis. A narrow request stays narrow.

## `expand`

The user pressed Expand on a prototype that started from one screen. Build out the rest of the app around it **in the same prototype** (`design.dir`): adapt the remaining screens the product needs, relabel the navigation, and remove what the product has no use for. Then `WS preview <design.dir> --status ready --json` and reply with one line.

## `tweak`: a quick action on a prototype

Makes a **new** prototype in `outputs[0].dir`; the original (`design.dir`) stays. For a whole app, copy the original's `source/` without `node_modules`, link `node_modules` the way the original does (a junction on Windows, `mklink /J`; a symlink elsewhere), change the copy, and `WS preview`. For a static page, copy `preview/` and change the copy.

| `action.key` | What to do |
| --- | --- |
| `subtle` | One variation within the same identity: Impeccable `live.md` default mode, one different primary axis. |
| `layout`, `colorize`, `bolder`, `quieter` | Read `action.reference` (Impeccable's command reference) and apply that command. |
| `distill`, `typeset`, `animate`, `delight`, `overdrive`, `polish`, `clarify`, `adapt`, `harden` | Same: read the command reference and apply it. |
| `critique`, `audit` | Run the command; write its report into `summary` (short) and a `report.md` in the prototype folder; the copy may stay unchanged. |
| `custom` | Apply the user's words in `action.brief`. |
| `editable` | The page is a script bundle. Render it and save it as a static page that looks the same; change nothing else. |

Title it `<original title> · <action label>`, keep the original's `status`, and say what changed in `summary`.

## `build`: Pull into a project

The only request that changes the user's code. `design` is the prototype (`design.sourceDir` its source); `app` is where it goes.

- **An existing project** (`app.path`): put the prototype's work into it. Carry over the adaptation from the prototype's source (its diff since the "congo source" commit shows exactly what changed), install any Congo screens it uses with `congo add` so receipts and notices are kept, and integrate it into the existing routes, navigation and styles. Keep product behavior and the user's unrelated edits intact; a narrow change stays narrow. Run the project's checks and open the real routes.
- **A new project** (no `app`): use the folder the user named; otherwise create a new folder named after the product in your current folder and say where it is. Run `congo create <template-id> --project <new folder>` for the app the prototype starts from (`base` or `source` in its `prototype.json`), then apply the prototype's changes: `git diff <the "congo source" commit>` in `design.sourceDir`, then `git apply` in the new folder, or copy the changed files. Name the project after the product (`package.json` `name`, the page title). Install its dependencies and build once.

Reply with one line saying where it went and how to run it. The prototype stays in its Congo file.

## Live editing a prototype

A `live-edit` request with a `design` whose `sourceDir` is set: the user pressed Edit on a whole-app prototype. Start the source's dev server on a free local port and keep it running, run Impeccable's live boot in `sourceDir` with `--allow-missing-context` (a prototype has no PRODUCT.md or DESIGN.md; never start an interview for one), following its `live.md`, and `live-setup.md` on first use (a Vite single-page app injects into `index.html`), and reply `steer_done` with the dev server's local URL. On Windows never pipe `impeccable live` output into another command; redirect it to a file. Then poll that folder's helper and handle the user's picks as `live.md` says; accepted changes go into the prototype's source. When the user stops editing, a `rebuild` request follows: `WS preview <design.dir>`, reply, and poll the working area again.

`start-app` and `switch-to-area` requests say what to do in their message.
