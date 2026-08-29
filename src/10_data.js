        // ============================================
        // BIOME CONFIGURATIONS - Realistic Environments
        // ============================================
        const BIOMES = [
            {
                name: "Enchanted Forest",
                skyTop: 0x87ceeb,
                skyBottom: 0x228b22,
                fogColor: 0x2d5a27,
                fogNear: 45,
                fogFar: 185,
                groundColor: 0x3d2817,
                grassColor: 0x228b22,
                ambientLight: 0x404040,
                sunColor: 0xfff5e0,
                sunIntensity: 1.2,
                treeCount: 50,
                rockCount: 30,
                grassCount: 250,
                hasWater: false,
                particleColor: 0x90ee90,
                particleType: 'leaves',
                terrainAmplitude: 2.5,
                terrainFrequency: 0.08,
                exposure: 1.16
            },
            {
                name: "Frozen Tundra",
                skyTop: 0xb0c4de,
                skyBottom: 0xdceaf2,
                fogColor: 0xc4d4e2,
                fogNear: 38,
                fogFar: 155,
                groundColor: 0xdde9ef, // v18: softened from near-white (glare fix)
                grassColor: 0x9fc4d4,
                ambientLight: 0x8090a0,
                sunColor: 0xffffff,
                sunIntensity: 0.9,
                treeCount: 20,
                rockCount: 35,
                grassCount: 60,
                hasWater: false, // v1.4: water disabled per user request
                waterColor: 0x4a90b8,
                particleColor: 0xffffff,
                particleType: 'snow',
                terrainAmplitude: 1.5,
                terrainFrequency: 0.06,
                exposure: 1.22
            },
            {
                name: "Volcanic Wasteland",
                skyTop: 0x1a0a00,
                skyBottom: 0x8b0000,
                fogColor: 0x2a1a10,
                fogNear: 30,
                fogFar: 140,
                groundColor: 0x1a1a1a,
                grassColor: 0x8b4513,
                ambientLight: 0x402010,
                sunColor: 0xff6600,
                sunIntensity: 0.8,
                treeCount: 8,
                rockCount: 60,
                grassCount: 25,
                hasLava: true,
                lavaColor: 0xff4500,
                particleColor: 0xff4500,
                particleType: 'embers',
                terrainAmplitude: 4,
                terrainFrequency: 0.12,
                hasSpikes: true,
                exposure: 1.26
            },
            {
                name: "Golden Desert",
                skyTop: 0x87ceeb,
                skyBottom: 0xffd700,
                fogColor: 0xd4a574,
                fogNear: 60,
                fogFar: 225,
                groundColor: 0xdaa520,
                grassColor: 0xf4a460,
                ambientLight: 0x806040,
                sunColor: 0xfffaf0,
                sunIntensity: 1.5,
                treeCount: 10,
                rockCount: 25,
                grassCount: 35,
                hasDunes: true,
                particleColor: 0xdaa520,
                particleType: 'sand',
                terrainAmplitude: 5,
                terrainFrequency: 0.04,
                exposure: 1.19
            },
            {
                name: "Mystic Swamp",
                skyTop: 0x2f4f4f,
                skyBottom: 0x556b2f,
                fogColor: 0x3a4a3a,
                fogNear: 22,
                fogFar: 108,
                groundColor: 0x2d4a2d,
                grassColor: 0x6b8e23,
                ambientLight: 0x304030,
                sunColor: 0xc0ffc0,
                sunIntensity: 0.6,
                treeCount: 45,
                rockCount: 20,
                grassCount: 180,
                hasWater: false, // v1.4: water disabled per user request
                waterColor: 0x2f4f2f,
                particleColor: 0x90ee90,
                particleType: 'fireflies',
                terrainAmplitude: 1.0,
                terrainFrequency: 0.1,
                exposure: 1.06
            },
            {
                name: "Crystal Caverns",
                skyTop: 0x0a0a20,
                skyBottom: 0x1a1a40,
                fogColor: 0x101030,
                fogNear: 30,
                fogFar: 125,
                groundColor: 0x1a1a2e,
                grassColor: 0x4169e1,
                ambientLight: 0x202040,
                sunColor: 0x8080ff,
                sunIntensity: 0.5,
                treeCount: 0,
                rockCount: 50,
                grassCount: 0,
                hasCrystals: true,
                crystalColor: 0x00ffff,
                particleColor: 0x00ffff,
                particleType: 'sparkles',
                terrainAmplitude: 3,
                terrainFrequency: 0.15,
                exposure: 1.12
            },
            // v9(D): four new biomes — the rotation now spans 10 worlds
            {
                name: "Autumn Grove",
                skyTop: 0x87ceeb, skyBottom: 0xd97c2b,
                fogColor: 0xa0622d, fogNear: 35, fogFar: 165,
                groundColor: 0x5c3a1e, grassColor: 0xc26a1f,
                ambientLight: 0x604838, sunColor: 0xffd9b0, sunIntensity: 1.3,
                treeCount: 50, rockCount: 25, grassCount: 200,
                particleColor: 0xd97c2b, particleType: 'leaves',
                leafA: 0xd97c2b, leafB: 0x8b3a1e,
                terrainAmplitude: 2.2, terrainFrequency: 0.09,
                exposure: 1.15
            },
            {
                name: "Sakura Valley",
                skyTop: 0x9ad0ec, skyBottom: 0xf9c8dc,
                fogColor: 0xe8b8cc, fogNear: 32, fogFar: 150,
                groundColor: 0x4a3a30, grassColor: 0x7cc47f,
                ambientLight: 0x706058, sunColor: 0xfff0f5, sunIntensity: 1.25,
                treeCount: 45, rockCount: 20, grassCount: 160,
                hasWater: false, // v1.4: water disabled per user request waterColor: 0x64b6c8,
                particleColor: 0xf9a8d4, particleType: 'leaves',
                leafA: 0xf9a8d4, leafB: 0xffc4d6,
                terrainAmplitude: 1.8, terrainFrequency: 0.08,
                exposure: 1.18
            },
            {
                name: "Blood Moon Canyon",
                skyTop: 0x1a0505, skyBottom: 0x8b0000,
                fogColor: 0x2a0d0d, fogNear: 26, fogFar: 130,
                groundColor: 0x2a1212, grassColor: 0x5c2a2a,
                ambientLight: 0x301818, sunColor: 0xff4500, sunIntensity: 0.9,
                treeCount: 0, rockCount: 65, grassCount: 15,
                hasSpikes: true, hasDunes: true,
                particleColor: 0xff2a2a, particleType: 'embers',
                terrainAmplitude: 5.5, terrainFrequency: 0.11,
                exposure: 1.2
            },
            {
                name: "Neon Void",
                skyTop: 0x05000f, skyBottom: 0x2a0a4a,
                fogColor: 0x120826, fogNear: 24, fogFar: 110,
                groundColor: 0x0d0d1a, grassColor: 0x1f2a44,
                ambientLight: 0x181828, sunColor: 0x8040ff, sunIntensity: 0.7,
                treeCount: 0, rockCount: 40, grassCount: 0,
                hasCrystals: true, crystalColor: 0xff2ad4,
                particleColor: 0x2affea, particleType: 'sparkles',
                terrainAmplitude: 3.5, terrainFrequency: 0.14,
                exposure: 1.08
            }
        ];

        // Enemy Types
        const ENEMY_TYPES = {
            scout: { name: "Scout", color: 0xffd700, hp: 25, speed: 1.5, damage: 11, fireRate: 0.6, size: 0.7, points: 50, desc: "Fast but fragile" },
            soldier: { name: "Soldier", color: 0xdc2626, hp: 50, speed: 1.0, damage: 16, fireRate: 0.4, size: 1.0, points: 100, desc: "Balanced fighter" },
            heavy: { name: "Heavy", color: 0x78350f, hp: 120, speed: 0.5, damage: 28, fireRate: 0.25, size: 1.5, points: 200, desc: "Slow but deadly" },
            sniper: { name: "Sniper", color: 0x7c3aed, hp: 35, speed: 0.6, damage: 30, fireRate: 0.15, size: 0.9, points: 175, desc: "Long range threat" },
            healer: { name: "Medic", color: 0x22c55e, hp: 60, speed: 0.8, damage: 8, fireRate: 0.3, size: 0.85, points: 150, healAmount: 8, desc: "Heals allies" },
            berserker: { name: "Berserker", color: 0xec4899, hp: 80, speed: 1.3, damage: 18, fireRate: 0.7, size: 1.2, points: 250, desc: "Aggressive charger" },
            // v5: new enemy variety
            bomber:   { name: "Bomber",  color: 0xf43f5e, hp: 40, speed: 1.6, damage: 30, fireRate: 0,   size: 0.8,  points: 150, desc: "Suicide rusher — keep your distance!" },
            phantom:  { name: "Phantom", color: 0x94a3b8, hp: 55, speed: 1.2, damage: 14, fireRate: 0.5, size: 0.9,  points: 220, desc: "Cloaked striker — watch the shimmer" },
            gunner:   { name: "Gunner",  color: 0xa855f7, hp: 90, speed: 0.7, damage: 10, fireRate: 0.5, size: 1.15, points: 180, desc: "Fires deadly three-round bursts" },
            // v26: late-game pressure trio
            skirmisher: { name: "Skirmisher", color: 0x2dd4bf, hp: 60,  speed: 1.55, damage: 18, fireRate: 0.65, size: 0.75, points: 260, desc: "Keeps its distance — retreats when you push" },
            wasp:       { name: "Wasp",       color: 0xfacc15, hp: 30,  speed: 2.2,  damage: 8,  fireRate: 0.9,  size: 0.55, points: 95,  desc: "Fast weaving swarm — hard to hit" },
            juggernaut: { name: "Juggernaut", color: 0x334155, hp: 400, speed: 0.38, damage: 30, fireRate: 0.22, size: 2.0,  points: 700, desc: "Armored wall — it will not stop coming" },
            raider:     { name: "Raider",     color: 0xfb7185, hp: 75,  speed: 1.75, damage: 15, fireRate: 0.55, size: 0.85, points: 210, desc: "Dashes in, dumps a clip, dashes out" },
            // v28.4: named variants
            scouter:      { name: "Scouter",      color: 0x4ade80, hp: 32,  speed: 1.65, damage: 10, fireRate: 0.7,  size: 0.72, points: 70,  desc: "Scout plus — slow curving sparks" },
            soldierpro:   { name: "Soldierpro",   color: 0x991b1b, hp: 70,  speed: 1.05, damage: 18, fireRate: 0.42, size: 1.05, points: 130, desc: "Hardened soldier — light-curve bolts" },
            heavier:      { name: "Heavier",      color: 0x292524, hp: 170, speed: 0.42, damage: 32, fireRate: 0.22, size: 1.7,  points: 260, desc: "Bigger heavy — fat straight slugs" },
            picker:       { name: "Picker",       color: 0x818cf8, hp: 42,  speed: 0.55, damage: 34, fireRate: 0.14, size: 0.92, points: 210, desc: "Sniper cousin — slow seeking lances" },
            squsasher:    { name: "Squsasher",    color: 0x0d9488, hp: 80,  speed: 1.6,  damage: 17, fireRate: 0.7,  size: 0.8,  points: 280, desc: "Skirmisher plus — fast curving fire" },
            deathbringer: { name: "Deathbringer", color: 0x7f1d1d, hp: 55,  speed: 1.7,  damage: 28, fireRate: 0.45, size: 0.9,  points: 220, desc: "Bomber that also shoots seeking sparks" },
            phantasm:     { name: "Phantasm",     color: 0xf1f5f9, hp: 70,  speed: 1.25, damage: 16, fireRate: 0.55, size: 0.95, points: 260, desc: "Deeper phantom — slow tracking orbs" },
            gunnier:      { name: "Gunnier",      color: 0x6d28d9, hp: 110, speed: 0.68, damage: 12, fireRate: 0.55, size: 1.2,  points: 240, desc: "Single seeking shots — dodgeable curve" },
            tombraider:   { name: "TombRaider",   color: 0xbe123c, hp: 95,  speed: 1.85, damage: 17, fireRate: 0.6,  size: 0.9,  points: 280, desc: "Raider plus — curving dash fire" },
            hammer:       { name: "Hammer",       color: 0x0f172a, hp: 520, speed: 0.34, damage: 34, fireRate: 0.2,  size: 2.15, points: 850, desc: "Juggernaut plus — heavy seeking slugs" },
            artillery:    { name: "Artillery",    color: 0xc2410c, hp: 70,  speed: 0.42, damage: 26, fireRate: 0.12, size: 1.25, points: 240, desc: "Lobs shells — step off the landing ring" },
            shieldbearer: { name: "Shieldbearer", color: 0x1d4ed8, hp: 150, speed: 0.52, damage: 12, fireRate: 0.22, size: 1.35, points: 220, desc: "Front shield — shoot the flanks" },
            minelayer:    { name: "Mine Layer",   color: 0x3f6212, hp: 85,  speed: 0.88, damage: 22, fireRate: 0.2,  size: 1.0,  points: 230, desc: "Drops mines — do not park on them" },
            commander:    { name: "Commander",    color: 0xeab308, hp: 155, speed: 0.68, damage: 14, fireRate: 0.28, size: 1.18, points: 360, desc: "Buffs nearby tanks — cut the leader" },
            // v6(C): bosses
            warlord:  { name: "WARLORD",  color: 0xb91c1c, hp: 600, speed: 0.225, damage: 10, fireRate: 0.3, size: 2.6, points: 1500, desc: "BOSS — five-shell barrages" }, // v1.2: speed & damage ×0.5
            colossus: { name: "COLOSSUS", color: 0x6d28d9, hp: 750, speed: 0.35, damage: 15, fireRate: 0.3, size: 3.0, points: 1800, desc: "BOSS — bursts and reinforcements" },
            nova:     { name: "NOVA",     color: 0x475569, hp: 550, speed: 0.7,  damage: 12, fireRate: 0.3, size: 2.4, points: 2000, desc: "BOSS — cloaked nova rings" },
            // v24 bosses
            titan:    { name: "TITAN",    color: 0x1f3a5f, hp: 950, speed: 0.3,  damage: 35, fireRate: 0.2, size: 3.4, points: 2200, desc: "BOSS — ground-slam shockwaves" },
            tempest:  { name: "TEMPEST",  color: 0x0ea5e9, hp: 650, speed: 0.9,  damage: 14, fireRate: 0.5, size: 2.2, points: 2400, desc: "BOSS — blinks around the arena" },
            fortress: { name: "FORTRESS", color: 0x713f12, hp: 850, speed: 0.15, damage: 10, fireRate: 0.3, size: 3.1, points: 2600, desc: "BOSS — unending bullet spirals" }
        };
        // v27.4: each enemy shot has its own look, speed, hang-time, and (for some) a seek
        const ENEMY_SHOT = {
            scout:      { color: 0xffe066, speed: 38, life: 1.40, style: 'spark', home: 0.00 },
            soldier:    { color: 0xff3b3b, speed: 44, life: 1.45, style: 'bolt',  home: 0.00 },
            heavy:      { color: 0xff8a3d, speed: 28, life: 1.85, style: 'slug',  home: 0.00 },
            sniper:     { color: 0xd8b4fe, speed: 58, life: 1.80, style: 'lance', home: 0.00 },
            healer:     { color: 0x4ade80, speed: 32, life: 1.35, style: 'orb',   home: 0.00 },
            berserker:  { color: 0xfb7185, speed: 46, life: 1.30, style: 'bolt',  home: 0.00 },
            bomber:     { color: 0xf43f5e, speed: 36, life: 1.20, style: 'spark', home: 0.00 },
            phantom:    { color: 0xcbd5e1, speed: 26, life: 2.10, style: 'orb',   home: 0.09 },
            gunner:     { color: 0xc084fc, speed: 46, life: 1.25, style: 'spark', home: 0.00 },
            skirmisher: { color: 0x2dd4bf, speed: 44, life: 1.40, style: 'bolt',  home: 0.00 },
            wasp:       { color: 0xfde047, speed: 40, life: 1.40, style: 'spark', home: 0.10 },
            raider:     { color: 0xfb7185, speed: 48, life: 1.25, style: 'bolt',  home: 0.00 },
            juggernaut: { color: 0x94a3b8, speed: 24, life: 2.40, style: 'slug',  home: 0.16 },
            scouter:      { color: 0x86efac, speed: 10, life: 2.40, style: 'spark', home: 0.09 },
            soldierpro:   { color: 0xf87171, speed: 17, life: 2.20, style: 'bolt',  home: 0.05 },
            heavier:      { color: 0xa8a29e, speed: 20, life: 2.00, style: 'slug',  home: 0.00 },
            picker:       { color: 0xc4b5fd, speed: 10, life: 2.60, style: 'lance', home: 0.20 },
            squsasher:    { color: 0x2dd4bf, speed: 40, life: 1.50, style: 'bolt',  home: 0.09 },
            deathbringer: { color: 0xef4444, speed: 25, life: 1.80, style: 'spark', home: 0.09 },
            phantasm:     { color: 0xf8fafc, speed: 28, life: 2.10, style: 'orb',   home: 0.10 },
            gunnier:      { color: 0xa78bfa, speed: 30, life: 1.70, style: 'spark', home: 0.30 },
            tombraider:   { color: 0xfb7185, speed: 31, life: 1.70, style: 'bolt',  home: 0.09 },
            hammer:       { color: 0x64748b, speed: 30, life: 2.20, style: 'slug',  home: 0.15 },
            artillery:    { color: 0xfb923c, speed: 16, life: 1.40, style: 'slug',  home: 0.00 },
            shieldbearer: { color: 0x93c5fd, speed: 28, life: 1.50, style: 'bolt',  home: 0.00 },
            minelayer:    { color: 0xa3e635, speed: 26, life: 1.35, style: 'spark', home: 0.00 },
            commander:    { color: 0xfacc15, speed: 32, life: 1.45, style: 'bolt',  home: 0.00 },
            // Q039: the first boss teaches patterns rather than deleting new players.
            //            Shell speed halved 36 -> 18, matching Yt03; Yt02 shipped the
            //            unhalved value, which its own notes did not mention.
            warlord:    { color: 0xf87171, speed: 18, life: 1.90, style: 'slug',  home: 0.22 },
            colossus:   { color: 0xa78bfa, speed: 32, life: 2.10, style: 'orb',   home: 0.20 },
            nova:       { color: 0x67e8f9, speed: 40, life: 1.70, style: 'spark', home: 0.14 },
            titan:      { color: 0x93c5fd, speed: 30, life: 1.80, style: 'slug',  home: 0.18 },
            tempest:    { color: 0x38bdf8, speed: 50, life: 1.55, style: 'lance', home: 0.24 },
            fortress:   { color: 0xfbbf24, speed: 28, life: 2.20, style: 'orb',   home: 0.12 }
        };
        const _shotSeek = new THREE.Vector3();
        const _shotLook = new THREE.Vector3();
        function enemyShotProfile(source) {
            return ENEMY_SHOT[source && source.type] || { color: 0xff4444, speed: 50, life: 1.2, style: 'bolt', home: 0 };
        }
        function enemyHomeRate(source) {
            if (!source || source.isPlayer) return 0;
            return enemyShotProfile(source).home || 0;
        }

        const CONFIG = {
            playerSpeed: 18,
            bulletSpeed: 60,
            fireRate: 0.25,
            baseDamage: 22,

            // ---- balance constants, centralised per decision Q098 ----
            // Q054: the historical hidden x0.5 kill-coin tax, now visible and tunable
            // in one place instead of buried inside a payout expression.
            killPayoutScale: 0.5,
            // Q010: hard top-speed cap, as a multiple of base playerSpeed. Stacked speed
            // cards + Adrenaline cannot exceed this, in movement OR in the speed meter.
            playerSpeedMaxMult: 2.6,

            // Q031: the enemy damage curve, parameterised instead of hardcoded.
            // The three legacy builds each baked different numbers straight into the
            // formula, so "merge" meant choosing one and losing the others. They now live
            // here as one formula with swappable presets:
            //   dmg = base + (L-1)*slope + max(0,L-10)*mid + max(0,L-20)*late
            // Yt03's numbers are the default. Yt01's are the "easy" preset. Yt02's are not
            // carried: its expression was (0.70 + (L-1)*0.032) * 1.5, which expands to a
            // base of 1.05 at the same 0.048 slope as Yt03 — the stray *1.5 was an
            // undocumented 5% inflation (audit defect D-04), not a distinct tuning.
            enemyDmg: { base: 1.0, slope: 0.048, mid: 0.016, late: 0.022 },

            // Q032: enemy HP ramp, stated as +3% per level. Also parameterised.
            // NOTE: this is flatter than every legacy build, which all used a three-band
            // ramp (5% then +3% after L10 then +5% after L20) reaching ~3.55x at level 30.
            // The literal reading of the decision reaches ~1.87x. One constant to change
            // if the intent was the steeper legacy curve.
            enemyHp: { base: 1, perLevel: 0.03 },

            // Q031: presets swap the whole curve in one assignment.
            enemyCurvePresets: {
                // Yt03 numbers — the shipped default
                normal: { dmg: { base: 1.0, slope: 0.048, mid: 0.016, late: 0.022 },
                          hp:  { base: 1,   perLevel: 0.03 } },
                // Yt01 numbers — gentler early slope, same mid/late bands
                easy:   { dmg: { base: 1.0, slope: 0.032, mid: 0.016, late: 0.022 },
                          hp:  { base: 1,   perLevel: 0.03 } }
            },

            // Q013: homing missiles. The legacy behaviour made extra Missile Pod stacks
            // shorten the launch timer (interval = 5 / stacks) while still firing ONE
            // missile per launch. The decision reverses that: the cadence is fixed and the
            // stack count decides how many missiles fly per volley, capped at 10. Stacks
            // past the cap stop adding missiles and instead enlarge and strengthen the
            // blast, so the upgrade never becomes a no-op.
            missile: {
                launchInterval: 5,          // seconds between volleys, independent of stacks
                maxPerVolley: 10,           // hard cap on missiles fired at once
                overloadRadiusPerStack: 0.08, // +8% blast radius per stack above the cap
                overloadDamagePerStack: 0.10  // +10% blast damage per stack above the cap
            },

            // Q011: Adrenaline Rush. Was a 1.5-second haste flicker per kill (3s with the
            // Afterburner evolution). It is now a full minute-long buff that any kill
            // refreshes, with a countdown on screen. The +5%-per-stack damage that Yt01
            // advertised but never applied (audit defect D-05: the number existed only in
            // the HUD meter) is now real inside shoot(), and only while the buff is up.
            adrenaline: {
                duration: 60,             // seconds; every kill refreshes it to full
                speedPerStack: 0.25,      // +25% movement per stack (unchanged)
                damagePerStack: 0.05,     // +5% shell damage per stack — now actually applied
                afterburnerMultiplier: 2  // Afterburner evolution doubles the duration,
                                          // preserving the legacy 1.5s -> 3s ratio
            },

            // Q016: the armour pool. Yt03's model is the engine — the pool is a percentage
            // of max HP, so it stays meaningful as health builds grow, instead of a flat
            // number that becomes noise. Recharge only begins after a clean window, which
            // makes armour a tactical resource rather than an infinite second health bar.
            // Stored on state.armorHp / state.armorMaxHp so Yt02's full-height HUD overlay
            // (Q020) keeps working unchanged.
            // Q064: consumable pricing is a repeating loop rather than an uncapped
            // exponential. Each purchase within a cycle costs priceMultPerStep times the
            // last, and the cycle restarts at base on the following purchase — so the 6th
            // Aegis Kit costs the same as the 1st, the 11th the same again, and so on.
            // An uncapped 1.58^n curve made the fifth copy effectively unpurchasable; a
            // loop keeps the shop relevant for a whole session.
            consumables: {
                cycleLength: 5,
                priceMultPerStep: 3
            },
            // Q044: biome transitions. Ten realms, one every three levels, and the change
            // must be gradual — the terrain morphs over ten seconds rather than snapping.
            // Enemy fire is hushed for 1.5s and new spawns pause for 3s so a realm change
            // is never the moment you get deleted. The minimap keeps its fixed background;
            // no realm tint is applied to the radar.
            biome: {
                changeEveryLevels: 3,
                morphDelayMs: 900,      // beat before the morph begins
                morphDurationMs: 10000, // ten-second gradual terrain change
                fireHushSec: 1.5,
                noSpawnSec: 3
            },
            // Q047: destructible cover, measured in player shells rather than raw HP so it
            // stays meaningful at every level. See coverHitCost() in 24_chunks.js.
            cover: {
                hitsToBreak: 2      // exactly two player shells break any tree or rock
            },
            armor: {
                regenDelay: 3,      // seconds without damage before recharge starts
                regenPerSec: 0.10,  // fraction of the pool refilled per second
                regenFloor: 1,      // minimum points/second so a tiny pool still recovers
                aegisBasePool: 20   // Q018: Aegis Kit grants this pool if you own no armour
            }
        };

        // v14: resilient storage — works even where localStorage is blocked (sandboxed
        // previews, private modes). Falls back to in-session memory; a banner on the home
        // screen explains when progress is session-only. Defined first: used everywhere.
        const store = (() => {
            const mem = {};
            let ok = false;
            try { localStorage.setItem('__tank_probe', '1'); localStorage.removeItem('__tank_probe'); ok = true; } catch (e) { ok = false; }
            return {
                persistent: ok,
                get(k) { if (ok) { try { return localStorage.getItem(k); } catch (e) {} } return (k in mem) ? mem[k] : null; },
                set(k, v) { mem[k] = String(v); if (ok) { try { localStorage.setItem(k, v); } catch (e) {} } },
                del(k) { delete mem[k]; if (ok) { try { localStorage.removeItem(k); } catch (e) {} } }
            };
        })();

        // Game State
        let state = {
            gamePhase: 'menu', // menu | playing | paused | gameover
            isPlaying: false,
            // FIX (Tier 1): these were never initialized (undefined) — sound was silently
            // OFF, the camera HUD label didn't match the actual camera, assist was off.
            // Defaults below match what the settings panel always claimed.
            soundEnabled: true,
            musicEnabled: true, // v24
            quality: 'auto', // v25: auto | high | low
            tutorialTips: {}, // v25: seen-tips registry
            cameraMode: 'follow',
            controlAssist: true,
            hapticsEnabled: true,
            leftHanded: false,
            reduceShake: false,
            reduceFlash: false,
            shakeMode: 'full',
            damageNumbers: true,
            combatPopups: true,
            fpsMode: 60,
            spawnSafeUntil: 0,
            showDiag: false,
            score: 0,
            kills: 0,
            runTime: 0,
            runCoins: 0,
            xp: 0,
            level: 1,
            xpToNext: 250,
            currentBiome: 0,
            lastFireTime: 0,
            lastSpawnTime: 0,
            lastRegenTime: 0,
            input: { x: 0, y: 0, isFiring: false },
            cameraShake: 0,
            playerStats: { speed: 100, damage: 100, fireRate: 100, armor: 0, regen: 0, maxHp: 100, multishot: 0 },
            enemiesIntroduced: new Set(),
            targetEnemy: null, // Added for sticky auto-aim
            runCards: [], runCardsObj: {}, evolutions: []
        };

        let audioCtx = null;

        // Three.js Globals
        let scene, camera, renderer, clock;
        let player, bullets = [], enemies = [], particles = [];
        let ambientLight, dirLight, hemisphereLight;
        let lavaMeshes = [], waterMeshes = []; // v26: chunk feature registries (lava glow + water waves)
        let environmentParticles = [];
        // v17: chunk streaming — the infinite world is served in 48-unit chunks
