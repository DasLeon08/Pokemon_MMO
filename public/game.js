const socket = io();

// UI Elements
const lobbyContainer = document.getElementById('lobby-container');
const gameContainer = document.getElementById('game-container');
const uiOverlay = document.getElementById('ui-overlay');
const createRoomBtn = document.getElementById('createRoomBtn');
const joinRoomBtn = document.getElementById('joinRoomBtn');
const roomInput = document.getElementById('roomInput');
const lobbyMessage = document.getElementById('lobbyMessage');
const levelDisplay = document.getElementById('levelDisplay');
const expDisplay = document.getElementById('expDisplay');
const expNeededDisplay = document.getElementById('expNeededDisplay');
const gainExpBtn = document.getElementById('gainExpBtn');

// 2D Canvas Setup
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- Maps & Environment ---
let portals = [];
let mapObjects = [];
let backgroundColor = '#87CEEB';

function clearMap() {
    mapObjects = [];
    portals = [];
}

function buildCityMap() {
    clearMap();
    backgroundColor = '#87CEEB'; // Sky blue

    // Buildings
    for (let i = 0; i < 20; i++) {
        mapObjects.push({
            type: 'building',
            x: Math.random() * 700 + 50,
            y: Math.random() * 500 + 50,
            w: 40,
            h: 40,
            color: '#b0c4de'
        });
    }

    // Trees
    for (let i = 0; i < 30; i++) {
        mapObjects.push({
            type: 'tree',
            x: Math.random() * 750 + 25,
            y: Math.random() * 550 + 25,
            radius: 15,
            color: '#2d8a36'
        });
    }

    // Portal to Dungeon
    createPortal(400, 100, 'dungeon', 'Enter Dungeon');
}

function buildDungeonMap() {
    clearMap();
    backgroundColor = '#333333'; // Dark

    // Walls
    mapObjects.push({ type: 'wall', x: 0, y: 0, w: 800, h: 40, color: '#555' }); // Top
    mapObjects.push({ type: 'wall', x: 0, y: 560, w: 800, h: 40, color: '#555' }); // Bottom
    mapObjects.push({ type: 'wall', x: 0, y: 0, w: 40, h: 600, color: '#555' }); // Left
    mapObjects.push({ type: 'wall', x: 760, y: 0, w: 40, h: 600, color: '#555' }); // Right

    // Portal to City
    createPortal(400, 500, 'city', 'Exit to City');
}

function createPortal(x, y, targetMap, label) {
    portals.push({ x, y, radius: 20, targetMap, label });
}

function drawMap() {
    // Background
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, 800, 600);

    // Map Objects
    for (const obj of mapObjects) {
        ctx.fillStyle = obj.color;
        if (obj.type === 'building' || obj.type === 'wall') {
            ctx.fillRect(obj.x, obj.y, obj.w, obj.h);
        } else if (obj.type === 'tree') {
            ctx.beginPath();
            ctx.arc(obj.x, obj.y, obj.radius, 0, Math.PI * 2);
            ctx.fill();
            // trunk
            ctx.fillStyle = '#5c4033';
            ctx.fillRect(obj.x - 4, obj.y + obj.radius - 5, 8, 10);
        }
    }

    // Portals
    for (const portal of portals) {
        ctx.fillStyle = 'cyan';
        ctx.beginPath();
        ctx.arc(portal.x, portal.y, portal.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'blue';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = 'white';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(portal.label, portal.x, portal.y - portal.radius - 5);
    }
}

// Game State
let players = {};
let myId = null;
let currentRoomId = null;
let currentMap = null;

const SPEED = 0.2;

// Input
const keys = { w: false, a: false, s: false, d: false, ArrowUp: false, ArrowLeft: false, ArrowDown: false, ArrowRight: false };

window.addEventListener('keydown', (e) => { if (keys.hasOwnProperty(e.key)) keys[e.key] = true; });
window.addEventListener('keyup', (e) => { if (keys.hasOwnProperty(e.key)) keys[e.key] = false; });

// --- Lobby Logic ---
createRoomBtn.addEventListener('click', () => socket.emit('createRoom'));
joinRoomBtn.addEventListener('click', () => {
    const roomId = roomInput.value.trim();
    if (roomId) socket.emit('joinRoom', roomId);
    else lobbyMessage.innerText = 'Please enter a Room ID';
});

socket.on('roomCreated', (roomId) => {
    joinGame(roomId);
    lobbyMessage.innerText = `Room created! ID: ${roomId} (Share this with friends)`;
});

socket.on('roomJoined', (roomId) => joinGame(roomId));
socket.on('error', (message) => {
    lobbyMessage.innerText = message;
    lobbyMessage.style.color = 'red';
});

