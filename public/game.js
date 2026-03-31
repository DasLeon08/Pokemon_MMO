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

// --- Assets Management ---
const TILE_SIZE = 48; // Upscale from typical 16px to 48px for better visibility
let mapLoaded = false;
const mapImage = new Image();
mapImage.src = 'map.png';
mapImage.onload = () => { mapLoaded = true; };

const playerImages = {
    down: new Image(),
    up: new Image(),
    left: new Image(),
    right: new Image()
};
playerImages.down.src = 'playerDown.png';
playerImages.up.src = 'playerUp.png';
playerImages.left.src = 'playerLeft.png';
playerImages.right.src = 'playerRight.png';

let playersLoaded = false;
let loadedCount = 0;
for (const key in playerImages) {
    playerImages[key].onload = () => {
        loadedCount++;
        if (loadedCount === 4) playersLoaded = true;
    };
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

function fillMapGrid(tileId) {
    for(let r=0; r<MAP_ROWS; r++) {
        let row = [];
        for(let c=0; c<MAP_COLS; c++) {
            row.push(tileId);
        }
        mapGrid.push(row);
    }
}

function buildBorderTrees() {
    for(let c=0; c<MAP_COLS; c++) {
        mapObjects.push({ type: 'tree', x: c * TILE_SIZE, y: -TILE_SIZE });
        mapObjects.push({ type: 'tree', x: c * TILE_SIZE, y: (MAP_ROWS - 1) * TILE_SIZE });
    }
    for(let r=1; r<MAP_ROWS-1; r++) {
        mapObjects.push({ type: 'tree', x: -TILE_SIZE/2, y: r * TILE_SIZE });
        mapObjects.push({ type: 'tree', x: (MAP_COLS - 1) * TILE_SIZE, y: r * TILE_SIZE });
    }
}

function buildTown1() {
    clearMap();
    MAP_COLS = 25;
    MAP_ROWS = 25;
    fillMapGrid(0); // Grass

    // Main path vertically through town
    for (let r=0; r<MAP_ROWS; r++) {
        mapGrid[r][11] = 1;
        mapGrid[r][12] = 1;
    }
    // Path to houses
    for (let c=5; c<20; c++) {
        mapGrid[18][c] = 1;
        mapGrid[19][c] = 1;
        mapGrid[8][c] = 1;
        mapGrid[9][c] = 1;
    }

    // A small pond in the bottom right corner
    for(let r=20; r<24; r++) {
        for(let c=18; c<24; c++) {
            mapGrid[r][c] = 4; // Water
        }
    }

    // Peaceful starter houses
    mapObjects.push({ type: 'house', x: 5 * TILE_SIZE, y: 15 * TILE_SIZE }); // Player's House
    mapObjects.push({ type: 'house', x: 16 * TILE_SIZE, y: 15 * TILE_SIZE }); // Rival's House
    mapObjects.push({ type: 'house', x: 10 * TILE_SIZE, y: 5 * TILE_SIZE }); // Professor Lab (Top center)

    // Signs
    mapObjects.push({ type: 'sign', x: 7 * TILE_SIZE, y: 18 * TILE_SIZE, text: "Pallet Town: Shades of your journey await!" });
    mapObjects.push({ type: 'sign', x: 12 * TILE_SIZE, y: 8 * TILE_SIZE, text: "Professor Oak's Research Lab" });

    buildBorderTrees();

    // Remove top tree border where the portal to Route 1 is
    mapObjects = mapObjects.filter(o => !(o.type === 'tree' && o.y === -TILE_SIZE && (o.x === 11*TILE_SIZE || o.x === 12*TILE_SIZE)));

    // Portal North to Route 1
    createPortal(12 * TILE_SIZE + 16, 10, 'route1', 'To Route 1');
}

function buildRoute1() {
    clearMap();
    MAP_COLS = 20;
    MAP_ROWS = 45; // Long vertical route
    fillMapGrid(0);

    // Winding Path from bottom to top
    for (let r=40; r<45; r++) { mapGrid[r][9] = 1; mapGrid[r][10] = 1; }
    for (let c=5; c<=10; c++) { mapGrid[40][c] = 1; mapGrid[41][c] = 1; }
    for (let r=25; r<=40; r++) { mapGrid[r][5] = 1; mapGrid[r][6] = 1; }
    for (let c=5; c<=14; c++) { mapGrid[25][c] = 1; mapGrid[26][c] = 1; }
    for (let r=10; r<=25; r++) { mapGrid[r][13] = 1; mapGrid[r][14] = 1; }
    for (let c=9; c<=14; c++) { mapGrid[10][c] = 1; mapGrid[11][c] = 1; }
    for (let r=0; r<=10; r++) { mapGrid[r][9] = 1; mapGrid[r][10] = 1; }

    // Patches of tall grass filling the sides
    for(let r=28; r<38; r++) { for(let c=9; c<18; c++) { mapGrid[r][c] = 6; } }
    for(let r=12; r<22; r++) { for(let c=2; c<10; c++) { mapGrid[r][c] = 6; } }

    // Ledges (using walls to simulate terrain barriers)
    for(let c=1; c<5; c++) mapGrid[30][c] = 3;
    for(let c=15; c<19; c++) mapGrid[15][c] = 3;

    // Trainers
    mapObjects.push({
        type: 'trainer', id: 'route1_bugcatcher', name: 'Bug Catcher Tim',
        x: 15 * TILE_SIZE, y: 35 * TILE_SIZE,
        team: [generatePokemon(10, 3), generatePokemon(11, 4)]
    });
    mapObjects.push({
        type: 'trainer', id: 'route1_youngster', name: 'Youngster Joey',
        x: 4 * TILE_SIZE, y: 15 * TILE_SIZE,
        team: [generatePokemon(19, 4), generatePokemon(19, 5)]
    });
    mapObjects.push({
        type: 'trainer', id: 'route1_lass', name: 'Lass Sally',
        x: 10 * TILE_SIZE, y: 22 * TILE_SIZE,
        team: [generatePokemon(16, 5), generatePokemon(43, 4)] // Pidgey, Oddish
    });

    mapObjects.push({ type: 'sign', x: 12 * TILE_SIZE, y: 42 * TILE_SIZE, text: "Route 1 - Beware of wild Pokemon in the tall grass!" });

    buildBorderTrees();
    // Open path South to Town 1
    mapObjects = mapObjects.filter(o => !(o.type === 'tree' && o.y === (MAP_ROWS-1)*TILE_SIZE && (o.x === 9*TILE_SIZE || o.x === 10*TILE_SIZE)));
    // Open path North to Town 2
    mapObjects = mapObjects.filter(o => !(o.type === 'tree' && o.y === -TILE_SIZE && (o.x === 9*TILE_SIZE || o.x === 10*TILE_SIZE)));

    createPortal(10 * TILE_SIZE + 16, MAP_ROWS * TILE_SIZE - 20, 'town1', 'To Pallet Town');
    createPortal(10 * TILE_SIZE + 16, 10, 'town2', 'To Viridian City');
}

function buildTown2() {
    clearMap();
    MAP_COLS = 50;
    MAP_ROWS = 50;
    fillMapGrid(0); // Grass

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

    buildBorderTrees();

    // Open path South to Route 1
    mapObjects = mapObjects.filter(o => !(o.type === 'tree' && o.y === (MAP_ROWS-1)*TILE_SIZE && (o.x === 15*TILE_SIZE || o.x === 16*TILE_SIZE)));

    // Open path East to Route 2
    for(let r=25; r<27; r++) { mapGrid[r][MAP_COLS-1] = 1; }
    mapObjects = mapObjects.filter(o => !(o.type === 'tree' && o.x === (MAP_COLS-1)*TILE_SIZE && o.y >= 25*TILE_SIZE && o.y <= 27*TILE_SIZE));

    createPortal(16 * TILE_SIZE + 16, MAP_ROWS * TILE_SIZE - 20, 'route1', 'To Route 1');
    createPortal(MAP_COLS * TILE_SIZE - 20, 26 * TILE_SIZE + 16, 'route2', 'To Route 2');

    // Dungeons and Gym entrances scattered around the city edges
    createPortal(50, 20 * TILE_SIZE + 16, 'water_dungeon', 'Seafoam Cave');
    createPortal(20 * TILE_SIZE + 16, 50, 'rock_dungeon', 'Mt. Moon Cave');
    createPortal(MAP_COLS * TILE_SIZE - 200, 10 * TILE_SIZE + 16, 'gym', 'Pewter Gym');
}

function buildRoute2() {
    clearMap();
    MAP_COLS = 60;
    MAP_ROWS = 25; // Long horizontal route
    fillMapGrid(0);

    // Winding Path from left to right
    for (let c=0; c<15; c++) { mapGrid[6][c] = 1; mapGrid[7][c] = 1; }
    for (let r=6; r<20; r++) { mapGrid[r][14] = 1; mapGrid[r][15] = 1; }
    for (let c=14; c<35; c++) { mapGrid[19][c] = 1; mapGrid[20][c] = 1; }
    for (let r=12; r<20; r++) { mapGrid[r][34] = 1; mapGrid[r][35] = 1; }
    for (let c=34; c<MAP_COLS; c++) { mapGrid[12][c] = 1; mapGrid[13][c] = 1; }

    // Enormous patches of tall grass
    for(let r=2; r<5; r++) { for(let c=5; c<14; c++) { mapGrid[r][c] = 6; } }
    for(let r=14; r<19; r++) { for(let c=20; c<30; c++) { mapGrid[r][c] = 6; } }
    for(let r=15; r<22; r++) { for(let c=40; c<55; c++) { mapGrid[r][c] = 6; } }

    // Trainers
    mapObjects.push({
        type: 'trainer', id: 'route2_lass', name: 'Lass Mia',
        x: 20 * TILE_SIZE, y: 15 * TILE_SIZE,
        team: [generatePokemon(43, 6), generatePokemon(43, 7)] // Oddish
    });
    mapObjects.push({
        type: 'trainer', id: 'route2_hiker', name: 'Hiker Bob',
        x: 40 * TILE_SIZE, y: 10 * TILE_SIZE,
        team: [generatePokemon(74, 8), generatePokemon(66, 8)] // Geodude, Machop
    });

    mapObjects.push({ type: 'sign', x: 25 * TILE_SIZE, y: 22 * TILE_SIZE, text: "Route 2 - The long road East to Cerulean City." });

    buildBorderTrees();

    // Open path West to Town 2
    mapObjects = mapObjects.filter(o => !(o.type === 'tree' && o.x === -TILE_SIZE/2 && o.y >= 5*TILE_SIZE && o.y <= 7*TILE_SIZE));
    // Open path East to Town 3
    mapObjects = mapObjects.filter(o => !(o.type === 'tree' && o.x === (MAP_COLS-1)*TILE_SIZE && o.y >= 12*TILE_SIZE && o.y <= 14*TILE_SIZE));

    createPortal(20, 6 * TILE_SIZE + 16, 'town2', 'To Viridian City');
    createPortal(MAP_COLS * TILE_SIZE - 20, 13 * TILE_SIZE, 'town3', 'To Cerulean City');
}

function buildTown3() {
    clearMap();
    MAP_COLS = 60;
    MAP_ROWS = 60;
    fillMapGrid(0);

    // Giant central lake
    for(let r=15; r<45; r++) {
        for(let c=15; c<45; c++) {
            // Rough circle formula to make a round lake
            const dc = c - 30;
            const dr = r - 30;
            if (dc*dc + dr*dr < 225) { // Radius 15
                mapGrid[r][c] = 4; // Water
            }
        }
    }

    // Main paths wrapping around the lake
    for(let r=0; r<MAP_ROWS; r++) { mapGrid[r][10] = 1; mapGrid[r][11] = 1; } // Left vertical
    for(let r=0; r<MAP_ROWS; r++) { mapGrid[r][50] = 1; mapGrid[r][51] = 1; } // Right vertical
    for(let c=0; c<MAP_COLS; c++) { mapGrid[10][c] = 1; mapGrid[11][c] = 1; } // Top horizontal
    for(let c=0; c<MAP_COLS; c++) { mapGrid[50][c] = 1; mapGrid[51][c] = 1; } // Bottom horizontal

    // Bridge over the top of the lake
    for(let c=20; c<40; c++) {
        if(mapGrid[15][c] === 4) { mapGrid[15][c] = 5; mapGrid[16][c] = 5; }
    }
    // Connect bridge to paths
    for(let r=12; r<15; r++) { mapGrid[r][30] = 1; mapGrid[r][31] = 1; }

    // Buildings & Shops
    mapObjects.push({ type: 'house', x: 5 * TILE_SIZE, y: 5 * TILE_SIZE });
    mapObjects.push({ type: 'house', x: 15 * TILE_SIZE, y: 5 * TILE_SIZE });
    mapObjects.push({ type: 'house', x: 40 * TILE_SIZE, y: 5 * TILE_SIZE });
    mapObjects.push({ type: 'house', x: 5 * TILE_SIZE, y: 40 * TILE_SIZE });

    // Huge Pokemart
    mapObjects.push({ type: 'house', x: 45 * TILE_SIZE, y: 40 * TILE_SIZE, isShop: true });

    // Signs
    mapObjects.push({ type: 'sign', x: 30 * TILE_SIZE, y: 12 * TILE_SIZE, text: "Cerulean City: A Floral City Surrounded by Water" });
    mapObjects.push({ type: 'sign', x: 48 * TILE_SIZE, y: 45 * TILE_SIZE, text: "Cerulean Dept. Store" });
    mapObjects.push({ type: 'sign', x: 12 * TILE_SIZE, y: 48 * TILE_SIZE, text: "Cerulean Gym - Leader: Misty" });

    // Gym Entrance (Looks like a normal house here, but goes to gym2)
    mapObjects.push({ type: 'house', x: 10 * TILE_SIZE, y: 45 * TILE_SIZE });
    createPortal(11 * TILE_SIZE, 48 * TILE_SIZE, 'gym2', 'Cerulean Gym');

    buildBorderTrees();

    // Open path West to Route 2
    for(let r=12; r<15; r++) mapGrid[r][0] = 1; // Connect path explicitly
    mapObjects = mapObjects.filter(o => !(o.type === 'tree' && o.x === -TILE_SIZE/2 && o.y >= 12*TILE_SIZE && o.y <= 14*TILE_SIZE));

    createPortal(20, 13 * TILE_SIZE + 16, 'route2', 'To Route 2');
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
        badge: true, badgeName: 'BOULDER BADGE',
        team: [generatePokemon(74, 12), generatePokemon(75, 14)] // Geodude, Graveler
    });

    createPortal(400, 500, 'town2', 'Exit');
}

