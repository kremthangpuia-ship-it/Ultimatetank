        let groundTiles = [];
        function bakeGroundTile(mesh, wx, wz, biome) {
            const pos = mesh.geometry.attributes.position;
            const uv = mesh.geometry.attributes.uv;
            const colors = [];
            const blendB = biomeBlend; // v20: blend colors during morphs
            const bcol = (k) => blendB ? new THREE.Color(blendB.from[k]).lerp(new THREE.Color(blendB.to[k]), blendB.e) : new THREE.Color(biome[k]);
            const baseColor = bcol('groundColor');
            const grassColor = bcol('grassColor');
            const isFrozen = biome.name.includes('Frozen');
            const isBlood = biome.name.includes('Blood Moon');
            const dryColor = new THREE.Color(isFrozen ? 0x9fb4c4 : isBlood ? 0x501f1f : 0x7a5c33);
            const dryness = biome.name.includes('Forest') ? 1.0 : biome.name.includes('Desert') ? 1.2
                          : biome.name.includes('Swamp') ? 0.8 : biome.name.includes('Volcanic') ? 0.6
                          : biome.name.includes('Frozen') ? 1.05 : 0.35; // v18: visible blue-grey patches in snow
            const uSize = 48; // world units per texture repeat — continuous across tiles
            const rnd = chunkSeededRand(((wx * 31 + wz * 17) | 0) >>> 0); // stable color noise per tile
            for (let i = 0; i < pos.count; i++) {
                const lx = pos.getX(i), ly = pos.getY(i);        // plane local (pre-rotation)
                const wxv = wx + lx, wzv = wz - ly;              // world coords of this vertex
                const h = blendedHeight(wxv, wzv); // v20: morph-aware heights
                pos.setZ(i, h);
                const patch = Math.sin(wxv * 0.045 + 1.3) * Math.cos(wzv * 0.05 - 0.7)
                            + Math.sin(wxv * 0.021 - wzv * 0.033 + 0.5) * 0.6;
                const dry = Math.min(1, Math.max(0, (patch - 0.45) * 1.7)) * dryness;
                const blend = Math.min(1, Math.max(0, (h + 1) / 4));
                const c = baseColor.clone().lerp(grassColor, blend * 0.4 + rnd() * 0.15);
                c.lerp(dryColor, dry * 0.5 + rnd() * 0.08);
                colors.push(c.r, c.g, c.b);
                uv.setXY(i, wxv / uSize, -wzv / uSize);
            }
            mesh.geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
            pos.needsUpdate = true;
            uv.needsUpdate = true;
            mesh.geometry.computeVertexNormals();
            // v21: bounding sphere skipped — tiles are never frustum-culled
        }

        function buildGroundTiles(biome) {
            groundTiles.forEach(t => { scene.remove(t.mesh); disposeObject3D(t.mesh); });
            groundTiles = [];
            const segs = 24, size = CHUNK; // 2-unit vertex spacing; shared edges are seamless (same analytic fn)
            for (let ix = 0; ix < CHUNK_TILES; ix++) for (let iz = 0; iz < CHUNK_TILES; iz++) {
                const geo = new THREE.PlaneGeometry(size, size, segs, segs);
                const mat = new THREE.MeshStandardMaterial({
                    vertexColors: true, roughness: 0.9, metalness: 0.1,
                    map: getGroundDetailTexture(), normalMap: getGroundNormalMap(),
                    normalScale: new THREE.Vector2(0.35, 0.35)
                });
                const mesh = new THREE.Mesh(geo, mat);
                mesh.rotation.x = -Math.PI / 2;
                mesh.receiveShadow = true;
                mesh.frustumCulled = false;
                scene.add(mesh);
                groundTiles.push({ mesh, ix, iz, worldX: null, worldZ: null });
            }
            _lastTileAnchor = null;
        }

        let _lastTileAnchor = null;
        function repositionGroundTiles(biome, px, pz) {
            const ax = Math.floor(px / CHUNK), az = Math.floor(pz / CHUNK);
            if (_lastTileAnchor && _lastTileAnchor.ax === ax && _lastTileAnchor.az === az) return;
            const half = Math.floor(CHUNK_TILES / 2);
            for (const t of groundTiles) {
                const cx = ax + t.ix - half, cz = az + t.iz - half;
                const wx = cx * CHUNK + CHUNK / 2, wz = cz * CHUNK + CHUNK / 2; // tile center
                t.mesh.position.set(wx, 0, wz);
                if (t.worldX !== wx || t.worldZ !== wz) {
                    bakeGroundTile(t.mesh, wx, wz, biome);
                    t.worldX = wx; t.worldZ = wz;
                }
            }
            _lastTileAnchor = { ax, az };
        }

        // ---------- v17: streamed environment chunks ----------
        // Each 48x48 chunk generates deterministic scenery from its seed, baked into
        // merged meshes (trees/rocks) + one grass InstancedMesh + feature props.
        // Chunks build one-per-frame (no hitches); revisiting regenerates identically.
        // v22: INCREMENTAL CHUNK BUILDER — a chunk is ~20 micro-ops (objects, merges,
        // grass, commit) spread across frames and built OFF-SCREEN; the old chunk stays
        // visible until the new one swaps in atomically. No frame ever does heavy work.
        function planEnvChunk(cx, cz) {
            const biome = BIOMES[state.currentBiome];
            const rnd = chunkSeededRand(chunkSeed(cx, cz));
            const ox = cx * CHUNK, oz = cz * CHUNK;
            const chunk = { meshes: [], colliders: [], key: chunkKey(cx, cz), buckets: null, destructibles: [] };
            const buckets = new Map();
            const put = (matKey, mat, geo, castShadow, receiveShadow) => {
                let b = buckets.get(matKey);
                if (!b) { b = { mat, castShadow, receiveShadow, geos: [], mesh: null }; buckets.set(matKey, b); }
                b.geos.push(geo);
            };
            const ops = [];
            const density = (CHUNK * CHUNK) / (136 * 136) * 6;

            const openness = biome.name.includes('Forest') || biome.name.includes('Swamp') ? 0.55 : 0.35;
            const groves = rnd() < openness ? 1 + Math.floor(rnd() * 2) : 0;
            const treeSpots = [];
            for (let g = 0; g < groves; g++) {
                const gx = ox + 8 + rnd() * (CHUNK - 16);
                const gz = oz + 8 + rnd() * (CHUNK - 16);
                const trees = 2 + Math.floor(rnd() * 4);
                for (let t = 0; t < trees; t++) {
                    const a = rnd() * Math.PI * 2;
                    const d = rnd() * rnd() * 11;
                    const x = gx + Math.cos(a) * d, z = gz + Math.sin(a) * d;
                    if (x > ox && x < ox + CHUNK && z > oz && z < oz + CHUNK && Math.hypot(x, z) > 26) treeSpots.push([x, z]);
                }
            }
            treeSpots.forEach(s => ops.push(() => createSingleTree(biome, s[0], s[1], rnd, put, chunk)));

            const rockN = Math.round((biome.rockCount || 0) * density);
            const rockSpots = [];
            for (let i = 0; i < rockN; i++) {
                const x = ox + rnd() * CHUNK, z = oz + rnd() * CHUNK;
                if (Math.hypot(x, z) > 20) rockSpots.push([x, z]);
            }
            rockSpots.forEach(s => ops.push(() => createSingleRock(biome, s[0], s[1], rnd, put, chunk)));

            // v1.4: water rendering removed — no water in any biome
            if (biome.hasLava) for (let i = 0; i < 2; i++) { const roll = rnd(); const lx = ox + 8 + rnd() * (CHUNK - 16), lz = oz + 8 + rnd() * (CHUNK - 16); if (roll < 0.5) ops.push(() => buildChunkLava(biome, lx, lz, chunk, rnd)); }
            if (biome.hasCrystals) for (let i = 0; i < 8; i++) { const roll = rnd(); const cxp = ox + rnd() * CHUNK, czp = oz + rnd() * CHUNK; if (roll < 0.7) ops.push(() => buildChunkCrystalCluster(biome, cxp, czp, chunk, rnd)); }
            if (biome.hasSpikes) for (let i = 0; i < 6; i++) { const roll = rnd(); const sx = ox + rnd() * CHUNK, sz = oz + rnd() * CHUNK; if (roll < 0.7) ops.push(() => buildChunkSpikes(biome, sx, sz, chunk, rnd)); }

            return { cx, cz, chunk, buckets, put, ops, i: 0, phase: 'objects', mergeList: null, mi: 0, grass: biome.grassCount > 0, rnd };
        }

        function stepChunkTask(task) { // one micro-op; returns true when the chunk commits
            const c = task.chunk;
            if (task.phase === 'objects') {
                if (task.i < task.ops.length) { task.ops[task.i++](); return false; }
                task.mergeList = [...task.buckets.values()].filter(b => b.geos.length);
                task.phase = 'merge'; task.mi = 0;
                return false;
            }
            if (task.phase === 'merge') {
                if (task.mi < task.mergeList.length) {
                    const b = task.mergeList[task.mi++];
                    const merged = new THREE.Mesh(mergeGeometries(b.geos), b.mat);
                    merged.castShadow = b.castShadow;
                    merged.receiveShadow = b.receiveShadow;
                    merged.frustumCulled = false;
                    b.mesh = merged;
                    c.meshes.push(merged);
                    return false;
                }
                task.phase = 'grass';
                return false;
            }
            if (task.phase === 'grass') {
                task.phase = 'commit';
                if (!task.grass) return false;
                const biome = BIOMES[state.currentBiome];
                const density = (CHUNK * CHUNK) / (136 * 136) * 6;
                const blades = Math.round(biome.grassCount * density * (state.quality === 'low' ? 0.4 : 1)) * 5; // v25
                if (blades > 0) {
                    const ox = task.cx * CHUNK, oz = task.cz * CHUNK, rnd = task.rnd;
                    const grassGeo = new THREE.ConeGeometry(0.1, 0.8, 4);
                    const grassMat = new THREE.MeshStandardMaterial({ color: biome.grassColor, roughness: 0.9, side: THREE.DoubleSide });
                    const inst = new THREE.InstancedMesh(grassGeo, grassMat, blades);
                    let idx = 0;
                    for (let i = 0; i < Math.floor(blades / 5) && idx < blades; i++) {
                        const cxp = ox + rnd() * CHUNK, czp = oz + rnd() * CHUNK;
                        const ty = propHeight(cxp, czp);
                        for (let j = 0; j < 5 && idx < blades; j++) {
                            _dummy.position.set(cxp + (rnd() - 0.5) * 0.5, ty + 0.4, czp + (rnd() - 0.5) * 0.5);
                            _dummy.rotation.set((rnd() - 0.5) * 0.3, 0, (rnd() - 0.5) * 0.3);
                            _dummy.scale.setScalar(1);
                            _dummy.updateMatrix();
                            inst.setMatrixAt(idx++, _dummy.matrix);
                        }
                    }
                    inst.count = idx;
                    inst.instanceMatrix.needsUpdate = true;
                    inst.frustumCulled = false;
                    c.meshes.push(inst);
                }
                return false;
            }
            if (task.phase === 'commit') {
                c.buckets = task.buckets;
                if (envChunks.has(c.key)) disposeEnvChunk(c.key); // double-buffer: swap, never a gap
                for (const m of c.meshes) scene.add(m);
                envChunks.set(c.key, c);
                return true;
            }
            return true;
        }

        let chunkTasks = [];
        function runChunkTasks(budgetMs) { // v22: micro-ops within a per-frame time budget
            const t0 = performance.now();
            while (chunkTasks.length && performance.now() - t0 < (budgetMs || 2)) {
                const task = chunkTasks[0];
                const done = stepChunkTask(task);
                if (done) chunkTasks.shift();
            }
        }
        function buildChunkTask(cx, cz, front, replace) {
            const key = chunkKey(cx, cz);
            if (chunkTasks.some(t => t.chunk.key === key)) return;
            if (!replace && envChunks.has(key)) return;
            const task = planEnvChunk(cx, cz);
            if (front) chunkTasks.unshift(task); else chunkTasks.push(task);
        }
        function buildEnvChunk(cx, cz) { // immediate (boot/initial load) — drains the task synchronously
            const key = chunkKey(cx, cz);
            if (envChunks.has(key)) return;
            const task = planEnvChunk(cx, cz);
            let guard = 0;
            while (!stepChunkTask(task) && guard++ < 10000) {}
        }

        function disposeEnvChunk(key) {
            const chunk = envChunks.get(key);
            if (!chunk) return;
            chunk.meshes.forEach(m => { scene.remove(m); disposeObject3D(m); if (m.isInstancedMesh && m.dispose) m.dispose(); });
            if (chunk.buckets) for (const b of chunk.buckets.values()) b.geos.forEach(g => g.dispose());
            lavaMeshes = lavaMeshes.filter(l => !chunk.meshes.includes(l));
            waterMeshes = waterMeshes.filter(w => !chunk.meshes.includes(w)); // v26: purge chunk water refs
            glowSpots = glowSpots.filter(s => s.chunkKey !== key); // v26: purge this chunk's glow spots
            envChunks.delete(key);
        }

        function streamChunks(px, pz, immediate) {
            const pcx = Math.floor(px / CHUNK), pcz = Math.floor(pz / CHUNK);
            const wanted = [];
            for (let dx = -CHUNK_ENV_RADIUS; dx <= CHUNK_ENV_RADIUS; dx++)
                for (let dz = -CHUNK_ENV_RADIUS; dz <= CHUNK_ENV_RADIUS; dz++) {
                    const key = chunkKey(pcx + dx, pcz + dz);
                    if (!envChunks.has(key) && !chunkTasks.some(t => t.chunk.key === key) && !chunkBuildQueue.some(c => c.key === key)) {
                        wanted.push({ key, cx: pcx + dx, cz: pcz + dz, d: dx * dx + dz * dz });
                    }
                }
            wanted.sort((a, b) => a.d - b.d);
            if (immediate) wanted.forEach(w => buildEnvChunk(w.cx, w.cz));
            else wanted.forEach(w => chunkBuildQueue.push(w));
            for (const key of [...envChunks.keys()]) {
                const parts = key.split(',');
                if (Math.max(Math.abs(parts[0] - pcx), Math.abs(parts[1] - pcz)) > CHUNK_ENV_RADIUS + 1) disposeEnvChunk(key);
            }
        }

        function updateChunkStream() { // v22: queued wants become micro-op tasks; ~2ms/frame budget while roaming
            if (!player) return;
            let spawned = 0;
            while (chunkBuildQueue.length && spawned < 2) {
                const w = chunkBuildQueue.shift();
                const pcx = Math.floor(player.mesh.position.x / CHUNK), pcz = Math.floor(player.mesh.position.z / CHUNK);
                if (Math.max(Math.abs(w.cx - pcx), Math.abs(w.cz - pcz)) > CHUNK_ENV_RADIUS + 1) continue;
                buildChunkTask(w.cx, w.cz, false);
                spawned++;
            }
            runChunkTasks(2);
        }

        // ---------------------------------------------------------------------------
        // Q047: DESTRUCTIBLE COVER — sized in "player shells", not raw hit points.
        // The legacy builds gave a tree 4..10 HP and a rock 2..7 HP, fixed at chunk-build
        // time and never scaled. Early on cover was unbreakable; by level 30 it evaporated
        // in a single shot. Both readings are wrong, and chunk-build time is the wrong
        // moment to decide anyway — a prop built at level 1 may not be reached until 30.
        //
        // So a prop carries a normalised pool of CONFIG.cover.hitsToBreak and each impact
        // charges it in proportion to the incoming damage against the player's CURRENT
        // shell damage, evaluated at the moment of impact. The result is level-independent
        // by construction: exactly two player shells break any tree or rock, at any level.
        // Enemy shells charge the same pool, so a weaker enemy takes longer to clear cover
        // — which is the second half of the decision.
        // ---------------------------------------------------------------------------
        function coverReferenceDamage() {
            const pct = ((state.playerStats && state.playerStats.damage) || 100) / 100;
            return Math.max(1, CONFIG.baseDamage * pct);
        }
        function coverHitCost(incomingDamage) {
            // One player shell costs exactly 1 unit, and the pool is hitsToBreak (2) units,
            // so exactly two player shells break any prop. A shell that hits twice as hard
            // as the reference costs 2 and breaks it in one — which is the intended
            // behaviour, since "two hits" is measured against the player's own current
            // output. Enemy shells score below 1, so weaker enemies need more hits.
            return (incomingDamage || 0) / coverReferenceDamage();
        }

        function destroyDestructible(chunk, dst) { // v19: cover shatters — sightlines open up
            if (dst.dead) return;
            dst.dead = true;
            const pos = new THREE.Vector3(dst.x, dst.y + 1.2, dst.z);
            if (dst.type === 'tree') {
                createExplosion(pos, 30, 0x8a5a2a, 'tree');
                SFX.shatterWood(); // v23
                state.cameraShake = Math.max(state.cameraShake, 0.25);
            } else {
                createExplosion(pos, 24, 0x8a8a8a, 'rock');
                SFX.shatterRock(); // v23
                state.cameraShake = Math.max(state.cameraShake, 0.2);
            }
            lifeStats().destroyed++; // v23
            const ci = chunk.colliders.indexOf(dst);
            if (ci >= 0) chunk.colliders.splice(ci, 1);
            for (const g of dst.geos) {
                const b = chunk.buckets && chunk.buckets.get(g.key);
                if (!b) continue;
                const idx = b.geos.indexOf(g.geo);
                if (idx >= 0) b.geos.splice(idx, 1);
                if (b.mesh) {
                    const oldGeo = b.mesh.geometry;
                    b.mesh.geometry = b.geos.length ? mergeGeometries(b.geos) : new THREE.BufferGeometry();
                    oldGeo.dispose();
                    g.geo.dispose();
                }
            }
        }

        // ---- per-chunk scenery builders (seeded; bake into chunk buckets) ----
        function createSingleTree(biome, x, z, rnd, put, chunk) {
            const tree = new THREE.Group();
            const mark = (geo, matKey, mat) => { geo.applyMatrix4(new THREE.Matrix4()); return { geo, matKey, mat }; };
            const collect = [];
            const leafy = biome.name.includes('Forest') || biome.name.includes('Swamp') || biome.name.includes('Autumn') || biome.name.includes('Sakura');
            const segments = 8;
            // v18: shorter trees (tanks stay visible), strong height variance per tree
            if (leafy) {
                const trunkHeight = 2.6 + rnd() * 1.6; // v19: mid-size 2.6-4.2
                const trunkMat = getEnvMat(biome.name + '|trunk', () => new THREE.MeshStandardMaterial({ color: 0x4a3728, roughness: 0.9 }));
                collect.push({ geo: new THREE.CylinderGeometry(0.28, 0.45, trunkHeight, segments), mat: trunkMat, matKey: 'trunk', cast: true, y: trunkHeight / 2 });
                const foliageColor = biome.name.includes('Swamp') ? 0x4a6a3a : biome.name.includes('Autumn') ? 0xd97c2b : biome.name.includes('Sakura') ? 0xf9a8d4 : 0x2d5a27;
                const foliageMat = getEnvMat(biome.name + '|foliage', () => new THREE.MeshStandardMaterial({ color: foliageColor, roughness: 0.8 }));
                const layers = rnd() < 0.3 ? 2 : 3; // v19: fuller canopies
                for (let j = 0; j < layers; j++) {
                    const size = (layers === 2 ? 2.7 - j * 0.9 : 2.9 - j * 0.75) * (0.85 + rnd() * 0.3);
                    collect.push({ geo: new THREE.ConeGeometry(size, size * 1.4, segments), mat: foliageMat, matKey: 'foliage', cast: true, y: trunkHeight + 0.4 + j * 1.25 });
                }
            } else if (biome.name.includes('Frozen')) {
                // v18: dark spruce with a snow cap — readable against the snow (was white-on-white)
                const trunkMat = getEnvMat(biome.name + '|ftrunk', () => new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 0.9 }));
                collect.push({ geo: new THREE.CylinderGeometry(0.18, 0.34, 2.0, segments), mat: trunkMat, matKey: 'ftrunk', cast: true, y: 1.0 });
                const spruceMat = getEnvMat(biome.name + '|fspruce', () => new THREE.MeshStandardMaterial({ color: 0x2f5d50, roughness: 0.85 }));
                const snowMat = getEnvMat(biome.name + '|fsnow', () => new THREE.MeshStandardMaterial({ color: 0xf5fafc, roughness: 0.6 }));
                const th = 2.4 + rnd() * 1.8; // v19: taller spruces
                collect.push({ geo: new THREE.ConeGeometry(1.6, th, segments), mat: spruceMat, matKey: 'fspruce', cast: true, y: 1.6 + th / 2 });
                collect.push({ geo: new THREE.ConeGeometry(1.05, th * 0.75, segments), mat: spruceMat, matKey: 'fspruce', cast: true, y: 1.6 + th + 0.3 });
                collect.push({ geo: new THREE.ConeGeometry(0.62, th * 0.5, segments), mat: snowMat, matKey: 'fsnow', cast: true, y: 1.6 + th * 1.72 + 0.35 }); // snow cap
            } else if (biome.name.includes('Desert')) {
                const cactusMat = getEnvMat(biome.name + '|cactus', () => new THREE.MeshStandardMaterial({ color: 0x228b22, roughness: 0.7 }));
                const ch = 1.7 + rnd() * 1.1;
                collect.push({ geo: new THREE.CylinderGeometry(0.35, 0.45, ch, segments), mat: cactusMat, matKey: 'cactus', cast: true, y: ch / 2 });
                if (rnd() > 0.3) collect.push({ geo: new THREE.CylinderGeometry(0.18, 0.22, 1.1, 6), mat: cactusMat, matKey: 'cactus', cast: true, y: ch * 0.62, x: 0.5, rz: -Math.PI / 4 });
            } else if (biome.name.includes('Volcanic')) {
                const trunkMat = getEnvMat(biome.name + '|vtrunk', () => new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 1 }));
                collect.push({ geo: new THREE.CylinderGeometry(0.14, 0.28, 1.8, 5), mat: trunkMat, matKey: 'vtrunk', cast: true, y: 0.9, rz: (rnd() - 0.5) * 0.3 });
            }
            const terrainY = propHeight(x, z);
            const scale = 0.75 + rnd() * 0.4; // v19: 0.75-1.15 — uneven, mid-size
            const rotY = rnd() * Math.PI * 2;
            const m4 = new THREE.Matrix4().compose(
                new THREE.Vector3(x, terrainY, z),
                new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rotY, 0)),
                new THREE.Vector3(scale, scale, scale)
            );
            const partsGeo = [];
            for (const part of collect) {
                const local = new THREE.Matrix4().makeTranslation(part.x || 0, part.y, part.z || 0);
                if (part.rz) local.multiply(new THREE.Matrix4().makeRotationZ(part.rz));
                const world = m4.clone().multiply(local);
                part.geo.applyMatrix4(world);
                put(part.matKey, part.mat, part.geo, true, false);
                partsGeo.push({ key: part.matKey, geo: part.geo });
            }
            // v19: destructible cover — trees soak hits (HP by size), then shatter
            // Q047: normalised pool — CONFIG.cover.hitsToBreak player shells, any level
            const treeHp = CONFIG.cover.hitsToBreak;
            const treeDst = { x, z, r: 1.5 * scale, type: 'tree', hp: treeHp, maxHp: treeHp, geos: partsGeo, dead: false, y: terrainY };
            chunk.destructibles.push(treeDst);
            chunk.colliders.push(treeDst);
        }

        function createSingleRock(biome, x, z, rnd, put, chunk) {
            const size = 0.5 + rnd() * 2;
            const rockGeo = new THREE.DodecahedronGeometry(size, 1);
            const positions = rockGeo.attributes.position;
            for (let j = 0; j < positions.count; j++) {
                const px = positions.getX(j), py = positions.getY(j), pz = positions.getZ(j);
                const noise = 1 + (rnd() - 0.5) * 0.3;
                positions.setXYZ(j, px * noise, py * noise * 0.6, pz * noise);
            }
            rockGeo.computeVertexNormals();
            let rockColor = 0x6a6a6a;
            if (biome.name.includes('Volcanic')) rockColor = 0x2a2a2a;
            if (biome.name.includes('Frozen')) rockColor = 0x8090a0;
            if (biome.name.includes('Desert')) rockColor = 0xb8956a;
            if (biome.name.includes('Blood Moon')) rockColor = 0x4a2020;
            if (biome.name.includes('Neon')) rockColor = 0x1a1a24;
            if (biome.name.includes('Sakura')) rockColor = 0xb09898;
            if (biome.name.includes('Autumn')) rockColor = 0x8a6a4a;
            const rockMat = getEnvMat(biome.name + '|rock', () => new THREE.MeshStandardMaterial({ color: rockColor, roughness: 0.95, metalness: 0.1 }));
            const terrainY = propHeight(x, z);
            const m4 = new THREE.Matrix4().compose(
                new THREE.Vector3(x, terrainY + size * 0.3, z),
                new THREE.Quaternion().setFromEuler(new THREE.Euler(rnd() * 0.4, rnd() * Math.PI * 2, rnd() * 0.4)),
                new THREE.Vector3(1, 1, 1)
            );
            rockGeo.applyMatrix4(m4);
            put('rock', rockMat, rockGeo, true, true);
            // v19: destructible rock — toughness scales with size
            const rockHp = CONFIG.cover.hitsToBreak;   // Q047: normalised, see tree above
            const rockDst = { x, z, r: size, type: 'rock', hp: rockHp, maxHp: rockHp, geos: [{ key: 'rock', geo: rockGeo }], dead: false, y: terrainY };
            chunk.destructibles.push(rockDst);
            chunk.colliders.push(rockDst);
        }

        function buildChunkWater(biome, x, z, chunk) {
            // v1.2: water sits at terrain level (not above it) — visually clear, never blocks the tank
            const waterGeo = new THREE.PlaneGeometry(26, 26, 12, 12);
            const waterMat = new THREE.MeshStandardMaterial({ color: biome.waterColor, transparent: true, opacity: 0.82, roughness: 0.05, metalness: 0.9 });
            const m = new THREE.Mesh(waterGeo, waterMat);
            m.rotation.x = -Math.PI / 2;
            // Place at terrain level (0.0 offset) so it reads as scenic, not a field obstacle
            m.position.set(x, getTerrainHeight(x, z), z);
            m.receiveShadow = true;
            waterMeshes.push(m); // v26: registered for the wave animation
            chunk.meshes.push(m); // v22: added at commit
        }
        function buildChunkLava(biome, x, z, chunk, rnd) {
            const size = 3 + rnd() * 5;
            const lava = new THREE.Mesh(new THREE.CircleGeometry(size, 16), new THREE.MeshBasicMaterial({ color: biome.lavaColor, transparent: true, opacity: 0.9 }));
            lava.rotation.x = -Math.PI / 2;
            lava.position.set(x, getTerrainHeight(x, z) + 0.15, z);
            lava.userData = { baseY: lava.position.y, phase: rnd() * Math.PI * 2 };
            lavaMeshes.push(lava);
            chunk.meshes.push(lava); // v22: added at commit
            // v26: glow registered as a spot for the pooled lights (was: a real PointLight per lava pool)
            glowSpots.push({ x: x, y: getTerrainHeight(x, z) + 1, z: z, color: 0xff4500, intensity: 2, dist: 15, chunkKey: chunk.key });
        }
        function buildChunkCrystalCluster(biome, x, z, chunk, rnd) {
            for (let i = 0; i < 3 + Math.floor(rnd() * 4); i++) {
                const height = 1 + rnd() * 4;
                const col = new THREE.Color().setHSL(0.5 + rnd() * 0.2, 0.8, 0.5);
                const cx = x + (rnd() - 0.5) * 8, cz = z + (rnd() - 0.5) * 8;
                const crystal = new THREE.Mesh(
                    new THREE.ConeGeometry(0.3 + rnd() * 0.4, height, 6),
                    new THREE.MeshStandardMaterial({ color: col, transparent: true, opacity: 0.8, roughness: 0.1, metalness: 0.9, emissive: col.clone().multiplyScalar(0.5), emissiveIntensity: 0.5 })
                );
                crystal.position.set(cx, getTerrainHeight(cx, cz) + height / 2, cz);
                crystal.rotation.z = (rnd() - 0.5) * 0.3;
                chunk.meshes.push(crystal); // v22: added at commit
                if (rnd() > 0.6) {
                    // v26: glow registered as a spot for the pooled lights (was: a real
                    // PointLight per crystal — hundreds in Crystal Caverns). Same rnd()
                    // roll is consumed, so the seeded world layout is byte-identical.
                    glowSpots.push({ x: cx, y: crystal.position.y + height / 2, z: cz, color: col.getHex(), intensity: 0.5, dist: 8, chunkKey: chunk.key });
                }
            }
        }
        function buildChunkSpikes(biome, x, z, chunk, rnd) {
            for (let i = 0; i < 3; i++) {
                const height = 2 + rnd() * 5;
                const sx = x + (rnd() - 0.5) * 10, sz = z + (rnd() - 0.5) * 10;
                const spike = new THREE.Mesh(new THREE.ConeGeometry(0.5 + rnd() * 0.5, height, 5), new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.8, metalness: 0.3 }));
                spike.position.set(sx, getTerrainHeight(sx, sz) + height / 2, sz);
                spike.rotation.z = (rnd() - 0.5) * 0.3;
                spike.castShadow = true;
                chunk.meshes.push(spike); // v22: added at commit
            }
        }

        let envParticleMesh = null; // FIX (Tier 3): single InstancedMesh for all ambient particles

        function createEnvironmentParticles(biome) {
            // v25 fix: always reset the ambient cloud (quality switch / morph append-multiply bug)
            if (envParticleMesh) { scene.remove(envParticleMesh); disposeObject3D(envParticleMesh); if (envParticleMesh.dispose) envParticleMesh.dispose(); envParticleMesh = null; }
            environmentParticles = [];
            const particleCount = state.quality === 'low' ? 50 : 120; // v25

            // FIX (Tier 3): one InstancedMesh (1 draw call) instead of 120 separate meshes.
            // Same geometry/material params; leaves keep their random two-color mix via
            // per-instance colors. Positions are written per frame in updatePhysics.
            let geo, mat, twoTone = false;
            if (biome.particleType === 'snow') {
                geo = new THREE.SphereGeometry(0.12);
                mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
            } else if (biome.particleType === 'embers') {
                geo = new THREE.SphereGeometry(0.18);
                mat = new THREE.MeshBasicMaterial({ color: biome.particleColor });
            } else if (biome.particleType === 'leaves') {
                geo = new THREE.PlaneGeometry(0.35, 0.35);
                mat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
                twoTone = true;
            } else if (biome.particleType === 'sand') {
                geo = new THREE.SphereGeometry(0.06);
                mat = new THREE.MeshBasicMaterial({ color: biome.particleColor, transparent: true, opacity: 0.6 });
            } else if (biome.particleType === 'fireflies') {
                geo = new THREE.SphereGeometry(0.12);
                mat = new THREE.MeshBasicMaterial({ color: 0xffff00 });
            } else if (biome.particleType === 'sparkles') {
                geo = new THREE.OctahedronGeometry(0.12);
                mat = new THREE.MeshBasicMaterial({ color: biome.particleColor });
            } else {
                geo = new THREE.SphereGeometry(0.1);
                mat = new THREE.MeshBasicMaterial({ color: biome.particleColor });
            }

            envParticleMesh = new THREE.InstancedMesh(geo, mat, particleCount);
            envParticleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
            envParticleMesh.frustumCulled = false;
            const leafColorA = new THREE.Color(biome.leafA || 0x228b22), leafColorB = new THREE.Color(biome.leafB || 0x8b4513); // v9

            for (let i = 0; i < particleCount; i++) {
                // FIX (Tier 3): consume the leaf color random FIRST — same Math.random call
                // order as the original per-mesh version (keeps seeded worlds identical).
                const leafPick = twoTone ? (Math.random() > 0.5 ? leafColorA : leafColorB) : null;
                const pos = new THREE.Vector3(
                    (Math.random() - 0.5) * 160,
                    Math.random() * 20 + 2,
                    (Math.random() - 0.5) * 160
                );

                const velocity = new THREE.Vector3(
                    (Math.random() - 0.5) * 2,
                    biome.particleType === 'embers' ? Math.random() * 3 : -Math.random() * 2,
                    (Math.random() - 0.5) * 2
                );

                environmentParticles.push({
                    pos: pos,
                    velocity: velocity,
                    type: biome.particleType,
                    phase: Math.random() * Math.PI * 2
                });

                if (leafPick) envParticleMesh.setColorAt(i, leafPick);
            }
            if (envParticleMesh.instanceColor) envParticleMesh.instanceColor.needsUpdate = true;
            scene.add(envParticleMesh);
        }

        // ============================================
        // HIGH-FIDELITY TANK CLASS
        // ============================================
