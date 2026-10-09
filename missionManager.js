export class MissionManager {
    constructor(scene, rescueMission, windFarm, navRadio, pager) {
        this.scene = scene;
        this.rescueMission = rescueMission;
        this.windFarm = windFarm;
        this.navRadio = navRadio;
        this.pager = pager;

        this.missionPool = ['rescue', 'windfarm'];
        this.activeMissionType = null; 
        this.state = 'IDLE'; // 'IDLE', 'ACTIVE', 'COOLDOWN'
        this.cooldownTimer = 0;
        this.initialDelayTimer = 5.0;
        
        window.missionManager = this;
    }

    startRandomMission() {
        if (this.activeMissionType !== null) return;

        const randomIndex = Math.floor(Math.random() * this.missionPool.length);
        this.activeMissionType = this.missionPool[randomIndex];
        this.state = 'ACTIVE';

        console.log(`[MissionManager] Spawning mission type: ${this.activeMissionType}`);

        if (this.activeMissionType === 'rescue') {
            if (this.rescueMission && typeof this.rescueMission.startMission === 'function') {
                this.rescueMission.startMission();
            }
        } else if (this.activeMissionType === 'windfarm') {
            if (this.windFarm && typeof this.windFarm.spawnRandomFire === 'function') {
                this.windFarm.spawnRandomFire();
            }
        }
    }

    triggerCooldown() {
        this.activeMissionType = null;
        this.state = 'COOLDOWN';
        this.cooldownTimer = 10.0; // 10-second cooldown/delay before next mission
        if (this.pager) this.pager.hide();
        console.log('[MissionManager] Mission completed. Starting 10-second cooldown...');
    }

    handleCrash() {
        console.log('[MissionManager] Crash detected. Clearing active mission and starting 30s cooldown.');
        this.activeMissionType = null;
        this.state = 'COOLDOWN';
        this.cooldownTimer = 10.0;

        if (this.rescueMission && typeof this.rescueMission.reset === 'function') {
            this.rescueMission.reset();
        }
        if (this.windFarm && typeof this.windFarm.extinguishFire === 'function') {
            this.windFarm.extinguishFire();
        }
        if (this.pager) {
            this.pager.hide();
        }
    }

    update(delta, helicopterPlayer, mainBase) {
        if (this.initialDelayTimer > 0) {
            this.initialDelayTimer -= delta;
            if (this.initialDelayTimer <= 0) {
                this.startRandomMission();
            }
            return;
        }

        if (this.state === 'COOLDOWN') {
            this.cooldownTimer -= delta;
            if (this.cooldownTimer <= 0) {
                this.state = 'IDLE';
                this.startRandomMission();
            }
            return;
        }

        if (this.state === 'ACTIVE') {
            if (this.activeMissionType === 'rescue') {
                if (this.rescueMission && (this.rescueMission.state === 'RESPAWN_WAIT' || this.rescueMission.state === 'COMPLETED')) {
                    this.triggerCooldown();
                }
            } else if (this.activeMissionType === 'windfarm') {
                if (this.windFarm && this.windFarm.activeFireIndex === -1) {
                    this.triggerCooldown();
                }
            }
        }

        if (this.rescueMission && helicopterPlayer) {
            this.rescueMission.update(delta, helicopterPlayer, mainBase);
        }
    }
}