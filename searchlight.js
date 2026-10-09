import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

export class SearchLightSystem {
    constructor(helicopterModel, scene) {
        this.helicopterModel = helicopterModel;
        this.scene = scene;

        // Narrow beam angle (Math.PI / 36) and sharp penumbra (0.1) for a focused searchlight beam
        // Increased max light distance to 500.0 to guarantee sea-level illumination from hover altitude
        this.spotLight = new THREE.SpotLight(0xffffee, 0.0, 500.0, Math.PI / 36, 0.1, 1.0);
        this.spotLight.position.set(0.0, -0.9, 0.8); 
        this.helicopterModel.add(this.spotLight);

        // Target object placed in the main scene so the spotlight can look at it independently
        this.targetObject = new THREE.Object3D();
        this.scene.add(this.targetObject);
        this.spotLight.target = this.targetObject;

        this._tempVector = new THREE.Vector3();
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

        // 3. Gather target objects to illuminate
        const targets = [];
        
        // Helper to extract world position cleanly
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

        // Primary: Rescue Mission (Uses dynamic getActiveTargetPosition method & raftMesh)
        if (rescueMission) {
            if (typeof rescueMission.getActiveTargetPosition === 'function') {
                const targetPos = rescueMission.getActiveTargetPosition(new THREE.Vector3());
                targets.push({ pos: targetPos, name: 'RescueMission_ActiveTarget' });
            } else if (rescueMission.raftMesh && rescueMission.raftMesh.visible) {
                addTargetObj(rescueMission.raftMesh, 'RescueMission_RaftMesh');
            } else if (rescueMission.raftPosition) {
                targets.push({ pos: rescueMission.raftPosition.clone(), name: 'RescueMission_RaftPos' });
            }
        }

        // Main base helipad reference
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

        // Liferaft Manager fallback
        if (liferaftManager) {
            if (Array.isArray(liferaftManager.rafts)) {
                liferaftManager.rafts.forEach((raft, idx) => addTargetObj(raft.mesh || raft.group || raft, `Liferaft_${idx}`));
            }
            if (liferaftManager.raft) addTargetObj(liferaftManager.raft.mesh || liferaftManager.raft, 'Liferaft_Single');
        }

        // Universal Scene Traversal Fallback
        if (targets.length === 0 && this.scene) {
            this.scene.traverse((child) => {
                if (child && child.visible && child.name) {
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

        // 4. Set activation range (350m so searchlight locks on well before getting right over the raft)
        const activationRange = isStormy ? 200.0 : 350.0;

        let nearestTarget = null;
        let minDistance = Infinity;
        const heliPos = new THREE.Vector3();
        this.helicopterModel.getWorldPosition(heliPos);

        for (let i = 0; i < targets.length; i++) {
            const dist = heliPos.distanceTo(targets[i].pos);
            if (dist < minDistance) {
                minDistance = dist;
                nearestTarget = targets[i].pos;
            }
        }

        // 5. Lock onto target or turn off if out of range
        if (nearestTarget !== null && minDistance <= activationRange) {
            this.spotLight.intensity = isStormy ? 300.0 : 220.0;
            this.targetObject.position.copy(nearestTarget);
            this.targetObject.updateMatrixWorld(true);
        } else {
            this.spotLight.intensity = 0.0;
        }
    }
}