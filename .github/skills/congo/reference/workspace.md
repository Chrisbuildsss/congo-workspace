# Congo workspace requests

The workspace sends the user's actions to you through Impeccable's live helper as `steer` events. You do the work with your normal tools and Impeccable's references, then reply on the same helper. There is no other AI and no second chat: questions go to the user in this conversation.

## Connect

1. `node .github/skills/congo/scripts/workspace.mjs connect [--project <the user's app folder>]`. It opens or reuses the workspace, starts Impeccable's live helper on the workspace's working area, and prints JSON with `area` (the working area) and `url` (show it to the user if they have not opened it).
2. Run Impeccable's poll from `area` as the working directory with the launcher `connect` printed: `<poll launcher> live-poll` (`poll.windowsLauncher` on a Windows shell without `sh`). Follow the harness policy in Impeccable's `reference/live.md`: Claude Code runs the poll as a background task, Codex holds it in a foreground session, Cursor uses a background terminal. Never pass a short `--timeout`. Poll again right after every event and every reply.
3. A steer whose message starts with `Congo workspace request <id>` is a workspace request: handle it below. Every other event (`generate`, `accept`, `discard`, `prefetch`, `exit`, ...) is Impeccable's live editor: handle it exactly as `live.md` says.

The workspace shows the user that you are connected while your poll is parked on the helper. While you work on a request it shows the request as in progress.

## Every request

- Read the request file named in the message (`requests/<id>.json` in the working area). It holds the type, the user's words, the app (`app.path` when the user has one), the design or library item, the action, and `outputs`: the folders your results go in.
- Write each result into its `outputs[i].dir` as a static page: an `index.html` that holds the page's markup, with its stylesheets, fonts and images beside it and only the scripts its interactions need (menus, tabs, dialogs); no build step left to do. Then write `design.json` with at least `{"title": "..."}` and optionally `summary` (one sentence), `format` (`desktop` or `mobile`), `source` and `notices`. Write `design.json` last: the card appears when it lands.
- Keep the markup in the file. Edit opens the design in Impeccable's live editor, which selects and changes elements in `index.html`; a single-page app bundle whose page exists only after its script runs gives it nothing to select, and the workspace offers the user Make editable instead.
- When the design starts from an existing app, build or run that page from a copy of the app, open the real route in a browser, and save what it rendered: the document's markup without the module scripts, the stylesheets it loaded copied beside it, and the fonts and images they use. Keep the app's markup and class names so its CSS still applies. A design that only works on a dev server may set `"url": "http://127.0.0.1:<port>/..."` (loopback only) and keep that server running; it shows as a card but cannot be edited.
- A design is served at `/designs/<id>/` on its own origin. Relative URLs resolve inside the design folder, and root-relative ones (`/assets/logo.svg`) resolve inside the design that requested them.
- When the user edits a design, Impeccable's events carry `pageUrl` `/designs/<id>/`: its file is `designs/<id>/index.html` in the working area (pass `--file designs/<id>/index.html` to `live-wrap`). Accepted variants change that design in place.
- Outside a `build` request, never change the user's project. Work in the working area.
- Reply exactly once: `impeccable live-poll --reply <id> steer_done "<one short line for the user>"`. On failure: `--reply <id> error "<short reason>"`. Then poll again.
- Missing context (which app, which page, what to keep) is asked in this chat. Keep the request open while you wait; reply when the work is done.

## `compose`: the live choices workflow

The user typed a request in the workspace composer. Make `outputs.length` alternatives (usually three) as running code.

1. Resolve the surface: the app (`app.path`), the page or route, and the intent, from the request and this conversation. Read the real page's source. Ask here when it is unclear.
   - **No `app.path` (a new app):** run the real-apps-first round from Impeccable's `reference/congo.md`. Pick the Congo apps closest to what the product does (`congo templates --json`, matched on the product's job, not screen titles), get each one's main screen into the working area through Congo's CLI, and adapt it to the product as one alternative per app: the product's name, content, sample data and navigation, keeping the app's own design. Title each card with the product and the app it builds on. Skip steps 2 and 3 below for these cards.
