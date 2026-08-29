# PHASE 4 — INTERACTIVE ARCHITECTURE DECISION CHECKLIST
## Ultimatetank Master Build Consolidation

**Prepared:** 2026-08-30
**Input:** `AUDIT_PHASE_1-3.md` (35 verified claims, 23-entry defect register)
**Status:** Awaiting your decision on every `Your Call` line.

---

### How to use this document

There are **88 decisions**, grouped from the biggest structural choices down to the smallest wording details. For each one you will see:

- **What Yt01, Yt02 and Yt03 each do** — in plain language, plus the good and bad of each.
- **Recommendation** — what I suggest we build, and why.
- **Your Call** — the box you fill in.

You can answer in four ways:

| Answer | Meaning |
|---|---|
| `Yt01` / `Yt02` / `Yt03` | Take that build's version as-is |
| `Recommended Merge` | Do what I suggest |
| Your own words | Describe what you want |
| `Skip` | Use my recommendation without discussion |

**Shorthand for the whole document:** if you only want to move fast, reply **"all recommended"** and I will treat every unanswered question as `Recommended Merge`. The questions marked 🔴 are the ones I genuinely need an opinion on — they change how the game *feels*, not just how the code is organised.

**A note on the evidence.** Every statement about what a build does was checked against the actual code this session, not taken from the handoff documents. Where a document disagreed with the code, the code won and the disagreement is called out.

---

## SECTION A — FOUNDATION & STRUCTURE (Q01–Q08)

These decide the shape of the project. Everything else sits on top of them.

---

**Q01: Which build do we start from?** 🔴

- **Yt01:** The "feel and honesty" build. Best auto-aim, capped top speed, most truthful on-screen numbers, fairest revive. But it has only 6 evolutions, no Boss Rush, no frame-rate option, and it ships a damage bonus that the HUD promises but the game never applies.
- **Yt02:** The "most features" build. Boss Rush, 12 evolutions, frame-rate cap, on-screen error reporting, most settings. But it has the worst code health: three duplicated functions, a coin economy that pays out twice, and an evolution recipe table that does nothing at all.
- **Yt03:** The "deepest systems" build. The only build where evolution recipes actually work as advertised, a tech tree, distinct tank identities, armor that grows with your health. Its documentation is the most honest of the three (83% of its claims check out). It is missing the revive safety window and has two features wired up in code but with no matching on-screen element.

- **Recommendation:** **Yt03 as the skeleton.** It has the cleanest data model, the only correct progression logic, and 85.6% of its code is already shared with Yt02 — so Yt02's extra features port across cheaply. Then transplant the specific strengths of the other two (listed in Q02 and throughout Section D–I). Starting from Yt02 would mean repairing its coin economy and evolution gating from scratch; starting from Yt01 would mean rebuilding progression entirely.

- **Your Call:** `[ Yt01 | Yt02 | Yt03 | Recommended Merge ]`

---

**Q02: What do we pull in from the other two builds?** 🔴

- **From Yt01:** the smart targeting brain (10-second cycle that prioritises bosses and dangerous enemies); the top-speed cap (260%); the live damage/speed meters on a 0.15-second refresh; the revive safety package (3-second spawn pause, bullets cleared, missile timer reset); the 3-level screen shake.
- **From Yt02:** the 30/60 FPS option; the on-screen error box that catches crashes; the Boss Rush unlock that updates live; damage-number and combat-popup on/off switches; and the two on-screen elements Yt03 is missing (damage-direction arrow, diagnostics readout).
- **From Yt03:** armor that scales with health; the tech tree; tank identities; per-tank card counts; arrow-key driving; the floating 3D armor bar.

- **Recommendation:** **Take all of the above.** None of these conflict with each other; they touch different subsystems. This is the single highest-value decision in the document.

- **Your Call:** `[ All of the above | Customise (list what to drop) ]`

---

**Q03: One big file, or split into separate files?**

- **Yt01:** One 1.1 MB HTML file. Three.js embedded inside. Works offline by double-clicking.
- **Yt02:** One 1.1 MB HTML file. Same.
- **Yt03:** One 1.1 MB HTML file. Same.

All three are single-file by deliberate design, and all three handoff documents call it a hard rule.

- **Recommendation:** **Keep one file for the playable build**, because it is what makes the game trivially shareable and offline-safe. But keep the *source* as separate files (one for data, one for systems, one for UI) plus a one-command build step that glues them together. You get readable, reviewable code and still ship a single file. This is the one place where I recommend breaking from all three builds' stated convention, because a 7,500-line script is what allowed the duplicate-function bug in Yt02 to survive eleven patches.

- **Your Call:** `[ Single file only (as all three do) | Recommended Merge: split source + build step ]`

---

**Q04: What should the master build be called?**

- **Yt01:** `TankThilteteYt01_v1.4.html` — generation number + `v` version.
- **Yt02:** `TankThilteteYt02_011.html` — generation number + three-digit sequence. Its document explicitly says the `vX.Y` style was "used briefly and abandoned".
- **Yt03:** `TankThilteteYt03_v1.4.html` — same style as Yt01.

- **Recommendation:** **`TankThilteteYt_1.0.0.html`** for the playable file — a clean break from the three generations, using proper three-part versioning (major.minor.patch) so a balance tweak (`1.0.1`) is visibly different from a new feature (`1.1.0`). If you prefer to stay inside the existing family, `TankThilteteYt04_v1.0.html` is the consistent next step.

- **Your Call:** `[ TankThilteteYt_1.0.0.html | TankThilteteYt04_v1.0.html | Your own name ]`

---

**Q05: Do we keep every old version file forever?**

- **Yt01:** Yes — "We never overwrite a completed version." Lists five frozen files.
- **Yt02:** Yes — "This is the hard law of this project." Lists eleven files.
- **Yt03:** Yes — four rules about never modifying older files, plus a checksum to detect tampering.

None of those files are actually in this repository — only the three current builds are here.

- **Recommendation:** **Stop copying files; use Git instead.** Git already stores every version permanently, lets you diff any two of them, and doesn't clutter the folder with 1.1 MB duplicates. Keep the three current builds as-is for reference, and let version history live in the repository.

- **Your Call:** `[ Keep copying files | Recommended Merge: Git history only ]`

---

**Q06: Do we strip the third-party tracking code?**

- **All three builds** contain a Cloudflare analytics beacon pointing at an internet address. Yt02 additionally contains a Cloudflare challenge script that injects a hidden 1×1 pixel frame. Every document claims the game is "100% offline" with "no CDN dependencies" — that claim is false as shipped.

- **Recommendation:** **Remove all of it.** It contradicts the offline promise, it phones home to a third party, and it does nothing for the player. These were injected by the web host and saved back into the file by accident.

- **Your Call:** `[ Remove all tracking | Keep it ]`

---

**Q07: Should the game show errors on screen when something breaks?**

- **Yt01:** No. Errors go to the browser console, which a player on a phone can never see.
- **Yt02:** **Yes.** A hidden red box appears with the error text if anything throws, and it also catches broken promises.
- **Yt03:** No.

- **Recommendation:** **Take Yt02's error box, but hide it behind a setting.** During testing it is invaluable — it is the only reason a phone tester could ever report a real bug. In a shipped build it should be off by default so players never see it.

- **Your Call:** `[ Yt02 (always on) | Recommended Merge (behind a setting) | None ]`

---

**Q08: What happens to existing players' saved progress?**

- **All three** save to the same browser storage key (`tank_save`, version 3) with the same shape: coins, permanent upgrades, skins, achievements, settings, lifetime stats.

