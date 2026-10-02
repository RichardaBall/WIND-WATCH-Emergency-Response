import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
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
import { LiferaftManager } from './liferaft.js';
import { WaterSystem } from './waterSystem.js';
import { SirenSystem } from './sirenSystem.js';
import { RotorWashSystem } from './rotorWashSystem.js';
import { HelipadDebrisSystem } from './helipadDebrisSystem.js';

const { scene, camera, renderer, water, sunLight, ambientLight } = setupScene();
const weatherSystem = new WeatherSystem();
const inputManager = new InputManager();
const soundManager = new SoundManager();
const kneeboard = new Kneeboard();
const liferaftManager = new LiferaftManager(scene);
const waterSystem = new WaterSystem(scene);
const rotorWashSystem = new RotorWashSystem(scene);
const helipadDebrisSystem = new HelipadDebrisSystem(scene);
const sirenSystem = new SirenSystem(scene, null);

const clock = new THREE.Clock();

let helicopterPlayer = null;
let navRadio = null;
let navIndicator = null;
let mainBase = null;
let windFarm = null;

let redLight, greenLight, strobeLight, landingLight, cockpitLight;
let redBulb, greenBulb, strobeBulb;
let heliLightsGroup;
let heliShadow = null;

// Loading Manager to track asset loading progress across all models
const loadingManager = new THREE.LoadingManager(
    () => {
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            loadingScreen.style.opacity = '0';
            setTimeout(() => {
                loadingScreen.style.display = 'none';
            }, 600);
        }
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

// Initialize WindFarm and MainBase passing the shared loadingManager
windFarm = new WindFarm(scene, loadingManager);

const loader = new GLTFLoader(loadingManager);

mainBase = new MainBase(scene, loadingManager, (spawnPosition) => {
    loader.load('helicopter.glb', (gltfHeli) => {
        const model = gltfHeli.scene;
        model.position.copy(spawnPosition);
        scene.add(model);

        try {
            const shadowGeo = new THREE.PlaneGeometry(4.0, 4.0);
            shadowGeo.rotateX(-Math.PI / 2);
            
            const canvas = document.createElement('canvas');
            canvas.width = 128;
            canvas.height = 128;
            const ctx = canvas.getContext('2d');
            const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
            gradient.addColorStop(0, 'rgba(0, 0, 0, 0.7)');
            gradient.addColorStop(0.5, 'rgba(0, 0, 0, 0.4)');
            gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, 128, 128);

            const shadowTexture = new THREE.CanvasTexture(canvas);
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

        window.addEventListener('keydown', (e) => {
            if (!helicopterPlayer) return;
            if (e.code === 'KeyE') helicopterPlayer.toggleEngine();
            if (e.code === 'KeyG') helicopterPlayer.toggleLandingGear();
        });

        const mixer = new THREE.AnimationMixer(model);
        helicopterPlayer = new HelicopterPlayer(model, gltfHeli.animations, mixer, soundManager);

        navRadio = new NavRadio(helicopterPlayer, spawnPosition);
        navIndicator = new NavIndicator(helicopterPlayer, navRadio, model, { x: -1.6, y: 3.95, z: 0.16 });

        // Instantly snap camera to the correct follow position upon spawn so it never jumps or zooms in from the origin
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

        helicopterPlayer.onSeaCrash = (crashPos) => {
            console.log("AW189: Sea crash event triggered at position:", crashPos);
            if (helicopterPlayer && helicopterPlayer.model) {
                helicopterPlayer.model.visible = false;
            }
            if (heliShadow) {
                heliShadow.visible = false;
            }
            if (soundManager) {
                soundManager.stopHelicopterEngine();
                soundManager.playSplashSound();
            }
            if (liferaftManager) {
                liferaftManager.deploy(crashPos);
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

    }, undefined, (error) => {
        console.error("Helicopter model failed to load:", error);
    });
});

function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();

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
        windFarm.update(delta, helicopterPlayer, waterSystem);
    }

    if (sirenSystem) {
        sirenSystem.update(delta, windFarm);
    }

    if (liferaftManager) {
        liferaftManager.update(delta);
    }

    if (waterSystem && helicopterPlayer) {
        const isDispensing = inputManager ? (inputManager.keys['Space'] || false) : false;
        const actuallyDispensing = waterSystem.update(delta, helicopterPlayer, isDispensing);
        if (soundManager) {
            soundManager.updateWaterSound(actuallyDispensing);
        }
    }

    if (rotorWashSystem && helicopterPlayer) {
        rotorWashSystem.update(delta, helicopterPlayer);
    }

    if (helipadDebrisSystem && helicopterPlayer) {
        helipadDebrisSystem.update(delta, helicopterPlayer);
    }

    if (helicopterPlayer && helicopterPlayer.model) {
        helicopterPlayer.update(delta, inputManager ? inputManager.keys : {}, weatherData);
        
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
            if (greenBulb) greenBulb.visible = greenBulb.visible = electricalActive;

            landingLight.intensity = (electricalActive && inputManager && inputManager.landingLightOn) ? 18.0 : 0.0;
            cockpitLight.intensity = electricalActive ? 3.5 : 0.0;
        }

        if (inputManager && camera && !helicopterPlayer.hasCrashedInSea) {
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

    if (renderer && scene && camera) {
        renderer.render(scene, camera);
    }
}

animate();