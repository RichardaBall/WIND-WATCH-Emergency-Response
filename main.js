import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { setupScene } from './sceneSetup.js';
import { WeatherSystem } from './weather.js';
import { InputManager } from './inputManager.js';
import { HelicopterPlayer } from './player.js';
import { SoundManager } from './SoundManager.js';
import { NavRadio } from './navRadio.js';
import { NavIndicator } from './navIndicator.js';
import { Kneeboard } from './kneeboard.js';
import { WindFarm } from './windFarm.js';
import { MainBase } from './mainbase.js';
import { LightingSystem } from './lighting.js';
import { LiferaftManager } from './liferaft.js';
import { WaterSystem } from './waterSystem.js';
import { SirenSystem } from './sirenSystem.js';
import { RotorWashSystem } from './rotorWashSystem.js';
import { HelipadDebrisSystem } from './helipadDebrisSystem.js';
import { DeveloperTool } from './utilities.js';
import { RescueMission } from './rescueMission.js';
import { SearchLightSystem } from './searchlight.js';
import { BuoySystem } from './buoy.js';
import { Shark } from './shark.js';
import { SharkCatchSystem } from './sharkcatch.js';
import { AssetWarmupSystem } from './assetWarmup.js';

const { scene, camera, renderer, water, sunLight, ambientLight } = setupScene();
const weatherSystem = new WeatherSystem();
const soundManager = new SoundManager();
const inputManager = new InputManager(soundManager);
const kneeboard = new Kneeboard();
const waterSystem = new WaterSystem(scene);
const rotorWashSystem = new RotorWashSystem(scene);
const helipadDebrisSystem = new HelipadDebrisSystem(scene);
const sirenSystem = new SirenSystem(scene, null);

let helicopterPlayer = null;
let navRadio = null;
let navIndicator = null;
let mainBase = null;
let lightingSystem = null;
let windFarm = null;
let developerTool = null;
let liferaftManager = null;
let rescueMission = null;
let searchLightSystem = null;
let buoySystem = null;
let shark = null;
let sharkCatchSystem = null;
let loadingMusic = null;

const clock = new THREE.Clock();

let redLight, greenLight, strobeLight, landingLight, cockpitLight;
let redBulb, greenBulb, strobeBulb;
let heliLightsGroup;
let heliShadow = null;
let cachedShadowTexture = null;

// Global single keydown event listener for helicopter systems (Q, F, E, G, X)
window.addEventListener('keydown', (e) => {
    if (!helicopterPlayer) return;
    if (e.repeat) return;

    if (e.code === 'KeyQ') {
        helicopterPlayer.toggleElectrical();
    }
    if (e.code === 'KeyF') {
        helicopterPlayer.toggleFuelPump();
    }
    if (e.code === 'KeyE') {
        helicopterPlayer.toggleEngine();
    }
    if (e.code === 'KeyG') {
        helicopterPlayer.toggleLandingGear();
    }
    if (e.code === 'KeyX') {
        if (rescueMission) {
            rescueMission.toggleWinch(helicopterPlayer);
        }
    }
});

