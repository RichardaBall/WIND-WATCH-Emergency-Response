/**
 * navRadio.js
 * NDB Navigation Radio with 10 kHz steps, original visuals, and scalable station registry.
 */
import * as THREE from 'three';

export class NavRadio {
    constructor(player, rigAlphaPosition, soundManager, buoySystem = null) {
        this.player = player;
        this.soundManager = soundManager;
        this.buoySystem = buoySystem;
        this.powered = true;
        window.navRadio = this;

        const basePos = rigAlphaPosition || new THREE.Vector3(0, 0, 0);

        // Calculate exact world coordinates matching windFarm.js circular layout
        const baseRadius = 750;
        const radiusIncrement = 180;
        const angleStep = (Math.PI * 2) / 3;

        const wtg1Pos = new THREE.Vector3(Math.cos(0 * angleStep) * baseRadius, 0, Math.sin(0 * angleStep) * baseRadius).add(basePos);
        const wtg2Pos = new THREE.Vector3(Math.cos(1 * angleStep) * (baseRadius + radiusIncrement), 0, Math.sin(1 * angleStep) * (baseRadius + radiusIncrement)).add(basePos);
        const wtg3Pos = new THREE.Vector3(Math.cos(2 * angleStep) * (baseRadius + (radiusIncrement * 2)), 0, Math.sin(2 * angleStep) * (baseRadius + (radiusIncrement * 2))).add(basePos);

        // Station registry: 210 kHz mapped to Approach Buoy, replacing Rig Alpha
        this.stations = {
            210: { 
                name: 'APPROACH BUOY', 
                position: () => (this.buoySystem ? this.buoySystem.getNDBPosition() : basePos) 
            },
            350: { name: 'WTG #1 (350 kHz)', position: wtg1Pos },
            240: { name: 'WTG #2 (240 kHz)', position: wtg2Pos },
            290: { name: 'WTG #3 (290 kHz)', position: wtg3Pos }
        };

        this.frequency = 210.0;
        this.minFreq = 200.0;
        this.maxFreq = 400.0;
        this.stepSize = 10.0;
        this.knobAngle = 0;

        this._lastFreqText = '';
        this._lastPowered = null;
        this._lastStatusText = '';

        this.createElement();
        this.setupEventListeners();
    }

    setBuoySystem(buoySystem) {
        this.buoySystem = buoySystem;
    }

    addStation(frequency, name, position) {
        const roundedFreq = Math.round(frequency);
        this.stations[roundedFreq] = { name, position };
    }

    getTargetPosition() {
        const roundedFreq = Math.round(this.frequency);
        const station = this.stations[roundedFreq];
        if (!station) return null;
        return typeof station.position === 'function' ? station.position() : station.position;
    }

    isTuned() {
        const roundedFreq = Math.round(this.frequency);
        return Boolean(this.stations[roundedFreq]);
    }