The risk: Yt03 calls the Glacier skin `glacier`; Yt01 and Yt02 call it `ice`. A player who owned Glacier on Yt02 and loads the master build would have a skin ID the new build does not recognise.

- **Recommendation:** **Keep the same storage key and write a one-time converter** that renames `ice` → `glacier`, fills in any missing fields with defaults, and bumps the version number. Nobody loses coins or skins.

- **Your Call:** `[ Recommended Merge (migrate old saves) | Fresh start (wipe saves) ]`

---

## SECTION B — GAME FLOW & MODES (Q09–Q17)

---

**Q09: Which game modes should exist?** 🔴

- **Yt01:** Two — **Casual** (endless) and **Level Mode** (pick your difficulty and starting level). No Boss Rush at all.
- **Yt02:** Three — Casual, Level Mode, and **Boss Rush** (all six bosses back to back, victory screen at the end).
- **Yt03:** Three — same set. Boss Rush works and shows a victory banner, then ends the run.

- **Recommendation:** **All three modes, using Yt02's Boss Rush plumbing** (a dedicated counter that advances on each boss kill) **with Yt03's shorter 4-second gap between bosses.** Boss Rush is the strongest replay hook any of these builds has and it costs almost nothing to carry forward.

- **Your Call:** `[ Yt01 (two modes) | Recommended Merge (three modes) ]`

---

**Q10: How does a player unlock Boss Rush?**

- **Yt01:** Not applicable — no Boss Rush.
- **Yt02:** Kill **5 bosses total**, *or* reach **level 5**, whichever happens first.
- **Yt03:** Reach **stage 5** in Level Mode, *or* reach level 5.

- **Recommendation:** **Yt02's rule** (`5 boss kills OR level 5`). It is the more generous of the two and rewards the thing Boss Rush actually tests — killing bosses.

- **Your Call:** `[ Yt02 rule | Yt03 rule | Your own threshold ]`

---

**Q11: What does a locked Boss Rush button look like?**

- **Yt01:** Not applicable.
- **Yt02:** Button is always visible but greyed to 42% opacity, unclickable, showing a 🔒 padlock and "Kill 5 bosses to unlock". Updates the instant you qualify — no reload needed.
- **Yt03:** Button visible, dimmed to 75%, label says "🔒 Locked (Clear Stage 5)". Two problems: the lock is only evaluated **once when the page loads**, so it stays stale until you refresh; and if you tap it while locked it fires a browser `alert()` popup, which freezes the game and looks out of place on a phone.

- **Recommendation:** **Yt02's approach exactly.** Live-updating, non-blocking, and the locked state is obvious without needing a popup.

- **Your Call:** `[ Yt02 | Yt03 | Recommended Merge ]`

---

**Q12: Which buttons belong on the home screen?**

- **Yt01:** Six — Casual, New Casual Run, Casual Back, Levels, Armory, Awards. Settings is reached from an in-game gear icon instead.
- **Yt02:** Eight — the same six plus **Boss Rush** and a **Settings** button.
- **Yt03:** Eight — identical set to Yt02.

- **Recommendation:** **Yt02/Yt03's eight-button layout.** Settings should be reachable before you start playing, not only during a run.

- **Your Call:** `[ Yt01 (six) | Yt02/Yt03 (eight) ]`

---

**Q13: How many settings should there be?**

- **Yt01:** **9** toggles — Sound, Music, Graphics, Camera, Control Assist, Haptics, Left-Handed, Screen Shake, Reduced Flash.
- **Yt02:** **12** toggles + Reset Data = 13 controls. Adds **Damage Numbers**, **Combat Popups**, and **Frame Rate (30/60)**.
- **Yt03:** **9** toggles — same as Yt01.

- **Recommendation:** **Yt02's 12.** The three extras are all genuinely useful: damage numbers and popups are a matter of taste and visual clutter, and the frame-rate cap matters on older phones. Reset Data stays as a separate destructive action with a confirmation.

- **Your Call:** `[ Yt01/Yt03 (9) | Yt02 (12) ]`

---

**Q14: Should screen shake have two levels or three?**

- **Yt01:** **Three** — Full / Reduced (22%) / Off (0%). The button label matches what it does.
- **Yt02:** **Three** — same as Yt01.
- **Yt03:** **Two** — and there is a bug. The button reads "Shake: Off" but the code only drops shake to **22%**, never to zero. A player who turns shake off still gets shake.

- **Recommendation:** **Three levels, with the label telling the truth.** Take Yt01's implementation and drop Yt03's mislabelled toggle.

- **Your Call:** `[ Three levels (Yt01/Yt02) | Two levels, fixed | Recommended Merge ]`

---

**Q15: Which difficulty levels, and how much do they change?**

- **All three are identical:** Easy (enemies hit 0.7×, fire 0.75×), Normal (1.0× / 1.0×), Hard (1.3× / 1.25×), Nightmare (1.6× / 1.5×). Nightmare is required for one achievement.

- **Recommendation:** **Keep all four exactly as they are.** No divergence, no reason to touch it.

- **Your Call:** `[ Keep as-is | Change the multipliers ]`

---

**Q16: How does Level Mode work?**

- **All three:** You choose enemy density (Light/Normal/Heavy/Chaos), a difficulty, and a starting level from 1–30. Higher starting levels unlock as you progress. There is no win screen — it is endless.

- **Recommendation:** **Keep as-is.** Identical across builds and working.

- **Your Call:** `[ Keep as-is | Add a win condition at a set level ]`

---

**Q17: How does reviving after death work?** 🔴

- **Yt01:** Pay coins, cost quadruples each time (300 → 1,200 → 4,800 → …), no limit. You come back with **50% health, 3 seconds of invulnerability, 3 seconds where no new enemies spawn, all live bullets cleared, and your missile timer reset.** The most forgiving of the three.
- **Yt02:** Same pricing. 50% health and 3 seconds of invulnerability, and the armor pool refilled to **full** (its document says 50%, which is wrong). The spawn-pause code exists but is **never called**, so the "3s safe" message it shows is not true.
- **Yt03:** Same pricing. 50% health and 3 seconds of invulnerability only. No spawn pause, no bullet clearing, no missile reset — you can be shot immediately by a shell already in the air.

- **Recommendation:** **Yt01's full safety package.** Being killed instantly by a projectile that was already flying when you died feels like a bug, not a challenge. Keep the quadrupling cost with no cap — the price is the limiter.

- **Your Call:** `[ Yt01 (full safety) | Yt02 | Yt03 (bare minimum) | Recommended Merge ]`

---

## SECTION C — CORE LOOP & TIMING (Q18–Q24)

---

**Q18: Should there be a frame-rate cap?**

- **Yt01:** No cap. Runs as fast as the screen allows.
- **Yt02:** **Yes** — a 30/60 FPS switch in settings. On 30 FPS the game skips every other frame.
- **Yt03:** No cap.

- **Recommendation:** **Yt02's cap, defaulting to 60.** It is the single biggest battery-saver available on a phone and costs nothing when you want full speed.

- **Your Call:** `[ Yt02 (30/60 switch) | No cap ]`

---

**Q19: Should the game clock stop when you pause?** 🔴

This is invisible until it isn't. All three builds keep **two** clocks running: one that pauses with the game and one that does not. Timed boosts (Overcharge, Adrenaline, shield recharge) use the pause-safe clock, but **your firing rate uses the unsafe one.**

- **Yt01, Yt02, Yt03:** All three have this same split. Open the pause menu for a minute and your fire-rate timing has drifted relative to everything else.

