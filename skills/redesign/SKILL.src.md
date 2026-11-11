---
name: redesign
description: "Prepare interactive Choices for a new screen, page redesign or coherent app redesign in the customer's existing AI conversation. Use for requests such as help redesign my contacts page, make this page look better, or show alternative invoicing screens. Ordinary selected-element editing, critique, polish and other Impeccable commands remain independent."
license: Apache-2.0
user-invocable: true
argument-hint: "[screen, page, or app request]"
---

Open **Choices directly**, then use Impeccable's existing choices workflow. Preserve its original UI, styling, controls, answers and follow-ups, and its existing live editor and acceptance/recovery paths. Do not create replacement interfaces, another conversation, or a separate source-application engine.

Your first workspace action is:

```sh
node {{scripts_path}}/workspace.mjs --view choices --no-browser
```

Open the returned workspace URL for the user. No preceding Live App visit or element selection is required. An opening command alone never starts design work. Resolve the project and requested scope from this conversation and existing code; ask missing questions here. Read useful PRODUCT.md/DESIGN.md context without requiring setup or launching an interview.

Read [reference/workspace.md](reference/workspace.md) for the host attachment. Use the existing `serve-question` payload/renderer and its `--wait` / `--update` flow. Prepare genuine working alternatives in a private preview area and put their loopback `previewUrl` on the original cards. Share compatible environments and dependency caches rather than installing each alternative into the real app. Screenshots are references, not completed interactive candidates.

Keep narrow requests narrow. For an app redesign, carry one coherent direction through the affected routes and shared components. Use the installed Impeccable skill's relevant guidance; Congo source can provide authorized starting points. Keep the actual project unchanged while comparing candidates.

Continue adjustments in this same chat. A library **Try this** arrives as a steer through the existing question answer path: retrieve source through Congo's normal authorized CLI/MCP delivery, adapt it into a running choice, retain version/hash pins and notices, and update the same native question key. The user completes sign-in; never read or handle their sign-in secrets. Without paid source, browsing and ordinary Impeccable work remain available.

When a card is chosen, integrate its actual candidate source through the existing agent/Impeccable workflow, reconcile intervening edits and preserve unrelated work. Verify the affected routes, data bindings, forms and actions, run relevant checks, and confirm persistence after app restart. Existing element variants continue to use the original `live-accept`, cleanup, discard and recovery procedure.

Keep ordinary live editing and every existing design command independent. The host embeds the existing app/editor and does not rebuild its controls. If interrupted, inspect the original question state or `live-status` / `live-resume`. Never stop the customer's dev server. Report completion only after real source application and behavior verification.
