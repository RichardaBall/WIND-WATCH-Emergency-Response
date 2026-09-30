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

    // Facade Getters & Properties for 100% Backward Compatibility
    get audioCtx() { return this.contextMgr.audioCtx; }
    get masterGain() { return this.contextMgr.masterGain; }
    get isMuted() { return this.contextMgr.isMuted; }

    get isPlaying() { return this.helicopter.isPlaying; }
    set isPlaying(val) { this.helicopter.isPlaying = val; }

    get isSpraySoundPlaying() { return this.uiAudio.isSpraySoundPlaying; }
    set isSpraySoundPlaying(val) { this.uiAudio.isSpraySoundPlaying = val; }

    get isRainSoundPlaying() { return this.weather.isRainSoundPlaying; }
    set isRainSoundPlaying(val) { this.weather.isRainSoundPlaying = val; }

    get isWindSoundPlaying() { return this.weather.isWindSoundPlaying; }
    set isWindSoundPlaying(val) { this.weather.isWindSoundPlaying = val; }

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

    // UI & Effects Delegations
    playToggleSwitchSound(isOn) {
        this.uiAudio.playToggleSwitchSound(isOn);
    }

    playBatterySwitchSound(isOn) {
        this.uiAudio.playBatterySwitchSound(isOn);
    }

    playRadioClickSound() {
        this.uiAudio.playRadioClickSound();
    }

    playFuelPumpPrimeSound() {
        this.uiAudio.playFuelPumpPrimeSound();
    }

    playLandingGearSound(isRetracting) {
        this.uiAudio.playLandingGearSound(isRetracting);
    }

    playSplashSound() {
        this.uiAudio.playSplashSound();
    }

    startSpraySound() {
        this.uiAudio.startSpraySound();
    }

    stopSpraySound() {
        this.uiAudio.stopSpraySound();
    }

    updateWaterSpraySound(isActuallyDispensing) {
        this.uiAudio.updateWaterSpraySound(isActuallyDispensing);
    }

    // Helicopter Audio Delegations
    startHelicopterEngine() {
        this.helicopter.startHelicopterEngine();
    }

    stopHelicopterEngine() {
        this.helicopter.stopHelicopterEngine();
    }

    updateHelicopterAudio(enginePower, moveSpeed) {
        this.helicopter.updateHelicopterAudio(enginePower, moveSpeed);
    }

    // Weather Audio Delegations
    startRainSound() {
        this.weather.startRainSound();
    }

    stopRainSound() {
        this.weather.stopRainSound();
    }

    startWindSound(isStorm = false) {
        this.weather.startWindSound(isStorm);
    }

    stopWindSound() {
        this.weather.stopWindSound();
    }

    playThunderSound() {
        this.weather.playThunderSound();
    }

    updateRainAudio(weatherData) {
        this.weather.updateRainAudio(weatherData);
    }

    updateWeatherAudio(weatherData) {
        this.weather.updateWeatherAudio(weatherData);
    }
}