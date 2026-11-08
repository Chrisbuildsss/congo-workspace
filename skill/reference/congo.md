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

### New products and whole surfaces: real apps first

For a new product, a new or replaced visual world, or a whole new surface, Congo's apps are the starting point, before any direction roll. Real, finished apps adapted to the user's product beat invented directions: the user sees their product built on a layout that already works. Run this round whenever Congo has at least two apps that do a similar job; run concept-seed only when the user answers `scratch`, Congo is unavailable, or nothing in Congo fits.

1. **Pick the three closest apps, not screens.** `congo templates --json` lists every app with its description, tags and categories. Match on what the product does (its job, its users, its core objects and workflows), never on words in screen titles. Open a candidate's screens with `congo search --kind screen --source <app-id> --json` before you decide. Look for apps built around the same core job, apps from the same industry, and apps that already have the product's key feature, and choose from whatever the list holds today. Take three different apps; two when only two fit.
2. **Say what you are about to do, in one line:** the three apps and why each fits, and that you will install each app's main screen into a scratch folder to adapt it, which uses the user's Congo subscription. Their harness's approval of the install commands is their yes. If they decline, or have no subscription, build the round from the apps' screenshots and previews instead and say so.
3. **Take each app's main screen:** its primary working screen (the home, dashboard, inbox or main editor the product lives in), never settings or billing unless that is the request. It must be installable on its own (its `next` starts with `add`). Install each into its own scratch project: `congo init --new --project <scratch>/<app>`, then `congo add <id> --destination congo --project <scratch>/<app>`, and run it.
4. **Adapt each one to the user's product, keeping the app's design.** Put in the product's name, its domain's content and sample data (for the calling platform: leads, campaigns, calls, transcripts), relabel the navigation for its workflows, and point the obvious actions at its jobs. Keep the app's layout, components, density and visual quality; this round shows the product on each app, so do not redesign, restyle or invent new UI here. Change colors or type only where PRODUCT.md or the brief already fixes them.
5. **Show the three adapted screens.** Capture each running adaptation at desktop width into `.impeccable/questions/congo/<app>.png` (that folder ignores itself in git), and note each local preview URL so the user can click through the real thing. Then serve the decision page with this payload, written under `.impeccable/questions/`:

```json
{
  "title": "Pick the app to build on",
  "question": "Your product, adapted onto three real apps from Congo. Pick one to build on, or design from scratch.",
  "options": [
    { "id": "congo:<screen-id>", "kicker": "CONGO · <APP>", "label": "<Product> on <App>", "lineage": "<App>, <route>", "thesis": "<one sentence: why this app fits the product>", "body": "Live preview: <local URL>", "hero": ".impeccable/questions/congo/<app>.png" },
    { "id": "scratch", "label": "Design it from scratch", "thesis": "Impeccable's usual direction roll, with no Congo app underneath." }
  ]
}
```

No `buildPath`, `kind`, `reroll` or `canon`: this round is not a roll, so it never touches the roll, its telemetry, or the comp lifecycle. Serve it with `{{scripts_path}}/impeccable serve-question --start --payload <file>` and follow what it prints (open the URL, then `--wait --key <key>`). The page labels each image as inspiration; that is its own label. A page closed unanswered, or a harness without the page, takes the structured question tool with the same options; with no answer there either, continue with the first card. `scratch` returns you to new-work unchanged, concept-seed included. A steer that asks for another app runs steps 1 to 5 again with that app.
6. **Build on the pick.** An answer of `congo:<screen-id>` means build the product on that app. For a new product, pull in the whole app (`congo create <template-id> --project <folder>`, or `congo add` for each screen the product needs inside an existing project), carry over the adaptation the user approved, and follow **After installing**. Delete the scratch folders when you are done.

Skip this round for a narrow request or an addition to an existing surface; those inherit the surface they extend.

