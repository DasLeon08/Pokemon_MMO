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
// Disable smoothing for crisp pixel art look
ctx.imageSmoothingEnabled = false;

// --- Tileset Asset Management ---
const TILE_SIZE = 32;
let tilesetLoaded = false;
const tileset = new Image();
tileset.src = 'tileset.png';
tileset.onload = () => { tilesetLoaded = true; };

// Dictionary mapping logical tiles to (x, y) coordinates on the tileset (each cell is 32x32)
// For ProjectUtumno: grass=25,18, tree=3,23, water=43,30, wall=15,2, floor=5,0, path=6,16
const tCoords = {
    grass: {x: 25, y: 18, w: 1, h: 1},
    tree: {x: 3, y: 23, w: 1, h: 2}, // Tall tree
    path: {x: 6, y: 16, w: 1, h: 1},
    water1: {x: 43, y: 30, w: 1, h: 1},
    water2: {x: 44, y: 30, w: 1, h: 1},
    water3: {x: 45, y: 30, w: 1, h: 1},
    bridge: {x: 18, y: 22, w: 1, h: 1}, // Wood bridge
    house: {x: 13, y: 28, w: 3, h: 3}, // Large house
    floor: {x: 5, y: 0, w: 1, h: 1},
    wall: {x: 15, y: 2, w: 1, h: 1},
    // Simple characters (row 13)
    player_down_1: {x: 0, y: 13, w: 1, h: 1},
    player_down_2: {x: 1, y: 13, w: 1, h: 1},
    player_left_1: {x: 2, y: 13, w: 1, h: 1},
    player_left_2: {x: 3, y: 13, w: 1, h: 1},
    player_right_1: {x: 4, y: 13, w: 1, h: 1},
    player_right_2: {x: 5, y: 13, w: 1, h: 1},
    player_up_1: {x: 6, y: 13, w: 1, h: 1},
    player_up_2: {x: 7, y: 13, w: 1, h: 1},
    // Other players can use different rows for variety
    other_down_1: {x: 8, y: 13, w: 1, h: 1},
    other_down_2: {x: 9, y: 13, w: 1, h: 1},
    other_left_1: {x: 10, y: 13, w: 1, h: 1},
    other_left_2: {x: 11, y: 13, w: 1, h: 1},
    other_right_1: {x: 12, y: 13, w: 1, h: 1},
    other_right_2: {x: 13, y: 13, w: 1, h: 1},
    other_up_1: {x: 14, y: 13, w: 1, h: 1},
    other_up_2: {x: 15, y: 13, w: 1, h: 1},
};

function drawTile(name, destX, destY) {
    if (!tilesetLoaded) return;
    const t = tCoords[name];
    if (!t) return;

    // Tileset blocks are 32x32
    const sourceX = t.x * 32;
    const sourceY = t.y * 32;
    const sourceW = t.w * 32;
    const sourceH = t.h * 32;

    // We scale our TILE_SIZE slightly up or down if needed, but keeping 1:1 is best for crispness
    ctx.drawImage(tileset, sourceX, sourceY, sourceW, sourceH, destX, destY, sourceW, sourceH);
}


// --- Maps & Environment ---
let portals = [];
let mapGrid = [];
let mapObjects = [];
const MAP_COLS = 25; // 800 / 32
const MAP_ROWS = 19; // 600 / 32

// 0: grass, 1: path, 2: stoneFloor, 3: wall, 4: water, 5: bridge
function clearMap() {
    mapGrid = [];
    portals = [];
    mapObjects = []; // Extra objects like trees/houses
}

