/* ==========================================================================
   HILL CLIMB RACING EXTREME - CARDS & VEHICLES SYSTEM (js/cards.js)
   ========================================================================== */

const VEHICLES_DATABASE = {
    jeep: {
        id: 'jeep',
        name: 'Classic Hill Climber 4x4',
        rarity: 'common',
        icon: '🚘',
        unlocked: true,
        cost: 0,
        weight: 1.0,
        enginePower: 1.0,
        suspensionStiffness: 1.0,
        tireGrip: 1.0,
        wheelRadius: 18,
        chassisWidth: 75,
        chassisHeight: 32,
        color: '#e74c3c'
    },
    monster: {
        id: 'monster',
        name: 'Monster Truck',
        rarity: 'rare',
        icon: '🛻',
        unlocked: false,
        cost: 1000,
        weight: 1.4,
        enginePower: 1.45,
        suspensionStiffness: 1.5,
        tireGrip: 1.25,
        wheelRadius: 28,
        chassisWidth: 80,
        chassisHeight: 40,
        color: '#e74c3c'
    },
    speedcar: {
        id: 'speedcar',
        name: 'Race Buggy',
        rarity: 'epic',
        icon: '🏎️',
        unlocked: false,
        cost: 2500,
        weight: 0.75,
        enginePower: 1.8,
        suspensionStiffness: 0.9,
        tireGrip: 1.4,
        wheelRadius: 16,
        chassisWidth: 75,
        chassisHeight: 22,
        color: '#9b59b6'
    },
    rover: {
        id: 'rover',
        name: 'Moon Rover',
        rarity: 'rare',
        icon: '🛸',
        unlocked: false,
        cost: 2000,
        weight: 0.85,
        enginePower: 1.3,
        suspensionStiffness: 1.2,
        tireGrip: 1.1,
        wheelRadius: 20,
        chassisWidth: 68,
        chassisHeight: 28,
        color: '#3498db'
    },
    tank: {
        id: 'tank',
        name: 'Heavy Tank',
        rarity: 'legendary',
        icon: '🛡️',
        unlocked: false,
        cost: 5000,
        weight: 2.2,
        enginePower: 2.2,
        suspensionStiffness: 2.0,
        tireGrip: 1.6,
        wheelRadius: 22,
        chassisWidth: 90,
        chassisHeight: 42,
        color: '#f1c40f'
    },
    crawler: {
        id: 'crawler',
        name: 'Mountain Crawler',
        rarity: 'epic',
        icon: '🚙',
        unlocked: false,
        cost: 1800,
        weight: 1.1,
        enginePower: 1.35,
        suspensionStiffness: 1.65,
        tireGrip: 1.5,
        wheelRadius: 22,
        chassisWidth: 78,
        chassisHeight: 34,
        color: '#27ae60'
    }
};

class CardManager {
    constructor() {
        this.unlockedVehicles = ['jeep'];
        this.selectedVehicleId = 'jeep';
        this.vehicleUpgrades = {
            jeep: { engine: 1, suspension: 1, tires: 1, drive: 1 },
            monster: { engine: 1, suspension: 1, tires: 1, drive: 1 },
            speedcar: { engine: 1, suspension: 1, tires: 1, drive: 1 },
            rover: { engine: 1, suspension: 1, tires: 1, drive: 1 },
            tank: { engine: 1, suspension: 1, tires: 1, drive: 1 },
            crawler: { engine: 1, suspension: 1, tires: 1, drive: 1 }
        };
    }

    loadState(saveData) {
        if (!saveData) return;
        if (saveData.unlockedVehicles) this.unlockedVehicles = saveData.unlockedVehicles;
        if (saveData.selectedVehicleId) this.selectedVehicleId = saveData.selectedVehicleId;
        if (saveData.vehicleUpgrades) this.vehicleUpgrades = saveData.vehicleUpgrades;
    }

    getSaveState() {
        return {
            unlockedVehicles: this.unlockedVehicles,
            selectedVehicleId: this.selectedVehicleId,
            vehicleUpgrades: this.vehicleUpgrades
        };
    }

    getVehicleConfig(vehicleId = this.selectedVehicleId) {
        const base = VEHICLES_DATABASE[vehicleId] || VEHICLES_DATABASE.jeep;
        const upgrades = this.vehicleUpgrades[vehicleId] || { engine: 1, suspension: 1, tires: 1, drive: 1 };

        return {
            ...base,
            enginePower: base.enginePower * (1 + (upgrades.engine - 1) * 0.15),
            suspensionStiffness: base.suspensionStiffness * (1 + (upgrades.suspension - 1) * 0.12),
            tireGrip: base.tireGrip * (1 + (upgrades.tires - 1) * 0.1),
            engineLevel: upgrades.engine,
            suspensionLevel: upgrades.suspension,
            tiresLevel: upgrades.tires,
            driveLevel: upgrades.drive
        };
    }

    upgradeStat(vehicleId, statName, playerCoins) {
        const cost = this.getUpgradeCost(vehicleId, statName);
        if (playerCoins >= cost) {
            if (!this.vehicleUpgrades[vehicleId]) {
                this.vehicleUpgrades[vehicleId] = { engine: 1, suspension: 1, tires: 1, drive: 1 };
            }
            this.vehicleUpgrades[vehicleId][statName]++;
            return cost;
        }
        return false;
    }

    getUpgradeCost(vehicleId, statName) {
        const lvl = (this.vehicleUpgrades[vehicleId] && this.vehicleUpgrades[vehicleId][statName]) || 1;
        return Math.floor(100 * Math.pow(1.4, lvl - 1));
    }

    openChest(chestType) {
        const loot = [];
        if (chestType === 'free') {
            loot.push({ type: 'coins', amount: 150 + Math.floor(Math.random() * 200), icon: '🪙' });
            loot.push({ type: 'gems', amount: 5 + Math.floor(Math.random() * 5), icon: '💎' });
        } else if (chestType === 'gold') {
            loot.push({ type: 'coins', amount: 600 + Math.floor(Math.random() * 500), icon: '🪙' });
            loot.push({ type: 'gems', amount: 15 + Math.floor(Math.random() * 10), icon: '💎' });
            // Unlock random locked vehicle if available
            const locked = Object.keys(VEHICLES_DATABASE).filter(id => !this.unlockedVehicles.includes(id));
            if (locked.length > 0) {
                const newVeh = locked[Math.floor(Math.random() * locked.length)];
                this.unlockedVehicles.push(newVeh);
                loot.push({ type: 'vehicle', vehicleId: newVeh, name: VEHICLES_DATABASE[newVeh].name, icon: VEHICLES_DATABASE[newVeh].icon });
            }
        } else if (chestType === 'epic') {
            loot.push({ type: 'coins', amount: 1500, icon: '🪙' });
            loot.push({ type: 'gems', amount: 50, icon: '💎' });
            const locked = Object.keys(VEHICLES_DATABASE).filter(id => !this.unlockedVehicles.includes(id));
            if (locked.length > 0) {
                const newVeh = locked[0];
                this.unlockedVehicles.push(newVeh);
                loot.push({ type: 'vehicle', vehicleId: newVeh, name: VEHICLES_DATABASE[newVeh].name, icon: VEHICLES_DATABASE[newVeh].icon });
            }
        }
        return loot;
    }
}
