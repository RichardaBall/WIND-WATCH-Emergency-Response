export class UIAudio {
    constructor(soundContextMgr) {
        this.ctxMgr = soundContextMgr;

        // Procedural Water Spray Sound Nodes
        this.sprayNoiseNode = null;
        this.sprayFilterNode = null;
        this.sprayGainNode = null;
        this.isSpraySoundPlaying = false;

        // Landing Gear Audio Buffer
        this.gearBuffer = null;
    }

    playToggleSwitchSound(isOn) {
        try {
            this.ctxMgr.ensureContextRunning();
            if (!this.ctxMgr.audioCtx || this.ctxMgr.isMuted) return;

            const now = this.ctxMgr.audioCtx.currentTime;

            // 1. Sharp mechanical click / snap transient
            const osc = this.ctxMgr.audioCtx.createOscillator();
            const gain = this.ctxMgr.audioCtx.createGain();

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(isOn ? 1800 : 1400, now);
            osc.frequency.exponentialRampToValueAtTime(300, now + 0.03);

            gain.gain.setValueAtTime(0.5, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

            osc.connect(gain);
            gain.connect(this.ctxMgr.masterGain);

            osc.start(now);
            osc.stop(now + 0.03);

            // 2. Body thunk / housing resonance
            const thunkOsc = this.ctxMgr.audioCtx.createOscillator();
            const thunkGain = this.ctxMgr.audioCtx.createGain();

            thunkOsc.type = 'sine';
            thunkOsc.frequency.setValueAtTime(isOn ? 350 : 250, now + 0.01);
            thunkOsc.frequency.exponentialRampToValueAtTime(80, now + 0.06);

            thunkGain.gain.setValueAtTime(0.3, now + 0.01);
            thunkGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

            thunkOsc.connect(thunkGain);
            thunkGain.connect(this.ctxMgr.masterGain);

            thunkOsc.start(now + 0.01);
            thunkOsc.stop(now + 0.06);
        } catch (e) {
            console.warn("Toggle switch sound error:", e);
        }
    }

    playBatterySwitchSound(isOn) {
        this.playToggleSwitchSound(isOn);
    }

    playRadioClickSound() {
        try {
            this.ctxMgr.ensureContextRunning();
            if (!this.ctxMgr.audioCtx || this.ctxMgr.isMuted) return;

            const now = this.ctxMgr.audioCtx.currentTime;
            const osc = this.ctxMgr.audioCtx.createOscillator();
            const gain = this.ctxMgr.audioCtx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(2400, now);
            osc.frequency.exponentialRampToValueAtTime(800, now + 0.015);

            gain.gain.setValueAtTime(0.15, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.015);

            osc.connect(gain);
            gain.connect(this.ctxMgr.masterGain);

            osc.start(now);
            osc.stop(now + 0.015);
        } catch (e) {
            console.warn("Radio click sound error:", e);
        }
    }

    playFuelPumpPrimeSound() {
        try {
            this.ctxMgr.ensureContextRunning();
            if (!this.ctxMgr.audioCtx || this.ctxMgr.isMuted) return;

            const now = this.ctxMgr.audioCtx.currentTime;
            const duration = 1.2;

            const pumpOsc = this.ctxMgr.audioCtx.createOscillator();
            const pumpGain = this.ctxMgr.audioCtx.createGain();

            pumpOsc.type = 'sawtooth';
            pumpOsc.frequency.setValueAtTime(120, now);
            pumpOsc.frequency.exponentialRampToValueAtTime(650, now + 0.4);
            pumpOsc.frequency.setValueAtTime(650, now + 0.4);
            pumpOsc.frequency.linearRampToValueAtTime(600, now + duration);

            pumpGain.gain.setValueAtTime(0.005, now);
            pumpGain.gain.linearRampToValueAtTime(0.1, now + 0.1);
            pumpGain.gain.setValueAtTime(0.1, now + duration - 0.2);
            pumpGain.gain.linearRampToValueAtTime(0.0005, now + duration);

            const filter = this.ctxMgr.audioCtx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(800, now);
            filter.Q.setValueAtTime(3.0, now);

            pumpOsc.connect(filter);
            filter.connect(pumpGain);
            pumpGain.connect(this.ctxMgr.masterGain);

            pumpOsc.start(now);
            pumpOsc.stop(now + duration);
        } catch (e) {
            console.warn("Fuel pump sound error:", e);
        }
    }

    async playLandingGearSound(isRetracting) {
        try {
            this.ctxMgr.ensureContextRunning();
            if (!this.ctxMgr.audioCtx || this.ctxMgr.isMuted) return;

            if (!this.gearBuffer) {
                try {
                    const response = await fetch('gear.mp3');
                    if (response.ok) {
                        const arrayBuffer = await response.arrayBuffer();
                        this.gearBuffer = await this.ctxMgr.audioCtx.decodeAudioData(arrayBuffer);
                    }
                } catch (err) {
                    console.warn("Failed to load gear.mp3, falling back to procedural synth:", err);
                }
            }

            if (this.gearBuffer) {
                const now = this.ctxMgr.audioCtx.currentTime;
                const source = this.ctxMgr.audioCtx.createBufferSource();
                source.buffer = this.gearBuffer;

                const gainNode = this.ctxMgr.audioCtx.createGain();
                gainNode.gain.setValueAtTime(0.8, now);

                source.connect(gainNode);
                gainNode.connect(this.ctxMgr.masterGain);

                source.start(now);
                return;
            }

            // Fallback procedural motor sound if file loading fails
            const now = this.ctxMgr.audioCtx.currentTime;
            const duration = 1.8;

            const motorOsc = this.ctxMgr.audioCtx.createOscillator();
            const motorGain = this.ctxMgr.audioCtx.createGain();

            motorOsc.type = 'sawtooth';
            const startFreq = isRetracting ? 120 : 180;
            const endFreq = isRetracting ? 180 : 120;

            motorOsc.frequency.setValueAtTime(startFreq, now);
            motorOsc.frequency.linearRampToValueAtTime(endFreq, now + duration);

            motorGain.gain.setValueAtTime(0.01, now);
            motorGain.gain.linearRampToValueAtTime(0.15, now + 0.2);
            motorGain.gain.setValueAtTime(0.15, now + duration - 0.2);
            motorGain.gain.linearRampToValueAtTime(0.001, now + duration);

            const motorFilter = this.ctxMgr.audioCtx.createBiquadFilter();
            motorFilter.type = 'lowpass';
            motorFilter.frequency.setValueAtTime(350, now);

            motorOsc.connect(motorFilter);
            motorFilter.connect(motorGain);
            motorGain.connect(this.ctxMgr.masterGain);

            motorOsc.start(now);
            motorOsc.stop(now + duration);
        } catch (e) {
            console.warn("Landing gear sound error:", e);
        }
    }

    playSplashSound() {
        try {
            this.ctxMgr.ensureContextRunning();
            if (!this.ctxMgr.audioCtx || this.ctxMgr.isMuted) return;

            const now = this.ctxMgr.audioCtx.currentTime;
            const duration = 1.5;

            const bufferSize = this.ctxMgr.audioCtx.sampleRate * duration;
            const buffer = this.ctxMgr.audioCtx.createBuffer(1, bufferSize, this.ctxMgr.audioCtx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
            }

            const noise = this.ctxMgr.audioCtx.createBufferSource();
            noise.buffer = buffer;

            const filter = this.ctxMgr.audioCtx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(400, now);
            filter.frequency.exponentialRampToValueAtTime(150, now + duration);

            const gain = this.ctxMgr.audioCtx.createGain();
            gain.gain.setValueAtTime(0.6, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

            noise.connect(filter);
            filter.connect(gain);
            gain.connect(this.ctxMgr.masterGain);

            noise.start(now);
            noise.stop(now + duration);
        } catch (e) {
            console.warn("Splash sound failed to play:", e);
        }
    }

    startSpraySound() {
        if (this.isSpraySoundPlaying || !this.ctxMgr.audioCtx || this.ctxMgr.isMuted) return;
        try {
            const now = this.ctxMgr.audioCtx.currentTime;
            const bufferSize = this.ctxMgr.audioCtx.sampleRate * 2;
            const buffer = this.ctxMgr.audioCtx.createBuffer(1, bufferSize, this.ctxMgr.audioCtx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
            }

            this.sprayNoiseNode = this.ctxMgr.audioCtx.createBufferSource();
            this.sprayNoiseNode.buffer = buffer;
            this.sprayNoiseNode.loop = true;

            this.sprayFilterNode = this.ctxMgr.audioCtx.createBiquadFilter();
            this.sprayFilterNode.type = 'bandpass';
            this.sprayFilterNode.frequency.setValueAtTime(1800, now);
            this.sprayFilterNode.Q.setValueAtTime(1.5, now);

            this.sprayGainNode = this.ctxMgr.audioCtx.createGain();
            this.sprayGainNode.gain.setValueAtTime(0.001, now);
            this.sprayGainNode.gain.linearRampToValueAtTime(0.35, now + 0.05);

            this.sprayNoiseNode.connect(this.sprayFilterNode);
            this.sprayFilterNode.connect(this.sprayGainNode);
            this.sprayGainNode.connect(this.ctxMgr.masterGain);

            this.sprayNoiseNode.start(now);
            this.isSpraySoundPlaying = true;
        } catch (e) {
            console.warn("Spray sound start error:", e);
        }
    }

    stopSpraySound() {
        if (!this.isSpraySoundPlaying || !this.ctxMgr.audioCtx) return;
        try {
            const now = this.ctxMgr.audioCtx.currentTime;
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
        if (isActuallyDispensing && !this.ctxMgr.isMuted) {
            if (!this.isSpraySoundPlaying) {
                this.startSpraySound();
            }
        } else {
            if (this.isSpraySoundPlaying) {
                this.stopSpraySound();
            }
        }
    }
}