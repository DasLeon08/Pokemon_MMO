const socket = io();

// UI Elements
const lobbyContainer = document.getElementById('lobby-container');
const gameContainer = document.getElementById('game-container');
const uiOverlay = document.getElementById('ui-overlay');
const createRoomBtn = document.getElementById('createRoomBtn');
const joinRoomBtn = document.getElementById('joinRoomBtn');
const roomInput = document.getElementById('roomInput');
const loginBtn = document.getElementById('loginBtn');
const usernameInput = document.getElementById('usernameInput');
const passwordInput = document.getElementById('passwordInput');
const loginForm = document.getElementById('loginForm');
const roomControls = document.getElementById('roomControls');
const welcomeName = document.getElementById('welcomeName');
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

    // Add Healing Center & PC
    mapObjects.push({ type: 'center', x: 10 * TILE_SIZE, y: 10 * TILE_SIZE });

    // Signs
    mapObjects.push({ type: 'sign', x: 7 * TILE_SIZE, y: 18 * TILE_SIZE, text: "Pallet Town: Shades of your journey await!" });
    mapObjects.push({ type: 'sign', x: 12 * TILE_SIZE, y: 8 * TILE_SIZE, text: "Professor Oak's Research Lab" });

    buildBorderTrees();

    // Remove top tree border where the portal to Route 1 is
    mapObjects = mapObjects.filter(o => !(o.type === 'tree' && o.y === -TILE_SIZE && (o.x === 11*TILE_SIZE || o.x === 12*TILE_SIZE)));

    // Portal North to Route 1
    createPortal(12 * TILE_SIZE + 16, 10, 'route1', 'To Route 1', 9 * TILE_SIZE + 24, 44 * TILE_SIZE - 20);
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

    createPortal(10 * TILE_SIZE + 16, MAP_ROWS * TILE_SIZE - 20, 'town1', 'To Pallet Town', 12 * TILE_SIZE, 50);
    createPortal(10 * TILE_SIZE + 16, 10, 'town2', 'To Viridian City', 15 * TILE_SIZE, 49 * TILE_SIZE - 20);
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

    // Add Shop (Pokemart) and Center centrally located
    mapObjects.push({ type: 'house', x: 16 * TILE_SIZE, y: 22 * TILE_SIZE, isShop: true });
    mapObjects.push({ type: 'center', x: 20 * TILE_SIZE, y: 22 * TILE_SIZE });

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

    createPortal(16 * TILE_SIZE + 16, MAP_ROWS * TILE_SIZE - 20, 'route1', 'To Route 1', 10 * TILE_SIZE, 50);
    createPortal(MAP_COLS * TILE_SIZE - 20, 26 * TILE_SIZE + 16, 'route2', 'To Route 2', 50, 30 * TILE_SIZE);

    // Dungeons and Gym entrances scattered around the city edges
    createPortal(50, 20 * TILE_SIZE + 16, 'water_dungeon', 'Seafoam Cave', 800, 800);
    createPortal(20 * TILE_SIZE + 16, 50, 'rock_dungeon', 'Mt. Moon Cave', 750, 750);
    createPortal(MAP_COLS * TILE_SIZE - 200, 10 * TILE_SIZE + 16, 'gym', 'Pewter Gym', 12 * TILE_SIZE, 48 * TILE_SIZE);
}

function buildRoute2() {
    clearMap();
    MAP_COLS = 120; // Massive horizontal route
    MAP_ROWS = 60;
    fillMapGrid(0);

    // Winding Path from left to right
    for (let c=0; c<15; c++) { mapGrid[30][c] = 1; mapGrid[31][c] = 1; }
    for (let r=30; r<40; r++) { mapGrid[r][14] = 1; mapGrid[r][15] = 1; }
    for (let c=14; c<35; c++) { mapGrid[39][c] = 1; mapGrid[40][c] = 1; }
    for (let r=20; r<40; r++) { mapGrid[r][34] = 1; mapGrid[r][35] = 1; }
    for (let c=34; c<60; c++) { mapGrid[20][c] = 1; mapGrid[21][c] = 1; }
    for (let r=20; r<50; r++) { mapGrid[r][59] = 1; mapGrid[r][60] = 1; }
    for (let c=59; c<90; c++) { mapGrid[49][c] = 1; mapGrid[50][c] = 1; }
    for (let r=25; r<50; r++) { mapGrid[r][89] = 1; mapGrid[r][90] = 1; }
    for (let c=89; c<MAP_COLS; c++) { mapGrid[25][c] = 1; mapGrid[26][c] = 1; }

    // Enormous patches of tall grass
    for(let r=20; r<28; r++) { for(let c=5; c<14; c++) { mapGrid[r][c] = 6; } }
    for(let r=34; r<39; r++) { for(let c=20; c<30; c++) { mapGrid[r][c] = 6; } }
    for(let r=25; r<35; r++) { for(let c=40; c<55; c++) { mapGrid[r][c] = 6; } }
    for(let r=30; r<45; r++) { for(let c=65; c<80; c++) { mapGrid[r][c] = 6; } }
    for(let r=10; r<20; r++) { for(let c=80; c<100; c++) { mapGrid[r][c] = 6; } }
    for(let r=30; r<40; r++) { for(let c=100; c<115; c++) { mapGrid[r][c] = 6; } }

    // Trainers
    mapObjects.push({
        type: 'trainer', id: 'route2_lass', name: 'Lass Mia',
        x: 20 * TILE_SIZE, y: 35 * TILE_SIZE,
        team: [generatePokemon(43, 6), generatePokemon(43, 7)] // Oddish
    });
    mapObjects.push({
        type: 'trainer', id: 'route2_hiker', name: 'Hiker Bob',
        x: 40 * TILE_SIZE, y: 15 * TILE_SIZE,
        team: [generatePokemon(74, 8), generatePokemon(66, 8)] // Geodude, Machop
    });
    mapObjects.push({
        type: 'trainer', id: 'route2_camper', name: 'Camper Dan',
        x: 75 * TILE_SIZE, y: 45 * TILE_SIZE,
        team: [generatePokemon(32, 10)] // Nidoran M
    });
    mapObjects.push({
        type: 'trainer', id: 'route2_bugcatcher2', name: 'Bug Catcher Rick',
        x: 105 * TILE_SIZE, y: 25 * TILE_SIZE,
        team: [generatePokemon(13, 9), generatePokemon(14, 10)] // Weedle, Kakuna
    });

    mapObjects.push({ type: 'sign', x: 25 * TILE_SIZE, y: 42 * TILE_SIZE, text: "Route 2 - The long road East to Cerulean City." });

    buildBorderTrees();

    // Open path West to Town 2
    mapObjects = mapObjects.filter(o => !(o.type === 'tree' && o.x === -TILE_SIZE/2 && o.y >= 29*TILE_SIZE && o.y <= 32*TILE_SIZE));
    // Open path East to Town 3
    mapObjects = mapObjects.filter(o => !(o.type === 'tree' && o.x === (MAP_COLS-1)*TILE_SIZE && o.y >= 24*TILE_SIZE && o.y <= 27*TILE_SIZE));

    createPortal(20, 30 * TILE_SIZE + 16, 'town2', 'To Viridian City', 48 * TILE_SIZE, 26 * TILE_SIZE);
    createPortal(MAP_COLS * TILE_SIZE - 20, 25 * TILE_SIZE, 'town3', 'To Cerulean City', 50, 13 * TILE_SIZE);
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

    // Huge Pokemart & Center
    mapObjects.push({ type: 'house', x: 45 * TILE_SIZE, y: 40 * TILE_SIZE, isShop: true });
    mapObjects.push({ type: 'center', x: 45 * TILE_SIZE, y: 33 * TILE_SIZE });

    // Signs
    mapObjects.push({ type: 'sign', x: 30 * TILE_SIZE, y: 12 * TILE_SIZE, text: "Cerulean City: A Floral City Surrounded by Water" });
    mapObjects.push({ type: 'sign', x: 48 * TILE_SIZE, y: 45 * TILE_SIZE, text: "Cerulean Dept. Store" });
    mapObjects.push({ type: 'sign', x: 12 * TILE_SIZE, y: 48 * TILE_SIZE, text: "Cerulean Gym - Leader: Misty" });

    // Gym Entrance (Looks like a normal house here, but goes to gym2)
    mapObjects.push({ type: 'house', x: 10 * TILE_SIZE, y: 45 * TILE_SIZE });
    createPortal(11 * TILE_SIZE, 48 * TILE_SIZE, 'gym2', 'Cerulean Gym', 12 * TILE_SIZE, 22 * TILE_SIZE);

    buildBorderTrees();

    // Open path West to Route 2
    for(let r=12; r<15; r++) mapGrid[r][0] = 1; // Connect path explicitly
    mapObjects = mapObjects.filter(o => !(o.type === 'tree' && o.x === -TILE_SIZE/2 && o.y >= 12*TILE_SIZE && o.y <= 14*TILE_SIZE));

    createPortal(20, 13 * TILE_SIZE + 16, 'route2', 'To Route 2', 118 * TILE_SIZE, 25 * TILE_SIZE);
}

