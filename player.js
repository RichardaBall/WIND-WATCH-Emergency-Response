import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

export class HelicopterPlayer {
    constructor(model, animations, mixer, soundManager = null) {
        this.model = model;
        this.mixer = mixer;
        this.soundManager = soundManager;
        this.actions = {};

        this.hasCrashedInSea = false;
        this.onSeaCrash = null;
        this.hasCrashedOnHelipad = false;
        this.onHelipadCrash = null;
        this.hasCrashedIntoStructure = false;
        this.onStructureCrash = null;
        this.isPermanentlyDamaged = false; // Gear-up landing damage state
        this.collisionEnabled = true; // Collision detection toggle state

        // --- Hardcoded Nav Lights (Red, Green) & White Strobe Positions ---
        this.navRedLight = null;
        this.navGreenLight = null;
        this.strobeLight = null;
        
        this.navRedBulbMesh = null;
        this.navGreenBulbMesh = null;
        this.strobeBulbMesh = null;

        this.navRedOffset = new THREE.Vector3(4.57, 1.43, 2.89);
        this.navGreenOffset = new THREE.Vector3(5.10, 1.43, -0.96);
        this.strobeOffset = new THREE.Vector3(7.28, 4.32, 1.29);

        this.strobeOriginalColor = new THREE.Color(0xffffff);

        this.model.traverse((child) => {
            if (child.isPointLight) {
                if (child.color.r > 0.5 && child.color.g < 0.2 && child.color.b < 0.2) {
                    this.navRedLight = child;
                } else if (child.color.g > 0.5 && child.color.r < 0.2 && child.color.b < 0.2) {
                    this.navGreenLight = child;
                } else if (child.color.r > 0.8 && child.color.g > 0.8 && child.color.b > 0.8 || child.position.y > 3.0) {
                    this.strobeLight = child;
                    this.strobeOriginalColor.copy(child.color);
                }
            }
        });

        // Create lights if missing in model and apply hardcoded positions
        if (!this.navRedLight) {
            this.navRedLight = new THREE.PointLight(0xff0000, 2.5, 10);
            this.model.add(this.navRedLight);
        }
        this.navRedLight.position.copy(this.navRedOffset);

        if (!this.navGreenLight) {
            this.navGreenLight = new THREE.PointLight(0x00ff00, 2.5, 10);
            this.model.add(this.navGreenLight);
        }
        this.navGreenLight.position.copy(this.navGreenOffset);

        if (!this.strobeLight) {
            this.strobeLight = new THREE.PointLight(0xffffff, 8.0, 15);
            this.model.add(this.strobeLight);
        }
        this.strobeLight.position.copy(this.strobeOffset);

        // Find or create bulb meshes for emissive glow
        this.model.traverse((child) => {
            if (child.isMesh) {
                if (this.navRedLight && child.position.distanceTo(this.navRedOffset) < 0.5) {
                    this.navRedBulbMesh = child;
                } else if (this.navGreenLight && child.position.distanceTo(this.navGreenOffset) < 0.5) {
                    this.navGreenBulbMesh = child;
                } else if (this.strobeLight && child.position.distanceTo(this.strobeOffset) < 0.5) {
                    this.strobeBulbMesh = child;
                }
            }
        });

        if (!this.navRedBulbMesh) {
            const bulbGeo = new THREE.SphereGeometry(0.08, 16, 16);
            const bulbMat = new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 3.0 });
            this.navRedBulbMesh = new THREE.Mesh(bulbGeo, bulbMat);
            this.model.add(this.navRedBulbMesh);
        }
        this.navRedBulbMesh.position.copy(this.navRedOffset);

        if (!this.navGreenBulbMesh) {
            const bulbGeo = new THREE.SphereGeometry(0.08, 16, 16);
            const bulbMat = new THREE.MeshStandardMaterial({ color: 0x00ff00, emissive: 0x00ff00, emissiveIntensity: 3.0 });
            this.navGreenBulbMesh = new THREE.Mesh(bulbGeo, bulbMat);
            this.model.add(this.navGreenBulbMesh);
        }
        this.navGreenBulbMesh.position.copy(this.navGreenOffset);

        if (!this.strobeBulbMesh) {
            const bulbGeo = new THREE.SphereGeometry(0.08, 16, 16);
            const bulbMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 3.0 });
            this.strobeBulbMesh = new THREE.Mesh(bulbGeo, bulbMat);
            this.model.add(this.strobeBulbMesh);
        }
        this.strobeBulbMesh.position.copy(this.strobeOffset);
        
        window.addEventListener('keydown', (event) => {
            if (event.ctrlKey && event.code === 'KeyW') {
                event.preventDefault();
            }

            if (event.code === 'KeyP') {
                console.log(
                    `%c [SPAWN COORDINATES FOUND] `, 
                    'background: #222; color: #bada55; padding: 4px; font-weight: bold;', 
                    `new THREE.Vector3(${this.model.position.x.toFixed(4)}, ${this.model.position.y.toFixed(4)}, ${this.model.position.z.toFixed(4)})`
                );
            }
        });
        
        if (animations && Array.isArray(animations)) {
            animations.forEach((clip) => {
                if (clip.name.toLowerCase().includes('rotor') || clip.name.toLowerCase().includes('armature') || clip.name.includes('Арматура')) {
                    let minTime = Infinity;
                    clip.tracks.forEach((track) => {
                        if (track.times.length > 0) {
                            minTime = Math.min(minTime, track.times[0]);
                        }
                    });
                    if (minTime < Infinity && minTime > 0) {
                        clip.tracks.forEach((track) => {
                            for (let i = 0; i < track.times.length; i++) {
                                track.times[i] -= minTime;
                            }
                        });
                    }

                    clip.tracks.forEach((track) => {
                        if (track.times.length > 1) {
                            const times = track.times;
                            const values = track.values;
                            const itemSize = track.getValueSize();
                            
                            if (itemSize === 4) {
                                const x0 = values[0], y0 = values[1], z0 = values[2], w0 = values[3];
                                const lastIdx = (times.length - 1) * 4;
                                const dot = x0 * values[lastIdx] + y0 * values[lastIdx+1] + z0 * values[lastIdx+2] + w0 * values[lastIdx+3];
                                const sign = dot < 0 ? -1 : 1;
                                
                                values[lastIdx]     = x0 * sign;
                                values[lastIdx + 1] = y0 * sign;
                                values[lastIdx + 2] = z0 * sign;
                                values[lastIdx + 3] = w0 * sign;
                            } else if (itemSize === 3) {
                                for (let i = 0; i < 3; i++) {
                                    values[(times.length - 1) * 3 + i] = values[i];
                                }
                            }
                        }
                    });

                    let maxTime = 0;
                    clip.tracks.forEach((track) => {
                        if (track.times.length > 0) {
                            maxTime = Math.max(maxTime, track.times[track.times.length - 1]);
                        }
                    });
                    if (maxTime > 0) {
                        clip.duration = maxTime;
                    }
                }

                const action = this.mixer.clipAction(clip);
                this.actions[clip.name] = action;
            });
        }

        this.isElectricalOn = false; 
        this.qKeyWasPressed = false; 

        this.isFuelPumpOn = false;   
        this.fKeyWasPressed = false; 
        this.fuelStarvationTimer = 0.0; 

        this.isEngineRunning = false;
        this.enginePower = 0.0;       
        this.targetEnginePower = 0.0; 

        this.isGearUp = false; 

        this.dryWeightKg = 4600;       
        this.fuelKg = 1000;            
        this.maxFuelKg = 1000;
        this.waterTankKg = 1000;      
        this.maxWaterTankKg = 1500;   
        this.baselineMassKg = 6200; 

        this.maxFuelBurnRatePerSec = 1000.0 / 300.0; 
        this.maxMoveSpeed = 75.0;       
        this.maxTaxiSpeed = 3.0;        
        this.maxTurnSpeed = 1.5;        
        this.maxTaxiTurnSpeed = 0.75;   
        this.maxAltitudeSpeed = 12.0;    

        this.currentMoveSpeed = 0.0;
        this.currentStrafeSpeed = 0.0; 
        this.currentTurnSpeed = 0.0;
        this.currentAltitudeSpeed = 0.0;

        this.helipadAltitude = 5.336;
        this.seaLevel = 0.0;
        this.landingHeightOffset = 0.9; 
        this.maxCeilingFeet = 400.0;

        this.wasOnGround = true;
    }

    getTotalMass() {
        return this.dryWeightKg + this.fuelKg + this.waterTankKg;
    }

    getCurrentGroundLevel() {
        const helipadCenter = new THREE.Vector2(0.0, 0.0);
        const currentPos2D = new THREE.Vector2(this.model.position.x, this.model.position.z);
        const distanceFromHelipad = currentPos2D.distanceTo(helipadCenter);

        if (distanceFromHelipad < 12.0) {
            return this.helipadAltitude + this.landingHeightOffset;
        }
        return -999.0;
    }

    toggleElectrical() {
        if (this.isPermanentlyDamaged) return;
        this.isElectricalOn = !this.isElectricalOn;
        if (this.soundManager) {
            if (typeof this.soundManager.playToggleSwitchSound === 'function') {
                this.soundManager.playToggleSwitchSound(this.isElectricalOn);
            }
        }
    }

    toggleFuelPump() {
        if (this.isPermanentlyDamaged) return;
        this.isFuelPumpOn = !this.isFuelPumpOn;
        if (this.soundManager) {
            if (typeof this.soundManager.playToggleSwitchSound === 'function') {
                this.soundManager.playToggleSwitchSound(this.isFuelPumpOn);
            }
            if (this.isFuelPumpOn) this.soundManager.playFuelPumpPrimeSound();
        }
        if (this.isFuelPumpOn) this.fuelStarvationTimer = 0.0;
    }

    toggleEngine() {
        if (this.isPermanentlyDamaged) return;
        if (!this.isElectricalOn && this.targetEnginePower === 0) return;
        if (this.fuelKg <= 0 && this.targetEnginePower === 0) return;
        if (!this.isFuelPumpOn && this.targetEnginePower === 0) return;

        if (this.targetEnginePower > 0) {
            this.targetEnginePower = 0.0;
            this.isEngineRunning = false;
            if (this.soundManager) this.soundManager.stopHelicopterEngine();
        } else {
            this.targetEnginePower = 1.0;
            this.isEngineRunning = true;
            this.fuelStarvationTimer = 0.0;
            if (this.soundManager) this.soundManager.startHelicopterEngine();
            
            for (let name in this.actions) {
                if (name.toLowerCase().includes('rotor') || name.toLowerCase().includes('armature') || name.includes('Арматура')) {
                    const action = this.actions[name];
                    if (!action.isRunning()) action.reset().play();
                }
            }
        }
    }

    toggleLandingGear() {
        if (this.isPermanentlyDamaged || !this.isElectricalOn) return;

        const activeGroundLevel = this.getCurrentGroundLevel();
        const isOnGround = this.model.position.y <= activeGroundLevel + 0.05;
        if (isOnGround && !this.isGearUp) return;

        let gearAction = null;
        for (let name in this.actions) {
            if (name.toLowerCase().includes('gear') || name.toLowerCase().includes('landing')) {
                gearAction = this.actions[name];
                break;
            }
        }
        if (!gearAction) return;

        gearAction.paused = false;
        gearAction.timeScale = this.isGearUp ? -4 : 4;
        gearAction.setLoop(THREE.LoopOnce, 1);
        gearAction.clampWhenFinished = true;
        gearAction.play();
        
        const willBeGearUp = !this.isGearUp;
        if (this.soundManager) this.soundManager.playLandingGearSound(willBeGearUp);
        this.isGearUp = willBeGearUp;
    }

    checkCollisions(windFarm, mainBase) {
        if (!this.collisionEnabled) return false;
        if (this.hasCrashedInSea || this.isPermanentlyDamaged || this.hasCrashedIntoStructure) return false;

        const heliBox = new THREE.Box3().setFromObject(this.model);
        heliBox.expandByScalar(-0.5);

        const allBoxes = [];
        if (windFarm && typeof windFarm.getCollisionBoxes === 'function') {
            allBoxes.push(...windFarm.getCollisionBoxes());
        }
        if (mainBase && typeof mainBase.getCollisionBoxes === 'function') {
            allBoxes.push(...mainBase.getCollisionBoxes());
        }

        for (let i = 0; i < allBoxes.length; i++) {
            if (heliBox.intersectsBox(allBoxes[i])) {
                const helipadCenter2D = new THREE.Vector2(0.0, 0.0);
                const heliPos2D = new THREE.Vector2(this.model.position.x, this.model.position.z);
                if (heliPos2D.distanceTo(helipadCenter2D) < 12.0) {
                    continue; 
                }
                return true;
            }
        }
        return false;
    }

    update(delta, keys, weatherData, windFarm = null, mainBase = null) {
        if (this.hasCrashedInSea || this.isPermanentlyDamaged) {
            if (this.isPermanentlyDamaged) {
                const activeGroundLevel = this.getCurrentGroundLevel();
                this.model.position.y = activeGroundLevel;
                this.currentMoveSpeed = 0.0;
                this.currentStrafeSpeed = 0.0;
                this.currentTurnSpeed = 0.0;
                this.currentAltitudeSpeed = 0.0;
                if (this.mixer) this.mixer.update(delta);
                for (let name in this.actions) {
                    if (name.toLowerCase().includes('rotor') || name.toLowerCase().includes('armature') || name.includes('Арматура')) {
                        const action = this.actions[name];
                        if (action.isRunning()) action.stop();
                    }
                }
            }
            return;
        }

        const helipadCenter2D = new THREE.Vector2(0.0, 0.0);
        const currentPos2D = new THREE.Vector2(this.model.position.x, this.model.position.z);
        const distanceFromHelipad = currentPos2D.distanceTo(helipadCenter2D);

        if (this.model.position.y <= this.landingHeightOffset && distanceFromHelipad >= 12.0) {
            this.hasCrashedInSea = true;
            if (this.soundManager) {
                this.soundManager.stopHelicopterEngine();
                this.soundManager.playSplashSound();
            }
            if (this.onSeaCrash) this.onSeaCrash(this.model.position.clone());
            return;
        }

        const activeGroundLevel = this.getCurrentGroundLevel();
        const isOnGround = this.model.position.y <= activeGroundLevel + 0.05;

        if (!this.wasOnGround && isOnGround && distanceFromHelipad < 12.0 && this.isGearUp) {
            this.isPermanentlyDamaged = true;
            this.hasCrashedOnHelipad = true;
            this.isElectricalOn = false;
            this.isFuelPumpOn = false;
            this.targetEnginePower = 0.0;
            this.enginePower = 0.0;
            this.isEngineRunning = false;
            this.currentMoveSpeed = 0.0;
            this.currentStrafeSpeed = 0.0;
            this.currentTurnSpeed = 0.0;
            this.currentAltitudeSpeed = 0.0;
            this.model.position.y = activeGroundLevel;
            if (this.soundManager) this.soundManager.stopHelicopterEngine();
            if (this.onHelipadCrash) this.onHelipadCrash(this.model.position.clone());
            return;
        }

        if (this.mixer) this.mixer.update(delta);

        if (this.targetEnginePower > 0 && (!this.isFuelPumpOn || this.fuelKg <= 0)) {
            this.fuelStarvationTimer += delta;
            if (this.fuelStarvationTimer >= 5.0) { 
                this.targetEnginePower = 0.0;
                this.isEngineRunning = false;
                if (this.soundManager) this.soundManager.stopHelicopterEngine();
            }
        } else if (this.isFuelPumpOn && this.fuelKg > 0 && this.isEngineRunning) {
            this.fuelStarvationTimer = 0.0;
        }

        if (this.enginePower > 0.01 && this.fuelKg > 0 && this.isFuelPumpOn) {
            const currentMass = this.getTotalMass();
            const massMultiplier = currentMass / this.baselineMassKg;
            let aeroDragMultiplier = (!this.isGearUp && !isOnGround) ? 2.0 : 1.0;

            if (weatherData && weatherData.wind && !isOnGround) {
                aeroDragMultiplier += (weatherData.wind.length() * 0.05);
            }
            if (weatherData && weatherData.effects) {
                aeroDragMultiplier *= weatherData.effects.dragMultiplier;
            }

            const frameBurn = this.maxFuelBurnRatePerSec * this.enginePower * massMultiplier * aeroDragMultiplier * delta;
            this.fuelKg = Math.max(0, this.fuelKg - frameBurn);

            if (this.fuelKg <= 0 && this.targetEnginePower > 0) {
                this.targetEnginePower = 0.0;
                this.isEngineRunning = false;
                if (this.soundManager) this.soundManager.stopHelicopterEngine();
            }
        }

        // Strobe / Fuel State Light Animation
        if (this.strobeLight && this.isElectricalOn) {
            const time = Date.now() * 0.001;
            let flashRate = this.fuelKg <= 100.0 ? 16.0 : (this.fuelKg <= 500.0 ? 8.0 : 4.0);
            let targetColor = this.fuelKg <= 100.0 ? new THREE.Color(0xe74c3c) : (this.fuelKg <= 500.0 ? new THREE.Color(0xe67e22) : this.strobeOriginalColor);

            this.strobeLight.color.copy(targetColor);
            this.strobeLight.intensity = ((Math.floor(time * flashRate) % 2) === 0) ? 8.0 : 0.0;

            if (this.strobeBulbMesh && this.strobeBulbMesh.material) {
                this.strobeBulbMesh.material.color.copy(this.strobeLight.color);
                this.strobeBulbMesh.visible = this.strobeLight.intensity > 0;
            }
        } else if (this.strobeLight) {
            this.strobeLight.intensity = 0;
            if (this.strobeBulbMesh) this.strobeBulbMesh.visible = false;
        }

        // Nav Lights State
        if (this.isElectricalOn) {
            if (this.navRedLight) {
                this.navRedLight.intensity = 2.5;
                if (this.navRedBulbMesh && this.navRedBulbMesh.material) {
                    this.navRedBulbMesh.material.emissiveIntensity = 3.0;
                    this.navRedBulbMesh.visible = true;
                }
            }
            if (this.navGreenLight) {
                this.navGreenLight.intensity = 2.5;
                if (this.navGreenBulbMesh && this.navGreenBulbMesh.material) {
                    this.navGreenBulbMesh.material.emissiveIntensity = 3.0;
                    this.navGreenBulbMesh.visible = true;
                }
            }
        } else {
            if (this.navRedLight) {
                this.navRedLight.intensity = 0;
                if (this.navRedBulbMesh) this.navRedBulbMesh.visible = false;
            }
            if (this.navGreenLight) {
                this.navGreenLight.intensity = 0;
                if (this.navGreenBulbMesh) this.navGreenBulbMesh.visible = false;
            }
        }

        if (this.enginePower !== this.targetEnginePower) {
            const diff = this.targetEnginePower - this.enginePower;
            this.enginePower += diff * Math.min(delta * 1.55, 1.0);
            if (Math.abs(this.targetEnginePower - this.enginePower) < 0.001) {
                this.enginePower = this.targetEnginePower;
            }
        }

        if (this.soundManager && this.isEngineRunning) {
            this.soundManager.updateHelicopterAudio(this.enginePower, this.currentMoveSpeed);
        }

        for (let name in this.actions) {
            if (name.toLowerCase().includes('rotor') || name.toLowerCase().includes('armature') || name.includes('Арматура')) {
                const action = this.actions[name];
                if (isOnGround && this.targetEnginePower === 0 && this.enginePower <= 0.001) {
                    if (action.isRunning()) action.stop();
                } else {
                    const activeTimeScale = Math.max(this.enginePower * 1.2, 0.05);
                    action.timeScale = activeTimeScale;
                    if (activeTimeScale > 0 && !action.isRunning()) action.reset().play();
                }
            }
        }

        if (isOnGround && this.targetEnginePower === 0 && this.enginePower <= 0.001 && distanceFromHelipad < 12.0) {
            this.currentMoveSpeed = 0.0;
            this.currentStrafeSpeed = 0.0;
            this.currentTurnSpeed = 0.0;
            this.currentAltitudeSpeed = 0.0;
            this.model.position.y = activeGroundLevel;
            this.wasOnGround = isOnGround;
            return;
        }

        const currentMass = this.getTotalMass();
        const massFactor = this.baselineMassKg / currentMass; 
        let activeDragMultiplier = weatherData && weatherData.effects ? weatherData.effects.dragMultiplier : 1.0;
        if (!this.isGearUp && !isOnGround) activeDragMultiplier += 1.0;

        let activeLiftMultiplier = weatherData && weatherData.effects ? weatherData.effects.liftMultiplier : 1.0;
        let activeSpeedLimit = (isOnGround ? this.maxTaxiSpeed : this.maxMoveSpeed) * Math.max(this.enginePower, 0.2) / activeDragMultiplier;
        const activeTurnSpeed = (isOnGround ? this.maxTaxiTurnSpeed : this.maxTurnSpeed) * Math.min(massFactor, 1.2) * Math.max(this.enginePower, 0.2);

        let targetMove = 0, targetStrafe = 0, targetTurn = 0, targetAltitude = 0;

        const key8 = keys['Digit8'] || keys['Numpad8'] || keys['ArrowUp'];
        const key5 = keys['Digit5'] || keys['Numpad5'] || keys['ArrowDown'];
        const key4 = keys['Digit4'] || keys['Numpad4'] || keys['ArrowLeft'];
        const key6 = keys['Digit6'] || keys['Numpad6'] || keys['ArrowRight'];
        const key7 = keys['Digit7'] || keys['Numpad7'];
        const key9 = keys['Digit9'] || keys['Numpad9'];

        if (key4) targetTurn += activeTurnSpeed;
        if (key6) targetTurn -= activeTurnSpeed;

        if (this.enginePower >= 0.99) {
            if (key8) targetMove -= activeSpeedLimit;
            if (key5) targetMove += activeSpeedLimit;
            if (key7) targetStrafe += activeSpeedLimit; 
            if (key9) targetStrafe -= activeSpeedLimit; 
            if (keys['ShiftLeft'] || keys['ShiftRight']) targetAltitude += (this.maxAltitudeSpeed * this.enginePower * activeLiftMultiplier) * massFactor;
            if (keys['ControlLeft'] || keys['ControlRight']) targetAltitude -= (this.maxAltitudeSpeed * this.enginePower * activeLiftMultiplier) * massFactor;
        } else if (!isOnGround) {
            const sinkRate = 5.5 * massFactor;
            targetAltitude -= sinkRate;
            targetMove -= sinkRate * 4.0;
        } else {
            if (key8) targetMove -= activeSpeedLimit;
            if (key5) targetMove += activeSpeedLimit;
            if (key7) targetStrafe += activeSpeedLimit; 
            if (key9) targetStrafe -= activeSpeedLimit; 
            if (keys['ControlLeft'] || keys['ControlRight']) {
                targetAltitude -= (this.maxAltitudeSpeed * this.enginePower * activeLiftMultiplier) * massFactor;
            }
        }

        this.currentMoveSpeed += (targetMove - this.currentMoveSpeed) * Math.min((isOnGround ? 2.0 : 0.8) * massFactor * delta, 1.0);
        this.currentStrafeSpeed += (targetStrafe - this.currentStrafeSpeed) * Math.min((isOnGround ? 2.0 : 0.8) * massFactor * delta, 1.0);
        this.currentTurnSpeed += (targetTurn - this.currentTurnSpeed) * Math.min(2.0 * delta, 1.0);
        this.currentAltitudeSpeed += (targetAltitude - this.currentAltitudeSpeed) * Math.min(3.5 * massFactor * delta, 1.0);

        const prevPosition = this.model.position.clone();

        if (Math.abs(this.currentMoveSpeed) > 0.001) this.model.translateX(this.currentMoveSpeed * delta);
        if (Math.abs(this.currentStrafeSpeed) > 0.001) this.model.translateZ(this.currentStrafeSpeed * delta);
        if (Math.abs(this.currentTurnSpeed) > 0.001) this.model.rotation.y += this.currentTurnSpeed * delta;

        if (weatherData && weatherData.wind && !isOnGround) {
            const windImpactFactor = (this.baselineMassKg / currentMass) * delta;
            this.model.position.x += weatherData.wind.x * windImpactFactor * 3.0;
            this.model.position.z += weatherData.wind.z * windImpactFactor * 3.0;
        }

        let newY = this.model.position.y + (this.currentAltitudeSpeed * delta);
        if (activeGroundLevel > 0 && newY <= activeGroundLevel) {
            newY = activeGroundLevel;
            this.currentAltitudeSpeed = 0;
        }

        const maxCeilingMeters = this.maxCeilingFeet / 3.28084;
        if (newY >= maxCeilingMeters) {
            newY = maxCeilingMeters;
            this.currentAltitudeSpeed = 0.0;
        }

        this.model.position.y = newY;

        if (this.checkCollisions(windFarm, mainBase)) {
            this.model.position.copy(prevPosition); 
            this.isPermanentlyDamaged = true;
            this.hasCrashedIntoStructure = true;
            this.isElectricalOn = false;
            this.isFuelPumpOn = false;
            this.targetEnginePower = 0.0;
            this.enginePower = 0.0;
            this.isEngineRunning = false;
            if (this.soundManager) this.soundManager.stopHelicopterEngine();
            if (this.onStructureCrash) this.onStructureCrash(this.model.position.clone());
            return;
        }

        this.wasOnGround = isOnGround;
    }
}