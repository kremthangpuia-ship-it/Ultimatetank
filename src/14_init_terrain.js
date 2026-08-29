        function init() {
            try {
            const container = document.getElementById('game-container');

            scene = new THREE.Scene();

            // Camera - Lower angle for more 3D feel
            camera = new THREE.PerspectiveCamera(56, window.innerWidth / window.innerHeight, 0.1, 500);
            camera.position.set(0, 32, 40);
            camera.lookAt(0, 1, -10);

            renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
            renderer.setSize(window.innerWidth, window.innerHeight);
            renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25)); // Performance optimization
            renderer.shadowMap.enabled = true;
            renderer.shadowMap.type = THREE.PCFSoftShadowMap;
            renderer.toneMapping = THREE.ACESFilmicToneMapping;
            renderer.toneMappingExposure = 1.0;
            container.appendChild(renderer.domElement);

            clock = new THREE.Clock();

            // FIX (Tier 3): persistent dynamic lights exist before gameplay starts, so the
            // one-time shader recompile happens behind the start screen, never in combat.
            initDynamicLights();

            // Initial biome
            loadBiome(0);

            window.addEventListener('resize', onWindowResize);
            setupInputs();
            animate();
            try { startMenuTankPreview(); } catch (e) {}
            } catch (err) {
                // v26.3: one boot exception must not leave a frozen half-init
                try { console.error('Tank Realms boot error', err); } catch (e) {}
                try {
                    const s = document.getElementById('start-screen');
                    if (s && !document.getElementById('boot-error')) {
                        const msg = document.createElement('div');
                        msg.id = 'boot-error';
                        msg.style.cssText = 'margin:16px auto 0;max-width:320px;padding:12px 14px;border-radius:10px;background:rgba(127,29,29,0.88);color:#fff;font-size:13px;line-height:1.4;text-align:center;';
                        msg.textContent = 'Could not start the 3D view. Close the tab and open the game again.';
                        s.appendChild(msg);
                    }
                } catch (e) {}
            }
        }

        // ============================================
        // TERRAIN HEIGHT SAMPLING - Fixes sinking tanks
        // ============================================
        // v17: INFINITE WORLD — terrain height is analytic (pure math over world
        // coordinates + the active biome), so it extends forever with no stored grid.
        let _activeBiomeRef = BIOMES[0];
        function terrainHeightRaw(x, z, biome) {
            const amplitude = biome.terrainAmplitude || 2;
            const frequency = biome.terrainFrequency || 0.08;
            let height = Math.sin(x * frequency) * Math.cos(z * frequency) * amplitude;
            height += Math.sin(x * frequency * 2 + 1) * Math.cos(z * frequency * 1.5) * amplitude * 0.5;
            height += Math.sin(x * frequency * 0.5) * Math.cos(z * frequency * 0.8 + 2) * amplitude * 0.8;
            if (biome.hasDunes) {
                height += Math.abs(Math.sin(x * 0.06 + z * 0.04)) * 4;
                height += Math.abs(Math.sin(x * 0.03 - z * 0.05)) * 3;
            }
            if (biome.hasSpikes) {
                const spikeFactor = Math.max(0, Math.sin(x * 0.3) * Math.sin(z * 0.3));
                height += spikeFactor * spikeFactor * 6;
            }
            // gentle flatten around the origin spawn so the start is always walkable
            const d = Math.sqrt(x * x + z * z);
            const flat = Math.max(0, 1 - d / 26);
            return height * (1 - flat * 0.8);
        }
        function getTerrainHeight(x, z) {
            return blendedHeight(x, z); // v20: morph-aware during realm transitions
        }
        function propHeight(x, z) {
            return getTerrainHeight(x, z);
        }

        function getTerrainNormal(x, z, target) {
            const delta = 0.5;
            const hL = getTerrainHeight(x - delta, z);
            const hR = getTerrainHeight(x + delta, z);
            const hD = getTerrainHeight(x, z - delta);
            const hU = getTerrainHeight(x, z + delta);
            
            const normal = target || new THREE.Vector3(hL - hR, 2 * delta, hD - hU); // FIX (Tier 3): reuse target when given
            normal.set(hL - hR, 2 * delta, hD - hU);
            normal.normalize();
            return normal;
        }

