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

// --- Procedural Textures ---
function createGrassTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const context = canvas.getContext('2d');
    context.fillStyle = '#4CAF50';
    context.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 1000; i++) {
        context.fillStyle = Math.random() > 0.5 ? '#45a049' : '#388E3C';
        context.fillRect(Math.random() * 256, Math.random() * 256, 4, 10);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(20, 20);
    return tex;
}

function createStoneTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const context = canvas.getContext('2d');
    context.fillStyle = '#555';
    context.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 50; i++) {
        context.fillStyle = Math.random() > 0.5 ? '#444' : '#666';
        context.fillRect(Math.random() * 256, Math.random() * 256, Math.random()*40+10, Math.random()*20+10);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(5, 5);
    return tex;
}

function createBuildingTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const context = canvas.getContext('2d');
    context.fillStyle = '#b0c4de'; // light steel blue
    context.fillRect(0, 0, 128, 128);
    // Windows
    context.fillStyle = '#ffff99';
    for (let x = 10; x < 128; x += 30) {
        for (let y = 10; y < 128; y += 40) {
            if (Math.random() > 0.2) context.fillRect(x, y, 15, 20);
        }
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
}

function createPortalTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const context = canvas.getContext('2d');
    const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, 'white');
    gradient.addColorStop(0.5, 'cyan');
    gradient.addColorStop(1, 'blue');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(canvas);
    return tex;
}

const textures = {
    grass: createGrassTexture(),
    stone: createStoneTexture(),
    building: createBuildingTexture(),
    portal: createPortalTexture()
};

// --- Maps & Environment ---
let portals = [];

function clearMap() {
    // Keep ambient light, remove other environment objects
    const objectsToRemove = scene.children.filter(child => child.name === 'mapObj');
    objectsToRemove.forEach(obj => {
        scene.remove(obj);
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
            if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
            else obj.material.dispose();
        }
    });
    portals = [];
}

function buildCityMap() {
    clearMap();
    scene.background = new THREE.Color(0x87CEEB); // Sky blue
    scene.fog = new THREE.Fog(0x87CEEB, 20, 100);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(20, 40, 20);
    dirLight.castShadow = true;
    dirLight.name = 'mapObj';
    scene.add(dirLight);

    // Ground
    const groundGeo = new THREE.PlaneGeometry(200, 200);
    const groundMat = new THREE.MeshStandardMaterial({ map: textures.grass });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    ground.name = 'mapObj';
    scene.add(ground);

    // Buildings
    const bldgGeo = new THREE.BoxGeometry(10, 20, 10);
    const bldgMat = new THREE.MeshStandardMaterial({ map: textures.building });
    for (let i = 0; i < 20; i++) {
        const bldg = new THREE.Mesh(bldgGeo, bldgMat);
        bldg.position.set((Math.random() - 0.5) * 150, 10, (Math.random() - 0.5) * 150);
        bldg.castShadow = true;
        bldg.receiveShadow = true;
        bldg.name = 'mapObj';
        scene.add(bldg);
    }

    // Trees
    const treeGeo = new THREE.CylinderGeometry(0, 1.5, 4, 8);
    const treeTrunkGeo = new THREE.CylinderGeometry(0.3, 0.3, 1, 8);
    const treeLeavesMat = new THREE.MeshStandardMaterial({ color: 0x2d8a36 });
    const treeTrunkMat = new THREE.MeshStandardMaterial({ color: 0x5c4033 });
    for (let i = 0; i < 30; i++) {
        const group = new THREE.Group();
        const leaves = new THREE.Mesh(treeGeo, treeLeavesMat);
        leaves.position.y = 2.5; leaves.castShadow = true;
        const trunk = new THREE.Mesh(treeTrunkGeo, treeTrunkMat);
        trunk.position.y = 0.5; trunk.castShadow = true;
        group.add(leaves); group.add(trunk);
        group.position.set((Math.random() - 0.5) * 180, 0, (Math.random() - 0.5) * 180);
        group.name = 'mapObj';
        scene.add(group);
    }

    // Portal to Dungeon
    createPortal(0, -20, 'dungeon', 'Enter Dungeon');
}

