# MASTER BUILD STATUS — TankGameAi

Base build: **Yt02** (`TankThilteteYt02_011.html`) — decision **Q001**
Shipped artifact: **`TankGameAi_001.html`** — decision **Q002**
Source layout: **split sources in `src/`, concatenated by `tools/build.js`** — decision **Q123**
Decisions on record: **131** (from `DECISION_CHECKLIST ANSWERED.docx`, commit `44be16b`)

```
node tools/split.js      # one-time: re-extract src/ from the Yt02 base (lossless-verified)
node tools/build.js 001  # assemble TankGameAi_001.html from src/
node tools/check.js      # release harness: 4 smoke checks + 4 behaviour tests
node tools/test-boot.js  # boot the built file in jsdom, report runtime errors
```

---

## Verified right now

`node tools/check.js` → **29/29 checks passed**.

| Check | Result |
|---|---|
| all 4 embedded script blocks parse | PASS |
| no duplicate top-level declarations (D-03) | PASS |
| must-have: crash overlay / diag overlay / damage-direction element | PASS ×3 |
| must-have: `applyReviveSafety`, `hushHostileFire` | PASS ×2 |
| external telemetry + Cloudflare challenge stripped (Q004) | PASS ×2 |
| afterburner spelling unique (Q134) | PASS ×2 |
| boots in jsdom with zero runtime errors | PASS |
| **B1** coin payout applies Scavenger exactly once (Q054) | PASS |
| **B2** evolution needs required COUNTS, not presence (Q131) | PASS |
| **B3** fully soaked armour hit costs 0 HP (Q128) | PASS |
| **B4** revive sets a real spawn pause (Q073/D-08) | PASS |
| **B5** enemy damage curve matches Yt03 numbers; presets swap live (Q031/Q032) | PASS |
| **B6** snapshot deep-copies the evolution counter (Q115) | PASS |
| **B7** `noteRunCard` populates the force-offer guard's ownership list (Q022) | PASS |
| **B8** missile volley caps at 10, extra stacks become overload (Q013) | PASS |
| **B9** Adrenaline is 60s, +5%/stack damage is real, meter matches movement (Q011) | PASS |
| **B10** armour pool derives from max HP, stamps delay clock, refills (Q016/17/18) | PASS |
| **B11** Warlord shells at 18 and interval 6.4s; other bosses untouched (Q039) | PASS |
| **B12** cover takes exactly two player shells at any level (Q047) | PASS |
| **B13** saves migrate `ice`→`glacier`, v2 slots carry over, bad fields degrade (Q125/Q117) | PASS |
| **B14** 10 biomes / 3 levels / 10s morph, with fire-hush and spawn pause (Q044) | PASS |
| **B15** consumables price ×3 per step and reset every 5; Armory unchanged (Q064) | PASS |
| **B16** six bespoke phase fights, generic enrage fallback, summon honours count (Q038) | PASS |
| **B17** Workshop tree works, Second Wind removed, ranks clamped on load (Q062/63/116) | PASS |

`tools/split.js` round-trips the Yt02 game script **exactly** (423,170 chars both ways), so the
decomposition into `src/` is provably lossless. The built file differs from Yt02 only by the
intended deltas listed below.

---

## Decisions implemented so far

