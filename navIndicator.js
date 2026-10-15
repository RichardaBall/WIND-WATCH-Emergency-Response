/**
 * navIndicator.js
 * 3D Tactical NDB Bearing Indicator visible only when nav radio is powered ON and a valid frequency is tuned.
 */
import * as THREE from 'three';

export class NavIndicator {
    constructor(player, navRadioInstance, helicopterMesh, config = { x: -1.60, y: 3.95, z: 0.10, ringOD: 0.75, arrowLength: 0.6 }) {
        this.player = player;
        this.navRadio = navRadioInstance;
        this.helicopterMesh = helicopterMesh;

        this.offsetX = config.x !== undefined ? config.x : -1.60;
        this.offsetY = config.y !== undefined ? config.y : 3.95;
        this.offsetZ = config.z !== undefined ? config.z : 0.10;
        this.ringOD = config.ringOD !== undefined ? config.ringOD : 0.75;
        this.arrowLength = config.arrowLength !== undefined ? config.arrowLength : 0.6;

        // Customization options (High contrast & pulse enabled by default per preference)
        this.showCompassRing = false;
        this.neonGlowBoost = true;
        this.signalPulse = true;
        this.pulseSpeed = 0.01;       
        this.arrowScale = 2.0;
        this.arrowColorHex = 0xffea00; // Default neon bright yellow/amber

        this._pulseTime = 0;

        this.pointerMaterial = new THREE.MeshBasicMaterial({
            color: this.arrowColorHex,
            side: THREE.DoubleSide
        });

        this.createMesh();
    }

    createMesh() {
        if (this.mesh && this.helicopterMesh) {
            this.helicopterMesh.remove(this.mesh);
        }

        this.mesh = new THREE.Group();

        // Optional translucent compass ring / dial face
        if (this.showCompassRing) {
            const ringRadius = Math.max(0.1, this.ringOD / 2);
            const ringGeo = new THREE.RingGeometry(ringRadius * 0.85, ringRadius, 32);
            ringGeo.rotateX(-Math.PI / 2);
            const ringMat = new THREE.MeshBasicMaterial({
                color: 0xffb703,
                transparent: true,
                opacity: 0.35,
                side: THREE.DoubleSide
            });
            const ringMesh = new THREE.Mesh(ringGeo, ringMat);
            this.mesh.add(ringMesh);
        }

        this.pointerGroup = new THREE.Group();
        const outerRadius = Math.max(0.05, this.ringOD / 2);
        const tipWidth = Math.min(0.08, outerRadius * 0.4);
        const tipGeo = new THREE.ConeGeometry(tipWidth, tipWidth * 2.5, 12);
        tipGeo.rotateX(Math.PI / 2);

        // Update material color based on settings
        if (this.neonGlowBoost) {
            this.pointerMaterial.color.setHex(this.arrowColorHex);
        } else {
            this.pointerMaterial.color.setHex(this.arrowColorHex);
        }

        const tipMesh = new THREE.Mesh(tipGeo, this.pointerMaterial);
        tipMesh.position.set(0, 0, this.arrowLength);
        this.pointerGroup.add(tipMesh);
        
        // Apply overall arrow scale
        this.pointerGroup.scale.set(this.arrowScale, this.arrowScale, this.arrowScale);

        this.mesh.add(this.pointerGroup);
        this.mesh.position.set(this.offsetX, this.offsetY, this.offsetZ);
        this.mesh.visible = false;

        if (this.helicopterMesh) {
            this.helicopterMesh.add(this.mesh);
        }
    }

    rebuildGeometry() {
        this.createMesh();
    }

    update() {
        if (!this.player || !this.helicopterMesh || !this.mesh || !this.navRadio) return;

        // Check power state, tuned state, and target position
        const isPowered = typeof this.navRadio.isPowered === 'function' ? this.navRadio.isPowered() : (this.navRadio.powered === true);
        const isTuned = typeof this.navRadio.isTuned === 'function' ? this.navRadio.isTuned() : true;
        const targetPos = typeof this.navRadio.getTargetPosition === 'function' ? this.navRadio.getTargetPosition() : null;

        const shouldShow = isPowered && isTuned && targetPos !== null;
        this.mesh.visible = shouldShow;
        if (!shouldShow) return;

        this.helicopterMesh.updateMatrixWorld(true);
        const worldPos = this.mesh.getWorldPosition(new THREE.Vector3());

        const dx = targetPos.x - worldPos.x;
        const dz = targetPos.z - worldPos.z;
        const targetWorldAngle = Math.atan2(dx, dz);

        const q = new THREE.Quaternion();
        this.helicopterMesh.getWorldQuaternion(q);
        const euler = new THREE.Euler().setFromQuaternion(q, 'YXZ');
        const heliHeading = euler.y;

        if (this.pointerGroup) {
            this.pointerGroup.rotation.y = targetWorldAngle - heliHeading;

            // Signal lock pulse animation using dynamic pulseSpeed
            if (this.signalPulse) {
                this._pulseTime += this.pulseSpeed;
                const pulseFactor = 1.0 + Math.sin(this._pulseTime * 4) * 0.12;
                const combinedScale = this.arrowScale * pulseFactor;
                this.pointerGroup.scale.set(combinedScale, combinedScale, combinedScale);
            } else {
                this.pointerGroup.scale.set(this.arrowScale, this.arrowScale, this.arrowScale);
            }
        }
    }
}