// Wire up click event listeners for system status buttons and Load Game start button
window.addEventListener('DOMContentLoaded', () => {
    const loadGameBtn = document.getElementById('load-game-btn');
    const startScreen = document.getElementById('start-screen');
    const loadingScreen = document.getElementById('loading-screen');

    if (loadGameBtn) {
        loadGameBtn.addEventListener('click', async () => {
            // 1. Initialize and play loading music on loop from root directory at half volume
            loadingMusic = new Audio('loadingmusic.mp3');
            loadingMusic.loop = true;
            loadingMusic.volume = 0.1;
            try {
                await loadingMusic.play();
            } catch (err) {
                console.warn("Loading music playback prevented or failed:", err);
            }

            // 2. Hide start screen and show progress loading screen
            if (startScreen) {
                startScreen.style.opacity = '0';
                setTimeout(() => {
                    startScreen.style.display = 'none';
                }, 600);
            }
            if (loadingScreen) {
                loadingScreen.style.display = 'flex';
            }

            // 3. Kick off asset loading pipeline
            initializeGameAssets();
        });
    }

    const btnBattery = document.getElementById('status-battery');
    if (btnBattery) {
        btnBattery.addEventListener('click', () => {
            if (helicopterPlayer) helicopterPlayer.toggleElectrical();
        });
    }
    const btnFuelPump = document.getElementById('status-fuelpump');
    if (btnFuelPump) {
        btnFuelPump.addEventListener('click', () => {
            if (helicopterPlayer) helicopterPlayer.toggleFuelPump();
        });
    }
    const btnEngine = document.getElementById('status-engine');
    if (btnEngine) {
        btnEngine.addEventListener('click', () => {
            if (helicopterPlayer) helicopterPlayer.toggleEngine();
        });
    }
    const btnGear = document.getElementById('status-gear');
    if (btnGear) {
        btnGear.addEventListener('click', () => {
            if (helicopterPlayer) helicopterPlayer.toggleLandingGear();
        });
    }
    const btnLight = document.getElementById('status-light');
    if (btnLight) {
        btnLight.addEventListener('click', () => {
            if (inputManager) {
                inputManager.landingLightOn = !inputManager.landingLightOn;
                if (soundManager) soundManager.playToggleSwitchSound(inputManager.landingLightOn);
            }
        });
    }
});

let loadedGltfHeli = null;
let loadedSpawnPosition = null;

function createShadowTexture() {
    if (cachedShadowTexture) return cachedShadowTexture;
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0.7)');
    gradient.addColorStop(0.5, 'rgba(0, 0, 0, 0.4)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
    cachedShadowTexture = new THREE.CanvasTexture(canvas);
    return cachedShadowTexture;
}

function respawnGame() {
    if (!helicopterPlayer || !loadedSpawnPosition) return;

    helicopterPlayer.respawn(loadedSpawnPosition);

    if (waterSystem && typeof waterSystem.clear === 'function') {
        waterSystem.clear();
    }

    if (liferaftManager) {
        if (typeof liferaftManager.hideRestart === 'function') {
            liferaftManager.hideRestart();
        }
        if (typeof liferaftManager.clearRafts === 'function') {
            liferaftManager.clearRafts();
        }
    }

    if (rescueMission && typeof rescueMission.reset === 'function') {
        rescueMission.reset();
    }

    if (sharkCatchSystem && shark) {
        sharkCatchSystem.reset(shark);
    }

    if (kneeboard && kneeboard.domElement) {
        kneeboard.domElement.style.display = 'block';
    }

    if (navRadio && navRadio.container) {
        navRadio.container.style.display = 'block';
    }

    if (camera && inputManager) {
        const elevationAngle = 45 * (Math.PI / 180);
        const cosAlpha = Math.cos(elevationAngle);
        const sinAlpha = Math.sin(elevationAngle);
        const diagFactor = 0.7071;
        const dist = inputManager.cameraDistance || 30;
        const offsetX = dist * cosAlpha * diagFactor;
        const offsetY = dist * sinAlpha;
        const offsetZ = dist * cosAlpha * diagFactor;

        const initialCamPos = loadedSpawnPosition.clone().add(new THREE.Vector3(offsetX, offsetY, offsetZ));
        camera.position.copy(initialCamPos);
        camera.lookAt(loadedSpawnPosition);
    }
}

