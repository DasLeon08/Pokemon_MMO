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

// --- Procedural Pixel Art Sprites ---
const TILE_SIZE = 40;
const sprites = {};

function createPixelSprite(width, height, drawFn) {
    const offCanvas = document.createElement('canvas');
    offCanvas.width = width;
    offCanvas.height = height;
    const offCtx = offCanvas.getContext('2d');
    offCtx.imageSmoothingEnabled = false;
    drawFn(offCtx, width, height);
    return offCanvas;
}

// Generate Grass Tile
sprites.grass = createPixelSprite(TILE_SIZE, TILE_SIZE, (c, w, h) => {
    c.fillStyle = '#78C850'; // Base grass green
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#58A830'; // Darker green specs
    for (let i = 0; i < 15; i++) {
        c.fillRect(Math.floor(Math.random() * (w/4)) * 4, Math.floor(Math.random() * (h/4)) * 4, 4, 4);
    }
    c.fillStyle = '#98D870'; // Lighter green specs
    for (let i = 0; i < 10; i++) {
        c.fillRect(Math.floor(Math.random() * (w/4)) * 4, Math.floor(Math.random() * (h/4)) * 4, 4, 4);
    }
});

// Generate Tree Sprite
sprites.tree = createPixelSprite(TILE_SIZE, TILE_SIZE * 1.5, (c, w, h) => {
    // Shadow
    c.fillStyle = 'rgba(0,0,0,0.3)';
    c.beginPath();
    c.ellipse(w/2, h - 8, 12, 6, 0, 0, Math.PI*2);
    c.fill();
    // Trunk
    c.fillStyle = '#8B5A2B';
    c.fillRect(16, 40, 8, 16);
    c.fillStyle = '#6B3A0B';
    c.fillRect(16, 40, 4, 16); // Trunk shadow
    // Leaves (Layers of circles to look bushy like pokemon trees)
    c.fillStyle = '#228B22';
    c.beginPath(); c.arc(20, 20, 16, 0, Math.PI*2); c.fill();
    c.beginPath(); c.arc(10, 30, 12, 0, Math.PI*2); c.fill();
    c.beginPath(); c.arc(30, 30, 12, 0, Math.PI*2); c.fill();
    c.beginPath(); c.arc(20, 36, 14, 0, Math.PI*2); c.fill();

    // Highlights
    c.fillStyle = '#32CD32';
    c.beginPath(); c.arc(16, 16, 10, 0, Math.PI*2); c.fill();
    c.beginPath(); c.arc(8, 26, 6, 0, Math.PI*2); c.fill();
    c.beginPath(); c.arc(26, 26, 6, 0, Math.PI*2); c.fill();
});

// Generate Path Tile
sprites.path = createPixelSprite(TILE_SIZE, TILE_SIZE, (c, w, h) => {
    c.fillStyle = '#F0E68C'; // Khaki / Sand color
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#DDA0DD'; // Slight variation
    for (let i = 0; i < 20; i++) {
        if(Math.random() > 0.7) {
            c.fillStyle = '#E6D870';
            c.fillRect(Math.floor(Math.random() * (w/2)) * 2, Math.floor(Math.random() * (h/2)) * 2, 2, 2);
        }
    }
});

// Generate Building/House Tile (Takes up 2x2 grid)
sprites.house = createPixelSprite(TILE_SIZE * 2, TILE_SIZE * 2, (c, w, h) => {
    // Base structure
    c.fillStyle = '#D2B48C'; // Tan wall
    c.fillRect(4, 32, w - 8, h - 32);
    // Roof
    c.fillStyle = '#CD5C5C'; // Indian Red roof
    c.beginPath();
    c.moveTo(0, 32);
    c.lineTo(w/2, 4);
    c.lineTo(w, 32);
    c.fill();
    // Door
    c.fillStyle = '#8B4513';
    c.fillRect(w/2 - 8, h - 20, 16, 20);
    // Windows
    c.fillStyle = '#87CEEB';
    c.fillRect(12, 44, 16, 16);
    c.fillRect(w - 28, 44, 16, 16);
    // Outline / Detail
    c.strokeStyle = '#333';
    c.lineWidth = 2;
    c.strokeRect(4, 32, w - 8, h - 32);
    c.strokeRect(w/2 - 8, h - 20, 16, 20);
});

// Generate Stone Floor Tile
sprites.stoneFloor = createPixelSprite(TILE_SIZE, TILE_SIZE, (c, w, h) => {
    c.fillStyle = '#696969';
    c.fillRect(0, 0, w, h);
    c.strokeStyle = '#444';
    c.lineWidth = 1;
    // Simple 2x2 brick pattern per tile
    c.strokeRect(0, 0, w/2, h/2);
    c.strokeRect(w/2, 0, w/2, h/2);
    c.strokeRect(0, h/2, w/2, h/2);
    c.strokeRect(w/2, h/2, w/2, h/2);
});

// Generate Dungeon Wall Tile
sprites.wall = createPixelSprite(TILE_SIZE, TILE_SIZE, (c, w, h) => {
    c.fillStyle = '#2F4F4F'; // Dark slate
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#1F3F3F';
    c.fillRect(0, h - 8, w, 8); // Depth shadow
    c.strokeStyle = '#000';
    c.strokeRect(0,0,w,h);
});

