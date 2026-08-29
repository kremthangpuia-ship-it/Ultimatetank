# 🎮 Tank Game — Handoff Diary & Developer Report

> **Purpose:** This file is the single source of truth for any AI or developer picking up this project. Read it in full before touching any code. It describes the game, its file/versioning conventions, what has been achieved, the current standing, and what comes next.

**Last updated:** 2026-08-29
**Active deliverable:** `TankThilteteYt03_v1.4.html`

---

## 1. Quick Facts

| Item | Value |
|---|---|
| Format | Single self-contained HTML file (all JS/CSS inlined, Three.js r128 inlined) |
| Genre | Top-down 3D arena survival shooter / "bullet heaven" with roguelite meta-progression |
| Rendering | Three.js r128, WebGL, infinite chunk-streamed world |
| Runs fully offline? | Yes — no external assets at runtime (PWA service worker is optional/non-fatal) |
| Enemy types | 27 regular + 6 bosses = 33 total (all in `ENEMY_TYPES`) |
| Boss types | 6 (Warlord, Tempest, Colossus, Titan, Nova, Fortress) |
| Evolutions | 12 defined · **all 12 wired into gameplay** (v1.3 fixed the 6 previously-inert ones) |
| Biomes | 10 |
| Tech-tree upgrades | 5 (armor, speed, shield, reroll, damage) |
| Skins (hulls) | 6 |
| Modes | Casual (endless w/ saves), Level Select, Boss Rush |
| Difficulty | 4 (Easy / Normal / Hard / Nightmare), set in Level Select config |
| Persistence | `localStorage` (gracefully falls back to in-memory if blocked) |

---

## 2. File Inventory & Naming Logic

### 2.1 Current files in `/home/user/`

| File | Size (bytes) | Role |
|---|---|---|
| `TankThilteteYt.html` | 1,097,015 | Original unified build (baseline, keep) |
| `TankThilteteYt_v1.1.html` | 1,100,317 | First hardened revision of the original |
| `TankThilteteYt02.html` | 1,097,015 | Archive copy of the original |
| `TankThilteteYt02_v1.1.html` | 1,100,317 | Archive revision copy |
| `TankThilteteYt03.html` | 1,100,317 | **Active stable baseline** (do not overwrite) |
| `TankThilteteYt03_v1.1.html` | ~1,110,723 | v1.1 revision (gameplay/UI fixes) |
| `TankThilteteYt03_v1.2.html` | ~1,116,891 | v1.2 (armor rework + all fixes) |
| `TankThilteteYt03_v1.3.html` | ~1,117,891 | v1.3 (fixed evolutions 7–12, gold cards, starting shield) |
| `TankThilteteYt03_v1.4.html` | ~1,121,894 | **← CURRENT ACTIVE FILE** (v1.4: 3D armor bar, SLAM! text, arrow keys, death-screen meters) |

### 2.2 Naming convention (MUST follow)

```
TankThilteteYt{NN}.html          → build generation (00 omitted, 02, 03, …)
TankThilteteYt{NN}_v{X}.{Y}.html → versioned revision of a generation
```

- **Generation number (`NN`)** increments only for a new "era" of the game (a major rework).
- **Version `v{X}.{Y}`** increments for each revision/feature-set on the current generation.
- **Rule 1 — Never modify an existing file.** Every change creates a **new** file with the next version number. Old files are kept intact forever as rollback points.
- **Rule 2 — `TankThilteteYt03.html` is the stable baseline.** Only overwrite it if the user explicitly approves promoting a newer version.
- **Rule 3 — The newest `v{X}.{Y}` is always the file under active development.**
- **Rule 4 — Never modify `/home/user/uploads/`** (read-only source references, see §3).

### 2.3 "Previous version check" logic (how to find the current version)