// Initialize Loading Manager to track asset loading progress across all models globally
const loadingManager = new THREE.LoadingManager(
    async () => {
        console.log("LoadingManager: All assets loaded successfully.");
        
        const progressBar = document.getElementById('loading-progress');
        const loadingStatus = document.getElementById('loading-status');
        if (progressBar) progressBar.style.width = '100%';
        if (loadingStatus) loadingStatus.textContent = 'Preparing scene & compiling shaders...';

        await new Promise((resolve) => setTimeout(resolve, 20));

        if (loadedGltfHeli && loadedSpawnPosition) {
            initGameAfterLoad(loadedGltfHeli, loadedSpawnPosition);
        } else {
            console.warn("Loading complete, but helicopter or spawn position missing.");
        }

        if (rescueMission && typeof rescueMission.warmup === 'function') {
            rescueMission.warmup(renderer, camera);
        }

        const extraModels = [
            shark ? shark.mesh : null,
            sharkCatchSystem ? sharkCatchSystem.caughtSharkMesh : null,
            rescueMission ? rescueMission.fallbackMesh : null,
            rescueMission && rescueMission.survivor ? rescueMission.survivor.mesh : null,
            rescueMission && rescueMission.survivor ? rescueMission.survivor.raisingMesh : null,
            rescueMission && rescueMission.survivor ? rescueMission.survivor.walkingMesh : null,
            rescueMission && rescueMission.survivor ? rescueMission.survivor.wavingMesh : null,
        ];

        await new Promise((resolve) => setTimeout(resolve, 20));

        await AssetWarmupSystem.warmup(renderer, scene, camera, extraModels);

        renderer.render(scene, camera);

        // Smoothly fade out loading music
        if (loadingMusic) {
            const fadeDuration = 1000;
            const fadeSteps = 20;
            const stepTime = fadeDuration / fadeSteps;
            const volumeStep = loadingMusic.volume / fadeSteps;
            const fadeInterval = setInterval(() => {
                if (loadingMusic.volume > volumeStep) {
                    loadingMusic.volume -= volumeStep;
                } else {
                    loadingMusic.volume = 0;
                    loadingMusic.pause();
                    loadingMusic.currentTime = 0;
                    clearInterval(fadeInterval);
                }
            }, stepTime);
        }

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                const loadingScreen = document.getElementById('loading-screen');
                if (loadingScreen) {
                    loadingScreen.style.opacity = '0';
                    setTimeout(() => {
                        loadingScreen.style.display = 'none';
                    }, 600);
                }
            });
        });
    },
    (url, itemsLoaded, itemsTotal) => {
        const progressPercent = Math.round((itemsLoaded / itemsTotal) * 100);
        const progressBar = document.getElementById('loading-progress');
        const loadingStatus = document.getElementById('loading-status');
        if (progressBar) progressBar.style.width = `${progressPercent}%`;
        if (loadingStatus) loadingStatus.textContent = `Loading assets (${itemsLoaded}/${itemsTotal})... ${progressPercent}%`;
    },
    (url) => {
        console.error('Error loading asset:', url);
    }
);

// Configure DRACOLoader instance with valid Google CDN decoder path
const dracoLoader = new DRACOLoader(loadingManager);
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');

const loader = new GLTFLoader(loadingManager);
loader.setDRACOLoader(dracoLoader);

function initializeGameAssets() {
    liferaftManager = new LiferaftManager(scene, loadingManager);
    rescueMission = new RescueMission(scene, loadingManager);
    windFarm = new WindFarm(scene, loadingManager);
    buoySystem = new BuoySystem(scene, loadingManager);

    shark = new Shark(scene, loadingManager);
    sharkCatchSystem = new SharkCatchSystem(scene, loadingManager);

    mainBase = new MainBase(scene, loadingManager, (spawnPosition) => {
        loadedSpawnPosition = spawnPosition;
        lightingSystem = new LightingSystem(scene, mainBase.helipadCenter);
        if (buoySystem) {
            buoySystem.setHelipadPosition(mainBase.helipadCenter);
        }
    });

    loader.load('helicopter.glb', (gltfHeli) => {
        loadedGltfHeli = gltfHeli;
    }, undefined, (error) => {
        console.error("Helicopter model failed to load:", error);
    });
}