function buildRoute3() {
    clearMap();
    MAP_COLS = 60;
    MAP_ROWS = 30; // Horizontal route
    fillMapGrid(0);

    // Winding Path from left to right
    for (let c=0; c<20; c++) { mapGrid[15][c] = 1; mapGrid[16][c] = 1; }
    for (let r=10; r<=15; r++) { mapGrid[r][19] = 1; mapGrid[r][20] = 1; }
    for (let c=19; c<40; c++) { mapGrid[10][c] = 1; mapGrid[11][c] = 1; }
    for (let r=10; r<=20; r++) { mapGrid[r][39] = 1; mapGrid[r][40] = 1; }
    for (let c=39; c<MAP_COLS; c++) { mapGrid[20][c] = 1; mapGrid[21][c] = 1; }

    // Tall grass patches
    for(let r=5; r<10; r++) { for(let c=5; c<15; c++) { mapGrid[r][c] = 6; } }
    for(let r=20; r<25; r++) { for(let c=25; c<35; c++) { mapGrid[r][c] = 6; } }
    for(let r=5; r<15; r++) { for(let c=45; c<55; c++) { mapGrid[r][c] = 6; } }

    // Trainers
    mapObjects.push({
        type: 'trainer', id: 'route3_lass', name: 'Lass Robin',
        x: 10 * TILE_SIZE, y: 12 * TILE_SIZE,
        team: [generatePokemon(43, 12), generatePokemon(44, 14)] // Oddish, Gloom
    });
    mapObjects.push({
        type: 'trainer', id: 'route3_youngster', name: 'Youngster Ben',
        x: 30 * TILE_SIZE, y: 15 * TILE_SIZE,
        team: [generatePokemon(19, 15)] // Rattata
    });

    mapObjects.push({ type: 'sign', x: 5 * TILE_SIZE, y: 13 * TILE_SIZE, text: "Route 3 - Heading towards Vermilion City" });

    buildBorderTrees();

    // Open path West to Town 3
    mapObjects = mapObjects.filter(o => !(o.type === 'tree' && o.x === -TILE_SIZE/2 && o.y >= 15*TILE_SIZE && o.y <= 16*TILE_SIZE));
    // Open path East to Town 4
    mapObjects = mapObjects.filter(o => !(o.type === 'tree' && o.x === (MAP_COLS-1)*TILE_SIZE && o.y >= 20*TILE_SIZE && o.y <= 21*TILE_SIZE));

    createPortal(20, 16 * TILE_SIZE + 16, 'town3', 'To Cerulean City', 58 * TILE_SIZE, 50 * TILE_SIZE);
    createPortal(MAP_COLS * TILE_SIZE - 20, 20 * TILE_SIZE + 16, 'town4', 'To Vermilion City', 50, 15 * TILE_SIZE);
}