- **Recommendation:** **Use the pause-safe clock everywhere.** This is a small change with no visible downside and it removes a whole class of subtle timing weirdness. Yt03's own developer notes already say this is the intended rule — it just was never applied to firing.

- **Your Call:** `[ Recommended Merge (one clock) | Leave as-is ]`

---

**Q20: How often do you level up and pick a card?**

- **All three:** Experience requirement starts at 250 and grows. Every level gives you a card choice, and the game freezes while you pick.

- **Recommendation:** **Keep as-is.** Identical and working.

- **Your Call:** `[ Keep as-is | Adjust the curve ]`

---

**Q21: How often does a boss appear, and what happens after?**

- **All three:** A boss every **5 levels**, one at a time, normal enemy spawns speed up while it lives. Killing one heals you **25%** and opens a special reward vault.
- **Yt01/Yt02:** 12-second breather after a boss dies.
- **Yt03:** 12 seconds normally, but only **4 seconds in Boss Rush** so the gauntlet keeps moving.

- **Recommendation:** **Yt03's version** — 12 seconds in a normal run, 4 in Boss Rush. The short gap is what makes Boss Rush feel like a gauntlet rather than six separate fights.

- **Your Call:** `[ 12s everywhere | Recommended Merge (12s / 4s in Boss Rush) ]`

---

**Q22: How often does the world change theme?**

- **All three:** Every **3 levels**, with a smooth shrink-and-grow transition. During it, enemy fire is briefly muted and no new enemies spawn for 3 seconds.
- **All three** treat the ten themes as **purely visual** — none of them change the rules.

- **Recommendation:** **Keep every 3 levels.** Separately, see Q48 for whether the themes should ever affect gameplay.

- **Your Call:** `[ Every 3 levels | Different cadence ]`

---

**Q23: How many cards do you get to choose from?** 🔴

- **Yt01:** Always **3**.
- **Yt02:** Always **3**.
- **Yt03:** **3 normally, 4 if you are driving the 24k Sovereign tank.** This is read from each tank's identity data, so future tanks can have their own number.

- **Recommendation:** **Yt03's approach.** "This tank gets an extra choice" is a real, understandable perk that gives the most expensive skin a reason to exist beyond cosmetics. It costs nothing to keep.

- **Your Call:** `[ Always 3 | Recommended Merge (per-tank, Gold = 4) ]`

---

**Q24: How does the kill combo work?**

- **All three:** Each kill extends a 3-second timer. Your coin payout scales up to a maximum of **2.2×**. The counter has a decay bar on screen.

- **Recommendation:** **Keep as-is.** Identical across all three.

- **Your Call:** `[ Keep as-is | Change the 3s window or 2.2× cap ]`

---

## SECTION D — MOVEMENT, AIMING & CAMERA (Q25–Q31)

---

**Q25: Should there be a maximum speed?** 🔴

- **Yt01:** **Yes — capped at 260% of base speed** (about 47 units/second). The cap applies to actual movement *and* to the number shown on screen, so the meter can never claim a speed you cannot reach.
- **Yt02:** **No cap.** Stacking speed cards plus Adrenaline plus the Afterburner evolution can make the tank genuinely hard to control on a touch joystick.
- **Yt03:** **No cap.** Same problem. Yt03's own notes list this as an open question ("no ceiling on stacking Overdrive in long runs").

- **Recommendation:** **Yt01's 260% cap, applied to both movement and the readout.** This was a deliberate fix in Yt01 for a real playability problem that the other two builds still have and have themselves flagged.

- **Your Call:** `[ Yt01 (260% cap) | No cap | Different cap value ]`

---

**Q26: How does the gun choose what to shoot at?** 🔴

This is the biggest single difference in how the three builds *feel*.

- **Yt01:** A rotating brain on a **10-second cycle**. For the first 5 seconds it flips every 0.85 seconds between "shoot the most important thing" (60% of the time) and "shoot the nearest thing" (40%). For the last 5 seconds it just shoots the nearest. "Most important" means: a boss first, then the most dangerous enemy, then the weakest, then the closest. If only one or two enemies are within 16 units, it uses simple local judgement instead.
  - *Good:* the gun feels alive and makes sensible choices — it shoots the boss during a boss fight. *Bad:* more code, and the randomness can occasionally feel unpredictable.
- **Yt02:** **Always shoots the nearest enemy.** Nothing else.
  - *Good:* simple, predictable. *Bad:* during a boss fight surrounded by small enemies, your tank ignores the boss and shoots the weaklings.
- **Yt03:** **Identical to Yt02** — nearest enemy only, same limitation.

- **Recommendation:** **Yt01's targeting brain.** It is the difference between a tank that plays well and a tank that plays dumb, and it is self-contained enough to lift out cleanly. Boss fights in particular are unplayable-adjacent without boss priority.

- **Your Call:** `[ Yt01 (smart targeting) | Yt02/Yt03 (nearest only) ]`

---

**Q27: Should the gun stick with its target?**

- **All three:** Yes — the current target is treated as 25% closer than it really is, so the gun does not twitch between two enemies at the same distance.

- **Recommendation:** **Keep the 25% stickiness.** Identical in all three and it works.

- **Your Call:** `[ Keep 25% | Change the amount ]`

---

**Q28: How many camera views?**

- **All three:** Two — **Follow** (close behind the tank) and **Wide** (zoomed out to see more of the field). Switchable by a floating 📷 button or from settings. Wide mode also reduces screen shake by 45%.

- **Recommendation:** **Keep both.** Identical and working. Yt02's history is worth noting: an earlier version had a broken button that set an invalid camera value; that was fixed and all three are now correct.

- **Your Call:** `[ Keep two views | Add more ]`

---

**Q29: Should the camera lean and zoom dynamically?**

- **All three:** Yes — it sits about 38° above and behind, never rotates with the tank, zooms in when enemies are close, zooms out when the field is empty, and pulls back further during boss fights.

- **Recommendation:** **Keep as-is.** Identical across builds.

- **Your Call:** `[ Keep as-is | Make it static ]`

---

**Q30: Should arrow keys work on a keyboard?**

- **Yt01:** No — WASD only.
- **Yt02:** No — WASD only.
- **Yt03:** **Yes** — arrow keys work alongside WASD. Verified by running the code: arrow-right produces the same input as the D key.

- **Recommendation:** **Yt03's version.** It is a two-line change that makes the game playable for people who do not think in WASD, and it costs nothing on a phone.

- **Your Call:** `[ Yt03 (WASD + arrows) | WASD only ]`

---

**Q31: Which accessibility options do we keep?**

- **All three have:** Left-handed layout (swaps which thumb drives and which fires), Control Assist (turret tracks targets faster), Reduced Flash (damage flashes are shorter), and Haptics (vibration) with a master switch.
- **Yt02 only:** separate on/off switches for damage numbers and combat popups.

- **Recommendation:** **Keep all of them, including Yt02's two extra switches.** Accessibility options are cheap and removing any of them can only hurt.

- **Your Call:** `[ Keep everything | Drop some (list) ]`

---

## SECTION E — HEALTH, ARMOR & DAMAGE (Q32–Q40)

This section contains the single largest mechanical disagreement between the three builds.

---

**Q32: What *is* armor?** 🔴🔴

All three agree on the headline: armor is a **pool** that soaks up damage before your health is touched. They disagree completely on how big the pool is.