function initGameAfterLoad(gltfHeli, spawnPosition) {
    const model = gltfHeli.scene;
    model.position.copy(spawnPosition);
    scene.add(model);

    try {
        const shadowGeo = new THREE.PlaneGeometry(4.0, 4.0);
        shadowGeo.rotateX(-Math.PI / 2);

        const shadowTexture = createShadowTexture();
        const shadowMat = new THREE.MeshBasicMaterial({
            map: shadowTexture,
            transparent: true,
            depthWrite: false,
        });

        heliShadow = new THREE.Mesh(shadowGeo, shadowMat);
        heliShadow.position.set(model.position.x, 0.05, model.position.z);
        scene.add(heliShadow);
    } catch (e) {
        console.warn("Shadow mesh creation failed:", e);
    }

    heliLightsGroup = new THREE.Group();

    redLight = new THREE.PointLight(0xff0000, 2.5, 8);
    redLight.position.set(4.55, 1.50, 2.92);
    heliLightsGroup.add(redLight);
    redBulb = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff0000 }));
    redBulb.position.copy(redLight.position);
    heliLightsGroup.add(redBulb);

    greenLight = new THREE.PointLight(0x00ff00, 2.5, 8);
    greenLight.position.set(5.09, 1.44, -1.00);
    heliLightsGroup.add(greenLight);
    greenBulb = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), new THREE.MeshBasicMaterial({ color: 0x00ff00 }));
    greenBulb.position.copy(greenLight.position);
    heliLightsGroup.add(greenBulb);

    strobeLight = new THREE.PointLight(0xffffff, 8.0, 15);
    strobeLight.position.set(7.24, 4.39, 1.30);
    heliLightsGroup.add(strobeLight);
    strobeBulb = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    strobeBulb.position.copy(strobeLight.position);
    heliLightsGroup.add(strobeBulb);

    landingLight = new THREE.SpotLight(0xffffee, 18.0, 60, Math.PI / 6, 0.4, 1);
    landingLight.position.set(-4.66, -0.04, -0.35);
    const landingTarget = new THREE.Object3D();
    landingTarget.position.set(-25, -6, 0);
    model.add(landingTarget);
    landingLight.target = landingTarget;
    heliLightsGroup.add(landingLight);

    cockpitLight = new THREE.PointLight(0xffd27d, 3.5, 6);
    cockpitLight.position.set(-3.60, 1.90, -0.18);
    heliLightsGroup.add(cockpitLight);

    model.add(heliLightsGroup);

    const mixer = new THREE.AnimationMixer(model);
    helicopterPlayer = new HelicopterPlayer(model, gltfHeli.animations, mixer, soundManager);

    helicopterPlayer.rescueMission = rescueMission;

    searchLightSystem = new SearchLightSystem(model, scene);

    navRadio = new NavRadio(helicopterPlayer, spawnPosition, soundManager, buoySystem);

    navIndicator = new NavIndicator(helicopterPlayer, navRadio, model, { x: -1.6, y: 3.95, z: 0.16 });

    developerTool = new DeveloperTool(weatherSystem, windFarm, mainBase, helicopterPlayer, camera, renderer, rescueMission ? rescueMission.winchSystem : null);

    if (camera && inputManager) {
        const elevationAngle = 45 * (Math.PI / 180);
        const cosAlpha = Math.cos(elevationAngle);
        const sinAlpha = Math.sin(elevationAngle);
        const diagFactor = 0.7071;
        const dist = inputManager.cameraDistance || 30;
        const offsetX = dist * cosAlpha * diagFactor;
        const offsetY = dist * sinAlpha;
        const offsetZ = dist * cosAlpha * diagFactor;

        const initialCamPos = model.position.clone().add(new THREE.Vector3(offsetX, offsetY, offsetZ));
        camera.position.copy(initialCamPos);
        camera.lookAt(model.position);
    }

    const handleCrash = (crashPos, isSea = false) => {
        if (helicopterPlayer) {
            helicopterPlayer.isPermanentlyDamaged = true;
            if (helicopterPlayer.mixer) {
                helicopterPlayer.mixer.timeScale = 0;
            }
        }
        if (soundManager) {
            soundManager.stopHelicopterEngine();
            soundManager.playSplashSound();
        }
        if (liferaftManager) {
            liferaftManager.showRestart(() => {
                respawnGame();
            });
        }

        if (kneeboard && kneeboard.domElement) {
            const kbDisplay = window.getComputedStyle(kneeboard.domElement).display;
            if (kbDisplay !== 'none') {
                kneeboard.domElement.style.display = 'none';
            }
        }

        if (navRadio && navRadio.container) {
            const navDisplay = window.getComputedStyle(navRadio.container).display;
            if (navDisplay !== 'none') {
                navRadio.container.style.display = 'none';
            }
        }
    };

    helicopterPlayer.onSeaCrash = (crashPos) => {
        console.log("AW189: Sea crash event triggered at position:", crashPos);
        handleCrash(crashPos, true);
    };

    helicopterPlayer.onHelipadCrash = (crashPos) => {
        console.log("AW189: Gear-up landing damage sustained at position:", crashPos);
        handleCrash(crashPos, false);
    };

    helicopterPlayer.onStructureCrash = (crashPos) => {
        console.log("AW189: Structural collision crash sustained at position:", crashPos);
        handleCrash(crashPos, false);
    };
}

