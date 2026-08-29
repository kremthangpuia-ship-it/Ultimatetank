# DEVELOPMENT DIARY — TankThilteteYt

This is the **living handoff log** for this project. It is written so that a brand-new AI session (or a fresh collaborator) can open this single file and be **immediately caught up** on: what the game is, which file is the current one, what's done, what's next, and what the human wants.

> For a full plain-English explanation of **what** the game is and how every system works, see **`GAME_STATUS.md`**. This file is the **when/what's-next** log.

---

## TL;DR for the next session (read this first, ~15 seconds)

- **Game:** a single-file 3D auto-aim tank survival arena shooter for phones (`TankThilteteYt01.html`). Feature-complete **v1.0**.
- **Current working version file:** **`TankThilteteYt01_v1.4.html`** — **v1.4 tweaks are APPLIED** (this is the live, updated build to test).
- **Frozen baselines (do NOT edit):** `TankThilteteYt01.html` (v1.0), `TankThilteteYt01_v1.1.html` (v1.1), `TankThilteteYt01_v1.2.html` (v1.2), `TankThilteteYt01_v1.3.html` (v1.3).
- **The human is playtesting.** v1.3 ("HUD tells the truth") is frozen; v1.4 is a tuning pass (speed cap, Adrenaline stack-1 bonus, honest armor readout already in the top HUD). My next job: get their reaction and continue.
- **The single most important question to ask the human:** *"Test v1.4 — does capping top speed keep the tank controllable, does the Adrenaline Rush card feel worth taking (speed + damage), and does the speed meter still read honestly?*"

**v1.2 change batch (all applied & syntax-verified, now frozen):**
1. **Armor is now a real soak pool** (not a % discount). It absorbs ALL incoming damage until it reaches zero, THEN the leftover hits your HP. Old 55% cap + "always 3 damage" floor removed. Shows `ARMOR DOWN` when it breaks.
2. **Armor refills from regen** — armor rebuilds at the same rate as your regen stat (more regen = faster armor back).
3. **Armor refills from pickups** — repair kits, shield batteries, and airdrops restore armor to full (repair crate/orb, shield crate/orb, Black-Market Full repair, Black-Market Shield charge).
4. **Armor shows on the HUD** — a small blue armor bar under the HP number (with `x/y` value), hidden when you have no armor.
5. **Picking the Composite Armor card** raises the soak pool cap AND tops the pool up by the same amount.
6. **Pause menu now shows Max HP (`❤️ x HP`) and Heal/Kill (`💗 x/kill`)** in addition to the other stats.
7. **Early enemy damage toned down** — enemy damage scale now starts at ~1.0× at Level 1 (was 1.65×), so a Level-1 basic enemy hits near its listed base damage. Still ramps naturally with level.
8. **Early card guarantee changed from 5 picks to 3** — the first 3 upgrades always offer Health Regen + Heal-on-Kill + one other; after pick 3 it's fully random.

**v1.3 change batch (all applied & syntax-verified, now frozen) — Phase 2 "HUD tells the truth":**
1. **Damage/Speed meter now shows LIVE values** — base % × Overcharge (1.3×) × Blast (1.2×) for damage; base % × Haste/Adrenaline boost × roots slowdown for speed. The bars now fill to match the number (100% = a full bar, not a divided-down half bar).
2. **Added a status label on the SPD meter** — shows **BOOST** (green) during Haste/Adrenaline and **SLOWED** (amber) during the roots biome slow; the bar recolors too.
3. **Meter refreshes every 0.15s** from the animate loop so boosts/slows respond live even when regen is off.
4. **HP no longer rounds up** — the readout uses `Math.floor(player.hp)` so it never falsely shows max while regenerating (armor readout uses floor too).
5. **Big HP/XP numbers are overflow-safe** — the value now auto-shrinks (`clamp`) and ellipsizes instead of overflowing the box on small screens.
6. **Armor pause chip now reads `🛡️ x armor`** so it's clear it's a soak shield, not a level number.

**v1.4 change batch (all applied & syntax-verified) — tuning pass:**
1. **Top speed capped** — added `CONFIG.playerSpeedMaxMult` (2.6× ≈ 260% of base). Both the player's actual movement speed and the SPD meter are clamped to it, so stacking Overdrive cards + Adrenaline can't make the tank uncontrollable on a touch joystick, and the meter never claims a speed the tank can't reach.
2. **Adrenaline stack-1 is a real reward** — each Adrenaline Rush stack now also grants **+5% damage** while the burst is active (on top of +25% speed). Because it's a separate multiplier, a single Adrenaline stack is never swallowed by the speed cap. Card text and the DMG meter reflect it.
3. **Armor readout** — the visible armor value was already in the **top** HUD (blue `x/y` bar under HP) and the pause chip; the old "bottom HP panel" is `display:none`/unused in this build, so no hidden dead-code panel was added.

