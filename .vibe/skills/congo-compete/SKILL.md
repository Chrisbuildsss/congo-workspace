---
name: congo-compete
description: Research a product and prototype a competitor to it with Congo. Use for /congo-compete and for requests like what could compete with this product, build me an alternative to this tool for a niche, or prototype a competitor to this app. Researches the product, finds an angle, and makes a running prototype with a brief in Congo's Prototypes, using the congo skill.
version: 4.8.0
user-invocable: true
license: Apache-2.0
---

An optional helper for the Congo workspace. It researches one product and prototypes a competitor to it. It uses the `congo` skill for everything about the Library, Congo files and prototypes: read that skill first and follow it. This skill adds only the research and the brief.

## What to do

1. **Pin down the target.** The product the user named, and who the competitor is for if they said. If they named no product, ask which one, in one short question.
2. **Research it, briefly.** Use the tools you have (web search and fetch when available; otherwise what you know, said as such). Look for:
   - what the product does and who pays for it;
   - what its users complain about or cannot do (reviews, forums, pricing pages, changelogs);
   - who it serves badly: a niche, a size of business, a region, a price point.

   Keep it to a few minutes. Note where each finding came from.
3. **Choose one angle.** A competitor needs a reason to exist: a niche the product ignores, a simpler version of its core job, a missing feature its users ask for, a lower price for a narrower need. Pick the strongest and say it in one sentence. Never copy the product's name, brand, text or artwork.
4. **Prototype it** with the `congo` skill: the closest app in the Library for that job, main screen first, one prototype unless the user asked for several angles.
5. **Write the brief** into the prototype's `prototype.json`, as the `congo` skill's reference describes:
   - `who`: the people the angle is for;
   - `why`: why this angle, against that product;
   - `supports`: what you found, with the sources named, and what you could not check;
   - `next`: what to look into before building further (demand, pricing, the hard parts).
6. Tell the user it is in Prototypes, with the angle in one line.

## Rules

- Say plainly what you verified and what is a guess. No invented numbers, quotes or market sizes.
- The prototype shows the product idea working; it does not claim to match the other product's features.
- Everything else (one prototype by default, Congo files, Pull into a project only when asked, never naming Congo apps from memory, the user's own Congo sign-in) is as the `congo` skill says.