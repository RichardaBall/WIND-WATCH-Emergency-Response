import { SoundContextManager } from './soundContext.js';
import { UIAudio } from './UI_Audio.js';
import { HelicopterAudio } from './helicopterAudio.js';
import { WeatherAudio } from './weatherAudio.js';

export class SoundManager {
    constructor() {
        this.contextMgr = new SoundContextManager();
        this.uiAudio = new UIAudio(this.contextMgr);
        this.helicopter = new HelicopterAudio(this.contextMgr);
        this.weather = new WeatherAudio(this.contextMgr);
    }

    get audioCtx() { return this.contextMgr.audioCtx; }
    get masterGain() { return this.contextMgr.masterGain; }
    get isMuted() { return this.contextMgr.isMuted; }

    init() {
        this.contextMgr.init();
    }

    toggleMute(mute) {
        if (mute) {
            this.uiAudio.stopSpraySound();
            this.weather.stopWindSound();
            this.weather.stopRainSound();
        }
        this.contextMgr.toggleMute(mute);
    }

    ensureContextRunning() {
        this.contextMgr.ensureContextRunning();
    }

    playToggleSwitchSound(isOn) { this.uiAudio.playToggleSwitchSound(isOn); }
    playBatterySwitchSound(isOn) { this.uiAudio.playBatterySwitchSound(isOn); }
    playRadioClickSound() { this.uiAudio.playRadioClickSound(); }
    playFuelPumpPrimeSound() { this.uiAudio.playFuelPumpPrimeSound(); }
    playLandingGearSound(isRetracting) { this.uiAudio.playLandingGearSound(isRetracting); }
    playSplashSound() { this.uiAudio.playSplashSound(); }
    startSpraySound() { this.uiAudio.startSpraySound(); }
    stopSpraySound() { this.uiAudio.stopSpraySound(); }
    updateWaterSpraySound(isActuallyDispensing) { this.uiAudio.updateWaterSpraySound(isActuallyDispensing); }

    startHelicopterEngine() { this.helicopter.startHelicopterEngine(); }
    playEngineStartup() { this.helicopter.playEngineStartup(); }
    playEngineShutdown() { this.helicopter.playEngineShutdown(); }
    stopHelicopterEngine() { this.helicopter.stopEngine(); }
    updateHelicopterAudio(enginePower, moveSpeed) { this.helicopter.updateHelicopterAudio(enginePower, moveSpeed); }
    playLowFuelSound() { this.helicopter.playLowFuelSound(); }

    startRainSound() { this.weather.startRainSound(); }
    stopRainSound() { this.weather.stopRainSound(); }
    startWindSound(isStorm = false) { this.weather.startWindSound(isStorm); }
    stopWindSound() { this.weather.stopWindSound(); }
    playThunderSound() { this.weather.playThunderSound(); }
    updateRainAudio(weatherData) { this.weather.updateRainAudio(weatherData); }
    updateWeatherAudio(weatherData) { this.weather.updateWeatherAudio(weatherData); }
}