    createElement() {
        const existingPanel = document.getElementById('nav-radio-panel');
        if (existingPanel) existingPanel.remove();

        const existingToggle = document.getElementById('nav-radio-toggle-btn');
        if (existingToggle) existingToggle.remove();

        // Bottom-Right Nav Radio Toggle Icon Button
        this.toggleBtn = document.createElement('button');
        this.toggleBtn.id = 'nav-radio-toggle-btn';
        this.toggleBtn.title = 'Toggle NDB Navigation Radio [N]';
        this.toggleBtn.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: transparent;
            border: none;
            cursor: pointer;
            padding: 4px;
            z-index: 1000;
            user-select: none;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: transform 0.2s, opacity 0.2s, color 0.2s;
            opacity: 0.8;
            color: #00ff00;
        `;
        this.toggleBtn.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M2 8.5a14.5 14.5 0 0 1 20 0"></path>
                <path d="M5 12.5a10 10 0 0 1 14 0"></path>
                <path d="M8.5 16.5a5.5 5.5 0 0 1 7 0"></path>
                <circle cx="12" cy="20" r="1" fill="currentColor"></circle>
            </svg>
        `;
        this.toggleBtn.addEventListener('click', () => {
            const panel = document.getElementById('nav-radio-panel');
            if (panel) {
                const isVisible = panel.style.display === 'block';
                panel.style.display = isVisible ? 'none' : 'block';
                this.toggleBtn.style.color = isVisible ? '#ffffff' : '#00ff00';
            }
        });
        this.toggleBtn.addEventListener('mouseenter', () => this.toggleBtn.style.opacity = '1.0');
        this.toggleBtn.addEventListener('mouseleave', () => this.toggleBtn.style.opacity = '0.8');
        document.body.appendChild(this.toggleBtn);

        this.container = document.createElement('div');
        this.container.id = 'nav-radio-panel';
        this.container.style.cssText = `
            position: fixed;
            bottom: 65px;
            right: 20px;
            width: 170px;
            background: linear-gradient(135deg, #282a2d, #191a1c);
            border: 2px solid #3a3d42;
            border-radius: 5px;
            box-shadow: 0 6px 20px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.08);
            font-family: 'Courier New', Courier, monospace;
            color: #d1d5db;
            padding: 10px;
            z-index: 10000;
            display: block;
            user-select: none;
            pointer-events: auto;
        `;

        this.container.innerHTML = `
            <div style="position: absolute; top: 4px; left: 6px; font-size: 7px; color: #555; font-weight: bold;">⊗</div>
            <div style="position: absolute; top: 4px; right: 6px; font-size: 7px; color: #555; font-weight: bold;">⊗</div>
            <div style="position: absolute; bottom: 4px; left: 6px; font-size: 7px; color: #555; font-weight: bold;">⊗</div>
            <div style="position: absolute; bottom: 4px; right: 6px; font-size: 7px; color: #555; font-weight: bold;">⊗</div>

            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; padding: 0 2px;">
                <div style="font-size: 8px; font-weight: bold; color: #9ca3af; letter-spacing: 1px;">ADF [N]</div>
                <div style="display: flex; align-items: center; gap: 4px;">
                    <span style="font-size: 7px; color: #888;">PWR</span>
                    <div id="nav-power-led" style="width: 7px; height: 7px; background-color: #ff3333; border-radius: 50%; box-shadow: 0 0 5px #ff3333; border: 1px solid #500;"></div>
                </div>
            </div>

            <div style="background: #111215; border: 1px inset #2a2d32; border-radius: 3px; padding: 8px; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <div style="font-size: 7px; color: #9ca3af; letter-spacing: 0.5px; margin-bottom: 2px;">ACTIVE kHz</div>
                    <div id="nav-freq-display" style="font-size: 16px; font-weight: bold; color: #ffb703; text-shadow: 0 0 6px rgba(255,183,3,0.6); letter-spacing: 1px;">210.0</div>
                </div>
                <div style="text-align: right;">
                    <div style="font-size: 7px; color: #9ca3af; letter-spacing: 0.5px; margin-bottom: 2px;">STAT</div>
                    <div id="nav-status-display" style="font-size: 8px; font-weight: bold; color: #22d3ee;">LOCKED</div>
                </div>
            </div>

            <div style="margin-top: 8px; display: flex; justify-content: space-between; align-items: center; padding: 0 2px;">
                <div style="font-size: 7px; color: #9ca3af; line-height: 1.3;">
                    <div id="nav-station-label">APPROACH BUOY</div>
                    <div style="font-size: 6px; color: #6b7280;">SCROLL TO TUNE</div>
                </div>
                <div id="nav-tuning-knob" title="Scroll to tune frequency" style="width: 30px; height: 30px; background: radial-gradient(circle at 35% 35%, #4b5563, #1f2937); border-radius: 50%; border: 1.5px solid #374151; box-shadow: 0 3px 6px rgba(0,0,0,0.5), inset 0 1px 2px rgba(255,255,255,0.2); display: flex; align-items: center; justify-content: center; cursor: pointer; position: relative; transition: transform 0.15s ease-out; transform: rotate(0deg);">
                    <div style="width: 3px; height: 10px; background: #9ca3af; position: absolute; top: 3px; border-radius: 1.5px;"></div>
                </div>
            </div>
        `;
        document.body.appendChild(this.container);

        this.freqDisplay = this.container.querySelector('#nav-freq-display');
        this.statusDisplay = this.container.querySelector('#nav-status-display');
        this.powerLed = this.container.querySelector('#nav-power-led');
        this.tuningKnob = this.container.querySelector('#nav-tuning-knob');
        this.stationLabel = this.container.querySelector('#nav-station-label');
    }

