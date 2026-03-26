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
    tallGrass: {x: 24, y: 17, w: 1, h: 1}, // Added tall grass for encounters
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

// 0: grass, 1: path, 2: stoneFloor, 3: wall, 4: water, 5: bridge, 6: tallGrass
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

    // Add Tall Grass patch for encounters
    for(let r=2; r<7; r++) {
        for(let c=2; c<8; c++) {
            mapGrid[r][c] = 6; // tallGrass
        }
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

    // Add Shop (Pokemart)
    mapObjects.push({ type: 'house', x: 8 * TILE_SIZE, y: 2 * TILE_SIZE, isShop: true });

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

    // Add a normal Trainer
    mapObjects.push({
        type: 'trainer', id: 'trainer_bugcatcher', name: 'Bug Catcher Tim',
        x: 10 * TILE_SIZE, y: 15 * TILE_SIZE,
        team: [generatePokemon(10, 3), generatePokemon(11, 4)]
    });

    // Portals
    createPortal(400, 100, 'dungeon', 'Dungeon Cave');
    createPortal(700, 450, 'gym', 'Pewter Gym');
}

function buildGymMap() {
    clearMap();
    // Fill with stone floor
    for(let r=0; r<MAP_ROWS; r++) {
        let row = [];
        for(let c=0; c<MAP_COLS; c++) {
            row.push(2);
        }
        mapGrid.push(row);
    }

    // Gym Path
    for(let r=3; r<MAP_ROWS; r++) {
        mapGrid[r][11] = 1;
        mapGrid[r][12] = 1;
        mapGrid[r][13] = 1;
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

    // Add Gym Trainers
    mapObjects.push({
        type: 'trainer', id: 'gym_trainer_1', name: 'Camper Liam',
        x: 9 * TILE_SIZE, y: 12 * TILE_SIZE,
        team: [generatePokemon(74, 10)] // Geodude
    });

    mapObjects.push({
        type: 'trainer', id: 'gym_boss_brock', name: 'Gym Leader Brock',
        x: 12 * TILE_SIZE, y: 4 * TILE_SIZE,
        badge: true,
        team: [generatePokemon(74, 12), generatePokemon(75, 14)] // Geodude, Graveler
    });

    createPortal(400, 500, 'city', 'Exit');
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
            else if (tile === 6) drawTile('tallGrass', px, py);
        }
    }

    // Draw Map Objects (Trees, Houses)
    mapObjects.sort((a,b) => a.y - b.y);
    for (const obj of mapObjects) {
        if (obj.type === 'tree') {
            drawTile('tree', obj.x, obj.y - TILE_SIZE);
        } else if (obj.type === 'house') {
            drawTile('house', obj.x, obj.y - TILE_SIZE * 2);
            if (obj.isShop) {
                ctx.fillStyle = 'blue';
                ctx.font = 'bold 10px Arial';
                ctx.textAlign = 'center';
                ctx.fillText('MART', obj.x + TILE_SIZE * 1.5, obj.y - TILE_SIZE);
            }
        } else if (obj.type === 'trainer') {
            if (!defeatedTrainers[obj.id]) {
                drawPlayerSprite(ctx, obj.x + TILE_SIZE/2, obj.y + TILE_SIZE/2, 'red', 'down', 0);
            }
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
let inBattle = false;
let myTeam = [];
let wildPokemon = null;
let activePokemon = null;
let turnActionLocked = false;
let defeatedTrainers = {};
let myBadges = 0;
let myMoney = 300;
let myInventory = { potion: 3 };
let inShop = false;

// Trainer Battle State
let opponentIsTrainer = false;
let opponentTeam = [];
let opponentIndex = 0;
let opponentTrainer = null;

const SPEED = 0.2;

// --- Battle System ---
const battleContainer = document.getElementById('battle-container');
const battleMessage = document.getElementById('battle-message');
const wildSprite = document.getElementById('wild-sprite');
const playerSprite = document.getElementById('player-sprite');
const wildNameLvl = document.getElementById('wild-name-level');
const playerNameLvl = document.getElementById('player-name-level');
const wildHpFill = document.getElementById('wild-hp-fill');
const playerHpFill = document.getElementById('player-hp-fill');
const playerHpText = document.getElementById('player-hp-text');
const btnItemCount = document.getElementById('btn-item-count');

function startBattle(trainer = null) {
    inBattle = true;
    turnActionLocked = false;
    opponentIsTrainer = trainer !== null;
    opponentTrainer = trainer;
    opponentIndex = 0;

    if (opponentIsTrainer) {
        // Load trainer's team
        // Deep copy so we don't modify the map object template
        opponentTeam = JSON.parse(JSON.stringify(trainer.team));
        wildPokemon = opponentTeam[0]; // 'wildPokemon' is actually the opponent pokemon
        document.getElementById('btn-catch').style.display = 'none'; // Can't catch trainer pokemon
    } else {
        // Generate Wild Pokemon (Level 2 to 5)
        const speciesIds = [1, 4, 7, 16, 19]; // Random early pokemon
        const wildId = speciesIds[Math.floor(Math.random() * speciesIds.length)];
        const wildLvl = Math.floor(Math.random() * 4) + 2;
        wildPokemon = generatePokemon(wildId, wildLvl);
        document.getElementById('btn-catch').style.display = 'inline-block';
    }

    // Ensure player has a starter
    if (myTeam.length === 0) {
        const starters = [1, 4, 7];
        const starterId = starters[Math.floor(Math.random() * starters.length)];
        myTeam.push(generatePokemon(starterId, 5));
    }
    activePokemon = myTeam[0];

    updateBattleUI();
    battleContainer.style.display = 'flex';

    if (opponentIsTrainer) {
        battleMessage.innerText = `Trainer ${trainer.name} wants to battle! They sent out ${wildPokemon.name}!`;
    } else {
        battleMessage.innerText = `A wild ${wildPokemon.name} appeared!`;
    }
}

function updateBattleUI() {
    wildSprite.src = POKEDEX[wildPokemon.speciesId].front;
    playerSprite.src = POKEDEX[activePokemon.speciesId].back;

    wildNameLvl.innerText = `${wildPokemon.name} Lv.${wildPokemon.level}`;
    playerNameLvl.innerText = `${activePokemon.name} Lv.${activePokemon.level}`;

    wildHpFill.style.width = `${Math.max(0, (wildPokemon.hp / wildPokemon.maxHp) * 100)}%`;
    playerHpFill.style.width = `${Math.max(0, (activePokemon.hp / activePokemon.maxHp) * 100)}%`;

    // Exact HP display
    playerHpText.innerText = `${Math.max(0, activePokemon.hp)} / ${activePokemon.maxHp}`;
    btnItemCount.innerText = myInventory.potion;

    // Color logic
    wildHpFill.style.backgroundColor = wildPokemon.hp / wildPokemon.maxHp < 0.2 ? 'red' : (wildPokemon.hp / wildPokemon.maxHp < 0.5 ? 'orange' : '#00ff00');
    playerHpFill.style.backgroundColor = activePokemon.hp / activePokemon.maxHp < 0.2 ? 'red' : (activePokemon.hp / activePokemon.maxHp < 0.5 ? 'orange' : '#00ff00');
}

function endBattle() {
    setTimeout(() => {
        inBattle = false;
        battleContainer.style.display = 'none';
        wildPokemon = null;
    }, 2000);
}

function processTurn(action) {
    if (!inBattle || !wildPokemon || activePokemon.hp <= 0 || turnActionLocked) return;

    turnActionLocked = true;

    if (action === 'run') {
        if (opponentIsTrainer) {
            battleMessage.innerText = "You can't run from a Trainer battle!";
            setTimeout(() => { turnActionLocked = false; }, 1500);
        } else {
            battleMessage.innerText = "Got away safely!";
            endBattle();
        }
        return;
    }

    if (action === 'catch') {
        const catchRate = 1 - (wildPokemon.hp / wildPokemon.maxHp);
        if (Math.random() < catchRate + 0.1) {
            battleMessage.innerText = `Gotcha! ${wildPokemon.name} was caught!`;
            myTeam.push(wildPokemon);
            endBattle();
        } else {
            battleMessage.innerText = `Oh no! ${wildPokemon.name} broke free!`;
            setTimeout(wildAttack, 1000);
        }
        return;
    }

    if (action === 'item') {
        if (myInventory.potion > 0) {
            myInventory.potion -= 1;
            activePokemon.hp = Math.min(activePokemon.maxHp, activePokemon.hp + 20);
            battleMessage.innerText = `You used a Potion! ${activePokemon.name} recovered 20 HP.`;
            updateBattleUI();
            updateMyUI();
            setTimeout(wildAttack, 1500);
        } else {
            battleMessage.innerText = "You don't have any Potions left!";
            setTimeout(() => { turnActionLocked = false; }, 1500);
        }
        return;
    }

    if (action === 'fight') {
        // Player attacks
        const moveData = MOVES[activePokemon.move];
        const multiplier = getMultiplier(moveData.type, POKEDEX[wildPokemon.speciesId].type);
        const damage = Math.max(1, Math.floor((((2 * activePokemon.level / 5 + 2) * moveData.power * (activePokemon.atk / wildPokemon.def)) / 50 + 2) * multiplier));

        wildPokemon.hp -= damage;
        let effMsg = multiplier > 1 ? " It's super effective!" : (multiplier < 1 ? " It's not very effective..." : "");
        battleMessage.innerText = `${activePokemon.name} used ${activePokemon.move}!${effMsg}`;

        updateBattleUI();

        if (wildPokemon.hp <= 0) {
            wildPokemon.hp = 0;
            const prefix = opponentIsTrainer ? "Opponent's" : "Wild";
            battleMessage.innerText = `${prefix} ${wildPokemon.name} fainted!`;
            setTimeout(awardExp, 1000);
            return;
        }

        setTimeout(wildAttack, 1500);
    }
}

function wildAttack() {
    if (!inBattle || wildPokemon.hp <= 0) return;

    const moveData = MOVES[wildPokemon.move];
    const multiplier = getMultiplier(moveData.type, POKEDEX[activePokemon.speciesId].type);
    const damage = Math.max(1, Math.floor((((2 * wildPokemon.level / 5 + 2) * moveData.power * (wildPokemon.atk / activePokemon.def)) / 50 + 2) * multiplier));

    activePokemon.hp -= damage;
    let effMsg = multiplier > 1 ? " It's super effective!" : (multiplier < 1 ? " It's not very effective..." : "");
    battleMessage.innerText = `Wild ${wildPokemon.name} used ${wildPokemon.move}!${effMsg}`;

    updateBattleUI();

    if (activePokemon.hp <= 0) {
        activePokemon.hp = 0;
        battleMessage.innerText = `${activePokemon.name} fainted! You blacked out!`;
        // Send player back to start and heal
        players[myId].x = 400;
        players[myId].y = 400;
        activePokemon.hp = activePokemon.maxHp;
        socket.emit('changeMap', { map: 'city', x: 400, y: 400 });
        endBattle();
    } else {
        turnActionLocked = false; // Player can act again
    }
}

function awardExp() {
    const expGain = wildPokemon.level * 10;
    const moneyGain = opponentIsTrainer ? wildPokemon.level * 20 : wildPokemon.level * 5;
    activePokemon.exp += expGain;
    myMoney += moneyGain;
    updateMyUI();
    battleMessage.innerText = `${activePokemon.name} gained ${expGain} EXP! Found $${moneyGain}!`;

    const expNeeded = activePokemon.level * 20;
    if (activePokemon.exp >= expNeeded) {
        activePokemon.level++;
        activePokemon.exp -= expNeeded;
        // Basic stat scaling
        activePokemon.maxHp += 5;
        activePokemon.hp += 5;
        activePokemon.atk += 2;
        activePokemon.def += 2;

        setTimeout(() => {
            battleMessage.innerText = `${activePokemon.name} grew to level ${activePokemon.level}!`;

            // Check Evolution
            const dexData = POKEDEX[activePokemon.speciesId];
            if (dexData.evolvesAt && activePokemon.level >= dexData.evolvesAt) {
                setTimeout(() => {
                    const evoName = POKEDEX[dexData.evolvesTo].name;
                    battleMessage.innerText = `What? ${activePokemon.name} is evolving! ... It became ${evoName}!`;
                    activePokemon.speciesId = dexData.evolvesTo;
                    activePokemon.name = evoName;
                    activePokemon.move = POKEDEX[dexData.evolvesTo].move;
                    updateBattleUI();
                    checkBattleContinue();
                }, 1500);
            } else {
                checkBattleContinue();
            }
        }, 1500);
    } else {
        checkBattleContinue();
    }
}

function checkBattleContinue() {
    if (opponentIsTrainer) {
        opponentIndex++;
        if (opponentIndex < opponentTeam.length) {
            wildPokemon = opponentTeam[opponentIndex];
            setTimeout(() => {
                battleMessage.innerText = `${opponentTrainer.name} sent out ${wildPokemon.name}!`;
                updateBattleUI();
                turnActionLocked = false;
            }, 1000);
        } else {
            setTimeout(() => {
                battleMessage.innerText = `You defeated ${opponentTrainer.name}!`;
                defeatedTrainers[opponentTrainer.id] = true;

                if (opponentTrainer.badge) {
                    myBadges++;
                    document.getElementById('badgeDisplay').innerText = myBadges;
                    setTimeout(() => {
                        battleMessage.innerText = `You received the BOULDER BADGE!`;
                        setTimeout(endBattle, 2000);
                    }, 1500);
                } else {
                    endBattle();
                }
            }, 1000);
        }
    } else {
        endBattle();
    }
}

// Shop Logic
document.getElementById('btn-buy-potion').addEventListener('click', () => {
    if (myMoney >= 50) {
        myMoney -= 50;
        myInventory.potion += 1;
        updateMyUI();
        alert('Bought a Potion!');
    } else {
        alert('Not enough money!');
    }
});
document.getElementById('btn-close-shop').addEventListener('click', () => {
    inShop = false;
    document.getElementById('shop-container').style.display = 'none';
    // push player away slightly so they don't instantly trigger it again
    players[myId].y += 10;
});

// Attach Battle Listeners
document.getElementById('btn-fight').addEventListener('click', () => processTurn('fight'));
document.getElementById('btn-item').addEventListener('click', () => processTurn('item'));
document.getElementById('btn-catch').addEventListener('click', () => processTurn('catch'));
document.getElementById('btn-run').addEventListener('click', () => processTurn('run'));

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
    else if (mapName === 'gym') buildGymMap();
    else if (mapName === 'dungeon') buildDungeonMap();
}

function updateMyUI() {
    if (players[myId]) {
        // We track local team level instead of just server level since we have local RPG state now
        const activeLvl = activePokemon ? activePokemon.level : (players[myId].level || 1);
        const activeExp = activePokemon ? activePokemon.exp : (players[myId].exp || 0);
        const activeExpNeeded = activeLvl * 20;

        levelDisplay.innerText = activeLvl;
        expDisplay.innerText = activeExp;
        expNeededDisplay.innerText = activeExpNeeded;

        document.getElementById('moneyDisplay').innerText = myMoney;
        document.getElementById('potionDisplay').innerText = myInventory.potion;
    }
}

// --- Update Loop ---
function animate() {
    if (!myId || !players[myId]) return;

    const me = players[myId];
    const oldX = me.x;
    const oldY = me.y;

    if (!inBattle) {
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

            // Shop Collision Check
            let shopCollision = false;
            for (const obj of mapObjects) {
                if (obj.isShop) {
                    const hx = obj.x + TILE_SIZE;
                    const hy = obj.y + TILE_SIZE;
                    const dx = me.x - hx;
                    const dy = me.y - hy;
                    if (dx*dx + dy*dy < 1200) { // ~34 pixel radius interaction
                        shopCollision = true;
                        if (!inShop) {
                            inShop = true;
                            document.getElementById('shop-container').style.display = 'block';
                        }
                        break;
                    }
                }
            }
            if (!shopCollision && inShop) {
                inShop = false;
                document.getElementById('shop-container').style.display = 'none';
            }

            // Encounter check in tall grass
            const gridX = Math.floor(me.x / TILE_SIZE);
            const gridY = Math.floor(me.y / TILE_SIZE);
            if (mapGrid[gridY] && mapGrid[gridY][gridX] === 6) {
                // Moving in tall grass, trigger random battle chance
                if (Math.random() < 0.02) {
                    startBattle();
                }
            }

            // Trainer Collision Check
            for (const obj of mapObjects) {
                if (obj.type === 'trainer' && !defeatedTrainers[obj.id]) {
                    // Center of trainer tile vs center of player tile
                    const tx = obj.x + TILE_SIZE / 2;
                    const ty = obj.y + TILE_SIZE / 2;
                    const dx = me.x - tx;
                    const dy = me.y - ty;
                    if (dx*dx + dy*dy < 400) { // ~20 pixel radius interaction
                        startBattle(obj);
                        break;
                    }
                }
            }

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