function buildTown4() {
    clearMap();
    MAP_COLS = 50;
    MAP_ROWS = 50;
    fillMapGrid(0);

    // Ocean at the bottom
    for(let r=35; r<MAP_ROWS; r++) {
        for(let c=0; c<MAP_COLS; c++) {
            mapGrid[r][c] = 4; // Water
        }
    }

    // Docks (Bridges extending into water)
    for(let r=35; r<45; r++) {
        mapGrid[r][24] = 5; mapGrid[r][25] = 5;
    }

    // Main paths
    for(let c=0; c<MAP_COLS; c++) { mapGrid[15][c] = 1; mapGrid[16][c] = 1; }
    for(let r=15; r<35; r++) { mapGrid[r][24] = 1; mapGrid[r][25] = 1; }

    // Buildings
    mapObjects.push({ type: 'house', x: 10 * TILE_SIZE, y: 5 * TILE_SIZE });
    mapObjects.push({ type: 'house', x: 30 * TILE_SIZE, y: 5 * TILE_SIZE });
    mapObjects.push({ type: 'house', x: 10 * TILE_SIZE, y: 20 * TILE_SIZE });

    // Pokemart & Center
    mapObjects.push({ type: 'house', x: 35 * TILE_SIZE, y: 20 * TILE_SIZE, isShop: true });
    mapObjects.push({ type: 'center', x: 35 * TILE_SIZE, y: 10 * TILE_SIZE });

    // Electric Gym Entrance
    mapObjects.push({ type: 'house', x: 20 * TILE_SIZE, y: 25 * TILE_SIZE });
    createPortal(21 * TILE_SIZE, 28 * TILE_SIZE, 'gym3', 'Vermilion Gym', 12 * TILE_SIZE, 22 * TILE_SIZE);

    // Signs
    mapObjects.push({ type: 'sign', x: 25 * TILE_SIZE, y: 12 * TILE_SIZE, text: "Vermilion City: The Port of Exquisite Sunsets" });
    mapObjects.push({ type: 'sign', x: 25 * TILE_SIZE, y: 28 * TILE_SIZE, text: "Vermilion Gym - Leader: Lt. Surge" });

    buildBorderTrees();

    // Open path West to Route 3
    mapObjects = mapObjects.filter(o => !(o.type === 'tree' && o.x === -TILE_SIZE/2 && o.y >= 15*TILE_SIZE && o.y <= 16*TILE_SIZE));

    createPortal(20, 16 * TILE_SIZE + 16, 'route3', 'To Route 3', 58 * TILE_SIZE, 21 * TILE_SIZE);
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

    createPortal(400, 500, 'town2', 'Exit', 38 * TILE_SIZE, 10 * TILE_SIZE);
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

    createPortal(400, 750, 'town3', 'Exit', 11 * TILE_SIZE, 49 * TILE_SIZE);
}

function buildGym3() {
    clearMap();
    MAP_COLS = 25;
    MAP_ROWS = 25;
    // Fill with stone floor
    for(let r=0; r<MAP_ROWS; r++) {
        let row = [];
        for(let c=0; c<MAP_COLS; c++) {
            row.push(2);
        }
        mapGrid.push(row);
    }

    // Path
    for(let r=3; r<MAP_ROWS; r++) {
        mapGrid[r][11] = 1;
        mapGrid[r][12] = 1;
        mapGrid[r][13] = 1;
    }

    // Add Walls (Border)
    for(let c=0; c<MAP_COLS; c++) { mapGrid[0][c] = 3; mapGrid[MAP_ROWS - 1][c] = 3; }
    for(let r=0; r<MAP_ROWS; r++) { mapGrid[r][0] = 3; mapGrid[r][MAP_COLS - 1] = 3; }

    // Trash cans (simulate with small walls)
    mapGrid[10][8] = 3; mapGrid[10][16] = 3;
    mapGrid[15][8] = 3; mapGrid[15][16] = 3;

    // Add Gym Trainers
    mapObjects.push({
        type: 'trainer', id: 'gym_trainer_electric1', name: 'Sailor Dwayne',
        x: 9 * TILE_SIZE, y: 15 * TILE_SIZE,
        team: [generatePokemon(81, 21), generatePokemon(100, 21)] // Magnemite, Voltorb
    });

    mapObjects.push({
        type: 'trainer', id: 'gym_boss_surge', name: 'Gym Leader Lt. Surge',
        x: 12 * TILE_SIZE, y: 3 * TILE_SIZE,
        badge: true, badgeName: 'THUNDER BADGE',
        team: [generatePokemon(26, 24)] // Raichu
    });

    createPortal(400, 750, 'town4', 'Exit', 21 * TILE_SIZE, 29 * TILE_SIZE);
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

    createPortal(400, 800, 'town2', 'Exit to City', 20 * TILE_SIZE, 48 * TILE_SIZE);
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

    createPortal(450, 850, 'town2', 'Exit to City', 48, 20 * TILE_SIZE);
}

function createPortal(x, y, targetMap, label, targetX = null, targetY = null) {
    portals.push({ x, y, radius: 20, targetMap, label, targetX, targetY });
}

// --- Map offset for centering ---
const offset = { x: 0, y: 0 };
let boundaries = [];
let battleZones = [];

function generateCollisionsFromGrid() {
    boundaries = [];
    battleZones = [];
    for (let r = 0; r < MAP_ROWS; r++) {
        for (let c = 0; c < MAP_COLS; c++) {
            const tile = mapGrid[r][c];
            const x = c * TILE_SIZE;
            const y = r * TILE_SIZE;

            // Walls, Water, and Map Edges are solid
            if (tile === 3 || tile === 4) {
                // Not if it's a bridge over water
                boundaries.push({ x, y, width: TILE_SIZE, height: TILE_SIZE });
            }
            if (tile === 6) { // Tall Grass
                battleZones.push({ x, y, width: TILE_SIZE, height: TILE_SIZE });
            }
        }
    }

    // Static objects are also boundaries
    for (const obj of mapObjects) {
        if (obj.type === 'tree') {
            boundaries.push({ x: obj.x, y: obj.y, width: TILE_SIZE, height: TILE_SIZE });
        } else if (obj.type === 'house' || obj.type === 'center') {
            boundaries.push({ x: obj.x, y: obj.y, width: TILE_SIZE * 2, height: TILE_SIZE * 2 });
        } else if (obj.type === 'sign' || obj.type === 'trainer') {
            boundaries.push({ x: obj.x, y: obj.y, width: TILE_SIZE, height: TILE_SIZE });
        }
    }
}

// Map Tile Colors
const tileColors = {
    0: '#78C850', // Grass
    1: '#F8D030', // Path/Sand
    2: '#A0A0A0', // Stone Floor
    3: '#705848', // Wall/Rock
    4: '#6890F0', // Water
    5: '#C0A080', // Bridge
    6: '#489030', // Tall Grass
};