function buildGym2() {
    clearMap();
    MAP_COLS = 25;
    MAP_ROWS = 25;
    // Fill with water
    for(let r=0; r<MAP_ROWS; r++) {
        let row = [];
        for(let c=0; c<MAP_COLS; c++) {
            row.push(4); // water
        }
        mapGrid.push(row);
    }

    // Gym Path (Bridge)
    for(let r=3; r<MAP_ROWS; r++) {
        mapGrid[r][11] = 5;
        mapGrid[r][12] = 5;
        mapGrid[r][13] = 5;
    }

    // Boss Platform
    for(let r=1; r<5; r++) {
        for(let c=10; c<15; c++) {
            mapGrid[r][c] = 2; // Stone floor
        }
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
        type: 'trainer', id: 'gym_trainer_swimmer1', name: 'Swimmer Shelly',
        x: 9 * TILE_SIZE, y: 15 * TILE_SIZE,
        team: [generatePokemon(72, 16), generatePokemon(72, 16)] // Tentacool
    });
    mapObjects.push({
        type: 'trainer', id: 'gym_trainer_swimmer2', name: 'Swimmer Luis',
        x: 14 * TILE_SIZE, y: 10 * TILE_SIZE,
        team: [generatePokemon(54, 17)] // Psyduck
    });

    mapObjects.push({
        type: 'trainer', id: 'gym_boss_misty', name: 'Gym Leader Misty',
        x: 12 * TILE_SIZE, y: 3 * TILE_SIZE,
        badge: true, badgeName: 'CASCADE BADGE',
        team: [generatePokemon(73, 21)] // Tentacruel
    });

    createPortal(400, 750, 'town3', 'Exit');
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

    createPortal(400, 800, 'town2', 'Exit to City');
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

    createPortal(450, 850, 'town3', 'Exit to City');
}

