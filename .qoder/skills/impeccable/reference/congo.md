# Congo library

Congo is a library of real app screens, full editable app templates and design handbooks, each with working React source ([buildwithcongo.com](https://buildwithcongo.com)). This fork of Impeccable makes it available to every command. It is not a step or a mode: reach for it when real, working source would make the task in hand better, and leave it alone when it would not. Everything else in this skill still applies; DESIGN.md, PRODUCT.md and the brief outrank anything Congo returns.

## Is Congo available

Check once per session, the first time Congo would help: `node --version` and `congo --version`.

- **Node older than 22.20:** tell the user in one plain sentence ("Congo needs Node 22.20 or later and this machine has 20.11, so I'm continuing without it.") and carry on without Congo.
- **No `congo` command, no network, or any other failure:** one sentence, then carry on exactly as Impeccable always does. Never install the CLI unasked; mention once that `npm install --global @buildwithcongo/cli` adds it.
- **Congo's MCP server connected** (tools named `congo_screens_search`, `congo_resources_search`, `congo_resources_get`, `congo_resources_files`, `congo_resources_read`, `congo_handbooks_list`, `congo_handbook_read`): use those in place of the CLI commands below, with the same rules.
- **Windows and Git Bash:** commands that use the saved sign-in (`add`, `create`, `update`, `handbooks`) work in Git Bash from Congo CLI 0.2.4. Older versions stop there with "Cannot secure saved sign-in permissions for this Windows account." because Git Bash puts its own `whoami.exe` first on PATH. If `congo --version` is older than 0.2.4, suggest `npm install --global @buildwithcongo/cli@latest`, or run those commands from PowerShell or cmd.

## Commands

Piped output is JSON; pass `--json` anyway. Search works anywhere without signing in.

- `congo search --kind screen --query "<words>" --json` finds screens. Filter with `--category <id>` (ids from `congo categories --json`, such as `billing` or `settings-preferences`) and `--source <app-id>`; page with `--limit` and `--offset`. Each item has `id`, `title`, `app.name`, `route`, `screenCategories`, `screenshot.src` (a 1440 x 900 PNG), `preview` (the live screen), `url` (its Congo page) and `next`. Only an item whose `next` starts with `add` installs on its own. An item marked "Not yet installable on its own" is preview only: never run `add` on its id, because that delivers the whole app instead of the screen.
- `congo templates --json` lists full editable apps. Start one in an empty folder with `congo create <id> --project <folder>`; `add` refuses templates.
- `congo handbooks --json` lists Congo's published design handbooks and the user's own. `congo search --kind handbook --query "<words>" --json` finds one by subject. A published handbook installs like a screen (below) as one Markdown file per section; `congo handbook <hb_id>` prints one of the user's own.
- `congo login` signs the user in through their own browser, where they approve Congo CLI. Offer it when a command says sign-in is required, and let the user finish it.
- `congo init` connects an existing React/Vite project (run it at the project root; it writes `congo.json` and `CONGO.md`). Then `congo add <id> --destination <path>` copies verified source into that project-relative path, adds the package's pinned dependencies to `package.json`, and writes the receipt `.congo/<id>.json`. Install the new dependencies with the project's own package manager. `congo update <id>` later brings a newer version and keeps local edits.
- To read a screen without installing it into the project (a piece for a variant, an edit or a comparison), install it into a scratch folder outside the project: `congo init --new --project <scratch>`, then `congo add <id> --destination congo --project <scratch>`. Delete the scratch folder when you are done. Use the same route for a project that is not React/Vite, which `init` refuses.

A screen package holds `<app>/screens/<id>.tsx` (the entry: import its default export and render `<Screen />`), `<app>/guides/<id>.md` (read it first: routes, `initialPath`, `onNavigate`, styles), `<app>/styles.css` scoped to the receipt's `styleScope`, the source under `<app>/source/`, and its license and notice files.

When a command fails, show its message as written and act on it:

- "Sign in required. Run `congo login`.": offer `congo login`.
- "Source needs an active Congo subscription ($30/month): https://buildwithcongo.com/pricing": show it verbatim. Screenshots and previews stay usable as references; build without the source.
- Terms or phone verification: show the link; the user completes it on the website, then you retry.

## Where Congo helps

**Planning a new surface.** In shape, new-work, or any request for a screen an app would have (settings, billing, contacts, inbox, dashboard, onboarding), search Congo for that surface and open two to four screenshots or previews. They show how working products structure the task: what sits together, which states exist, how dense it runs. Bring that into the questions you ask and the structures you derive. It is evidence, not a direction.

**Starting from a real screen or template.** When the user wants a surface Congo has, starting from installed source saves rebuilding a working page. When they are starting a whole app from an empty folder, a template is the bigger head start. Offer either; install only on the user's choice.

**The decision page.** For a whole new surface (new-work's "Create a whole surface inside an established world"), when the search returns at least two installable screens that do the same job, put them in front of the user before the roll. Open every candidate's screenshot first: a title that matches with a different job is not a match. Choose up to three from different apps, then write a payload under `.impeccable/questions/` (that folder ignores itself in git):

```json
{
  "title": "Start from a real billing screen?",
  "question": "Congo has working billing pages from real apps. Pick one to install and adapt to this design, or design it from scratch.",
  "options": [
    { "id": "congo:<id>", "kicker": "CONGO · <APP>", "label": "<title>", "lineage": "<App>, <route>", "thesis": "<one sentence: why this one fits the task>", "hero": "<screenshot.src>" },
    { "id": "scratch", "label": "Design it from scratch", "thesis": "Impeccable's usual flow for a new surface, built in this design." }
  ]
}
```

No `buildPath`, `kind`, `reroll` or `canon`: this round is not a roll, so it never touches the roll, its telemetry, or the comp lifecycle. Serve it with `.qoder/skills/impeccable/scripts/impeccable serve-question --start --payload <file>` and follow what it prints (open the URL, then `--wait --key <key>`). The page labels each screenshot as inspiration; that is its own label. An answer of `congo:<id>` means install that screen and adapt it (below); the CHOSEN CARD line's hero is its screenshot, your reference for what you are installing. `scratch` returns you to new-work unchanged, concept-seed included. A page closed unanswered, or a harness without the page, takes the structured question tool with the same options; with no answer there either, continue with `scratch`. Skip this round for a narrow request, an addition to an existing surface, or when no strong match exists.

**Live-mode alternatives.** One of the three variants may rebuild a piece of a Congo screen (a plan picker, a usage meter, a filter bar) as its primary axis. Read the piece from a scratch install, then write it inline in the variant format live.md requires, in this project's tokens, under the identity lock. Name the source app in your notes, never in the variant.

**Direct edits.** When the user asks for an element a Congo screen already does well, take that piece from a scratch install and rebuild it in the project's code and tokens rather than writing it from nothing.

**Critique and audit.** When a finding would land harder with a working counterpart, cite how a real Congo screen handles the same job, with its app and screen name. Scores and priorities stay Impeccable's own.

**Documenting.** When document or extract runs on a project with Congo packages (`.congo/*.json`), describe the adapted tokens the project actually uses, not the source app's originals, and note which screens came from Congo so later work can run `congo update`.

**Design handbooks.** Before planning in a category Congo has a handbook for, install it into a scratch folder and read the sections that bear on the task. Take the guidance into your decisions; do not copy its text into the project.

## After installing

An installed screen is now this project's code, in another product's world. For a whole new surface, first record new-work's direction contract in the surface brief; no roll ran, so its FORM line names the picked screen as `congo: <id>@<version>` in place of a seed reference. Then adapt it before calling it done:

1. Read the guide, the entry and the receipt. Mount the screen on the route the user asked for, install its dependencies, and build once as delivered, so later failures are yours to trace. Package source imports files with their `.ts` and `.tsx` extensions; a TypeScript project needs `allowImportingTsExtensions` (with `noEmit`) in its tsconfig.
2. Make it this product. Map colors, type, radii, spacing and shadows to DESIGN.md's tokens, editing the package's `styles.css` and source in place. Replace the source app's name, logo, navigation and sample content with this product's truth from PRODUCT.md. Keep the structure, states and interactions that serve the task, and remove what this product has no use for. When the project already has its own app frame, keep that frame and mount the screen's page content inside it; never ship two navigations. The entry may set classes or theme attributes on `<html>` and `<body>`; make sure they do not fight the project's own. The package's stylesheet brings its own breakpoints and offsets (a table that turns into cards on phones, a margin meant for its old settings layout); check each one inside the project's frame.
3. Run Impeccable's normal passes as for any build: read craft-floor before the edits, then detect, inspect at the shipped sizes, and run the finish review. Report what came from Congo and what changed.

## Rules

- Browsing, search, screenshots and previews are free. Source needs the user's Congo subscription; without one, show Congo's own message and never imply the source is free.
- Never ask for, print, read or store the user's Congo sign-in, tokens, or `CONGO_LIBRARY_TOKEN`, and never open the sign-in files. Signing in is the user's step in their own browser.
- Keep every license and notice file a package installs (`LICENSE.md`, `SOURCE-PROVENANCE.md`, `ASSET-NOTICES.md`, `notices/` and the like), and carry the matching notice with any piece you copy elsewhere. Never present the result as the reference app's official product.
- Never write Congo source into `.impeccable/`, Impeccable's caches, or any public place; it lives only where the user installed it.
- Install only what the user chose. Searching, opening screenshots and showing options need no permission; adding source to their project does.
- Without Congo, Impeccable works exactly as before. Never block, retry in a loop, or keep reminding the user about it.
