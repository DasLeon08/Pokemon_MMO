const TYPES = {
    NORMAL: 'normal',
    FIRE: 'fire',
    WATER: 'water',
    GRASS: 'grass',
    FLYING: 'flying',
    ELECTRIC: 'electric',
    GROUND: 'ground',
    ROCK: 'rock',
    BUG: 'bug',
    POISON: 'poison'
};

const TYPE_CHART = {
    [TYPES.NORMAL]: { [TYPES.ROCK]: 0.5 },
    [TYPES.FIRE]: { [TYPES.FIRE]: 0.5, [TYPES.WATER]: 0.5, [TYPES.GRASS]: 2.0, [TYPES.BUG]: 2.0, [TYPES.ROCK]: 0.5 },
    [TYPES.WATER]: { [TYPES.FIRE]: 2.0, [TYPES.WATER]: 0.5, [TYPES.GRASS]: 0.5, [TYPES.GROUND]: 2.0, [TYPES.ROCK]: 2.0 },
    [TYPES.GRASS]: { [TYPES.FIRE]: 0.5, [TYPES.WATER]: 2.0, [TYPES.GRASS]: 0.5, [TYPES.POISON]: 0.5, [TYPES.GROUND]: 2.0, [TYPES.FLYING]: 0.5, [TYPES.BUG]: 0.5, [TYPES.ROCK]: 2.0 },
    [TYPES.ELECTRIC]: { [TYPES.WATER]: 2.0, [TYPES.ELECTRIC]: 0.5, [TYPES.GRASS]: 0.5, [TYPES.GROUND]: 0.0, [TYPES.FLYING]: 2.0 },
    [TYPES.GROUND]: { [TYPES.FIRE]: 2.0, [TYPES.ELECTRIC]: 2.0, [TYPES.GRASS]: 0.5, [TYPES.POISON]: 2.0, [TYPES.FLYING]: 0.0, [TYPES.BUG]: 0.5, [TYPES.ROCK]: 2.0 },
    [TYPES.ROCK]: { [TYPES.FIRE]: 2.0, [TYPES.GROUND]: 0.5, [TYPES.FLYING]: 2.0, [TYPES.BUG]: 2.0 },
    [TYPES.BUG]: { [TYPES.FIRE]: 0.5, [TYPES.GRASS]: 2.0, [TYPES.POISON]: 0.5, [TYPES.FLYING]: 0.5 },
    [TYPES.POISON]: { [TYPES.GRASS]: 2.0, [TYPES.POISON]: 0.5, [TYPES.GROUND]: 0.5, [TYPES.ROCK]: 0.5 },
    [TYPES.FLYING]: { [TYPES.ELECTRIC]: 0.5, [TYPES.GRASS]: 2.0, [TYPES.BUG]: 2.0, [TYPES.ROCK]: 0.5 }
};

function getMultiplier(attackType, defenderType) {
    if (TYPE_CHART[attackType] && TYPE_CHART[attackType][defenderType] !== undefined) {
        return TYPE_CHART[attackType][defenderType];
    }
    return 1.0;
}

const MOVES = {
    'Tackle': { power: 40, type: TYPES.NORMAL },
    'Ember': { power: 40, type: TYPES.FIRE },
    'Water Gun': { power: 40, type: TYPES.WATER },
    'Vine Whip': { power: 45, type: TYPES.GRASS },
    'Gust': { power: 40, type: TYPES.FLYING },
    'Thunder Shock': { power: 40, type: TYPES.ELECTRIC },
    'Earthquake': { power: 100, type: TYPES.GROUND },
    'Rock Throw': { power: 50, type: TYPES.ROCK },
    'Bug Bite': { power: 60, type: TYPES.BUG },
    'Poison Sting': { power: 15, type: TYPES.POISON }
};

