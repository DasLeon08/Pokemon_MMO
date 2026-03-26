const socket = io();

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const lobbyContainer = document.getElementById('lobby-container');
const gameContainer = document.getElementById('game-container');
const createRoomBtn = document.getElementById('createRoomBtn');
const joinRoomBtn = document.getElementById('joinRoomBtn');
const roomInput = document.getElementById('roomInput');
const lobbyMessage = document.getElementById('lobbyMessage');

// Game state
let players = {};
let myId = null;
let currentRoomId = null;
let gameLoopId = null;

const PLAYER_SIZE = 30; // 30x30 pixels for a "pokemon" character
const SPEED = 5;

// Keys state
const keys = {
    w: false,
    a: false,
    s: false,
    d: false,
    ArrowUp: false,
    ArrowLeft: false,
    ArrowDown: false,
    ArrowRight: false
};

// --- Lobby Logic ---
createRoomBtn.addEventListener('click', () => {
    socket.emit('createRoom');
});

joinRoomBtn.addEventListener('click', () => {
    const roomId = roomInput.value.trim();
    if (roomId) {
        socket.emit('joinRoom', roomId);
    } else {
        lobbyMessage.innerText = 'Please enter a Room ID';
    }
});

socket.on('roomCreated', (roomId) => {
    joinGame(roomId);
    lobbyMessage.innerText = `Room created! ID: ${roomId} (Share this with friends)`;
});

socket.on('roomJoined', (roomId) => {
    joinGame(roomId);
});

socket.on('error', (message) => {
    lobbyMessage.innerText = message;
    lobbyMessage.style.color = 'red';
});

function joinGame(roomId) {
    currentRoomId = roomId;
    lobbyContainer.style.display = 'none';
    gameContainer.style.display = 'block';

    // Start loop if not already started
    if (!gameLoopId) {
        gameLoop();
    }
}

// Handle socket events
socket.on('connect', () => {
    myId = socket.id;
    console.log('Connected to server with ID:', myId);
});

socket.on('currentPlayers', (serverPlayers) => {
    players = serverPlayers;
});

socket.on('newPlayer', (playerInfo) => {
    players[playerInfo.id] = playerInfo;
});

socket.on('playerMoved', (playerInfo) => {
    if (players[playerInfo.id]) {
        players[playerInfo.id].x = playerInfo.x;
        players[playerInfo.id].y = playerInfo.y;
    }
});

socket.on('playerDisconnected', (playerId) => {
    delete players[playerId];
});

// Input handling
window.addEventListener('keydown', (e) => {
    if (keys.hasOwnProperty(e.key)) {
        keys[e.key] = true;
    }
});

window.addEventListener('keyup', (e) => {
    if (keys.hasOwnProperty(e.key)) {
        keys[e.key] = false;
    }
});

// Update logic
function update() {
    if (!myId || !players[myId]) return;

    let moved = false;
    const me = players[myId];

    // Save old pos to check if we moved
    const oldX = me.x;
    const oldY = me.y;

    if (keys.w || keys.ArrowUp) {
        me.y -= SPEED;
    }
    if (keys.s || keys.ArrowDown) {
        me.y += SPEED;
    }
    if (keys.a || keys.ArrowLeft) {
        me.x -= SPEED;
    }
    if (keys.d || keys.ArrowRight) {
        me.x += SPEED;
    }

    // Basic bounds checking
    if (me.x < 0) me.x = 0;
    if (me.x > canvas.width - PLAYER_SIZE) me.x = canvas.width - PLAYER_SIZE;
    if (me.y < 0) me.y = 0;
    if (me.y > canvas.height - PLAYER_SIZE) me.y = canvas.height - PLAYER_SIZE;

    // Send update to server if we moved
    if (me.x !== oldX || me.y !== oldY) {
        socket.emit('playerMovement', { x: me.x, y: me.y });
    }
}

// Tile map setup (simplified)
const TILE_SIZE = 40;
const map = [
    [2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2],
    [2,0,0,0,0,0,2,2,0,0,0,0,0,0,0,0,0,0,0,2],
    [2,0,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2],
    [2,0,1,1,1,0,0,0,0,0,0,2,2,2,0,0,0,0,0,2],
    [2,0,0,0,0,0,0,0,0,0,0,2,2,2,0,0,0,0,0,2],
    [2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2],
    [2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,0,2],
    [2,0,2,2,0,0,0,0,0,0,0,0,0,0,0,1,1,1,0,2],
    [2,0,2,2,0,0,0,1,1,1,1,1,1,0,0,0,0,0,0,2],
    [2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2],
    [2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2],
    [2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,2,0,0,2],
    [2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,2,0,0,2],
    [2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2],
    [2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2]
];

function drawMap() {
    for (let row = 0; row < map.length; row++) {
        for (let col = 0; col < map[row].length; col++) {
            const tile = map[row][col];
            let color = '#78C850'; // default grass

            if (tile === 1) color = '#D8B878'; // path/dirt
            else if (tile === 2) color = '#389030'; // darker grass/trees

            ctx.fillStyle = color;
            ctx.fillRect(col * TILE_SIZE, row * TILE_SIZE, TILE_SIZE, TILE_SIZE);

            // Add a little tree detail for tile 2
            if (tile === 2) {
                ctx.fillStyle = '#206010';
                ctx.beginPath();
                ctx.arc(col * TILE_SIZE + TILE_SIZE/2, row * TILE_SIZE + TILE_SIZE/2, TILE_SIZE/3, 0, Math.PI*2);
                ctx.fill();
            }
        }
    }
}

function drawPlayer(p, isMe) {
    // 8-bit style simple character drawing
    const size = PLAYER_SIZE;
    const bodyColor = p.color || '#F00';
    const skinColor = '#FFC0A0';

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(p.x + size/2, p.y + size - 2, size/2, size/4, 0, 0, Math.PI*2);
    ctx.fill();

    // Body (shirt)
    ctx.fillStyle = bodyColor;
    ctx.fillRect(p.x + 4, p.y + size/2, size - 8, size/2 - 2);

    // Head
    ctx.fillStyle = skinColor;
    ctx.fillRect(p.x + 4, p.y + 4, size - 8, size/2 - 4);

    // Hat
    ctx.fillStyle = '#E02020'; // Red hat typical for protag
    ctx.fillRect(p.x + 4, p.y, size - 8, 8);
    ctx.fillStyle = '#FFF'; // Hat brim
    ctx.fillRect(p.x + 2, p.y + 6, size - 4, 3);

    // Eyes
    ctx.fillStyle = '#000';
    ctx.fillRect(p.x + 8, p.y + 10, 3, 3);
    ctx.fillRect(p.x + size - 11, p.y + 10, 3, 3);

    // Name tag above head
    if (isMe) {
        ctx.fillStyle = '#FFF';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.strokeText('You', p.x + size/2, p.y - 5);
        ctx.fillText('You', p.x + size/2, p.y - 5);
    }
}

// Render logic
function draw() {
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    drawMap();

    // Draw all players
    for (const id in players) {
        drawPlayer(players[id], id === myId);
    }

    drawRoomOverlay();
}

// Game loop
function gameLoop() {
    update();
    draw();
    gameLoopId = requestAnimationFrame(gameLoop);
}

// Draw room ID on canvas
function drawRoomOverlay() {
    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`Room: ${currentRoomId}`, 10, 20);
}