- **Yt01:** The pool is a **flat number equal to your armor stat.** Armor 8 means an 8-point pool, whether you have 100 health or 300. It refills at exactly the same rate as your health regeneration, with no delay, even while you are being shot.
  - *Good:* dead simple to understand. *Bad:* armor becomes irrelevant as your health grows — an 8-point pool against a 40-damage hit is a rounding error.
- **Yt02:** Also a **flat number equal to your armor stat**, but stored in a different place in the code. It refills at 0.5 per second plus a quarter of your regen stat, with no delay. Its document claims regen applies at full rate — it does not, it is a quarter.
  - *Good:* refills even with zero regen. *Bad:* same scaling problem as Yt01, plus a hidden 1-damage floor (see Q35).
- **Yt03:** The pool is **your armor stat as a percentage of your max health.** Armor 8 at 100 health = an 8-point pool; armor 8 at 200 health = a 16-point pool. It only starts refilling **3 seconds after you stop taking damage**, at 10% of the pool per second.
  - *Good:* armor stays meaningful all game, and it rewards building health. The 3-second delay makes it a real tactical resource rather than free extra health. *Bad:* harder to explain, and it is a bigger change if you are used to the others.

- **Recommendation:** **Yt03's model.** It is the only one of the three where armor remains worth investing in at level 30, and the recharge delay creates a genuine decision ("do I push or do I back off and let the shield come back?"). Yt03 also already has the supporting code — a single function that computes the pool size, called from everywhere — so it is the cleanest to maintain.

- **Your Call:** `[ Yt01 (flat, regen-coupled) | Yt02 (flat, slow refill) | Yt03 (% of health, 3s delay) ]`

---

**Q33: How does armor refill, and how fast?** 🔴

- **Yt01:** At exactly your health-regen rate, immediately, even in combat. No regen = no armor refill.
- **Yt02:** 0.5 per second always, plus 0.25 per point of regen. Works with zero regen. No delay.
- **Yt03:** Nothing for 3 seconds after your last hit, then 10% of the pool per second (minimum 1 per second).

- **Recommendation:** **Yt03's rule**, because it pairs correctly with the percentage pool from Q32. If you chose a flat pool in Q32, then **Yt02's rule** is the better match, since it refills even when you have not invested in regen.

- **Your Call:** `[ Follow Q32 choice | Specify your own rate ]`

---

**Q34: What refills armor instantly?**

- **All three:** Repair kits, shield batteries, and supply crates top the armor pool up.
- **Yt01:** picking an armor upgrade card raises the pool ceiling **and** fills it by the same amount.
- **Yt02:** same behaviour.
- **Yt03:** same, handled through its central pool function.

- **Recommendation:** **Keep all instant-refill sources, applied through one function** so they cannot drift apart.

- **Your Call:** `[ Keep as-is | Change which items refill armor ]`

---

**Q35: Should there be a minimum damage per hit?** 🔴

- **Yt01:** No. If armor soaks the whole hit, you take **zero**.
- **Yt02:** **Yes — a hidden 1-damage floor.** Any hit that gets past your armor costs at least 1 health. This is not in its documentation and contradicts its own "armor absorbs ALL damage" design statement.
- **Yt03:** No. Fully absorbed means zero.

- **Recommendation:** **No floor.** Take Yt01/Yt03. A shield that always leaks 1 point is a shield that does not work as advertised, and it makes small fast attackers disproportionately dangerous.

- **Your Call:** `[ No floor (Yt01/Yt03) | Keep the 1-damage floor ]`

---

**Q36: Should armor be shown in the world or only on the HUD?**

- **Yt01:** HUD only — a small blue bar under your health with a number.
- **Yt02:** HUD only — a transparent blue overlay across the whole health bar, which pulses while it refills.
- **Yt03:** **Both** — the HUD bar *and* a small blue bar floating in 3D above your tank showing current/maximum.

- **Recommendation:** **Yt03's floating bar plus Yt02's HUD overlay style.** The floating bar is genuinely useful in a busy fight where your eyes are on the tank, not the corner of the screen, and the pulsing refill animation is good feedback that Yt03 lacks.

- **Your Call:** `[ HUD only | Recommended Merge (both) ]`

---

**Q37: How does health regeneration work?**

- **All three:** Your regen stat gives that many health points per second, always on, no delay. Comes from the Nano Repair card and permanent shop upgrades.

- **Recommendation:** **Keep as-is.** Identical everywhere.

- **Your Call:** `[ Keep as-is | Add an out-of-combat delay ]`

---

**Q38: Does healing on kill stay?**

- **All three:** Yes — the Field Medic card gives health per kill, stacking.

- **Recommendation:** **Keep as-is.**

- **Your Call:** `[ Keep as-is ]`

---

**Q39: How does the one-hit shield work?**

- **All three:** The Shield Generator card gives you a bubble that completely blocks **one** hit, then recharges after 18 seconds (faster with more stacks). It triggers *before* armor, so it saves your armor pool. The Bastion evolution makes the next hit after a block 25% weaker.

- **Recommendation:** **Keep exactly as-is.** Identical across all three and well-designed.

- **Your Call:** `[ Keep as-is | Change the 18s recharge ]`

---

**Q40: Should damage numbers appear on screen?**

- **Yt01:** Combat text exists (BLOCKED, ARMOR DOWN) but no toggle.
- **Yt02:** Yes, with a **setting to turn it off**, plus a separate switch for combat popups.
- **Yt03:** Combat text exists, no toggle.

- **Recommendation:** **Yt02's toggles.** Some players find floating numbers distracting; letting them choose costs nothing.

- **Your Call:** `[ Yt02 (toggleable) | Always on ]`

---

## SECTION F — ENEMIES & BOSSES (Q41–Q48)

---

**Q41: How much harder should enemies get per level?** 🔴

All three start near the tank's stated damage and ramp up, but the curves are different. Actual numbers, measured:

| Level | Yt01 | Yt02 | Yt03 |
|---|---|---|---|
| 1 | 1.00× | **1.05×** | 1.00× |
| 10 | 1.29× | **1.48×** | 1.43× |
| 20 | 1.77× | **2.12×** | 2.07× |
| 30 | 2.47× | **2.98×** | 2.93× |

Yt02 is the hardest at every single level. Its document claims level 1 should be 0.70× — but a leftover `× 1.5` multiplier was never removed, so it is actually 1.05×. The claimed "63% reduction" is really 36%.

- **Recommendation:** **Yt01's curve.** It is the flattest and most predictable, and it is the one whose documentation matches its code. Yt03's is close behind and is a fine alternative if you want late-game enemies to bite harder. **Do not take Yt02's curve** — it is accidentally 20% harder than intended at high levels.

- **Your Call:** `[ Yt01 | Yt03 | Yt02 (not recommended) | Custom curve ]`

---

**Q42: How hard should the first boss be?** 🔴

The Warlord is the first boss every player meets. All three nerfed it, but each nerfed *different things*:

| Setting | Original | Yt01 | Yt02 | Yt03 |
|---|---|---|---|---|
| Shell speed | 36 | **18** ✔ | **36** ✘ | **18** ✔ |
| Shell damage | 20 | 10 ✔ | 10 ✔ | 10 ✔ |
| Tank movement | 0.45 | **0.45** ✘ | 0.225 ✔ | 0.225 ✔ |
| Time between shots | 3.2s | **3.2s** ✘ | **3.2s** ✘ | **6.4s** ✔ |

- **Yt01** halved the shell speed and damage but left the boss fast-moving and firing often.
- **Yt02** halved the damage and slowed the tank, but **left the shells at full speed (36)** — so its Warlord fires projectiles twice as fast as the other two, which is the hardest thing to dodge. Its documentation does not mention this.
- **Yt03** did all four. Its Warlord is by far the fairest first boss.