function drawMap() {
    // Fill background with a base color
    ctx.fillStyle = '#78C850';
    ctx.fillRect(camX, camY, canvas.width, canvas.height);

    // Draw Map Grid natively to support massive maps seamlessly without a background image
    const startC = Math.max(0, Math.floor(camX / TILE_SIZE) - 1);
    const endC = Math.min(MAP_COLS, Math.floor((camX + canvas.width) / TILE_SIZE) + 2);
    const startR = Math.max(0, Math.floor(camY / TILE_SIZE) - 1);
    const endR = Math.min(MAP_ROWS, Math.floor((camY + canvas.height) / TILE_SIZE) + 2);

    for (let r = startR; r < endR; r++) {
        for (let c = startC; c < endC; c++) {
            const tile = mapGrid[r][c];
            const x = c * TILE_SIZE;
            const y = r * TILE_SIZE;

            if (tile !== 0) { // Don't redraw base grass
                ctx.fillStyle = tileColors[tile] || tileColors[0];
                ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);

                if (tile === 6) {
                    // Draw little grass specks for tall grass
                    ctx.fillStyle = '#204010';
                    ctx.fillRect(x + 10, y + 10, 4, 12);
                    ctx.fillRect(x + 30, y + 20, 4, 12);
                    ctx.fillRect(x + 20, y + 30, 4, 12);
                } else if (tile === 4) {
                    // Water ripples
                    ctx.fillStyle = '#98D8D8';
                    ctx.fillRect(x + (Math.sin(Date.now() / 500 + x) * 5) + 10, y + 20, 20, 4);
                }
            }
        }
    }

    // Draw Map Objects (Trainers, Trees, Houses)
    for (const obj of mapObjects) {
        // Culling
        if (obj.x < camX - 100 || obj.x > camX + canvas.width + 100 || obj.y < camY - 100 || obj.y > camY + canvas.height + 100) continue;

        // Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.beginPath();
        let shadowWidth = TILE_SIZE/2;
        if (obj.type === 'house' || obj.type === 'center') shadowWidth = TILE_SIZE;
        ctx.ellipse(obj.x + ((obj.type==='house'||obj.type==='center')?TILE_SIZE:TILE_SIZE/2), obj.y + ((obj.type==='house'||obj.type==='center')?TILE_SIZE*2-10:TILE_SIZE - 5), shadowWidth, shadowWidth/2, 0, 0, Math.PI * 2);
        ctx.fill();

        if (obj.type === 'trainer') {
            if (!defeatedTrainers[obj.id]) {
                drawPlayerSprite(ctx, obj.x, obj.y, 'red', 'down', 0);
            }
        } else if (obj.type === 'tree') {
            ctx.fillStyle = '#206020';
            ctx.beginPath();
            ctx.arc(obj.x + TILE_SIZE/2, obj.y + TILE_SIZE/2 - 10, TILE_SIZE/2 + 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#705848';
            ctx.fillRect(obj.x + TILE_SIZE/2 - 5, obj.y + TILE_SIZE/2, 10, TILE_SIZE/2);
        } else if (obj.type === 'house' || obj.type === 'center') {
            ctx.fillStyle = obj.type === 'center' ? '#ffffff' : '#F8D030';
            ctx.fillRect(obj.x, obj.y + TILE_SIZE, TILE_SIZE * 2, TILE_SIZE);
            ctx.fillStyle = obj.isShop ? '#6890F0' : (obj.type === 'center' ? '#ff3333' : '#F08030');
            ctx.beginPath();
            ctx.moveTo(obj.x, obj.y + TILE_SIZE);
            ctx.lineTo(obj.x + TILE_SIZE, obj.y);
            ctx.lineTo(obj.x + TILE_SIZE * 2, obj.y + TILE_SIZE);
            ctx.fill();
            // Door
            ctx.fillStyle = '#705848';
            ctx.fillRect(obj.x + TILE_SIZE/2 + 10, obj.y + TILE_SIZE * 1.3, 20, 30);
            if (obj.isShop) {
                ctx.fillStyle = 'white';
                ctx.font = '10px Arial';
                ctx.fillText('MART', obj.x + TILE_SIZE, obj.y + TILE_SIZE - 10);
            } else if (obj.type === 'center') {
                ctx.fillStyle = 'white';
                ctx.font = '10px Arial';
                ctx.fillText('HEAL/PC', obj.x + TILE_SIZE - 8, obj.y + TILE_SIZE - 10);
            }
        } else if (obj.type === 'sign') {
            ctx.fillStyle = '#C0A080';
            ctx.fillRect(obj.x + 10, obj.y + 10, 28, 20);
            ctx.fillStyle = '#705848';
            ctx.fillRect(obj.x + 22, obj.y + 30, 4, 15);
        }
    }
}

// Draw Player from Sprite Sheet
function drawPlayerSprite(ctx, x, y, color, facing = 'down', walkFrame = 0, isLocalPlayer = false) {
    // Draw shadow underneath player
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.beginPath();
    ctx.ellipse(x, y + 20, 16, 8, 0, 0, Math.PI * 2);
    ctx.fill();

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
let myUsername = null;
let currentRoomId = null;
let currentMap = null;
let inBattle = false;
let myTeam = [];
let myBox = [];
let wildPokemon = null;
let wildPokemon2 = null; // For 2v2
let activePokemon = null;
let activePokemon2 = null; // For 2v2
let isDoubleBattle = false;
let turnActionLocked = false;
let defeatedTrainers = {};
let myBadges = 0;
let myMoney = 300;
let myInventory = { potion: 3, superPotion: 0, pokeball: 5, greatball: 0, ultraball: 0, masterball: 0 };
let inShop = false;

// Trainer Battle State
let opponentIsTrainer = false;
let opponentTeam = [];
let opponentIndex = 0;
let opponentTrainer = null;

const SPEED = 0.2;

// --- Audio System (Web Audio API Synthesizer) ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playTone(freq, type, duration, vol = 0.1) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);

    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + duration);
}

