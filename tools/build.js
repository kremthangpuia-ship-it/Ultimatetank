#!/usr/bin/env node
/**
 * tools/build.js — assembles src/ into the shipped single-file build.
 *
 * Decision Q123: the master build is developed as split sources and shipped as ONE
 * self-contained, offline, double-clickable HTML file. This script is the
 * "one-command concatenation build".
 *
 *   node tools/build.js            -> TankGameAi_001.html
 *   node tools/build.js 002        -> TankGameAi_002.html
 *
 * Decision Q124 keeps the copy-a-new-file-per-version convention, so the output name
 * is a build number and never overwritten in place.
 *
 * The assembler is deliberately dumb: it concatenates in a fixed order and performs
 * no transformation. Every decision is implemented by editing a file in src/, never
 * by patching here — so what you read in src/ is exactly what ships.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');

const GAME_CHUNKS = [
  '10_data.js', '12_resources.js', '14_init_terrain.js', '16_audio_quality.js',
  '18_sfx.js', '20_settings.js', '22_biome.js', '24_chunks.js', '26_tank_combat.js',
  '28_pause_boss.js', '30_meta.js', '32_run_flow.js', '34_physics_hud.js',
  '36_input_loop.js', '38_cards_evos.js', '40_persist_polish.js',
];

const read = (p) => fs.readFileSync(path.join(SRC, p), 'utf8');
const missing = [...GAME_CHUNKS, '00_head_open.html', '01_styles.css', '02_head_close.html',
                 '05_error_overlay.html', '06_dom.html', '98_pwa_register.html',
                 'vendor/three.r128.js'].filter(f => !fs.existsSync(path.join(SRC, f)));
if (missing.length) {
  console.error('Missing src parts:\n  ' + missing.join('\n  '));
  process.exit(1);
}

const num = (process.argv[2] || '001').padStart(3, '0');
const outName = `TankGameAi_${num}.html`;

const parts = [];
parts.push(read('00_head_open.html').replace(/\n$/, ''));
parts.push('    <style>');
parts.push(read('01_styles.css').replace(/\n$/, ''));
parts.push('    </style>');
parts.push(read('02_head_close.html').replace(/\n$/, ''));
parts.push('');
parts.push('    <script>/* Three.js r128 — inlined so the game runs fully offline, in sandboxed previews, anywhere */');
parts.push(read('vendor/three.r128.js').replace(/\n$/, ''));
parts.push('');
parts.push('</script>');
parts.push('</head>');
parts.push('<body>');
parts.push(read('06_dom.html').replace(/\n$/, ''));
parts.push(read('05_error_overlay.html').replace(/\n$/, ''));
parts.push('<script>');
parts.push(GAME_CHUNKS.map(read).join('\n').replace(/\n$/, ''));
parts.push('');
parts.push('</script>');
parts.push(read('98_pwa_register.html').replace(/\n$/, ''));
parts.push('</body>');
parts.push('</html>');

const html = parts.join('\n') + '\n';
const dest = path.join(ROOT, outName);
fs.writeFileSync(dest, html);

console.log(`built ${outName}  (${(html.length / 1024).toFixed(1)} KB, ${html.split('\n').length} lines)`);
console.log(`  game script: ${GAME_CHUNKS.length} chunks, ${GAME_CHUNKS.map(read).join('\n').length} chars`);
