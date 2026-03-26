import * as THREE from 'three';

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

// Three.js Setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB); // Sky blue
scene.fog = new THREE.Fog(0x87CEEB, 20, 100);

const camera = new THREE.PerspectiveCamera(75, 800 / 600, 0.1, 1000);
// Instead of a canvas we already have, we can use the canvas or let three.js create one.
// We'll replace the existing canvas.
const oldCanvas = document.getElementById('gameCanvas');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(800, 600);
renderer.shadowMap.enabled = true;
gameContainer.replaceChild(renderer.domElement, oldCanvas);

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(20, 40, 20);
dirLight.castShadow = true;
dirLight.shadow.camera.top = 50;
dirLight.shadow.camera.bottom = -50;
dirLight.shadow.camera.left = -50;
dirLight.shadow.camera.right = 50;
scene.add(dirLight);

// Ground
const groundGeo = new THREE.PlaneGeometry(200, 200);
const groundMat = new THREE.MeshStandardMaterial({ color: 0x55aa55 });
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// Decorate open world with some trees
const treeGeo = new THREE.CylinderGeometry(0, 1.5, 4, 8);
const treeTrunkGeo = new THREE.CylinderGeometry(0.3, 0.3, 1, 8);
const treeLeavesMat = new THREE.MeshStandardMaterial({ color: 0x2d8a36 });
const treeTrunkMat = new THREE.MeshStandardMaterial({ color: 0x5c4033 });

for (let i = 0; i < 50; i++) {
    const group = new THREE.Group();

    const leaves = new THREE.Mesh(treeGeo, treeLeavesMat);
    leaves.position.y = 2.5;
    leaves.castShadow = true;

    const trunk = new THREE.Mesh(treeTrunkGeo, treeTrunkMat);
    trunk.position.y = 0.5;
    trunk.castShadow = true;

    group.add(leaves);
    group.add(trunk);

    group.position.set(
        (Math.random() - 0.5) * 180,
        0,
        (Math.random() - 0.5) * 180
    );
    scene.add(group);
}

// Game State
let players = {};
let playerMeshes = {}; // To store 3D models of players
let nameTags = {}; // HTML elements for names/levels
let myId = null;
let currentRoomId = null;

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

    renderer.setAnimationLoop(animate);
}

// --- Player Character Creation ---
function createPlayerMesh(colorHex) {
    const group = new THREE.Group();

    // Body
    const bodyGeo = new THREE.BoxGeometry(1, 1, 1);
    const bodyMat = new THREE.MeshStandardMaterial({ color: colorHex });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.5;
    body.castShadow = true;
    group.add(body);

    // Head (Hat)
    const hatGeo = new THREE.BoxGeometry(0.8, 0.2, 0.8);
    const hatMat = new THREE.MeshStandardMaterial({ color: 0xff0000 }); // Red hat
    const hat = new THREE.Mesh(hatGeo, hatMat);
    hat.position.y = 1.1;
    hat.castShadow = true;
    group.add(hat);

    return group;
}

function createNameTag(id) {
    const div = document.createElement('div');
    div.className = 'name-tag';
    div.style.position = 'absolute';
    div.style.color = 'white';
    div.style.textShadow = '1px 1px 2px black, -1px -1px 2px black';
    div.style.fontFamily = 'Arial, sans-serif';
    div.style.fontSize = '12px';
    div.style.fontWeight = 'bold';
    div.style.pointerEvents = 'none'; // Don't block clicks
    document.body.appendChild(div);
    return div;
}

// --- Socket Events ---
socket.on('connect', () => { myId = socket.id; });

socket.on('currentPlayers', (serverPlayers) => {
    // Clear old
    for (let id in playerMeshes) {
        scene.remove(playerMeshes[id]);
        if (nameTags[id]) nameTags[id].remove();
    }
    playerMeshes = {};
    nameTags = {};

    players = serverPlayers;

    for (const id in players) {
        addPlayerToScene(players[id]);
    }
    updateMyUI();
});

socket.on('newPlayer', (playerInfo) => {
    players[playerInfo.id] = playerInfo;
    addPlayerToScene(playerInfo);
});

socket.on('playerMoved', (playerInfo) => {
    if (players[playerInfo.id]) {
        players[playerInfo.id].x = playerInfo.x;
        players[playerInfo.id].y = playerInfo.y; // 'y' from server is actually Z in 3D world (top-down view)
    }
});

socket.on('playerDisconnected', (playerId) => {
    delete players[playerId];
    if (playerMeshes[playerId]) {
        scene.remove(playerMeshes[playerId]);
        delete playerMeshes[playerId];
    }
    if (nameTags[playerId]) {
        nameTags[playerId].remove();
        delete nameTags[playerId];
    }
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

function addPlayerToScene(p) {
    const mesh = createPlayerMesh(p.color);

    // Server sends 2D coordinates (x, y)
    // We map Server.X to 3D.X, and Server.Y to 3D.Z
    // Server coordinates are 0-800. Let's map them to roughly -40 to 40
    mesh.position.x = (p.x / 10) - 40;
    mesh.position.z = (p.y / 10) - 30;

    scene.add(mesh);
    playerMeshes[p.id] = mesh;

    nameTags[p.id] = createNameTag(p.id);
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
    }

    // Sync 3D meshes to logical positions
    for (const id in players) {
        if (playerMeshes[id]) {
            const p = players[id];

            // Map 2D -> 3D
            const targetX = (p.x / 10) - 40;
            const targetZ = (p.y / 10) - 30;

            // Simple lerp for smooth movement
            playerMeshes[id].position.x += (targetX - playerMeshes[id].position.x) * 0.2;
            playerMeshes[id].position.z += (targetZ - playerMeshes[id].position.z) * 0.2;

            // Update Name Tag Positions
            if (nameTags[id]) {
                const vector = new THREE.Vector3();
                vector.setFromMatrixPosition(playerMeshes[id].matrixWorld);
                vector.y += 2; // Above head

                vector.project(camera);

                // Convert to CSS coords
                const gameRect = gameContainer.getBoundingClientRect();
                const x = (vector.x * .5 + .5) * gameRect.width + gameRect.left;
                const y = (vector.y * -.5 + .5) * gameRect.height + gameRect.top;

                nameTags[id].style.left = `${x}px`;
                nameTags[id].style.top = `${y}px`;

                const lvl = p.level || 1;
                nameTags[id].innerText = `${id === myId ? 'You' : 'Player'} (Lv.${lvl})`;
                nameTags[id].style.transform = 'translate(-50%, -50%)';

                // Hide if behind camera
                if (vector.z > 1) {
                    nameTags[id].style.display = 'none';
                } else {
                    nameTags[id].style.display = 'block';
                }
            }
        }
    }

    // Camera follow local player (Third person view)
    if (playerMeshes[myId]) {
        const myMesh = playerMeshes[myId];
        camera.position.x = myMesh.position.x;
        camera.position.y = 10;
        camera.position.z = myMesh.position.z + 15;
        camera.lookAt(myMesh.position.x, 0, myMesh.position.z);
    }

    renderer.render(scene, camera);
}
