/* ==========================================================================
   HILL CLIMB RACING EXTREME - GAME ENGINE LOOP (js/game.js)
   ========================================================================== */

class GameEngine {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.isRunning = false;
        this.isPaused = false;

        this.physics = null;
        this.terrain = new TerrainGenerator();
        this.particles = [];

        // Game session state
        this.distance = 0;
        this.coinsCollected = 0;
        this.gemsCollected = 0;
        this.flipBonusCoins = 0;
        this.fuel = 100; // Percentage 0 - 100
        this.maxDistance = 0;

        // Camera position
        this.cameraX = 0;
        this.cameraY = 0;

        // Callbacks
        this.onGameOver = null;
    }

    init(canvasElement) {
        this.canvas = canvasElement;
        this.ctx = this.canvas.getContext('2d');
        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        if (this.canvas) {
            this.canvas.width = window.innerWidth;
            this.canvas.height = window.innerHeight - 60; // Subtract header height
        }
    }

    start(vehicleConfig, stageId) {
        this.terrain.setStage(stageId);
        this.physics = new VehiclePhysics(vehicleConfig);
        this.physics.reset(200, this.terrain.getHeight(200) - 40);

        this.distance = 0;
        this.maxDistance = 0;
        this.coinsCollected = 0;
        this.gemsCollected = 0;
        this.flipBonusCoins = 0;
        this.fuel = 100;
        this.particles = [];

        this.isRunning = true;
        this.isPaused = false;

        soundEngine.startEngine();

        this.lastTime = performance.now();
        requestAnimationFrame((t) => this.loop(t));
    }

    pause() {
        this.isPaused = true;
        soundEngine.stopEngine();
    }

    resume() {
        this.isPaused = false;
        soundEngine.startEngine();
        this.lastTime = performance.now();
        requestAnimationFrame((t) => this.loop(t));
    }

    stop() {
        this.isRunning = false;
        soundEngine.stopEngine();
    }

    loop(currentTime) {
        if (!this.isRunning) return;
        if (this.isPaused) return;

        const dt = Math.min((currentTime - this.lastTime) / 1000, 0.05); // Cap delta time
        this.lastTime = currentTime;

        this.update(dt);
        this.render();

        requestAnimationFrame((t) => this.loop(t));
    }

    update(dt) {
        if (!this.physics) return;

        const gravity = this.terrain.currentStage.gravity;
        const getTerrainH = (x) => this.terrain.getHeight(x);

        // Update Vehicle Physics
        const trickNotice = this.physics.update(dt, gravity, getTerrainH);

        if (trickNotice) {
            this.handleTrickPopup(trickNotice);
        }

        // Deplete Fuel based on time & gas pedal input (balanced for fun continuous driving)
        const fuelConsumptionRate = 0.9 + (this.physics.gasInput * 1.5);
        this.fuel -= fuelConsumptionRate * dt;

        if (this.fuel <= 0) {
            this.fuel = 0;
            this.triggerGameOver("OUT OF FUEL!");
            return;
        }

        if (this.physics.isCrashed) {
            this.triggerGameOver("NECK FLIP CRASH!");
            return;
        }

        // Update Distance Counter
        const distMeters = Math.max(0, Math.floor((this.physics.x - 200) / 10));
        if (distMeters > this.distance) {
            this.distance = distMeters;
        }

        // Update Collectibles & Collision Checks
        this.terrain.updateCollectibles(this.physics.x);
        this.checkCollectiblesCollision();

        // Update Audio Pitch
        const currentSpeedKmh = Math.floor(Math.abs(this.physics.vx) * 3.6 * 5);
        const rpmPct = Math.min(1.0, (Math.abs(this.physics.vx) * 0.1) + (this.physics.gasInput * 0.5));
        soundEngine.updateEngine(currentSpeedKmh, rpmPct);

        // Update Camera target smoothly
        this.cameraX += (this.physics.x - this.cameraX) * 0.1;
        this.cameraY += (this.physics.y - this.cameraY) * 0.1;

        // Particle Effects (Exhaust smoke & Tire dust)
        this.updateParticles(dt);

        // Update HUD DOM Elements
        this.updateHUD(currentSpeedKmh, rpmPct);
    }

    checkCollectiblesCollision() {
        const px = this.physics.x;
        const py = this.physics.y;

        this.terrain.collectibles.forEach(item => {
            if (item.collected) return;
            const dx = item.x - px;
            const dy = item.y - py;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < 45) {
                item.collected = true;
                if (item.type === 'coin') {
                    this.coinsCollected += item.value;
                    soundEngine.playCoin();
                } else if (item.type === 'gem') {
                    this.gemsCollected += 1;
                    soundEngine.playGem();
                } else if (item.type === 'fuel') {
                    this.fuel = Math.min(100, this.fuel + 80); // Generous fuel replenishment
                    soundEngine.playFuel();
                }
            }
        });
    }

    handleTrickPopup(text) {
        if (text.includes("CRASH")) {
            soundEngine.playCrash();
            return;
        }

        this.flipBonusCoins += 200;
        soundEngine.playFlip();

        const container = document.getElementById('trick-popup-container');
        if (container) {
            const badge = document.createElement('div');
            badge.className = 'trick-badge';
            badge.innerText = text;
            container.appendChild(badge);

            setTimeout(() => {
                if (badge.parentNode) badge.parentNode.removeChild(badge);
            }, 900);
        }
    }

    updateParticles(dt) {
        // Spawn exhaust smoke when gas pressed
        if (this.physics.gasInput > 0) {
            const cos = Math.cos(this.physics.angle);
            const sin = Math.sin(this.physics.angle);
            this.particles.push({
                x: this.physics.x - 35 * cos,
                y: this.physics.y - 35 * sin,
                vx: -this.physics.vx * 0.2 + (Math.random() - 0.5) * 2,
                vy: (Math.random() - 0.5) * 2 - 1,
                size: 4 + Math.random() * 4,
                alpha: 0.6,
                life: 0.6
            });
        }

        // Update particle life
        this.particles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.life -= dt;
            p.alpha = Math.max(0, p.life / 0.6);
        });
        this.particles = this.particles.filter(p => p.life > 0);
    }

    triggerGameOver(reasonText) {
        this.stop();
        if (this.onGameOver) {
            this.onGameOver({
                reason: reasonText,
                distance: this.distance,
                coins: this.coinsCollected,
                flipBonus: this.flipBonusCoins,
                gems: this.gemsCollected,
                totalEarnedCoins: this.coinsCollected + this.flipBonusCoins
            });
        }
    }

    updateHUD(speedKmh, rpmPct) {
        const hudDist = document.getElementById('hud-distance');
        const hudCoins = document.getElementById('hud-coins');
        const hudGems = document.getElementById('hud-gems');
        const fuelFill = document.getElementById('fuel-bar-fill');
        const fuelPct = document.getElementById('fuel-pct');
        const speedVal = document.getElementById('speed-val');
        const rpmVal = document.getElementById('rpm-val');

        if (hudDist) hudDist.innerText = `${this.distance} m`;
        if (hudCoins) hudCoins.innerText = this.coinsCollected + this.flipBonusCoins;
        if (hudGems) hudGems.innerText = this.gemsCollected;
        if (fuelFill) fuelFill.style.width = `${Math.max(0, this.fuel)}%`;
        if (fuelPct) fuelPct.innerText = `${Math.round(this.fuel)}%`;
        if (speedVal) speedVal.innerText = speedKmh;
        if (rpmVal) rpmVal.innerText = (rpmPct * 7).toFixed(1);

        // Update minimap terrain preview
        this.renderMinimap();
    }

    renderMinimap() {
        const mc = document.getElementById('minimap-canvas');
        if (!mc || !this.physics) return;
        const mw = mc.width;
        const mh = mc.height;
        const ctx = mc.getContext('2d');

        // Background
        ctx.clearRect(0, 0, mw, mh);
        ctx.fillStyle = 'rgba(8, 12, 22, 0.92)';
        ctx.beginPath();
        ctx.roundRect(0, 0, mw, mh, 8);
        ctx.fill();

        const stage = this.terrain.currentStage;
        const vehicleX = this.physics.x;

        // How much world distance is shown on minimap (preview window in world units)
        const previewRange = 1800; // world units shown on minimap
        const startX = vehicleX - 80; // a bit behind vehicle
        const endX = startX + previewRange;

        // Draw terrain line
        const samples = mw; // one sample per pixel
        const terrainPoints = [];
        for (let i = 0; i <= samples; i++) {
            const wx = startX + (i / samples) * previewRange;
            const wy = this.terrain.getHeight(wx);
            terrainPoints.push({ x: i, worldY: wy });
        }

        // Find min/max Y for normalization
        let minY = Infinity, maxY = -Infinity;
        terrainPoints.forEach(pt => {
            if (pt.worldY < minY) minY = pt.worldY;
            if (pt.worldY > maxY) maxY = pt.worldY;
        });
        const yRange = Math.max(maxY - minY, 150);
        const padding = 6;

        const toScreenY = (wy) => padding + ((wy - minY) / yRange) * (mh - padding * 2);

        // Draw terrain fill (ground)
        ctx.beginPath();
        ctx.moveTo(0, mh);
        terrainPoints.forEach(pt => {
            ctx.lineTo(pt.x, toScreenY(pt.worldY));
        });
        ctx.lineTo(mw, mh);
        ctx.closePath();
        ctx.fillStyle = 'rgba(46, 204, 113, 0.18)';
        ctx.fill();

        // Draw terrain line
        ctx.beginPath();
        ctx.moveTo(terrainPoints[0].x, toScreenY(terrainPoints[0].worldY));
        for (let i = 1; i < terrainPoints.length; i++) {
            ctx.lineTo(terrainPoints[i].x, toScreenY(terrainPoints[i].worldY));
        }
        ctx.strokeStyle = stage.surfaceColor || '#2ecc71';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw collectible dots on minimap
        this.terrain.collectibles.forEach(item => {
            if (item.collected) return;
            if (item.x < startX || item.x > endX) return;
            const mx = ((item.x - startX) / previewRange) * mw;
            const terrH = this.terrain.getHeight(item.x);
            const my = toScreenY(terrH) - 5;
            ctx.beginPath();
            ctx.arc(mx, my, 2.5, 0, Math.PI * 2);
            ctx.fillStyle = item.type === 'coin' ? '#f1c40f' : item.type === 'gem' ? '#3498db' : '#2ecc71';
            ctx.fill();
        });

        // Draw vehicle blip (small green vehicle icon)
        const vehMapX = ((vehicleX - startX) / previewRange) * mw;
        const vehTerrH = this.terrain.getHeight(vehicleX);
        const vehMapY = toScreenY(vehTerrH) - 7;

        // Vehicle triangle marker
        ctx.save();
        ctx.translate(vehMapX, vehMapY);
        ctx.beginPath();
        ctx.moveTo(0, -5);
        ctx.lineTo(-4, 2);
        ctx.lineTo(4, 2);
        ctx.closePath();
        ctx.fillStyle = '#2ecc71';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 0.8;
        ctx.stroke();
        ctx.restore();

        // Draw dashed "look ahead" line from vehicle
        ctx.setLineDash([3, 4]);
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(vehMapX, 4);
        ctx.lineTo(vehMapX, mh - 4);
        ctx.stroke();
        ctx.setLineDash([]);

        // Distance label on right
        const previewDist = Math.round(previewRange / 10);
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.font = 'bold 8px monospace';
        ctx.textAlign = 'right';
        ctx.fillText(`+${previewDist}m`, mw - 4, mh - 3);
        ctx.textAlign = 'left';
    }

    render() {
        if (!this.ctx || !this.canvas) return;
        const width = this.canvas.width;
        const height = this.canvas.height;

        // 1. Render Terrain & Background
        this.terrain.render(this.ctx, this.cameraX, this.cameraY, width, height);

        // 2. Render Particles
        this.ctx.save();
        this.particles.forEach(p => {
            const screenX = p.x - this.cameraX + width / 2;
            const screenY = p.y - this.cameraY + height / 2;
            this.ctx.fillStyle = `rgba(200, 200, 200, ${p.alpha})`;
            this.ctx.beginPath();
            this.ctx.arc(screenX, screenY, p.size, 0, Math.PI * 2);
            this.ctx.fill();
        });
        this.ctx.restore();

        // 3. Render Vehicle Chassis & Wheels
        if (this.physics) {
            this.renderVehicle(this.ctx, width, height);
        }
    }

    renderVehicle(ctx, width, height) {
        const p = this.physics;
        const screenX = p.x - this.cameraX + width / 2;
        const screenY = p.y - this.cameraY + height / 2;

        ctx.save();
        ctx.translate(screenX, screenY);
        ctx.rotate(p.angle);

        // Dispatch to the correct drawing function for each vehicle type
        switch (p.vehicleId) {
            case 'crawler':  drawMountainCrawlerGraphics(ctx, p);  break;
            case 'monster':  drawMonsterTruckGraphics(ctx, p);     break;
            case 'speedcar': drawRaceBuggyGraphics(ctx, p);        break;
            case 'rover':    drawMoonRoverGraphics(ctx, p);        break;
            case 'tank':     drawHeavyTankGraphics(ctx, p);        break;
            default:         drawRealisticVehicleGraphics(ctx, p); break;
        }

        ctx.restore();
    }
}