function buildCityMap() {
    clearMap();
    // Fill with grass
    for(let r=0; r<MAP_ROWS; r++) {
        let row = [];
        for(let c=0; c<MAP_COLS; c++) {
            row.push(0); // grass
        }
        mapGrid.push(row);
    }

    // Draw a path in the middle
    for(let r=4; r<14; r++) {
        mapGrid[r][11] = 1;
        mapGrid[r][12] = 1;
    }
    for(let c=5; c<20; c++) {
        mapGrid[8][c] = 1;
        mapGrid[9][c] = 1;
    }

    // Add a River
    for(let r=0; r<MAP_ROWS; r++) {
        mapGrid[r][19] = 4; // Water
        mapGrid[r][20] = 4; // Water
    }

    // Bridge over river
    mapGrid[8][19] = 5;
    mapGrid[8][20] = 5;
    mapGrid[9][19] = 5;
    mapGrid[9][20] = 5;

    // Add Houses
    mapObjects.push({ type: 'house', x: 2 * TILE_SIZE, y: 2 * TILE_SIZE });
    mapObjects.push({ type: 'house', x: 14 * TILE_SIZE, y: 2 * TILE_SIZE });
    mapObjects.push({ type: 'house', x: 2 * TILE_SIZE, y: 12 * TILE_SIZE });

    // Add Trees (Forest border)
    for(let c=0; c<MAP_COLS; c++) {
        mapObjects.push({ type: 'tree', x: c * TILE_SIZE, y: -TILE_SIZE });
        mapObjects.push({ type: 'tree', x: c * TILE_SIZE, y: (MAP_ROWS - 1) * TILE_SIZE });
    }
    for(let r=1; r<MAP_ROWS-1; r++) {
        mapObjects.push({ type: 'tree', x: -TILE_SIZE/2, y: r * TILE_SIZE });
        mapObjects.push({ type: 'tree', x: (MAP_COLS - 1) * TILE_SIZE, y: r * TILE_SIZE });
    }

    // A few random trees
    mapObjects.push({ type: 'tree', x: 6 * TILE_SIZE, y: 5 * TILE_SIZE });
    mapObjects.push({ type: 'tree', x: 17 * TILE_SIZE, y: 13 * TILE_SIZE });

    // Portal to Dungeon
    createPortal(400, 100, 'dungeon', 'Dungeon Cave');
}

function buildDungeonMap() {
    clearMap();
    // Fill with stone floor
    for(let r=0; r<MAP_ROWS; r++) {
        let row = [];
        for(let c=0; c<MAP_COLS; c++) {
            row.push(2); // stone floor
        }
        mapGrid.push(row);
    }

    // Add Walls (Border)
    for(let c=0; c<MAP_COLS; c++) {
        mapGrid[0][c] = 3;
        mapGrid[MAP_ROWS - 1][c] = 3;
    }
    for(let r=0; r<MAP_ROWS; r++) {
        mapGrid[r][0] = 3;
        mapGrid[r][MAP_COLS - 1] = 3;
    }

    // Some inner walls
    for(let r=4; r<12; r++) {
        mapGrid[r][6] = 3;
        mapGrid[r][18] = 3;
    }

    // Portal to City
    createPortal(400, 500, 'city', 'Exit');
}

function createPortal(x, y, targetMap, label) {
    portals.push({ x, y, radius: 20, targetMap, label });
}