function joinGame(roomId) {
    currentRoomId = roomId;
    lobbyContainer.style.display = 'none';
    gameContainer.style.display = 'block';
    uiOverlay.style.display = 'block'; // Show EXP button

    requestAnimationFrame(animate);
}

// --- Socket Events ---
socket.on('connect', () => { myId = socket.id; });

socket.on('currentPlayers', (serverPlayers) => {
    players = serverPlayers;

    if (players[myId]) {
        currentMap = players[myId].map || 'city';
        loadMap(currentMap);
    }

    updateMyUI();
});

socket.on('newPlayer', (playerInfo) => {
    players[playerInfo.id] = playerInfo;
});

socket.on('playerMoved', (playerInfo) => {
    if (players[playerInfo.id]) {
        players[playerInfo.id].x = playerInfo.x;
        players[playerInfo.id].y = playerInfo.y; // 'y' from server is actually Z in 3D world (top-down view)
    }
});

socket.on('playerMapChanged', (mapInfo) => {
    if (players[mapInfo.id]) {
        players[mapInfo.id].map = mapInfo.map;
        players[mapInfo.id].x = mapInfo.x;
        players[mapInfo.id].y = mapInfo.y;
    }
});

socket.on('playerDisconnected', (playerId) => {
    delete players[playerId];
});

// Level system networking
gainExpBtn.addEventListener('click', () => {
    socket.emit('gainExp');
});

socket.on('playerStatsUpdate', (statsInfo) => {
    if (players[statsInfo.id]) {
        players[statsInfo.id].level = statsInfo.level;
        players[statsInfo.id].exp = statsInfo.exp;
        if (statsInfo.id === myId) {
            updateMyUI();
        }
    }
});

function loadMap(mapName) {
    if (mapName === 'city') buildCityMap();
    else if (mapName === 'dungeon') buildDungeonMap();
}

function updateMyUI() {
    if (players[myId]) {
        const lvl = players[myId].level || 1;
        levelDisplay.innerText = lvl;
        expDisplay.innerText = players[myId].exp || 0;
        expNeededDisplay.innerText = lvl * 100;
    }
}

// --- Update Loop ---
function animate() {
    if (!myId || !players[myId]) return;

    const me = players[myId];
    const oldX = me.x;
    const oldY = me.y;

    if (keys.w || keys.ArrowUp) me.y -= SPEED * 10;
    if (keys.s || keys.ArrowDown) me.y += SPEED * 10;
    if (keys.a || keys.ArrowLeft) me.x -= SPEED * 10;
    if (keys.d || keys.ArrowRight) me.x += SPEED * 10;

    // Boundary roughly matching our 3D plane scale
    if (me.x < 0) me.x = 0;
    if (me.x > 800) me.x = 800;
    if (me.y < 0) me.y = 0;
    if (me.y > 600) me.y = 600;

    if (me.x !== oldX || me.y !== oldY) {
        socket.emit('playerMovement', { x: me.x, y: me.y });

        // Portal Collision Check
        for (const portal of portals) {
            const dx = me.x - portal.x;
            const dy = me.y - portal.y;
            const distSq = dx * dx + dy * dy;
            // The portal radius is 20, player is 20x20
            if (distSq < (portal.radius + 10) * (portal.radius + 10)) {
                // Teleport!
                currentMap = portal.targetMap;

                // Set to default spawn depending on map
                if (currentMap === 'city') {
                    me.x = 400; // Middle
                    me.y = 100; // Near edge
                } else if (currentMap === 'dungeon') {
                    me.x = 400;
                    me.y = 400;
                }

                loadMap(currentMap);

                socket.emit('changeMap', { map: currentMap, x: me.x, y: me.y });
                break; // Only trigger one portal
            }
        }
    }

    // Clear Canvas and Draw Map
    ctx.clearRect(0, 0, 800, 600);
    drawMap();

    // Draw Players
    for (const id in players) {
        if (players[id].map === currentMap) {
            const p = players[id];

            // Player body
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x - 10, p.y - 10, 20, 20);

            // Red Hat
            ctx.fillStyle = '#ff0000';
            ctx.fillRect(p.x - 8, p.y - 15, 16, 5);

            // Name Tag
            ctx.fillStyle = 'white';
            ctx.font = 'bold 12px Arial';
            ctx.textAlign = 'center';
            // Black outline
            ctx.lineWidth = 2;
            ctx.strokeStyle = 'black';
            const lvl = p.level || 1;
            const text = `${id === myId ? 'You' : 'Player'} (Lv.${lvl})`;
            ctx.strokeText(text, p.x, p.y - 20);
            ctx.fillText(text, p.x, p.y - 20);
        }
    }

    requestAnimationFrame(animate);
}
