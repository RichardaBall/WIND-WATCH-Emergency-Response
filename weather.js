import * as THREE from 'three';

export class WeatherSystem {
    constructor() {
        this.currentWeather = 'fine'; // 'fine', 'rain', 'storm'
        this.previousWeather = 'fine';
        this.transitionProgress = 1.0; // 0.0 to 1.0 representing transition progress
        this.weatherTransitionDuration = 15.0; // 15 seconds to fully blend between weather types

        this.transitionTimer = 0.0;
        this.targetDuration = 60.0;

        // Day / Night Cycle Variables (5 Minutes Total Cycle)
        this.dayNightTimer = 0.0;
        this.dayCycleDuration = 300.0; // 5 minutes
        this.sunAngle = 0.0;

        // Secondary Light Source: Moon
        this.moonLight = null;

        // Wind vectors
        this.windVector = new THREE.Vector3(0, 0, 0);
        this.targetWind = new THREE.Vector3(0, 0, 0);

        // Rain particle system setup
        this.particleCount = 5000;
        this.rainParticles = null;
        this.rainGeo = null;
        this.rainMat = null;
        this.rainSpeeds = [];

        this.baseSunIntensity = 1.2;

        // Lightning variables (spaced far apart for safety)
        this.lightningTimer = 0.0;
        this.lightningInterval = 15.0;
        this.lightningFlashDuration = 0.0;

        this.setupRainSystem();
    }

    setupRainSystem() {
        this.rainGeo = new THREE.BufferGeometry();
        const positions = new Float32Array(this.particleCount * 6);
        this.rainSpeeds = new Float32Array(this.particleCount);

        for (let i = 0; i < this.particleCount; i++) {
            const x = (Math.random() - 0.5) * 140;
            const y = Math.random() * 70;
            const z = (Math.random() - 0.5) * 140;
            const dropLength = 1.2 + Math.random() * 0.8;

            positions[i * 6] = x;
            positions[i * 6 + 1] = y;
            positions[i * 6 + 2] = z;

            positions[i * 6 + 3] = x;
            positions[i * 6 + 4] = y - dropLength;
            positions[i * 6 + 5] = z;

            this.rainSpeeds[i] = 50.0 + Math.random() * 30.0;
        }

        this.rainGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        this.rainMat = new THREE.LineBasicMaterial({
            color: 0xcceeff,
            transparent: true,
            opacity: 0.0,
            depthWrite: false,
            linewidth: 1,
        });

        this.rainParticles = new THREE.LineSegments(this.rainGeo, this.rainMat);
        this.rainParticles.visible = false;
    }

    setupMoonLight(scene) {
        if (!this.moonLight && scene) {
            this.moonLight = new THREE.DirectionalLight(0x335588, 0.0);
            scene.add(this.moonLight);
        }
    }

    _getRawWeatherEffects(type) {
        switch (type) {
            case 'rain':
                return {
                    visibility: 'moderate',
                    dragMultiplier: 1.08,
                    liftMultiplier: 0.97,
                    fogDensity: 0.006,
                    dayFogColor: 0x778899,
                    nightFogColor: 0x020408,
                    sunIntensity: 0.7,
                    sunColor: 0x99aabb,
                    rainOpacity: 0.5,
                };
            case 'storm':
                return {
                    visibility: 'poor',
                    dragMultiplier: 1.15,
                    liftMultiplier: 0.92,
                    fogDensity: 0.02,
                    dayFogColor: 0x2b3744,
                    nightFogColor: 0x010204,
                    sunIntensity: 0.4,
                    sunColor: 0x556677,
                    rainOpacity: 0.55,
                };
            case 'fine':
            default:
                return {
                    visibility: 'good',
                    dragMultiplier: 1.0,
                    liftMultiplier: 1.0,
                    fogDensity: 0.0012,
                    dayFogColor: 0xcce0ff,
                    nightFogColor: 0x030611,
                    sunIntensity: 1.2,
                    sunColor: 0xffffeb,
                    rainOpacity: 0.0,
                };
        }
    }

