        const CHUNK = 48, CHUNK_TILES = 5;         // ground tile grid 5x5 = 240 units of visible terrain
        const CHUNK_ENV_RADIUS = 2;                // environment chunks within this radius exist
        const chunkSeededRand = (seed) => {        // deterministic per-chunk RNG — revisits regenerate identically
            let s = (seed ^ 0x9E3779B9) >>> 0;
            return () => { s |= 0; s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
        };
        const chunkKey = (cx, cz) => cx + ',' + cz;
        const chunkSeed = (cx, cz) => (cx * 73856093 ^ cz * 19349663 ^ state.currentBiome * 83492791) >>> 0;
        let envChunks = new Map();                 // key -> { meshes: [], colliders: [] }
        let chunkBuildQueue = [];

        // ============================================
        // FIX (Tier 2): GPU RESOURCE DISPOSAL & CACHING
        // In three.js r128, scene.remove() does NOT free GPU memory — geometry/material
        // must be disposed. Previously nothing was ever disposed, so bullets, deaths,
        // particles, biome switches and restarts leaked GPU buffers forever.
        // Shared (cached) resources are flagged and skipped by the disposer.
        // ============================================
        function markShared(res) {
            res.userData = res.userData || {};
            res.userData.__shared = true;
            return res;
        }
        function disposeObject3D(root) {
            if (!root) return;
            root.traverse(c => {
                if (c.isInstancedMesh && c.dispose) c.dispose(); // FIX (Tier 3): frees instance buffers
                if (c.geometry && !(c.geometry.userData && c.geometry.userData.__shared)) {
                    c.geometry.dispose();
                }
                if (c.material) {
                    const mats = Array.isArray(c.material) ? c.material : [c.material];
                    mats.forEach(m => {
                        if (m && !(m.userData && m.userData.__shared)) m.dispose();
                    });
                }
            });
        }

        // Cached unit geometries (scaled per use — identical rendering, one GPU buffer)
        const SHARED_GEO = {
            sphere1:   markShared(new THREE.SphereGeometry(1)),
            box1:      markShared(new THREE.BoxGeometry(1, 1, 1)),
            plane1:    markShared(new THREE.PlaneGeometry(1, 1)),
            tetra1:    markShared(new THREE.TetrahedronGeometry(1)),
            octa1:     markShared(new THREE.OctahedronGeometry(1)),
            dodeca1:   markShared(new THREE.DodecahedronGeometry(1, 0)),
            bulletCore:  markShared(new THREE.SphereGeometry(0.3)),
            bulletInner: markShared(new THREE.SphereGeometry(0.45)),
            bulletOuter: markShared(new THREE.SphereGeometry(0.65)),
            bulletTrail: markShared(new THREE.CylinderGeometry(0.16, 0.09, 2.7, 8)), // v2 visuals: longer trail
            flashSphere: markShared(new THREE.SphereGeometry(1.0)),
            flashRing:   markShared(new THREE.RingGeometry(0.6, 1.5, 16)),
            shockRing:   markShared(new THREE.RingGeometry(0.5, 1.5, 32)),
            slamRing:    markShared(new THREE.RingGeometry(1, 2.2, 40)),
            fxRing:      markShared(new THREE.RingGeometry(0.85, 1.0, 40)),
            fxDisk:      markShared(new THREE.CircleGeometry(1, 36))
        };
        const bulletMatCache = {}; // keyed by hex color
        const FLASH_RES = {
            flash: markShared(new THREE.MeshBasicMaterial({ color: 0xffffaa }))
        };

        // Combat language — visuals only, no damage/spawn changes
        const _fx = [];
        function fxSpawn(mesh, life, tick) {
            scene.add(mesh);
            _fx.push({ mesh: mesh, t: 0, life: life, tick: tick || null });
        }
        function fxTick(dt) {
            for (let i = _fx.length - 1; i >= 0; i--) {
                const f = _fx[i];
                f.t += dt;
                const u = Math.min(1, f.t / f.life);
                if (f.tick) try { f.tick(f, u, dt); } catch (err) {}
                if (f.t >= f.life) {
                    try { scene.remove(f.mesh); } catch (err) {}
                    _fx.splice(i, 1);
                }
            }
        }
        function fxGroundY(x, z) {
            try { return getTerrainHeight(x, z) + 0.12; } catch (err) { return 0.12; }
        }
        function fxRingAt(x, z, color, startS, endS, life, fill) {
            const mat = new THREE.MeshBasicMaterial({
                color: color, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false
            });
            const mesh = new THREE.Mesh(fill ? SHARED_GEO.fxDisk : SHARED_GEO.fxRing, mat);
            mesh.rotation.x = -Math.PI / 2;
            mesh.position.set(x, fxGroundY(x, z), z);
            mesh.scale.setScalar(startS);
            fxSpawn(mesh, life, function (f, u) {
                const s = startS + (endS - startS) * u;
                f.mesh.scale.setScalar(s);
                f.mesh.material.opacity = 0.85 * (1 - u);
                f.mesh.position.y = fxGroundY(f.mesh.position.x, f.mesh.position.z);
            });
        }
        function fxSparks(x, y, z, color, n) {
            for (let i = 0; i < n; i++) {
                const mat = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 1 });
                const m = new THREE.Mesh(SHARED_GEO.sphere1, mat);
                m.scale.setScalar(0.12 + Math.random() * 0.1);
                m.position.set(x, y, z);
                const vx = (Math.random() - 0.5) * 14;
                const vy = 4 + Math.random() * 8;
                const vz = (Math.random() - 0.5) * 14;
                fxSpawn(m, 0.28 + Math.random() * 0.12, function (f, u, dt) {
                    f.mesh.position.x += vx * dt;
                    f.mesh.position.y += vy * dt;
                    f.mesh.position.z += vz * dt;
                    f.mesh.material.opacity = 1 - u;
                    f.mesh.scale.multiplyScalar(0.96);
                });
            }
        }
        function fxClearEnemy(e) {
            if (!e) return;
            if (e._aimLine) {
                try { scene.remove(e._aimLine); e._aimLine.geometry.dispose(); e._aimLine.material.dispose(); } catch (err) {}
                e._aimLine = null;
            }
            if (e._tgRing) { try { scene.remove(e._tgRing); } catch (err) {} e._tgRing = null; }
            if (e._tgFill) { try { scene.remove(e._tgFill); } catch (err) {} e._tgFill = null; }
            if (e._ghost) { try { scene.remove(e._ghost); } catch (err) {} e._ghost = null; }
            if (e._healBeam) { try { scene.remove(e._healBeam); } catch (err) {} e._healBeam = null; }
        }
        function fxAimLine(e, ax, ay, az, bx, by, bz, color, opacity) {
            if (!e._aimLine) {
                const geo = new THREE.BufferGeometry().setFromPoints([
                    new THREE.Vector3(ax, ay, az), new THREE.Vector3(bx, by, bz)
                ]);
                const mat = new THREE.LineBasicMaterial({ color: color, transparent: true, opacity: opacity, depthWrite: false });
                e._aimLine = new THREE.Line(geo, mat);
                scene.add(e._aimLine);
            } else {
                const pos = e._aimLine.geometry.attributes.position;
                pos.setXYZ(0, ax, ay, az);
                pos.setXYZ(1, bx, by, bz);
                pos.needsUpdate = true;
                e._aimLine.material.opacity = opacity;
                e._aimLine.material.color.setHex(color);
            }
        }
        function fxKeepRing(e, key, x, z, color, scale, opacity, fill) {
            let mesh = e[key];
            if (!mesh) {
                const mat = new THREE.MeshBasicMaterial({
                    color: color, transparent: true, opacity: opacity, side: THREE.DoubleSide, depthWrite: false
                });
                mesh = new THREE.Mesh(fill ? SHARED_GEO.fxDisk : SHARED_GEO.fxRing, mat);
                mesh.rotation.x = -Math.PI / 2;
                scene.add(mesh);
                e[key] = mesh;
            }
            mesh.position.set(x, fxGroundY(x, z), z);
            mesh.scale.setScalar(scale);
            mesh.material.opacity = opacity;
            mesh.material.color.setHex(color);
        }

        // ============================================
        // FIX (Tier 3): PERFORMANCE INFRASTRUCTURE
        // 1) Preallocated scratch vectors — the hot loop previously allocated hundreds
        //    of short-lived Vector3/Vector2 objects per frame (GC pressure / micro-stutter).
        // 2) Collision grid for bullet-vs-environment checks (was: every bullet scanning
        //    ALL ~660 environment objects every frame).
        // 3) mergeGeometries() — bakes many small meshes into few big ones (same triangles,
        //    same materials, same transforms → identical look, a fraction of the draw calls).
        // 4) Persistent shared dynamic lights (muzzle + explosion pool) — adding/removing
        //    PointLights per bullet/shot/explosion forced three.js to recompile shaders
        //    constantly (measured: 6 → 169 programs during combat = periodic hitches).
        // ============================================
        const _tv1 = new THREE.Vector3(), _tv2 = new THREE.Vector3(), _tv3 = new THREE.Vector3(),
              _tv4 = new THREE.Vector3(), _tv5 = new THREE.Vector3(), _terrainN = new THREE.Vector3();
        const _moveV1 = new THREE.Vector3(), _moveV2 = new THREE.Vector3(), _moveV3 = new THREE.Vector3();
        const _aimV1 = new THREE.Vector3(), _aimV2 = new THREE.Vector3();
        const _sv1 = new THREE.Vector2();
        const _dummy = new THREE.Object3D();

        function* collidersNear(x, z) { // v17: colliders live on their chunks — check the 3x3 chunk neighborhood
            const pcx = Math.floor(x / CHUNK), pcz = Math.floor(z / CHUNK);
            for (let ix = pcx - 1; ix <= pcx + 1; ix++)
                for (let iz = pcz - 1; iz <= pcz + 1; iz++) {
                    const chunk = envChunks.get(chunkKey(ix, iz));
                    if (chunk) yield* chunk.colliders;
                }
        }

        function mergeGeometries(geos) {
            let vCount = 0, iCount = 0;
            geos.forEach(g => {
                vCount += g.attributes.position.count;
                iCount += g.index ? g.index.count : g.attributes.position.count;
            });
            const pos = new Float32Array(vCount * 3), nor = new Float32Array(vCount * 3), uv = new Float32Array(vCount * 2);
            const idx = vCount > 65535 ? new Uint32Array(iCount) : new Uint16Array(iCount);
            let vo = 0, io = 0;
            geos.forEach(g => {
                const p = g.attributes.position;
                pos.set(p.array, vo * 3);
                if (g.attributes.normal) nor.set(g.attributes.normal.array, vo * 3);
                if (g.attributes.uv) uv.set(g.attributes.uv.array, vo * 2);
                const n = p.count;
                if (g.index) {
                    const gi = g.index.array;
                    for (let k = 0; k < gi.length; k++) idx[io + k] = gi[k] + vo;
                } else {
                    for (let k = 0; k < n; k++) idx[io + k] = k + vo;
                }
                vo += n; io += g.index ? g.index.count : n;
            });
            const out = new THREE.BufferGeometry();
            out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
            out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
            out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
            out.setIndex(new THREE.BufferAttribute(idx, 1));
            return out;
        }

        // Persistent shared lights (count never changes → no shader churn)
        const muzzleLight = new THREE.PointLight(0xffaa00, 0, 15);
        const explosionLightPool = [new THREE.PointLight(0xffffff, 0, 20), new THREE.PointLight(0xffffff, 0, 20)];
        let muzzleLightsInit = false, explosionLightTicket = 0;
        function initDynamicLights() {
            if (muzzleLightsInit) return;
            scene.add(muzzleLight);
            explosionLightPool.forEach(l => scene.add(l));
            initGlowLights(); // v26: fixed glow pool exists before first render → light count never changes
            muzzleLightsInit = true;
        }
        function acquireExplosionLight(color, pos) {
            const l = explosionLightPool[explosionLightTicket++ % explosionLightPool.length];
            l.color.setHex(color);
            l.position.copy(pos);
            l.userData.ticket = explosionLightTicket;
            l.intensity = 3;
            return l;
        }

        // v26: GLOW LIGHT POOL — crystals & lava used to spawn real PointLights
        // per feature (253 simultaneous point lights measured in Crystal Caverns).
        // three.js bakes the light COUNT into every shader, so each streamed chunk
        // changed the count and forced a shader-recompile storm on real GPUs —
        // the "visual chaos" reported at level 15+. Now a FIXED pool of 8 lights
        // continuously snaps to the nearest glow spots. Their falloff is only 8–15
        // units, so distant lights were invisible anyway — near-player look unchanged.
        const GLOW_POOL_SIZE = 8;
        const glowLightPool = [];
        let glowLightsInit = false;
        let glowSpots = []; // { x, y, z, color, intensity, dist, chunkKey }
        function initGlowLights() {
            if (glowLightsInit) return;
            for (let i = 0; i < GLOW_POOL_SIZE; i++) {
                const l = new THREE.PointLight(0xffffff, 0, 15);
                scene.add(l);
                glowLightPool.push(l);
            }
            glowLightsInit = true;
        }
        function updateGlowLights() { // pool lights follow the nearest glow spots
            if (!glowSpots.length) { for (const l of glowLightPool) l.intensity = 0; return; }
            const px = player ? player.mesh.position.x : 0, pz = player ? player.mesh.position.z : 0;
            const best = []; // GLOW_POOL_SIZE nearest (fixed-size insertion, O(n))
            for (const s of glowSpots) {
                const d2 = (s.x - px) * (s.x - px) + (s.z - pz) * (s.z - pz);
                if (best.length < GLOW_POOL_SIZE) { best.push({ d2, s }); best.sort((a, b) => a.d2 - b.d2); }
                else if (d2 < best[best.length - 1].d2) { best[GLOW_POOL_SIZE - 1] = { d2, s }; best.sort((a, b) => a.d2 - b.d2); }
            }
            for (let i = 0; i < glowLightPool.length; i++) {
                const l = glowLightPool[i], e = best[i];
                if (e) { l.color.setHex(e.s.color); l.position.set(e.s.x, e.s.y, e.s.z); l.intensity = e.s.intensity; l.distance = e.s.dist; }
                else l.intensity = 0;
            }
        }

        // Render gating: render only while playing (or when something changed while idle)
        let needsRender = true;

        // FIX (Tier 4): cached DOM lookups — updateHUD + overlays queried getElementById
        // several times per hit/regen tick.
        const _domCache = {};
        function dom(id) {
            if (!_domCache[id]) _domCache[id] = document.getElementById(id);
            return _domCache[id];
        }
        function getBulletResources(color) {
            if (!bulletMatCache[color]) {
                bulletMatCache[color] = {
                    core: markShared(new THREE.MeshBasicMaterial({ color: 0xffffff })),
                    inner: markShared(new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.9 })),
                    outer: markShared(new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.4 })),
                    trail: markShared(new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.75 })) // v2 visuals
                };
            }
            return bulletMatCache[color];
        }

        // ============================================
        // INITIALIZATION
        // ============================================