// Global Realistic Vehicle Drawing Function
function drawRealisticVehicleGraphics(ctx, p) {
    const mainColor = p.color || '#e74c3c'; // Iconic Red 4x4

    // 1. Suspension Springs / Axle Struts
    ctx.strokeStyle = '#7f8c8d';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-15, 0);
    ctx.lineTo(p.rearWheel.x, p.rearWheel.y);
    ctx.moveTo(15, 0);
    ctx.lineTo(p.frontWheel.x, p.frontWheel.y);
    ctx.stroke();

    // 2. Offroad Tread Wheels (Rear & Front)
    drawOffroadWheelGraphic(ctx, p.rearWheel.x, p.rearWheel.y, p.wheelRadius, p.rearWheel.rot);
    drawOffroadWheelGraphic(ctx, p.frontWheel.x, p.frontWheel.y, p.wheelRadius, p.frontWheel.rot);

    // 3. Driver Figure (Jumpsuit + Racing Helmet)
    // Driver Suit
    ctx.fillStyle = '#2980b9'; // Blue driver suit
    ctx.fillRect(-12, -18, 14, 14);

    // Driver Arm & Steering Wheel
    ctx.strokeStyle = '#2980b9';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-2, -12);
    ctx.lineTo(8, -8);
    ctx.stroke();

    ctx.strokeStyle = '#2c3e50';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(10, -8, 5, 0, Math.PI * 2);
    ctx.stroke();

    // Helmet (Yellow dome with dark visor)
    const headX = (p.headOffset && p.headOffset.x) || -4;
    const headY = (p.headOffset && p.headOffset.y) || -28;
    ctx.fillStyle = '#f1c40f'; // Iconic yellow helmet
    ctx.beginPath();
    ctx.arc(headX, headY, 9, 0, Math.PI * 2);
    ctx.fill();

    // Visor
    ctx.fillStyle = '#111111';
    ctx.beginPath();
    ctx.arc(headX + 3, headY - 1, 5, -Math.PI * 0.4, Math.PI * 0.4);
    ctx.fill();

    // 4. Main Jeep Chassis Body Contour
    ctx.fillStyle = mainColor;
    ctx.strokeStyle = '#111111';
    ctx.lineWidth = 2.5;

    ctx.beginPath();
    ctx.moveTo(-42, -5);    // Rear tail
    ctx.lineTo(-42, -16);   // Rear wall
    ctx.lineTo(-18, -16);   // Rear seat cutout
    ctx.lineTo(-18, -4);    // Seat floor
    ctx.lineTo(12, -4);     // Dashboard base
    ctx.lineTo(24, -14);    // Hood slope up
    ctx.lineTo(40, -14);    // Front hood tip
    ctx.lineTo(44, 2);      // Front bumper
    ctx.lineTo(-40, 2);     // Bottom belly
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Black Fender Flares over wheels
    ctx.fillStyle = '#1e272e';
    ctx.beginPath();
    ctx.arc(-35, 2, 22, Math.PI, 0);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(35, 2, 22, Math.PI, 0);
    ctx.fill();

    // Roll Cage Steel Frame (Black tubular bars)
    ctx.strokeStyle = '#2c3e50';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(-40, -16);
    ctx.lineTo(-30, -32);  // Rear bar up
    ctx.lineTo(10, -32);   // Top roof bar
    ctx.lineTo(14, -14);   // Windshield pillar down
    ctx.stroke();

    // Diagonal Cross Brace Bar
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-30, -32);
    ctx.lineTo(-18, -16);
    ctx.stroke();

    // Transparent Blue Windshield Glass
    ctx.fillStyle = 'rgba(52, 152, 219, 0.45)';
    ctx.beginPath();
    ctx.moveTo(10, -30);
    ctx.lineTo(22, -14);
    ctx.lineTo(12, -14);
    ctx.closePath();
    ctx.fill();

    // Headlight (Yellow glow tip)
    ctx.fillStyle = '#f1c40f';
    ctx.beginPath();
    ctx.arc(42, -6, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Front Bumper Bar (Metallic Silver)
    ctx.fillStyle = '#95a5a6';
    ctx.fillRect(41, 0, 5, 8);
}

