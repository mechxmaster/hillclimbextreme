/* ==========================================================================
   HILL CLIMB RACING EXTREME - PROCEDURAL TERRAIN ENGINE (js/terrain.js)
   ========================================================================== */

const STAGE_THEMES = {
    highway: {
        id: "highway",
        name: "Asphalt Highway",
        icon: "🛣️",
        gravity: 0.35,
        friction: 1.2,
        skyGradient: ["#0f2027", "#203a43", "#2c5364"],
        surfaceColor: "#f1c40f", // Yellow highway divider line / asphalt trim
        fillColor: "#2c3e50",
        subFillColor: "#1a252f",
        bgParallaxType: "highway",
        unlocked: true,
        cost: 0
    },
    countryside: {
        id: "countryside",
        name: "Countryside",
        icon: "🏔️",
        gravity: 0.35,
        friction: 1.0,
        skyGradient: ["#1a2a3a", "#3a506b", "#5bc0be"],
        surfaceColor: "#2ecc71",
        fillColor: "#795548",
        subFillColor: "#4e342e",
        bgParallaxType: "hills",
        unlocked: true,
        cost: 0
    },
    desert: {
        id: "desert",
        name: "Desert Dunes",
        icon: "🏜️",
        gravity: 0.35,
        friction: 0.85,
        skyGradient: ["#2d1b00", "#d35400", "#f39c12"],
        surfaceColor: "#f1c40f",
        fillColor: "#e67e22",
        subFillColor: "#d35400",
        bgParallaxType: "dunes",
        unlocked: false,
        cost: 500
    },
    moon: {
        id: "moon",
        name: "Moon Gravity",
        icon: "🌕",
        gravity: 0.12,
        friction: 1.0,
        skyGradient: ["#05050a", "#0b0c10", "#1f2833"],
        surfaceColor: "#bdc3c7",
        fillColor: "#7f8c8d",
        subFillColor: "#34495e",
        bgParallaxType: "space",
        unlocked: false,
        cost: 1500
    },
    arctic: {
        id: "arctic",
        name: "Arctic Ice",
        icon: "❄️",
        gravity: 0.35,
        friction: 0.6,
        skyGradient: ["#00101d", "#002b49", "#005f73"],
        surfaceColor: "#ffffff",
        fillColor: "#81d4fa",
        subFillColor: "#0288d1",
        bgParallaxType: "snow",
        unlocked: false,
        cost: 2500
    },
    volcano: {
        id: "volcano",
        name: "Volcano Ridge",
        icon: "🌋",
        gravity: 0.4,
        friction: 1.1,
        skyGradient: ["#150000", "#4a0000", "#8b0000"],
        surfaceColor: "#e74c3c",
        fillColor: "#2c3e50",
        subFillColor: "#111111",
        bgParallaxType: "volcano",
        unlocked: false,
        cost: 5000
    }
};

class TerrainGenerator {
    constructor() {
        this.currentStage = STAGE_THEMES.highway;
        this.baseHeight = 450;
        this.collectibles = [];
        this.lastSpawnX = 300;
        this.lastFuelX = 300;
    }

    setStage(stageId) {
        if (STAGE_THEMES[stageId]) {
            this.currentStage = STAGE_THEMES[stageId];
        }
        this.collectibles = [];
        this.lastSpawnX = 300;
        this.lastFuelX = 300;
    }

    // Procedural Elevation Height at world position X
    getHeight(x) {
        // Flat start area for first 250 meters
        if (x < 300) {
            return this.baseHeight;
        }

        // Highway stage has very gentle long waves and small bumps for fast smooth driving
        if (this.currentStage && this.currentStage.id === 'highway') {
            const h1 = Math.sin(x * 0.0018) * 35;  // Long smooth hill waves
            const h2 = Math.cos(x * 0.005) * 15;   // Gentle minor bumps
            const h3 = Math.sin(x * 0.0003) * 60;  // Macro elevation trend
            return this.baseHeight + h1 + h2 + h3;
        }

        const scale1 = 0.003;
        const scale2 = 0.008;
        const scale3 = 0.0005;

        // Multi-octave hill noise
        const h1 = Math.sin(x * scale1) * 110;
        const h2 = Math.cos(x * scale2) * 55;
        const h3 = Math.sin(x * scale3) * 220; // Macro mountain elevation

        // Extra steepness modifier as player goes further
        const distanceDifficulty = Math.min(1.8, 1 + (x / 20000));

        return this.baseHeight + ((h1 + h2 + h3) * distanceDifficulty);
    }

    // Spawn Collectibles (Coins, Gems, Fuel) dynamically as vehicle advances
    updateCollectibles(playerX) {
        // 1. Guaranteed Fuel Canister Spawning every ~1400 world units (~140 meters)
        while (this.lastFuelX < playerX + 2200) {
            this.lastFuelX += 1400; // Guaranteed fuel spacing
            const terrainY = this.getHeight(this.lastFuelX);
            this.collectibles.push({
                type: 'fuel',
                x: this.lastFuelX,
                y: terrainY - 35,
                collected: false
            });
        }

        // 2. Spawn Coins & Gems ahead of player
        while (this.lastSpawnX < playerX + 1800) {
            this.lastSpawnX += 140 + Math.random() * 120; // Item spacing

            // Skip if too close to a fuel canister to prevent clutter
            if (Math.abs(this.lastSpawnX - this.lastFuelX) < 80) continue;

            const terrainY = this.getHeight(this.lastSpawnX);
            const rand = Math.random();

            if (rand < 0.20) {
                // Rare Gem
                this.collectibles.push({
                    type: 'gem',
                    x: this.lastSpawnX,
                    y: terrainY - 30,
                    collected: false
                });
            } else {
                // Coin arc (group of 3-5 coins)
                const count = 3 + Math.floor(Math.random() * 3);
                for (let i = 0; i < count; i++) {
                    const coinX = this.lastSpawnX + (i * 28);
                    const coinY = this.getHeight(coinX) - 30 - Math.sin((i / count) * Math.PI) * 25;
                    this.collectibles.push({
                        type: 'coin',
                        value: (Math.random() > 0.8) ? 50 : 10,
                        x: coinX,
                        y: coinY,
                        collected: false
                    });
                }
                this.lastSpawnX += count * 28;
            }
        }

        // Clean up old collectibles way behind player
        this.collectibles = this.collectibles.filter(item => item.x > playerX - 800);
    }

