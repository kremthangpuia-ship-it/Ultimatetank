        let _skyCanvas = null, _skyCtx = null, _skyTexture = null;
        function drawSky(from, to, t) {
            if (!_skyCanvas) {
                _skyCanvas = document.createElement('canvas');
                _skyCanvas.width = 2; _skyCanvas.height = 512;
                _skyCtx = _skyCanvas.getContext('2d');
                _skyTexture = new THREE.CanvasTexture(_skyCanvas);
                scene.background = _skyTexture;
            }
            const ctx = _skyCtx;
            const top = new THREE.Color(from.skyTop).lerp(new THREE.Color(to.skyTop), t);
            const bot = new THREE.Color(from.skyBottom).lerp(new THREE.Color(to.skyBottom), t);
            const hex = (c) => '#' + c.getHexString();
            const gradient = ctx.createLinearGradient(0, 0, 0, 512);
            gradient.addColorStop(0, hex(top));
            gradient.addColorStop(1, hex(bot));
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, 2, 512);
            // celestial details fade in from the destination biome
            ctx.globalAlpha = t;
            if (to.particleType === 'sparkles') {
                for (let i = 0; i < 90; i++) {
                    ctx.fillStyle = 'rgba(255,255,255,' + (0.25 + Math.random() * 0.55) + ')';
                    ctx.fillRect(Math.random() * 2, Math.random() * 300, Math.random() > 0.8 ? 2 : 1, Math.random() > 0.8 ? 2 : 1);
                }
            } else if (to.particleType === 'embers') {
                for (let i = 0; i < 7; i++) {
                    const gy = 260 + Math.random() * 200, gr = 60 + Math.random() * 90;
                    const g2 = ctx.createRadialGradient(1, gy, 0, 1, gy, gr);
                    g2.addColorStop(0, 'rgba(255,90,20,0.34)');
                    g2.addColorStop(1, 'rgba(255,90,20,0)');
                    ctx.fillStyle = g2;
                    ctx.fillRect(0, gy - gr, 2, gr * 2);
                }
            } else {
                const sunY = 90 + 100; // deterministic mid position
                const sg = ctx.createRadialGradient(1, sunY, 2, 1, sunY, 46);
                sg.addColorStop(0, 'rgba(255,250,230,0.95)');
                sg.addColorStop(0.25, 'rgba(255,240,200,0.55)');
                sg.addColorStop(1, 'rgba(255,240,200,0)');
                ctx.fillStyle = sg;
                ctx.fillRect(0, sunY - 46, 2, 92);
                for (let i = 0; i < 9; i++) {
                    const cy = 80 + (i * 37) % 260, cw = 1 + (i % 3) * 0.4;
                    ctx.fillStyle = 'rgba(255,255,255,' + (0.05 + (i % 4) * 0.03) + ')';
                    ctx.beginPath();
                    ctx.ellipse(1, cy, cw, 10 + (i % 5) * 6, 0, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
            ctx.globalAlpha = 1;
            _skyTexture.needsUpdate = true;
        }

        // v20: MORPHING REALM TRANSITION — no fade. The world blends: terrain heights,
        // ground colors, sky, fog and lights lerp over ~3.5s while environment chunks
        // rebuild in a radial wave (one per frame — no lag spike).
        let biomeBlend = null;
        function blendedHeight(x, z) {
            if (!biomeBlend) return terrainHeightRaw(x, z, _activeBiomeRef);
            const e = biomeBlend.e;
            return terrainHeightRaw(x, z, biomeBlend.from) * (1 - e) + terrainHeightRaw(x, z, biomeBlend.to) * e;
        }
        function startBiomeMorph(targetIdx) {
            const idx = targetIdx % BIOMES.length;
            const from = BIOMES[state.currentBiome];
            const to = BIOMES[idx];
            if (from === to) return;
            const px = player ? player.mesh.position.x : 0;
            const pz = player ? player.mesh.position.z : 0;
            const waveOrder = [...envChunks.keys()].map(k => {
                const parts = k.split(',');
                return { k, cx: +parts[0], cz: +parts[1], d: ((+parts[0]) * CHUNK - px) ** 2 + ((+parts[1]) * CHUNK - pz) ** 2 };
            }).sort((a, b) => a.d - b.d);
            // Q044: timing from CONFIG, and the safety windows are applied here rather than
            // left to the caller. hushHostileFire() and the spawn pause already existed for
            // revive (Q073); a realm change is the other moment a player should not be
            // punished for something the game itself initiated.
            const BC = CONFIG.biome;
            try { hushHostileFire(BC.fireHushSec); } catch (e) {}
            state.spawnSafeUntil = (state.runTime || 0) + BC.noSpawnSec;
            biomeBlend = { from, to, t: 0, e: 0, start: performance.now() + BC.morphDelayMs, dur: BC.morphDurationMs, tileI: 0, particlesSwapped: false, finalPass: false, frameFlip: 0, heavyFrame: false, queuedRebuild: false, waveOrder };
            state.currentBiome = idx;
            biomeBlend.rebuildQueue = []; // drained: tasks are tracked in chunkTasks now
            // Name waits until the realm has finished loading (see markBiomeArrival).
            streamChunks(px, pz, false); // any missing chunks queue normally (target biome)
        }
        const _lerpColor = new THREE.Color(), _lerpColor2 = new THREE.Color();
        let _lastPhysicsCost = 0;
        function updateBiomeMorph() {
            const b = biomeBlend;
            if (!b) return;
            if (_lastPhysicsCost > 26) { b.skipCount = (b.skipCount || 0) + 1; b.heavyFrame = b.skipCount < 3; } // v22: breathe, but never starve
            else b.skipCount = 0;
            b.t = Math.min(1, Math.max(0, (performance.now() - b.start) / b.dur)); // v21: 700ms grace before blending starts
            b.e = b.t * b.t * (3 - 2 * b.t); // smoothstep
            const e = b.e;
            // fog, lights, exposure blend
            scene.fog.color.copy(_lerpColor.set(b.from.fogColor).lerp(_lerpColor2.set(b.to.fogColor), e));
            scene.fog.near = b.from.fogNear + (b.to.fogNear - b.from.fogNear) * e;
            scene.fog.far = b.from.fogFar + (b.to.fogFar - b.from.fogFar) * e;
            renderer.toneMappingExposure = (b.from.exposure || 1) + ((b.to.exposure || 1) - (b.from.exposure || 1)) * e;
            ambientLight.color.copy(_lerpColor.set(b.from.ambientLight).lerp(_lerpColor2.set(b.to.ambientLight), e));
            dirLight.color.copy(_lerpColor.set(b.from.sunColor).lerp(_lerpColor2.set(b.to.sunColor), e));
            dirLight.intensity = (b.from.sunIntensity || 1) + ((b.to.sunIntensity || 1) - (b.from.sunIntensity || 1)) * e;
            hemisphereLight.color.copy(_lerpColor.set(b.from.sunColor).lerp(_lerpColor2.set(b.to.sunColor), e));
            hemisphereLight.groundColor.copy(_lerpColor.set(b.from.groundColor).lerp(_lerpColor2.set(b.to.groundColor), e));
            // sky blend (redraw throttled)
            if (!b._skyAt || performance.now() - b._skyAt > 260) { b._skyAt = performance.now(); drawSky(b.from, b.to, e); } // v21: throttled
            // v21: feather-light workload — one small job per frame, alternating,
            // and nothing at all on a frame that just ran heavy (weak devices).
            // v22: the wave spawns prioritized micro-op tasks; old chunks stay visible until swapped
            b.frameFlip = (b.frameFlip + 1) % 2;
            if (!b.queuedRebuild && b.t > 0.62) {
                b.queuedRebuild = true;
                _activeBiomeRef = b.to;
                (b.waveOrder || []).forEach(w => buildChunkTask(w.cx, w.cz, true, true));
            }
            if (!b.heavyFrame) {
                if (b.frameFlip === 0) {
                    runChunkTasks(b.t >= 0.8 ? 3 : 1);
                } else if (b.frameFlip === 1) {
                    const tiles = groundTiles.filter(tl => tl.worldX !== null);
                    if (b.tileI < tiles.length) {
                        const tl = tiles[b.tileI++];
                        bakeGroundTile(tl.mesh, tl.worldX, tl.worldZ, BIOMES[state.currentBiome]);
                    } else if (b.t < 1) b.tileI = 0; // next rolling round
                }
            }
            b.heavyFrame = false;
            // particles swap midway
            if (!b.particlesSwapped && b.t > 0.5) { b.particlesSwapped = true; createEnvironmentParticles(b.to); SFX.ambientSet(b.to); } // v23
            // finish: everything rebuilt + final exact-state tile pass done
            if (b.t >= 1 && (!b.rebuildQueue || !b.rebuildQueue.length) && chunkTasks.length === 0) {
                // v22: final exact-state tile pass — budgeted, several tiles per frame
                const tilesF = groundTiles.filter(tl => tl.worldX !== null);
                if (!b.finalPass) { b.finalPass = true; b.tileI = 0; }
                const _fT0 = performance.now();
                while (b.tileI < tilesF.length && performance.now() - _fT0 < 3) {
                    const tl = tilesF[b.tileI++];
                    bakeGroundTile(tl.mesh, tl.worldX, tl.worldZ, BIOMES[state.currentBiome]);
                }
                if (b.tileI >= tilesF.length) {
                    biomeBlend = null;
                    markBiomeArrival(true);
                }
            }
        }
        function showBiomeBanner(name, ms) {
            const el = document.getElementById('biome-name');
            if (!el) return;
            if (name) el.textContent = name;
            el.classList.add('show');
            clearTimeout(el._t);
            el._t = setTimeout(() => el.classList.remove('show'), ms);
        }
        function markBiomeArrival(announce) {
            state.biomeEnteredAt = state.runTime || 0;
            state.biomeNameReminded = false;
            state.biomeDwellLimit = 300 + Math.random() * 120;
            if (announce && state.isPlaying) {
                const biome = BIOMES[(state.currentBiome || 0) % BIOMES.length];
                if (biome) showBiomeBanner(biomeBannerText(biome), 10000);
            }
        }
        function pickTimedRandomBiome() {
            if (biomeBlend || state.isChoosingUpgrade || state.marketOpen) return;
            if (state.pendingBiome !== null && state.pendingBiome !== undefined) return;
            const n = BIOMES.length;
            if (n < 2) return;
            let idx = Math.floor(Math.random() * n);
            if (idx === state.currentBiome) idx = (idx + 1) % n;
            if (idx === state.currentBiome) return;
            state.pendingBiome = idx;
            maybeTransitionBiome();
        }
        function tickBiomeNameAndWander() {
            if (!state.isPlaying || state.isChoosingUpgrade || state.marketOpen) return;
            const now = state.runTime || 0;
            const stayed = now - (state.biomeEnteredAt || 0);
            if (!state.biomeNameReminded && stayed >= 60) {
                state.biomeNameReminded = true;
                const biome = BIOMES[(state.currentBiome || 0) % BIOMES.length];
                if (biome) showBiomeBanner(biomeBannerText(biome), 4000);
            }
            if (state.level >= 10 && now >= 300 && !biomeBlend) {
                const aboutToLevelSwap = (state.biomeNextIn || 3) <= 1 || (state.pendingBiome !== null && state.pendingBiome !== undefined);
                const dwell = state.biomeDwellLimit || 360;
                if (!aboutToLevelSwap && stayed >= dwell) pickTimedRandomBiome();
            }
        }
        function maybeTransitionBiome() { // v20: run the pending realm morph once cards are done
            if (state.pendingBiome !== null && state.pendingBiome !== undefined && !state.isChoosingUpgrade) {
                const target = state.pendingBiome;
                state.pendingBiome = null;
                startBiomeMorph(target);
            }
        }
        function loadBiome(biomeIndex) {
            const biome = BIOMES[biomeIndex % BIOMES.length];
            state.currentBiome = biomeIndex % BIOMES.length;
            _activeBiomeRef = biome; // v17: analytic terrain follows the active biome

            // Clear previous environment
            // FIX (Tier 2): dispose GPU resources of the old environment before rebuilding
            environmentParticles = [];
            if (envParticleMesh) { // FIX (Tier 3): dispose the previous biome's instanced particles
                scene.remove(envParticleMesh);
                disposeObject3D(envParticleMesh);
                if (envParticleMesh.dispose) envParticleMesh.dispose();
                envParticleMesh = null;
            }
            waterMeshes.forEach(m => { scene.remove(m); disposeObject3D(m); });
            waterMeshes = [];
            lavaMeshes.forEach(m => { scene.remove(m); disposeObject3D(m); });
            lavaMeshes = [];
            glowSpots = []; // v26: rebuilt with the streamed chunks

            // FIX (Tier 2): release the old sun's shadow-map render target & sky texture
            if (dirLight && dirLight.shadow && dirLight.shadow.map) {
                dirLight.shadow.map.dispose();
                dirLight.shadow.map = null;
            }
            if (scene.background && scene.background.isTexture) scene.background.dispose();

            // Show biome name
            const biomeEl = document.getElementById('biome-name');
            biomeEl.textContent = biome.name;
            biomeEl.classList.add('show');
            setTimeout(() => biomeEl.classList.remove('show'), 3000);

            drawSky(biome, biome, 1); // v20: unified sky painter (supports blending)

            // Fog
            scene.fog = new THREE.Fog(biome.fogColor, biome.fogNear, biome.fogFar);
            renderer.toneMappingExposure = biome.exposure || 1.0; // v2 visuals: per-biome grading

            // Lighting
            if (ambientLight) scene.remove(ambientLight);
            if (dirLight) scene.remove(dirLight);
            if (hemisphereLight) scene.remove(hemisphereLight);

            hemisphereLight = new THREE.HemisphereLight(biome.sunColor, biome.groundColor, 0.8); // v3: skylight punch
            scene.add(hemisphereLight);

            ambientLight = new THREE.AmbientLight(biome.ambientLight, 0.78); // v3: brighter base
            scene.add(ambientLight);

            dirLight = new THREE.DirectionalLight(biome.sunColor, biome.sunIntensity);
            dirLight.position.set(50, 80, 30);
            dirLight.castShadow = true;
            dirLight.shadow.mapSize.width = 2048; // FIX (v2): crisper shadows (perf headroom from Tier 3)
            dirLight.shadow.mapSize.height = 2048;
            dirLight.shadow.camera.near = 10;
            dirLight.shadow.camera.far = 200;
            dirLight.shadow.bias = -0.0005; // v3: cleaner shadow edges
            dirLight.shadow.camera.left = -115; // FIX (v2/P1): covers the bigger map
            dirLight.shadow.camera.right = 115;
            dirLight.shadow.camera.top = 115;
            dirLight.shadow.camera.bottom = -115;
            scene.add(dirLight);
            scene.add(dirLight.target); // v26: target tracks the player so the shadow frustum can follow

            // v17: infinite world — tiles + streamed chunks around the player
            const px = player ? player.mesh.position.x : 0;
            const pz = player ? player.mesh.position.z : 0;
            for (const key of [...envChunks.keys()]) disposeEnvChunk(key);
            chunkBuildQueue = [];
            buildGroundTiles(biome);
            repositionGroundTiles(biome, px, pz);
            streamChunks(px, pz, true); // immediate: hidden behind the realm transition

            // Particles
            createEnvironmentParticles(biome);
            if (state.isPlaying) markBiomeArrival(true);
        }

        // v2/v3 visuals: shared procedural ground detail texture + normal map
        let _groundDetailTex = null;
        function getGroundDetailTexture() {
            if (_groundDetailTex) return _groundDetailTex;
            const c = document.createElement('canvas');
            c.width = c.height = 256;
            const g = c.getContext('2d');
            g.fillStyle = '#ffffff';
            g.fillRect(0, 0, 256, 256);
            for (let i = 0; i < 4200; i++) {
                const v = 200 + Math.floor(Math.random() * 56);
                g.fillStyle = 'rgba(' + v + ',' + v + ',' + v + ',' + (0.05 + Math.random() * 0.12) + ')';
                const r = 0.6 + Math.random() * 2.4;
                g.beginPath();
                g.arc(Math.random() * 256, Math.random() * 256, r, 0, Math.PI * 2);
                g.fill();
            }
            _groundDetailTex = new THREE.CanvasTexture(c);
            _groundDetailTex.wrapS = _groundDetailTex.wrapT = THREE.RepeatWrapping;
            _groundDetailTex.repeat.set(1, 1); // v17: UVs are world-scaled per tile
            return _groundDetailTex;
        }

        let _groundNormalTex = null;
        function getGroundNormalMap() {
            if (_groundNormalTex) return _groundNormalTex;
            const S = 256, c = document.createElement('canvas');
            c.width = c.height = S;
            const g = c.getContext('2d');
            const h = new Float32Array(S * S);
            for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
                h[y * S + x] = Math.sin(x * 0.11) * Math.cos(y * 0.09) * 0.5
                             + Math.sin((x + y) * 0.05) * 0.35
                             + Math.random() * 0.3;
            }
            const img = g.createImageData(S, S);
            const strength = 2.2;
            for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
                const xm = (x - 1 + S) % S, xp = (x + 1) % S, ym = (y - 1 + S) % S, yp = (y + 1) % S;
                const dx = (h[y * S + xp] - h[y * S + xm]) * strength;
                const dy = (h[yp * S + x] - h[ym * S + x]) * strength;
                const len = Math.sqrt(dx * dx + dy * dy + 1);
                const i = (y * S + x) * 4;
                img.data[i]     = Math.floor(((-dx / len) * 0.5 + 0.5) * 255);
                img.data[i + 1] = Math.floor(((-dy / len) * 0.5 + 0.5) * 255);
                img.data[i + 2] = Math.floor((1 / len) * 0.5 * 255 + 127.5);
                img.data[i + 3] = 255;
            }
            g.putImageData(img, 0, 0);
            _groundNormalTex = new THREE.CanvasTexture(c);
            _groundNormalTex.wrapS = _groundNormalTex.wrapT = THREE.RepeatWrapping;
            _groundNormalTex.repeat.set(1, 1);
            return _groundNormalTex;
        }

        // shared per-biome environment materials (cached for the session, marked shared)
        const envMatCache = {};
        function getEnvMat(key, factory) {
            if (!envMatCache[key]) envMatCache[key] = markShared(factory());
            return envMatCache[key];
        }

        // ---------- v17: streamed ground tiles ----------