1. List `TankThilteteYt03*` files.
2. The highest `_vX.Y` suffix on the highest generation number is the current file.
3. When creating a new version, read the **current highest** file, apply changes, and write to `_v{next}.html` (or bump minor).
4. Sanity-check with `md5sum`: baseline `TankThilteteYt03.html` should match `74f94456c56703d56ca260a154ec52cd`; if it differs, someone edited the baseline (investigate before proceeding).

---

## 3. Source Uploads (READ-ONLY)

`/home/user/uploads/` contains the original third-party sources this game was unified from:

- `tank realm HUD.html`
- `tank realm HUD (2).html`
- `tank realm HUD3.html`
- `tank-eternal_1.13_biome.html`

These are **reference only**. They are never edited, never loaded at runtime, and never treated as deliverables. They are useful for recovering snippets (e.g. `dropTrackMarks` / `_trackMarkGeo` tread-mark code lives in `tank-eternal_1.13_biome.html`).

---

## 4. What the Game IS (complete description)

### 4.1 Core loop
1. Start a run from a **hull/skin** (6 choices) that sets base stats.
2. Survive an **infinite, chunk-streamed 3D world**. Enemies spawn in a ring around the player.
3. Kill enemies → earn **score, coins, XP**. XP levels you up.
4. **Each level-up = pick 1 of 3 upgrade cards** (game pauses during the pick).
5. Every **5th level a boss** arrives. Bosses drop guaranteed upgrades ("Boss Vault").
6. **Die** → spend coins to **Revive** (unlimited, cost scales ×4) or end the run. Coins/meta progress persist to the **Armory** shop for permanent upgrades.
7. Rinse/repeat with stronger permanent base stats.

### 4.2 Player stat model (important — understand these semantics)

| Stat | Meaning | Base | Raised by |
|---|---|---|---|
| `maxHp` | Max health pool (flat number) | 100 (skin varies 80–140) | Skin, shop "Reinforced Chassis" (+20/lvl, capped 12), card "Reinforced Hull" (+20/pick, uncapped), infinite shop items |
| `speed` | % multiplier over `CONFIG.playerSpeed` (18 u/s) | 100 | Skin, tech tree (+2/rank), shop "Turbine Engine" (+6/lvl, capped 8), card "Overdrive" (+10/pick) |
| `damage` | % multiplier over `CONFIG.baseDamage` (22) | 100 | Skin, tech tree, shop, card "Heavy Rounds" (+15/pick) |
| `fireRate` | % multiplier over `CONFIG.fireRate` (0.25s) | 100 | Skin, shop, card "Rapid Loader" |
| `armor` | **Armor pool = `armor% × maxHp`** (see §4.3) | 0 | Skin (Emerald +8), tech tree, shop "Spacer Plating", card "Composite Armor" (+8/pick) |
| `regen` | HP recovered per second | 0 | Card "Nano Repair" (+2/s), shop |
| `healOnKill` | HP recovered per kill | 0 | Card "Field Medic" (+3/kill) |
| `crit` / `multishot` / `pierce` / `splash` / `missile` / `adrenaline` / `shield` / `coinBonus` / `xpBonus` | Secondary combat/economy stats | 0 | Cards, skins, evolutions |

**Key insight:** `speed` and `damage` are **percentages**, not raw units. `100` = 100% = normal. The HUD/meters show these as `%`.

### 4.3 ★ Armor pool (the defining new mechanic, v1.2)
Armor is **not** flat damage mitigation anymore. It is a **rechargeable secondary shield pool**:

- **Pool size** = `floor(maxHp × (armorStat / 100))`. E.g. armor 8 at 100 HP → 8-point pool; at 200 HP → 16 points.
- **Absorption:** incoming damage drains the pool **first**. Only after the pool hits 0 does remaining damage spill into HP. A hit smaller than the pool = **0 HP damage**.
- **Recharge:** after **3 seconds without taking damage**, the pool refills at ~10%/s (own rate, independent of HP regen).
- **Pickup refill:** Repair kits and Shield Batteries restore the pool to full.
- **On upgrade:** picking armor or max-HP cards grows the pool ceiling (and heals it up on max-HP gain).
- **Persistence:** `armorHp` + `maxArmor` are saved/restored in mid-run saves.
- **Separate from the one-hit "Shield Generator"** (which still blocks a full hit before armor).