function drawMap() {
    const time = Date.now();
    const waterFrame = Math.floor(time / 400) % 3;

    // Draw Base Grid
    for(let r=0; r<MAP_ROWS; r++) {
        for(let c=0; c<MAP_COLS; c++) {
            const tile = mapGrid[r][c];
            const px = c * TILE_SIZE;
            const py = r * TILE_SIZE;

            if (tile === 0) drawTile('grass', px, py);
            else if (tile === 1) drawTile('path', px, py);
            else if (tile === 2) drawTile('floor', px, py);
            else if (tile === 3) drawTile('wall', px, py);
            else if (tile === 4) drawTile(`water${waterFrame + 1}`, px, py);
            else if (tile === 5) drawTile('bridge', px, py);
        }
    }

    // Draw Map Objects (Trees, Houses)
    mapObjects.sort((a,b) => a.y - b.y);
    for (const obj of mapObjects) {
        if (obj.type === 'tree') {
            drawTile('tree', obj.x, obj.y - TILE_SIZE);
        } else if (obj.type === 'house') {
            drawTile('house', obj.x, obj.y - TILE_SIZE * 2);
        }
    }

    // Draw Portals (Classic warp pad style)
    for (const portal of portals) {
        ctx.fillStyle = '#8A2BE2'; // Purple
        ctx.beginPath();
        ctx.ellipse(portal.x, portal.y, 24, 12, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#DDA0DD'; // Light Purple inner
        ctx.beginPath();
        ctx.ellipse(portal.x, portal.y, 16, 8, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = 'white';
        ctx.font = 'bold 12px "Press Start 2P", monospace, Arial';
        ctx.textAlign = 'center';
        // Black text shadow
        ctx.fillStyle = 'black';
        ctx.fillText(portal.label, portal.x + 1, portal.y - 24 + 1);
        ctx.fillStyle = 'white';
        ctx.fillText(portal.label, portal.x, portal.y - 24);
    }
}

// Draw Player from Sprite Sheet
function drawPlayerSprite(ctx, x, y, color, facing = 'down', walkFrame = 0, isLocalPlayer = false) {
    const frameBase = Math.floor(walkFrame) % 2;
    // Map internal directions to sprite names
    // Choose prefix based on local player or network player for variation
    const prefix = isLocalPlayer ? 'player' : 'other';
    const spriteName = `${prefix}_${facing}_${frameBase + 1}`;

    // Draw the actual image
    drawTile(spriteName, x - TILE_SIZE/2, y - TILE_SIZE + 10);

    // Fallback colored indicator circle if image isn't loaded yet
    if (!tilesetLoaded) {
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.arc(x, y, 10, 0, Math.PI*2); ctx.fill();
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
    players[playerInfo.id].walkFrame = 0;
    players[playerInfo.id].facing = 'down';
    players[playerInfo.id].lastX = playerInfo.x;
    players[playerInfo.id].lastY = playerInfo.y;
});

socket.on('playerMoved', (playerInfo) => {
    if (players[playerInfo.id]) {
        const p = players[playerInfo.id];

        // Calculate direction for animation
        const dx = playerInfo.x - p.x;
        const dy = playerInfo.y - p.y;

        if (Math.abs(dx) > Math.abs(dy)) {
            p.facing = dx > 0 ? 'right' : 'left';
        } else if (Math.abs(dy) > 0) {
            p.facing = dy > 0 ? 'down' : 'up';
        }

        // Advance animation frame if moving
        if (Math.abs(dx) > 0 || Math.abs(dy) > 0) {
            p.walkFrame = (p.walkFrame || 0) + 0.2;
        } else {
            p.walkFrame = 0;
        }

        p.x = playerInfo.x;
        p.y = playerInfo.y;
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

    if (keys.w || keys.ArrowUp) { me.y -= SPEED * 10; me.facing = 'up'; }
    if (keys.s || keys.ArrowDown) { me.y += SPEED * 10; me.facing = 'down'; }
    if (keys.a || keys.ArrowLeft) { me.x -= SPEED * 10; me.facing = 'left'; }
    if (keys.d || keys.ArrowRight) { me.x += SPEED * 10; me.facing = 'right'; }

    // Boundary roughly matching our 3D plane scale
    if (me.x < 0) me.x = 0;
    if (me.x > 800) me.x = 800;
    if (me.y < 0) me.y = 0;
    if (me.y > 600) me.y = 600;

    if (me.x !== oldX || me.y !== oldY) {
        me.walkFrame = (me.walkFrame || 0) + 0.2;
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

    // Draw Players (Sort by Y for depth)
    const playersInMap = Object.values(players).filter(p => p.map === currentMap);
    playersInMap.sort((a,b) => a.y - b.y);

    for (const p of playersInMap) {
        drawPlayerSprite(ctx, p.x, p.y, p.color, p.facing || 'down', p.walkFrame || 0, p.id === myId);

        // Name Tag
        ctx.fillStyle = 'white';
        ctx.font = 'bold 12px "Press Start 2P", monospace, Arial';
        ctx.textAlign = 'center';
        // Black outline
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'black';
        const lvl = p.level || 1;
        const text = `${p.id === myId ? 'You' : 'Player'} (Lv.${lvl})`;
        ctx.strokeText(text, p.x, p.y - 20);
        ctx.fillText(text, p.x, p.y - 20);
    }

    requestAnimationFrame(animate);
}
