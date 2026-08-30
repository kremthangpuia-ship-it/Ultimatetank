#!/usr/bin/env node
/**
 * tools/test-undef.js — static whole-class hunt for the `_dispDmg` defect family.
 *
 * The `_dispDmg` ReferenceError shipped because a variable was deleted from one
 * function while another still read it, and no tool checked identifier binding
 * across the 10k-line script. This test extracts every inline <script> block from
 * the built file, concatenates them in document order (mirroring how the browser
 * shares the global lexical scope across blocks), and runs ESLint's scope-aware
 * `no-undef` over the result.
 *
 *   node tools/test-undef.js [TankGameAi_001.html]
 */
const fs = require('fs');
const path = require('path');
const { ESLint } = require(path.join(__dirname, '.node', 'node_modules', 'eslint'));

const file = path.resolve(__dirname, '..', process.argv[2] || 'TankGameAi_001.html');
const html = fs.readFileSync(file, 'utf8');

const blocks = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const combined = blocks.join('\n;\n');

(async () => {
  const eslint = new ESLint({
    overrideConfigFile: true,
    overrideConfig: {
      languageOptions: {
        ecmaVersion: 2021,
        sourceType: 'script',
        globals: (() => {
          const g = {};
          for (const k of [
            'window','document','navigator','location','localStorage','sessionStorage',
            'requestAnimationFrame','cancelAnimationFrame','setTimeout','clearTimeout',
            'setInterval','clearInterval','fetch','XMLHttpRequest','Image','Audio',
            'HTMLElement','HTMLCanvasElement','Element','Node','Event','CustomEvent',
            'MouseEvent','KeyboardEvent','TouchEvent','PointerEvent','Touch','TouchList',
            'getComputedStyle','alert','confirm','prompt','console','performance',
            'matchMedia','history','screen','innerWidth','innerHeight','devicePixelRatio',
            'URL','Blob','FileReader','crypto','indexedDB','caches','Notification',
            'WebSocket','Worker','self','top','parent','frames','opener','closed',
            'addEventListener','removeEventListener','dispatchEvent','postMessage',
            'btoa','atob','queueMicrotask','IntersectionObserver','ResizeObserver',
            'MutationObserver','CanvasRenderingContext2D','WebGLRenderingContext',
            'THREE','gsap',
            // standard browser constructors the vendored Three.js r128 probes for —
            // not gameplay identifiers, so their absence from Node's scope is expected
            'ImageData','HTMLImageElement','ImageBitmap','createImageBitmap',
            'WebGL2RenderingContext','WebGL2ComputeRenderingContext','OffscreenCanvas',
            'XRWebGLLayer','DOMParser','TextDecoder','__THREE_DEVTOOLS__',
            'exports','define','module','require',
          ]) g[k] = 'readonly';
          return g;
        })(),
      },
      rules: {
        'no-undef': 'error',
        'no-redeclare': 'error',        // the D-03 defect class, scope-aware
        'no-dupe-args': 'error',
        'no-dupe-keys': 'error',
        'no-unreachable': 'error',
      },
    },
  });

  const results = await eslint.lintText(combined, { filePath: 'build-combined.js' });
  const messages = results[0].messages;
  const errors = messages.filter(m => m.severity === 2);

  console.log('file    :', path.basename(file));
  console.log('blocks  :', blocks.length);
  console.log('undef/redeclare findings:', errors.length);
  errors.slice(0, 30).forEach(m =>
    console.log(`  ! line ${m.line}:${m.column}  ${m.ruleId}  ${m.message.split('\n')[0]}`));

  console.log('\nRESULT:', errors.length === 0 ? 'PASS — every identifier reads a binding that exists' : `FAIL — ${errors.length} finding(s)`);
  process.exit(errors.length === 0 ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