- **Recommendation:** **Yt03's Warlord — all four nerfs.** The first boss is where new players decide whether to keep playing, and fast projectiles are the least readable threat in the game.

- **Your Call:** `[ Yt03 (fully nerfed) | Yt01 | Yt02 (not recommended) ]`

---

**Q43: Should the other five bosses change?**

- **All three are identical** for Tempest, Colossus, Titan, Nova and Fortress — same shell speeds, same lifetimes, same homing strength, same firing intervals. All have phases at 60% and 30% health where they get visibly angrier.

- **Recommendation:** **Keep them as-is.** No divergence to resolve.

- **Your Call:** `[ Keep as-is | Rebalance ]`

---

**Q44: How do elite enemies work?**

- **All three:** From level 15, about 14% of spawns are elites — glowing cyan, tougher, worth more. They get a 1.15× damage multiplier on spawn.
- **Yt03 additionally** has a commander buff that can push an enemy to 1.25×.

- **Recommendation:** **Keep as-is**, including Yt03's extra commander buff.

- **Your Call:** `[ Keep as-is | Change the 14% rate ]`

---

**Q45: Where do enemies appear?**

- **All three:** In a ring around the player, 38–64 units away, in any direction. This is what makes the infinite world work — enemies always come to you.

- **Recommendation:** **Keep as-is.**

- **Your Call:** `[ Keep as-is ]`

---

**Q46: Should enemy surges stay?**

- **All three:** From level 8, a timed pressure wave every 70–110 seconds. Enemies spawn rapidly for 15 seconds; survive it and you collect a coin bounty of `60 + level × 10`.
- **Yt02 only:** a **5-second warning** ("⚠ SURGE INCOMING!") before it starts. In Yt01 and Yt03 it just happens.

- **Recommendation:** **Keep surges, with Yt02's warning.** A pressure wave you cannot see coming feels unfair rather than exciting.

- **Your Call:** `[ With warning (Yt02) | Without ]`

---

**Q47: Should the special events stay?**

- **All three:** From level 8 — **Bounty** (high-value enemies), **Ambush** (a group appears around you at once), **Lull** (a short truce to recover). Yt01's document also mentions **Raid** from level 10.

- **Recommendation:** **Keep all of them.** They are identical across builds and they break up long runs.

- **Your Call:** `[ Keep as-is ]`

---

**Q48: Should the world themes ever affect gameplay?** 🔴

- **All three:** No. The ten themes are purely visual. All three carry leftover code for "roots slow you down" and "heat" effects that is switched off — Yt03's version literally returns nothing.

This matters because Yt01's speed meter has a **SLOWED** indicator built in that can never appear in the current builds.

- **Recommendation:** **Keep themes purely visual, and delete the dead effect code.** "A pretty change of scenery" is a clean promise; half-working biome effects that only sometimes slow you down are confusing. If you do want gameplay themes, that should be its own deliberate feature, not a resurrection of abandoned code.

- **Your Call:** `[ Keep visual-only (delete dead code) | Re-enable some effects ]`

---

## SECTION G — CARDS, EVOLUTIONS & PROGRESSION (Q49–Q57)

---

**Q49: Should the early game guarantee you survival cards?**

- **Yt01:** For your **first 3 picks**, the offer always includes Health Regen and Heal-on-Kill plus one random card. Counted by *picks taken*, so it cannot get out of sync.
- **Yt02:** For your **first 5 picks** — but only if you do not already own that card. Smartest version.
- **Yt03:** For **levels 2 to 6** — counted by *level*, not picks, and it does **not** check whether you already own the card. So if you pick Health Regen at level 2, you are offered it again at levels 3, 4, 5 and 6. Yt03's own notes admit this.

- **Recommendation:** **Yt02's logic (first 5 picks, skip cards you already own), counted by picks taken rather than level.** It is the only version that neither wastes your early choices nor desyncs after a revive.

- **Your Call:** `[ Yt01 (3 picks) | Yt02 (5 picks, no repeats) | Yt03 | Recommended Merge ]`

---

**Q50: How many evolutions should exist?** 🔴

- **Yt01:** **6** — Cluster Warheads, Bastion Core, Prism Cannon, Nanite Harvest, Afterburner, Siege Loader.
- **Yt02:** **12** — the six above plus Overkill Array, Tempest Autoloader, Citadel Core, Missile Rain, Phase Lance, Predator Engine.
- **Yt03:** **12** — the same twelve.

- **Recommendation:** **12.** Double the build variety for work that is already done, and both Yt02 and Yt03 have the full set defined.

- **Your Call:** `[ 6 (Yt01) | 12 (Yt02/Yt03) ]`

---

**Q51: What should an evolution cost to unlock?** 🔴🔴

This is the most broken thing in Yt02 and the most important thing to get right.

- **Yt01:** Each evolution names exactly what it needs, and the game **counts your cards correctly**. But its recipes are inconsistent — some need 1+1, some need 2+2. Only 6 exist so it does not matter much.
- **Yt02:** The documentation says "2 of one card + 1 of another" and lists precise recipes like *2 Missile Pod + 1 Shell Shock*. **None of that is real.** The counter the recipes check is never filled in, so the check always fails, and the code falls back to a much simpler rule: *do you own at least one of each of two cards?* Result: every evolution unlocks for one-third of the stated price. Worse, **two pairs of evolutions have identical recipes** — Cluster Warheads and Missile Rain both want Missile + Splash; Prism Cannon and Phase Lance both want Pierce + Crit — so the game literally cannot tell them apart. Verified by running the code.
- **Yt03:** Recipes are "2 of one + 1 of another" and the game **counts correctly**. All twelve recipes are distinct. Verified by running the code: owning 1 Missile + 1 Splash unlocks nothing; owning 2 Missile + 1 Splash unlocks Cluster Warheads.

- **Recommendation:** **Yt03's system, unchanged.** It is the only one of the three where what the card says and what the game does are the same thing. Yt02's version must not be carried forward in any form.

- **Your Call:** `[ Yt03 (correct counting) | Yt01 style | Rebalance the recipes ]`

---

**Q52: When are evolutions offered?**

- **Yt01:** **Only in the boss reward vault.** You can never see one at a normal level-up.
- **Yt02:** Guaranteed in the boss vault, plus a **50% chance** at any normal level-up once you qualify.
- **Yt03:** Same as Yt02 — guaranteed in the vault, 50% at a normal level-up.

- **Recommendation:** **Yt02/Yt03's rule.** Evolutions are the most exciting moment in a run; hiding them behind bosses only means most players finish a run never having seen one.

- **Your Call:** `[ Boss vault only (Yt01) | Vault + 50% (Yt02/Yt03) ]`

---

**Q53: What should evolutions actually do?**

- **Yt01:** Six behaviour flags (cluster missiles, bastion soak, prism pierce, nanite healing, afterburner speed, siege shots). No flat stat bonuses.
- **Yt02:** Behaviour flags for the first six, **plus real stat bonuses for all twelve** (for example Citadel Core gives +25 health, +8 armor, +1 regen). Verified working.
- **Yt03:** Six behaviour flags, **plus five evolutions that apply stat bonuses** through one central function, plus one that changes missile behaviour. Verified working, and its documentation matches the code exactly.

- **Recommendation:** **Twelve evolutions that each do something visible**, combining Yt02's fuller bonus table with Yt03's single central function that applies them. One place to apply effects means they cannot silently stop working.