function createPortal(x, y, targetMap, label) {
    portals.push({ x, y, radius: 20, targetMap, label });
}

// --- Map offset for centering ---
const offset = {
    x: -735,
    y: -650
}

// Convert collision array to a 2D grid
const collisionsMap = [];
for (let i = 0; i < collisions.length; i += 70) {
    collisionsMap.push(collisions.slice(i, i + 70));
}

const battleZonesMap = [];
for (let i = 0; i < battleZonesData.length; i += 70) {
    battleZonesMap.push(battleZonesData.slice(i, i + 70));
}

const boundaries = [];
const battleZones = [];

collisionsMap.forEach((row, i) => {
    row.forEach((symbol, j) => {
        if (symbol === 1025) {
            boundaries.push({
                x: j * 48 + offset.x,
                y: i * 48 + offset.y,
                width: 48,
                height: 48
            });
        }
    });
});

battleZonesMap.forEach((row, i) => {
    row.forEach((symbol, j) => {
        if (symbol === 1025) {
            battleZones.push({
                x: j * 48 + offset.x,
                y: i * 48 + offset.y,
                width: 48,
                height: 48
            });
        }
    });
});

function drawMap() {
    if (!mapLoaded) return;

    // Draw the entire map background image with upscale
    // mapImage is 1024x576. We'll upscale it 2x (or roughly proportional to TILE_SIZE change).
    // The scale factor from original 12x12/16x16 to our 48 is roughly 3x or 4x.
    ctx.drawImage(mapImage, offset.x, offset.y);

    // Draw Map Objects (Trainers, etc.)
    for (const obj of mapObjects) {
        if (obj.type === 'trainer') {
            if (!defeatedTrainers[obj.id]) {
                drawPlayerSprite(ctx, obj.x, obj.y, 'red', 'down', 0);
            }
        }
    }
}

