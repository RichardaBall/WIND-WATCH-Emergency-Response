export class HelicopterAudio {
    constructor(soundContextMgr) {
        this.ctxMgr = soundContextMgr;
        
        this.engineState = 'OFF';
        this.rotorBuffer = null;
        this.rotorSource = null;
        this.rotorGain = null;
        this.startupBuffer = null;
        this.startupSource = null;
        this.startupGain = null;
        this.shutdownBuffer = null;
        this.shutdownSource = null;
        this.shutdownGain = null;
        this.lowFuelBuffer = null;

        // Preload all audio buffers immediately upon creation
        this._preloadBuffers();

        window.helicopterAudio = this;
    }

    get audioCtx() { return this.ctxMgr ? this.ctxMgr.audioCtx : null; }
    get masterGain() { return this.ctxMgr ? this.ctxMgr.masterGain : null; }

    async _preloadBuffers() {
        // Wait until context/audio is initialized, then preload in background
        const checkCtx = setInterval(() => {
            if (this.audioCtx) {
                clearInterval(checkCtx);
                this._loadSound('rotorsound.mp3').then(buf => this.rotorBuffer = buf);
                this._loadSound('enginestartup.mp3').then(buf => this.startupBuffer = buf);
                this._loadSound('engineshutdown.mp3').then(buf => this.shutdownBuffer = buf);
                this._loadSound('lowfuel.mp3').then(buf => this.lowFuelBuffer = buf);
            }
        }, 200);
    }

    printDiagnostics() {
        console.group("=== Helicopter Audio Diagnostics ===");
        console.log("Shared AudioContext:", this.audioCtx);
        console.log("AudioContext State:", this.audioCtx ? this.audioCtx.state : "NO CONTEXT");
        console.log("Engine State:", this.engineState);
        console.log("Rotor Buffer Loaded:", !!this.rotorBuffer, this.rotorBuffer ? `(${this.rotorBuffer.duration.toFixed(2)}s)` : "");
        console.log("Startup Buffer Loaded:", !!this.startupBuffer, this.startupBuffer ? `(${this.startupBuffer.duration.toFixed(2)}s)` : "");
        console.log("Shutdown Buffer Loaded:", !!this.shutdownBuffer, this.shutdownBuffer ? `(${this.shutdownBuffer.duration.toFixed(2)}s)` : "");
        console.log("Low Fuel Buffer Loaded:", !!this.lowFuelBuffer, this.lowFuelBuffer ? `(${this.lowFuelBuffer.duration.toFixed(2)}s)` : "");
        console.log("Active Rotor Source:", !!this.rotorSource);
        console.groupEnd();
    }

    async _loadSound(url) {
        if (!this.audioCtx) return null;
        try {
            const response = await fetch(url);
            if (!response.ok) return null;
            const arrayBuffer = await response.arrayBuffer();
            return await this.audioCtx.decodeAudioData(arrayBuffer);
        } catch (e) {
            console.error(`[AudioDebug] Exception loading sound from ${url}:`, e);
            return null;
        }
    }

    async playLowFuelSound() {
        try {
            if (this.ctxMgr) this.ctxMgr.ensureContextRunning();
            if (!this.lowFuelBuffer) {
                this.lowFuelBuffer = await this._loadSound('lowfuel.mp3');
            }
            if (this.lowFuelBuffer && this.audioCtx && this.masterGain) {
                const now = this.audioCtx.currentTime;
                const source = this.audioCtx.createBufferSource();
                source.buffer = this.lowFuelBuffer;

                const gainNode = this.audioCtx.createGain();
                gainNode.gain.setValueAtTime(0.8, now);

                source.connect(gainNode);
                gainNode.connect(this.masterGain);
                source.start(now);
            }
        } catch (e) {
            console.error("[AudioDebug] Error playing low fuel sound:", e);
        }
    }

    async playEngineStartup() {
        if (this.engineState !== 'OFF') return;
        
        try {
            if (this.ctxMgr) this.ctxMgr.ensureContextRunning();
            this.engineState = 'STARTING';

            if (!this.startupBuffer) {
                this.startupBuffer = await this._loadSound('enginestartup.mp3');
            }
            if (!this.rotorBuffer) {
                this.rotorBuffer = await this._loadSound('rotorsound.mp3');
            }

            if (this.audioCtx && this.masterGain) {
                const now = this.audioCtx.currentTime;

                if (this.startupBuffer) {
                    this.startupSource = this.audioCtx.createBufferSource();
                    this.startupSource.buffer = this.startupBuffer;
                    
                    this.startupGain = this.audioCtx.createGain();
                    this.startupGain.gain.setValueAtTime(0.7, now);
                    
                    const startupDuration = this.startupBuffer.duration;
                    const crossfadeOverlap = 1.5;
                    this.startupGain.gain.setValueAtTime(0.7, now + startupDuration - crossfadeOverlap);
                    this.startupGain.gain.linearRampToValueAtTime(0.0, now + startupDuration);

                    this.startupSource.connect(this.startupGain);
                    this.startupGain.connect(this.masterGain);
                    this.startupSource.start(now);
                }

                if (this.rotorBuffer) {
                    if (this.rotorSource) {
                        try { this.rotorSource.stop(); } catch(e){}
                    }

                    this.rotorSource = this.audioCtx.createBufferSource();
                    this.rotorSource.buffer = this.rotorBuffer;
                    this.rotorSource.loop = true;

                    this.rotorGain = this.audioCtx.createGain();
                    this.rotorGain.gain.setValueAtTime(0, now);
                    
                    const rotorInStartTime = now + Math.max(0, (this.startupBuffer ? this.startupBuffer.duration : 5.0) - 2.0);
                    this.rotorGain.gain.setValueAtTime(0, rotorInStartTime);
                    this.rotorGain.gain.linearRampToValueAtTime(0.6, rotorInStartTime + 2.0);

                    this.rotorSource.connect(this.rotorGain);
                    this.rotorGain.connect(this.masterGain);
                    this.rotorSource.start(rotorInStartTime);
                }

                const totalStartupTime = this.startupBuffer ? this.startupBuffer.duration * 1000 : 5000;
                setTimeout(() => {
                    if (this.engineState === 'STARTING') {
                        this.engineState = 'RUNNING';
                    }
                }, totalStartupTime);

            } else {
                this.startHelicopterEngine();
            }
        } catch (e) {
            console.error("[AudioDebug] Error in playEngineStartup:", e);
            this.engineState = 'OFF';
        }
    }

    async playEngineShutdown() {
        if (this.engineState === 'OFF') return;
        
        try {
            if (this.ctxMgr) this.ctxMgr.ensureContextRunning();
            this.engineState = 'STOPPING';

            const now = this.audioCtx.currentTime;

            if (!this.shutdownBuffer) {
                this.shutdownBuffer = await this._loadSound('engineshutdown.mp3');
            }

            const shutdownDuration = this.shutdownBuffer ? this.shutdownBuffer.duration : 5.0;

            if (this.rotorGain && this.rotorSource) {
                this.rotorGain.gain.setValueAtTime(this.rotorGain.gain.value, now);
                this.rotorGain.gain.linearRampToValueAtTime(0.0, now + shutdownDuration);
                setTimeout(() => {
                    if (this.rotorSource) {
                        try { this.rotorSource.stop(); this.rotorSource.disconnect(); } catch(e){}
                        this.rotorSource = null;
                    }
                }, shutdownDuration * 1000);
            }

            if (this.shutdownBuffer && this.audioCtx && this.masterGain) {
                this.shutdownSource = this.audioCtx.createBufferSource();
                this.shutdownSource.buffer = this.shutdownBuffer;

                this.shutdownGain = this.audioCtx.createGain();
                this.shutdownGain.gain.setValueAtTime(0.8, now);

                this.shutdownSource.connect(this.shutdownGain);
                this.shutdownGain.connect(this.masterGain);
                this.shutdownSource.start(now);
                
                setTimeout(() => {
                    this.stopEngine();
                }, shutdownDuration * 1000);
            } else {
                setTimeout(() => { this.stopEngine(); }, shutdownDuration * 1000);
            }
        } catch (e) {
            console.error("[AudioDebug] Error in playEngineShutdown:", e);
            this.stopEngine();
        }
    }

    async startHelicopterEngine() {
        try {
            if (this.ctxMgr) this.ctxMgr.ensureContextRunning();
            this.engineState = 'RUNNING';

            if (!this.rotorBuffer) {
                this.rotorBuffer = await this._loadSound('rotorsound.mp3');
            }

            if (this.rotorBuffer && this.audioCtx && this.masterGain) {
                if (this.rotorSource) {
                    try { this.rotorSource.stop(); } catch(e){}
                }

                const now = this.audioCtx.currentTime; 
                
                this.rotorSource = this.audioCtx.createBufferSource();
                this.rotorSource.buffer = this.rotorBuffer;
                this.rotorSource.loop = true;

                this.rotorGain = this.audioCtx.createGain();
                this.rotorGain.gain.setValueAtTime(0, now);
                this.rotorGain.gain.linearRampToValueAtTime(0.6, now + 1.5);

                this.rotorSource.connect(this.rotorGain);
                this.rotorGain.connect(this.masterGain);
                this.rotorSource.start(now);
            }
        } catch (e) {
            console.error("[AudioDebug] Exception in startHelicopterEngine:", e);
        }
    }

    updateHelicopterAudio(enginePower, moveSpeed) {
        if (this.engineState !== 'RUNNING' && this.engineState !== 'STARTING') return;
        if (!this.audioCtx || !this.rotorSource) return;

        try {
            const validSpeed = Number(moveSpeed) || 0; 
            const speedFactor = Math.abs(validSpeed) / 75.0;
            
            const targetRate = Math.max(0.4, Math.min(1.3, (Number(enginePower) || 0) * (0.8 + (speedFactor * 0.5))));
            this.rotorSource.playbackRate.setTargetAtTime(targetRate, this.audioCtx.currentTime, 0.2);

            if (this.rotorGain && this.engineState === 'RUNNING') {
                const targetGain = Math.max(0.1, (Number(enginePower) || 0) * 0.6);
                this.rotorGain.gain.setTargetAtTime(targetGain, this.audioCtx.currentTime, 0.2);
            }
        } catch (e) {
            console.error("[AudioDebug] Error updating helicopter audio parameters:", e);
        }
    }

    stopEngine() {
        this.engineState = 'OFF';
        
        if (this.rotorSource) {
            try { this.rotorSource.stop(); this.rotorSource.disconnect(); } catch(e) {}
            this.rotorSource = null;
        }
        if (this.startupSource) {
            try { this.startupSource.stop(); this.startupSource.disconnect(); } catch(e) {}
            this.startupSource = null;
        }
        if (this.shutdownSource) {
            try { this.shutdownSource.stop(); this.shutdownSource.disconnect(); } catch(e) {}
            this.shutdownSource = null;
        }
    }
}