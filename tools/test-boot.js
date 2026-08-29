#!/usr/bin/env node
/**
 * tools/test-boot.js — boots a built HTML file in jsdom and reports every runtime
 * error. This is the first gate in the release harness (decision Q096/Q100):
 * the shipped file must execute its full top-level scope and reach init() with
 * zero console errors and zero window.onerror hits.
 *
 *   node tools/test-boot.js [TankGameAi_001.html]
 */
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require(path.join(__dirname, '.node', 'node_modules', 'jsdom'));

const file = path.resolve(__dirname, '..', process.argv[2] || 'TankGameAi_001.html');
const html = fs.readFileSync(file, 'utf8');

const consoleErrors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => consoleErrors.push('jsdomError: ' + (e.stack || e.message)));
vc.on('error', (...a) => consoleErrors.push('console.error: ' + a.join(' ')));
vc.on('warn', () => {});          // noise from Three.js feature probes

// Minimal WebGL stub: Three.js r128 probes for a context; we only need top-level
// execution and init() to run, not a real rasteriser.
const GL_STUB = () => new Proxy({}, {
  get: (t, k) => {
    if (k === 'getParameter') return () => 'stub';
    if (k === 'getExtension') return () => null;
    if (k === 'getShaderPrecisionFormat') return () => ({ precision: 23, rangeMin: 127, rangeMax: 127 });
    if (typeof k === 'string' && /^[A-Z_]+$/.test(k)) return 0;   // GL enums
    return () => {};
  },
  set: () => true,
});

// jsdom has no rasteriser, so canvas.getContext('2d') is null unless the optional
// `canvas` package is installed. The game draws skies, minimaps and offscreen
// textures on 2d contexts, so give it a callable stub that satisfies the API shape.
const CTX2D = () => new Proxy({
  canvas: { width: 512, height: 512 },
  createLinearGradient: () => ({ addColorStop() {} }),
  createRadialGradient: () => ({ addColorStop() {} }),
  createPattern: () => null,
  measureText: () => ({ width: 10, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2 }),
  getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(Math.max(4, (w | 0) * (h | 0) * 4)), width: w | 0, height: h | 0 }),
  createImageData: (w, h) => ({ data: new Uint8ClampedArray(Math.max(4, (w | 0) * (h | 0) * 4)), width: w | 0, height: h | 0 }),
}, {
  get: (t, k) => (k in t ? t[k] : () => {}),
  set: () => true,
});

// Three.js needs a real GL context to compile shaders, which jsdom cannot provide.
// What we actually want to exercise is the GAME's logic (state machines, upgrades,
// damage, coins, saves), none of which needs a rasteriser. So patch THREE.WebGLRenderer
// to an inert stand-in immediately after the Three.js block runs.
const RENDERER_STUB = `<script>
(function(){
  if (typeof THREE === 'undefined') return;
  var Real = THREE.WebGLRenderer;
  THREE.WebGLRenderer = function (opts) {
    var canvas = (opts && opts.canvas) || document.createElement('canvas');
    var r = new Proxy({
      domElement: canvas, shadowMap: { enabled: false, type: 0, needsUpdate: false },
      capabilities: { isWebGL2: false, getMaxAnisotropy: function(){return 1;}, logDepthBuffer:false },
      info: { render: { calls: 0, triangles: 0 }, memory: { geometries: 0, textures: 0 } },
      outputEncoding: 0, toneMapping: 0, physicallyCorrectLights: false,
      autoClear: true, sortObjects: true, localClippingEnabled: false,
    }, { get: function (t, k) {
          if (k in t) return t[k];
          if (k === 'getSize') return function (v) { v = v || {}; v.width = 800; v.height = 600; return v; };
          if (k === 'getPixelRatio') return function () { return 1; };
          if (k === 'getContext') return function () { return {}; };
          return function () {};
        }, set: function () { return true; } });
    return r;
  };
  THREE.WebGLRenderer.prototype = Real.prototype;
})();
</script>`;

const patched = html.replace('</head>', RENDERER_STUB + '\n</head>');
if (patched === html) { console.error('could not inject renderer stub'); process.exit(2); }

const dom = new JSDOM(patched, {
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  virtualConsole: vc,
  beforeParse(window) {
    window.HTMLCanvasElement.prototype.getContext = function (type) {
      if (String(type).indexOf('webgl') === 0 || type === 'experimental-webgl') return GL_STUB();
      if (type === '2d') return CTX2D();
      return null;
    };
    window.matchMedia = window.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {} }));
    window.addEventListener('error', e => consoleErrors.push('window.error: ' + e.message + '\n' + (e.error && e.error.stack ? e.error.stack : '(no stack)')));
    window.addEventListener('unhandledrejection', e => consoleErrors.push('rejection: ' + e.reason));
  },
});

setTimeout(() => {
  const w = dom.window;
  const overlay = w.document.getElementById('ty-error-overlay');
  const overlayText = overlay ? (overlay.textContent || '').trim() : '(no overlay element)';
  const overlayShown = overlay ? overlay.style.display !== 'none' : null;

  console.log('file               :', path.basename(file));
  console.log('THREE loaded       :', typeof w.THREE !== 'undefined' ? ('yes, r' + (w.THREE.REVISION || '?')) : 'NO');
  console.log('game globals seen  :',
    ['CONFIG', 'state', 'BIOMES', 'ENEMY_TYPES', 'EVOLUTIONS', 'SHOP_ITEMS', 'SFX']
      .filter(k => typeof w[k] !== 'undefined').join(', ') || '(none are global — script may be scoped)');
  console.log('overlay visible    :', overlayShown);
  console.log('overlay text       :', overlayText ? overlayText.slice(0, 400) : '(empty)');
  console.log('console/jsdom errors:', consoleErrors.length);
  consoleErrors.slice(0, 4).forEach(e => console.log('   ! ' + e.split('\n').slice(0, 6).join('\n     ').slice(0, 900)));

  const fatal = consoleErrors.filter(e => !/not implemented|Could not parse CSS|webgl/i.test(e));
  console.log('\nRESULT:', (fatal.length === 0 && !overlayShown) ? 'PASS — booted clean' : `FAIL — ${fatal.length} error(s)`);
  process.exit(fatal.length === 0 && !overlayShown ? 0 : 1);
}, 1500);
