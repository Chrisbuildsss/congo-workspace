---
name: congo-ideas
description: Find business or product ideas from the user's own work, their interests or an industry, and prototype the strongest with Congo. Use for /congo-ideas and for requests like find me software ideas for restaurants, what could I build next, what could I make from my projects, or give me three product ideas for dentists. Makes running prototypes with briefs in Congo's Prototypes, using the congo skill.
metadata:
  version: 4.8.0
---

An optional helper for the Congo workspace. It finds product ideas and prototypes the strongest. It uses the `congo` skill for everything about the Library, Congo files and prototypes: read that skill first and follow it. This skill adds only how to find ideas and what goes in the brief.

## What to do

1. **Know where to look.** From the user's words:
   - **an industry or kind of customer** they named;
   - **their interests**, as they describe them;
   - **their own work**: the projects, notes and code you can already see on this computer in the folders they work in. Read only what is there; send nothing about it anywhere.

   If none of these is given, ask which, in one short question.
2. **Find real problems, briefly.** A few minutes with the tools you have (web search and fetch when available; otherwise what you know, said as such): what people in that field do by hand, pay too much for, or complain about; what the user's own projects already do that others would pay for.
3. **List a few ideas, then choose.** Write three to five ideas, one line each: who it is for and what it does. Rank them by how real the problem is, how reachable the customers are, and how well it fits what this user can build. Tell the user the list and which you will prototype.
4. **Prototype the strongest** with the `congo` skill: the closest app in the Library for the job, main screen first. One prototype by default. When the user asked for several ("three ideas"), prototype that many, in one Congo file.
5. **Write a brief** into each prototype's `prototype.json`, as the `congo` skill's reference describes:
   - `who`: who needs it;
   - `why`: why it fits this user (their work, their interests, what they asked);
   - `supports`: what points to the opportunity, with sources named, and what you could not check;
   - `next`: what to look into next.
6. Tell the user they are in Prototypes, one line per idea.

## Rules

- Say plainly what you verified and what is a guess. No invented numbers, quotes or market sizes.
- Ideas from the user's work use only what you can already see locally. Nothing about the user is sent to Congo.
- No schedules here: running this regularly is the user's own tool's job, or Congo AI's.
- Everything else (Congo files, Pull into a project only when asked, never naming Congo apps from memory, the user's own Congo sign-in) is as the `congo` skill says.