---

## Versioning convention (how we preserve old versions)

We never overwrite. Each "release" is its own file. Old versions stay in the repo forever so we can always revisit them.

| Version | File | Status |
|---|---|---|
| v1.0 | `TankThilteteYt01.html` | **Frozen baseline. Do NOT edit.** Feature-complete. |
| v1.1 | `TankThilteteYt01_v1.1.html` | Frozen. v1.1 tweak batch applied. |
| v1.2 | `TankThilteteYt01_v1.2.html` | Frozen. v1.2 tweak batch applied (armor soak system, early-game balance, card guarantee = 3 picks). |
| v1.3 | `TankThilteteYt01_v1.3.html` | Frozen. v1.3 tweak batch applied (Phase 2 HUD-truth fixes). |
| v1.4 | `TankThilteteYt01_v1.4.html` | **Current working version.** v1.4 tuning batch applied (speed cap, Adrenaline stack-1 damage bonus, honest meter). |
| v2.0 | `TankThilteteYt01_v2.html` | (future — when we bump to the next release) |

**Naming rule going forward:** every time we land a batch of confirmed, working changes, copy the current file to the next version name, edit the new file for the next batch, and add a row to this table with a one-line changelog. Adding a new version file is **safe** — the older one is untouched.

---

## Files in the repository (what's what)

| File | What it is |
|---|---|
| `TankThilteteYt01.html` | **v1.0 — the finished game.** Frozen baseline. |
| `TankThilteteYt01_v1.1.html` | Frozen. v1.1 tweak batch applied (regen cards, airdrop tweaks, Warlord nerf, no water, number HP/XP bars, DMG/SPD meter, cleaner pause + evolution detail page). |
| `TankThilteteYt01_v1.2.html` | Frozen. v1.2 tweak batch applied (armor soak system, early-game balance, card guarantee = 3 picks). |
| `TankThilteteYt01_v1.3.html` | Frozen. v1.3 tweak batch applied (Phase 2 HUD-truth fixes: live DMG/SPD meters, BOOST/SLOWED labels, no HP round-up, overflow-safe numbers). |
| `TankThilteteYt01_v1.4.html` | **Current working version.** v1.4 tuning batch applied (top-speed cap, Adrenaline stack-1 damage bonus, honest SPD meter). |
| `tank realm HUD.html` | Older/experimental build from an earlier stage. Preserved, not the main one. |
| `tank realm HUD (2).html` | Older/experimental build. Preserved. |
| `tank realm HUD3.html` | Older/experimental build. Preserved. |
| `tank-eternal_1.13_biome.html` | Older/experimental build. Preserved. |
| `index.html` | **Live entry point (Option A).** It's a tiny launcher that opens the current versioned game file (`TankThilteteYt01_v1.4.html`); it's PWA-eligible and registers the SW. Update its redirect target (and the sw `ASSETS`) when we cut a new version. |
| `manifest.webmanifest` | PWA manifest (name, icons, portrait, standalone). |
| `sw.js` | PWA offline service worker (network-first pages, cache-first assets). Pre-caches `./`, the manifest, icons, AND the game file so install works offline. |
| `icon-192.png` / `icon-512.png` | PWA app icons. |
| `GAME_STATUS.md` | Full plain-English explanation of the whole game. |
| `DEVELOPMENT_DIARY.md` | **This log.** |

---

## Current status (verified this session)

- v1.4 tuning batch **applied and syntax-verified** (all 3 embedded script blocks → **0 errors**).
- `refreshCombatMeter()` extracted and smoke-tested against a stub DOM — runs without throwing; live math verified: baseline 100/100, overcharge → 130% dmg, adrenaline burst → 125% spd + 105% dmg (1 stack), speed 300 → capped at 260% both in the meter and in the actual movement clamp, roots slow → 80% spd, speed 200 + 3 Adrenaline + Afterburner → capped at 260%.
- Confirmed via live server: v1.4 serves 200 with `playerSpeedMaxMult`, `adrDmg`, `spdShown`, the player `speed > cap` clamp, and the `+5% damage` Adrenaline desc all present.
- Armor soak math (from v1.2) still verified: armor absorbs all damage until 0, then leftover hits HP.
- Kept: all 6 bosses, 4 difficulties, save code, embedded Three.js, PWA files.
- v1.0, v1.1, v1.2, v1.3 are frozen. All older builds untouched.

---

## What the game IS (one paragraph, details in `GAME_STATUS.md`)