### 4.4 Enemies, bosses, biomes
- **33 total enemy types** in `ENEMY_TYPES` = 27 regular + 6 bosses, gated by level. Elites spawn from lvl 15 (gold-tinted, +40% HP/+15% dmg).
- **6 bosses** in `BOSS_KINDS`, each with unique AI (Warlord fan barrage, Colossus summons, Nova 8-way ring, Titan slam + phases, Tempest blink, Fortress spiral).
- **10 biomes** rotate every 3 levels. Biome traits are **cosmetic only** — `biomeTraitOf()` returns `null` (gameplay-affecting traits like "roots slow" / "heat" are disabled).
- **Water is fully removed** (per user request): `hasWater: false` everywhere, chunk water spawn disabled.
- **Enemy difficulty scaling** (`enemyLevelScale()`): damage = `1.0 + max(0,L-1)×0.048 + max(0,L-10)×0.016 + max(0,L-20)×0.022` (starts at 1.0× at level 1 — softened from 1.65× — then accelerates past lvl 10 and 20). HP/speed/points also ramp with level.

### 4.5 Upgrades & evolutions
- **16 upgrade cards** in `CHOICE_UPGRADES` (speed, damage, fireRate, maxHp, regen, armor, crit, multishot, pierce, coinBonus, healOnKill, xpBonus, adrenaline, missile, splash, shield).
- **12 evolutions** in `EVOLUTIONS` — each requires a specific 3-card combo (e.g. Cluster Warheads = 2 Missile Pod + 1 Shell Shock). They appear in the card pool when the recipe is owned.
  - **All 12 are wired into gameplay** (fixed in v1.3). Six apply runtime-behavior flags (cluster, bastion, prism, nanite, afterburner, siege); the other six apply flat stat boosts when picked via `applyEvolutionEffect()` (overkill, tempest, citadel, phaseLance, predator) or a fire-time behavior flag (missileRain).
- **First 5 upgrade picks** (levels 2–6) always offer **Nano Repair + Field Medic + one other** (user-requested sustain guarantee).
- **Card choices per skin honored** (fixed in v1.3): Gold skin gets 4 cards, all others 3 (read from `HULL_ARCHETYPES[skin].cards`).
- Rerolls exist via tech tree, shop, and consumables.

### 4.6 Supply drops / airdrops
- Start from **level 1**.
- **Aid drops**: first 5 levels offer **Repair 70%** of the time, then fully random (repair/shield/haste).
- Crates drop repair/overcharge/shield/coins/card/haste. Black Market crates (purple) open a shop mid-run.

### 4.7 Revive / continue
- **Unlimited revives** — coin cost = `round(300 × 4^(revivesSoFar))`. No cap.
- "Second Wind" (shop item) is a separate **once-per-run auto-revive** at 50%→75% HP.

### 4.8 Save/load
- `saveGame()` persists coins, meta (Armory), skins, casual saves, stats, achievements, dailies under key `tank_save`.
- Casual mode supports named mid-run saves (snapshot includes enemies, armor pool, cards, evolutions, biome).

---

## 5. What's Been Achieved (chronological phase history)

### Build unification (pre-versioning)
- Merged multiple source HTMLs into one working single-file game: `TankThilteteYt.html`.
- Hardened it (fixed the "update is not defined" ReferenceError, broken `playerStats` init, etc.) → `TankThilteteYt_v1.1.html`.
- Stress-tested: all scripts compile, armory/casual/enemies/bosses/evolutions simulate headless.