- **Your Call:** `[ Recommended Merge | Behaviour flags only | Stat bonuses only ]`

---

**Q54: Should boss reward cards be stronger?**

- **Yt01:** **Yes** — every card in the boss vault is marked **ELITE** and amplified by about 32% (rising slightly with level), with the new number printed on the card.
- **Yt02:** **No** — boss vault cards are the same as normal ones.
- **Yt03:** **Yes** — boss vault cards are ELITE, boosted 30%.

- **Recommendation:** **Yes, take the ELITE treatment** (Yt01 or Yt03 — they are effectively the same). Beating a boss should feel like a real reward, and the label makes the boost visible rather than mysterious.

- **Your Call:** `[ ELITE cards (Yt01/Yt03) | Normal cards (Yt02) ]`

---

**Q55: How many rerolls do you get?**

- **All three:** One free reroll per run, plus extras from the permanent shop (up to 2), from Yt03's tech tree (up to 3), and from the Card Reroll consumable. Boss vaults cannot be rerolled.

- **Recommendation:** **Keep as-is**, and if you take Yt03's tech tree (Q61) the reroll cache comes with it.

- **Your Call:** `[ Keep as-is ]`

---

**Q56: Should picking an evolution feel special?**

- **Yt01:** A vibration and a sound.
- **Yt02:** **A banner reading "⚡ EVOLUTION: [name]!" plus the level-up fanfare.**
- **Yt03:** A vibration and a sound.

- **Recommendation:** **Yt02's banner and fanfare.** Evolutions are the peak moment of a build and they deserve to be announced.

- **Your Call:** `[ Yt02 (banner + fanfare) | Quiet ]`

---

**Q57: Should the pause screen show evolution progress?**

- **All three:** Yes — a list showing each evolution, what it needs, what you have, and whether it is live. Tapping one opens a detail page.
- **Yt01:** Also shows a hint on each upgrade card telling you which evolutions it contributes to.

- **Recommendation:** **Keep the detail page in all cases, and add Yt01's card hints.** Telling a player "this card is 1 of the 2 you need for Cluster Warheads" is the difference between deliberate build-crafting and picking at random.

- **Your Call:** `[ Recommended Merge | Detail page only ]`

---

## SECTION H — ECONOMY, SHOP & TANKS (Q58–Q64)

---

**Q58: How should coins be calculated?** 🔴🔴

**There is a live bug here that must be fixed whichever model you choose.**

- **Yt01:** Every coin source passes through **one function that takes a flat 10% tax.** Simple, centralised, easy to balance from one place.
- **Yt02:** Coins are multiplied by your coin bonus and your Lucky Charm — **but the multiplication happens twice.** The function that calculates kill rewards is defined **twice in the file**, and the second definition overwrites the first; the second one applies the bonuses and then calls a helper that applies them again. Measured by running the actual code: one Scavenger card gives **+56% instead of +25%**; four Scavenger cards give **exactly double** the intended payout. Because the baseline (no upgrades) is correct, this is invisible until a player invests in their economy.
- **Yt03:** Coins are multiplied by your coin bonus, the difficulty, and Lucky Charm — each exactly once. No tax.

- **Recommendation:** **Yt03's model, with the 10% tax from Yt01 folded in as the final step of the single coin function.** One function, applied once, at one place, with a global tuning knob. And delete Yt02's duplicate function entirely.

- **Your Call:** `[ Recommended Merge | Yt01 (tax only) | Yt03 (multipliers only) ]`

---

**Q59: Should we fix the duplicated code in Yt02?**

- **Yt02 has three functions defined twice** — the kill reward, the combo timer, and the quick-save. In each case the second silently overwrites the first. This is what caused the coin bug in Q58, and it means any future edit to the first copy has no effect at all.
- **Yt01 and Yt03 have none.**

- **Recommendation:** **Yes — delete all duplicates.** This is not a preference; it is a correctness requirement. It is listed here only so you can see it was found and handled.

- **Your Call:** `[ Fix (mandatory) ]`

---

**Q60: Should the permanent shop stay the same?**

- **All three are identical:** 15 items. Seven capped upgrades (max health, damage, speed, armor, regen, Second Wind revive, Extra Choice reroll) and eight unlimited ones whose price rises with every purchase.

- **Recommendation:** **Keep as-is.** No divergence.

- **Your Call:** `[ Keep as-is | Rebalance prices ]`

---

**Q61: Should we include the tech tree?** 🔴

- **Yt01:** No tech tree.
- **Yt02:** No separate tech tree — its permanent shop fills that role.
- **Yt03:** **Yes — 5 upgrades** in a separate panel: Reinforced Hull Armor (+2 armor/rank, 5 ranks), Turbocharger (+2% speed/rank, 5), Auxiliary Shield Generator (start every run with a shield, 1 rank), Tactical Reroll Cache (+1 reroll/rank, 3), High-Caliber Breach (+2% damage/rank, 5).

- **Recommendation:** **Only include it if you want two separate upgrade screens.** Having both a shop *and* a tech tree means two places to spend coins, which can be confusing. My suggestion: **fold the tech tree's five effects into the existing shop** as five more items, and keep one screen. You get the content without the extra navigation. The Auxiliary Shield Generator is the most interesting of the five and is worth keeping however you do it.

- **Your Call:** `[ Yt03 (separate tech tree) | Recommended Merge (fold into shop) | Drop it ]`

---

**Q62: Should tanks have different stats, or just different colours?** 🔴

- **Yt01:** **Pure cosmetics.** All six tanks play identically. Its documentation is explicit about this.
- **Yt02:** **Each tank is a build archetype with stat deltas** added on top of the base. Crimson Fang: +25 damage, +10 speed, −15 health. Emerald Guard: +40 health, +10 armor, +1 regen, −8 speed. And so on.
- **Yt03:** **Each tank sets your starting stats outright.** Crimson Striker *is* 80 health, 110% speed, 115% damage. Emerald Juggernaut *is* 140 health, 85% speed, 8 armor. Glacier Recon gets +10% crit. Void Spec-Ops starts with a shield. 24k Sovereign gets +50% coins and a fourth card choice.

- **Recommendation:** **Yt03's model.** Setting stats outright is easier to reason about than stacking deltas — "this tank has 140 health" is clearer than "this tank has 100 + 40 health, unless something else modified it first." It also avoids the revive bug Yt02 had to fix, where re-applying deltas on every revive let players stack the bonuses infinitely. Yt03's tank identities are also the most distinctive: only Yt03 has a tank that starts with a shield or gets an extra card.

- **Your Call:** `[ Cosmetics only (Yt01) | Deltas (Yt02) | Yt03 (absolute stats) ]`

---

**Q63: What should the tanks be called internally?**

- **Yt01 and Yt02:** The blue tank's internal name is `ice` but it is displayed as **"Glacier"**. Nothing breaks — the internal name is used consistently — but it is a mismatch waiting to cause a save-compatibility problem (see Q08).
- **Yt03:** Internal name is `glacier`, display name "Glacier". They match.

- **Recommendation:** **Yt03's naming** (`glacier`), with the save migration from Q08 handling anyone who has `ice` stored.

- **Your Call:** `[ glacier (Yt03) | ice (Yt01/Yt02) ]`

---

**Q64: Should the five one-run boosts stay?**

- **All three are identical:** Lucky Charm (+20% coins), Head Start (start with a free card), Card Reroll, Overcharge (+30% damage for 60 seconds), Aegis Kit (start with a charged shield). Prices rise each time you buy one.
- **Yt02 only:** fixed a bug where Aegis gave you nothing if you had no armor cards — it now grants a 20-point pool.