function animate() {
    requestAnimationFrame(animate);

    if (developerTool && developerTool.isPaused) {
        clock.getDelta();
        if (developerTool.isFreeCamActive && developerTool.orbitControls) {
            developerTool.orbitControls.update();
        }
        if (renderer && scene && camera) {
            renderer.render(scene, camera);
        }
        return;
    }

    let delta = clock.getDelta();

    if (developerTool && developerTool.isFastForwarding) {
        delta *= developerTool.fastForwardMultiplier;
    }

    if (water && water.material && water.material.uniforms && water.material.uniforms['time']) {
        water.material.uniforms['time'].value += delta * 0.3;
    }

    let weatherData = null;
    try {
        weatherData = weatherSystem.update(delta, scene, camera ? camera.position : null, sunLight, ambientLight);
    } catch (err) {
        console.error("Weather system update error:", err);
    }

    if (soundManager) {
        soundManager.updateRainAudio(weatherData);
    }

    if (weatherSystem && weatherSystem.rainParticles && !scene.getObjectById(weatherSystem.rainParticles.id)) {
        scene.add(weatherSystem.rainParticles);
    }

    if (windFarm) {
        const heliPos = (helicopterPlayer && helicopterPlayer.model) ? helicopterPlayer.model.position : null;
        windFarm.update(delta, heliPos, waterSystem);
    }

    if (buoySystem) {
        buoySystem.update(delta);
    }

    if (shark) {
        shark.update(delta);
    }

    if (sharkCatchSystem && helicopterPlayer && shark) {
        sharkCatchSystem.update(delta, helicopterPlayer, shark);
    }

    if (sirenSystem) {
        sirenSystem.update(delta, windFarm);
    }

    if (liferaftManager) {
        liferaftManager.update(delta);
    }

    if (rescueMission && helicopterPlayer) {
        rescueMission.update(delta, helicopterPlayer, mainBase);
    }

    if (searchLightSystem && helicopterPlayer) {
        searchLightSystem.update(delta, helicopterPlayer, weatherData, mainBase, windFarm, liferaftManager, rescueMission);
    }

    if (waterSystem && helicopterPlayer) {
        const isDispensing = inputManager ? (inputManager.keys['Space'] || false) : false;
        const actuallyDispensing = waterSystem.update(delta, helicopterPlayer, isDispensing);
        if (soundManager) {
            soundManager.updateWaterSpraySound(actuallyDispensing);
        }
    }

    if (rotorWashSystem && helicopterPlayer) {
        rotorWashSystem.update(delta, helicopterPlayer);
    }

    if (helipadDebrisSystem && helicopterPlayer) {
        helipadDebrisSystem.update(delta, helicopterPlayer);
    }

    if (helicopterPlayer && helicopterPlayer.model) {
        helicopterPlayer.update(delta, inputManager ? inputManager.keys : {}, weatherData, windFarm, mainBase);
        
        if (water && !helicopterPlayer.hasCrashedInSea) {
            water.position.x = helicopterPlayer.model.position.x;
            water.position.z = helicopterPlayer.model.position.z;
        }

        if (heliShadow && !helicopterPlayer.hasCrashedInSea) {
            const groundLevel = helicopterPlayer.getCurrentGroundLevel ? helicopterPlayer.getCurrentGroundLevel() : 0;
            const currentHeight = Math.max(0, helicopterPlayer.model.position.y - groundLevel);
            
            heliShadow.position.set(helicopterPlayer.model.position.x, groundLevel + 0.05, helicopterPlayer.model.position.z);
            
            const maxShadowHeight = 40.0;
            const heightFactor = Math.max(0, 1.0 - (currentHeight / maxShadowHeight));
            
            const nightFactor = weatherData && weatherData.isNight ? 0.2 : 1.0;
            if (heliShadow.material) {
                heliShadow.material.opacity = Math.max(0.02, 0.6 * heightFactor * nightFactor);
            }
            
            const scale = Math.max(0.5, 1.5 - (currentHeight * 0.02));
            heliShadow.scale.set(scale, scale, scale);
        }

        const electricalActive = helicopterPlayer.isElectricalOn;
        if (redLight && greenLight && landingLight && cockpitLight) {
            redLight.intensity = electricalActive ? 2.5 : 0.0;
            greenLight.intensity = electricalActive ? 2.5 : 0.0;
            if (redBulb) redBulb.visible = electricalActive;
            if (greenBulb) greenBulb.visible = electricalActive;

            landingLight.intensity = (electricalActive && inputManager && inputManager.landingLightOn) ? 18.0 : 0.0;
            cockpitLight.intensity = electricalActive ? 3.5 : 0.0;
        }

        if (developerTool && developerTool.isFreeCamActive && developerTool.orbitControls) {
            developerTool.orbitControls.update();
        } else if (inputManager && camera && !helicopterPlayer.hasCrashedInSea) {
            const elevationAngle = 45 * (Math.PI / 180); 
            const cosAlpha = Math.cos(elevationAngle);
            const sinAlpha = Math.sin(elevationAngle);
            const diagFactor = 0.7071;

            const dist = inputManager.cameraDistance || 30;
            const offsetX = dist * cosAlpha * diagFactor;
            const offsetY = dist * sinAlpha;
            const offsetZ = dist * cosAlpha * diagFactor;

            const targetCameraPos = helicopterPlayer.model.position.clone().add(new THREE.Vector3(offsetX, offsetY, offsetZ));
            camera.position.lerp(targetCameraPos, 0.1);
            camera.lookAt(helicopterPlayer.model.position);
        }
    }

    if (navRadio) {
        navRadio.update();
    }
    if (navIndicator) {
        navIndicator.update();
    }

    if (kneeboard && helicopterPlayer && !helicopterPlayer.hasCrashedInSea) {
        kneeboard.update(helicopterPlayer, weatherData);
    }

    const btnBattery = document.getElementById('status-battery');
    const btnFuelPump = document.getElementById('status-fuelpump');
    const btnEngine = document.getElementById('status-engine');
    const btnGear = document.getElementById('status-gear');
    const btnLight = document.getElementById('status-light');

    if (helicopterPlayer) {
        const electricalActive = !!helicopterPlayer.isElectricalOn;
        const fuelPumpActive = !!helicopterPlayer.isFuelPumpOn;
        const engineActive = !!helicopterPlayer.isEngineRunning;
        const gearUp = !!helicopterPlayer.isGearUp;

        if (btnBattery) {
            btnBattery.classList.toggle('active', electricalActive);
            btnBattery.style.color = electricalActive ? '#2ecc71' : '';
        }
        if (btnFuelPump) {
            btnFuelPump.classList.toggle('active', fuelPumpActive);
            btnFuelPump.style.color = fuelPumpActive ? '#2ecc71' : '';
        }
        if (btnEngine) {
            btnEngine.classList.toggle('active', engineActive);
            btnEngine.style.color = engineActive ? '#2ecc71' : '';
        }
        if (btnGear) {
            btnGear.classList.toggle('active', !gearUp);
            btnGear.style.color = gearUp ? '#ff4444' : (!gearUp ? '#2ecc71' : '');
        }
    }
    if (btnLight && inputManager) {
        const lightActive = !!inputManager.landingLightOn;
        btnLight.classList.toggle('active', lightActive);
        btnLight.style.color = lightActive ? '#2ecc71' : '';
    }

    if (renderer && scene && camera) {
        renderer.render(scene, camera);
    }
}

animate();