// Draw Player from Sprite Sheet
function drawPlayerSprite(ctx, x, y, color, facing = 'down', walkFrame = 0, isLocalPlayer = false) {
    // Player sprites are 4 frames per animation, 48x68 usually, but these specific ones:
    // width: 192 (4 frames of 48)
    // height: 68

    const frameIndex = Math.floor(walkFrame) % 4;
    const spriteWidth = playerImages.down.width / 4; // usually 48
    const spriteHeight = playerImages.down.height;   // usually 68

    const img = playerImages[facing] || playerImages.down;

    if (playersLoaded) {
        ctx.drawImage(
            img,
            frameIndex * spriteWidth, 0, spriteWidth, spriteHeight,
            x - spriteWidth/2, y - spriteHeight/2 - 10, spriteWidth, spriteHeight
        );
    } else {
        ctx.fillStyle = color || 'red';
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
const wildName = document.getElementById('wild-name');
const wildLvl = document.getElementById('wild-lvl');
const playerName = document.getElementById('player-name');
const playerLvl = document.getElementById('player-lvl');
const wildHpFill = document.getElementById('wild-hp-fill');
const playerHpFill = document.getElementById('player-hp-fill');
const playerHpText = document.getElementById('player-hp-text');
const btnPotionCount = document.getElementById('btn-potion-count');
const btnSuperPotionCount = document.getElementById('btn-superpotion-count');
const btnPokeballCount = document.getElementById('btn-pokeball-count');

// Function to set the battle background dynamically
function setBattleBackground(playerX, playerY) {
    const container = document.getElementById('battle-container');
    container.classList.remove('bg-grass', 'bg-water', 'bg-cave', 'bg-sand');

    // Use the current map name if available
    let bgClass = 'bg-grass'; // Default
    if (typeof currentMap !== 'undefined') {
        if (currentMap.includes('water')) {
            bgClass = 'bg-water';
        } else if (currentMap.includes('rock') || currentMap.includes('dungeon') || currentMap.includes('gym')) {
            bgClass = 'bg-cave';
        } else if (currentMap.includes('route2')) {
            bgClass = 'bg-sand';
        }
    }

    container.classList.add(bgClass);
}

function startBattle(trainer = null) {
    inBattle = true;
    turnActionLocked = false;
    opponentIsTrainer = trainer !== null;
    opponentTrainer = trainer;
    opponentIndex = 0;

    const me = players[socket.id];
    if (me) {
        setBattleBackground(me.x, me.y);
    }

    if (opponentIsTrainer) {
        // Load trainer's team
        // Deep copy so we don't modify the map object template
        opponentTeam = JSON.parse(JSON.stringify(trainer.team));
        wildPokemon = opponentTeam[0]; // 'wildPokemon' is actually the opponent pokemon
        document.getElementById('btn-catch').style.display = 'none'; // Can't catch trainer pokemon
    } else {
        // Only generate new if not already set by external test scripts
        if (!wildPokemon || wildPokemon.hp <= 0) {
            // Generate Wild Pokemon (Level 2 to 5)
        // Use an enormous variety across all 649 available Pokémon!
        // We'll pick random fully-evolved or base stages. To keep it simple, just a random number 1 to 649!
        const wildId = Math.floor(Math.random() * 649) + 1;
        const wildLvl = Math.floor(Math.random() * 8) + 2; // Level 2 to 9
            const isShiny = Math.random() < 0.05; // 5% chance shiny for fun
            wildPokemon = generatePokemon(wildId, wildLvl, isShiny);
        }
        document.getElementById('btn-catch').style.display = 'inline-block';
    }

    // Ensure player has a starter
    if (myTeam.length === 0) {
    // Starters across gens 1-5
    const starters = [1, 4, 7, 152, 155, 158, 252, 255, 258, 387, 390, 393, 495, 498, 501];
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
    wildSprite.src = wildPokemon.frontSprite;
    playerSprite.src = activePokemon.backSprite;

    // Add shiny sparkles effect later possibly, for now just use the text
    wildName.innerText = wildPokemon.name;
    wildLvl.innerText = `Lv.${wildPokemon.level}`;
    playerName.innerText = activePokemon.name;
    playerLvl.innerText = `Lv.${activePokemon.level}`;

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
        const moveData = MOVES[activePokemon.move] || MOVES['Tackle'];
        const wildDex = POKEDEX[wildPokemon.speciesId];
        const multiplier = getMultiplier(moveData.type, wildDex.type1, wildDex.type2);

        let aAtk = moveData.category === 'special' ? activePokemon.spatk : activePokemon.atk;
        let dDef = moveData.category === 'special' ? wildPokemon.spdef : wildPokemon.def;

        const damage = Math.max(1, Math.floor((((2 * activePokemon.level / 5 + 2) * moveData.power * (aAtk / dDef)) / 50 + 2) * multiplier));

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

    const moveData = MOVES[wildPokemon.move] || MOVES['Tackle'];
    const activeDex = POKEDEX[activePokemon.speciesId];
    const multiplier = getMultiplier(moveData.type, activeDex.type1, activeDex.type2);

    let aAtk = moveData.category === 'special' ? wildPokemon.spatk : wildPokemon.atk;
    let dDef = moveData.category === 'special' ? activePokemon.spdef : activePokemon.def;

    const damage = Math.max(1, Math.floor((((2 * wildPokemon.level / 5 + 2) * moveData.power * (aAtk / dDef)) / 50 + 2) * multiplier));

    activePokemon.hp -= damage;
    let effMsg = multiplier > 1 ? " It's super effective!" : (multiplier < 1 ? " It's not very effective..." : "");
    battleMessage.innerText = `${opponentIsTrainer ? "Opponent's" : "Wild"} ${wildPokemon.name} used ${wildPokemon.move}!${effMsg}`;

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
                    const evoId = dexData.evolvesTo;
                    const evoData = POKEDEX[evoId];
                    battleMessage.innerText = `What? ${activePokemon.name} is evolving! ... It became ${evoData.name}!`;

                    // Update stats proportionally to new base
                    activePokemon.speciesId = evoId;
                    activePokemon.name = evoData.name;
                    activePokemon.move = evoData.move;

                    const isShiny = activePokemon.isShiny;
                    activePokemon.frontSprite = isShiny ? (evoData.frontShiny || evoData.front) : evoData.front;
                    activePokemon.backSprite = isShiny ? (evoData.backShiny || evoData.back) : evoData.back;

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
                        battleMessage.innerText = `You received the ${opponentTrainer.badgeName}!`;
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
    if (mapName === 'town1') buildTown1();
    else if (mapName === 'route1') buildRoute1();
    else if (mapName === 'town2') buildTown2();
    else if (mapName === 'route2') buildRoute2();
    else if (mapName === 'town3') buildTown3();
    else if (mapName === 'gym') buildGymMap();
    else if (mapName === 'gym2') buildGym2();
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
        let moving = false;
        let futureX = me.x;
        let futureY = me.y;

        if (keys.w || keys.ArrowUp) { futureY -= SPEED * 10; me.facing = 'up'; moving = true; }
        else if (keys.s || keys.ArrowDown) { futureY += SPEED * 10; me.facing = 'down'; moving = true; }
        else if (keys.a || keys.ArrowLeft) { futureX -= SPEED * 10; me.facing = 'left'; moving = true; }
        else if (keys.d || keys.ArrowRight) { futureX += SPEED * 10; me.facing = 'right'; moving = true; }

        // Determine if there is a collision
        let collision = false;

        // Player hitbox bounding box relative to their x,y
        // Adjust these to make moving through narrow gaps easier
        const pHW = 16; // half width
        const pHH = 16; // half height
        const pRect = { x: futureX - pHW, y: futureY - pHH, w: pHW * 2, h: pHH * 2 };

        // Define a slightly smaller hitbox for strict collision checks (e.g. feet area)
        const pCollRect = { x: futureX - pHW + 6, y: futureY, w: pHW * 2 - 12, h: pHH };

        if (moving) {
            for (let i = 0; i < boundaries.length; i++) {
                const b = boundaries[i];
                // Check against the smaller feet collision box
                if (
                    pCollRect.x < b.x + b.width &&
                    pCollRect.x + pCollRect.w > b.x &&
                    pCollRect.y < b.y + b.height &&
                    pCollRect.y + pCollRect.h > b.y
                ) {
                    collision = true;
                    break;
                }
            }
        }

        if (!collision) {
            me.x = futureX;
            me.y = futureY;
        }

        // Boundary roughly matching our map size (optional fallback)
        // if (me.x < 0) me.x = 0;
        // if (me.y < 0) me.y = 0;

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

            // Encounter check using battleZones array
            for (let i = 0; i < battleZones.length; i++) {
                const bz = battleZones[i];
                if (
                    pRect.x < bz.x + bz.width &&
                    pRect.x + pRect.w > bz.x &&
                    pRect.y < bz.y + bz.height &&
                    pRect.y + pRect.h > bz.y
                ) {
                    // Moving in tall grass, trigger random battle chance
                    if (Math.random() < 0.02) {
                        startBattle();
                    }
                    break;
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
    // We want the camera to center on the player, but we won't bound it to map width/height just yet
    // since we use a single big background image for now.
    camX = me.x - 400;
    camY = me.y - 300;

    // Clear Canvas and Draw Map
    ctx.clearRect(0, 0, 800, 600);

    ctx.save();
    ctx.translate(-camX, -camY);

    drawMap();

    // Debug collision rendering (optional)
    /*
    ctx.fillStyle = 'rgba(255, 0, 0, 0.2)';
    boundaries.forEach(b => {
        ctx.fillRect(b.x, b.y, b.width, b.height);
    });
    ctx.fillStyle = 'rgba(0, 255, 0, 0.2)';
    battleZones.forEach(bz => {
        ctx.fillRect(bz.x, bz.y, bz.width, bz.height);
    });
    */

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
