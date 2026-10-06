export class HelicopterAudio {
    constructor(soundContextMgr) {
        this.ctxMgr = soundContextMgr;

        // Engine & Rotor Synth Nodes
        this.noiseNode = null;
        this.filterNode = null;
        
        // Rotor Sound AudioBuffer & Source
        this.rotorBuffer = null;
        this.rotorSourceNode = null;

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
        this.lowFuelBuffer = null;
    }

    async startHelicopterEngine() {
        try {
            this.ctxMgr.ensureContextRunning();
            if (this.isPlaying || !this.ctxMgr.audioCtx || this.ctxMgr.isMuted) return;

            const now = this.ctxMgr.audioCtx.currentTime;

            // Load rotorsound.mp3 buffer if not already cached
            if (!this.rotorBuffer) {
                try {
                    const response = await fetch('rotorsound.mp3');
                    if (response.ok) {
                        const arrayBuffer = await response.arrayBuffer();
                        this.rotorBuffer = await this.ctxMgr.audioCtx.decodeAudioData(arrayBuffer);
                    }
                } catch (err) {
                    console.warn("Failed to load rotorsound.mp3, falling back to procedural noise:", err);
                }
            }

            this.engineGain = this.ctxMgr.audioCtx.createGain();
            this.engineGain.gain.setValueAtTime(0.001, now);
            this.engineGain.gain.exponentialRampToValueAtTime(0.45, now + 3.5);

            if (this.rotorBuffer) {
                this.rotorSourceNode = this.ctxMgr.audioCtx.createBufferSource();
                this.rotorSourceNode.buffer = this.rotorBuffer;
                this.rotorSourceNode.loop = true;
                this.rotorSourceNode.playbackRate.setValueAtTime(0.1, now);
                this.rotorSourceNode.playbackRate.exponentialRampToValueAtTime(1.0, now + 3.5);

                this.rotorSourceNode.connect(this.engineGain);
                this.rotorSourceNode.start(now);
            } else {
                const bufferSize = this.ctxMgr.audioCtx.sampleRate * 2;
                const buffer = this.ctxMgr.audioCtx.createBuffer(1, bufferSize, this.ctxMgr.audioCtx.sampleRate);
                const output = buffer.getChannelData(0);
                for (let i = 0; i < bufferSize; i++) {
                    output[i] = Math.random() * 2 - 1;
                }

                this.noiseNode = this.ctxMgr.audioCtx.createBufferSource();
                this.noiseNode.buffer = buffer;
                this.noiseNode.loop = true;

                this.filterNode = this.ctxMgr.audioCtx.createBiquadFilter();
                this.filterNode.type = 'lowpass';
                this.filterNode.frequency.setValueAtTime(80, now);

                this.noiseNode.connect(this.filterNode);
                this.filterNode.connect(this.engineGain);
                this.noiseNode.start(now);
            }

            this.turbineOsc = this.ctxMgr.audioCtx.createOscillator();
            this.turbineOsc.type = 'sine';
            this.turbineOsc.frequency.setValueAtTime(400, now);

            this.turbineGain = this.ctxMgr.audioCtx.createGain();
            this.turbineGain.gain.setValueAtTime(0.00625, now);

            this.turbineOsc.connect(this.turbineGain);
            this.turbineGain.connect(this.engineGain);

            this.rotorLfo = this.ctxMgr.audioCtx.createOscillator();
            this.rotorLfo.type = 'triangle';
            this.rotorLfo.frequency.setValueAtTime(4.5, now);

            this.rotorLfoGain = this.ctxMgr.audioCtx.createGain();
            this.rotorLfoGain.gain.setValueAtTime(0.12, now);

            this.rotorLfo.connect(this.rotorLfoGain);

            this.rotorModGain = this.ctxMgr.audioCtx.createGain();
            this.rotorModGain.gain.setValueAtTime(1.0, now);
            this.rotorLfoGain.connect(this.rotorModGain.gain);

            this.engineGain.connect(this.rotorModGain);
            this.rotorModGain.connect(this.ctxMgr.masterGain);

            this.turbineOsc.start(now);
            this.rotorLfo.start(now);

            this.isPlaying = true;
        } catch (e) {
            console.warn("Start engine audio error:", e);
        }
    }

    stopHelicopterEngine() {
        if (!this.isPlaying || !this.ctxMgr.audioCtx) return;
        try {
            const now = this.ctxMgr.audioCtx.currentTime;

            if (this.engineGain) {
                this.engineGain.gain.setValueAtTime(this.engineGain.gain.value, now);
                this.engineGain.gain.exponentialRampToValueAtTime(0.001, now + 3.0);
            }

            setTimeout(() => {
                if (this.rotorSourceNode) {
                    try {
                        this.rotorSourceNode.stop();
                        this.rotorSourceNode.disconnect();
                    } catch (err) {}
                    this.rotorSourceNode = null;
                }
                if (this.noiseNode) {
                    try {
                        this.noiseNode.stop();
                        this.noiseNode.disconnect();
                    } catch (err) {}
                    this.noiseNode = null;
                }
                if (this.turbineOsc) {
                    try {
                        this.turbineOsc.stop();
                        this.turbineOsc.disconnect();
                    } catch (err) {}
                    this.turbineOsc = null;
                }
                if (this.rotorLfo) {
                    try {
                        this.rotorLfo.stop();
                        this.rotorLfo.disconnect();
                    } catch (err) {}
                    this.rotorLfo = null;
                }
                this.isPlaying = false;
            }, 3000);
        } catch (e) {
            console.warn("Stop engine audio error:", e);
            this.isPlaying = false;
        }
    }

    updateHelicopterAudio(enginePower, moveSpeed) {
        if (!this.isPlaying || !this.ctxMgr.audioCtx) return;
        try {
            const now = this.ctxMgr.audioCtx.currentTime;
            const speedFactor = Math.abs(moveSpeed) / 75.0;

            const targetTurbineFreq = Math.max(300, Math.min(2400, 400 + (enginePower * 1400) + (speedFactor * 400)));
            const targetRotorPlaybackRate = Math.max(0.2, Math.min(1.3, 0.2 + (enginePower * 0.9) + (speedFactor * 0.2)));
            const targetRotorFreq = Math.max(3.0, Math.min(6.2, 3.5 + (enginePower * 2.0) + (speedFactor * 0.8)));

            if (this.turbineOsc) {
                this.turbineOsc.frequency.setTargetAtTime(targetTurbineFreq, now, 0.1);
            }
            if (this.rotorSourceNode && this.rotorSourceNode.playbackRate) {
                this.rotorSourceNode.playbackRate.setTargetAtTime(targetRotorPlaybackRate, now, 0.1);
            }
            if (this.filterNode) {
                const targetFilterFreq = Math.max(80, Math.min(500, 80 + (enginePower * 320) + (speedFactor * 150)));
                this.filterNode.frequency.setTargetAtTime(targetFilterFreq, now, 0.1);
            }
            if (this.rotorLfo) {
                this.rotorLfo.frequency.setTargetAtTime(targetRotorFreq, now, 0.1);
            }
        } catch (e) {
            // Suppress continuous update logspam
        }
    }

    async playLowFuelSound() {
        if (!this.ctxMgr || !this.ctxMgr.audioCtx || this.ctxMgr.isMuted) return;
        try {
            this.ctxMgr.ensureContextRunning();
            if (!this.lowFuelBuffer) {
                const response = await fetch('lowfuel.mp3');
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const arrayBuffer = await response.arrayBuffer();
                this.lowFuelBuffer = await this.ctxMgr.audioCtx.decodeAudioData(arrayBuffer);
            }

            const source = this.ctxMgr.audioCtx.createBufferSource();
            source.buffer = this.lowFuelBuffer;

            const gainNode = this.ctxMgr.audioCtx.createGain();
            gainNode.gain.setValueAtTime(0.8, this.ctxMgr.audioCtx.currentTime);

            source.connect(gainNode);
            gainNode.connect(this.ctxMgr.masterGain);

            source.start(0);
        } catch (e) {
            console.warn("Web Audio API lowfuel.mp3 failed, falling back to HTML5 Audio:", e);
            try {
                const audio = new Audio('lowfuel.mp3');
                audio.volume = 0.8;
                audio.play().catch(err => console.warn("HTML5 Audio fallback error:", err));
            } catch (err2) {
                console.warn("HTML5 Audio fallback failed:", err2);
            }
        }
    }
}