const sfx = {
    attack: () => {
        playTone(300, 'square', 0.1, 0.1);
        setTimeout(() => playTone(150, 'square', 0.1, 0.1), 100);
    },
    hit: () => {
        playTone(100, 'sawtooth', 0.2, 0.2);
    },
    heal: () => {
        playTone(400, 'sine', 0.1, 0.1);
        setTimeout(() => playTone(600, 'sine', 0.1, 0.1), 100);
        setTimeout(() => playTone(800, 'sine', 0.2, 0.1), 200);
    },
    catchSuccess: () => {
        playTone(500, 'square', 0.2, 0.1);
        setTimeout(() => playTone(700, 'square', 0.2, 0.1), 200);
        setTimeout(() => playTone(900, 'square', 0.4, 0.1), 400);
    },
    levelUp: () => {
        playTone(440, 'triangle', 0.1, 0.1);
        setTimeout(() => playTone(440, 'triangle', 0.1, 0.1), 150);
        setTimeout(() => playTone(587, 'triangle', 0.3, 0.1), 300);
    },
    faint: () => {
        playTone(200, 'sawtooth', 0.3, 0.2);
        setTimeout(() => playTone(100, 'sawtooth', 0.4, 0.2), 200);
    }
};

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

    // Ensure player has a starter FIRST before calculating opponent levels
    if (myTeam.length === 0) {
        // Starters across gens 1-5
        const starters = [1, 4, 7, 152, 155, 158, 252, 255, 258, 387, 390, 393, 495, 498, 501];
        const starterId = starters[Math.floor(Math.random() * starters.length)];
        myTeam.push(generatePokemon(starterId, 5));
    }
    activePokemon = myTeam[0];

    // Find average level of the player's team for dynamic scaling
    const teamAvgLevel = Math.max(5, Math.floor(myTeam.reduce((sum, p) => sum + p.level, 0) / myTeam.length));

    if (opponentIsTrainer) {
        // Load trainer's team
        // Deep copy so we don't modify the map object template
        opponentTeam = JSON.parse(JSON.stringify(trainer.team));

        // Dynamically scale the trainer's team to be fair (around player's average level)
        opponentTeam.forEach((p, idx) => {
            // Bosses/Gym leaders might be slightly higher level
            const levelBonus = trainer.badge ? 2 : 0;
            const newLevel = Math.max(1, teamAvgLevel + levelBonus + (Math.random() > 0.5 ? 1 : -1));
            // Regenerate the pokemon with the scaled level
            opponentTeam[idx] = generatePokemon(p.speciesId, newLevel, p.isShiny);
        });

        wildPokemon = opponentTeam[0]; // 'wildPokemon' is actually the opponent pokemon
        document.getElementById('btn-catch').style.display = 'none'; // Can't catch trainer pokemon
    } else {
        // Only generate new if not already set by external test scripts
        if (!wildPokemon || wildPokemon.hp <= 0) {
            // Generate Wild Pokemon (dynamically scaled)
            const wildId = Math.floor(Math.random() * 949) + 1;
            const wildLvl = Math.max(2, teamAvgLevel + Math.floor(Math.random() * 5) - 2);
            wildPokemon = generatePokemon(wildId, wildLvl, Math.random() < 0.05);

            // 20% chance for a wild double battle if player has >= 2 alive pokemon
            const consciousCount = myTeam.filter(p => p.hp > 0).length;
            if (consciousCount >= 2 && Math.random() < 0.2) {
                isDoubleBattle = true;
                const wildId2 = Math.floor(Math.random() * 949) + 1;
                const wildLvl2 = Math.max(2, teamAvgLevel + Math.floor(Math.random() * 5) - 2);
                wildPokemon2 = generatePokemon(wildId2, wildLvl2, Math.random() < 0.05);
                activePokemon2 = myTeam.filter(p => p.hp > 0)[1];
            } else {
                isDoubleBattle = false;
                wildPokemon2 = null;
                activePokemon2 = null;
            }
        }
        document.getElementById('btn-catch').style.display = 'inline-block';
    }

    updateBattleUI();
    battleContainer.style.display = 'flex';

    if (opponentIsTrainer) {
        battleMessage.innerText = `Trainer ${trainer.name} wants to battle! They sent out ${wildPokemon.name}!`;
    } else {
        battleMessage.innerText = `A wild ${wildPokemon.name} appeared!`;
    }

    // Reset animations to replay them
    document.getElementById('wild-health').style.animation = 'none';
    document.getElementById('player-health').style.animation = 'none';
    document.getElementById('wild-sprite').style.animation = 'none';
    document.getElementById('player-sprite').style.animation = 'none';

    // trigger reflow
    void battleContainer.offsetWidth;

    document.getElementById('wild-health').style.animation = '';
    document.getElementById('player-health').style.animation = '';
    document.getElementById('wild-sprite').style.animation = '';
    document.getElementById('player-sprite').style.animation = '';
}

