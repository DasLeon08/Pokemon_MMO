const socket = io();

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game state
let players = {};
let myId = null;

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

// Render logic
function draw() {
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw grid (optional, makes it look a bit more like a map)
    ctx.strokeStyle = '#68B840'; // Slightly darker green
    ctx.lineWidth = 1;
    for (let i = 0; i <= canvas.width; i += 40) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, canvas.height);
        ctx.stroke();
    }
    for (let i = 0; i <= canvas.height; i += 40) {
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(canvas.width, i);
        ctx.stroke();
    }

    // Draw all players
    for (const id in players) {
        const p = players[id];

        // Draw character body
        ctx.fillStyle = p.color || '#F00'; // Default red if no color
        ctx.beginPath();
        ctx.arc(p.x + PLAYER_SIZE/2, p.y + PLAYER_SIZE/2, PLAYER_SIZE/2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw eyes to show direction (simplistic)
        ctx.fillStyle = '#FFF';
        ctx.beginPath();
        ctx.arc(p.x + PLAYER_SIZE/2 - 5, p.y + PLAYER_SIZE/2 - 5, 4, 0, Math.PI * 2);
        ctx.arc(p.x + PLAYER_SIZE/2 + 5, p.y + PLAYER_SIZE/2 - 5, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(p.x + PLAYER_SIZE/2 - 5, p.y + PLAYER_SIZE/2 - 5, 2, 0, Math.PI * 2);
        ctx.arc(p.x + PLAYER_SIZE/2 + 5, p.y + PLAYER_SIZE/2 - 5, 2, 0, Math.PI * 2);
        ctx.fill();

        // Highlight local player
        if (id === myId) {
            ctx.fillStyle = '#FFF';
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('You', p.x + PLAYER_SIZE/2, p.y - 5);
        }
    }
}

// Game loop
function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

// Start loop
gameLoop();