3D auto-aim tank survival arena shooter, portrait phone touch controls. You drive a tank; the cannon aims and fires automatically. Core loop: **drive → auto-fire → kill → coins/XP → level up by picking 1 of 3 cards → boss every 5 levels → biome change every 3 levels → die → spend coins in shop → stronger run.** 33 enemies, 6 phased bosses, 10 visual biomes, 15-card build system with 6 evolutions, permanent shop + 6 skins + consumables, 14 achievements, 4 difficulties, revive/save systems, comfort/accessibility settings, PWA offline package.

---

## Completed / frozen versions log

| Date | Version | What changed |
|---|---|---|
| 2026-08-28 | v1.0 | Feature-complete initial release. All 106-question blueprint systems built and verified. |
| 2026-08-29 | v1.1 | First 5 upgrades always offer Health Regen + Heal-on-Kill + one other; airdrops start at L1 and heal 70% of the time for first 5 levels; Warlord (first boss) projectile speed & damage halved; all water removed from every biome; HP/XP bars show numbers (47/100) not %; added live Damage/Speed HUD meter; pause menu redesigned (deduped upgrades with ×counts, tappable evolution detail page). |
| 2026-08-29 | v1.2 | Armor is now a real soak pool (absorbs all damage until it breaks, then HP); armor refills from regen stat + repair/shield/airdrops; armor bar added to HUD; armor card tops pool; pause shows Max HP + Heal/Kill; early enemy damage toned down (~1.0× at L1); early card guarantee reduced to first 3 picks. |
| 2026-08-29 | v1.3 | Phase 2 "HUD tells the truth": DMG/SPD meter shows live values (base × boosts × slows) with bar filling to the number (100% = full); added BOOST/SLOWED status label + recolor; meter refreshes every 0.15s from the loop; HP no longer rounds up (uses floor); big HP/XP numbers overflow-safe (auto-shrink + ellipsis); armor pause chip reads `x armor`. |
| 2026-08-29 | v1.4 | Tuning pass: capped top speed at `CONFIG.playerSpeedMaxMult` (2.6×, so 260% of base) in BOTH actual movement and the SPD meter; each Adrenaline Rush stack now also grants +5% damage during the burst (so stack-1 is never swallowed by the speed cap); updated Adrenaline card text + DMG meter. Armor was already read out visibly in the top HUD, so no hidden bottom-panel was added. |

---

## ✓ Verified TRUE findings (consolidated from 3 analyses) + what was done

| Finding | Status | Action |
|---|---|---|
| Armor was a hidden % discount (55% cap + 3 dmg floor), wasted past a point | ✅ TRUE | ✅ FIXED in v1.2 (real soak pool). |
| Armor had no visible display / feedback | ✅ TRUE | ✅ FIXED in v1.2 (armor bar + `ARMOR DOWN`). |
| Speed/DMG meter bar looked half-full at 100% (scaled ÷2 / ÷3) | ✅ TRUE | ✅ FIXED in v1.3 (bar fills to match number, 100% = full). |
| Meter only shows base %, ignores Haste/roots slowdown | ✅ TRUE | ✅ FIXED in v1.3 (live values + BOOST/SLOWED labels). |
| Pause menu missing Max HP + Heal/Kill | ✅ TRUE | ✅ FIXED in v1.2. |
| Enemies hit too hard at L1 (×1.65 on top of base) | ✅ TRUE | ✅ FIXED in v1.2 (now ~1.0× at L1). |
| Early card guarantee repeats same 2 cards | ✅ TRUE | ✅ Kept but reduced 5 → 3 picks (user choice). |
| HP rounds up by 1 during regen (cosmetic) | ✅ TRUE | ✅ FIXED in v1.3 (uses floor). |
| Big HP numbers may overflow small screens | ✅ TRUE | ✅ FIXED in v1.3 (auto-shrink + ellipsis). |
| Stacked speed cards can make the tank too twitchy | ✅ TRUE | ✅ FIXED in v1.4 (top-speed cap at 260%, in movement + meter). |
| Adrenaline stack-1 feels too weak to notice | ✅ TRUE | ✅ FIXED in v1.4 (+5% damage per stack during the burst). |
| Armor value not shown where expected | ✅ TRUE | Already shown in the top HUD (blue `x/y` bar) + pause chip; no hidden bottom panel exists in this build. |
| "Skin gives stat bonuses / Glacier name mismatch / skin stats lost on revive" | ❌ **FALSE** | Skins are cosmetic-only (no stat system exists). No fix needed. |

**Open policy:** The three analyses agreed on two real problems — armor, and "metabars don't match reality." Both are resolved: the **armor soak redesign** (v1.2) and the **Phase-2 HUD-truth fixes** (v1.3). The v1.4 tuning pass closed out the last open gameplay items (top-speed cap, Adrenaline stack-1 bonus). Nothing remains on the flagged list; the next batch is player feedback.

---

## The current plan (next steps, in order)

