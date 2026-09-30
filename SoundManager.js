export class SoundManager {
    constructor() {
        this.audioCtx = null;
        this.masterGain = null;
        this.isMuted = false;

        // Engine & Rotor Synth Nodes
        this.noiseNode = null;
        this.filterNode = null;
        
        // Turbine Whine Nodes
        this.turbineOsc = null;
        this.turbineGain = null;

        // Rotor Blade Slap (Whop-Whop) Nodes
        this.rotorLfo = null;
        this.rotorLfoGain = null;

        // Master Engine Gain for Smooth Spool Up/Down
        this.engineGain = null;
        this.rotorModGain = null;

        this.isPlaying = false;

        // --- Rain Sound Nodes ---
        this.rainNoiseNode = null;
        this.rainFilterNode = null;
        this.rainGainNode = null;
        this.isRainSoundPlaying = false;

        // --- Wind Sound Nodes (Howling Wind / Gale) ---
        this.windNoiseNode = null;
        this.windFilterNode = null;
        this.windGainNode = null;
        this.windLfo = null;
        this.windLfoGain = null;
        this.isWindSoundPlaying = false;

        // --- Thunder Timing State ---
        this.lastThunderTime = 0;
        this.nextThunderInterval = 15000; // 15 seconds initial

        // --- Procedural Water Spray Sound Nodes ---
        this.sprayNoiseNode = null;
        this.sprayFilterNode = null;
        this.sprayGainNode = null;
        this.isSpraySoundPlaying = false;

        // --- Auto-Unlock Audio Context on First User Interaction ---
        const unlockAudio = () => {
            this.ensureContextRunning();
            if (this.audioCtx && this.audioCtx.state === 'running') {
                window.removeEventListener('pointerdown', unlockAudio);
                window.removeEventListener('keydown', unlockAudio);
                console.log("Web Audio Context successfully unlocked.");
            }
        };
        window.addEventListener('pointerdown', unlockAudio);
        window.addEventListener('keydown', unlockAudio);
    }

    init() {
        if (this.audioCtx) return;
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.audioCtx = new AudioContext();

            this.masterGain = this.audioCtx.createGain();
            this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.8, this.audioCtx.currentTime);
            this.masterGain.connect(this.audioCtx.destination);
        } catch (e) {
            console.warn("Web Audio initialization failed:", e);
        }
    }

    toggleMute(mute) {
        this.isMuted = mute;
        if (mute && this.isSpraySoundPlaying) {
            this.stopSpraySound();
        }
        if (mute && this.isWindSoundPlaying) {
            this.stopWindSound();
        }
        if (mute && this.isRainSoundPlaying) {
            this.stopRainSound();
        }
        if (this.audioCtx) {
            if (this.isMuted) {
                this.audioCtx.suspend().catch(e => console.warn("Audio suspend error:", e));
            } else {
                this.audioCtx.resume().catch(e => console.warn("Audio resume error:", e));
            }
        }
        if (this.masterGain && this.audioCtx) {
            const now = this.audioCtx.currentTime;
            this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.8, now);
        }
    }

    ensureContextRunning() {
        if (!this.audioCtx) this.init();
        if (this.audioCtx && this.audioCtx.state === 'suspended' && !this.isMuted) {
            this.audioCtx.resume().catch(e => console.warn("Audio resume blocked:", e));
        }
    }

    // Synthesizes a realistic mechanical toggle switch flick sound (used for Q, E, F, L)
    playToggleSwitchSound(isOn) {
        try {
            this.ensureContextRunning();
            if (!this.audioCtx || this.isMuted) return;

            const now = this.audioCtx.currentTime;

            // 1. Sharp mechanical click / snap transient
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(isOn ? 1800 : 1400, now);
            osc.frequency.exponentialRampToValueAtTime(300, now + 0.03);

            gain.gain.setValueAtTime(0.5, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

            osc.connect(gain);
            gain.connect(this.masterGain);

            osc.start(now);
            osc.stop(now + 0.03);

            // 2. Body thunk / housing resonance
            const thunkOsc = this.audioCtx.createOscillator();
            const thunkGain = this.audioCtx.createGain();

            thunkOsc.type = 'sine';
            thunkOsc.frequency.setValueAtTime(isOn ? 350 : 250, now + 0.01);
            thunkOsc.frequency.exponentialRampToValueAtTime(80, now + 0.06);

            thunkGain.gain.setValueAtTime(0.3, now + 0.01);
            thunkGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

            thunkOsc.connect(thunkGain);
            thunkGain.connect(this.masterGain);

            thunkOsc.start(now + 0.01);
            thunkOsc.stop(now + 0.06);
        } catch (e) {
            console.warn("Toggle switch sound error:", e);
        }
    }

    // Backward-compatible alias
    playBatterySwitchSound(isOn) {
        this.playToggleSwitchSound(isOn);
    }

    // Synthesizes a crisp rotary click for radio frequency tuning steps (10 kHz)
    playRadioClickSound() {
        try {
            this.ensureContextRunning();
            if (!this.audioCtx || this.isMuted) return;

            const now = this.audioCtx.currentTime;
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(2400, now);
            osc.frequency.exponentialRampToValueAtTime(800, now + 0.015);

            gain.gain.setValueAtTime(0.15, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.015);

            osc.connect(gain);
            gain.connect(this.masterGain);

            osc.start(now);
            osc.stop(now + 0.015);
        } catch (e) {
            console.warn("Radio click sound error:", e);
        }
    }

    // Synthesizes high-pressure fuel pump motor spooling & priming sound
    playFuelPumpPrimeSound() {
        try {
            this.ensureContextRunning();
            if (!this.audioCtx || this.isMuted) return;

            const now = this.audioCtx.currentTime;
            const duration = 1.2;

            const pumpOsc = this.audioCtx.createOscillator();
            const pumpGain = this.audioCtx.createGain();

            pumpOsc.type = 'sawtooth';
            pumpOsc.frequency.setValueAtTime(120, now);
            pumpOsc.frequency.exponentialRampToValueAtTime(650, now + 0.4);
            pumpOsc.frequency.setValueAtTime(650, now + 0.4);
            pumpOsc.frequency.linearRampToValueAtTime(600, now + duration);

            pumpGain.gain.setValueAtTime(0.005, now);
            pumpGain.gain.linearRampToValueAtTime(0.1, now + 0.1);
            pumpGain.gain.setValueAtTime(0.1, now + duration - 0.2);
            pumpGain.gain.linearRampToValueAtTime(0.0005, now + duration);

            const filter = this.audioCtx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(800, now);
            filter.Q.setValueAtTime(3.0, now);

            pumpOsc.connect(filter);
            filter.connect(pumpGain);
            pumpGain.connect(this.masterGain);

            pumpOsc.start(now);
            pumpOsc.stop(now + duration);
        } catch (e) {
            console.warn("Fuel pump sound error:", e);
        }
    }

    // Synthesizes hydraulic landing gear motor movement and locking thud
    playLandingGearSound(isRetracting) {
        try {
            this.ensureContextRunning();
            if (!this.audioCtx || this.isMuted) return;

            const now = this.audioCtx.currentTime;
            const duration = 1.8;

            const motorOsc = this.audioCtx.createOscillator();
            const motorGain = this.audioCtx.createGain();

            motorOsc.type = 'sawtooth';
            const startFreq = isRetracting ? 120 : 180;
            const endFreq = isRetracting ? 180 : 120;

            motorOsc.frequency.setValueAtTime(startFreq, now);
            motorOsc.frequency.linearRampToValueAtTime(endFreq, now + duration);

            motorGain.gain.setValueAtTime(0.01, now);
            motorGain.gain.linearRampToValueAtTime(0.15, now + 0.2);
            motorGain.gain.setValueAtTime(0.15, now + duration - 0.2);
            motorGain.gain.linearRampToValueAtTime(0.001, now + duration);

            const motorFilter = this.audioCtx.createBiquadFilter();
            motorFilter.type = 'lowpass';
            motorFilter.frequency.setValueAtTime(350, now);

            motorOsc.connect(motorFilter);
            motorFilter.connect(motorGain);
            motorGain.connect(this.masterGain);

            motorOsc.start(now);
            motorOsc.stop(now + duration);
        } catch (e) {
            console.warn("Landing gear sound error:", e);
        }
    }

    // Safe procedural water splash sound
    playSplashSound() {
        try {
            this.ensureContextRunning();
            if (!this.audioCtx || this.isMuted) return;

            const now = this.audioCtx.currentTime;
            const duration = 1.5;

            const bufferSize = this.audioCtx.sampleRate * duration;
            const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
            }

            const noise = this.audioCtx.createBufferSource();
            noise.buffer = buffer;

            const filter = this.audioCtx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(400, now);
            filter.frequency.exponentialRampToValueAtTime(150, now + duration);

            const gain = this.audioCtx.createGain();
            gain.gain.setValueAtTime(0.6, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

            noise.connect(filter);
            filter.connect(gain);
            gain.connect(this.masterGain);

            noise.start(now);
            noise.stop(now + duration);
        } catch (e) {
            console.warn("Splash sound failed to play:", e);
        }
    }

    // --- Procedural Water Spray Sound Methods ("shhhhhhhhhh") ---
    startSpraySound() {
        if (this.isSpraySoundPlaying || !this.audioCtx || this.isMuted) return;
        try {
            const now = this.audioCtx.currentTime;
            const bufferSize = this.audioCtx.sampleRate * 2;
            const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
            }

            this.sprayNoiseNode = this.audioCtx.createBufferSource();
            this.sprayNoiseNode.buffer = buffer;
            this.sprayNoiseNode.loop = true;

            this.sprayFilterNode = this.audioCtx.createBiquadFilter();
            this.sprayFilterNode.type = 'bandpass';
            this.sprayFilterNode.frequency.setValueAtTime(1800, now);
            this.sprayFilterNode.Q.setValueAtTime(1.5, now);

            this.sprayGainNode = this.audioCtx.createGain();
            this.sprayGainNode.gain.setValueAtTime(0.001, now);
            this.sprayGainNode.gain.linearRampToValueAtTime(0.35, now + 0.05);

            this.sprayNoiseNode.connect(this.sprayFilterNode);
            this.sprayFilterNode.connect(this.sprayGainNode);
            this.sprayGainNode.connect(this.masterGain);

            this.sprayNoiseNode.start(now);
            this.isSpraySoundPlaying = true;
        } catch (e) {
            console.warn("Spray sound start error:", e);
        }
    }

    stopSpraySound() {
        if (!this.isSpraySoundPlaying || !this.audioCtx) return;
        try {
            const now = this.audioCtx.currentTime;
            if (this.sprayGainNode) {
                this.sprayGainNode.gain.setValueAtTime(this.sprayGainNode.gain.value, now);
                this.sprayGainNode.gain.linearRampToValueAtTime(0.001, now + 0.05);
            }
            setTimeout(() => {
                if (this.sprayNoiseNode) {
                    this.sprayNoiseNode.stop();
                    this.sprayNoiseNode.disconnect();
                    this.sprayNoiseNode = null;
                }
                this.isSpraySoundPlaying = false;
            }, 60);
        } catch (e) {
            this.isSpraySoundPlaying = false;
        }
    }

    updateWaterSpraySound(isActuallyDispensing) {
        if (isActuallyDispensing && !this.isMuted) {
            if (!this.isSpraySoundPlaying) {
                this.startSpraySound();
            }
        } else {
            if (this.isSpraySoundPlaying) {
                this.stopSpraySound();
            }
        }
    }

    startHelicopterEngine() {
        try {
            this.ensureContextRunning();
            if (this.isPlaying || !this.audioCtx || this.isMuted) return;

            const now = this.audioCtx.currentTime;

            const bufferSize = this.audioCtx.sampleRate * 2;
            const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
            const output = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                output[i] = Math.random() * 2 - 1;
            }

            this.noiseNode = this.audioCtx.createBufferSource();
            this.noiseNode.buffer = buffer;
            this.noiseNode.loop = true;

            this.filterNode = this.audioCtx.createBiquadFilter();
            this.filterNode.type = 'lowpass';
            this.filterNode.frequency.setValueAtTime(80, now);

            this.turbineOsc = this.audioCtx.createOscillator();
            this.turbineOsc.type = 'sine';
            this.turbineOsc.frequency.setValueAtTime(400, now);

            this.turbineGain = this.audioCtx.createGain();
            this.turbineGain.gain.setValueAtTime(0.00625, now);

            this.turbineOsc.connect(this.turbineGain);

            this.rotorLfo = this.audioCtx.createOscillator();
            this.rotorLfo.type = 'triangle';
            this.rotorLfo.frequency.setValueAtTime(4.5, now);

            this.rotorLfoGain = this.audioCtx.createGain();
            this.rotorLfoGain.gain.setValueAtTime(0.12, now);

            this.rotorLfo.connect(this.rotorLfoGain);

            this.rotorModGain = this.audioCtx.createGain();
            this.rotorModGain.gain.setValueAtTime(1.0, now);
            this.rotorLfoGain.connect(this.rotorModGain.gain);

            this.engineGain = this.audioCtx.createGain();
            this.engineGain.gain.setValueAtTime(0.001, now);
            this.engineGain.gain.exponentialRampToValueAtTime(0.45, now + 3.5);

            this.noiseNode.connect(this.filterNode);
            this.filterNode.connect(this.engineGain);
            this.turbineGain.connect(this.engineGain);
            
            this.engineGain.connect(this.rotorModGain);
            this.rotorModGain.connect(this.masterGain);

            this.noiseNode.start(now);
            this.turbineOsc.start(now);
            this.rotorLfo.start(now);

            this.isPlaying = true;
        } catch (e) {
            console.warn("Start engine audio error:", e);
        }
    }

    stopHelicopterEngine() {
        if (!this.isPlaying || !this.audioCtx) return;
        try {
            const now = this.audioCtx.currentTime;

            if (this.engineGain) {
                this.engineGain.gain.setValueAtTime(this.engineGain.gain.value, now);
                this.engineGain.gain.exponentialRampToValueAtTime(0.001, now + 3.0);
            }

            setTimeout(() => {
                if (this.noiseNode) {
                    this.noiseNode.stop();
                    this.noiseNode.disconnect();
                }
                if (this.turbineOsc) {
                    this.turbineOsc.stop();
                    this.turbineOsc.disconnect();
                }
                if (this.rotorLfo) {
                    this.rotorLfo.stop();
                    this.rotorLfo.disconnect();
                }
                this.isPlaying = false;
            }, 3000);
        } catch (e) {
            console.warn("Stop engine audio error:", e);
            this.isPlaying = false;
        }
    }

    updateHelicopterAudio(enginePower, moveSpeed) {
        if (!this.isPlaying || !this.audioCtx) return;
        try {
            const now = this.audioCtx.currentTime;
            const speedFactor = Math.abs(moveSpeed) / 75.0;

            const targetTurbineFreq = Math.max(300, Math.min(2400, 400 + (enginePower * 1400) + (speedFactor * 400)));
            const targetFilterFreq = Math.max(80, Math.min(500, 80 + (enginePower * 320) + (speedFactor * 150)));
            const targetRotorFreq = Math.max(3.0, Math.min(6.2, 3.5 + (enginePower * 2.0) + (speedFactor * 0.8)));

            this.turbineOsc.frequency.setTargetAtTime(targetTurbineFreq, now, 0.1);
            this.filterNode.frequency.setTargetAtTime(targetFilterFreq, now, 0.1);
            this.rotorLfo.frequency.setTargetAtTime(targetRotorFreq, now, 0.1);
        } catch (e) {
            // Suppress continuous update logspam
        }
    }

    startRainSound() {
        if (this.isRainSoundPlaying || !this.audioCtx || this.isMuted) return;
        try {
            const now = this.audioCtx.currentTime;
            const bufferSize = this.audioCtx.sampleRate * 2;
            const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
            }

            this.rainNoiseNode = this.audioCtx.createBufferSource();
            this.rainNoiseNode.buffer = buffer;
            this.rainNoiseNode.loop = true;

            this.rainFilterNode = this.audioCtx.createBiquadFilter();
            this.rainFilterNode.type = 'bandpass';
            this.rainFilterNode.frequency.setValueAtTime(1400, now);

            this.rainGainNode = this.audioCtx.createGain();
            this.rainGainNode.gain.setValueAtTime(0.0001, now);
            this.rainGainNode.gain.linearRampToValueAtTime(0.04, now + 1.0);

            this.rainNoiseNode.connect(this.rainFilterNode);
            this.rainFilterNode.connect(this.rainGainNode);
            this.rainGainNode.connect(this.masterGain);

            this.rainNoiseNode.start(now);
            this.isRainSoundPlaying = true;
        } catch (e) {
            console.warn("Rain sound start error:", e);
        }
    }

    stopRainSound() {
        if (!this.isRainSoundPlaying || !this.audioCtx) return;
        try {
            const now = this.audioCtx.currentTime;
            if (this.rainGainNode) {
                this.rainGainNode.gain.linearRampToValueAtTime(0.0001, now + 1.0);
            }
            setTimeout(() => {
                if (this.rainNoiseNode) {
                    this.rainNoiseNode.stop();
                    this.rainNoiseNode.disconnect();
                    this.rainNoiseNode = null;
                }
                this.isRainSoundPlaying = false;
            }, 1000);
        } catch (e) {
            this.isRainSoundPlaying = false;
        }
    }

    // --- Howling Wind Sound Methods (Gale / Storm Wind) ---
    startWindSound(isStorm = false) {
        if (this.isWindSoundPlaying || !this.audioCtx || this.isMuted) return;
        try {
            const now = this.audioCtx.currentTime;
            const bufferSize = this.audioCtx.sampleRate * 3;
            const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
            }

            this.windNoiseNode = this.audioCtx.createBufferSource();
            this.windNoiseNode.buffer = buffer;
            this.windNoiseNode.loop = true;

            // Bandpass filter for wind howling frequency resonance
            this.windFilterNode = this.audioCtx.createBiquadFilter();
            this.windFilterNode.type = 'bandpass';
            this.windFilterNode.frequency.setValueAtTime(320, now);
            this.windFilterNode.Q.setValueAtTime(3.5, now);

            // LFO to modulate filter frequency for howling/gusting effect
            this.windLfo = this.audioCtx.createOscillator();
            this.windLfo.type = 'sine';
            this.windLfo.frequency.setValueAtTime(0.25, now); // Slow gust cycle

            this.windLfoGain = this.audioCtx.createGain();
            this.windLfoGain.gain.setValueAtTime(isStorm ? 180.0 : 90.0, now);

            this.windLfo.connect(this.windLfoGain);
            this.windLfoGain.connect(this.windFilterNode.frequency);

            this.windGainNode = this.audioCtx.createGain();
            const targetVolume = isStorm ? 0.22 : 0.08;
            this.windGainNode.gain.setValueAtTime(0.0001, now);
            this.windGainNode.gain.linearRampToValueAtTime(targetVolume, now + 1.5);

            this.windNoiseNode.connect(this.windFilterNode);
            this.windFilterNode.connect(this.windGainNode);
            this.windGainNode.connect(this.masterGain);

            this.windLfo.start(now);
            this.windNoiseNode.start(now);
            this.isWindSoundPlaying = true;
        } catch (e) {
            console.warn("Wind sound start error:", e);
        }
    }

    stopWindSound() {
        if (!this.isWindSoundPlaying || !this.audioCtx) return;
        try {
            const now = this.audioCtx.currentTime;
            if (this.windGainNode) {
                this.windGainNode.gain.linearRampToValueAtTime(0.0001, now + 1.0);
            }
            setTimeout(() => {
                if (this.windNoiseNode) {
                    this.windNoiseNode.stop();
                    this.windNoiseNode.disconnect();
                    this.windNoiseNode = null;
                }
                if (this.windLfo) {
                    this.windLfo.stop();
                    this.windLfo.disconnect();
                    this.windLfo = null;
                }
                this.isWindSoundPlaying = false;
            }, 1000);
        } catch (e) {
            this.isWindSoundPlaying = false;
        }
    }

    // --- Procedural Thunder Sound Effect (Coincides with Storm Lightning) ---
    playThunderSound() {
        try {
            this.ensureContextRunning();
            if (!this.audioCtx || this.isMuted) return;

            const now = this.audioCtx.currentTime;
            const duration = 4.5;

            // 1. Rumble Noise Buffer
            const bufferSize = this.audioCtx.sampleRate * duration;
            const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
            }

            const noise = this.audioCtx.createBufferSource();
            noise.buffer = buffer;

            const filter = this.audioCtx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(350, now);
            filter.frequency.exponentialRampToValueAtTime(45, now + duration);

            const gain = this.audioCtx.createGain();
            gain.gain.setValueAtTime(0.55, now);
            gain.gain.setValueAtTime(0.65, now + 0.4); // Initial thunder crack rumble peak
            gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

            noise.connect(filter);
            filter.connect(gain);
            gain.connect(this.masterGain);

            // 2. Sub-bass Oscillator for Deep Cinematic Impact
            const subOsc = this.audioCtx.createOscillator();
            const subGain = this.audioCtx.createGain();

            subOsc.type = 'triangle';
            subOsc.frequency.setValueAtTime(70, now);
            subOsc.frequency.exponentialRampToValueAtTime(28, now + duration);

            subGain.gain.setValueAtTime(0.4, now);
            subGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

            subOsc.connect(subGain);
            subGain.connect(this.masterGain);

            noise.start(now);
            noise.stop(now + duration);
            subOsc.start(now);
            subOsc.stop(now + duration);
        } catch (e) {
            console.warn("Thunder sound error:", e);
        }
    }

    updateRainAudio(weatherData) {
        this.updateWeatherAudio(weatherData);
    }

    updateWeatherAudio(weatherData) {
        if (!this.audioCtx || this.isMuted) return;
        const now = this.audioCtx.currentTime;
        const weatherType = weatherData ? weatherData.weatherType : 'fine';
        const effects = weatherData ? weatherData.effects : null;
        const rainOpacity = effects ? (effects.rainOpacity || 0) : (weatherType === 'fine' ? 0 : 0.5);
        const isStorm = weatherType === 'storm';

        // --- Seamless Rain Sound Crossfade ---
        const targetRainGain = (rainOpacity / 0.55) * 0.045;
        if (targetRainGain > 0.0005) {
            if (!this.isRainSoundPlaying) {
                this.startRainSound();
            }
            if (this.rainGainNode) {
                this.rainGainNode.gain.setTargetAtTime(targetRainGain, now, 0.3);
            }
        } else {
            if (this.isRainSoundPlaying) {
                if (this.rainGainNode) {
                    this.rainGainNode.gain.setTargetAtTime(0.0001, now, 0.5);
                }
                setTimeout(() => {
                    if (this.rainGainNode && this.rainGainNode.gain.value < 0.001 && this.isRainSoundPlaying) {
                        this.stopRainSound();
                    }
                }, 1000);
            }
        }

        // --- Seamless Wind Sound Crossfade ---
        const windSpeed = weatherData && weatherData.wind ? weatherData.wind.length() : 0.5;
        const targetWindGain = Math.min(0.24, Math.max(0.006, windSpeed * 0.038));
        const targetWindFreq = Math.min(480, Math.max(180, 180 + windSpeed * 35));

        if (windSpeed > 0.4 || rainOpacity > 0.05) {
            if (!this.isWindSoundPlaying) {
                this.startWindSound(isStorm);
            }
            if (this.windGainNode) {
                this.windGainNode.gain.setTargetAtTime(targetWindGain, now, 0.4);
            }
            if (this.windFilterNode) {
                this.windFilterNode.frequency.setTargetAtTime(targetWindFreq, now, 0.4);
            }
        } else {
            if (this.isWindSoundPlaying) {
                if (this.windGainNode) {
                    this.windGainNode.gain.setTargetAtTime(0.0001, now, 0.5);
                }
            }
        }

        // Periodic Thunder timing during Storm weather or high storm intensity blend
        if (isStorm || (effects && effects.sunIntensity < 0.5 && rainOpacity > 0.4)) {
            const nowMs = Date.now();
            if (this.lastThunderTime === 0) {
                this.lastThunderTime = nowMs;
                this.nextThunderInterval = 10000 + Math.random() * 12000;
            } else if (nowMs - this.lastThunderTime >= this.nextThunderInterval) {
                this.playThunderSound();
                this.lastThunderTime = nowMs;
                this.nextThunderInterval = 14000 + Math.random() * 18000; // 14 to 32 seconds between rumbles
            }
        } else {
            this.lastThunderTime = 0;
        }
    }
}