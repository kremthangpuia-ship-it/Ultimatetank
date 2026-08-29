        const SFX = (() => {
            let noiseBuf = null, engine = null, ambient = null, ambientTimer = null;

            function ctxOk() {
                const c = ensureAudioContext();
                if (!c) return null;
                if (!noiseBuf) {
                    noiseBuf = c.createBuffer(1, c.sampleRate * 1.2, c.sampleRate);
                    const d = noiseBuf.getChannelData(0);
                    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
                }
                return c;
            }
            function tone(freq, dur, type, gain, slideTo, attack) {
                if (!state.soundEnabled) return;
                const c = ctxOk(); if (!c) return;
                const o = c.createOscillator(), g = c.createGain();
                o.type = type || 'sine';
                o.frequency.setValueAtTime(freq, c.currentTime);
                if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), c.currentTime + dur);
                const a = attack || 0.005;
                g.gain.setValueAtTime(0.0001, c.currentTime);
                g.gain.exponentialRampToValueAtTime(gain || 0.05, c.currentTime + a);
                g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
                o.connect(g); g.connect(c.destination);
                o.start(); o.stop(c.currentTime + dur + 0.02);
            }
            function noise(dur, fFrom, fTo, gain, q) {
                if (!state.soundEnabled) return;
                const c = ctxOk(); if (!c) return;
                const s = c.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
                const f = c.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = q || 0.8;
                f.frequency.setValueAtTime(fFrom, c.currentTime);
                f.frequency.exponentialRampToValueAtTime(Math.max(40, fTo), c.currentTime + dur);
                const g = c.createGain();
                g.gain.setValueAtTime(gain || 0.2, c.currentTime);
                g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
                s.connect(f); f.connect(g); g.connect(c.destination);
                s.start(); s.stop(c.currentTime + dur + 0.05);
            }

            return {
                // -- one-shots --
                shoot() { tone(190, 0.07, 'square', 0.028, 90); },
                enemyShoot() { /* v26.8: enemy gunfire silent — was drowning the mix */ },
                hit() { /* v26.8: skip per-hit pings */ },
                crit() { tone(660, 0.07, 'sine', 0.05); },
                kill() { /* v26.8: skip per-kill chime; bosses use bossDown */ },
                explosion(size) {
                    const s = Math.min(1.6, 0.5 + size / 40);
                    noise(0.55 * s, 900, 90, 0.22 * Math.min(1, s));
                    tone(64, 0.5 * s, 'sine', 0.16 * Math.min(1, s), 30, 0.01);
                },
                shatterWood() { noise(0.22, 1800, 300, 0.14, 2); tone(140, 0.1, 'square', 0.05, 70); },
                shatterRock() { noise(0.3, 700, 120, 0.18); tone(90, 0.18, 'sine', 0.1, 40); },
                hurt() { tone(110, 0.16, 'sawtooth', 0.09, 55); noise(0.12, 500, 150, 0.08); },
                heal() { tone(440, 0.12, 'sine', 0.035, 660); },
                levelUp() { [392, 523, 659, 784].forEach((f, i) => setTimeout(() => tone(f, 0.12, 'triangle', 0.05), i * 80)); },
                cardPick() { tone(520, 0.06, 'triangle', 0.05, 700); },
                coin() { tone(880, 0.05, 'sine', 0.04); setTimeout(() => tone(1320, 0.06, 'sine', 0.03), 40); },
                bossAlarm() { for (let i = 0; i < 2; i++) setTimeout(() => { tone(98, 0.5, 'sawtooth', 0.11, 82); tone(196, 0.5, 'sawtooth', 0.05, 165); }, i * 650); },
                bossDown() { [523, 392, 330, 262, 523].forEach((f, i) => setTimeout(() => tone(f, 0.22, 'triangle', 0.07), i * 130)); noise(1.0, 800, 60, 0.2); },
                revive() { [330, 415, 494, 660].forEach((f, i) => setTimeout(() => tone(f, 0.3, 'sine', 0.05), i * 110)); },
                achievement() { [659, 880, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.15, 'sine', 0.05), i * 90)); },
                // -- engine hum --
                engineStart() {
                    if (!state.soundEnabled) return;
                    const c = ctxOk(); if (!c || engine) return;
                    const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 42;
                    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 240;
                    const g = c.createGain(); g.gain.value = 0.0;
                    o.connect(f); f.connect(g); g.connect(c.destination); o.start();
                    engine = { o, g };
                },
                engineSet(speed01) {
                    if (!engine) return;
                    const c = audioCtx;
                    engine.o.frequency.setTargetAtTime(36 + speed01 * 40, c.currentTime, 0.12);
                    engine.g.gain.setTargetAtTime(speed01 < 0.06 ? 0.0 : 0.008 + speed01 * 0.028, c.currentTime, 0.15);
                },
                engineStop() { if (engine) { try { engine.o.stop(); } catch (e) {} engine = null; } },
                // -- biome ambience (looped wind bed + biome-specific accents) --
                ambientSet(biome) {
                    SFX.ambientStop();
                    if (!state.soundEnabled) return;
                    const c = ctxOk(); if (!c) return;
                    const s = c.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
                    const f = c.createBiquadFilter(); f.type = 'bandpass';
                    const windy = biome.particleType === 'snow' || biome.particleType === 'sand' || biome.particleType === 'embers';
                    f.frequency.value = windy ? 520 : 260; f.Q.value = windy ? 0.6 : 0.4;
                    const g = c.createGain(); g.gain.value = 0;
                    g.gain.setTargetAtTime(windy ? 0.016 : 0.009, c.currentTime, 1.5);
                    s.connect(f); f.connect(g); g.connect(c.destination); s.start();
                    ambient = { s, g };
                    // biome accents
                    const type = biome.particleType;
                    ambientTimer = null; // v29.3: wind bed only — no random ticks
                },
                ambientStop() {
                    if (ambientTimer) { clearInterval(ambientTimer); ambientTimer = null; }
                    if (ambient) { try { ambient.s.stop(); } catch (e) {} ambient = null; }
                },
                vibrate(pattern) { try { if (state.hapticsEnabled === false) return; if (navigator.vibrate) navigator.vibrate(pattern); } catch (e) {} },
                // -- v24: generative music (bass pulse + pad + arp; intensity follows combat) --
                musicStart() {
                    SFX.musicStop();
                    if (!state.musicEnabled || !state.soundEnabled) return;
                    const c = ctxOk(); if (!c) return;
                    const m = { step: 0, timer: null, intensity: 0.2 };
                    SFX._music = m;
                    m.timer = setInterval(() => {
                        if (!state.musicEnabled || !state.soundEnabled || !audioCtx) { SFX.musicStop(); return; }
                        if (state.gamePhase !== 'playing') return; // silence during pause/cards
                        const boss = state.bossActive && !state.bossActive.isDead;
                        m.intensity += ((boss ? 1 : (enemies.length > 4 ? 0.55 : 0.25)) - m.intensity) * 0.05;
                        const biome = BIOMES[state.currentBiome] || BIOMES[0];
                        const dark = biome.particleType === 'embers' || biome.particleType === 'sparkles';
                        const root = dark ? 49 : 55;
                        const scale = dark ? [0, 3, 5, 7, 10] : [0, 2, 4, 7, 9];
                        const s = m.step++;
                        if (s % 16 === 0) tone(root, 1.4, 'sine', 0.006 + (boss ? 0.006 : 0));
                        if (boss && s % 8 === 0) tone(root * 0.5, 0.3, 'square', 0.03, root * 0.45);
                    }, 260);
                },
                musicStop() { if (SFX._music) { clearInterval(SFX._music.timer); SFX._music = null; } }
            };
        })();

