# Congo Workspace: Library first, with Prototypes (verification)

Branch `codex/library-first-20261111`, checked on Windows 11 on November 11 and 12, 2026, against the Congo spec on `codex/workspace-prototypes-20261111` (Congo PR #35): sections 0 to 7a, acceptance in section 10.

All runs used a scratch workspace home (`CONGO_WORKSPACE_HOME` in the session scratchpad), scratch app folders, and the owner's signed-in Congo CLI 0.2.6 for source pulls. The owner's real workspace in `%LOCALAPPDATA%\Congo\workspace` was not touched.

## Who did what

| Part | Done by |
| --- | --- |
| Clicking in the workspace (select, notes, Send, Use this, Start, quick action, Edit, picks, Accept) | Scripted browser clicks (Playwright) acting as the person: `workspace/qa/send-flow.mjs`, `prototype-edit.mjs`, `card-action.mjs`, `tray-flow.mjs` |
| Every request the workspace sent (Send, Use this, Quieter, Edit, rebuild, the narrow change) | **A real AI**: a fresh Claude (Opus 5.5) helper started from the build session, given only the built skill files, the owner's words and the scratch environment details. It read the skill and did the work itself. It was cut off once by the account's 5-hour usage limit and resumed after the reset. |
| "Build me X from Congo" without the workspace | **A second, separate real AI** helper, set up the same way in an empty folder. |
| A separate Claude Code session (`claude -p`) | **Not run.** The planned headless Claude Code run stopped at once: its sign-in on this machine has expired ("OAuth session expired and could not be refreshed"). Signing in is the owner's step. |
| The owner's own Claude Code, Codex or Cursor | **Not exercised.** Support is claimed only for what ran here. |

The helper AI is real and independent of the build, but it was started by the build session rather than by the owner's own Claude Code, and it ran with the build session's model. The owner's own run may be faster or slower.

## Section 10 results

### 1. Direct opening

- `congo workspace` (installed CLI 0.2.6, scratch home) reused the running workspace and opened on the Library. Status said truthfully that no AI was connected.
- Fresh start 0.64 s; warm restart 0.62 s. The request tray and all prototypes survived restarts.

### 2. Library

- Apps / Screens / **Saved** switcher, search, app drill-in and Preview: working (screenshots in `workspace/qa/library-first-after/`).
- Multi-select with a note per item and a request note: working; the tray is kept by the workspace across reloads and restarts.
- **Saved:** `congo saved` (Congo PR #36, not released) answered through the workspace: signed in, 0 Saved apps on the owner's account, shown as "Nothing saved yet". With the installed CLI 0.2.6 the Library says "Update the Congo CLI to see your Saved items". No bookmarks were added to the account.
- Free preview / paid source: browsing needs no sign-in. With a signed-out CLI (simulated with an empty settings folder), `congo create` stopped with "Sign in required. Run `congo login`." and wrote nothing. The no-subscription path could not be tested with this account.
- Provenance: the request file carried each item's catalog id and version (`ghosted-real-estate-crm` @ `screen-index-ghosted-real-estate-crm-20261103-p2`, `quibble-communications-page-inbox-primary-calls` @ `quibble-native-screens-22af60ef84cf.f20d596dfd67`). The prototype recorded both sources with versions, and the new app kept its Congo receipt and notice files, including the Quibble notice folder.

### 3. Send, Use this and quick actions reach the AI and return prototypes

- **Send** (Ghosted whole app + Quibble "Primary · Calls" screen, notes "Start from this one: the CRM for the realtors' leads" / "Use this for the calling screen", request note "An outbound calling platform for realtors calling expired listings. Add a listing date column.", destination a new app): the AI chose to start from the Ghosted app and fit the calls screen in. The result was **Relist**, a whole running app with a call queue, a sortable Listing date column, a dialer panel, call history and a call log. Nothing was written outside the working area.
- **Quick action** (Quieter on that prototype): a new prototype beside the original; the original was unchanged.
- Library card actions (Use this and quick actions on a Library item) use the same request path; they were covered by the automated tests, not by the AI run.

### 4. Prototypes

- Clicking a card opens the prototype at full size. A whole-app prototype is served at the root of its own local address, so its own routes work end to end (checked by clicking from the dashboard to People in a built Congo template, and in Relist).
- **Live editing a whole bundled app:** the early test showed Impeccable's editor cannot pick inside the built bundle (as in v1.1.0), but it can on the app's dev server. Edit therefore asks the AI to run the prototype's source with Impeccable's editor. With the real AI: the editor was on in 2 min 0 s (on a free port, since My app already used the template's port); after Go, three variants arrived in about 1 min 50 s; Accept wrote the change into the prototype's source; stopping Edit asked the AI to rebuild the prototype (2 min 1 s after the fix below), and the card showed the edit.
- If the editor cannot run, the full-size view says so plainly and offers "Describe the change for your AI" (made as a new prototype). Covered by code and tests, not triggered in the AI run.
- Several directions side by side: the workspace shows every `<id>-N` prototype of a request in one group (automated test); not asked of the AI in this run.
- Rename and delete: automated tests (rename survives rescans; delete removes the prototype, its local address and its own source copy). Not clicked in the AI run.
- Prototypes survived restarts.

### 5. Use this

- **New app:** Use this on Relist ran `congo create` for the template, carried the prototype's changes over, installed and built it in `realtor-run/relist`, and attached it to My app. Start detected `npm run dev` and was running in 3.5 s; the app showed the Relist call queue.
- **Existing app, narrow change:** the Relist app was put under a git baseline first. Selected one screen (Quibble "Analytics", note "Add this as an Analytics page for my calls, in my app's styles"), request note "Only add the Analytics page and one nav link to it. Nothing else in my app changes.", destination the existing app.
  - After Send (9 min 39 s to a running prototype), the app had **no changes**: the prototype stayed in the workspace.
  - After Use this (3 min 20 s), `git status` in the app showed exactly: one added route line in `src/App.tsx`, one nav link in `src/shell/TopBar.tsx`, the new `src/screens/analytics/` folder and `notices/quibble-analytics/`. A narrow change stayed narrow; nothing unrelated changed.
  - The page came from a Library item that is not installable on its own, so it has a notice folder but no separate Congo receipt.

### 6. Speed (owner's realtor test)

| Step | Time |
| --- | --- |
| Send → running whole-app prototype in Prototypes | **16 min 1 s** |
| Use this → new app installed, built and attached | **5 min 3 s** |
| Start → app running in My app | 3.5 s |
| Use this → app running | **5 min 8 s** |
| Quieter quick action → new prototype | 4 min 20 s |
| Narrow change: Send → prototype; Use this → in the app | 9 min 39 s; 3 min 20 s |
| Without the workspace: "build me a feedback board for a dental office from Congo" → built app | about 40 min (see section 8) |

One prototype by default, built from real source. For comparison, v1.1.0 took about 20 minutes for three directions in the owner's test. Most of the 16 minutes was the AI adapting the source; the measurable machine steps were short (template pull 5 s, dependency install 21 s, production build 18 s in the early test).

### 7. My app

- Start works for a standard project (Relist, `npm run dev`). The first page load after start can take a few seconds while Vite compiles.
- "Ask my AI to start it" and live edits to real files in My app were verified in v1.1.0 and are unchanged in code; they were not repeated with the AI in this run.

### 8. The skill without the workspace

A second, separate helper AI got only the built skills in an empty folder and the request "/congo build me a feedback board for a dental office from Congo".

- It searched the Library itself (`congo templates`, `congo search`), chose the closest app (a support-and-feedback dashboard) and explained why, ran `congo create`, installed, adapted it into "Brightside Feedback" for a two-office dental practice (posts, votes, triage, roadmap, patients and households, dental sample data, its own logo), built it and opened the main pages at 1440 and 390 px. It kept the license, provenance and notice files.
- It did **not** open the workspace, and gave the command to see the app in My app.
- **It took about 40 minutes**, mostly because it reworked and trimmed the whole app (removing screens a dental office does not need and fixing their links) before showing anything. The skill now says to adapt the main workflow's screens first, show the result, and leave the rest until the user asks.
- Its own notes: it built the staff side of the board, not a patient-facing board page; one of its edit scripts mishandled Windows line endings and it repaired the file; it did not check dark mode.

### 9. Preserved behavior

- No changes under `crates/`. Impeccable's commands, live editing, acceptance and recovery are unchanged; the editor cycle above used them as they are.
- Test results are listed below.

### 10. Installation and startup

- The built skill copied into a fresh folder worked as installed (the workspace and the AI both ran from that copy).
- Supported agents and stacks, as exercised: a Claude helper on Windows, with a Vite + React Congo template. Codex, Cursor and the owner's own Claude Code session were not exercised.

## Problems found and fixed during the run

- **Rebuild after editing a whole-app prototype went to the wrong queue.** The workspace sent it to the working area while the AI was still on the prototype's editor queue, so the AI never saw it. Fixed: the rebuild goes to the queue the AI is polling, and the workspace follows that queue until the rebuild is answered. Re-tested with the real AI.
- **Toasts could stay on screen indefinitely** (v1.1.0 bug): the timer restarted on every poll. Fixed.
- **My app showed "Turning on…"** while a prototype was being edited. Fixed: My app only counts its own app's requests.
- **Prototype files written with a byte-order mark** (common with Windows tools) were ignored. Fixed.
- **From the helper AI's own report** (folded into the skill afterwards):
  - Impeccable's editor would not start on a prototype without PRODUCT.md and DESIGN.md; the AI used `--allow-missing-context`. The skill now says so for prototypes.
  - It once piped `impeccable live` output into another command, which hangs on Windows. The skill now warns against it.
  - It did not rename the new app's package, so My app showed "ghosted-crm-shell". The skill now asks it to name the project after the product.
  - `congo add` refused the Quibble screen into the Ghosted app: "Dependency conflict react: 19.1.1 vs 19.2.0". The AI read the screen from a scratch install and rebuilt it in the app's own code, keeping Quibble's notices and receipt in `notices/`. This is a Library packaging issue worth fixing upstream; the skill now describes the workaround.
  - After the first rebuild it could not delete the old build files (a safety check in its own tools), so unused old asset files remain in that prototype folder. Harmless; they are not loaded.
- The disk filled up during the run (0.4 GB left). The workspace stopped writing its state until space was freed. Most of the growth came from another project's build folders in the temp directory; this run's own scratch apps were about 0.5 GB.

## Tests

- Workspace and Congo skill tests: 44 of 44 pass (`tests/workspace-requests.test.mjs`, `workspace-server`, `workspace-catalog`, `workspace-devserver`, `congo-skill`, `congo-reference`). The interface type-checks and builds.
- `bun run build:release`: passes all validators (prose, skill prose, plugin manifest, counts).
- Default suite on Windows:
  - bun unit tests: 483 pass, 8 skip, 4 fail (environmental: the launcher's Unix execute bit, `sh` not on PATH, and two line-ending comparisons);
  - node core tests: 264 pass, 18 skip, 2 fail (environmental: Unix execute bits on a staged plugin, and a POSIX shell for the headless harness);
  - detector 82/82, framework fixtures 196/196 (with the cached engine 0.1.18);
  - live: timing-dependent engine lease tests fail on this machine (Windows file locks and timing);
  - oracle: fails on Windows (its recorded results use Unix paths; a temp folder was locked);
  - plugin load test: skipped (`claude` CLI not on PATH).
  None of the failing files were changed here.
- Not run: `test:skill-behavior` and `test:skill-activation` (no provider API keys on this machine), `test:live-e2e`.

## Not built (owner decisions)

- The "other takes" pop-up: dropped by the owner (spec PR #35).
- Projects: hidden, code kept for V2 cloud saving.