| Decision | What changed | Where |
|---|---|---|
| **Q001** | Yt02 adopted as the base skeleton | `tools/split.js` source |
| **Q002** | Output named `TankGameAi_001.html`, never overwritten | `tools/build.js` |
| **Q004** | Cloudflare Insights beacon + challenge iframe removed | `tools/split.js` (lines 9606-9607 not carried) |
| **Q007** | `<title>` and home-screen `<h1>` now read `TankGameAi` | `src/00_head_open.html`, `src/06_dom.html` |
| **Q010** | `CONFIG.playerSpeedMaxMult = 2.6` exposed as a tunable constant | `src/10_data.js` |
| **Q054** | Kill-payout chain rewritten; bonuses apply **once**; `CONFIG.killPayoutScale = 0.5` exposed. Fixes **D-01** (Scavenger + Lucky Charm were squared) | `src/40_persist_polish.js` |
| **Q098** | Balance constants begin centralising in `CONFIG` | `src/10_data.js` |
| **Q119 / D-03** | Three duplicate top-level declarations deleted (dead copies of `addKillReward`, `updateCombo`, `quickSaveFromPause`) | `src/38_cards_evos.js`, `src/32_run_flow.js` |
| **Q123** | Split sources + one-command concatenation build | `src/`, `tools/build.js` |
| **Q128 / D-07** | Hidden 1-damage floor removed for the player | `src/26_tank_combat.js` |
| **Q131 / D-02** | `runCardsObj` now incremented in one place; `eligibleEvolutions()` is count-based off `EVOLUTION_CARDS.requires{}`; Missile Rain recipe de-duplicated to `2 missile + 1 multishot` | `src/38_cards_evos.js`, `src/30_meta.js` |
| **Q134** | `afterburn` → `afterburner` everywhere, incl. `evo_afterburner`; grep-enforced | 4 files |
| **Q135** | Evolution card names converted to Title Case | `src/30_meta.js` |
| **Q073 / D-08** | `applyReviveSafety()` and `hushHostileFire(5)` now actually called on revive; toast text corrected | `src/34_physics_hud.js` |
| **Q137 / Q096** | Release harness: syntax + duplicate-decl + must-have greps + the four behaviour tests | `tools/check.js` |
| **Q011** | Adrenaline Rush: 1.5s flicker → 60s refreshed buff with a live countdown; the +5%/stack damage Yt01 advertised but never applied (**D-05**) is now real in `shoot()`; movement, damage and meter read one pair of helpers | `src/26_tank_combat.js`, `src/34_physics_hud.js`, `src/28_pause_boss.js`, `src/38_cards_evos.js` |
| **Q013** | Missile cadence fixed at 5s; stack count sets volley size, capped at 10; stacks past the cap widen (+8%) and strengthen (+10%) the blast | `src/26_tank_combat.js`, `src/34_physics_hud.js` |
| **Q016** | Yt03's armour model: pool = `floor(maxHp × armor/100)`, recharge only after a 3s clean window at 10%/s. Storage stayed on `state` so Yt02's overlay survives | `src/26_tank_combat.js`, `src/34_physics_hud.js`, `src/32_run_flow.js`, `src/38_cards_evos.js` |
| **Q017** | Repair kits fully refill; armour **and** max-HP cards re-derive the pool and credit the growth | `src/32_run_flow.js`, `src/38_cards_evos.js` |
| **Q018** | Aegis Kit's 20-point base pool kept (now `CONFIG.armor.aegisBasePool`), gated to fresh runs only | `src/32_run_flow.js` |
| **Q031** | `CONFIG.enemyDmg {base,slope,mid,late}` + `enemyCurvePresets` (Yt03 default, Yt01 easy). Yt02's stray `*1.5` removed (**D-04**) | `src/10_data.js`, `src/28_pause_boss.js` |
| **Q032** | `CONFIG.enemyHp {base,perLevel}` — enemy HP now +3%/level | `src/10_data.js`, `src/28_pause_boss.js` |
| **Q115 / Q022** | Both were already correct in the Yt02 base; B6 and B7 now guard them against regression | — |
| **Q039** | Warlord shells 36→18, barrage interval 3.2s→6.4s (Yt03's nerf). Other five bosses untouched | `src/10_data.js`, `src/28_pause_boss.js` |
| **Q044** | `CONFIG.biome`: 10 realms, every 3 levels, 10s gradual morph. Fire-hush 1.5s and spawn pause 3s now applied on realm change, not just revive. Radar tint confirmed absent | `src/10_data.js`, `src/22_biome.js` |
| **Q047** | Cover normalised to "player shells" and charged at impact against current shell damage — exactly two player shells break any tree or rock at any level; weaker enemies need more hits | `src/10_data.js`, `src/24_chunks.js`, `src/34_physics_hud.js` |
| **Q062/Q063** | Armory and Workshop are separate tabs (not folded together). Yt03's 5-node tree ported with its own cost ladder. **Second Wind removed entirely** — revive is coin-driven | `src/06_dom.html`, `src/30_meta.js` |
| **Q116** | `state.tech` persists: written by `saveGame()`, validated against the tree by `sanitizeSave()` so a hand-edited save cannot exceed `maxLevel`, restored by `loadGame()`. Ranks applied fresh each `startGame()` before the armour pool is derived | `src/10_data.js`, `src/32_run_flow.js`, `src/40_persist_polish.js` |
| **Q038** | Yt01's six bespoke boss phase fights ported (warlord, colossus, nova, fortress added; titan and tempest already had theirs) plus Yt03's generic enrage as an automatic fallback for any boss without a bespoke script | `src/28_pause_boss.js`, `src/34_physics_hud.js` |
| **Q064** | Consumable pricing is now a repeating 5-step loop at ×3 per step instead of an uncapped `~1.58^n`. The 6th Aegis Kit costs the same as the 1st. Armory items keep their original growth | `src/10_data.js`, `src/30_meta.js` |
| **Q117 / Q125** | Schema 3→4 behind `SAVE_VERSION`. `migrateSave()` runs versioned migrations (`ice`→`glacier`, v2 snapshot→auto slot); `sanitizeSave()` applies per-field type guards so a bad field loses only itself | `src/40_persist_polish.js`, `src/30_meta.js` |

---

## Still to implement

The 131 answers break down as: **~62 "identical, keep as-is"** (no code change) and **~69 requiring
work**. Of the latter, **32 are done** — every P0 group is complete, plus Q039, Q044, Q047,
Q117, Q125, Q064, Q038, Q062, Q063 and Q116 from P1. The remainder, grouped:

**P0 / high impact — COMPLETE**

All P0 groups are implemented and covered by behaviour tests B5–B10: Q031, Q032, Q016, Q017,
Q018, Q020, Q011, Q013. Q115 and Q022 turned out to be already correct in the Yt02 base and
are now regression-guarded rather than changed.

One bug was introduced and caught by the new armour test: `recalcArmorPool(false)` correctly
only clamps, so `startGame()` would have begun a fresh run with the previous run's leftover
pool. A fresh run now fills explicitly.

**P1**
- **Q030/Q138** tank-part system: Yt01 framework + Yt03 12-evo parts, single barrel regardless of multishot
- **Q075/Q129** 3-lane combat meter + 5-column pause grid merge

**P2**
- **Q003** PWA package (manifest + sw.js + icons)
- **Q049/Q051/Q052** airdrop schedule, 70% repair for first 10 levels, crate table trimmed to 5 kinds
- **Q066** remove daily challenges entirely (9 no-op `bumpDaily` call sites)
- **Q037** boss cadence: 10s breather, +50% HP on kill, spawns halved while boss lives
- **Q127** one pause-safe clock everywhere
- **Q081/Q088/Q105/Q118/Q079** HUD and camera polish
- **Q097/Q136** generated-numbers documentation script

---

## Notes for the next pass

- `EVOLUTIONS` (in `src/38_cards_evos.js`) and `EVOLUTION_CARDS` (in `src/30_meta.js`) are still two
  parallel tables. Q131 made `requires{}` authoritative for unlocking, but the presentation table
  should eventually be folded in so there is one list.
- `tools/test-boot.js` and `tools/check.js` both stub `THREE.WebGLRenderer`; jsdom cannot compile
  shaders. This exercises game logic, not rendering.
- `state.runCardStats` is now redundant with `state.runCardsObj`. It is still written by
  `noteRunCard()`; nothing reads it for gating any more.
- `tools/.node/` holds jsdom for the harness and is git-ignored.
