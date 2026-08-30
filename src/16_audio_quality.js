        function ensureAudioContext() {
            if (!state.soundEnabled) return null;
            const AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) return null;
            if (!audioCtx) audioCtx = new AC();
            if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
            return audioCtx;
        }

        function playTone({ frequency = 440, duration = 0.08, type = 'sine', gain = 0.03, slideTo = null } = {}) {
            if (!state.soundEnabled) return;
            const ctx = ensureAudioContext();
            if (!ctx) return;
            const osc = ctx.createOscillator();
            const g = ctx.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(frequency, ctx.currentTime);
            if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), ctx.currentTime + duration);
            g.gain.setValueAtTime(gain, ctx.currentTime);
            g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
            osc.connect(g);
            g.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + duration + 0.02);
        }

        function playUISound() { playTone({ frequency: 660, duration: 0.05, type: 'triangle', gain: 0.025 }); }
        function playPauseSound() { playTone({ frequency: 520, slideTo: 420, duration: 0.07, type: 'triangle', gain: 0.02 }); }

        // ============================================
        // v25: GRAPHICS QUALITY — Auto detects weak devices; Low strips shadows/particles
        // ============================================
        let _fpsSamples = [], _autoDecided = false, _autoApplied = 'high';
        function applyQuality(mode) {
            state.quality = mode;
            if (mode === 'low') _autoApplied = 'low';
            if (mode === 'high') _autoApplied = 'high';
            if (mode === 'auto') _fpsSamples = [];
            const low = mode === 'low' || (mode === 'auto' && _autoApplied === 'low');
            if (!renderer || !scene) return;
            renderer.shadowMap.enabled = !low;
            scene.traverse(o => { if (o.material) { const mats = Array.isArray(o.material) ? o.material : [o.material]; mats.forEach(m => m.needsUpdate = true); } });
            renderer.setPixelRatio(low ? 1 : Math.min(window.devicePixelRatio, 1.25));
            if (state.gamePhase === 'playing' || state.gamePhase === 'paused') {
                createEnvironmentParticles(BIOMES[state.currentBiome]);
            }
            needsRender = true;
        }
        function qualityLabel() { return state.quality === 'low' ? 'Low' : state.quality === 'high' ? 'High' : 'Auto'; }
        // Shim for ported FX code (dropTrackMarks and friends gate on this). Yt01 defined
        // it; the Yt02 base kept the call but lost the definition, so skid marks threw a
        // ReferenceError inside their try/catch on every frame and never appeared.
        // True when the EFFECTIVE quality is Low — pinned by the player or decided by the
        // auto governor (same rule applyQuality() uses).
        function lowGraphicsActive() {
            return state.quality === 'low' || (state.quality === 'auto' && _autoApplied === 'low');
        }
        function cycleQuality() {
            const order = ['auto', 'high', 'low'];
            const next = order[(order.indexOf(state.quality) + 1) % 3];
            applyQuality(next);
            showUpgradeNotification(next === 'low' ? 'Graphics: Low (smoothest)' : next === 'high' ? 'Graphics: High' : 'Graphics: Auto');
        }
        function autoQualityTick(dt) { // v26.3: keep sampling while Auto is on (phones heat up mid-run)
            if (state.quality !== 'auto') return;
            if (state.gamePhase !== 'playing') return;
            if (dt > 0.005 && dt < 0.2) _fpsSamples.push(1 / dt);
            if (_fpsSamples.length < 180) return; // ~3s window, repeating
            const avg = _fpsSamples.reduce((a, b) => a + b, 0) / _fpsSamples.length;
            _fpsSamples = [];
            if (avg < 40 && _autoApplied !== 'low') {
                _autoApplied = 'low';
                applyQuality('auto');
                showUpgradeNotification('⚙ Graphics lowered for smooth play');
            } else if (avg > 52 && _autoApplied === 'low') {
                _autoApplied = 'high';
                applyQuality('auto');
                showUpgradeNotification('⚙ Graphics restored');
            }
        }

        // ============================================
        // v23: SYNTH AUDIO ENGINE — everything generated in code, zero audio files.
        // One-shots (weapons, explosions, chimes), engine hum, biome ambience.
        // ============================================
