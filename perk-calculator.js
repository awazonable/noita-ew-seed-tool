// Noita EW perk generation algorithm
// Based on CLAUDE.md specification

let _world_seed = 0;
let _rng_seed_x = 0;
let _rng_seed_y = 0;

const _buf = new ArrayBuffer(8);
const _view = new DataView(_buf);

function setWorldSeed(seed) {
  _world_seed = seed >>> 0;
}

// IEEE 754 double → upper 32 bits of bit pattern (sign + exponent + high mantissa)
// In little-endian layout, bytes 4-7 hold the upper half of the 64-bit double
function _floatHigh32(v) {
  _view.setFloat64(0, v, true);
  return _view.getUint32(4, true);
}

function SetRandomSeedHelper(a, b) {
  const ax = _floatHigh32(a);
  const bx = _floatHigh32(b);
  _rng_seed_x = (ax ^ (_world_seed >>> 13)) >>> 0;
  _rng_seed_y = bx >>> 0;
}

function SetRandomSeed(x, y) {
  SetRandomSeedHelper(x, y);
  const ws = _world_seed;
  for (let i = 0; i < (ws & 3); i++) Next();
}

function Next() {
  _rng_seed_x = (Math.imul(214013, _rng_seed_x) + 2531011) >>> 0;
  _rng_seed_y = (Math.imul(17405, _rng_seed_y) + 10395331) >>> 0;
  return ((_rng_seed_x ^ _rng_seed_y) >>> 0) & 0x7FFF;
}

// Compute sx, sy offset from SteamID64 hex string
// Lua: string.sub(id,8,12) → JS: id.substring(7,12)
// Lua: string.sub(id,12)   → JS: id.substring(11)
function computeOffsets(steamId) {
  const sx = parseInt(steamId.substring(7, 12), 16);
  const sy = parseInt(steamId.substring(11), 16);
  return { sx, sy };
}

// Build perk deck for given world seed and SteamID64
// Returns array of perk IDs in draw order
function buildPerkDeck(worldSeed, steamId, perkPool) {
  setWorldSeed(worldSeed >>> 0);
  const { sx, sy } = computeOffsets(steamId);
  SetRandomSeed(1.0 + sx, 2.0 + sy);

  const pool = perkPool.map(p => p.id);
  const deck = [];
  while (pool.length > 0) {
    const idx = Next() % pool.length;
    deck.push(pool[idx]);
    pool.splice(idx, 1);
  }
  return deck;
}

// Return perks per mountain (3 perks each, 7 mountains)
function getPerksPerMountain(deck) {
  const PERKS_PER_MOUNTAIN = 3;
  const MOUNTAIN_COUNT = 7;
  const mountains = [];
  for (let i = 0; i < MOUNTAIN_COUNT; i++) {
    mountains.push(deck.slice(i * PERKS_PER_MOUNTAIN, (i + 1) * PERKS_PER_MOUNTAIN));
  }
  return mountains;
}

if (typeof module !== 'undefined') {
  module.exports = {
    setWorldSeed, SetRandomSeedHelper, SetRandomSeed, Next,
    computeOffsets, buildPerkDeck, getPerksPerMountain,
  };
}