const POKEDEX = {
    1: { id: 1, name: 'Bulbasaur', type: TYPES.GRASS, baseHp: 45, atk: 49, def: 49, evolvesAt: 16, evolvesTo: 2, move: 'Vine Whip', front: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/1.png', back: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/back/1.png' },
    2: { id: 2, name: 'Ivysaur', type: TYPES.GRASS, baseHp: 60, atk: 62, def: 63, evolvesAt: 32, evolvesTo: 3, move: 'Vine Whip', front: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/2.png', back: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/back/2.png' },
    3: { id: 3, name: 'Venusaur', type: TYPES.GRASS, baseHp: 80, atk: 82, def: 83, evolvesAt: null, evolvesTo: null, move: 'Vine Whip', front: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/3.png', back: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/back/3.png' },
    4: { id: 4, name: 'Charmander', type: TYPES.FIRE, baseHp: 39, atk: 52, def: 43, evolvesAt: 16, evolvesTo: 5, move: 'Ember', front: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/4.png', back: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/back/4.png' },
    5: { id: 5, name: 'Charmeleon', type: TYPES.FIRE, baseHp: 58, atk: 64, def: 58, evolvesAt: 36, evolvesTo: 6, move: 'Ember', front: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/5.png', back: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/back/5.png' },
    6: { id: 6, name: 'Charizard', type: TYPES.FIRE, baseHp: 78, atk: 84, def: 78, evolvesAt: null, evolvesTo: null, move: 'Ember', front: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/6.png', back: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/back/6.png' },
    7: { id: 7, name: 'Squirtle', type: TYPES.WATER, baseHp: 44, atk: 48, def: 65, evolvesAt: 16, evolvesTo: 8, move: 'Water Gun', front: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/7.png', back: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/back/7.png' },
    8: { id: 8, name: 'Wartortle', type: TYPES.WATER, baseHp: 59, atk: 63, def: 80, evolvesAt: 36, evolvesTo: 9, move: 'Water Gun', front: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/8.png', back: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/back/8.png' },
    9: { id: 9, name: 'Blastoise', type: TYPES.WATER, baseHp: 79, atk: 83, def: 100, evolvesAt: null, evolvesTo: null, move: 'Water Gun', front: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/9.png', back: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/back/9.png' },
    16: { id: 16, name: 'Pidgey', type: TYPES.FLYING, baseHp: 40, atk: 45, def: 40, evolvesAt: 18, evolvesTo: 17, move: 'Gust', front: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/16.png', back: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/back/16.png' },
    17: { id: 17, name: 'Pidgeotto', type: TYPES.FLYING, baseHp: 63, atk: 60, def: 55, evolvesAt: 36, evolvesTo: 18, move: 'Gust', front: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/17.png', back: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/back/17.png' },
    18: { id: 18, name: 'Pidgeot', type: TYPES.FLYING, baseHp: 83, atk: 80, def: 75, evolvesAt: null, evolvesTo: null, move: 'Gust', front: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/18.png', back: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/back/18.png' },
    19: { id: 19, name: 'Rattata', type: TYPES.NORMAL, baseHp: 30, atk: 56, def: 35, evolvesAt: 20, evolvesTo: 20, move: 'Tackle', front: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/19.png', back: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/back/19.png' },
    20: { id: 20, name: 'Raticate', type: TYPES.NORMAL, baseHp: 55, atk: 81, def: 60, evolvesAt: null, evolvesTo: null, move: 'Tackle', front: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/20.png', back: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/back/20.png' },
    25: { id: 25, name: 'Pikachu', type: TYPES.ELECTRIC, baseHp: 35, atk: 55, def: 40, evolvesAt: 26, evolvesTo: 26, move: 'Thunder Shock', front: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/25.png', back: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/back/25.png' },
    26: { id: 26, name: 'Raichu', type: TYPES.ELECTRIC, baseHp: 60, atk: 90, def: 55, evolvesAt: null, evolvesTo: null, move: 'Thunder Shock', front: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/26.png', back: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/back/26.png' },
    74: { id: 74, name: 'Geodude', type: TYPES.ROCK, baseHp: 40, atk: 80, def: 100, evolvesAt: 25, evolvesTo: 75, move: 'Rock Throw', front: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/74.png', back: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/back/74.png' },
    75: { id: 75, name: 'Graveler', type: TYPES.ROCK, baseHp: 55, atk: 95, def: 115, evolvesAt: 36, evolvesTo: 76, move: 'Rock Throw', front: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/75.png', back: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/back/75.png' },
    76: { id: 76, name: 'Golem', type: TYPES.ROCK, baseHp: 80, atk: 120, def: 130, evolvesAt: null, evolvesTo: null, move: 'Earthquake', front: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/76.png', back: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/back/76.png' },
    10: { id: 10, name: 'Caterpie', type: TYPES.BUG, baseHp: 45, atk: 30, def: 35, evolvesAt: 7, evolvesTo: 11, move: 'Tackle', front: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/10.png', back: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/back/10.png' },
    11: { id: 11, name: 'Metapod', type: TYPES.BUG, baseHp: 50, atk: 20, def: 55, evolvesAt: 10, evolvesTo: 12, move: 'Tackle', front: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/11.png', back: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/back/11.png' },
    12: { id: 12, name: 'Butterfree', type: TYPES.BUG, baseHp: 60, atk: 45, def: 50, evolvesAt: null, evolvesTo: null, move: 'Bug Bite', front: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/12.png', back: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/back/12.png' },
    41: { id: 41, name: 'Zubat', type: TYPES.POISON, baseHp: 40, atk: 45, def: 35, evolvesAt: 22, evolvesTo: 42, move: 'Poison Sting', front: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/41.png', back: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/back/41.png' },
    42: { id: 42, name: 'Golbat', type: TYPES.POISON, baseHp: 75, atk: 80, def: 70, evolvesAt: null, evolvesTo: null, move: 'Poison Sting', front: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/42.png', back: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/back/42.png' }
};

function generatePokemon(speciesId, level) {
    const data = POKEDEX[speciesId];
    const maxHp = Math.floor(data.baseHp * (1 + level * 0.1));
    return {
        speciesId: speciesId,
        name: data.name,
        level: level,
        hp: maxHp,
        maxHp: maxHp,
        exp: 0,
        atk: Math.floor(data.atk * (1 + level * 0.1)),
        def: Math.floor(data.def * (1 + level * 0.1)),
        move: data.move
    };
}
