# Congo workspace requests

The workspace sends the user's actions to you through Impeccable's live helper as `steer` events. You do the work with your normal tools and Impeccable's references, then reply on the same helper. There is no other AI and no second chat: questions go to the user in this conversation.

## Connect

1. `node .veto/skills/congo/scripts/workspace.mjs connect [--project <the user's app folder>]`. It opens or reuses the workspace, starts Impeccable's live helper on the workspace's working area, and prints JSON with `area` (the working area) and `url` (show it to the user if they have not opened it).
2. Run Impeccable's poll from `area` as the working directory with the launcher `connect` printed: `<poll launcher> live-poll` (`poll.windowsLauncher` on a Windows shell without `sh`). Follow the harness policy in Impeccable's `reference/live.md`: Claude Code runs the poll as a background task, Codex holds it in a foreground session, Cursor uses a background terminal. Never pass a short `--timeout`. Poll again right after every event and every reply.
3. A steer whose message starts with `Congo workspace request <id>` is a workspace request: handle it below. Every other event (`generate`, `accept`, `discard`, `prefetch`, `exit`, ...) is Impeccable's live editor: handle it exactly as `live.md` says.

The workspace shows the user that you are connected while your poll is parked on the helper, and shows each request as in progress until you reply.

## Every request

- Read the request file named in the message (`requests/<id>.json` in the working area). It holds the type, the user's words (`request`), their app (`app.path`, or null for a new app), any Library `items` or `item`, the prototype (`design`), the `action`, and `outputs`: the folders your prototypes go in.
- **Prototypes are made in the working area, never in the user's project.** Only `build` (Use this) changes the user's code.
- **One prototype per request.** When the user asked for several (a redesign where they want to choose, "a few directions"), write them as `<id>-2`, `<id>-3` next to `outputs[0].dir`; the workspace shows every folder that starts with the request id.
- Reply exactly once: `impeccable live-poll --reply <id> steer_done "<one short line for the user>"`. On failure: `--reply <id> error "<short reason>"`. Then poll again.
- Missing context (which app, which page, what to keep) is asked in this chat. Keep the request open while you wait; reply when the work is done.

## Prototypes

A prototype is a folder the workspace shows as a card in Prototypes and opens at full size. Write `design.json` last: the card appears when it lands. It holds `title`, and optionally `summary` (one sentence), `format` (`desktop` or `mobile`), `root`, `sourceDir`, `source` (`kind`, `id`, `version`, `app` of the Congo item it starts from), `sources` (every Congo item used) and `notices`.

**A whole app** (or anything that needs its routes): the app itself, clickable end to end.

1. Keep its source in the request's `workspace.sources` folder, never inside `designs/`. For a Congo app: `congo create <template-id> --project <sources>/<name>`, then right away `git init`, `git add -A` and `git commit -m "congo source"` there, so your adaptation is a diff that Use this can carry over.
2. Adapt it, install its dependencies once, and build it with its own bundler into the source folder (for Vite: `npx vite build --outDir dist --emptyOutDir`, with the default base `/`).
3. Copy everything in `dist` into `outputs[0].dir`, with the package's license and notice files, then write `design.json` with `"root": true` and `"sourceDir": "<absolute source folder>"`.

The workspace serves a `root` prototype at the root of its own local address, so the app's routes and root-relative assets work as in the real app. Edit runs Impeccable's live editor on the source's dev server, and Use this starts from the source. When a later request starts from the same source (a quick action on it), copy the source without `node_modules` and link the original's `node_modules` (a junction on Windows, `mklink /J`; a symlink elsewhere) unless the dependencies change.

**One page or screen:** a static page. Write an `index.html` that holds the page's markup, with its stylesheets, fonts and images beside it and only the scripts its interactions need (menus, tabs, dialogs). Edit opens it in Impeccable's live editor, which selects and changes elements in `index.html`, so keep the markup in the file (one element per line) rather than in a script bundle. When the page comes from an app, run that page from a copy of the app, open the real route in a browser and save what it rendered: the document's markup without the module scripts, the stylesheets it loaded and the fonts and images they use. A design served at `/designs/<id>/` resolves relative URLs inside its folder, and root-relative ones (`/assets/logo.svg`) inside the design that requested them. When the user edits it, Impeccable's events carry `pageUrl` `/designs/<id>/`: its file is `designs/<id>/index.html` in the working area (pass `--file designs/<id>/index.html` to `live-wrap`).

The working area is private to this computer. Never copy paid Congo source anywhere public.

## `send`: Library items with notes

The user selected apps and screens in the Library and pressed Send. `items` lists each with its catalog identity (`kind`: `template` for a whole app, or `screen`; `id`; `version`; `app`), `title`, `route` and the user's `note` for it; `request` is the note for the whole request; `app` is the app it is for (null: a new app).

1. **Decide whole app or screens** from the items and notes:
   - a whole app selected, or a new product: start from the whole app (the selected one, else the app the selected screens come from, else the closest template);
   - screens for the user's existing app: just those screens, matched to that app's styles;
   - screens from several apps: start from the app that fits the product best and fit the others into it, in its tokens;
   - nothing selected: search the Library for the closest app or screens.
