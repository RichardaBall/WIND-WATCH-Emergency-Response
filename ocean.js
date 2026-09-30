import * as THREE from 'three';
import { Water } from 'three/addons/objects/Water.js';

export function createOcean(scene, sunLight) {
    // --- Ocean Tweaking Parameters ---
    const config = {
        size: 2000,
        textureWidth: 512,
        textureHeight: 512,
        waterNormalsUrl: 'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/waternormals.jpg',
        normalRepeat: 20,
        sunColor: 0x88ccff,
        waterColor: 0x0044bb,
        distortionScale: 3.7,
        positionY: -2.0
    };

    const waterGeometry = new THREE.PlaneGeometry(config.size, config.size);
    
    const waterNormals = new THREE.TextureLoader().load(config.waterNormalsUrl, (texture) => {
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(config.normalRepeat, config.normalRepeat);
    });

    const water = new Water(waterGeometry, {
        textureWidth: config.textureWidth,
        textureHeight: config.textureHeight,
            waterNormals: waterNormals,
        sunDirection: sunLight ? sunLight.position.clone().normalize() : new THREE.Vector3(0, 1, 0).normalize(),
        sunColor: config.sunColor,
        waterColor: config.waterColor,
        distortionScale: config.distortionScale,
        fog: scene.fog !== undefined
    });

    water.rotation.x = -Math.PI / 2;
    water.position.y = config.positionY;
    scene.add(water);

    return water;
}