// ============================================================
// RACE BUGGY - Low, aerodynamic open-wheel race car
// ============================================================
function drawRaceBuggyGraphics(ctx, p) {
    const bodyColor = p.color || '#9b59b6';

    // Suspension — thin pushrods
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-22, 4);
    ctx.lineTo(p.rearWheel.x, p.rearWheel.y);
    ctx.moveTo(22, 4);
    ctx.lineTo(p.frontWheel.x, p.frontWheel.y);
    ctx.stroke();

    // Sleek low wheels
    drawSkinnyRaceWheel(ctx, p.rearWheel.x, p.rearWheel.y, p.wheelRadius, p.rearWheel.rot);
    drawSkinnyRaceWheel(ctx, p.frontWheel.x, p.frontWheel.y, p.wheelRadius, p.frontWheel.rot);

    // Low aerodynamic body (side pod shape)
    ctx.fillStyle = bodyColor;
    ctx.strokeStyle = '#5d2d8c';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-38, 4);      // rear bottom
    ctx.lineTo(-38, -6);     // rear low wall
    ctx.lineTo(-22, -10);    // rear pod top
    ctx.lineTo(-8, -22);     // cockpit rear edge
    ctx.lineTo(10, -22);     // cockpit front edge
    ctx.lineTo(24, -10);     // nose top
    ctx.lineTo(38, -8);      // nose tip
    ctx.lineTo(40, 4);       // front underbelly
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Rear diffuser / low splitter
    ctx.fillStyle = '#4a235a';
    ctx.fillRect(-40, 0, 6, 6);

    // Front nose splitter
    ctx.fillStyle = '#4a235a';
    ctx.fillRect(38, -4, 8, 4);

    // Rear wing / airfoil
    ctx.fillStyle = '#333';
    ctx.fillRect(-36, -18, 28, 4);  // Main plane
    ctx.fillStyle = '#555';
    ctx.fillRect(-32, -18, 3, 8);   // Left endplate
    ctx.fillRect(-10, -18, 3, 8);   // Right endplate

    // Open cockpit (dark)
    ctx.fillStyle = '#1a0a2e';
    ctx.beginPath();
    ctx.ellipse(-2, -18, 9, 5, 0, Math.PI, Math.PI * 2);
    ctx.fill();

    // Driver helmet (small, low)
    ctx.fillStyle = '#e74c3c';
    ctx.beginPath();
    ctx.arc(-2, -22, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(1, -23, 4, -0.5, 0.5);
    ctx.fill();

    // Headlight
    ctx.fillStyle = '#f9e44a';
    ctx.beginPath();
    ctx.arc(40, -5, 3, 0, Math.PI * 2);
    ctx.fill();
}