2. **Get the source** into `workspace.sources`: a whole app with `congo create`, a screen with `congo add` (into the whole-app source when it joins one, or into a scratch project from `congo init --new`). When `congo add` refuses a screen because its pinned dependencies conflict with the app's, read it from a scratch project and rebuild it in the app's own code, keeping its notices. A screen that is not installable on its own (its search result's `next` does not start with `add`) comes with its whole app: take it from that app's source. If `congo whoami` shows the user is not signed in or not subscribed, tell them here to run `congo login` themselves or subscribe, and reply `error "Needs Congo sign-in and a subscription"`.
3. **Adapt** it to the user's product and each item's note: names, content, sample data, navigation labels, routes and the obvious actions. Keep the app's design, behavior and required notices. For the user's existing app, match its styles.
4. **Make one prototype** as described under Prototypes, with `source` and `sources` in `design.json`. Reply with one line saying what you built and from which items.

## `library`: one Library item

Use this or a quick action on a Library card. `item` is the app or screen; `action` is set for a quick action. Handle it like `send` with that one item, then apply the action (as in `tweak`) to the adapted result.

## `compose`: a request typed in Prototypes, or sent from your chat

Make one prototype for the user's words, as running code (several only when asked).

- **Something new** (a new app, a new screen): start from the closest Congo app or screens, as in `send`.
- **A redesign of the user's app** (`app.path`): read the real page's source and build the redesigned page from a copy of the app. When the user asked for several directions, read Impeccable's `live.md` section "Plan three variants" for the identity lock and give each direction a different primary axis. A narrow request stays narrow: change that part and keep the rest of the page.

## `tweak`: a quick action on a prototype

Makes a **new** prototype; the original stays. `design.dir` is the original (`design.sourceDir` its source when it is a whole app). Copy it and change the copy.

| `action.key` | What to do |
| --- | --- |
| `subtle` | One variation within the same identity: Impeccable `live.md` default mode, one different primary axis. |
| `layout`, `colorize`, `bolder`, `quieter` | Read `action.reference` (Impeccable's command reference) and apply that command. |
| `distill`, `typeset`, `animate`, `delight`, `overdrive`, `polish`, `clarify`, `adapt`, `harden` | Same: read the command reference and apply it. |
| `critique`, `audit` | Run the command; write its report into `design.json` `summary` (short) and a `report.md` beside it; the copy may stay unchanged. |
| `custom` | Apply the user's words in `action.brief`. |
| `editable` | The page is a script bundle. Render it and save it as a static page (see Prototypes) that looks the same; change nothing else. |

Title it `<original title> · <action label>` and say what changed in `summary`.

## `build`: Use this

The only request that changes the user's code. `design` is the prototype (`design.sourceDir` its source for a whole app).

- **The user's existing app** (`app.path`): put the prototype into the project. Install the Congo screens it uses with `congo add` (so receipts and notices are kept), carry over the adaptation from the prototype's source, and integrate it into the existing routes, navigation and styles. Keep product behavior, data bindings, forms and actions working and the user's unrelated edits intact. For a whole-app direction, carry it through the affected screens and shared components; a narrow change stays narrow. Run the project's checks and open the real routes.
- **A new app** (no `app.path`): use the folder the user named; otherwise create a new folder named after the product in your current folder and say where it is. Run `congo create <template-id> --project <new folder>` for the app the prototype starts from (`source` in its `design.json`), then carry the prototype's changes over: apply the source's diff since its `congo source` commit (`git diff <first commit>` in `design.sourceDir`, then `git apply` in the new folder), or copy the changed files. Add any other screens it uses with `congo add`. Name the project after the product (`package.json` `name`, the page title). Install its dependencies and build once, then attach it with `node .veto/skills/congo/scripts/workspace.mjs connect --project <new folder>`.

Reply with one line (where it went, and that it can be started in My app), and the details here.

## Live editing a prototype

A `live-edit` request with a `design` whose `sourceDir` is set: the user pressed Edit on a whole-app prototype. Install the source's dependencies if they are missing, start its dev server on a free local port and keep it running, run Impeccable's live boot in `sourceDir` with `--allow-missing-context` (a prototype has no PRODUCT.md or DESIGN.md; never start an interview for one), following its `live.md`, and `live-setup.md` on first use (a Vite single-page app injects into `index.html`), and reply `steer_done` with the dev server's local URL. On Windows never pipe `impeccable live` output into another command (the helper keeps the pipe open and the command hangs); redirect it to a file. Then poll that folder's helper, and handle the user's picks there as `live.md` says; accepted changes go into the prototype's source. When the user stops editing, a `rebuild` request follows: build the source again and copy `dist` into `design.dir`, keeping `design.json`, then reply and poll the working area again.

A `live-edit` request without a `design` is for the user's own app in My app: its steer message says what to do. So do `start-app` and `switch-to-area`.