    getWeatherEffects() {
        const prevEff = this._getRawWeatherEffects(this.previousWeather);
        const currEff = this._getRawWeatherEffects(this.currentWeather);
        const t = THREE.MathUtils.clamp(this.transitionProgress, 0.0, 1.0);

        return {
            visibility: t < 0.5 ? prevEff.visibility : currEff.visibility,
            dragMultiplier: THREE.MathUtils.lerp(prevEff.dragMultiplier, currEff.dragMultiplier, t),
            liftMultiplier: THREE.MathUtils.lerp(prevEff.liftMultiplier, currEff.liftMultiplier, t),
            fogDensity: THREE.MathUtils.lerp(prevEff.fogDensity, currEff.fogDensity, t),
            dayFogColor: new THREE.Color(prevEff.dayFogColor).lerp(new THREE.Color(currEff.dayFogColor), t).getHex(),
            nightFogColor: new THREE.Color(prevEff.nightFogColor).lerp(new THREE.Color(currEff.nightFogColor), t).getHex(),
            sunIntensity: THREE.MathUtils.lerp(prevEff.sunIntensity, currEff.sunIntensity, t),
            sunColor: new THREE.Color(prevEff.sunColor).lerp(new THREE.Color(currEff.sunColor), t).getHex(),
            rainOpacity: THREE.MathUtils.lerp(prevEff.rainOpacity, currEff.rainOpacity, t),
        };
    }

