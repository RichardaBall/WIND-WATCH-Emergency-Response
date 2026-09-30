export class WeatherAudio {
    constructor(soundContextMgr) {
        this.ctxMgr = soundContextMgr;

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
        this.nextThunderInterval = 15000;
    }

    startRainSound() {
        if (this.isRainSoundPlaying || !this.ctxMgr.audioCtx || this.ctxMgr.isMuted) return;
        try {
            const now = this.ctxMgr.audioCtx.currentTime;
            const bufferSize = this.ctxMgr.audioCtx.sampleRate * 2;
            const buffer = this.ctxMgr.audioCtx.createBuffer(1, bufferSize, this.ctxMgr.audioCtx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
            }

            this.rainNoiseNode = this.ctxMgr.audioCtx.createBufferSource();
            this.rainNoiseNode.buffer = buffer;
            this.rainNoiseNode.loop = true;

            this.rainFilterNode = this.ctxMgr.audioCtx.createBiquadFilter();
            this.rainFilterNode.type = 'bandpass';
            this.rainFilterNode.frequency.setValueAtTime(1400, now);

            this.rainGainNode = this.ctxMgr.audioCtx.createGain();
            this.rainGainNode.gain.setValueAtTime(0.0001, now);
            this.rainGainNode.gain.linearRampToValueAtTime(0.04, now + 1.0);

            this.rainNoiseNode.connect(this.rainFilterNode);
            this.rainFilterNode.connect(this.rainGainNode);
            this.rainGainNode.connect(this.ctxMgr.masterGain);

            this.rainNoiseNode.start(now);
            this.isRainSoundPlaying = true;
        } catch (e) {
            console.warn("Rain sound start error:", e);
        }
    }

    stopRainSound() {
        if (!this.isRainSoundPlaying || !this.ctxMgr.audioCtx) return;
        try {
            const now = this.ctxMgr.audioCtx.currentTime;
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

    startWindSound(isStorm = false) {
        if (this.isWindSoundPlaying || !this.ctxMgr.audioCtx || this.ctxMgr.isMuted) return;
        try {
            const now = this.ctxMgr.audioCtx.currentTime;
            const bufferSize = this.ctxMgr.audioCtx.sampleRate * 3;
            const buffer = this.ctxMgr.audioCtx.createBuffer(1, bufferSize, this.ctxMgr.audioCtx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
            }

            this.windNoiseNode = this.ctxMgr.audioCtx.createBufferSource();
            this.windNoiseNode.buffer = buffer;
            this.windNoiseNode.loop = true;

            this.windFilterNode = this.ctxMgr.audioCtx.createBiquadFilter();
            this.windFilterNode.type = 'bandpass';
            this.windFilterNode.frequency.setValueAtTime(320, now);
            this.windFilterNode.Q.setValueAtTime(3.5, now);

            this.windLfo = this.ctxMgr.audioCtx.createOscillator();
            this.windLfo.type = 'sine';
            this.windLfo.frequency.setValueAtTime(0.25, now);

            this.windLfoGain = this.ctxMgr.audioCtx.createGain();
            this.windLfoGain.gain.setValueAtTime(isStorm ? 180.0 : 90.0, now);

            this.windLfo.connect(this.windLfoGain);
            this.windLfoGain.connect(this.windFilterNode.frequency);

            this.windGainNode = this.ctxMgr.audioCtx.createGain();
            const targetVolume = isStorm ? 0.22 : 0.08;
            this.windGainNode.gain.setValueAtTime(0.0001, now);
            this.windGainNode.gain.linearRampToValueAtTime(targetVolume, now + 1.5);

            this.windNoiseNode.connect(this.windFilterNode);
            this.windFilterNode.connect(this.windGainNode);
            this.windGainNode.connect(this.ctxMgr.masterGain);

            this.windLfo.start(now);
            this.windNoiseNode.start(now);
            this.isWindSoundPlaying = true;
        } catch (e) {
            console.warn("Wind sound start error:", e);
        }
    }

    stopWindSound() {
        if (!this.isWindSoundPlaying || !this.ctxMgr.audioCtx) return;
        try {
            const now = this.ctxMgr.audioCtx.currentTime;
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

    playThunderSound() {
        try {
            this.ctxMgr.ensureContextRunning();
            if (!this.ctxMgr.audioCtx || this.ctxMgr.isMuted) return;

            const now = this.ctxMgr.audioCtx.currentTime;
            const duration = 4.5;

            const bufferSize = this.ctxMgr.audioCtx.sampleRate * duration;
            const buffer = this.ctxMgr.audioCtx.createBuffer(1, bufferSize, this.ctxMgr.audioCtx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
            }

            const noise = this.ctxMgr.audioCtx.createBufferSource();
            noise.buffer = buffer;

            const filter = this.ctxMgr.audioCtx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(350, now);
            filter.frequency.exponentialRampToValueAtTime(45, now + duration);

            const gain = this.ctxMgr.audioCtx.createGain();
            gain.gain.setValueAtTime(0.55, now);
            gain.gain.setValueAtTime(0.65, now + 0.4);
            gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

            noise.connect(filter);
            filter.connect(gain);
            gain.connect(this.ctxMgr.masterGain);

            const subOsc = this.ctxMgr.audioCtx.createOscillator();
            const subGain = this.ctxMgr.audioCtx.createGain();

            subOsc.type = 'triangle';
            subOsc.frequency.setValueAtTime(70, now);
            subOsc.frequency.exponentialRampToValueAtTime(28, now + duration);

            subGain.gain.setValueAtTime(0.4, now);
            subGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

            subOsc.connect(subGain);
            subGain.connect(this.ctxMgr.masterGain);

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
        if (!this.ctxMgr.audioCtx || this.ctxMgr.isMuted) return;
        const now = this.ctxMgr.audioCtx.currentTime;
        const weatherType = weatherData ? weatherData.weatherType : 'fine';
        const effects = weatherData ? weatherData.effects : null;
        const rainOpacity = effects ? (effects.rainOpacity || 0) : (weatherType === 'fine' ? 0 : 0.5);
        const isStorm = weatherType === 'storm';

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

        if (isStorm || (effects && effects.sunIntensity < 0.5 && rainOpacity > 0.4)) {
            const nowMs = Date.now();
            if (this.lastThunderTime === 0) {
                this.lastThunderTime = nowMs;
                this.nextThunderInterval = 10000 + Math.random() * 12000;
            } else if (nowMs - this.lastThunderTime >= this.nextThunderInterval) {
                this.playThunderSound();
                this.lastThunderTime = nowMs;
                this.nextThunderInterval = 14000 + Math.random() * 18000;
            }
        } else {
            this.lastThunderTime = 0;
        }
    }
}