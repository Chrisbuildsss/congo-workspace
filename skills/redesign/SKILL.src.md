---
name: redesign
description: "Open the Congo workspace on Compose for a new screen, a page redesign or a coherent app redesign, in the customer's existing AI conversation. Use for requests such as help redesign my contacts page, make this page look better, or show alternative invoicing screens. Ordinary selected-element editing, critique, polish and the other Impeccable commands stay independent."
license: Apache-2.0
user-invocable: true
argument-hint: "[screen, page, or app request]"
---

Open or reuse the local Congo workspace on Compose, then show the user the URL it prints:

```sh
node {{scripts_path}}/workspace.mjs open --view compose --project <the user's app folder>
```

Leave out `--project` when no app is involved. Opening the workspace starts no design work by itself. Resolve the project, page and intent from this conversation and ask what is missing here; the workspace is not a second chat.

Until the workspace can forward requests to you, handle redesign requests with the installed Impeccable skill as usual: follow its new-work, live and command references. Keep narrow requests narrow; for an app redesign, carry one coherent direction through the affected screens and shared components, and verify real routes, data bindings, forms and actions before calling it done.

`node {{scripts_path}}/workspace.mjs status` reports whether it is running; `stop` closes it.