- **Recommendation:** **Keep all five, with Yt02's Aegis fix.**

- **Your Call:** `[ Keep as-is ]`

---

## SECTION I — VISUALS & INTERFACE (Q65–Q76)

---

**Q65: How should health be displayed?**

- **All three:** A number like `47/100` with a bar behind it. The bar goes green → amber below 60% → red below 30%, and pulses when you are nearly dead. Large numbers shrink and ellipsise rather than overflowing on small screens. The number never rounds up, so it cannot falsely show full health while regenerating.

- **Recommendation:** **Keep as-is.** This was a deliberate shared fix and all three implement it.

- **Your Call:** `[ Keep as-is ]`

---

**Q66: How should the speed and damage meters behave?** 🔴

- **Yt01:** **Live values, refreshed 15 times a second.** The meter shows your *actual current* damage and speed including Overcharge, Blast, Adrenaline and any slowdown. The bar fills to match the number (100% = a full bar). A green **BOOST** or amber **SLOWED** label appears. Speed is capped at 260% so it never shows a speed you cannot reach.
- **Yt02:** Live values in small pills at the top of the screen. The damage pill glows gold and shows a **countdown** while Overcharge is active (`130 ⏱42s`). The speed pill glows when hasted.
- **Yt03:** Base values only. Its death-screen readout is described in its notes as "live meters" but it actually reports raw stat numbers with no boosts applied.

- **Recommendation:** **Yt01's live meters as the base, with Yt02's Overcharge countdown added.** The whole point of a meter is that it tells the truth about what you are doing *right now*. Yt02's countdown is the best single piece of feedback in any of the three builds — knowing your damage boost expires in 8 seconds changes how you play.

- **Your Call:** `[ Recommended Merge | Yt01 | Yt02 | Yt03 ]`

---

**Q67: Should the HUD ever claim something the game does not do?** 🔴

**Yt01 currently does exactly this.** Its Adrenaline Rush card reads "+25% speed **& +5% damage**", and its damage meter shows 105% — but the actual firing code contains no Adrenaline term at all. You see 105% and deal 100%. Yt02 and Yt03 make no such promise; their card says "+25% speed" only.

- **Recommendation:** **Make the code match the card.** Add the +5% per stack to the actual damage calculation. It was clearly the intent, it is a one-line change, and it makes a single Adrenaline pick worth taking. The alternative — deleting the promise from the card text — is also acceptable but wastes the design.

- **Your Call:** `[ Add the damage bonus to the code | Remove the promise from the card ]`

---

**Q68: Should there be a radar minimap?**

- **All three:** Yes — a 112×112 radar tinted with the current theme's fog colour, showing enemies, glowing supply drops and a pulsing ring around bosses.
- **Yt02 and Yt03:** it is **retractable** — tap to shrink it out of the way.
- **Yt01:** not retractable.

- **Recommendation:** **Retractable (Yt02/Yt03).** On a phone screen, being able to reclaim the corner matters.

- **Your Call:** `[ Retractable | Fixed ]`

---

**Q69: Should there be a "damage is coming from there" indicator?**

- **Yt01:** No such feature.
- **Yt02:** **Yes and it works** — an arc on screen rotates to point at whoever shot you, then fades.
- **Yt03:** **The code is there but the on-screen element is missing**, so the function runs and immediately gives up. It is called every single time you take damage and does nothing.

- **Recommendation:** **Take Yt02's working version.** Knowing where a sniper is when you are taking fire from off-screen is essential information, and Yt03 clearly intended to have it.

- **Your Call:** `[ Yt02 (working indicator) | None ]`

---

**Q70: Should there be a hidden performance readout?**

- **Yt01:** No.
- **Yt02:** **Yes** — a diagnostics overlay showing frame rate, enemy count, bullet count, particle count and loaded world chunks, toggled by a setting.
- **Yt03:** **The code runs every frame but the on-screen element is missing**, so it computes all those numbers and throws them away. Wasted work, 60 times a second.

- **Recommendation:** **Take Yt02's working overlay, off by default.** It is the only way to diagnose a performance problem on a real device.

- **Your Call:** `[ Yt02 (working overlay) | None ]`

---

**Q71: What combat text should appear?**

- **Yt01:** `BLOCKED` when the shield saves you, `ARMOR DOWN` when the pool breaks.
- **Yt02:** `Shield absorbed the hit!` and `Armor depleted!` as banners.
- **Yt03:** `BLOCKED!`, `ARMOR` on a fully absorbed hit, `Armor shattered!`, and **`SLAM!`** in orange on heavy hits (45+ damage or a siege shot), with sparks.

- **Recommendation:** **Yt03's set, including `SLAM!`.** It is the most expressive and gives weight to big hits. Keep them all as toggleable combat popups (Q40).

- **Your Call:** `[ Yt03 (fullest set) | Yt01 | Yt02 ]`

---

**Q72: How should the pause screen be laid out?**

- **Yt01:** Core stats, then a deduplicated upgrade list with counts (`Missile ×2`), then evolutions. Tappable evolution details.
- **Yt02:** A **5-column grid with 10 cells** — max health, shield, regen, heal-per-kill, crit on the top row; speed, damage, fire rate, multishot, pierce below. Then cards, then evolution progress bars. The damage cell mirrors the HUD's Overcharge glow.
- **Yt03:** A 2-column layout, plus the three meters.

- **Recommendation:** **Yt02's 5-column grid.** It shows the most information in the least space, and the vitals-first ordering is the right priority.

- **Your Call:** `[ Yt02 (5-column grid) | Yt01 | Yt03 ]`

---

**Q73: What should the death screen show?**

- **Yt01:** Level, kills, coins, best score, bosses killed, highest combo, your build summary, a shop shortcut, and the revive button.
- **Yt02:** All of that **plus which world theme you died in and how many evolutions you unlocked.**
- **Yt03:** Run stats plus your armor pool and a final speed/damage/armor readout (base values, not boosted).

- **Recommendation:** **Everything: Yt02's context cells plus Yt03's final stat readout, and make the readout show boosted values** rather than base ones.

- **Your Call:** `[ Recommended Merge | Pick one build's version ]`

---

**Q74: Should graphics quality adjust itself?**

- **All three:** Yes — an Auto setting watches enemy count, bullet count, particle count and level, drops to Low when things stay heavy for a few seconds, and restores High when it calms down, with a small notification each time. Manual High/Low also available.

- **Recommendation:** **Keep as-is.** Identical and sensible.

- **Your Call:** `[ Keep as-is ]`

---

**Q75: What should the tank on the home screen do?**

- **All three:** A 3D tank on a spinning display platform wearing your equipped skin, with drag-to-spin.
- **Yt02:** the same 3D canvas is **moved** between the home screen and the pause screen rather than creating a second one — one graphics context, reused.
- **Yt01:** additionally shows your installed upgrade parts on the display model.

- **Recommendation:** **Yt02's reuse technique plus Yt01's upgrade parts.** Reusing the canvas is simply better engineering, and showing your build on the home tank is a nice touch.

- **Your Call:** `[ Recommended Merge | Pick one ]`

---

**Q76: Should the world be built from streaming chunks?**

- **All three:** Yes — an infinite world served in 48-unit chunks with a seeded random generator, so revisiting an area looks identical. Trees and rocks block bullets, which is real cover.

- **Recommendation:** **Keep as-is.** Identical, and it is what makes the endless world possible.

- **Your Call:** `[ Keep as-is ]`

---