    update(delta, scene, cameraPos, sunLight, ambientLight) {
        if (!scene) return { weatherType: this.currentWeather, wind: this.windVector, effects: this.getWeatherEffects(), isNight: false };

        this.setupMoonLight(scene);

        // --- Weather Transition Blending ---
        if (this.transitionProgress < 1.0) {
            this.transitionProgress = Math.min(1.0, this.transitionProgress + (delta / this.weatherTransitionDuration));
        }

        // --- Day / Night Celestial Calculations ---
        this.dayNightTimer = (this.dayNightTimer + delta) % this.dayCycleDuration;
        const cycleProgress = this.dayNightTimer / this.dayCycleDuration;
        this.sunAngle = cycleProgress * Math.PI * 2;

        const orbitRadius = 400;
        const sunX = Math.cos(this.sunAngle) * orbitRadius;
        const sunY = Math.sin(this.sunAngle) * orbitRadius;
        const sunZ = Math.sin(this.sunAngle * 0.5) * 150;

        if (sunLight && sunLight.position) {
            sunLight.position.set(sunX, sunY, sunZ);
        }

        if (this.moonLight && this.moonLight.position) {
            this.moonLight.position.set(-sunX, -sunY, -sunZ);
        }

        const daylightFactor = THREE.MathUtils.clamp((sunY + 20) / 100, 0.0, 1.0);
        const nightFactor = 1.0 - daylightFactor;
        const isNight = nightFactor > 0.5;
        const currentEffects = this.getWeatherEffects();
        const lightsOn = isNight || (this.currentWeather === 'storm' && currentEffects.rainOpacity > 0.3);

        // --- Weather State Roll ---
        this.transitionTimer += delta;
        if (this.transitionTimer >= this.targetDuration) {
            this.transitionTimer = 0.0;
            this.targetDuration = 45.0 + Math.random() * 60.0;
            this.rollNewWeather();
        }

        // --- Storm Lightning Logic ---
        let lightningFactor = 0.0;
        if (this.currentWeather === 'storm' || (this.previousWeather === 'storm' && this.transitionProgress < 0.8)) {
            this.lightningTimer += delta;
            if (this.lightningTimer >= this.lightningInterval) {
                this.lightningTimer = 0.0;
                this.lightningInterval = 12.0 + Math.random() * 18.0; // 12 to 30 seconds apart
                this.lightningFlashDuration = 0.18; // Brief flash duration
            }
            if (this.lightningFlashDuration > 0) {
                this.lightningFlashDuration -= delta;
                lightningFactor = 1.0 * Math.min(1.0, this.transitionProgress * 2.0);
            }
        } else {
            this.lightningTimer = 0.0;
            this.lightningFlashDuration = 0.0;
        }

        const effects = this.getWeatherEffects();

        this.windVector.lerp(this.targetWind, Math.min(delta * 0.2, 1.0));

        const targetFogHex = new THREE.Color(effects.dayFogColor).lerp(
            new THREE.Color(effects.nightFogColor),
            nightFactor
        );

        // Update Scene Fog & Background
        if (scene.fog && scene.fog.color) {
            const flashFogColor = targetFogHex.clone().addScalar(lightningFactor * 0.5);
            scene.fog.color.lerp(flashFogColor, Math.min(delta * 0.5, 1.0));
            if (scene.fog.isFogExp2) {
                scene.fog.density = THREE.MathUtils.lerp(scene.fog.density, effects.fogDensity, Math.min(delta * 0.5, 1.0));
            }
        }

        if (scene.background && scene.background.isColor) {
            const flashBgColor = targetFogHex.clone().addScalar(lightningFactor * 0.5);
            scene.background.lerp(flashBgColor, Math.min(delta * 0.5, 1.0));
        } else if (scene) {
            scene.background = targetFogHex.clone();
        }

        // Sunlight Updates (with lightning spike)
        if (sunLight && sunLight.color) {
            const targetSunColor = new THREE.Color(effects.sunColor);
            sunLight.color.lerp(targetSunColor, Math.min(delta * 0.5, 1.0));
            sunLight.intensity = (effects.sunIntensity * daylightFactor) + (lightningFactor * 14.0);
        }

        // Moonlight Updates
        if (this.moonLight) {
            const moonBaseIntensity = 0.12;
            const stormFactor = (this.currentWeather === 'storm' ? 0.2 : 1.0);
            this.moonLight.intensity = (moonBaseIntensity * nightFactor * stormFactor) + (lightningFactor * 4.0);
        }

        // Ambient Light Updates
        if (ambientLight && ambientLight.color) {
            const dayAmbient = new THREE.Color(0x888888);
            const nightAmbient = new THREE.Color(0x02040a);
            const targetAmbient = dayAmbient.clone().lerp(nightAmbient, nightFactor);
            ambientLight.color.lerp(targetAmbient, Math.min(delta * 0.5, 1.0));
            ambientLight.intensity = THREE.MathUtils.lerp(1.2, 0.08, nightFactor) + (lightningFactor * 0.8);
        }

        // --- Dynamic Scene Environment Adjustments (Water & Model Lights/Emissives) ---
        scene.traverse((child) => {
            // 1. Sea Water Night Darkening & Reflection Adjustment
            if (child.material && child.material.uniforms && child.material.uniforms.waterColor) {
                const dayWaterColor = new THREE.Color(0x0044bb);
                const nightWaterColor = new THREE.Color(0x000103);
                child.material.uniforms.waterColor.value.copy(dayWaterColor.clone().lerp(nightWaterColor, nightFactor));
                if (child.material.uniforms.sunColor) {
                    const daySunColor = new THREE.Color(0x88ccff);
                    const nightSunColor = new THREE.Color(0x112233);
                    child.material.uniforms.sunColor.value.copy(daySunColor.clone().lerp(nightSunColor, nightFactor));
                }
            }

            // 2. Turn off Blender Model Emissive Materials During Daytime, On at Night or Storm
            if (child.isMesh && child.material) {
                const mats = Array.isArray(child.material) ? child.material : [child.material];
                mats.forEach(mat => {
                    if (mat.emissive && mat.emissive.getHex() !== 0) {
                        if (mat.userData.originalEmissiveIntensity === undefined) {
                            mat.userData.originalEmissiveIntensity = mat.emissiveIntensity !== undefined ? mat.emissiveIntensity : 1.0;
                        }
                        mat.emissiveIntensity = lightsOn ? mat.userData.originalEmissiveIntensity : 0.0;
                    }
                });
            }

            // 3. Turn off Model Point/Spot Lights During Daytime, On at Night or Storm
            if ((child.isPointLight || child.isSpotLight) && child !== sunLight && child !== this.moonLight) {
                if (child.userData.originalIntensity === undefined) {
                    child.userData.originalIntensity = child.intensity;
                }
                child.intensity = lightsOn ? child.userData.originalIntensity : 0.0;
            }
        });

        // Rain Animation Updates & Smooth Opacity Blending
        if (this.rainParticles && cameraPos) {
            if (effects.rainOpacity > 0.001) {
                this.rainParticles.visible = true;
                if (this.rainMat) {
                    this.rainMat.opacity = effects.rainOpacity;
                }
            } else {
                this.rainParticles.visible = false;
                if (this.rainMat) {
                    this.rainMat.opacity = 0.0;
                }
            }

            if (this.rainParticles.visible) {
                this.rainParticles.position.set(cameraPos.x, cameraPos.y, cameraPos.z);

                const positions = this.rainGeo.attributes.position.array;
                const isStormActive = this.currentWeather === 'storm' || this.previousWeather === 'storm';
                const windX = this.windVector.x * 0.08;
                const windZ = this.windVector.z * 0.08;

                for (let i = 0; i < this.particleCount; i++) {
                    const speed = this.rainSpeeds[i] * (isStormActive ? 1.4 : 1.0) * delta;
                    const dropLength = isStormActive ? 1.8 : 1.4;

                    let topY = positions[i * 6 + 1] - speed;
                    let botY = topY - dropLength;

                    if (topY < -25) {
                        topY = 45;
                        botY = topY - dropLength;
                        positions[i * 6] = (Math.random() - 0.5) * 140;
                        positions[i * 6 + 2] = (Math.random() - 0.5) * 140;
                    }

                    positions[i * 6 + 3] = positions[i * 6] - windX;
                    positions[i * 6 + 5] = positions[i * 6 + 2] - windZ;

                    positions[i * 6 + 1] = topY;
                    positions[i * 6 + 4] = botY;
                }

                this.rainGeo.attributes.position.needsUpdate = true;
            }
        }

        return {
            weatherType: this.currentWeather,
            wind: this.windVector,
            effects: effects,
            isNight: isNight,
        };
    }