function drawSkinnyRaceWheel(ctx, x, y, radius, rot) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);

    // Thin race tyre
    ctx.fillStyle = '#1b1b1b';
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();

    // Smooth race tread lines
    for (let i = 0; i < 4; i++) {
        const ang = (i / 4) * Math.PI * 2;
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(Math.cos(ang) * (radius - 2), Math.sin(ang) * (radius - 2));
        ctx.lineTo(Math.cos(ang + 0.4) * (radius - 2), Math.sin(ang + 0.4) * (radius - 2));
        ctx.stroke();
    }

    // Silver rim
    ctx.fillStyle = '#c0c0c0';
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.62, 0, Math.PI * 2);
    ctx.fill();

    // 10-spoke lightweight rim
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 10; i++) {
        const ang = (i / 10) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(ang) * radius * 0.58, Math.sin(ang) * radius * 0.58);
        ctx.stroke();
    }

    // Centre nut
    ctx.fillStyle = '#e74c3c';
    ctx.beginPath();
    ctx.arc(0, 0, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

// ============================================================
// MOON ROVER - Skeletal NASA-style rover frame
// ============================================================
function drawMoonRoverGraphics(ctx, p) {
    const bodyColor = p.color || '#3498db';

    // Suspension — exposed frame struts
    ctx.strokeStyle = '#aab';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-24, -2);
    ctx.lineTo(p.rearWheel.x, p.rearWheel.y);
    ctx.moveTo(24, -2);
    ctx.lineTo(p.frontWheel.x, p.frontWheel.y);
    ctx.stroke();

    // Large NASA-style foam wheels
    drawNASAWheel(ctx, p.rearWheel.x, p.rearWheel.y, p.wheelRadius, p.rearWheel.rot);
    drawNASAWheel(ctx, p.frontWheel.x, p.frontWheel.y, p.wheelRadius, p.frontWheel.rot);

    // Skeletal chassis frame (exposed box frame)
    ctx.strokeStyle = '#95a5a6';
    ctx.lineWidth = 3.5;
    // Bottom rail
    ctx.beginPath();
    ctx.moveTo(-38, 0);
    ctx.lineTo(38, 0);
    ctx.stroke();
    // Top rail
    ctx.beginPath();
    ctx.moveTo(-32, -16);
    ctx.lineTo(24, -16);
    ctx.stroke();
    // Vertical struts
    [-28, -10, 10, 22].forEach(x => {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, -16);
        ctx.stroke();
    });

    // Instrument box (body)
    ctx.fillStyle = bodyColor;
    ctx.strokeStyle = '#1a5276';
    ctx.lineWidth = 2;
    ctx.fillRect(-26, -24, 30, 10);
    ctx.strokeRect(-26, -24, 30, 10);

    // Solar panels
    ctx.fillStyle = '#1a3a6e';
    ctx.strokeStyle = '#2980b9';
    ctx.lineWidth = 1.5;
    ctx.fillRect(-40, -26, 14, 8);
    ctx.strokeRect(-40, -26, 14, 8);
    // Panel grid lines
    for (let i = 1; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(-40 + (14/3)*i, -26);
        ctx.lineTo(-40 + (14/3)*i, -18);
        ctx.stroke();
    }

    // Antenna mast
    ctx.strokeStyle = '#ecf0f1';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-2, -24);
    ctx.lineTo(-2, -38);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(-2, -40, 4, 0, Math.PI * 2);
    ctx.strokeStyle = '#f1c40f';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Camera/sensor head
    ctx.fillStyle = '#2c3e50';
    ctx.fillRect(10, -28, 12, 8);
    ctx.fillStyle = '#e74c3c';
    ctx.beginPath();
    ctx.arc(22, -24, 3, 0, Math.PI * 2);
    ctx.fill();

    // Headlamp
    ctx.fillStyle = '#fff9c4';
    ctx.beginPath();
    ctx.arc(36, -8, 3.5, 0, Math.PI * 2);
    ctx.fill();
}