**Planning anything else.** In shape, or any request for a screen an app would have (settings, billing, contacts, inbox, dashboard, onboarding), search Congo for that screen and open two to four screenshots or previews. They show how working products structure the task: what sits together, which states exist, how dense it runs. Bring that into the questions you ask and the structures you derive.

**Live-mode alternatives.** One of the three variants may rebuild a piece of a Congo screen (a plan picker, a usage meter, a filter bar) as its primary axis. Read the piece from a scratch install, then write it inline in the variant format live.md requires, in this project's tokens, under the identity lock. Name the source app in your notes, never in the variant.

**Direct edits.** When the user asks for an element a Congo screen already does well, take that piece from a scratch install and rebuild it in the project's code and tokens rather than writing it from nothing.

**Critique and audit.** When a finding would land harder with a working counterpart, cite how a real Congo screen handles the same job, with its app and screen name. Scores and priorities stay Impeccable's own.

**Documenting.** When document or extract runs on a project with Congo packages (`.congo/*.json`), describe the adapted tokens the project actually uses, not the source app's originals, and note which screens came from Congo so later work can run `congo update`.

**Design handbooks.** Before planning in a category Congo has a handbook for, install it into a scratch folder and read the sections that bear on the task. Take the guidance into your decisions; do not copy its text into the project.

## After installing

Installed screens and apps are now this project's code, in another product's world. For a new product or whole surface, first record new-work's direction contract in the surface brief; no roll ran, so its FORM line names the picked app and screen as `congo: <id>@<version>` in place of a seed reference.

**Adapt what is there before building anything new.** Every view the product needs starts from an existing screen of the picked app: change its content, data, labels, routes and wiring, and remove what the product has no use for. When the picked app has no screen for a view, look for one in another Congo app and adapt that, in the picked app's tokens. Write a new screen only when no Congo screen can be adapted to the job, and build it from the app's own components, styles and patterns so it belongs. Custom one-off screens next to adapted ones are what make the result look generated.

Then adapt it before calling it done:

1. Read the guide, the entry and the receipt. Mount the screen on the route the user asked for, install its dependencies, and build once as delivered, so later failures are yours to trace. Package source imports files with their `.ts` and `.tsx` extensions; a TypeScript project needs `allowImportingTsExtensions` (with `noEmit`) in its tsconfig.
2. Make it this product. Map colors, type, radii, spacing and shadows to DESIGN.md's tokens, editing the package's `styles.css` and source in place. Replace the source app's name, logo, navigation and sample content with this product's truth from PRODUCT.md. Keep the structure, states and interactions that serve the task, and remove what this product has no use for. When the project already has its own app frame, keep that frame and mount the screen's page content inside it; never ship two navigations. The entry may set classes or theme attributes on `<html>` and `<body>`; make sure they do not fight the project's own. The package's stylesheet brings its own breakpoints and offsets (a table that turns into cards on phones, a margin meant for its old settings layout); check each one inside the project's frame.
3. Run Impeccable's normal passes as for any build: read craft-floor before the edits, then detect, inspect at the shipped sizes, and run the finish review. Report what came from Congo and what changed.

## Rules

- Browsing, search, screenshots and previews are free. Source needs the user's Congo subscription; without one, show Congo's own message and never imply the source is free.
- Never ask for, print, read or store the user's Congo sign-in, tokens, or `CONGO_LIBRARY_TOKEN`, and never open the sign-in files. Signing in is the user's step in their own browser.
- Keep every license and notice file a package installs (`LICENSE.md`, `SOURCE-PROVENANCE.md`, `ASSET-NOTICES.md`, `notices/` and the like), and carry the matching notice with any piece you copy elsewhere. Never present the result as the reference app's official product.
- Never write Congo source into `.impeccable/`, Impeccable's caches, or any public place; it lives only where the user installed it.
- Searching, opening screenshots and showing options need no permission. Scratch installs for the reference round are announced in one line first (step 2 above). Source goes into the user's project only for the app or screen they picked.
- Without Congo, Impeccable works exactly as before. Never block, retry in a loop, or keep reminding the user about it.
