# Congo workspace V1: build plan

Source of truth: `docs/CONGO-LOCAL-WORKSPACE-SPEC.md` and `-TODO.md` (Congo repo, branch `codex/congo-workspace-spec-20261111`). Rule: nothing here changes Impeccable's engine (`crates/`) or how its commands, live editor and handoff behave. The workspace calls them.

## The handoff (traced and smoke-tested on engine 0.1.18, unmodified)

| Step | Who | Existing mechanism |
| --- | --- | --- |
| Boot a live helper on the workspace's working area | workspace server | `impeccable live --allow-missing-context` (cwd = working area), with `.impeccable/live/config.json` = `{"files":["designs/**/*.html"],"insertBefore":"</body>","commentSyntax":"html","cspChecked":true}`. Spawn with output to a file: on Windows a piped parent keeps the detached helper's handles and never returns. |
| Send an action | workspace server | `POST http://127.0.0.1:<port>/events` `{token, id:<8 hex>, type:"steer", message:<=4000 chars, pageUrl?}`; long details live in `requests/<id>.json` |
| Pick it up | the user's AI | `impeccable live-poll` (its usual loop; Claude Code in the background, Codex in a foreground session) returns the steer with `_instructions` |
| Answer | the user's AI | writes designs to the folder the request names, then `impeccable live-poll --reply <id> steer_done --file <path>` or `"message"` |
| See the answer | workspace server | `GET /events?token=` SSE carries `steer_done` / `error` and `agent_polling`; `GET /status?token=` has `agentPolling` |
| Edit a design or the live app | user + AI | Impeccable's own injected `live.js`: select, Go, variants, accept, discard, recovery (`live.md`), unchanged |

## Spec item to files

| Spec item | Files (all new unless marked) |
| --- | --- |
| Shell: Variant layout, Congo identity, rail Compose / Library / Projects / Live App, neutral light theme | `workspace/ui/` (React 19 + Vite, copied from `library/Variant/site` in the Congo repo), built to `skills/redesign/scripts/workspace/ui/` |
| Local server, state, two loopback ports (UI/API and design content), working area | `workspace/server/*.mjs`, data in `%LOCALAPPDATA%\Congo\workspace` or `~/.local/share/congo/workspace` |
| `congo workspace` | Congo repo `scripts/congo-workspace.mjs` (modified) finds `skills/redesign/scripts/workspace.mjs` and runs it with Node |
| Library: Apps / Screens, previews | `workspace/ui/src/views/Library.tsx`; server proxy for `buildwithcongo.com/api/catalog` and `/api/screens` |
| Compose: composer to AI, cards of running code, hover actions | `workspace/ui/src/views/Compose.tsx`, `DesignCard.tsx` (modified copy); `workspace/server/actions.mjs` builds request files and steers |
| Hover action to Impeccable command | Subtle variant: identity-preserving variation (`live.md` default mode); Change layout: `layout`; Recolor: `colorize`; Bolder: `bolder`; Quieter: `quieter`; More: `distill typeset animate delight overdrive polish clarify adapt harden critique audit`; Build this: apply to the user's project |
| Library Use this / tweaks | steer asks the AI to fetch source with the Congo CLI or MCP into `sources/<id>/` (the user signs in; no secrets pass through the workspace) and adapt it into `designs/<id>/`, outside the user's project |
| Projects | `workspace/ui/src/views/Projects.tsx` (modified copy), `state.json` |
| Edit and Live App | design pages get Impeccable's script via `impeccable live-inject`; Live App runs the project's `dev` script on Start, or asks the AI to start it, and asks the AI to run `impeccable live` there for Edit |
| Redesign skill | `skills/redesign/SKILL.src.md`, `reference/workspace.md`, `scripts/workspace.mjs` |
| Cloud saving | plan only; needs Congo server work and the owner's OK |

## Design contract

A design is a folder in the working area: `designs/<id>/index.html` (static, relative assets, may be a build output) or `design.json` with a loopback `url`, plus `design.json` metadata (`title`, `request`, `parent`, `action`, `source {kind,id,version}`, notices). The server watches `designs/` so cards appear as files land.

## Known V1 limits

- One AI poll at a time. Steers go to whichever helper the AI is polling; switching between a design and the live app is a steer that asks the AI to move its poll.
- Impeccable's in-page live bar keeps its own look inside the workspace's frames.
- Designs must build to a static entry or run on a loopback URL.
- Support for an agent is claimed only after it was exercised with that agent.
