export class Pager {
    constructor() {
        this.container = null;
        this.freqDisplay = null;
        this.statusDisplay = null;
        this.titleEl = null;
        this.callTypeEl = null;
        this.ledEl = null;
        this.createElement();
    }

    createElement() {
        const existing = document.getElementById('rescue-pager-panel');
        if (existing) existing.remove();

        this.container = document.createElement('div');
        this.container.id = 'rescue-pager-panel';
        this.container.style.cssText = `
            position: fixed;
            bottom: 193px;
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
            display: none;
            user-select: none;
            pointer-events: auto;
        `;

        this.container.innerHTML = `
            <div style="position: absolute; top: 4px; left: 6px; font-size: 7px; color: #555; font-weight: bold;">⊗</div>
            <div style="position: absolute; top: 4px; right: 6px; font-size: 7px; color: #555; font-weight: bold;">⊗</div>
            <div style="position: absolute; bottom: 4px; left: 6px; font-size: 7px; color: #555; font-weight: bold;">⊗</div>
            <div style="position: absolute; bottom: 4px; right: 6px; font-size: 7px; color: #555; font-weight: bold;">⊗</div>

            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; padding: 0 2px;">
                <div style="font-size: 8px; font-weight: bold; color: #ff3333; letter-spacing: 1px;" id="pager-title">PAGER [SOS]</div>
                <div style="display: flex; align-items: center; gap: 4px;">
                    <span style="font-size: 7px; color: #888;">ALERT</span>
                    <div id="pager-led" style="width: 7px; height: 7px; background-color: #ff3333; border-radius: 50%; box-shadow: 0 0 5px #ff3333; border: 1px solid #500;"></div>
                </div>
            </div>

            <div style="background: #111215; border: 1px inset #2a2d32; border-radius: 3px; padding: 8px; text-align: center;">
                <div style="font-size: 7px; color: #9ca3af; letter-spacing: 0.5px; margin-bottom: 2px;" id="pager-call-type">DISTRESS CALL</div>
                <div id="pager-freq" style="font-size: 15px; font-weight: bold; color: #ff3333; text-shadow: 0 0 6px rgba(255,51,51,0.6); letter-spacing: 1px;">---.- kHz</div>
            </div>

            <div style="margin-top: 8px; font-size: 7px; color: #9ca3af; text-align: center; line-height: 1.3;">
                <div id="pager-status">SEARCHING...</div>
            </div>
        `;
        document.body.appendChild(this.container);

        this.freqDisplay = this.container.querySelector('#pager-freq');
        this.statusDisplay = this.container.querySelector('#pager-status');
        this.titleEl = this.container.querySelector('#pager-title');
        this.callTypeEl = this.container.querySelector('#pager-call-type');
        this.ledEl = this.container.querySelector('#pager-led');

        ['wheel', 'mousedown', 'mouseup', 'click', 'pointerdown'].forEach(eventType => {
            this.container.addEventListener(eventType, (e) => e.stopPropagation());
        });
    }

    showMission(title, callType, frequencyKHz, statusText) {
        if (this.titleEl) this.titleEl.textContent = title;
        if (this.callTypeEl) this.callTypeEl.textContent = callType;
        if (this.freqDisplay) this.freqDisplay.textContent = `${frequencyKHz.toFixed(1)} kHz`;
        if (this.statusDisplay) this.statusDisplay.textContent = statusText;
        if (this.container) this.container.style.display = 'block';
    }

    setStatus(statusText) {
        if (this.statusDisplay) this.statusDisplay.textContent = statusText;
    }

    hide() {
        if (this.container) this.container.style.display = 'none';
    }

    setLed(isOn) {
        if (this.ledEl) {
            this.ledEl.style.backgroundColor = isOn ? '#ff3333' : '#550000';
            this.ledEl.style.boxShadow = isOn ? '0 0 5px #ff3333' : 'none';
        }
    }
}