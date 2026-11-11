# Third-Party Notices

This project includes content derived from third-party work, used under the terms of its original license.

## Platform Design Skills

The `skill/reference/ios.md` and `skill/reference/android.md` platform reference files are distilled from ehmo's `platform-design-skills` (Apple Human Interface Guidelines and Material Design 3 rules), rewritten in Impeccable's voice.

**Original work:** https://github.com/ehmo/platform-design-skills
**Original license:** MIT
**Author:** ehmo

## Congo X Impeccable

This repository is Congo X Impeccable, a fork of Impeccable (https://github.com/pbakaus/impeccable, Apache 2.0) changed by Congo (https://buildwithcongo.com) in these files: `skill/reference/congo.md` (added), `skill/SKILL.src.md`, `skill/reference/new-work.md`, `skill/reference/live.md`, `README.md`, `NOTICE.md`, `docs/images/readme-without-congo.png` (added), `docs/images/readme-with-congo.png` (added), `tests/congo-reference.test.mjs` (added), `scripts/test-suites.mjs`, and the generated skill folders built from them (`.claude/`, `.agents/`, `plugin/` and the other harness folders).

### Local workspace V1 modifications

Congo is adding a local workspace outside Impeccable's engine: the workspace app and its small local server (`workspace/`), a separate Redesign skill (`skills/redesign/`), tests and documentation (`docs/CONGO-WORKSPACE-V1-PLAN.md`), plus small build and skill-routing additions (`scripts/lib/utils.js`, `scripts/test-suites.mjs`, `skill/SKILL.src.md`, `skill/reference/congo.md`). The engine (`crates/`) is unchanged; the workspace calls Impeccable's existing commands and live editor. These additions remain under Apache 2.0; Congo catalog source is not included.
