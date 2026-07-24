const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 8080;
const DATA_FILE = path.join(__dirname, 'leaderboard.json');

app.use(cors());
app.use(express.json());

// Serve static game client files
app.use(express.static(__dirname));

// Initialize leaderboard file with default real-looking community drivers if it doesn't exist
if (!fs.existsSync(DATA_FILE)) {
    const initialLeaderboard = [
        { name: "MaxTorque", avatar: "🏎️", distance: 15430 },
        { name: "HillKing", avatar: "🚙", distance: 12050 },
        { name: "AlienRacer", avatar: "👽", distance: 9840 },
        { name: "LunarRover9", avatar: "👩‍🚀", distance: 7520 },
        { name: "MudCrawler", avatar: "🚜", distance: 5410 },
        { name: "TurboRookie", avatar: "🐱", distance: 2310 }
    ];
    fs.writeFileSync(DATA_FILE, JSON.stringify(initialLeaderboard, null, 2));
}

// GET: Fetch sorted leaderboard list
app.get('/api/leaderboard', (req, res) => {
    try {
        const fileData = fs.readFileSync(DATA_FILE, 'utf8');
        let leaderboard = JSON.parse(fileData);
        // Sort descending by distance
        leaderboard.sort((a, b) => b.distance - a.distance);
        res.json(leaderboard);
    } catch (error) {
        console.error("Error reading leaderboard:", error);
        res.status(500).json({ error: "Failed to load leaderboard data" });
    }
});

// POST: Submit/update player score
app.post('/api/leaderboard', (req, res) => {
    try {
        const { name, avatar, distance } = req.body;
        if (!name || !avatar || typeof distance !== 'number') {
            return res.status(400).json({ error: "Invalid name, avatar, or distance" });
        }

        const fileData = fs.readFileSync(DATA_FILE, 'utf8');
        let leaderboard = JSON.parse(fileData);

        // Find existing driver with the same unique name
        const existingIndex = leaderboard.findIndex(p => p.name.toLowerCase() === name.toLowerCase());

        if (existingIndex !== -1) {
            // Update only if the new distance is higher than the previous record
            if (distance > leaderboard[existingIndex].distance) {
                leaderboard[existingIndex].distance = distance;
                leaderboard[existingIndex].avatar = avatar; // Update avatar if changed
            }
        } else {
            // Add new unique driver
            leaderboard.push({ name, avatar, distance });
        }

        // Save back to JSON file
        fs.writeFileSync(DATA_FILE, JSON.stringify(leaderboard, null, 2));
        res.json({ success: true, message: "Score updated successfully" });
    } catch (error) {
        console.error("Error saving leaderboard:", error);
        res.status(500).json({ error: "Failed to save leaderboard data" });
    }
});

app.listen(PORT, () => {
    console.log(`Hill Climb Extreme Server running at http://localhost:${PORT}`);
});
