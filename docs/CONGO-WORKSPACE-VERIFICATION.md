# Congo Workspace: verification against the November 12 spec

Branch `codex/library-first-20261111` (workspace PR #1), checked on Windows 11 on November 12, 2026, against `docs/CONGO-LOCAL-WORKSPACE-SPEC.md` on Congo main (PR #35, 4a1d79936): the local workspace, sections 0 to 9, acceptance in section 12.

Everything ran in scratch folders: a scratch workspace home (`CONGO_WORKSPACE_HOME`), a scratch Congo-files folder (`CONGO_FILES_DIR`) standing in for `Documents\Congo`, and scratch projects. The owner's real workspace install and real Documents were not used, with one exception recorded under Problems.

## Changes after the timed runs (owner, November 12)

- **No chat in the local workspace.** The Prototypes conversation rail, its replies and its request box are switched off locally (`WORKSPACE_CHAT` in `workspace/ui/src/App.tsx`; the code stays for the hosted workspace, where Congo AI answers). Prototypes shows only cards. Explore keeps its bar: what is typed or selected there goes to the person's AI, and the skill has the AI say in its own chat what arrived. A failed request still shows its reason on the card. Checked in a browser with stand-in prototypes at 390 and 1440 px, light and dark (`workspace/qa/no-chat-rail/`); not re-run with an AI.
- **The request above its prototypes.** In place of the rail, each request's prototypes sit under what was asked (up to two lines) and one quiet line with the AI's reply; a later request in the same thread shows as "Sent to your AI: ..." until it is answered. Nothing can be typed there. Checked in a browser with a stand-in prototype and a reply typed by the build session, at 390 and 1440 px, light and dark (`workspace/qa/no-chat-rail/`); not re-run with an AI.
- **Live editor colorway.** Impeccable's gold and teal became a black bar with one light blue accent (`workspace/qa/editor-colors/`).

The timings and results below were measured before these changes; none of them changes how requests reach the AI.

## Who did what

| Part | Done by |
| --- | --- |
| Clicking in the workspace (select, notes, Send, open, Expand, quick action, Edit, picks, Accept, Pull into a project) | Scripted browser clicks (Playwright driving installed Chrome), acting as the person: `workspace/qa/send-flow.mjs`, `prototype-act.mjs`, `prototype-edit.mjs` |
| Every request the workspace sent, and `/congo-compete` | **A real AI:** fresh Claude (Opus 5.5) helpers started from the build session, given only the built skill files, the owner's words and the scratch environment details. Two helpers were used: one on the first version of the skill, one on the updated skill. |
| A separate Claude Code session, Codex or Cursor | **Not run.** Claude Code's headless sign-in on this machine is expired, and the other agents are not installed. The owner's own Claude Code run is still to do. |
| Website workspace, hosted Congo files, Congo AI, schedules | **Not built** (spec section 10: local first). |

## Timings (real AI)

**Run A, first version of the skill ("always main screen first").** Explore: the real-estate CRM app selected whole, plus a calls screen from another app, with notes, and "An outbound calling platform for realtors calling expired listings. Add a listing date column." First use of the app, so it was downloaded and installed.

| Step | Time |
| --- | --- |
| Send → card appears (skeleton) | 0.3 s |
| Send → clickable main screen | 18 min 24 s |
| Expand → the whole app built out | 9 min 19 s |
| Pull into a new project → done (installed, built) | 2 min 3 s |
| `npm run dev` in the pulled project → running | 2.2 s |

The helper's own log: 87 s installing the app, about 8.5 min reading code in both apps before writing anything, 1.5 min lost to a failed first write, about 5 min writing. Too slow to demo, and it led to the skill changes below.

**Run B, updated skill** (the request decides how much to build; prefer a main screen when it is open; start from the source map). Prototypes: "Give me a few ideas for software I could sell to realtors", nothing selected.

| Step | Time |
| --- | --- |
| Send → card appears (skeleton) | 0.3 s |
| Send → first clickable idea | 3 min 52 s |
| Send → three ideas clickable, side by side | 6 min 40 s |
| Send → reply | 7 min 31 s |
| Expand one idea → the whole app built out | 10 min 51 s |
| Quick action (Quieter) on a full app → new prototype | 2 min 11 s |
| Pull into an existing project → done | 2 min 37 s |
| Edit a full-app prototype → editor on | 2 min 22 s |
| Go → three variants | about 1 min |
| Stop editing → preview rebuilt | 1 min 36 s |

Each idea was a different real app with its main screen adapted and a brief.

**Mechanical steps (no AI), measured directly:**

| Step | Time |
| --- | --- |
| First use of an app: download and install | 27 s (87 s during run A, on a slower connection) |
| Second prototype on the same app (reuse) | 3.3 to 6.2 s |
| Preview build | 14 to 16 s |
| Workspace start, fresh and warm | 0.6 to 0.7 s |

Nothing is installed up front: an app is installed the first time a prototype uses it, and that copy is reused.

## Section 12 results

### 1. Explore

- Apps / Screens / Saved switcher, search, app galleries, screenshots: working (screenshots in `workspace/qa/discovery-after/`).
- Multi-select with a note per item and a request note: working; the tray survives reloads and restarts.
- Hover actions: Select, Prototype this, the quick actions and Preview are on every card. Send (run A) was exercised with the real AI. Prototype this and quick actions on Explore cards use the same request path and are covered by automated tests, not by the AI runs.
- **Preview opens in a browser tab, not inside the workspace.** Congo's preview host only allows Congo's own sites to embed previews (`frame-ancestors`), so a local workspace gets a blank frame. Showing it inside the workspace needs that server setting changed; that is the owner's decision.
- Saved: `congo saved` (Congo PR #36, unreleased) was verified on November 11 (0 Saved apps on the account). With the installed CLI 0.2.6 the Saved view says to update the CLI.
- Free preview / paid source: browsing needs no sign-in. During this work the CLI sign-in expired; the workspace kept browsing, and source pulls stopped with Congo's own message ("Your sign-in expired or was revoked. Run `congo login` again."). The no-subscription path could not be tested with this account.
- Provenance: request files carry each item's catalog id and version; prototypes record `base`, `source` and `sources` with versions; the pulled project kept its Congo receipt and notice files.

### 2. Making prototypes

- From Explore (run A), from the request box (run B), from a helper skill (`/congo-compete`, below): exercised with the real AI.
- From the AI's chat with the workspace closed: the commands (`workspace.mjs new`, `prepare`, `preview`) were run directly and land prototypes in Congo files; not exercised by an AI in chat-only mode in this round.
- From a schedule: not part of the local version (spec section 5).
- One by default (run A), several on request (run B, three side by side).
- Briefs: every product-idea prototype in both runs carried one. Quick-action prototypes kept the original's.

### 3. Prototypes

- **The card appears right away:** 0.3 s after Send, as the clone's existing skeleton card, with no label (owner's instruction).
- **Desktop preview:** an opened prototype's frame was 1388 px wide on a 1440 px screen (everything but the 52 px rail), with the side panel closed (the local workspace now has no side panel at all).
- **Brief:** behind the "i" icon on the card and in the open view, closed by default.
- **Main screen first, Expand builds the rest:** run A and run B. Expand works in the same prototype and ends with status ready.
- **Full app clickable end to end:** yes; whole-app prototypes run at their own local address with their own routes.
- **Live editing on a full bundled app:** works, by running the prototype's source on its dev server with Impeccable's editor (the editor cannot pick inside the built bundle itself). Picked an element, got three variants, accepted one into the prototype's source, stopped, and the preview was rebuilt. If the editor cannot run, the open view says so and takes a description for the AI instead (covered by code and tests, not triggered).
- **Quick actions make new prototypes and keep the originals:** Quieter on a full app, in the same Congo file.
- **Rename and delete:** automated tests; deleting a prototype that is still being made now also closes its request.
- **Survive a restart:** yes, across several workspace restarts.

### 4. Congo files

- **Outside any code project:** each request thread gets a folder ending in `.congo` (named from the person's note, kept short) in the Congo-files folder; each prototype is a folder inside with `prototype.json`, `preview/`, `source/` and `history.jsonl`.
- **Listed and opened by the AI:** `workspace.mjs files` lists every Congo file with its prototypes and folders; they are plain folders an AI can read and change.
- **Backed up and moved:** a Congo file with two full-app prototypes was renamed while the workspace ran; both followed, still ran (including a deep route), and nothing inside points at the old location. Dependencies are a link to the prepared app copy, not stored in the file (seven prototypes: 37 MB). When that link is missing, as after moving to another computer or restoring a backup, the next preview build links it again (tested by removing the link).
- **Default location:** `Documents\Congo` (the Windows Documents folder, which on this machine is inside OneDrive). Not written to in these tests, at the owner's request.
- **Hosted copies:** not built.

### 5. Pull into a project

- **A new project:** the AI ran `congo create`, applied the prototype's changes, named the project after the product, installed and built it; it started in 2.2 s.
- **An existing project:** the Quieter prototype was pulled into that project by pasting its folder. `git status` showed 41 changed files, all under the project's `src` (the styling runs through every screen), 476 lines replaced by 476, nothing outside `src`, nothing committed.
- Asking to pull changes nothing by itself; only the AI's work after it does (automated test).
- The narrow-change case (one page and one nav link) was verified with a real AI on November 11 and uses the same request.

### 6. Speed

See Timings. Request to a clickable main screen: 3 min 52 s for an open request with the updated skill; 18 min 24 s for a whole app plus a second app's screen under the first version of the skill. The whole-app request was not re-timed on the updated skill.

### 7. Helper skills

- `/congo-compete`: see "Compete" below.
- `/congo-ideas`: not run as its own skill. Run B covers the same ground through `/congo` (ideas, three prototypes with briefs); the skill's own text is covered by tests only.

### 8. Congo AI

Not built.

### 9. Preserved behavior

- No changes under `crates/`. Impeccable's commands, live editing, acceptance and recovery are unchanged and were used as they are.
- The website's storefront is untouched (nothing in the Congo repository changed).

### 10. Installation and startup

- The built skills (`congo`, `congo-compete`, `congo-ideas`, `impeccable`) copied into a fresh folder worked as installed; the workspace and both AI helpers ran from that copy.
- Exercised: Claude helpers on Windows, with Vite + React Congo templates. Not exercised: the owner's own Claude Code session, Codex, Cursor, macOS, Linux.

## Compete

The second helper AI was sent, as a chat message, `/congo-compete Calendly, for dog groomers`, with the skill installed beside `/congo`.

- It researched with three web searches (about two minutes), chose one angle, and made **Groomslot**: a booking tool where the dog's breed and coat set the slot length and price, with deposits and vaccine notes, on the week view of a calendar from a Library app. Start to reply: 3 min 49 s; the preview was built 3 min 6 s in.
- The prototype went in through `workspace.mjs request`, so its card appeared at once, in its own Congo file.
- The brief names what was checked (Calendly's payment pages, a review page, grooming-software vendor pages) and what was not (whether Calendly can vary length or price from a booking question; what groomers use today), and says dedicated grooming tools already exist.
- Its own caveats: only the calendar's week view is adapted; the prototype was not opened in a browser by the AI.

## Problems found and fixed

- **Speed** (above): the skill no longer says "always main screen first". The user's request decides how much is built; for open requests the skill prefers one main screen, as advice, and `prepare` prints a short map of the app so the AI opens the right files first. The workspace itself does not label or limit requests.
- **The baseline snapshot failed silently on a long path.** A long Congo file name pushed paths past the Windows limit, so the "congo source" commit that Pull into a project diffs against was never made (the AI noticed and repaired it). Fixed: Congo files are named from the note and kept to 48 characters, long paths are enabled for that repository, and a failure now stops `prepare` with a message.
- **Preview builds failed for folder names with a space.** Fixed (no shell).
- **A dropped connection during the app download failed the request.** `prepare` now retries once.
- **A request that was sent while the AI was down stayed queued** and was answered later alongside the retry, which is why run B has six ideas. Deleting a prototype now closes its request.
- **Tests wrote into the real Documents folder once.** The first test run of the new storage created three test folders in the owner's `Documents\Congo`; they were removed, and the tests now always use a temporary folder.
- The network dropped several times during the day; one AI helper was lost to it before doing any work and was restarted.

## Known limits

- Prototypes made from the same app can share saved demo state in the browser when their local addresses are reused across restarts.
- In a prototype with status main, every screen but the adapted one is still the source app's, by design; Expand adapts the rest, and deep settings pages can keep generic wording afterwards.
- The briefs on quick ideas are the AI's reasoning, marked as not researched; `/congo-compete` briefs name their sources.
- The AI helpers did not open every prototype in a browser themselves. The scripted checks opened the ones timed here.

## Tests

- Workspace and Congo skill tests: 49 of 49 pass (`tests/workspace-requests.test.mjs`, `workspace-server`, `workspace-catalog`, `workspace-devserver`, `congo-skill`, `congo-reference`). The interface type-checks and builds; `bun run build:release` passes every validator.
- The rest of the default suite was last run on November 11 with Windows-only failures in files this work does not touch (Unix execute bits, `sh` not on PATH, line-ending comparisons, engine lease timing, oracle paths). Not re-run in full today.
- Not run: `test:skill-behavior`, `test:skill-activation` (no provider keys), `test:live-e2e`.

## Not built

- Website workspace, hosted Congo files, Congo AI, schedules (spec section 10).
- Projects and My app stay hidden, with their code kept.
