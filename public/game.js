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
let MAP_COLS = 50; // 1600 / 32
let MAP_ROWS = 50; // 1600 / 32
let camX = 0;
let camY = 0;

// 0: grass, 1: path, 2: stoneFloor, 3: wall, 4: water, 5: bridge, 6: tallGrass
function clearMap() {
    mapGrid = [];
    portals = [];
    mapObjects = []; // Extra objects like trees/houses
}

function buildCityMap() {
    clearMap();
    MAP_COLS = 50;
    MAP_ROWS = 50;

    // Fill with grass
    for(let r=0; r<MAP_ROWS; r++) {
        let row = [];
        for(let c=0; c<MAP_COLS; c++) {
            row.push(0); // grass
        }
        mapGrid.push(row);
    }

    // Add Multiple Tall Grass patches
    for(let r=5; r<15; r++) {
        for(let c=2; c<10; c++) {
            mapGrid[r][c] = 6;
        }
    }
    for(let r=30; r<45; r++) {
        for(let c=30; c<40; c++) {
            mapGrid[r][c] = 6;
        }
    }

    // Draw paths connecting points of interest
    for(let r=10; r<40; r++) {
        mapGrid[r][15] = 1;
        mapGrid[r][16] = 1;
    }
    for(let c=15; c<45; c++) {
        mapGrid[25][c] = 1;
        mapGrid[26][c] = 1;
    }

    // Add a River down the middle
    for(let r=0; r<MAP_ROWS; r++) {
        mapGrid[r][28] = 4; // Water
        mapGrid[r][29] = 4; // Water
    }

    // Bridge over river
    mapGrid[25][28] = 5;
    mapGrid[25][29] = 5;
    mapGrid[26][28] = 5;
    mapGrid[26][29] = 5;

    // Add Houses and Shop spread out
    mapObjects.push({ type: 'house', x: 12 * TILE_SIZE, y: 8 * TILE_SIZE });
    mapObjects.push({ type: 'house', x: 20 * TILE_SIZE, y: 8 * TILE_SIZE });
    mapObjects.push({ type: 'house', x: 12 * TILE_SIZE, y: 35 * TILE_SIZE });

    // Add Shop (Pokemart) centrally located
    mapObjects.push({ type: 'house', x: 16 * TILE_SIZE, y: 22 * TILE_SIZE, isShop: true });

    // Add Trees (Forest border for new large size)
    for(let c=0; c<MAP_COLS; c++) {
        mapObjects.push({ type: 'tree', x: c * TILE_SIZE, y: -TILE_SIZE });
        mapObjects.push({ type: 'tree', x: c * TILE_SIZE, y: (MAP_ROWS - 1) * TILE_SIZE });
    }
    for(let r=1; r<MAP_ROWS-1; r++) {
        mapObjects.push({ type: 'tree', x: -TILE_SIZE/2, y: r * TILE_SIZE });
        mapObjects.push({ type: 'tree', x: (MAP_COLS - 1) * TILE_SIZE, y: r * TILE_SIZE });
    }

    // A few random trees for flavor
    mapObjects.push({ type: 'tree', x: 8 * TILE_SIZE, y: 12 * TILE_SIZE });
    mapObjects.push({ type: 'tree', x: 35 * TILE_SIZE, y: 28 * TILE_SIZE });
    mapObjects.push({ type: 'tree', x: 42 * TILE_SIZE, y: 15 * TILE_SIZE });

    // Trainers
    mapObjects.push({
        type: 'trainer', id: 'trainer_bugcatcher', name: 'Bug Catcher Tim',
        x: 10 * TILE_SIZE, y: 18 * TILE_SIZE,
        team: [generatePokemon(10, 3), generatePokemon(11, 4)]
    });
    mapObjects.push({
        type: 'trainer', id: 'trainer_youngster', name: 'Youngster Joey',
        x: 32 * TILE_SIZE, y: 35 * TILE_SIZE,
        team: [generatePokemon(19, 4), generatePokemon(19, 5)]
    });

    // Portals
    createPortal(16 * TILE_SIZE, 12 * TILE_SIZE, 'rock_dungeon', 'Mt. Moon Cave');
    createPortal(40 * TILE_SIZE, 40 * TILE_SIZE, 'water_dungeon', 'Seafoam Cave');
    createPortal(40 * TILE_SIZE, 26 * TILE_SIZE, 'gym', 'Pewter Gym');
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

function buildRockDungeon() {
    clearMap();
    MAP_COLS = 30;
    MAP_ROWS = 30;

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

    // Some inner walls (Maze-like)
    for(let r=4; r<20; r++) {
        mapGrid[r][10] = 3;
        mapGrid[r][20] = 3;
    }
    for(let c=10; c<20; c++) {
        mapGrid[25][c] = 3;
    }

    // Add Hiker Trainer
    mapObjects.push({
        type: 'trainer', id: 'trainer_hiker1', name: 'Hiker David',
        x: 15 * TILE_SIZE, y: 15 * TILE_SIZE,
        team: [generatePokemon(74, 8), generatePokemon(41, 7)] // Geodude, Zubat
    });

    createPortal(400, 800, 'city', 'Exit to City');
}

function buildWaterDungeon() {
    clearMap();
    MAP_COLS = 30;
    MAP_ROWS = 30;

    // Fill with Water
    for(let r=0; r<MAP_ROWS; r++) {
        let row = [];
        for(let c=0; c<MAP_COLS; c++) {
            row.push(4); // water
        }
        mapGrid.push(row);
    }

    // Add Path islands
    for(let r=5; r<25; r++) {
        for(let c=5; c<25; c++) {
            if (Math.random() > 0.5) mapGrid[r][c] = 1; // path
        }
    }

    // Ensure start point is solid
    for(let r=25; r<29; r++) {
        for(let c=12; c<16; c++) {
            mapGrid[r][c] = 1;
        }
    }

    // Add Swimmer Trainer
    mapObjects.push({
        type: 'trainer', id: 'trainer_swimmer1', name: 'Swimmer Misty',
        x: 15 * TILE_SIZE, y: 10 * TILE_SIZE,
        team: [generatePokemon(72, 10), generatePokemon(54, 9)] // Tentacool, Psyduck
    });

    createPortal(450, 850, 'city', 'Exit to City');
}

function createPortal(x, y, targetMap, label) {
    portals.push({ x, y, radius: 20, targetMap, label });
}

function drawMap() {
    const time = Date.now();
    const waterFrame = Math.floor(time / 400) % 3;

    // Calculate visible grid based on camera
    const startCol = Math.max(0, Math.floor(camX / TILE_SIZE) - 1);
    const endCol = Math.min(MAP_COLS, startCol + Math.ceil(800 / TILE_SIZE) + 2);
    const startRow = Math.max(0, Math.floor(camY / TILE_SIZE) - 1);
    const endRow = Math.min(MAP_ROWS, startRow + Math.ceil(600 / TILE_SIZE) + 2);

    // Draw Base Grid (Culling applied)
    for(let r=startRow; r<endRow; r++) {
        for(let c=startCol; c<endCol; c++) {
            if (!mapGrid[r] || mapGrid[r][c] === undefined) continue;
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
        // Simple culling for objects
        if (obj.x < camX - 100 || obj.x > camX + 900 || obj.y < camY - 100 || obj.y > camY + 700) continue;

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
        if (portal.x < camX - 50 || portal.x > camX + 850 || portal.y < camY - 50 || portal.y > camY + 650) continue;

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
let myInventory = { potion: 3, superPotion: 0, pokeball: 5 };
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
const btnPotionCount = document.getElementById('btn-potion-count');
const btnSuperPotionCount = document.getElementById('btn-superpotion-count');
const btnPokeballCount = document.getElementById('btn-pokeball-count');

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
    btnPotionCount.innerText = myInventory.potion;
    btnSuperPotionCount.innerText = myInventory.superPotion;
    btnPokeballCount.innerText = myInventory.pokeball;

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
        if (myInventory.pokeball > 0) {
            myInventory.pokeball -= 1;
            updateMyUI();
            updateBattleUI();
            const catchRate = 1 - (wildPokemon.hp / wildPokemon.maxHp);
            if (Math.random() < catchRate + 0.1) {
                battleMessage.innerText = `Gotcha! ${wildPokemon.name} was caught!`;
                myTeam.push(wildPokemon);
                endBattle();
            } else {
                battleMessage.innerText = `Oh no! ${wildPokemon.name} broke free!`;
                setTimeout(wildAttack, 1000);
            }
        } else {
            battleMessage.innerText = "You don't have any Pokeballs left!";
            setTimeout(() => { turnActionLocked = false; }, 1500);
        }
        return;
    }

    if (action === 'potion') {
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

    if (action === 'superpotion') {
        if (myInventory.superPotion > 0) {
            myInventory.superPotion -= 1;
            activePokemon.hp = Math.min(activePokemon.maxHp, activePokemon.hp + 50);
            battleMessage.innerText = `You used a Super Potion! ${activePokemon.name} recovered 50 HP.`;
            updateBattleUI();
            updateMyUI();
            setTimeout(wildAttack, 1500);
        } else {
            battleMessage.innerText = "You don't have any Super Potions left!";
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
document.getElementById('btn-buy-pokeball').addEventListener('click', () => {
    if (myMoney >= 100) {
        myMoney -= 100;
        myInventory.pokeball += 1;
        updateMyUI();
        alert('Bought a Pokeball!');
    } else {
        alert('Not enough money!');
    }
});
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
document.getElementById('btn-buy-superpotion').addEventListener('click', () => {
    if (myMoney >= 150) {
        myMoney -= 150;
        myInventory.superPotion += 1;
        updateMyUI();
        alert('Bought a Super Potion!');
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
document.getElementById('btn-item').addEventListener('click', () => processTurn('potion'));
document.getElementById('btn-item-super').addEventListener('click', () => processTurn('superpotion'));
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
    else if (mapName === 'rock_dungeon') buildRockDungeon();
    else if (mapName === 'water_dungeon') buildWaterDungeon();
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
        document.getElementById('superPotionDisplay').innerText = myInventory.superPotion;
        document.getElementById('pokeballDisplay').innerText = myInventory.pokeball;
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
        if (me.x > MAP_COLS * TILE_SIZE) me.x = MAP_COLS * TILE_SIZE;
        if (me.y < 0) me.y = 0;
        if (me.y > MAP_ROWS * TILE_SIZE) me.y = MAP_ROWS * TILE_SIZE;

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

    // Calculate Camera Position
    camX = Math.max(0, Math.min(me.x - 400, MAP_COLS * TILE_SIZE - 800));
    camY = Math.max(0, Math.min(me.y - 300, MAP_ROWS * TILE_SIZE - 600));

    // Clear Canvas and Draw Map
    ctx.clearRect(0, 0, 800, 600);

    ctx.save();
    ctx.translate(-camX, -camY);

    drawMap();

    // Draw Players (Sort by Y for depth)
    const playersInMap = Object.values(players).filter(p => p.map === currentMap);
    playersInMap.sort((a,b) => a.y - b.y);

    for (const p of playersInMap) {
        // Simple culling for players off screen
        if (p.x < camX - 100 || p.x > camX + 900 || p.y < camY - 100 || p.y > camY + 700) continue;

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

    ctx.restore();

    requestAnimationFrame(animate);
}
