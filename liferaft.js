import * as THREE from 'three';

export class LiferaftManager {
    constructor(scene, loadingManager = null) {
        this.scene = scene;
        this.isDeployed = false;

        // Full-screen solid black crash overlay with message and restart button
        this.crashOverlay = document.createElement('div');
        this.crashOverlay.id = 'crash-overlay';
        this.crashOverlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: #000000;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            z-index: 20000;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.2s ease-in-out;
            font-family: monospace;
        `;

        const message = document.createElement('div');
        message.innerHTML = 'AIRCRAFT DESTROYED';
        message.style.cssText = `
            color: #ff3333;
            font-size: 48px;
            font-weight: bold;
            letter-spacing: 4px;
            margin-bottom: 24px;
            text-transform: uppercase;
            text-shadow: 0 0 25px rgba(255, 0, 0, 0.6);
            text-align: center;
        `;
        this.crashOverlay.appendChild(message);

        this.restartBtn = document.createElement('button');
        this.restartBtn.id = 'restart-flight-btn';
        this.restartBtn.innerHTML = 'RESTART FLIGHT';
        this.restartBtn.style.cssText = `
            background: rgba(17, 24, 39, 0.9);
            border: 2px solid rgba(255, 255, 255, 0.6);
            color: #ffffff;
            padding: 14px 32px;
            font-family: monospace;
            font-size: 18px;
            font-weight: bold;
            letter-spacing: 2px;
            text-transform: uppercase;
            border-radius: 4px;
            cursor: pointer;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.8);
            transition: background 0.2s, transform 0.2s, border-color 0.2s;
        `;

        this.restartBtn.addEventListener('mouseenter', () => {
            this.restartBtn.style.background = 'rgba(31, 41, 55, 1.0)';
            this.restartBtn.style.borderColor = 'rgba(255, 255, 255, 1.0)';
            this.restartBtn.style.transform = 'scale(1.05)';
        });

        this.restartBtn.addEventListener('mouseleave', () => {
            this.restartBtn.style.background = 'rgba(17, 24, 39, 0.9)';
            this.restartBtn.style.borderColor = 'rgba(255, 255, 255, 0.6)';
            this.restartBtn.style.transform = 'scale(1.0)';
        });

        this.restartBtn.addEventListener('click', () => {
            location.reload();
        });

        this.crashOverlay.appendChild(this.restartBtn);
        document.body.appendChild(this.crashOverlay);
    }

    deploy(crashPosition) {
        if (this.isDeployed) return;
        this.isDeployed = true;
        this.showRestart();
    }

    showRestart() {
        if (this.crashOverlay) {
            this.crashOverlay.style.opacity = '1';
            this.crashOverlay.style.pointerEvents = 'auto';
        }
    }

    update(delta) {
        // No liferaft model to animate or update anymore
    }
}