### v1.1 (`TankThilteteYt03_v1.1.html`)
1. **Revive unlimited** (removed "max 2 revives" cap, coin-scaling `300 × 4^n`).
2. **First 5 upgrades** always offer regen + heal-on-kill + one other.
3. **Airdrops from level 1**, repair 70% for first 5 levels.
4. **Warlord boss nerfed 50%** (speed 0.45→0.225, damage 20→10, bullet 36→18, interval 3.2→6.4).
5. **Water removed** from all biomes.
6. **HP/XP shown as numbers** (`100/100`, `47/100`, `120/250`), not percentages.
7. **Speed & damage meters** added to HUD + pause menu.
8. **Pause menu deduped** (upgrade cards grouped as `Missile Pod ×2`).
9. **Evolutions moved below the build**, shown as short text; tapping opens a **detail screen** (materials picked/needed, active status).

### v1.2 (`TankThilteteYt03_v1.2.html`) — current
**Phase 1 — Armor pool rework** (user's explicit new design): armor absorbs ALL damage until broken, then HP; recharges after 3s; pickups refill; separate from one-hit shield.
**Phase 2 — Glacier skin fix**: renamed `'ice'` → `'glacier'` so the skin's stats actually apply.
**Phase 3 — Meter honesty**: bars normalize to 100% = full; meters show live effective values (Haste/Adrenaline/Overcharge/blast); gold "boosted" glow on temp buffs.
**Phase 4 — Display gaps**: pause menu shows max-HP & heal-on-kill; HP number uses `round` (matches bar); HP/XP shrink-to-fit.
**Phase 5 — Balance**: enemy opening damage softened (1.65×→1.0×, user chose "soften"); Adrenaline stack-1 fixed (was a dud — `Math.max(1, …)` floor removed); early-card guarantee kept repeating (user choice).
**Phase 6 — Armor persistence & live meters**: armor saved/restored in mid-run saves; live meter values; armor shown on death screen.
**Meter size fix**: SPD/DMG/ARM shrunk into one compact horizontal lane.

### v1.3 (`TankThilteteYt03_v1.3.html`) — current
**Bug fix 1 — Evolutions 7–12 now work.** The six previously-inert evolutions were wired in: `overkill` (+20% dmg, +1 multishot), `tempest` (+20% fire rate, +12% crit), `citadel` (+35 max HP, +8 armor, +1 regen), `phaseLance` (+2 pierce, +15% dmg, +8% crit), `predator` (+4 heal/kill, +15% speed, +1 adrenaline) apply real stat changes via `applyEvolutionEffect()`; `missileRain` fires homing missiles 50% faster in dual salvos. All six also got tank-model visuals.
**Bug fix 2 — Gold skin "4 Card Choices"** now actually grants 4 cards (was hardcoded to 3).
**Bug fix 3 — Starting shield** (Void skin / Auxiliary Shield Gen tech) is no longer overwritten; it now starts charged unless loading a saved run.

### v1.4 (`TankThilteteYt03_v1.4.html`) — current
**Polish 1 — 3D armor bar** floats above the player tank (a canvas sprite child of the tank mesh, mirrors the HUD armor pool; blue bar + `current/max` label; hidden when pool is 0).
**Polish 2 — `SLAM!` floating text** on heavy non-crit hits (bullet damage ≥ 45 or a siege shot), with orange sparks.
**Polish 3 — Arrow keys** now drive movement alongside WASD.
**Polish 4 — Death-screen live meters** show final `⚡ SPD / 💥 DMG / 🛡️ ARM` under the build summary.

---

## 6. Current Standing

### ✅ Working correctly (verified)
- Full compile of all inline scripts (0 syntax errors).
- Core loop, 27+6 enemies, 6 bosses, **all 12** evolutions (6 behavior + 6 stat-boost + 1 missile behavior), 10 biomes, 6 skins, 5 tech upgrades.
- Armor pool absorb/recharge/pickup/persist behavior (assertion-tested).
- All v1.1/v1.2/v1.3 fixes (assertion-tested: ~50 checks passing).
- Glacier skin stats, numeric HP/XP, deduped pause list, evolution detail screen, live meters.
- Gold skin 4-card choice, starting shield, evolutions 7–12.
- 3D armor bar, `SLAM!` text, arrow keys, death-screen meters.

### 🔴 Known bugs
- **None currently known.** The three bugs found during the handoff review (inert evolutions 7–12, ignored Gold card count, overwritten starting shield) were all fixed in v1.3.

### ⚠️ Known limitations / things to watch
1. **Biome traits are inert** (`biomeTraitOf` → `null`). Intentional (cosmetic biomes), but the `_rootSlow`/`_traitHot` code is now dead — safe to ignore or remove.
2. **`updateHUD()` is throttled** during regen/recharge (refreshes ~5 Hz) — HP number can lag a hair behind reality during fast healing.
3. **Aiming is auto-lock only** — no mouse raycast aim (touch right-half just fires).

---

## 7. Next Plan

### Immediate (ready to implement — low risk)
- *(The four low-risk polish items are now done in v1.4.)*

### Balance decisions (ask user before changing)
5. **Adrenaline cap**: currently stacks unbounded (+25%/stack during kill-haste) — consider a soft cap.
6. **Run-card speed cap**: no ceiling on stacking Overdrive in long runs — decide if/when to clamp.
7. **Warlord further tuning**: user may want the nerf adjusted after playtesting.
8. **Armor recharge rate** (10%/s after 3s) — confirm the feel; may want faster/slower.

### Polish / possible
9. Re-enable selective biome traits (roots slow, heat) with a visible warning indicator (was disabled in an earlier "cosmetic biomes" decision).
10. PWA publication over HTTPS for installable/offline app.

### Long-horizon
- More evolutions, enemy variety, boss patterns, or a second armor dimension if the pool mechanic lands well.

---

## 8. How to Validate a Change (run these every time)

```bash
# 1) Syntax-check all inline scripts
node -e "
const fs=require('fs'),vm=require('vm');
const html=fs.readFileSync('TankThilteteYt03_v1.4.html','utf8');
const re=/<script\b[^>]*>([\s\S]*?)<\/script>/gi; let m,i=0;
while((m=re.exec(html))!==null){i++;new vm.Script(m[1]);}
console.log('OK: '+i+' scripts compile');
"

# 2) Text assertions (spot-check the thing you changed)
#    e.g. grep for armor pool functions, live meter formulas, etc.

# 3) Present the file and give the user a "what to check in-game" list.
```

**Golden rules for validation:** never ship without the syntax check; always do targeted `grep`/assertion checks on the exact lines you changed; always give the user a concrete in-game test checklist.

---

## 9. Conventions & Rules for Future AI / Devs

1. **Single file, no build step.** All changes are text edits into one HTML file. No npm, no bundler.
2. **Version, don't overwrite.** Always write a new `_vX.Y` file. Preserve rollback history.
3. **Never touch `/home/user/uploads/`.** Ever.
4. **Never touch the baseline `TankThilteteYt03.html`** unless the user explicitly approves promotion.
5. **`playerStats` is the single source of truth** for speed/damage/fireRate/armor/maxHp/etc. Everything (movement, shooting, armor pool) reads from it. `player.hp`/`player.maxHp`/`player.maxArmor`/`player.armorHp` are the live per-tank values.
6. **All game code shares one top-level `<script>` scope** (Three.js is in a separate inlined IIFE). Functions like `updateHUD`, `renderBuildList`, `showEvolutionDetails` are plain function declarations, so helpers can be added anywhere in that script and are callable globally.
7. **`dom(id)`** is the cached DOM getter; prefer it over `document.getElementById` in hot paths.
8. **`state.runTime`** is the pause-proof clock — use it (not `clock.getElapsedTime()`) for gameplay timers.
9. **Keep the user-facing numbers honest**: if a value changes at runtime (buffs, slows), the displayed value should reflect it (see Phase 3/6 work).

---

*End of handoff report. Keep this file updated as new versions ship.*