function buildDungeonMap() {
    clearMap();
    scene.background = new THREE.Color(0x111111); // Dark
    scene.fog = new THREE.Fog(0x111111, 10, 50);

    const pointLight = new THREE.PointLight(0xffaa00, 1, 50);
    pointLight.position.set(0, 10, 0);
    pointLight.name = 'mapObj';
    scene.add(pointLight);

    // Ground
    const groundGeo = new THREE.PlaneGeometry(100, 100);
    const groundMat = new THREE.MeshStandardMaterial({ map: textures.stone });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    ground.name = 'mapObj';
    scene.add(ground);

    // Walls
    const wallGeo = new THREE.BoxGeometry(100, 10, 5);
    const wallMat = new THREE.MeshStandardMaterial({ map: textures.stone });

    const wallN = new THREE.Mesh(wallGeo, wallMat); wallN.position.set(0, 5, -50); wallN.name='mapObj'; scene.add(wallN);
    const wallS = new THREE.Mesh(wallGeo, wallMat); wallS.position.set(0, 5, 50); wallS.name='mapObj'; scene.add(wallS);

    const wallEGeo = new THREE.BoxGeometry(5, 10, 100);
    const wallE = new THREE.Mesh(wallEGeo, wallMat); wallE.position.set(50, 5, 0); wallE.name='mapObj'; scene.add(wallE);
    const wallW = new THREE.Mesh(wallEGeo, wallMat); wallW.position.set(-50, 5, 0); wallW.name='mapObj'; scene.add(wallW);

    // Portal to City
    createPortal(0, 20, 'city', 'Exit to City');
}

function createPortal(x, z, targetMap, label) {
    const geo = new THREE.CylinderGeometry(2, 2, 0.5, 16);
    const mat = new THREE.MeshBasicMaterial({ map: textures.portal });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, 0.25, z);
    mesh.name = 'mapObj';
    scene.add(mesh);
    portals.push({ mesh, targetMap, label, x, z });

    // Portal Label
    const div = document.createElement('div');
    div.className = 'name-tag portal-tag';
    div.innerText = label;
    div.style.position = 'absolute';
    div.style.color = 'cyan';
    div.style.textShadow = '1px 1px 2px black';
    div.style.fontFamily = 'Arial';
    div.style.fontSize = '12px';
    div.style.fontWeight = 'bold';
    div.style.pointerEvents = 'none';
    document.body.appendChild(div);
    portals[portals.length-1].tag = div;
}

// Lighting (Global Ambient)
const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambientLight);

// Game State
let players = {};
let playerMeshes = {}; // To store 3D models of players
let nameTags = {}; // HTML elements for names/levels
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

    if (players[myId]) {
        currentMap = players[myId].map || 'city';
        loadMap(currentMap);
    }

    for (const id in players) {
        if (players[id].map === currentMap) {
            addPlayerToScene(players[id]);
        }
    }
    updateMyUI();
});

socket.on('newPlayer', (playerInfo) => {
    players[playerInfo.id] = playerInfo;
    if (playerInfo.map === currentMap) {
        addPlayerToScene(playerInfo);
    }
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

        // If someone else changed map, handle their mesh visibility
        if (mapInfo.id !== myId) {
            if (mapInfo.map === currentMap) {
                // They entered our map
                if (!playerMeshes[mapInfo.id]) addPlayerToScene(players[mapInfo.id]);
            } else {
                // They left our map
                if (playerMeshes[mapInfo.id]) {
                    scene.remove(playerMeshes[mapInfo.id]);
                    delete playerMeshes[mapInfo.id];
                }
                if (nameTags[mapInfo.id]) {
                    nameTags[mapInfo.id].style.display = 'none';
                }
            }
        }
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

function loadMap(mapName) {
    // Clear old portal tags
    portals.forEach(p => {
        if (p.tag && p.tag.parentNode) {
            p.tag.parentNode.removeChild(p.tag);
        }
    });

    if (mapName === 'city') buildCityMap();
    else if (mapName === 'dungeon') buildDungeonMap();

    // Re-add players in THIS map
    for (let id in playerMeshes) {
        scene.remove(playerMeshes[id]);
        if (nameTags[id]) nameTags[id].style.display = 'none';
    }
    playerMeshes = {};
    for (const id in players) {
        if (players[id].map === currentMap) {
            addPlayerToScene(players[id]);
            if (nameTags[id]) nameTags[id].style.display = 'block';
        }
    }
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
        const player3DX = (me.x / 10) - 40;
        const player3DZ = (me.y / 10) - 30;
        for (const portal of portals) {
            const dx = player3DX - portal.x;
            const dz = player3DZ - portal.z;
            const distSq = dx * dx + dz * dz;
            if (distSq < 4) { // within radius 2
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

    // Sync 3D meshes to logical positions
    for (const id in players) {
        if (playerMeshes[id] && players[id].map === currentMap) {
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

    // Update Portal Tags
    for (const portal of portals) {
        if (portal.tag && portal.mesh) {
            const vector = new THREE.Vector3();
            vector.setFromMatrixPosition(portal.mesh.matrixWorld);
            vector.y += 1.5;
            vector.project(camera);
            const gameRect = gameContainer.getBoundingClientRect();
            const x = (vector.x * .5 + .5) * gameRect.width + gameRect.left;
            const y = (vector.y * -.5 + .5) * gameRect.height + gameRect.top;
            portal.tag.style.left = `${x}px`;
            portal.tag.style.top = `${y}px`;
            portal.tag.style.transform = 'translate(-50%, -50%)';
            if (vector.z > 1) portal.tag.style.display = 'none';
            else portal.tag.style.display = 'block';
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
