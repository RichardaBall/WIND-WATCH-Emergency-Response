import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

export class SearchLightSystem {
    constructor(helicopterModel, scene) {
        this.helicopterModel = helicopterModel;
        this.scene = scene;

        // Narrow beam angle (Math.PI / 36) and sharp penumbra (0.1) for a cylinder-like searchlight beam
        this.spotLight = new THREE.SpotLight(0xffffee, 0.0, 180.0, Math.PI / 36, 0.1, 1.0);
        this.spotLight.position.set(0.0, -0.9, 0.8); 
        this.helicopterModel.add(this.spotLight);

        // Target object placed in the main scene so the spotlight can look at it independently
        this.targetObject = new THREE.Object3D();
        this.scene.add(this.targetObject);
        this.spotLight.target = this.targetObject;
    }

    update(delta, player, weatherData, mainBase = null, windFarm = null, liferaftManager = null, rescueMission = null) {
        // 1. Check if electrical system and engine are running
        if (!player || !player.isElectricalOn || !player.isEngineRunning) {
            this.spotLight.intensity = 0.0;
            return;
        }

        // 2. Robust Daytime / Nighttime & Storm Detection
        let isNight = false;
        let isDay = true;
        let isStormy = false;
        let fogDensity = 0.0;

        if (weatherData) {
            if (weatherData.isNight !== undefined) {
                isNight = weatherData.isNight;
            }
            if (weatherData.isDay !== undefined) {
                isDay = weatherData.isDay;
            } else {
                isDay = !isNight;
            }

            if (weatherData.timeOfDay) {
                const tod = weatherData.timeOfDay.toLowerCase();
                if (tod.includes('night') || tod.includes('dusk') || tod.includes('dawn') || tod.includes('evening') || tod.includes('dark')) {
                    isNight = true;
                    isDay = false;
                } else if (tod.includes('day') || tod.includes('morning') || tod.includes('afternoon') || tod.includes('noon')) {
                    isDay = true;
                    isNight = false;
                }
            }

            if (weatherData.fogDensity !== undefined) {
                fogDensity = weatherData.fogDensity;
            }
            if (weatherData.weatherType) {
                const wt = weatherData.weatherType.toLowerCase();
                if (wt.includes('storm') || wt.includes('rain') || wt.includes('fog') || wt.includes('blizzard')) {
                    isStormy = true;
                }
            }
            if ((weatherData.rain && weatherData.rain > 0.2) || fogDensity > 0.003) {
                isStormy = true;
            }
        }

        // Do not shine in the daytime (unless it is explicitly night/dusk/dawn)
        if (isDay && !isNight) {
            this.spotLight.intensity = 0.0;
            return;
        }

        // 3. Gather target objects to illuminate with precise references
        const targets = [];
        
        // Main base helipad reference (checking helipadCenter, helper method, or model)
        if (mainBase) {
            if (mainBase.helipadCenter instanceof THREE.Vector3) {
                targets.push({ pos: mainBase.helipadCenter.clone().add(new THREE.Vector3(0, 2, 0)), name: 'MainBase_Center' });
            } else if (typeof mainBase.getHelipadCenter === 'function') {
                const center = mainBase.getHelipadCenter();
                if (center instanceof THREE.Vector3) {
                    targets.push({ pos: center.clone().add(new THREE.Vector3(0, 2, 0)), name: 'MainBase_Method' });
                }
            } else if (mainBase.model) {
                const basePos = new THREE.Vector3();
                mainBase.model.getWorldPosition(basePos);
                targets.push({ pos: basePos.add(new THREE.Vector3(0, 5, 0)), name: 'MainBase_Model' });
            }
        }

        // Wind farm turbines
        if (windFarm && windFarm.turbines) {
            windFarm.turbines.forEach((turbine, idx) => {
                if (turbine.group) {
                    const tPos = new THREE.Vector3();
                    turbine.group.getWorldPosition(tPos);
                    tPos.y += 15; // Target nacelle height
                    targets.push({ pos: tPos, name: `WTG_${idx}` });
                }
            });
        }

        // Safe helper to extract position from any object format
        const addTargetObj = (obj, name) => {
            if (!obj) return;
            const pos = new THREE.Vector3();
            if (typeof obj.getWorldPosition === 'function') {
                obj.getWorldPosition(pos);
            } else if (obj.position instanceof THREE.Vector3) {
                pos.copy(obj.position);
            } else {
                return;
            }
            targets.push({ pos: pos, name: name });
        };

        // Explicit manager checks
        if (liferaftManager) {
            if (Array.isArray(liferaftManager.rafts)) {
                liferaftManager.rafts.forEach((raft, idx) => addTargetObj(raft.mesh || raft.group || raft, `Liferaft_${idx}`));
            }
            if (liferaftManager.raft) addTargetObj(liferaftManager.raft.mesh || liferaftManager.raft, 'Liferaft_Single');
        }

        if (rescueMission) {
            if (Array.isArray(rescueMission.rafts)) {
                rescueMission.rafts.forEach((raft, idx) => addTargetObj(raft.mesh || raft.group || raft, `RescueRaft_${idx}`));
            }
            if (rescueMission.raft) addTargetObj(rescueMission.raft.mesh || rescueMission.raft, 'RescueRaft_Single');
            if (rescueMission.target) addTargetObj(rescueMission.target, 'RescueMission_Target');
        }

        // Universal Scene Traversal Fallback
        if (this.scene) {
            this.scene.traverse((child) => {
                if (child && child.name) {
                    const lname = child.name.toLowerCase();
                    if (lname.includes('raft') || lname.includes('survivor') || lname.includes('target') || lname.includes('dinghy')) {
                        const p = new THREE.Vector3();
                        child.getWorldPosition(p);
                        const exists = targets.some(t => t.pos.distanceTo(p) < 2.0);
                        if (!exists) {
                            targets.push({ pos: p, name: `Scene_${child.name}` });
                        }
                    }
                }
            });
        }

        // 4. Adapt activation range for storms (shorten to 80m so it doesn't lock onto fog-obscured targets)
        const activationRange = isStormy ? 80.0 : 250.0;

        let nearestTarget = null;
        let minDistance = Infinity;
        const heliPos = this.helicopterModel.position;

        for (let i = 0; i < targets.length; i++) {
            const dist = heliPos.distanceTo(targets[i].pos);
            if (dist < minDistance) {
                minDistance = dist;
                nearestTarget = targets[i].pos;
            }
        }

        // 5. Lock onto target or turn off if out of range
        if (nearestTarget !== null && minDistance <= activationRange) {
            // Boost intensity in storms to punch through fog at closer range
            this.spotLight.intensity = isStormy ? 260.0 : 180.0;
            this.targetObject.position.copy(nearestTarget);
        } else {
            this.spotLight.intensity = 0.0;
        }
    }
}