function drawNASAWheel(ctx, x, y, radius, rot) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);

    // Wire-mesh wheel look
    ctx.strokeStyle = '#bdc3c7';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.stroke();

    // Spokes (12 wire spokes)
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 12; i++) {
        const ang = (i / 12) * Math.PI * 2;
        ctx.strokeStyle = i % 2 === 0 ? '#95a5a6' : '#7f8c8d';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(ang) * radius, Math.sin(ang) * radius);
        ctx.stroke();
    }

    // Inner hub
    ctx.fillStyle = '#3498db';
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.28, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1a5276';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Tread bumps (cleats around rim)
    ctx.fillStyle = '#95a5a6';
    for (let i = 0; i < 16; i++) {
        const ang = (i / 16) * Math.PI * 2;
        const tx = Math.cos(ang) * radius;
        const ty = Math.sin(ang) * radius;
        ctx.beginPath();
        ctx.arc(tx, ty, 2, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.restore();
}

// ============================================================
// HEAVY TANK - Military tank with turret and cannon
// ============================================================
function drawHeavyTankGraphics(ctx, p) {
    const hullColor = p.color || '#6b8e23'; // Olive drab
    const turretColor = '#556b2f';

    // Tank has no visible wheels — draw track rollers instead
    // (Still uses rear/front wheel for physics, but draw as track)
    const rw = p.rearWheel;
    const fw = p.frontWheel;

    // Draw tank track belt
    ctx.fillStyle = '#222';
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(rw.x - 2, rw.y - p.wheelRadius);
    ctx.lineTo(fw.x + 2, fw.y - p.wheelRadius);
    ctx.lineTo(fw.x + 2, fw.y + p.wheelRadius);
    ctx.lineTo(rw.x - 2, rw.y + p.wheelRadius);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Track tread segments along the bottom
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 1.5;
    const trackY = rw.y + p.wheelRadius - 3;
    const trackLeft = rw.x - 2;
    const trackRight = fw.x + 2;
    const segCount = 14;
    const segW = (trackRight - trackLeft) / segCount;
    for (let i = 0; i <= segCount; i++) {
        const tx = trackLeft + i * segW;
        ctx.beginPath();
        ctx.moveTo(tx, trackY - 6);
        ctx.lineTo(tx, trackY + 2);
        ctx.stroke();
    }

    // Track top (upper run)
    const topTrackY = rw.y - p.wheelRadius + 3;
    for (let i = 0; i <= segCount; i++) {
        const tx = trackLeft + i * segW;
        ctx.beginPath();
        ctx.moveTo(tx, topTrackY - 2);
        ctx.lineTo(tx, topTrackY + 5);
        ctx.stroke();
    }

    // Drive sprocket (rear)
    drawTankSprocket(ctx, rw.x, rw.y, p.wheelRadius, rw.rot);
    // Front idler wheel
    drawTankSprocket(ctx, fw.x, fw.y, p.wheelRadius, fw.rot);
    // Road wheels (3 small ones in middle)
    const midY = (rw.y + fw.y) / 2;
    const midX1 = rw.x + (fw.x - rw.x) * 0.33;
    const midX2 = rw.x + (fw.x - rw.x) * 0.66;
    const roadWheelR = p.wheelRadius * 0.55;
    drawTankSprocket(ctx, midX1, midY, roadWheelR, rw.rot * 0.8);
    drawTankSprocket(ctx, midX2, midY, roadWheelR, fw.rot * 0.8);

    // Hull body (main lower hull)
    ctx.fillStyle = hullColor;
    ctx.strokeStyle = '#3a5c1a';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(rw.x - 4, rw.y - p.wheelRadius + 4);   // rear bottom
    ctx.lineTo(rw.x - 4, -18);   // rear wall
    ctx.lineTo(-2, -22);          // top transition
    ctx.lineTo(fw.x - 8, -20);   // front slope top
    ctx.lineTo(fw.x + 4, -10);   // glacis plate
    ctx.lineTo(fw.x + 4, fw.y - p.wheelRadius + 4);  // front bottom
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Hull camouflage stripes
    ctx.strokeStyle = '#4a6f10';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-30, -22);
    ctx.lineTo(-18, -14);
    ctx.moveTo(0, -22);
    ctx.lineTo(10, -15);
    ctx.stroke();

    // Turret (rotated slightly)
    ctx.fillStyle = turretColor;
    ctx.strokeStyle = '#2d4a0a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(-8, -30, 24, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Cannon barrel (main gun)
    ctx.fillStyle = '#2c3e50';
    ctx.strokeStyle = '#1a252f';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(8, -32);
    ctx.lineTo(52, -32);
    ctx.lineTo(52, -28);
    ctx.lineTo(8, -28);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Muzzle brake
    ctx.fillStyle = '#2c3e50';
    ctx.fillRect(50, -34, 5, 10);

    // Commander's hatch (cupola)
    ctx.fillStyle = '#4a6f1e';
    ctx.strokeStyle = '#2d4a0a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(-16, -40, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Machine gun on cupola
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-10, -42);
    ctx.lineTo(4, -42);
    ctx.stroke();

    // Turret detail — hatch bolt ring
    ctx.strokeStyle = '#2d4a0a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(-16, -40, 4, 0, Math.PI * 2);
    ctx.stroke();

    // Side armour plate detail
    ctx.strokeStyle = '#4a6f10';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(rw.x + 8, -18);
    ctx.lineTo(fw.x - 6, -18);
    ctx.stroke();
}