    setupEventListeners() {
        if (!window.__navRadioKeyBound) {
            window.__navRadioKeyBound = true;
            window.addEventListener('keydown', (e) => {
                if (e.code === 'KeyN' && !e.repeat && document.activeElement.tagName !== 'INPUT') {
                    e.preventDefault();
                    const panel = document.getElementById('nav-radio-panel');
                    if (panel) {
                        const isVisible = panel.style.display === 'block';
                        panel.style.display = isVisible ? 'none' : 'block';
                        if (this.toggleBtn) {
                            this.toggleBtn.style.color = isVisible ? '#ffffff' : '#00ff00';
                        }
                    }
                }
            });
        }

        ['wheel', 'mousedown', 'mouseup', 'click', 'pointerdown'].forEach(eventType => {
            this.container.addEventListener(eventType, (e) => e.stopPropagation());
        });

        this.container.addEventListener('wheel', (e) => {
            e.stopPropagation();
            
            if (e.deltaY < 0) {
                this.frequency = Math.min(this.maxFreq, this.frequency + this.stepSize);
                this.knobAngle += 25;
            } else {
                this.frequency = Math.max(this.minFreq, this.frequency - this.stepSize);
                this.knobAngle -= 25;
            }

            if (this.tuningKnob) {
                this.tuningKnob.style.transform = `rotate(${this.knobAngle}deg)`;
            }

            if (this.soundManager) {
                this.soundManager.playRadioClickSound();
            }

            this.updateDisplay();
        });
    }

    updateDisplay() {
        const freqText = this.frequency.toFixed(1);
        const roundedFreq = Math.round(this.frequency);
        const station = this.stations[roundedFreq];

        if (this._lastFreqText !== freqText) {
            this.freqDisplay.textContent = freqText;
            if (this.stationLabel) {
                this.stationLabel.textContent = station ? station.name : 'NO STATION';
            }
            this._lastFreqText = freqText;
        }

        const isStationTuned = this.isTuned();
        let statusText = (isStationTuned && this.powered) ? 'LOCKED' : (this.powered ? 'NO SIG' : 'OFF');
        let statusColor = (isStationTuned && this.powered) ? '#22d3ee' : (this.powered ? '#f59e0b' : '#ef4444');

        if (this._lastStatusText !== statusText) {
            this.statusDisplay.textContent = statusText;
            this.statusDisplay.style.color = statusColor;
            this._lastStatusText = statusText;
        }

        if (this._lastPowered !== this.powered) {
            this.powerLed.style.backgroundColor = this.powered ? '#ff3333' : '#441111';
            this.powerLed.style.boxShadow = this.powered ? '0 0 5px #ff3333' : 'none';
            this._lastPowered = this.powered;
        }
    }

    hide() {
        if (this.container) this.container.style.display = 'none';
        if (this.toggleBtn) this.toggleBtn.style.color = '#ffffff';
    }

    show() {
        if (this.container) this.container.style.display = 'block';
        if (this.toggleBtn) this.toggleBtn.style.color = '#00ff00';
    }

    update() {
        this.powered = (this.player && typeof this.player.isElectricalOn !== 'undefined') ? Boolean(this.player.isElectricalOn) : true;
        this.updateDisplay();
    }
}