2. Identity first. In an existing app, read Impeccable's `live.md` section "Plan three variants": extract the identity lock (Phase A), choose default or departure mode (Phase B; departure only when the user asked for a redesign), give each alternative a different primary axis (Phase C) and run the squint test (Phase D). For a new surface, follow Impeccable's `new-work.md` for directions. Apply `craft-floor.md` as you write.
3. Build each alternative as the real surface: the actual page in its app frame and navigation, with the app's real content and data shapes, not a thumbnail or a section out of context. A narrow request stays narrow: change that part, keep the rest of the page as it is.
4. Title each `design.json` with the direction in a few words, and give a one-sentence `summary`.

## `tweak`: a new card from an existing design

`design.dir` is the original. Copy it to `outputs[0].dir` and change the copy; never edit the original.

| `action.key` | What to do |
| --- | --- |
| `subtle` | One variation within the same identity: Impeccable `live.md` default mode, one different primary axis. |
| `layout`, `colorize`, `bolder`, `quieter` | Read `action.reference` (Impeccable's command reference) and apply that command to this design. |
| `distill`, `typeset`, `animate`, `delight`, `overdrive`, `polish`, `clarify`, `adapt`, `harden` | Same: read the command reference and apply it. |
| `critique`, `audit` | Run the command on the design; write its report into `design.json` `summary` (short) and a `report.md` beside it; the copy may stay unchanged. |
| `custom` | Apply the user's words in `action.brief`. |
| `editable` | The design is a script bundle. Render it in a browser and save it as a static page (see Every request) that looks the same; change nothing else. |

Title it `<original title> · <action label>` and say what changed in `summary`.

## `library`: a Congo screen or template, adapted outside the project

1. Source comes only through Congo's authorized delivery: the Congo CLI (`congo search`, `congo add <item.id> --project <dir>`, `congo create <item.id> --project <dir>`; `congo --help` for the options in the installed version) or Congo's MCP server. Use `workspace.sources` from the request as the folder. Installing source needs the user's own Congo sign-in and subscription: if `congo whoami` shows they are not signed in or not subscribed, tell them in this chat to run `congo login` themselves, and reply `error "Needs Congo sign-in and a subscription"`. Never ask for, read or handle their sign-in.
2. Use the selected screen package for a screen; use the full template only when the request needs the whole app. Follow Impeccable's `congo.md` for adapting it to the user's product: content, labels, routes and relevant styling change; useful behavior, source pins and required notices stay.
3. When `action` is set (a tweak on a library item), apply it after adapting, as in `tweak`.
4. Save it as a static page in `outputs[0].dir`, rendered from the adapted copy as described in Every request. Put `source` (`kind`, `id`, `version`, `app`) and the package's notices in `design.json`.

Exploring the Library never changes the user's app.

## `build`: apply a design to the user's project

The only request that changes the user's code. Apply the design in `design.dir` to the project at `app.path`:

**No `app.path` (a new app):** create the project instead. Ask here for the folder name if the user hasn't given one (default: a new folder named after the product in the current folder). Run `congo create <template-id> --project <new folder>` for the Congo app the design was built on, then carry the approved adaptation through the whole app: adapt its existing screens (content, labels, routes, wiring) before writing new ones, as Impeccable's `congo.md` describes under "After installing". Install its dependencies and build it once. Attach it with `node .github/skills/congo/scripts/workspace.mjs connect --project <new folder>` and tell the user they can start it in Live App.

For an existing app:

- Integrate it into the existing routes, components and styles; keep product behavior, data bindings, forms and actions working; keep the user's unrelated edits.
- For a whole-app direction, carry it coherently through the affected screens and shared components. A narrow design stays narrow.
- Run the project's checks and look at the real routes. Report what changed in the reply line, and the details in this chat.
