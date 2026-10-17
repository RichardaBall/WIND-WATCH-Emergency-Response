import * as THREE from 'three';

export const GAME_CONFIG = {
    world: {
        spawnPosition: new THREE.Vector3(3.3690, 4.996, 0.4548),
        helipadAltitude: 5.336,
        seaLevel: 0.0,
        maxCeilingFeet: 400.0
    },
    navFrequencies: {
        base: 210.0,
        wtg1: 350.0,
        wtg2: 240.0,
        wtg3: 290.0,
        rescueDefault: 270.0,
        fishermanDefault: 310.0
    },
    lighting: {
        helipad: {
            offsetX: -3.25,
            offsetZ: -0.4,
            radius: 5.9,
            cornerRadius: 12.4,
            height: 4.85,
            intensity: 1.5,
            cornerIntensity: 1.5,
            floodIntensity: 2.5
        },
        towers: [
            { x: -19.78, y: 24.37, z: 5.57 },
            { x: -14.81, y: 24.37, z: 8.74 }
        ],
        floodlights: [
            { x: -15.28, y: 8.11, z: -0.76, rotX: 0.01, rotY: 0, showMesh: true },
            { x: -10.78, y: 7.97, z: -11.92, rotX: 0.65, rotY: 0, showMesh: true },
            { x: -5.22, y: 8.23, z: -14.81, rotX: 0.06, rotY: 1.55, showMesh: true },
            { x: 1.64, y: 13.16, z: -10.99, rotX: 1.04, rotY: -0.64, showMesh: false },
            { x: -14.89, y: 11.17, z: 2.98, rotX: 1.07, rotY: 0, showMesh: false }
        ]
    },
    winch: {
        offset: new THREE.Vector3(-2.4, 2.8, -1.55),
        maxOperatingSpeed: 25.0,
        cableSpeed: 12.0,
        maxCableLength: 30.0
    },
    missions: {
        cooldownDuration: 10.0,
        initialDelay: 5.0
    }
};