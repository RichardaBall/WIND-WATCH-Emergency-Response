// --- File: waterSystem.js ---
import * as THREE from 'three';

export class WaterSystem {
    constructor(scene) {
        this.scene = scene;
        this.particlesCount = 6000; // Increased density for a rich, volumetric drop
        this.splashCount = 3000;    // Enhanced splash count for surface impact

        // --- Falling Shower Stream Setup ---
        this.particleGeometry = new THREE.BufferGeometry();
        this.positions = new Float32Array(this.particlesCount * 3);
        this.velocities = new Float32Array(this.particlesCount * 3);
        this.lifetimes = new Float32Array(this.particlesCount);
        this.sizes = new Float32Array(this.particlesCount);

        for (let i = 0; i < this.particlesCount; i++) {
            this.positions[i * 3] = 0;
            this.positions[i * 3 + 1] = -5000; 
            this.positions[i * 3 + 2] = 0;
            this.lifetimes[i] = 0;
            this.sizes[i] = 1.0;
        }

        this.particleGeometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
        this.particleGeometry.setAttribute('size', new THREE.BufferAttribute(this.sizes, 1));

        // --- Surface Impact Splash Setup ---
        this.splashGeometry = new THREE.BufferGeometry();
        this.splashPositions = new Float32Array(this.splashCount * 3);
        this.splashVelocities = new Float32Array(this.splashCount * 3);
        this.splashLifetimes = new Float32Array(this.splashCount);

        for (let i = 0; i < this.splashCount; i++) {
            this.splashPositions[i * 3] = 0;
            this.splashPositions[i * 3 + 1] = -5000;
            this.splashPositions[i * 3 + 2] = 0;
            this.splashLifetimes[i] = 0;
        }

        this.splashGeometry.setAttribute('position', new THREE.BufferAttribute(this.splashPositions, 3));

        // Soft feathered radial texture tuned for realistic aerated water/foam spray visuals
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        gradient.addColorStop(0, 'rgba(235, 245, 255, 0.85)');
        gradient.addColorStop(0.3, 'rgba(200, 225, 245, 0.45)');
        gradient.addColorStop(0.7, 'rgba(175, 210, 240, 0.15)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 64, 64);

        const texture = new THREE.CanvasTexture(canvas);

        // Water droplet material (volumetric, soft, aerated spray look)
        this.particleMaterial = new THREE.PointsMaterial({
            color: 0xffffff,
            size: 7.0,
            map: texture,
            transparent: true,
            blending: THREE.NormalBlending,
            depthWrite: false,
            opacity: 0.55
        });

        this.particleSystem = new THREE.Points(this.particleGeometry, this.particleMaterial);
        this.particleSystem.frustumCulled = false;
        this.scene.add(this.particleSystem);

        // Surface splash mist material
        this.splashMaterial = new THREE.PointsMaterial({
            color: 0xffffff,
            size: 8.0,
            map: texture,
            transparent: true,
            blending: THREE.NormalBlending,
            depthWrite: false,
            opacity: 0.6
        });

        this.splashSystem = new THREE.Points(this.splashGeometry, this.splashMaterial);
        this.splashSystem.frustumCulled = false;
        this.scene.add(this.splashSystem);
        
        this.spawnIndex = 0;
        this.splashSpawnIndex = 0;
    }

    // Triggers scattered surface splashes when shower drops hit the water
    triggerSplash(x, z, count = 1) {
        const waterLevel = -2.0;
        const splashPos = this.splashGeometry.attributes.position.array;

        for (let s = 0; s < count; s++) {
            const i = this.splashSpawnIndex;
            const idx = i * 3;

            const angle = Math.random() * Math.PI * 2;
            const radius = Math.random() * 4.5;

            splashPos[idx] = x + Math.cos(angle) * radius;
            splashPos[idx + 1] = waterLevel + 0.1;
            splashPos[idx + 2] = z + Math.sin(angle) * radius;

            const outwardSpeed = 4.0 + Math.random() * 7.0;
            this.splashVelocities[idx] = Math.cos(angle) * outwardSpeed;
            this.splashVelocities[idx + 1] = 1.5 + Math.random() * 3.0; 
            this.splashVelocities[idx + 2] = Math.sin(angle) * outwardSpeed;

            this.splashLifetimes[i] = 0.9 + Math.random() * 0.7;
            this.splashSpawnIndex = (this.splashSpawnIndex + 1) % this.splashCount;
        }
    }

    update(delta, helicopterPlayer, isDispensing) {
        if (!helicopterPlayer || !helicopterPlayer.model) return false;

        const helicopterMesh = helicopterPlayer.model;
        const positions = this.particleGeometry.attributes.position.array;
        const splashPos = this.splashGeometry.attributes.position.array;
        
        const heliWorldPos = new THREE.Vector3();
        helicopterMesh.getWorldPosition(heliWorldPos);

        const spawnCenter = heliWorldPos.clone().add(new THREE.Vector3(0, -1.8, 0));
        const heliForward = new THREE.Vector3(0, 0, -1).applyQuaternion(helicopterMesh.quaternion);
        const waterLevel = -2.0; 

        // --- Update Falling Shower Particles ---
        for (let i = 0; i < this.particlesCount; i++) {
            const idx = i * 3;

            if (this.lifetimes[i] > 0) {
                positions[idx] += this.velocities[idx] * delta;
                positions[idx + 1] += this.velocities[idx + 1] * delta;
                positions[idx + 2] += this.velocities[idx + 2] * delta;

                // Air resistance / slipstream billow
                this.velocities[idx] *= 0.93;
                this.velocities[idx + 2] *= 0.93;
                this.velocities[idx + 1] -= 9.8 * delta; 
                this.lifetimes[i] -= delta;

                if (positions[idx + 1] <= waterLevel || this.lifetimes[i] <= 0) {
                    if (positions[idx + 1] <= waterLevel) {
                        this.triggerSplash(positions[idx], positions[idx + 2], 2);
                    }
                    positions[idx + 1] = -5000;
                    this.lifetimes[i] = 0;
                }
            }
        }

        // --- Update Surface Splash Particles ---
        for (let i = 0; i < this.splashCount; i++) {
            const idx = i * 3;
            if (this.splashLifetimes[i] > 0) {
                splashPos[idx] += this.splashVelocities[idx] * delta;
                splashPos[idx + 1] += this.splashVelocities[idx + 1] * delta;
                splashPos[idx + 2] += this.splashVelocities[idx + 2] * delta;

                this.splashVelocities[idx] *= 0.88;
                this.splashVelocities[idx + 2] *= 0.88;
                this.splashVelocities[idx + 1] -= 4.5 * delta; 

                this.splashLifetimes[i] -= delta;
                if (splashPos[idx + 1] <= waterLevel || this.splashLifetimes[i] <= 0) {
                    splashPos[idx + 1] = -5000;
                    this.splashLifetimes[i] = 0;
                }
            }
        }

        // --- Handle Water Tank Discharge (Realistic Firefighting Drop) ---
        let actuallyDispensing = false;
        
        // Check landing gear status from player.js (`isGearUp`: true = retracted/up, false = extended/down)
        // Water cannot be dispensed if landing gear is extended (!isGearUp)
        const gearExtended = helicopterPlayer.isGearUp !== undefined ? !helicopterPlayer.isGearUp : false;

        // Check winch system status: Water cannot be dispensed simultaneously while winch is lowered/operating
        const winch = helicopterPlayer.winchSystem || (helicopterPlayer.rescueMission ? helicopterPlayer.rescueMission.winchSystem : null);
        const winchActive = winch && winch.winchState !== 'UP';

        if (isDispensing && helicopterPlayer.waterTankKg > 0 && !gearExtended && !winchActive) {
            const dischargeRate = 350.0; 
            const dropAmount = dischargeRate * delta;
            helicopterPlayer.waterTankKg = Math.max(0, helicopterPlayer.waterTankKg - dropAmount);

            actuallyDispensing = true;
            
            // Rich batch spawning for volumetric aerated water/foam drop cascade
            const spawnBatch = 24; 
            for (let b = 0; b < spawnBatch; b++) {
                const i = this.spawnIndex;
                const idx = i * 3;

                // Spreading pattern under belly simulating helicopter belly tank dump
                const angle = Math.random() * Math.PI * 2;
                const radius = 0.2 + Math.random() * 2.2;

                positions[idx] = spawnCenter.x + Math.cos(angle) * radius;
                positions[idx + 1] = spawnCenter.y;
                positions[idx + 2] = spawnCenter.z + Math.sin(angle) * radius;

                // Aerodynamic slipstream sweep + downward burst
                const scatter = 2.0;
                this.velocities[idx] = (Math.random() - 0.5) * scatter - (heliForward.x * 5.0);
                this.velocities[idx + 1] = -8.0 - Math.random() * 5.0; 
                this.velocities[idx + 2] = (Math.random() - 0.5) * scatter - (heliForward.z * 5.0);

                this.lifetimes[i] = 3.5; 

                this.spawnIndex = (this.spawnIndex + 1) % this.particlesCount;
            }
        }

        this.particleGeometry.attributes.position.needsUpdate = true;
        this.splashGeometry.attributes.position.needsUpdate = true;
        return actuallyDispensing;
    }
}