function updateBattleUI() {
    // Setup visibility for 2v2 elements
    document.getElementById('wild-sprite-2').style.display = isDoubleBattle ? 'block' : 'none';
    document.getElementById('wild-health-2').style.display = isDoubleBattle ? 'block' : 'none';
    document.getElementById('player-sprite-2').style.display = isDoubleBattle ? 'block' : 'none';
    document.getElementById('player-health-2').style.display = isDoubleBattle ? 'block' : 'none';

    wildSprite.src = wildPokemon.frontSprite;
    playerSprite.src = activePokemon.backSprite;
    wildName.innerText = wildPokemon.name;
    wildLvl.innerText = `Lv.${wildPokemon.level}`;
    playerName.innerText = activePokemon.name;
    playerLvl.innerText = `Lv.${activePokemon.level}`;
    wildHpFill.style.width = `${Math.max(0, (wildPokemon.hp / wildPokemon.maxHp) * 100)}%`;
    playerHpFill.style.width = `${Math.max(0, (activePokemon.hp / activePokemon.maxHp) * 100)}%`;
    playerHpText.innerText = `${Math.max(0, activePokemon.hp)} / ${activePokemon.maxHp}`;

    if (isDoubleBattle && wildPokemon2 && activePokemon2) {
        document.getElementById('wild-sprite-2').src = wildPokemon2.frontSprite;
        document.getElementById('player-sprite-2').src = activePokemon2.backSprite;
        document.getElementById('wild-name-2').innerText = wildPokemon2.name;
        document.getElementById('wild-lvl-2').innerText = `Lv.${wildPokemon2.level}`;
        document.getElementById('player-name-2').innerText = activePokemon2.name;
        document.getElementById('player-lvl-2').innerText = `Lv.${activePokemon2.level}`;
        document.getElementById('wild-hp-fill-2').style.width = `${Math.max(0, (wildPokemon2.hp / wildPokemon2.maxHp) * 100)}%`;
        document.getElementById('player-hp-fill-2').style.width = `${Math.max(0, (activePokemon2.hp / activePokemon2.maxHp) * 100)}%`;
        document.getElementById('player-hp-text-2').innerText = `${Math.max(0, activePokemon2.hp)} / ${activePokemon2.maxHp}`;

        document.getElementById('wild-hp-fill-2').style.backgroundColor = wildPokemon2.hp / wildPokemon2.maxHp < 0.2 ? 'red' : (wildPokemon2.hp / wildPokemon2.maxHp < 0.5 ? 'orange' : '#00ff00');
        document.getElementById('player-hp-fill-2').style.backgroundColor = activePokemon2.hp / activePokemon2.maxHp < 0.2 ? 'red' : (activePokemon2.hp / activePokemon2.maxHp < 0.5 ? 'orange' : '#00ff00');
    }

    btnPotionCount.innerText = myInventory.potion;
    btnSuperPotionCount.innerText = myInventory.superPotion;

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

    if (action.startsWith('catch_')) {
        const ballType = action.split('_')[1];

        if (myInventory[ballType] > 0) {
            myInventory[ballType] -= 1;
            updateMyUI();
            updateBattleUI();

            let ballMult = 1;
            if (ballType === 'greatball') ballMult = 1.5;
            if (ballType === 'ultraball') ballMult = 2;

            const catchRate = (1 - (wildPokemon.hp / wildPokemon.maxHp)) * ballMult;
            const success = (ballType === 'masterball') || (Math.random() < catchRate + 0.1);

            if (success) {
                sfx.catchSuccess();
                battleMessage.innerText = `Gotcha! ${wildPokemon.name} was caught!`;

                if (myTeam.length < 6) {
                    myTeam.push(wildPokemon);
                    setTimeout(() => {
                        battleMessage.innerText = `${wildPokemon.name} was added to your party!`;
                        endBattle();
                    }, 1500);
                } else {
                    myBox.push(wildPokemon);
                    setTimeout(() => {
                        battleMessage.innerText = `${wildPokemon.name} was sent to your PC Box!`;
                        endBattle();
                    }, 1500);
                }
            } else {
                battleMessage.innerText = `Oh no! ${wildPokemon.name} broke free!`;
                setTimeout(wildAttack, 1000);
            }
        } else {
            battleMessage.innerText = `You don't have any ${ballType}s left!`;
            setTimeout(() => { turnActionLocked = false; }, 1500);
        }
        return;
    }

    if (action === 'potion') {
        if (myInventory.potion > 0) {
            myInventory.potion -= 1;
            sfx.heal();
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
            sfx.heal();
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

        // Select target
        let targetWild = wildPokemon;
        let targetImg = document.getElementById('wild-sprite');
        if (isDoubleBattle && wildPokemon2 && wildPokemon2.hp > 0) {
            if (wildPokemon.hp <= 0 || Math.random() > 0.5) {
                targetWild = wildPokemon2;
                targetImg = document.getElementById('wild-sprite-2');
            }
        }

        let aAtk = moveData.category === 'special' ? activePokemon.spatk : activePokemon.atk;
        let dDef = moveData.category === 'special' ? targetWild.spdef : targetWild.def;

        const damage = Math.max(1, Math.floor((((2 * activePokemon.level / 5 + 2) * moveData.power * (aAtk / dDef)) / 50 + 2) * multiplier));

        targetWild.hp -= damage;
        let effMsg = multiplier > 1 ? " It's super effective!" : (multiplier < 1 ? " It's not very effective..." : "");
        battleMessage.innerText = `${activePokemon.name} used ${activePokemon.move} on ${targetWild.name}!${effMsg}`;

        sfx.attack();
        setTimeout(sfx.hit, 200);

        // Attack Animation Flash
        targetImg.style.transition = 'filter 0.1s';
        targetImg.style.filter = 'brightness(0) invert(1)';
        setTimeout(() => { targetImg.style.filter = 'none'; }, 100);
        setTimeout(() => { targetImg.style.filter = 'brightness(0) invert(1)'; }, 200);
        setTimeout(() => { targetImg.style.filter = 'none'; }, 300);

        updateBattleUI();

        if (targetWild.hp <= 0) {
            targetWild.hp = 0;
            sfx.faint();
            const prefix = opponentIsTrainer ? "Opponent's" : "Wild";
            battleMessage.innerText = `${prefix} ${targetWild.name} fainted!`;

            // Check if ALL wild are dead
            if (wildPokemon.hp <= 0 && (!isDoubleBattle || wildPokemon2.hp <= 0)) {
                setTimeout(awardExp, 1000);
                return;
            }
        }

        setTimeout(wildAttack, 1500);
    }
}

function wildAttack() {
    if (!inBattle) return;

    // Who is attacking?
    let attacker = wildPokemon;
    if (wildPokemon.hp <= 0) {
        if (isDoubleBattle && wildPokemon2 && wildPokemon2.hp > 0) attacker = wildPokemon2;
        else return; // All dead
    } else if (isDoubleBattle && wildPokemon2 && wildPokemon2.hp > 0 && Math.random() > 0.5) {
        attacker = wildPokemon2;
    }

    // Who is defending?
    let defender = activePokemon;
    let defImg = document.getElementById('player-sprite');
    if (isDoubleBattle && activePokemon2 && activePokemon2.hp > 0) {
        if (activePokemon.hp <= 0 || Math.random() > 0.5) {
            defender = activePokemon2;
            defImg = document.getElementById('player-sprite-2');
        }
    }
    if (defender.hp <= 0) return; // Wait for switch

    const moveData = MOVES[attacker.move] || MOVES['Tackle'];
    const defDex = POKEDEX[defender.speciesId];
    const multiplier = getMultiplier(moveData.type, defDex.type1, defDex.type2);

    let aAtk = moveData.category === 'special' ? attacker.spatk : attacker.atk;
    let dDef = moveData.category === 'special' ? defender.spdef : defender.def;

    const damage = Math.max(1, Math.floor((((2 * attacker.level / 5 + 2) * moveData.power * (aAtk / dDef)) / 50 + 2) * multiplier));

    defender.hp -= damage;
    let effMsg = multiplier > 1 ? " It's super effective!" : (multiplier < 1 ? " It's not very effective..." : "");
    battleMessage.innerText = `${opponentIsTrainer ? "Opponent's" : "Wild"} ${attacker.name} used ${attacker.move} on ${defender.name}!${effMsg}`;

    sfx.attack();
    setTimeout(sfx.hit, 200);

    // Attack Animation Shake & Flash
    defImg.style.transition = 'transform 0.05s';
    defImg.style.transform = 'translateX(-10px)';
    setTimeout(() => { defImg.style.transform = 'translateX(10px)'; }, 50);
    setTimeout(() => { defImg.style.transform = 'translateX(-10px)'; }, 100);
    setTimeout(() => { defImg.style.transform = 'translateX(0)'; }, 150);

    updateBattleUI();

    if (defender.hp <= 0) {
        defender.hp = 0;
        sfx.faint();

        // Check if player has any conscious pokemon left
        const hasAlive = myTeam.some(p => p.hp > 0);

        if (!hasAlive) {
            battleMessage.innerText = `${defender.name} fainted! You have no more usable Pokemon! You blacked out!`;
            // Heal entire team
            myTeam.forEach(p => p.hp = p.maxHp);
            // Send player back to start
            currentMap = 'town1';
            players[myId].x = 5 * TILE_SIZE; // Player house in Town 1
            players[myId].y = 15 * TILE_SIZE + TILE_SIZE;
            loadMap(currentMap);
            socket.emit('changeMap', { map: currentMap, x: players[myId].x, y: players[myId].y });
            endBattle();
        } else {
            battleMessage.innerText = `${defender.name} fainted!`;
            setTimeout(() => {
                showPokemonSwitch(true); // Force switch
            }, 1500);
        }
    } else {
        // If it's a double battle, let the other wild pokemon attack if they haven't yet, otherwise unlock turn
        // For simplicity, we just unlock after 1 attack for now to prevent stunlocks
        turnActionLocked = false;
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
            sfx.levelUp();
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
document.getElementById('btn-buy-greatball').addEventListener('click', () => {
    if (myMoney >= 300) {
        myMoney -= 300;
        myInventory.greatball += 1;
        updateMyUI();
        alert('Bought a Greatball!');
    } else {
        alert('Not enough money!');
    }
});
document.getElementById('btn-buy-ultraball').addEventListener('click', () => {
    if (myMoney >= 600) {
        myMoney -= 600;
        myInventory.ultraball += 1;
        updateMyUI();
        alert('Bought an Ultraball!');
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
const bagSwitchContainer = document.getElementById('bag-switch-container');
const bagList = document.getElementById('bag-list');

document.getElementById('btn-catch').addEventListener('click', () => {
    if (!inBattle || turnActionLocked) return;

    bagList.innerHTML = '';
    const balls = [
        { id: 'pokeball', name: 'Pokeball', count: myInventory.pokeball },
        { id: 'greatball', name: 'Greatball', count: myInventory.greatball },
        { id: 'ultraball', name: 'Ultraball', count: myInventory.ultraball },
        { id: 'masterball', name: 'Masterball', count: myInventory.masterball }
    ];

    balls.forEach(ball => {
        const btn = document.createElement('button');
        btn.style.display = 'block';
        btn.style.width = '200px';
        btn.style.margin = '5px 0';
        btn.style.padding = '10px';
        btn.style.textAlign = 'left';
        btn.innerText = `${ball.name} (x${ball.count})`;

        if (ball.count === 0) {
            btn.disabled = true;
            btn.style.backgroundColor = '#ccc';
        }

        btn.addEventListener('click', () => {
            bagSwitchContainer.style.display = 'none';
            processTurn('catch_' + ball.id);
        });

        bagList.appendChild(btn);
    });

    bagSwitchContainer.style.display = 'block';
});

document.getElementById('btn-cancel-bag').addEventListener('click', () => {
    bagSwitchContainer.style.display = 'none';
});
document.getElementById('btn-run').addEventListener('click', () => processTurn('run'));

// Pokemon Switching UI
const pokemonSwitchContainer = document.getElementById('pokemon-switch-container');
const pokemonList = document.getElementById('pokemon-list');
let isForcedSwitch = false;

document.getElementById('btn-pokemon').addEventListener('click', () => {
    if (!inBattle || turnActionLocked) return;
    showPokemonSwitch(false);
});

document.getElementById('btn-cancel-switch').addEventListener('click', () => {
    if (isForcedSwitch) {
        alert("You must choose a Pokemon to continue fighting!");
        return;
    }
    pokemonSwitchContainer.style.display = 'none';
});

function showPokemonSwitch(forced) {
    isForcedSwitch = forced;
    pokemonList.innerHTML = '';

    myTeam.forEach((poke, index) => {
        const btn = document.createElement('button');
        btn.style.display = 'block';
        btn.style.width = '200px';
        btn.style.margin = '5px 0';
        btn.style.padding = '10px';
        btn.style.textAlign = 'left';

        let label = `${poke.name} (Lv.${poke.level}) - HP: ${poke.hp}/${poke.maxHp}`;
        if (poke.hp <= 0) {
            label += " (FNT)";
            btn.disabled = true;
            btn.style.backgroundColor = '#ffcccc';
        } else if (poke === activePokemon && !forced) {
            label += " (ACTIVE)";
            btn.disabled = true;
            btn.style.backgroundColor = '#ccffcc';
        }

        btn.innerText = label;

        btn.addEventListener('click', () => {
            switchPokemon(index);
        });

        pokemonList.appendChild(btn);
    });

    document.getElementById('btn-cancel-switch').style.display = forced ? 'none' : 'inline-block';
    pokemonSwitchContainer.style.display = 'block';
}

function switchPokemon(index) {
    if (myTeam[index].hp <= 0 || myTeam[index] === activePokemon) return;

    activePokemon = myTeam[index];
    pokemonSwitchContainer.style.display = 'none';
    updateBattleUI();

    turnActionLocked = true;
    battleMessage.innerText = `Go! ${activePokemon.name}!`;

    // Play enter animation
    const playerImg = document.getElementById('player-sprite');
    playerImg.style.animation = 'none';
    void playerImg.offsetWidth;
    playerImg.style.animation = 'slideInBottom 0.5s ease-out';

    if (isForcedSwitch) {
        // Player was forced to switch because their active fainted
        isForcedSwitch = false;
        turnActionLocked = false;
    } else {
        // Player chose to switch instead of attacking, opponent gets to attack
        setTimeout(wildAttack, 1500);
    }
}

// Input
const keys = { w: false, a: false, s: false, d: false, ArrowUp: false, ArrowLeft: false, ArrowDown: false, ArrowRight: false };

window.addEventListener('keydown', (e) => { if (keys.hasOwnProperty(e.key)) keys[e.key] = true; });
window.addEventListener('keyup', (e) => { if (keys.hasOwnProperty(e.key)) keys[e.key] = false; });

// --- PC Box System ---
let inPC = false;
const pcContainer = document.getElementById('pc-container');
const pcPartyList = document.getElementById('pc-party-list');
const pcBoxList = document.getElementById('pc-box-list');
const pcMessage = document.getElementById('pc-message');
let selectedForPC = null; // {source: 'party'|'box', index: number}

document.getElementById('btn-close-pc').addEventListener('click', () => {
    inPC = false;
    pcContainer.style.display = 'none';
    players[myId].y += 15; // push away slightly
});

function renderPC() {
    pcPartyList.innerHTML = '';
    pcBoxList.innerHTML = '';

    myTeam.forEach((p, idx) => {
        const div = document.createElement('div');
        div.style.padding = '5px';
        div.style.margin = '5px 0';
        div.style.border = '1px solid white';
        div.style.cursor = 'pointer';
        div.style.background = (selectedForPC && selectedForPC.source === 'party' && selectedForPC.index === idx) ? '#555' : 'transparent';
        div.innerText = `${p.name} (Lv.${p.level})`;
        div.onclick = () => handlePCClick('party', idx);
        pcPartyList.appendChild(div);
    });

    myBox.forEach((p, idx) => {
        const div = document.createElement('div');
        div.style.padding = '5px';
        div.style.margin = '5px 0';
        div.style.border = '1px solid white';
        div.style.cursor = 'pointer';
        div.style.background = (selectedForPC && selectedForPC.source === 'box' && selectedForPC.index === idx) ? '#555' : 'transparent';
        div.innerText = `${p.name} (Lv.${p.level})`;
        div.onclick = () => handlePCClick('box', idx);
        pcBoxList.appendChild(div);
    });
}

function handlePCClick(source, idx) {
    if (!selectedForPC) {
        selectedForPC = { source, index: idx };
        pcMessage.innerText = "Select a slot to swap with or move to.";
        renderPC();
        return;
    }

    // Moving from party to box
    if (selectedForPC.source === 'party' && source === 'box') {
        if (myTeam.length <= 1) {
            pcMessage.innerText = "You must have at least one Pokemon in your party!";
        } else {
            const pkmn = myTeam.splice(selectedForPC.index, 1)[0];
            myBox.push(pkmn);
            pcMessage.innerText = `Moved ${pkmn.name} to PC.`;
        }
    }
    // Moving from box to party
    else if (selectedForPC.source === 'box' && source === 'party') {
        if (myTeam.length >= 6) {
            // Swap
            const fromBox = myBox.splice(selectedForPC.index, 1)[0];
            const fromParty = myTeam.splice(idx, 1, fromBox)[0];
            myBox.push(fromParty);
            pcMessage.innerText = `Swapped ${fromParty.name} for ${fromBox.name}.`;
        } else {
            // Just move
            const pkmn = myBox.splice(selectedForPC.index, 1)[0];
            myTeam.push(pkmn);
            pcMessage.innerText = `Moved ${pkmn.name} to Party.`;
        }
    }
    // Swap within same list (optional polish)
    else if (selectedForPC.source === source) {
        const list = source === 'party' ? myTeam : myBox;
        const temp = list[selectedForPC.index];
        list[selectedForPC.index] = list[idx];
        list[idx] = temp;
        pcMessage.innerText = "Order swapped.";
    }

    selectedForPC = null;
    renderPC();
}

function saveGameState() {
    if (!myId || !players[myId]) return;
    const p = players[myId];
    socket.emit('saveGameState', {
        x: p.x,
        y: p.y,
        color: p.color,
        level: p.level,
        exp: p.exp,
        map: p.map || currentMap,
        myMoney: myMoney,
        myBadges: myBadges,
        myInventory: myInventory,
        myTeam: myTeam,
        myBox: myBox,
        defeatedTrainers: defeatedTrainers
    });
}

// Periodically save
setInterval(saveGameState, 5000);

// --- Lobby Logic ---
loginBtn.addEventListener('click', () => {
    const username = usernameInput.value.trim();
    const password = passwordInput.value;
    if (username && password) {
        myUsername = username;
        socket.emit('login', { username, password });
    } else {
        lobbyMessage.innerText = 'Please enter username and password';
    }
});

socket.on('loginSuccess', (playerData) => {
    // Load data from server
    myMoney = playerData.myMoney || 300;
    myBadges = playerData.myBadges || 0;
    myInventory = playerData.myInventory || { potion: 3, superPotion: 0, pokeball: 5, greatball: 0, ultraball: 0, masterball: 0 };
    myTeam = playerData.myTeam || [];
    myBox = playerData.myBox || [];
    defeatedTrainers = playerData.defeatedTrainers || {};

    loginForm.style.display = 'none';
    roomControls.style.display = 'block';
    welcomeName.innerText = myUsername;
    lobbyMessage.innerText = 'Login successful!';
});

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
    else if (mapName === 'route3') buildRoute3();
    else if (mapName === 'town4') buildTown4();
    else if (mapName === 'gym') buildGymMap();
    else if (mapName === 'gym2') buildGym2();
    else if (mapName === 'gym3') buildGym3();
    else if (mapName === 'rock_dungeon') buildRockDungeon();
    else if (mapName === 'water_dungeon') buildWaterDungeon();
    else buildTown1(); // default

    generateCollisionsFromGrid();
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
        document.getElementById('greatballDisplay').innerText = myInventory.greatball;
        document.getElementById('ultraballDisplay').innerText = myInventory.ultraball;
        document.getElementById('masterballDisplay').innerText = myInventory.masterball;
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

            // Interactable Buildings Check (Shop, Center)
            let interacting = false;
            for (const obj of mapObjects) {
                if (obj.isShop || obj.type === 'center') {
                    const hx = obj.x + TILE_SIZE;
                    const hy = obj.y + TILE_SIZE;
                    const dx = me.x - hx;
                    const dy = me.y - hy;
                    if (dx*dx + dy*dy < 1200) { // Interaction radius
                        interacting = true;
                        if (obj.isShop && !inShop) {
                            inShop = true;
                            document.getElementById('shop-container').style.display = 'block';
                        } else if (obj.type === 'center' && !inPC) {
                            inPC = true;
                            // Heal team automatically
                            myTeam.forEach(p => p.hp = p.maxHp);
                            sfx.heal();
                            pcMessage.innerText = "Welcome! We have healed your Pokemon.";
                            document.getElementById('pc-container').style.display = 'block';
                            renderPC();
                        }
                        break;
                    }
                }
            }
            if (!interacting) {
                if (inShop) {
                    inShop = false;
                    document.getElementById('shop-container').style.display = 'none';
                }
                if (inPC) {
                    inPC = false;
                    document.getElementById('pc-container').style.display = 'none';
                }
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

                    // Set spawn coordinate based on portal definition
                    if (portal.targetX !== null && portal.targetY !== null) {
                        me.x = portal.targetX;
                        me.y = portal.targetY;
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

        // Softer drop shadow instead of hard black stroke
        ctx.shadowColor = "rgba(0, 0, 0, 0.8)";
        ctx.shadowBlur = 4;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;

        const lvl = p.level || 1;
        const text = `${p.id === myId ? 'You' : 'Player'} (Lv.${lvl})`;
        ctx.fillText(text, p.x, p.y - 35);

        // Reset shadow to not affect other drawings
        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
    }

    ctx.restore();

    requestAnimationFrame(animate);
}
