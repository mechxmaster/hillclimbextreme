/* ==========================================================================
   HILL CLIMB RACING EXTREME - MAIN APP CONTROLLER (js/app.js)
   ========================================================================== */

class AppController {
    constructor() {
        this.cardManager = new CardManager();
        this.gameEngine = new GameEngine();

        // Player Data State
        this.player = {
            name: 'Driver 1',
            avatar: '🏎️',
            coins: 1000,
            gems: 20,
            totalDistance: 0,
            totalCoinsEarned: 0,
            totalFlips: 0,
            stageRecords: { highway: 0, countryside: 0, desert: 0, moon: 0, arctic: 0, volcano: 0 }
        };

        this.selectedStageId = 'highway';
    }

    init() {
        this.loadProfile();

        // Initialize Canvas
        const gameCanvas = document.getElementById('game-canvas');
        if (gameCanvas) {
            this.gameEngine.init(gameCanvas);
            this.gameEngine.onGameOver = (results) => this.handleGameOver(results);
        }

        this.bindEvents();
        this.renderDashboard();
    }

    loadProfile() {
        const saved = localStorage.getItem('hillclimb_player_save');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                this.player = { ...this.player, ...parsed.player };
                this.cardManager.loadState(parsed.cards);
            } catch (e) {
                console.warn("Failed to load save data:", e);
            }
        } else {
            // Show Login Modal on first launch
            this.showModal('login-modal');
        }
    }

    saveProfile() {
        const data = {
            player: this.player,
            cards: this.cardManager.getSaveState()
        };
        localStorage.setItem('hillclimb_player_save', JSON.stringify(data));
        this.updateHeaderBadges();

        // Submit driver details to the Express Backend API
        fetch('/api/leaderboard', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: this.player.name,
                avatar: this.player.avatar,
                distance: this.player.totalDistance
            })
        }).catch(err => console.warn("Leaderboard backend offline, saving locally."));
    }

    updateHeaderBadges() {
        document.getElementById('player-name').innerText = this.player.name;
        document.getElementById('player-coins').innerText = this.player.coins;
        document.getElementById('player-gems').innerText = this.player.gems;
    }

    bindEvents() {
        // Top Bar Buttons
        document.getElementById('profile-btn').addEventListener('click', () => {
            this.showModal('login-modal');
        });

        document.getElementById('sound-toggle-btn').addEventListener('click', (e) => {
            const muted = soundEngine.toggleMute();
            e.target.innerText = muted ? '🔇' : '🔊';
        });

        // Login Form
        document.getElementById('login-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const nameInput = document.getElementById('username-input').value.trim();
            const avatarInput = document.querySelector('input[name="avatar"]:checked').value;
            if (nameInput) {
                this.player.name = nameInput;
                this.player.avatar = avatarInput;
                this.saveProfile();
                this.hideModal('login-modal');
            }
        });

        // Dashboard Tabs Navigation
        const tabBtns = document.querySelectorAll('.tab-btn');
        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const targetTab = btn.getAttribute('data-tab');
                tabBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                const content = document.getElementById(`tab-${targetTab}`);
                if (content) content.classList.add('active');

                soundEngine.playClick();
                if (targetTab === 'stats') this.renderStats();
                if (targetTab === 'leaderboard') this.fetchLeaderboard();
            });
        });

        // Garage Upgrade Buttons
        ['engine', 'suspension', 'tires', 'drive'].forEach(stat => {
            const btn = document.getElementById(`btn-upgrade-${stat}`);
            if (btn) {
                btn.addEventListener('click', () => {
                    const vehId = this.cardManager.selectedVehicleId;
                    const spent = this.cardManager.upgradeStat(vehId, stat, this.player.coins);
                    if (spent !== false) {
                        this.player.coins -= spent;
                        soundEngine.playClick();
                        this.saveProfile();
                        this.renderVehicleDetails();
                    }
                });
            }
        });

        // Start Race Button
        document.getElementById('start-race-btn').addEventListener('click', () => {
            this.switchScreen('game-screen');
            const vehConfig = this.cardManager.getVehicleConfig();
            this.gameEngine.start(vehConfig, this.selectedStageId);
        });

        // Chest Shop Buttons
        document.getElementById('open-daily-chest').addEventListener('click', () => {
            this.openChestAnimation('free');
        });
        document.getElementById('open-gold-chest').addEventListener('click', () => {
            if (this.player.coins >= 500) {
                this.player.coins -= 500;
                this.saveProfile();
                this.openChestAnimation('gold');
            }
        });
        document.getElementById('open-epic-chest').addEventListener('click', () => {
            if (this.player.gems >= 50) {
                this.player.gems -= 50;
                this.saveProfile();
                this.openChestAnimation('epic');
            }
        });
        document.getElementById('close-chest-btn').addEventListener('click', () => {
            this.hideModal('chest-modal');
        });

        // Pause Modal Buttons
        document.getElementById('pause-game-btn').addEventListener('click', () => {
            this.gameEngine.pause();
            this.showModal('pause-modal');
        });
        document.getElementById('resume-btn').addEventListener('click', () => {
            this.hideModal('pause-modal');
            this.gameEngine.resume();
        });
        document.getElementById('restart-btn').addEventListener('click', () => {
            this.hideModal('pause-modal');
            const vehConfig = this.cardManager.getVehicleConfig();
            this.gameEngine.start(vehConfig, this.selectedStageId);
        });
        document.getElementById('quit-to-home-btn').addEventListener('click', () => {
            this.gameEngine.stop();
            this.hideModal('pause-modal');
            this.switchScreen('dashboard-screen');
            this.renderDashboard();
        });

        // Game Over Buttons
        document.getElementById('retry-game-btn').addEventListener('click', () => {
            this.hideModal('gameover-modal');
            const vehConfig = this.cardManager.getVehicleConfig();
            this.gameEngine.start(vehConfig, this.selectedStageId);
        });
        document.getElementById('gameover-home-btn').addEventListener('click', () => {
            this.hideModal('gameover-modal');
            this.switchScreen('dashboard-screen');
            this.renderDashboard();
        });

        // Setup Controls (Keyboard & Touch Pedals)
        this.bindControls();
    }

    bindControls() {
        const gasPedal = document.getElementById('pedal-gas');
        const brakePedal = document.getElementById('pedal-brake');

        // Touch & Mouse Pedals
        const setGas = (val) => {
            if (this.gameEngine.physics) this.gameEngine.physics.gasInput = val;
            if (gasPedal) gasPedal.classList.toggle('pressed', val > 0);
        };
        const setBrake = (val) => {
            if (this.gameEngine.physics) this.gameEngine.physics.brakeInput = val;
            if (brakePedal) brakePedal.classList.toggle('pressed', val > 0);
        };

        if (gasPedal) {
            gasPedal.addEventListener('mousedown', () => setGas(1));
            gasPedal.addEventListener('mouseup', () => setGas(0));
            gasPedal.addEventListener('touchstart', (e) => { e.preventDefault(); setGas(1); });
            gasPedal.addEventListener('touchend', (e) => { e.preventDefault(); setGas(0); });
        }

        if (brakePedal) {
            brakePedal.addEventListener('mousedown', () => setBrake(1));
            brakePedal.addEventListener('mouseup', () => setBrake(0));
            brakePedal.addEventListener('touchstart', (e) => { e.preventDefault(); setBrake(1); });
            brakePedal.addEventListener('touchend', (e) => { e.preventDefault(); setBrake(0); });
        }

        // Keyboard Controls
        window.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') setGas(1);
            if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') setBrake(1);
        });

        window.addEventListener('keyup', (e) => {
            if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') setGas(0);
            if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') setBrake(0);
        });
    }

    renderDashboard() {
        this.updateHeaderBadges();
        this.renderVehicleCarousel();
        this.renderVehicleDetails();
        this.renderStageCards();
    }

    renderVehicleCarousel() {
        const container = document.getElementById('vehicle-card-list');
        if (!container) return;
        container.innerHTML = '';

        Object.values(VEHICLES_DATABASE).forEach(veh => {
            const isUnlocked = this.cardManager.unlockedVehicles.includes(veh.id);
            const isSelected = this.cardManager.selectedVehicleId === veh.id;

            const card = document.createElement('div');
            card.className = `vehicle-card ${isSelected ? 'active' : ''} ${!isUnlocked ? 'locked' : ''}`;
            card.innerHTML = `
                <div class="card-info">
                    <h4>${veh.icon} ${veh.name}</h4>
                    <span class="rarity-tag rarity-${veh.rarity}">${veh.rarity}</span>
                </div>
                <div class="card-action">
                    ${isUnlocked ? (isSelected ? 'SELECTED ✅' : 'SELECT ➡️') : `🪙 ${veh.cost}`}
                </div>
            `;

            card.addEventListener('click', () => {
                if (isUnlocked) {
                    this.cardManager.selectedVehicleId = veh.id;
                    this.saveProfile();
                    this.renderDashboard();
                } else if (this.player.coins >= veh.cost) {
                    this.player.coins -= veh.cost;
                    this.cardManager.unlockedVehicles.push(veh.id);
                    this.cardManager.selectedVehicleId = veh.id;
                    soundEngine.playCoin();
                    this.saveProfile();
                    this.renderDashboard();
                }
            });

            container.appendChild(card);
        });
    }

    renderVehicleDetails() {
        const config = this.cardManager.getVehicleConfig();
        const vehName = document.getElementById('selected-vehicle-name');
        const vehRarity = document.getElementById('selected-vehicle-rarity');

        if (vehName) vehName.innerText = config.name;
        if (vehRarity) {
            vehRarity.innerText = config.rarity.toUpperCase();
            vehRarity.className = `rarity-tag rarity-${config.rarity}`;
        }

        // Draw preview in garage canvas
        const canvas = document.getElementById('garage-vehicle-canvas');
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Draw a nice gradient background for the preview
            const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
            grad.addColorStop(0, 'rgba(20,30,50,0.9)');
            grad.addColorStop(1, 'rgba(10,15,25,0.9)');
            ctx.fillStyle = grad;
            ctx.roundRect(0, 0, canvas.width, canvas.height, 12);
            ctx.fill();

            // Draw ground reference line
            ctx.strokeStyle = 'rgba(255,255,255,0.08)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(20, canvas.height / 2 + 32);
            ctx.lineTo(canvas.width - 20, canvas.height / 2 + 32);
            ctx.stroke();

            ctx.save();
            ctx.translate(canvas.width / 2, canvas.height / 2 + 10);

            // Build a mockPhysics object matching the shape the draw functions expect
            const mockPhysics = {
                vehicleId: config.id,
                color: config.color,
                chassisWidth: config.chassisWidth,
                chassisHeight: config.chassisHeight,
                wheelRadius: config.wheelRadius,
                rearWheel:  { x: -(config.chassisWidth * 0.48), y: config.wheelRadius - 4, rot: 0 },
                frontWheel: { x:  (config.chassisWidth * 0.48), y: config.wheelRadius - 4, rot: 0 },
                headOffset: { x: -4, y: -28 }
            };

            // Dispatch to the correct vehicle draw function
            switch (config.id) {
                case 'crawler':  if (typeof drawMountainCrawlerGraphics  === 'function') drawMountainCrawlerGraphics(ctx, mockPhysics);  break;
                case 'monster':  if (typeof drawMonsterTruckGraphics      === 'function') drawMonsterTruckGraphics(ctx, mockPhysics);      break;
                case 'speedcar': if (typeof drawRaceBuggyGraphics         === 'function') drawRaceBuggyGraphics(ctx, mockPhysics);         break;
                case 'rover':    if (typeof drawMoonRoverGraphics          === 'function') drawMoonRoverGraphics(ctx, mockPhysics);          break;
                case 'tank':     if (typeof drawHeavyTankGraphics          === 'function') drawHeavyTankGraphics(ctx, mockPhysics);          break;
                default:         if (typeof drawRealisticVehicleGraphics   === 'function') drawRealisticVehicleGraphics(ctx, mockPhysics);   break;
            }
            ctx.restore();
        }

        // Update Upgrade Level Bars & Cost
        ['engine', 'suspension', 'tires', 'drive'].forEach(stat => {
            const lvlEl = document.getElementById(`lvl-${stat}`);
            const barEl = document.getElementById(`bar-${stat}`);
            const btnEl = document.getElementById(`btn-upgrade-${stat}`);

            const currentLvl = config[`${stat}Level`] || 1;
            const cost = this.cardManager.getUpgradeCost(config.id, stat);

            if (lvlEl) lvlEl.innerText = `Lvl ${currentLvl}`;
            if (barEl) barEl.style.width = `${Math.min(100, currentLvl * 15)}%`;
            if (btnEl) {
                btnEl.querySelector('.cost').innerText = cost;
                btnEl.classList.toggle('disabled', this.player.coins < cost);
            }
        });
    }

    renderStageCards() {
        const container = document.getElementById('stage-cards-list');
        if (!container) return;
        container.innerHTML = '';

        // Bright, vivid gradient backgrounds for each stage
        const stageStyles = {
            highway: {
                thumb: 'linear-gradient(135deg, #1c2833 0%, #34495e 50%, #5d6d7e 100%)',
                icon: '🛣️', accent: '#f1c40f'
            },
            countryside: {
                thumb: 'linear-gradient(135deg, #1a6b2f 0%, #27ae60 50%, #82e0aa 100%)',
                icon: '🏔️', accent: '#2ecc71'
            },
            desert: {
                thumb: 'linear-gradient(135deg, #7d3c00 0%, #d35400 50%, #f39c12 100%)',
                icon: '🏜️', accent: '#f39c12'
            },
            moon: {
                thumb: 'linear-gradient(135deg, #0b0c10 0%, #1f2833 60%, #45535e 100%)',
                icon: '🌕', accent: '#bdc3c7'
            },
            arctic: {
                thumb: 'linear-gradient(135deg, #003f6e 0%, #0288d1 50%, #81d4fa 100%)',
                icon: '❄️', accent: '#81d4fa'
            },
            volcano: {
                thumb: 'linear-gradient(135deg, #4a0000 0%, #8b0000 50%, #e74c3c 100%)',
                icon: '🌋', accent: '#e74c3c'
            }
        };

        Object.values(STAGE_THEMES).forEach(stg => {
            const isSelected = this.selectedStageId === stg.id;
            const recordMeters = this.player.stageRecords[stg.id] || 0;
            const style = stageStyles[stg.id] || { thumb: 'linear-gradient(135deg,#222,#444)', icon: stg.icon, accent: '#aaa' };

            const card = document.createElement('div');
            card.className = `stage-card ${isSelected ? 'active' : ''} ${!stg.unlocked ? 'locked' : ''}`;
            card.style.setProperty('--stage-accent', style.accent);
            card.innerHTML = `
                <div class="stage-thumb" style="background: ${style.thumb};">
                    <div class="stage-thumb-icon">${style.icon}</div>
                    ${isSelected ? '<div class="stage-selected-badge">✓ SELECTED</div>' : ''}
                    ${!stg.unlocked ? `<div class="stage-lock-badge">🪙 ${stg.cost}</div>` : ''}
                </div>
                <div class="stage-body">
                    <h3 style="color:${style.accent}">${stg.name}</h3>
                    <div class="stage-record">🏆 BEST: ${recordMeters} m</div>
                    <div class="stage-meta">
                        <span class="stage-gravity">🌍 ${stg.gravity < 0.2 ? 'LOW GRAVITY' : stg.gravity > 0.38 ? 'HEAVY' : 'NORMAL'}</span>
                    </div>
                </div>
            `;

            card.addEventListener('click', () => {
                if (!stg.unlocked && this.player.coins >= stg.cost) {
                    this.player.coins -= stg.cost;
                    stg.unlocked = true;
                    soundEngine.playCoin();
                    this.saveProfile();
                }
                if (stg.unlocked) {
                    this.selectedStageId = stg.id;
                    soundEngine.playClick();
                }
                this.renderStageCards();
            });

            container.appendChild(card);
        });
    }

    renderStats() {
        document.getElementById('stat-total-dist').innerText = `${this.player.totalDistance} m`;
        document.getElementById('stat-total-coins').innerText = `${this.player.totalCoinsEarned} 🪙`;
        document.getElementById('stat-total-flips').innerText = `${this.player.totalFlips}`;
        document.getElementById('stat-stages-count').innerText = `${Object.keys(STAGE_THEMES).length} Unlocked`;
        document.getElementById('stat-vehicles-count').innerText = `${this.cardManager.unlockedVehicles.length} / ${Object.keys(VEHICLES_DATABASE).length}`;
    }

    fetchLeaderboard() {
        const lbContainer = document.getElementById('leaderboard-list');
        if (!lbContainer) return;
        lbContainer.innerHTML = '<div style="text-align:center; padding:20px; color:#a0aec0;">Loading Global Rankings... 🔄</div>';

        // Submit/update score before fetching to ensure rank is updated
        fetch('/api/leaderboard', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: this.player.name,
                avatar: this.player.avatar,
                distance: this.player.totalDistance
            })
        })
        .then(() => fetch('/api/leaderboard'))
        .then(res => res.json())
        .then(data => {
            lbContainer.innerHTML = '';
            
            if (!Array.isArray(data) || data.length === 0) {
                lbContainer.innerHTML = '<div style="text-align:center; padding:20px; color:#e74c3c;">No scores posted yet! Drive to post yours.</div>';
                return;
            }

            // Render rows
            data.forEach((item, index) => {
                const rank = index + 1;
                let rankDisplay = `#${rank}`;
                if (rank === 1) rankDisplay = "🥇 1st";
                else if (rank === 2) rankDisplay = "🥈 2nd";
                else if (rank === 3) rankDisplay = "🥉 3rd";

                const isCurrentPlayer = item.name.toLowerCase() === this.player.name.toLowerCase();

                const row = document.createElement('div');
                row.className = `leaderboard-row ${isCurrentPlayer ? 'player-row' : ''}`;
                row.innerHTML = `
                    <span class="lb-col-rank rank-badge-${rank}">${rankDisplay}</span>
                    <span class="lb-col-driver">${item.avatar} ${item.name} ${isCurrentPlayer ? '<strong>(YOU)</strong>' : ''}</span>
                    <span class="lb-col-dist">${item.distance.toLocaleString()} m</span>
                `;
                lbContainer.appendChild(row);
            });
        })
        .catch(err => {
            console.error("Leaderboard fetch error:", err);
            lbContainer.innerHTML = `
                <div style="text-align:center; padding:20px; color:#e74c3c; line-height:1.6;">
                    <strong>Leaderboard Server is Offline</strong><br/>
                    Start the Express backend by running:<br/>
                    <code style="background:rgba(0,0,0,0.5); padding:2px 6px; border-radius:4px; font-family:monospace;">npm start</code> in your project directory!
                </div>
            `;
        });
    }

    openChestAnimation(chestType) {
        const loot = this.cardManager.openChest(chestType);
        const container = document.getElementById('loot-cards-list');
        if (!container) return;
        container.innerHTML = '';

        loot.forEach(item => {
            if (item.type === 'coins') this.player.coins += item.amount;
            if (item.type === 'gems') this.player.gems += item.amount;

            const card = document.createElement('div');
            card.className = 'vehicle-card';
            card.style.minWidth = '140px';
            card.innerHTML = `
                <div class="card-info" style="text-align: center; width: 100%;">
                    <div style="font-size: 2.5rem;">${item.icon}</div>
                    <h4>${item.amount ? `+${item.amount}` : item.name}</h4>
                </div>
            `;
            container.appendChild(card);
        });

        this.saveProfile();
        this.showModal('chest-modal');
    }

    handleGameOver(results) {
        // Update High score records
        if (results.distance > (this.player.stageRecords[this.selectedStageId] || 0)) {
            this.player.stageRecords[this.selectedStageId] = results.distance;
        }
        this.player.coins += results.totalEarnedCoins;
        this.player.gems += results.gems;
        this.player.totalDistance += results.distance;
        this.player.totalCoinsEarned += results.totalEarnedCoins;

        this.saveProfile();

        // Update Game Over Modal UI
        document.getElementById('gameover-reason').innerText = results.reason;
        document.getElementById('summary-distance').innerText = `${results.distance} m`;
        document.getElementById('summary-coins').innerText = `${results.coins} 🪙`;
        document.getElementById('summary-flips').innerText = `${results.flipBonus} 🪙`;
        document.getElementById('summary-total').innerText = `${results.totalEarnedCoins} 🪙`;

        this.showModal('gameover-modal');
    }

    switchScreen(screenId) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        const screen = document.getElementById(screenId);
        if (screen) screen.classList.add('active');
    }

    showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.classList.add('active');
    }

    hideModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.classList.remove('active');
    }
}

// Initialize Application when DOM ready
window.addEventListener('DOMContentLoaded', () => {
    const app = new AppController();
    app.init();
});
