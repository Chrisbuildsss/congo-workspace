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

Congo added a thin local host (`crates/live/src/workspace/`), separate Redesign skill (`skills/redesign/`), local installer, tests and documentation. The host embeds Impeccable's original Choices page and the running app with its original live editor. Optional question-server hooks attach the original page, report active waits, and display running previews in existing card media slots. Small CLI dispatch, provider source loader and skill routing additions preserve the existing commands. The original Choices template, live-editor scripts, session reducer, and element acceptance/discard/recovery engine are unchanged. These additions remain under Apache 2.0; catalog source is not included.
