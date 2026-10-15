import * as THREE from 'three';

export class ShorelineFoamSystem {
    constructor(scene, mainBasePosition = new THREE.Vector3(0, 0, 0)) {
        this.scene = scene;
        this.centerPos = mainBasePosition.clone();
        
        // Hardcoded calibrated parameters
        this.sizeX = 30.0;
        this.sizeZ = 30.5;
        this.cornerRadius = 4.5;
        this.driftWidth = 1.0;
        this.offsetX = -9.0;
        this.offsetZ = -4.5;

        this.particlesCount = 2200;

        this.geometry = new THREE.BufferGeometry();
        this.positions = new Float32Array(this.particlesCount * 3);
        this.velocities = new Float32Array(this.particlesCount * 3);
        this.lifetimes = new Float32Array(this.particlesCount);

        for (let i = 0; i < this.particlesCount; i++) {
            this.positions[i * 3] = 0;
            this.positions[i * 3 + 1] = -5000;
            this.positions[i * 3 + 2] = 0;
            this.lifetimes[i] = 0;
        }

        this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));

        // Soft radial canvas texture for natural foam bubbles
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
        gradient.addColorStop(0.4, 'rgba(240, 248, 255, 0.4)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 64, 64);

        const texture = new THREE.CanvasTexture(canvas);

        this.material = new THREE.PointsMaterial({
            color: 0xffffff,
            size: 4.5,
            map: texture,
            transparent: true,
            blending: THREE.NormalBlending,
            depthWrite: false,
            opacity: 0.7
        });

        this.particleSystem = new THREE.Points(this.geometry, this.material);
        this.particleSystem.frustumCulled = false;
        this.scene.add(this.particleSystem);

        this.spawnIndex = 0;
    }

    getPathPoint(t) {
        const hw = (this.sizeX * 0.5);
        const hd = (this.sizeZ * 0.5);
        const r = Math.min(Math.max(0.1, this.cornerRadius), hw - 0.1, hd - 0.1);

        const straightX = (hw - r) * 2;
        const straightZ = (hd - r) * 2;
        const arcLen = (Math.PI * 0.5) * r;
        const totalPerimeter = (straightX * 2) + (straightZ * 2) + (arcLen * 4);

        let targetDist = t * totalPerimeter;

        if (targetDist <= straightX) {
            const localT = targetDist / straightX;
            return { pos: new THREE.Vector2(-hw + r + localT * straightX, -hd), normal: new THREE.Vector2(0, -1) };
        }
        targetDist -= straightX;

        if (targetDist <= arcLen) {
            const a = Math.PI * 1.5 + (targetDist / arcLen) * (Math.PI * 0.5);
            return { pos: new THREE.Vector2((hw - r) + Math.cos(a) * r, (-hd + r) + Math.sin(a) * r), normal: new THREE.Vector2(Math.cos(a), Math.sin(a)) };
        }
        targetDist -= arcLen;

        if (targetDist <= straightZ) {
            const localT = targetDist / straightZ;
            return { pos: new THREE.Vector2(hw, -hd + r + localT * straightZ), normal: new THREE.Vector2(1, 0) };
        }
        targetDist -= straightZ;

        if (targetDist <= arcLen) {
            const a = 0 + (targetDist / arcLen) * (Math.PI * 0.5);
            return { pos: new THREE.Vector2((hw - r) + Math.cos(a) * r, (hd - r) + Math.sin(a) * r), normal: new THREE.Vector2(Math.cos(a), Math.sin(a)) };
        }
        targetDist -= arcLen;

        if (targetDist <= straightX) {
            const localT = targetDist / straightX;
            return { pos: new THREE.Vector2(hw - r - localT * straightX, hd), normal: new THREE.Vector2(0, 1) };
        }
        targetDist -= straightX;

        if (targetDist <= arcLen) {
            const a = Math.PI * 0.5 + (targetDist / arcLen) * (Math.PI * 0.5);
            return { pos: new THREE.Vector2((-hw + r) + Math.cos(a) * r, (hd - r) + Math.sin(a) * r), normal: new THREE.Vector2(Math.cos(a), Math.sin(a)) };
        }
        targetDist -= arcLen;

        if (targetDist <= straightZ) {
            const localT = targetDist / straightZ;
            return { pos: new THREE.Vector2(-hw, hd - r - localT * straightZ), normal: new THREE.Vector2(-1, 0) };
        }
        targetDist -= straightZ;

        const a = Math.PI + (Math.min(targetDist, arcLen) / arcLen) * (Math.PI * 0.5);
        return { pos: new THREE.Vector2((-hw + r) + Math.cos(a) * r, (-hd + r) + Math.sin(a) * r), normal: new THREE.Vector2(Math.cos(a), Math.sin(a)) };
    }

    update(delta, elapsedTime, weatherData = null) {
        const positions = this.geometry.attributes.position.array;
        const waterLevel = -1.88;

        if (weatherData && this.material) {
            this.material.opacity = weatherData.isNight ? 0.25 : 0.7;
        }

        const effectiveCenterX = this.centerPos.x + this.offsetX;
        const effectiveCenterZ = this.centerPos.z + this.offsetZ;

        // Update active particles
        for (let i = 0; i < this.particlesCount; i++) {
            const idx = i * 3;
            if (this.lifetimes[i] > 0) {
                positions[idx] += this.velocities[idx] * delta;
                positions[idx + 2] += this.velocities[idx + 2] * delta;

                this.velocities[idx] *= 0.91;
                this.velocities[idx + 2] *= 0.91;
                positions[idx + 1] = waterLevel + Math.sin(elapsedTime * 3.0 + i) * 0.06;

                this.lifetimes[i] -= delta;
                if (this.lifetimes[i] <= 0) {
                    positions[idx + 1] = -5000;
                    this.lifetimes[i] = 0;
                }
            }
        }

        // Emit along the perimeter with irregular wave displacement
        const spawnBatch = 15;
        for (let s = 0; s < spawnBatch; s++) {
            const i = this.spawnIndex;
            const idx = i * 3;

            const t = Math.random();
            const { pos, normal } = this.getPathPoint(t);

            // Multi-frequency wave perturbation to break up straight box edges into natural jagged waves
            const waveDeformation = Math.sin(t * Math.PI * 14 + elapsedTime * 1.5) * 2.2 +
                                   Math.cos(t * Math.PI * 28 - elapsedTime * 1.0) * 1.1;
            const scatter = (Math.random() - 0.5) * 1.2;
            const totalOffset = waveDeformation + scatter;

            positions[idx] = effectiveCenterX + pos.x + normal.x * totalOffset;
            positions[idx + 1] = waterLevel;
            positions[idx + 2] = effectiveCenterZ + pos.y + normal.y * totalOffset;

            const driftSpeed = 0.8 + Math.random() * 1.2;
            this.velocities[idx] = normal.x * driftSpeed + (Math.random() - 0.5) * 0.3;
            this.velocities[idx + 2] = normal.y * driftSpeed + (Math.random() - 0.5) * 0.3;

            this.lifetimes[i] = 1.0 + Math.random() * 1.0;
            this.spawnIndex = (this.spawnIndex + 1) % this.particlesCount;
        }

        this.geometry.attributes.position.needsUpdate = true;
    }
}