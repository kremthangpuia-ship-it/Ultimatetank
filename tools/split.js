#!/usr/bin/env node
/**
 * tools/split.js — one-time extraction of TankThilteteYt02_011.html into src/ parts.
 *
 * Per decision Q123 the master build is DEVELOPED as split sources and SHIPPED as a
 * single self-contained HTML file. This script performs the initial decomposition of
 * the chosen base build (Q001: Yt02) at verified top-level boundaries only, so the
 * rebuild is provably lossless.
 *
 * Cut points are line numbers in TankThilteteYt02_011.html, each the first line of a
 * top-level declaration (brace depth 0), so no chunk ever begins mid-block.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC_HTML = path.join(ROOT, 'TankThilteteYt02_011.html');
const OUT = path.join(ROOT, 'src');

const lines = fs.readFileSync(SRC_HTML, 'utf8').split('\n');
const at = (a, b) => lines.slice(a - 1, b).join('\n');   // inclusive 1-indexed slice

// ---- chunk table: [file, firstLine, lastLine] -------------------------------
// Boundaries taken from tools/decls scan; every firstLine is a depth-0 declaration.
const CHUNKS = [
  ['10_data.js',        2181, 2533],  // BIOMES … state (+ scene handles)
  ['12_resources.js',   2534, 2835],  // chunk consts, disposal, SHARED_GEO, fx*, light pools, dom()
  ['14_init_terrain.js',2836, 2929],  // init(), terrain height/normal
  ['16_audio_quality.js',2930,3006],  // audio context, tones, quality governor
  ['18_sfx.js',         3007, 3134],  // SFX (byte-identical across all three builds)
  ['20_settings.js',    3135, 3210],  // HUD control sync, toggles, settings panel
  ['22_biome.js',       3211, 3543],  // sky, biome morph + transition + banner
  ['24_chunks.js',      3544, 4056],  // ground tiles, streamed chunks, destructibles, env particles
  ['26_tank_combat.js', 4057, 5218],  // Tank, bullets, tactical, missiles, shoot(), impact FX
  ['28_pause_boss.js',  5219, 5496],  // pause, enemy scaling, BOSS_KINDS, spawnBoss
  ['30_meta.js',        5497, 6179],  // shop, evolutions, skins, consumables, awards, saves, shop UI
  ['32_run_flow.js',    6180, 6906],  // difficulties, snapshot, startGame, XP, crates, spawnEnemy
  ['34_physics_hud.js', 6907, 8264],  // updatePhysics, minimap, HUD, combat tray, endGame, revive
  ['36_input_loop.js',  8265, 8756],  // animate(), setupInputs, prefs, title, diagnostics
  ['38_cards_evos.js',  8757, 9296],  // CHOICE_UPGRADES, EVOLUTIONS, card UI, applyUpgrade, tank parts
  ['40_persist_polish.js',9297,9591], // spawn mult, save/load, combat polish, coinIncome, revive safety
];

// ---- static (non-script) parts ----------------------------------------------
const STATIC = [
  ['00_head_open.html',  1,    6   ],
  ['02_head_close.html', 1814, 1821],
  // 1833-1845 is the crash-overlay block (div + handler). It is split out on its own so
  // error containment is a single readable unit (decision Q005/Q095), and so the DOM
  // part below contains no script.
  ['05_error_overlay.html',1833, 1845],
  ['06_dom.html',        1846, 2179],
  ['98_pwa_register.html',9593,9605],
];
const CSS  = ['01_styles.css',   8,    1812];
const THREE= ['vendor/three.r128.js', 1823, 1829];
// lines 9606-9607 (Cloudflare Insights beacon + challenge iframe) are deliberately
// NOT carried over — decision Q004: strip external telemetry.

fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(path.join(OUT, 'vendor'), { recursive: true });

const emit = (name, first, last) => {
  const dest = path.join(OUT, name);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, at(first, last) + '\n');
  console.log(`  ${name.padEnd(26)} lines ${first}-${last}  (${(last - first + 1)} lines, ${fs.statSync(dest).size} B)`);
};

console.log('Extracting static parts:');
STATIC.forEach(([n, a, b]) => emit(n, a, b));
[CSS, THREE].forEach(([n, a, b]) => emit(n, a, b));

console.log('Extracting game-script chunks:');
CHUNKS.forEach(([n, a, b]) => emit(n, a, b));

// ---- lossless proof ----------------------------------------------------------
// Concatenating the chunks in order must reproduce the original game script exactly.
const rejoined = CHUNKS.map(([n, a, b]) => at(a, b)).join('\n');
const original = at(2181, 9591);
const ok = rejoined === original;
console.log(`\nGame-script round-trip: ${rejoined.length} chars vs original ${original.length} chars`);
console.log(`LOSSLESS: ${ok ? 'YES — split is exact' : 'NO — MISMATCH'}`);
if (!ok) process.exit(1);
