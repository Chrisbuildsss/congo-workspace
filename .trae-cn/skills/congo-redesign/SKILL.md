---
name: congo-redesign
description: "Redesign the user's existing app with Congo: one page or the whole app, shown as running prototypes before anything changes in their code. Use for /congo-redesign and for requests like redesign my contacts page, make this dashboard look better, show me other takes on the pricing page, or redesign the app. Uses real Congo apps and screens as the reference, puts the result in Congo's Prototypes, and applies it only through Pull into a project, using the congo skill."
version: 4.8.0
user-invocable: true
argument-hint: "[the page or app to redesign, and what should change]"
license: Apache-2.0
---

An optional helper for the Congo workspace. It redesigns something the user already has: one page, a few pages, or the whole app. It uses the `congo` skill for everything about the Library, Congo files and prototypes: read that skill first and follow it. This skill adds only how to read the user's app, how wide to go, and how to keep one direction.

It is one way into the workspace, not the only one: a redesign asked for in plain words through `/congo` works the same way.

## What to do

1. **Know what is being redesigned.** From the conversation and the code: the project folder, the page or route, and what the user wants different. If the project, the page or the intent is missing, ask in one short question.
2. **Read the real thing first.** Open the page's source, the components it uses and the project's styles and tokens. Note what must keep working: routes, data bindings, forms, actions, states. The redesign changes how it looks and reads, not what it does.
3. **Decide how wide to go, from the request.**
   - **A narrow request stays narrow.** One section or one page means that section or page. Do not restyle the navigation, other pages or shared components to match unless the user asks.
   - **"Redesign the app" means one coherent direction** across the affected screens and the shared components they use: the same type, color, spacing, density and component treatment everywhere, decided once and written down in the prototype's `summary`. Not a different idea per screen.
   - When it is open, start with the main page (the one the product lives in) and let Expand carry the same direction to the rest.
4. **Find the reference.** With a Congo subscription, search the Library for real apps and screens that do the same job well (`congo search --kind screen --query "<the page's job>" --json`, `congo templates --json`) and use what they do as the reference: layout, hierarchy, density, component patterns. Choose from what the Library holds today. Without a subscription, work from the user's own code and your own judgment, and say so.
5. **Make the prototype** as the `congo` skill's reference describes for a redesign of the user's project: build the redesigned page from a copy of the real page, in the project's own components and tokens where they hold up, as a running prototype in a Congo file. One prototype by default. A few directions side by side only when the user asks; then give each a different primary axis (layout, density, type, color) so they are real choices.
6. **Tell the user it is in Prototypes**, in one line: what changed, what was left alone, and which Congo items it drew on. For a whole-app redesign that started from the main page, say that Expand carries it to the other screens.

## Applying it

Nothing in the user's code changes until they choose **Pull into a project** on a prototype (or ask you to in chat). Then follow the `congo` skill's `build` request: put the redesign into the real files, keep behavior and the user's unrelated edits intact, run the project's checks and open the real routes.

## Rules

- Keep product behavior, routes, data, forms and actions working. A redesign that breaks a flow is not finished.
- Use the project's existing design system where it has one. Change tokens deliberately and once, not page by page.
- Say plainly what you based the direction on. No invented numbers or user research.
- Everything else (Congo files, never naming Congo apps from memory, the user's own Congo sign-in, working without a subscription) is as the `congo` skill says.