function drawTankSprocket(ctx, x, y, radius, rot) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);

    // Sprocket body
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();

    // Sprocket teeth
    ctx.fillStyle = '#444';
    const teeth = 8;
    for (let i = 0; i < teeth; i++) {
        const ang = (i / teeth) * Math.PI * 2;
        const tx = Math.cos(ang) * (radius - 1);
        const ty = Math.sin(ang) * (radius - 1);
        ctx.beginPath();
        ctx.arc(tx, ty, 4, 0, Math.PI * 2);
        ctx.fill();
    }

    // Hub
    ctx.fillStyle = '#555';
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.45, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}


// ============================================================
// MOUNTAIN CRAWLER - Rugged lifted off-road pickup truck
// ============================================================
function drawMountainCrawlerGraphics(ctx, p) {
    const bodyColor = p.color || '#27ae60';

    // Suspension arms (long travel)
    ctx.strokeStyle = '#7f8c8d';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(-20, 4);
    ctx.lineTo(p.rearWheel.x, p.rearWheel.y);
    ctx.moveTo(20, 4);
    ctx.lineTo(p.frontWheel.x, p.frontWheel.y);
    ctx.stroke();

    // Big chunky off-road wheels
    drawChunkyOffRoadWheel(ctx, p.rearWheel.x, p.rearWheel.y, p.wheelRadius, p.rearWheel.rot, '#e74c3c');
    drawChunkyOffRoadWheel(ctx, p.frontWheel.x, p.frontWheel.y, p.wheelRadius, p.frontWheel.rot, '#e74c3c');

    // High-clearance chassis body
    ctx.fillStyle = bodyColor;
    ctx.strokeStyle = '#145a32';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-44, -2);    // Rear tail
    ctx.lineTo(-44, -18);   // Rear wall
    ctx.lineTo(-20, -18);   // Bed-cabin join
    ctx.lineTo(-20, -36);   // Cabin roof rear
    ctx.lineTo(16, -36);    // Cabin roof front
    ctx.lineTo(26, -22);    // Windshield slope
    ctx.lineTo(44, -22);    // Hood top
    ctx.lineTo(48, -2);     // Front bumper
    ctx.lineTo(-44, -2);    // Belly
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Pickup bed (darker tray)
    ctx.fillStyle = '#1a5e2e';
    ctx.beginPath();
    ctx.rect(-42, -18, 22, 16);
    ctx.fill();
    ctx.strokeStyle = '#0a3d1e';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Fender flares (black arches over big wheels)
    ctx.fillStyle = '#1c1c1c';
    ctx.beginPath();
    ctx.arc(-38, -2, 26, Math.PI * 1.0, 0, false);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(38, -2, 26, Math.PI * 1.0, 0, false);
    ctx.fill();

    // Roll bar / A-pillar + roof bar
    ctx.strokeStyle = '#0a3d1e';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-20, -18);
    ctx.lineTo(-20, -36);
    ctx.moveTo(16, -36);
    ctx.lineTo(24, -22);
    ctx.moveTo(-20, -36);
    ctx.lineTo(16, -36);  // roof bar
    ctx.stroke();

    // Windshield glass
    ctx.fillStyle = 'rgba(52,152,219,0.4)';
    ctx.beginPath();
    ctx.moveTo(-20, -36);
    ctx.lineTo(16, -36);
    ctx.lineTo(26, -22);
    ctx.lineTo(-20, -22);
    ctx.closePath();
    ctx.fill();

    // Big front bull bar
    ctx.fillStyle = '#7f8c8d';
    ctx.fillRect(46, -18, 6, 16);
    ctx.fillRect(44, -20, 10, 4); // Top crossbar

    // Snorkel (off-road air intake)
    ctx.fillStyle = '#555';
    ctx.fillRect(-22, -46, 5, 12);
    ctx.fillStyle = '#333';
    ctx.fillRect(-23, -48, 7, 4);

    // Headlight
    ctx.fillStyle = '#f9e44a';
    ctx.beginPath();
    ctx.arc(46, -10, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Driver figure
    ctx.fillStyle = '#6c3483'; // Purple jumpsuit
    ctx.fillRect(-12, -30, 12, 12);

    // Helmet
    ctx.fillStyle = '#e67e22'; // Orange helmet
    ctx.beginPath();
    ctx.arc(-4, -34, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(-1, -35, 5, -Math.PI * 0.4, Math.PI * 0.4);
    ctx.fill();
}

// Chunky off-road wheel (bigger treads)
function drawChunkyOffRoadWheel(ctx, x, y, radius, rot, hubColor) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);

    // Wide mud tyre
    ctx.fillStyle = '#151515';
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();

    // Aggressive tread blocks (6 wide knobs)
    ctx.fillStyle = '#0a0a0a';
    for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2;
        const tx = Math.cos(ang) * (radius - 2);
        const ty = Math.sin(ang) * (radius - 2);
        ctx.save();
        ctx.translate(tx, ty);
        ctx.rotate(ang);
        ctx.fillRect(-3, -5, 6, 10); // wider rectangular lugs
        ctx.restore();
    }

    // Center rim (steel look)
    ctx.fillStyle = '#95a5a6';
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.52, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#2c3e50';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 6-bolt pattern
    ctx.strokeStyle = '#2c3e50';
    ctx.lineWidth = 3;
    for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(ang) * (radius * 0.48), Math.sin(ang) * (radius * 0.48));
        ctx.stroke();
    }

    // Hub cap
    ctx.fillStyle = hubColor || '#e74c3c';
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