    // Render Parallax Background & Terrain Mesh
    render(ctx, cameraX, cameraY, width, height) {
        const theme = this.currentStage;

        // 1. Sky Gradient Background
        const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
        skyGrad.addColorStop(0, theme.skyGradient[0]);
        skyGrad.addColorStop(0.5, theme.skyGradient[1]);
        skyGrad.addColorStop(1, theme.skyGradient[2]);
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, width, height);

        // 2. Parallax Backdrop Layers
        this.renderParallax(ctx, cameraX, width, height, theme);

        // 3. Terrain Mesh Construction
        ctx.save();
        ctx.beginPath();

        const step = 8;
        const startX = Math.floor((cameraX - width / 2) / step) * step - step;
        const endX = cameraX + width / 2 + step * 2;

        ctx.moveTo(startX - cameraX + width / 2, height);

        for (let x = startX; x <= endX; x += step) {
            const screenX = x - cameraX + width / 2;
            const screenY = this.getHeight(x) - cameraY + height / 2;
            ctx.lineTo(screenX, screenY);
        }

        ctx.lineTo(endX - cameraX + width / 2, height);
        ctx.closePath();

        // Fill Terrain Body
        const terrainGrad = ctx.createLinearGradient(0, height / 3, 0, height);
        terrainGrad.addColorStop(0, theme.fillColor);
        terrainGrad.addColorStop(1, theme.subFillColor);
        ctx.fillStyle = terrainGrad;
        ctx.fill();

        // Stroke Terrain Top Grass/Surface Ribbon
        ctx.lineWidth = 10;
        ctx.strokeStyle = theme.surfaceColor;
        ctx.lineJoin = 'round';
        ctx.stroke();

        ctx.restore();

        // 4. Render Collectibles
        this.renderCollectibles(ctx, cameraX, cameraY, width, height);
    }

    renderParallax(ctx, cameraX, width, height, theme) {
        ctx.save();
        if (theme.bgParallaxType === 'space') {
            // Draw Stars & Earth
            ctx.fillStyle = '#ffffff';
            for (let i = 0; i < 50; i++) {
                const starX = ((i * 137) - cameraX * 0.05) % width;
                const starY = (i * 97) % (height * 0.6);
                ctx.beginPath();
                ctx.arc(starX < 0 ? starX + width : starX, starY, (i % 3) + 1, 0, Math.PI * 2);
                ctx.fill();
            }
            // Earth in distance
            ctx.font = '60px serif';
            ctx.fillText('🌍', width * 0.75 - (cameraX * 0.02) % width, 120);
        } else if (theme.bgParallaxType === 'highway') {
            // City Skyline Silhouette + Highway Lights
            ctx.fillStyle = 'rgba(15, 23, 42, 0.6)';
            const bgStep = 60;
            const bgParaFactor = 0.15;
            for (let x = -60; x <= width + 60; x += bgStep) {
                const worldX = x + cameraX * bgParaFactor;
                const buildingH = 120 + Math.abs(Math.sin(worldX * 0.01)) * 140;
                const bWidth = 45 + (Math.abs(Math.cos(worldX * 0.03)) * 30);
                ctx.fillRect(x, height * 0.65 - buildingH, bWidth, buildingH + 100);
            }
        } else {
            // Mountain silhouettes
            ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
            ctx.beginPath();
            const bgStep = 40;
            const bgParaFactor = 0.2;
            ctx.moveTo(0, height);
            for (let x = 0; x <= width + bgStep; x += bgStep) {
                const worldX = x + cameraX * bgParaFactor;
                const bgH = height * 0.55 + Math.sin(worldX * 0.002) * 80 + Math.cos(worldX * 0.005) * 40;
                ctx.lineTo(x, bgH);
            }
            ctx.lineTo(width, height);
            ctx.fill();
        }
        ctx.restore();
    }

    renderCollectibles(ctx, cameraX, cameraY, width, height) {
        ctx.save();
        this.collectibles.forEach(item => {
            if (item.collected) return;

            const screenX = item.x - cameraX + width / 2;
            const screenY = item.y - cameraY + height / 2;

            if (screenX < -50 || screenX > width + 50) return;

            ctx.font = '24px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            if (item.type === 'coin') {
                // Bobbing coin animation
                const bob = Math.sin((Date.now() * 0.005) + item.x) * 4;
                ctx.font = item.value > 10 ? '26px sans-serif' : '20px sans-serif';
                ctx.fillText('🪙', screenX, screenY + bob);
            } else if (item.type === 'gem') {
                const bob = Math.sin((Date.now() * 0.006) + item.x) * 5;
                ctx.fillText('💎', screenX, screenY + bob);
            } else if (item.type === 'fuel') {
                const bob = Math.sin((Date.now() * 0.004) + item.x) * 3;
                ctx.fillText('⛽', screenX, screenY + bob);
            }
        });
        ctx.restore();
    }
}