    rollNewWeather() {
        const rand = Math.random();
        let nextWeather = 'fine';
        if (rand < 0.35) {
            nextWeather = 'fine';
        } else if (rand < 0.75) {
            nextWeather = 'rain';
        } else {
            nextWeather = 'storm';
        }
        this.setWeather(nextWeather);
    }

    setWeather(type) {
        if (this.currentWeather === type) return;
        this.previousWeather = this.currentWeather;
        this.currentWeather = type;
        this.transitionProgress = 0.0; // Reset transition for smooth blending

        if (type === 'fine') {
            this.targetWind.set((Math.random() - 0.5) * 1.5, 0, (Math.random() - 0.5) * 1.5);
            if (this.rainMat) this.rainMat.color.setHex(0xcceeff);
        } else if (type === 'rain') {
            this.targetWind.set((Math.random() - 0.5) * 3.5, 0, (Math.random() - 0.5) * 3.5);
            if (this.rainMat) {
                this.rainMat.color.setHex(0xaaccff);
            }
            if (this.rainParticles) this.rainParticles.visible = true;
        } else if (type === 'storm') {
            this.targetWind.set((Math.random() - 0.5) * 6.0, (Math.random() - 0.5) * 1.0, (Math.random() - 0.5) * 6.0);
            if (this.rainMat) {
                this.rainMat.color.setHex(0xcceeff);
            }
            if (this.rainParticles) this.rainParticles.visible = true;
        }
    }
}