// ============================================================
// MONSTER TRUCK - Huge and imposing
// ============================================================
function drawMonsterTruckGraphics(ctx, p) {
    const bodyColor = p.color || '#e74c3c';

    // Monster suspension struts (very long travel)
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(-18, 6);
    ctx.lineTo(p.rearWheel.x, p.rearWheel.y);
    ctx.moveTo(18, 6);
    ctx.lineTo(p.frontWheel.x, p.frontWheel.y);
    ctx.stroke();

    // Monster wheels
    drawOffroadWheelGraphic(ctx, p.rearWheel.x, p.rearWheel.y, p.wheelRadius, p.rearWheel.rot);
    drawOffroadWheelGraphic(ctx, p.frontWheel.x, p.frontWheel.y, p.wheelRadius, p.frontWheel.rot);

    // Tall, wide monster body
    ctx.fillStyle = bodyColor;
    ctx.strokeStyle = '#78281f';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-50, 4);
    ctx.lineTo(-50, -20);
    ctx.lineTo(-25, -20);
    ctx.lineTo(-25, -40);
    ctx.lineTo(20, -40);
    ctx.lineTo(38, -20);
    ctx.lineTo(50, -20);
    ctx.lineTo(50, 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Fender arches (extra wide)
    ctx.fillStyle = '#1c1c1c';
    ctx.beginPath(); ctx.arc(-42, 4, 32, Math.PI * 1.0, 0); ctx.fill();
    ctx.beginPath(); ctx.arc(42, 4, 32, Math.PI * 1.0, 0); ctx.fill();

    // Windshield
    ctx.fillStyle = 'rgba(52,152,219,0.4)';
    ctx.beginPath();
    ctx.moveTo(-24, -40);
    ctx.lineTo(20, -40);
    ctx.lineTo(38, -20);
    ctx.lineTo(-24, -20);
    ctx.closePath();
    ctx.fill();

    // Exhaust pipes (dual)
    ctx.fillStyle = '#7f8c8d';
    ctx.fillRect(-52, -28, 5, 18);
    ctx.fillRect(-58, -28, 5, 18);

    // Headlight
    ctx.fillStyle = '#f9e44a';
    ctx.beginPath(); ctx.arc(50, -6, 5, 0, Math.PI * 2); ctx.fill();

    // Driver
    ctx.fillStyle = '#1a5276';
    ctx.fillRect(-14, -34, 14, 14);
    ctx.fillStyle = '#f39c12'; // Yellow helmet
    ctx.beginPath(); ctx.arc(-5, -38, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.arc(-2, -39, 5, -Math.PI * 0.4, Math.PI * 0.4); ctx.fill();
}

function drawOffroadWheelGraphic(ctx, x, y, radius, rot) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);

    // Rubber Tire Outer Body
    ctx.fillStyle = '#1b1b1b';
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();

    // Offroad Tire Treads (8 teeth around circumference)
    ctx.fillStyle = '#0f0f0f';
    for (let i = 0; i < 8; i++) {
        const ang = (i / 8) * Math.PI * 2;
        const tx = Math.cos(ang) * (radius + 2);
        const ty = Math.sin(ang) * (radius + 2);
        ctx.beginPath();
        ctx.arc(tx, ty, 3, 0, Math.PI * 2);
        ctx.fill();
    }

    // Inner Metallic Alloy Rim
    ctx.fillStyle = '#bdc3c7';
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.58, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#2c3e50';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Alloy Wheel 5-Spoke Pattern
    ctx.strokeStyle = '#2c3e50';
    ctx.lineWidth = 2.5;
    for (let i = 0; i < 5; i++) {
        const ang = (i / 5) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(ang) * (radius * 0.55), Math.sin(ang) * (radius * 0.55));
        ctx.stroke();
    }

    // Center Hubcap
    ctx.fillStyle = '#e74c3c';
    ctx.beginPath();
    ctx.arc(0, 0, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}