## SECTION J — AUDIO & FEEL (Q77–Q80)

---

**Q77: What sound system do we use?**

- **All three are byte-for-byte identical:** 25 synthesized sounds generated by code, no audio files. Cannon fire, explosions, shield cracks, crits, level-up arpeggios, boss alarms, a victory fanfare, a continuous engine hum that rises with speed, and a wind bed that changes per world theme.

- **Recommendation:** **Take any one — they are the same.** No decision needed.

- **Your Call:** `[ Keep as-is ]`

---

**Q78: Should there be music?**

- **All three:** Yes — generative background music (bass pulse, pad, arpeggio) whose intensity follows how much combat is happening, with a separate toggle from sound effects.

- **Recommendation:** **Keep as-is.**

- **Your Call:** `[ Keep as-is ]`

---

**Q79: Should the phone vibrate?**

- **All three:** Yes, on level up, evolution picked, shield ready, hit blocked, and boss down, with a master switch.

- **Recommendation:** **Keep as-is.**

- **Your Call:** `[ Keep as-is ]`

---

**Q80: Should heavy hits stop time briefly?**

- **All three:** Yes — a very short hit-stop (0.04 seconds) when a boss is hit, to make big impacts land.

- **Recommendation:** **Keep as-is.**

- **Your Call:** `[ Keep as-is ]`

---

## SECTION K — NAMING, TEXT & CONVENTIONS (Q81–Q88)

---

**Q81: What naming style should the code use?**

- **All three:** The same — camelCase for variables and functions (`updatePhysics`, `armorPoolMax`), UPPER_CASE for fixed data tables (`ENEMY_TYPES`, `BOSS_KINDS`), and short lower-case identifiers for data records (`warlord`, `crimson`).

- **Recommendation:** **Keep it.** Consistent across all three, and changing it would touch every line for no benefit.

- **Your Call:** `[ Keep as-is ]`

---

**Q82: Should evolution names be spelled consistently?**

- **Yt01:** The evolution is called `afterburner` in the data, but the code that draws its tank part looks for `afterburn`. **The part never appears.**
- **Yt02:** Fixed — everything says `afterburn`.
- **Yt03:** Everything says `afterburner`, consistently, so it works.

- **Recommendation:** **Pick one spelling and use it everywhere.** I suggest `afterburner` because it is the word players see. This is the exact bug class that broke Yt01 and that Yt02 spent a patch fixing — it must not survive into the master build.

- **Your Call:** `[ afterburner | afterburn ]`

---

**Q83: Should card names be CAPITALISED or Title Case?**

- **Yt01:** Title Case — "Adrenaline Rush", "Cluster Warheads".
- **Yt02:** Mixed — Title Case in the card list, but its evolution data uses ALL CAPS ("NANITE HARVEST").
- **Yt03:** Title Case throughout.

- **Recommendation:** **Title Case everywhere.** All caps in a small card reads as shouting and is harder to scan.

- **Your Call:** `[ Title Case | ALL CAPS ]`

---

**Q84: What should the game be called on screen?**

- **Yt01:** Referred to in its notes as "TankThilteteYt"; the on-screen identity follows the tank-realm theme.
- **Yt02:** Locked by explicit design decision — title **"TANKTHILTETEYT"**, tagline **"CONQUER EVERY BIOME"**, with an "Industrial Command Hangar" visual theme on the home screen.
- **Yt03:** Same family.

- **Recommendation:** **Keep Yt02's locked title and tagline** unless you want a rebrand. It is the only build where the branding was a deliberate, recorded decision.

- **Your Call:** `[ Keep TANKTHILTETEYT / CONQUER EVERY BIOME | New title ]`

---

**Q85: How should future versions be numbered?**

- **Yt01:** `v1.4` → `v1.5` → `v2.html`.
- **Yt02:** `_011` → `_012`, zero-padded three digits, explicitly rejecting the `vX.Y` style.
- **Yt03:** `v1.4` → `v1.5`.

- **Recommendation:** **Semantic versioning: `1.0.0`.** Balance tweak = `1.0.1`, new feature = `1.1.0`, breaking change = `2.0.0`. It tells you at a glance how big a change was, which neither `_011` nor `v1.4` does.

- **Your Call:** `[ 1.0.0 semantic | _012 sequence | v1.5 style ]`

---

**Q86: What documentation should ship with the master build?**

- **Yt01:** Two documents — a plain-English "what the game is" and a development diary.
- **Yt02:** One large handoff document that claims to be the only file you need.
- **Yt03:** One handoff diary.

Across the three, **9 documented claims were outright false**, including formulas, feature counts, and "zero known bugs" statements.

- **Recommendation:** **Two documents, with a rule: every number in them is generated from the code, not typed by hand.** A short player-facing design document, and a technical reference where the tables (enemy stats, card values, boss numbers) are produced by a script. That is the only way to stop the documentation drifting away from the game again.

- **Your Call:** `[ Recommended Merge | Single handoff doc | None ]`

---

**Q87: What checks should run before every release?**

- **Yt01:** A syntax check on every embedded script block.
- **Yt02:** A syntax check plus a list of 19 required text strings that must be present. **This check passes on Yt02 today even though the enemy-damage formula it is meant to protect is wrong** — because it matches a fragment of text rather than testing behaviour.
- **Yt03:** A syntax check plus targeted searches on whatever changed.

- **Recommendation:** **Replace text-matching with real tests.** Specifically: run the coin calculation and assert the payout; run the evolution unlock check and assert it needs the right card counts; run the armor absorption and assert a fully soaked hit costs zero. Those four tests would have caught every P0 and P1 defect found in this audit. Keep the syntax check too.

- **Your Call:** `[ Recommended Merge (behaviour tests) | Keep text-matching ]`

---

**Q88: Anything I have not asked about?**

- **Recommendation:** Use this space. If there is a feature you want added, a mechanic you want removed, or a feeling you want the game to have that none of these three builds capture, say it here and it goes into the Phase 5 design document.

- **Your Call:** `[ Your notes ]`

---

## SUMMARY — THE 🔴 QUESTIONS

If you only answer nine questions, answer these. They are the ones that change how the game plays.

| # | Question | My recommendation |
|---|---|---|
| Q01 | Which build is the base? | **Yt03** |
| Q09 | Which game modes? | **Three, incl. Boss Rush** |
| Q17 | How does revive work? | **Yt01's full safety package** |
| Q25 | Maximum speed? | **Yt01's 260% cap** |
| Q26 | How does the gun pick targets? | **Yt01's smart targeting** |
| Q32 | What is armor? | **Yt03's % of health pool** |
| Q41 | Enemy difficulty curve? | **Yt01's** |
| Q42 | First boss tuning? | **Yt03's fully nerfed Warlord** |
| Q51 | Evolution unlock cost? | **Yt03's correct counting** |
| Q58 | Coin economy? | **Yt03 model + Yt01 tax, single function** |
| Q62 | Do tanks have stats? | **Yt03's absolute stats** |
| Q66 | Speed/damage meters? | **Yt01 live + Yt02 countdown** |
| Q67 | Adrenaline damage bonus? | **Make the code match the card** |

---

## WHAT HAPPENS NEXT

Once you have filled in your calls:

1. **Phase 5** — I write the consolidated Technical Design Document reflecting your decisions exactly, and stop for your authorisation.
2. **Phase 6** — I build the master codebase to that specification, with the four behaviour tests from Q87 running against it.

**Fastest path:** reply *"all recommended"* and I will proceed with every recommendation above, treating the 🔴 questions as answered in favour of the suggested option.