1. **Playtest v1.4 (human).** On the live preview **and ideally a real phone.** Open `http://localhost:8123/TankThilteteYt01_v1.4.html`. Focus: does the **top-speed cap** keep the tank controllable on a touch joystick; does **Adrenaline Rush** (1 stack) now feel worth taking (speed + damage); does the **SPD meter** still read honestly (capped at 260%, shows BOOST/SLOWED).
2. **Collect feedback.** Is the cap too low / too high? Is Adrenaline balanced? Any other balance note?
3. **Next batch is player feedback-driven.** No v1.5 items are pre-planned; ask the human what still feels off, or whether to move to publishing.
4. **Publish over HTTPS** so it installs as an app. Suggested free static hosts: GitHub Pages, Netlify, Vercel, or Surge. Upload the static bundle: `index.html` + the current game file (`TankThilteteYt01_v1.4.html`) + `manifest.webmanifest` + `sw.js` + `icon-192.png` + `icon-512.png`.
   - **PWA decision RESOLVED (Option A):** the manifest's `start_url`/`scope` stays `./`, and the sw caches `./`. We added an `index.html` that opens the current versioned game file, so `./` now works on every host. **On each future release:** update the redirect target in `index.html` AND the game filename in `sw.js`'s `ASSETS` list, then re-upload. (`./` = the site front door → hosts serve `index.html` → it opens the game.)
5. **Log every decision** in this diary so any future session is caught up.

---

## Open questions for the human (ask these at the start of the next session)

- Test v1.4 — does the **top-speed cap (260%)** feel right? Too restrictive, or does the tank finally stay controllable on the joystick? Does **Adrenaline Rush** at 1 stack now feel worth taking (speed + damage)? Does the **SPD meter** still read honestly?
- After all four versions, how does the **armor soak system** feel — right pool size, good break pace, good regen refill?
- Is the **early game** fairer now?
- Which difficulty are you mostly playing (Easy/Normal/Hard/Nightmare) — too easy or too hard?
- ✅ **Resolved (Option A):** we added `index.html` so the game loads at `./` for the PWA install. On each new version, update the redirect in `index.html` + the sw `ASSETS` filename.
- Any new feature you want next, or are we purely polishing? (No v1.5 items are pre-planned — this batch is feedback-driven.)

---

## If the game needs a change — the workflow

1. **Edit the current working file** (`TankThilteteYt01_v1.4.html`). **Never edit the frozen baselines** `TankThilteteYt01.html`, `TankThilteteYt01_v1.1.html`, `TankThilteteYt01_v1.2.html`, `TankThilteteYt01_v1.3.html`.
2. Test on the live preview (`python3 -m http.server` in the repo root, open `/TankThilteteYt01_v1.4.html`).
3. When the change works and the human is happy, copy current → next version filename, and add a row to the "versions log" table above with a one-line changelog.
4. Update this diary's "TL;DR", "current version", and "current plan" so the next session reads the right thing.

---

## Technical reference (safe commands)

```bash
# Run the live preview (serves everything in this folder)
cd /home/user/4tanksrealm
python3 -m http.server 8123 --bind 0.0.0.0
# then open http://localhost:8123/TankThilteteYt01_v1.4.html
```

```bash
# Verify each embedded <script> block has valid syntax (no errors)
node -e '
const fs=require("fs"),vm=require("vm");
const html=fs.readFileSync("./TankThilteteYt01_v1.4.html","utf8");
const re=/<script\b([^>]*)>([\s\S]*?)<\/script>/gi; let m,i=0,ok=0,bad=0;
while((m=re.exec(html))){ if(/src\s*=/.test(m[1]))continue; i++; try{new vm.Script(m[2]);ok++;}catch(e){bad++;console.log("ERR",e.message);} }
console.log("blocks="+i+" ok="+ok+" err="+bad);'
```

```bash
# Check md5 to confirm two files are identical
md5sum TankThilteteYt01.html TankThilteteYt01_v1.1.html TankThilteteYt01_v1.2.html TankThilteteYt01_v1.3.html TankThilteteYt01_v1.4.html
```

```bash
# Quick armor soak math check (node one-liner)
node -e '
function h(p,a){let i=a,s=0,c=Math.max(0,p.armor||0),h=c>0;if(c>0){if(a<=c){s=a;p.armor=c-a;i=0;}else{s=c;p.armor=0;i=a-c;}}const d=Math.max(0,i);p.hp-=d;return{d,s,a:p.armor,h&&p.armor<=0};}
let p={armor:24,hp:100};console.log("armor24 hit30 ->",h(p,30),"hp:",p.hp);'

---

## Intent of this project

Make a genuinely fun, playable, installable mobile tank survival game that lives in a single HTML file, keep a clean archive of every version so we never lose work, and make sure any future AI session can pick up the exact plan in seconds.
