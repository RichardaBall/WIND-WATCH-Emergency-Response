export class SoundContextManager {
    constructor() {
        this.audioCtx = null;
        this.masterGain = null;
        this.isMuted = false;

        // Auto-Unlock Audio Context on First User Interaction
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
}