# Attach the original interfaces

The workspace hosts the original black Choices page and the running app with its original live-editor controls. It renders no replacement choice cards and edits no project source.

```sh
node <scripts>/workspace.mjs --view choices --no-browser
node <scripts>/workspace.mjs attach --provider codex --target <project> --dev-url http://127.0.0.1:5173
```

Use the active tool's identifier (`codex`, `cursor`, or `claude`). Resolve missing project/page details in the existing chat. Attachment metadata is not proof of a listening AI; the host measures the native question wait or existing live-editor polling connection.

Prepare alternatives with normal coding tools in the returned private working area. Reuse one compatible app environment for several choices and cache packages/dependencies. First-time dependencies may need installation. Read Impeccable's existing `congo.md` for source authorization and adaptation; retain delivered source versions, hashes, receipts and notices. No paid source or credentials belong in the public repository.

Use the original question payload. `previewUrl` adds running code in the original card's media slot:

```json
{
  "title": "Contacts alternatives",
  "question": "Try each direction. Continue changes in our existing chat.",
  "followup": true,
  "options": [
    {"id":"directory","label":"People directory","thesis":"A searchable directory with the existing contact actions.","previewUrl":"http://127.0.0.1:5174/contacts?choice=directory"},
    {"id":"relationships","label":"Relationship overview","thesis":"Contact history leads to the next action.","previewUrl":"http://127.0.0.1:5174/contacts?choice=relationships"}
  ]
}
```

The original card structure, appearance, controls, comments and answer behavior stay Impeccable's. The optional attachment flag takes the workspace URL returned by the opening command:

```sh
node <scripts>/workspace.mjs question --start --payload <file> --workspace <workspace-url>
node <scripts>/workspace.mjs question --wait --key <returned-key>
```

Follow the original `--wait` return codes: exit 3 means wait again. Use `--update` with this same key for a follow-up; do not strand the open page by starting another server. Library **Try this** submits a steer through this existing answer path. Retrieve authorized source, adapt the relevant portion, then update the same round. Questions and discussion stay in the customer's current chat.

When the user chooses a card, apply its actual candidate source using the existing agent/Impeccable procedure. Preserve unrelated edits and verify affected routes, forms, actions and data bindings in the real app. Run relevant checks and restart the app to confirm source persistence. Do not replace this with a new source-application protocol.

Ordinary live editing uses the original commands and installed Impeccable launcher. The wrapper can forward an existing engine command:

```sh
node <scripts>/workspace.mjs engine live --target <project>
node <scripts>/workspace.mjs engine live-poll --target <project>
```

Attach that app's existing dev URL to Live App. The host keeps both native frames mounted during view switching. Existing `live-accept`, `live-status`, `live-resume`, discard and cleanup remain responsible for element variants; the host does not reproduce them.
