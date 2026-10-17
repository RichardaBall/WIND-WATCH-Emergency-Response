import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

export class SearchLightSystem {
    constructor(helicopterModel, scene) {
        this.helicopterModel = helicopterModel;
        this.scene = scene;

        // SpotLight for illuminating 3D objects (heli, winch hook, main base, etc.)
        this.spotLight = new THREE.SpotLight(0xffffee, 0.0, 1000.0, Math.PI / 36, 0.1, 1.0);
        this.spotLight.position.set(0.0, -0.9, 0.8); 
        this.helicopterModel.add(this.spotLight);

        // Target object placed in the main scene so the spotlight looks at it independently
        this.targetObject = new THREE.Object3D();
        this.scene.add(this.targetObject);
        this.spotLight.target = this.targetObject;

        // Create a dedicated 10m diameter glowing circle mesh to accurately illuminate the sea surface
        const circleGeo = new THREE.CircleGeometry(5.0, 32); // 5m radius = 10m diameter
        circleGeo.rotateX(-Math.PI / 2); // Lay flat on the XZ plane
        const circleMat = new THREE.MeshBasicMaterial({
            color: 0x99ccff,
            transparent: true,
            opacity: 0.0,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        this.seaIlluminationMesh = new THREE.Mesh(circleGeo, circleMat);
        this.seaIlluminationMesh.position.y = 0.02; // Just above sea level to prevent z-fighting
        this.scene.add(this.seaIlluminationMesh);
    }

    update(delta, player, weatherData, mainBase = null, windFarm = null, liferaftManager = null, rescueMission = null) {
        // 1. Check if helicopter electrical system and engine are powered on
        if (!player || !player.isElectricalOn || !player.isEngineRunning) {
            this.spotLight.intensity = 0.0;
            this.seaIlluminationMesh.material.opacity = 0.0;
            return;
        }

        // 2. Check if it is currently night time (using weatherData or environment state)
        const isNight = weatherData && (weatherData.isNight || weatherData.nightFactor > 0.5 || weatherData.timeOfDay === 'night');
        if (!isNight) {
            this.spotLight.intensity = 0.0;
            this.seaIlluminationMesh.material.opacity = 0.0;
            return;
        }

        // 3. Locate the active winch system
        const winch = (player && player.winchSystem) || 
                      (rescueMission && rescueMission.winchSystem) || 
                      (window.rescueMission && window.rescueMission.winchSystem);

        // 4. Check if the winch is deployed
        const isWinchDeployed = winch && (
            winch.winchHeight > 0.05 || 
            (winch.winchState && !['RETRACTED', 'IDLE', 'UP'].includes(winch.winchState))
        );

        if (!isWinchDeployed) {
            this.spotLight.intensity = 0.0;
            this.seaIlluminationMesh.material.opacity = 0.0;
            return;
        }

        // 5. Get the winch hook world position
        let hookPos = null;
        if (winch) {
            if (typeof winch.getHookWorldPosition === 'function') {
                hookPos = winch.getHookWorldPosition();
            } else if (typeof winch.getHookPosition === 'function') {
                hookPos = winch.getHookPosition();
            }
        }

        if (!hookPos) {
            this.spotLight.intensity = 0.0;
            this.seaIlluminationMesh.material.opacity = 0.0;
            return;
        }

        // 6. Calculate target position at sea level directly under the hook line
        const targetPos = hookPos.clone();
        targetPos.y = 0.0;

        const spotWorldPos = new THREE.Vector3();
        this.spotLight.getWorldPosition(spotWorldPos);
        const distance = spotWorldPos.distanceTo(targetPos);
        const radius = 5.0; // Strict 10m diameter (5m radius)

        // Configure Spotlight angle, reduced intensity (150.0), and target
        this.spotLight.angle = Math.atan(radius / Math.max(1.0, distance));
        this.spotLight.intensity = 150.0;
        this.targetObject.position.copy(targetPos);
        this.targetObject.updateMatrixWorld(true);

        // Position and display the 10m sea illumination circle with reduced opacity (0.35)
        this.seaIlluminationMesh.position.set(targetPos.x, 0.02, targetPos.z);
        this.seaIlluminationMesh.material.opacity = 0.35;
    }
}