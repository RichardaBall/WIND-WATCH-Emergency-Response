import * as THREE from 'three';

export class SirenSystem {
    constructor(scene, oilRigGroup) {
        this.scene = scene;
        this.oilRigGroup = oilRigGroup;
        this.sirens = [];

        // Final tuned position and rotation coordinates
        const position = new THREE.Vector3(-6.50, 11.40, -15.00);
        const rotation = new THREE.Vector3(0, 0.26, 0);

        this.initSiren(position, rotation);
    }

    initSiren(position, rotation) {
        this.sirenGroup = new THREE.Group();
        this.sirenGroup.position.copy(position);
        this.sirenGroup.rotation.set(rotation.x, rotation.y, rotation.z);

        // Scaled down by half (50%)
        this.sirenGroup.scale.set(0.5, 0.5, 0.5);

        // --- 1. Realistic Industrial Base Housing ---
        const baseGeo = new THREE.CylinderGeometry(0.65, 0.7, 0.4, 32);
        const baseMat = new THREE.MeshStandardMaterial({ 
            color: 0x1a1a1a, 
            metalness: 0.2, 
            roughness: 0.6 
        });
        this.baseMesh = new THREE.Mesh(baseGeo, baseMat);
        this.baseMesh.position.set(0, 0.2, 0);
        this.sirenGroup.add(this.baseMesh);

        const rimGeo = new THREE.CylinderGeometry(0.72, 0.72, 0.08, 32);
        const rimMesh = new THREE.Mesh(rimGeo, baseMat);
        rimMesh.position.set(0, 0.04, 0);
        this.sirenGroup.add(rimMesh);

        // --- 2. Internal Rotating Mechanism (Bracket, Bulb, & Reflector Mirror) ---
        this.internalMechanism = new THREE.Group();
        this.internalMechanism.position.set(0, 0.4, 0);
        this.sirenGroup.add(this.internalMechanism);

        // U-shaped internal support bracket
        const bracketGeo = new THREE.BoxGeometry(0.1, 0.9, 0.6);
        const bracketMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.8, roughness: 0.3 });
        const leftBracket = new THREE.Mesh(bracketGeo, bracketMat);
        leftBracket.position.set(-0.25, 0.45, 0);
        this.internalMechanism.add(leftBracket);

        const topBracketGeo = new THREE.BoxGeometry(0.6, 0.1, 0.6);
        const topBracket = new THREE.Mesh(topBracketGeo, bracketMat);
        topBracket.position.set(0, 0.85, 0);
        this.internalMechanism.add(topBracket);

        // Central Lamp Bulb
        const bulbGeo = new THREE.SphereGeometry(0.18, 16, 16);
        const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffeedd });
        this.bulbMesh = new THREE.Mesh(bulbGeo, bulbMat);
        this.bulbMesh.position.set(0, 0.5, 0);
        this.internalMechanism.add(this.bulbMesh);

        // Parabolic Reflector Wing / Mirror
        const reflectorGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.7, 16, 1, true, 0, Math.PI);
        const reflectorMat = new THREE.MeshStandardMaterial({ 
            color: 0xffffff, 
            metalness: 0.95, 
            roughness: 0.1, 
            side: THREE.DoubleSide 
        });
        this.reflectorMesh = new THREE.Mesh(reflectorGeo, reflectorMat);
        this.reflectorMesh.position.set(0, 0.5, -0.15);
        this.reflectorMesh.rotation.y = Math.PI / 2;
        this.internalMechanism.add(this.reflectorMesh);

        // --- 3. Spotlight Setup (Helicopter Landing Light Style Beam) ---
        this.spotLight = new THREE.SpotLight(0xff2222, 0.0, 50, Math.PI / 5, 0.3, 1);
        this.spotLight.position.set(0, 0.9, 0);
        this.spotLight.castShadow = false;

        const spotTarget = new THREE.Object3D();
        spotTarget.position.set(0, 0.9, -10);
        this.internalMechanism.add(spotTarget);
        this.spotLight.target = spotTarget;
        this.sirenGroup.add(this.spotLight);

        // --- 4. High-Fidelity Translucent Red Glass / Acrylic Dome Shell ---
        const domeGeo = new THREE.CylinderGeometry(0.52, 0.64, 1.1, 32, 1, true);
        const domeTopGeo = new THREE.SphereGeometry(0.52, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
        
        const domeMat = new THREE.MeshPhysicalMaterial({
            color: 0xff0000,
            emissive: 0x330000,
            transparent: true,
            opacity: 0.82,
            roughness: 0.08,
            metalness: 0.05,
            ior: 1.52,
            transmission: 0.85,
            thickness: 0.6,
            side: THREE.DoubleSide,
            depthWrite: false
        });

        this.domeMesh = new THREE.Mesh(domeGeo, domeMat);
        this.domeMesh.position.set(0, 0.75, 0);
        this.sirenGroup.add(this.domeMesh);

        const domeTopMesh = new THREE.Mesh(domeTopGeo, domeMat);
        domeTopMesh.position.set(0, 1.3, 0);
        this.sirenGroup.add(domeTopMesh);

        // Attach to Oil Rig mainbase model if available, otherwise fallback to scene
        if (this.oilRigGroup) {
            this.oilRigGroup.add(this.sirenGroup);
        } else {
            this.scene.add(this.sirenGroup);
        }

        this.sirens.push({
            group: this.sirenGroup,
            spotLight: this.spotLight,
            mechanism: this.internalMechanism
        });
    }

    update(delta, windFarm) {
        // Check window.missionManager, rescueMission state, windfarm fire index, or visible pager panels
        const missionMgrActive = window.missionManager && window.missionManager.activeMissionType !== null;
        const rescueActive = window.rescueMission && ['ACTIVE', 'ON_SCENE', 'WINCHING', 'RETURNING'].includes(window.rescueMission.state);
        const wtgFireActive = windFarm && windFarm.activeFireIndex !== -1;
        
        const pagerPanel = document.getElementById('rescue-pager-panel');
        const pagerVisible = pagerPanel && window.getComputedStyle(pagerPanel).display !== 'none';

        const emergencyActive = missionMgrActive || rescueActive || wtgFireActive || pagerVisible;

        this.sirens.forEach(siren => {
            if (emergencyActive) {
                if (siren.mechanism) {
                    siren.mechanism.rotation.y += delta * 12.0;
                }

                const time = Date.now() * 0.009;
                const flash = Math.sin(time * 14.0) > 0 ? 1.0 : 0.2;
                siren.spotLight.intensity = 25.0 * flash;
            } else {
                siren.spotLight.intensity = 0.0;
            }
        });
    }
}