// Generate Player Character Sprite Template (facing down)
sprites.player = createPixelSprite(24, 32, (c, w, h) => {
    // Shadow
    c.fillStyle = 'rgba(0,0,0,0.3)';
    c.beginPath(); c.ellipse(12, 28, 8, 4, 0, 0, Math.PI*2); c.fill();
    // Body (Colored dynamically in draw, so we'll draw grayscale here and tint later,
    // OR we draw the player directly in the render loop using this style)
});

function drawPlayerSprite(ctx, x, y, color) {
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(x, y + 12, 12, 6, 0, 0, Math.PI*2); ctx.fill();

    // Body (Rectangle with slightly rounded look)
    ctx.fillStyle = color;
    ctx.fillRect(x - 10, y - 8, 20, 16);

    // Head (Circle)
    ctx.fillStyle = '#FFE4C4'; // Skin tone
    ctx.beginPath(); ctx.arc(x, y - 12, 10, 0, Math.PI*2); ctx.fill();

    // Eyes
    ctx.fillStyle = '#000';
    ctx.fillRect(x - 4, y - 14, 2, 2);
    ctx.fillRect(x + 2, y - 14, 2, 2);

    // Hat (Classic Red/White cap)
    ctx.fillStyle = '#FF0000';
    ctx.beginPath(); ctx.arc(x, y - 14, 10, Math.PI, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#FFF';
    ctx.fillRect(x - 10, y - 14, 20, 3);

    // Backpack
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(x - 12, y - 4, 4, 10);
}


// --- Maps & Environment ---
let portals = [];
let mapGrid = [];
let mapObjects = [];
const MAP_COLS = 20; // 800 / 40
const MAP_ROWS = 15; // 600 / 40

// 0: grass, 1: path, 2: stoneFloor, 3: wall
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
    for(let r=4; r<12; r++) {
        mapGrid[r][9] = 1;
        mapGrid[r][10] = 1;
    }
    for(let c=5; c<15; c++) {
        mapGrid[8][c] = 1;
        mapGrid[9][c] = 1;
    }

    // Add Houses
    mapObjects.push({ type: 'house', x: 2 * TILE_SIZE, y: 2 * TILE_SIZE });
    mapObjects.push({ type: 'house', x: 14 * TILE_SIZE, y: 2 * TILE_SIZE });
    mapObjects.push({ type: 'house', x: 2 * TILE_SIZE, y: 10 * TILE_SIZE });

    // Add Trees (Forest border)
    for(let c=0; c<MAP_COLS; c++) {
        mapObjects.push({ type: 'tree', x: c * TILE_SIZE, y: -10 });
        mapObjects.push({ type: 'tree', x: c * TILE_SIZE, y: (MAP_ROWS - 1) * TILE_SIZE });
    }
    for(let r=1; r<MAP_ROWS-1; r++) {
        mapObjects.push({ type: 'tree', x: 0, y: r * TILE_SIZE });
        mapObjects.push({ type: 'tree', x: (MAP_COLS - 1) * TILE_SIZE, y: r * TILE_SIZE });
    }

    // A few random trees
    mapObjects.push({ type: 'tree', x: 5 * TILE_SIZE, y: 5 * TILE_SIZE });
    mapObjects.push({ type: 'tree', x: 15 * TILE_SIZE, y: 12 * TILE_SIZE });

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
    for(let r=4; r<10; r++) {
        mapGrid[r][5] = 3;
        mapGrid[r][14] = 3;
    }

    // Portal to City
    createPortal(400, 500, 'city', 'Exit');
}

function createPortal(x, y, targetMap, label) {
    portals.push({ x, y, radius: 20, targetMap, label });
}

function drawMap() {
    // Draw Base Grid
    for(let r=0; r<MAP_ROWS; r++) {
        for(let c=0; c<MAP_COLS; c++) {
            const tile = mapGrid[r][c];
            const px = c * TILE_SIZE;
            const py = r * TILE_SIZE;

            if (tile === 0) ctx.drawImage(sprites.grass, px, py);
            else if (tile === 1) ctx.drawImage(sprites.path, px, py);
            else if (tile === 2) ctx.drawImage(sprites.stoneFloor, px, py);
            else if (tile === 3) ctx.drawImage(sprites.wall, px, py);
        }
    }

    // Draw Map Objects (Trees, Houses)
    // Sort objects by Y so things in front draw on top (fake depth)
    mapObjects.sort((a,b) => a.y - b.y);
    for (const obj of mapObjects) {
        if (obj.type === 'tree') {
            // Adjust to draw sprite centered on its tile bottom
            ctx.drawImage(sprites.tree, obj.x, obj.y - (TILE_SIZE * 0.5));
        } else if (obj.type === 'house') {
            ctx.drawImage(sprites.house, obj.x, obj.y - TILE_SIZE);
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

    // Draw Players (Sort by Y for depth)
    const playersInMap = Object.values(players).filter(p => p.map === currentMap);
    playersInMap.sort((a,b) => a.y - b.y);

    for (const p of playersInMap) {
        drawPlayerSprite(ctx, p.x, p.y, p.color);

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
