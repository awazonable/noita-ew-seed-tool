// Noita EW perk generation — dual-LCG PRNG (Noita SetRandomSeed / Random Lua API)
// EW overrides the seed via SetRandomSeed(1+sx, 2+sy) then delegates to vanilla
// perk_get_spawn_order, which draws without replacement using Next() % pool.length

// Load PERK_POOL from perk-data.js (Node) or global (browser)
var _PERK_POOL;
if (typeof module !== 'undefined') {
  _PERK_POOL = require('./perk-data.js').PERK_POOL;
} else {
  _PERK_POOL = typeof PERK_POOL !== 'undefined' ? PERK_POOL : [];
}

// ---- Dual-LCG PRNG state ----

var _world_seed = 0;
var _rng_seed_x = 0;
var _rng_seed_y = 0;

var _buf = new ArrayBuffer(8);
var _view = new DataView(_buf);

function setWorldSeed(seed) {
  _world_seed = seed >>> 0;
}

// IEEE 754 double → upper 32 bits (sign + exponent + high mantissa)
// Little-endian: bytes 4-7 are the upper half of the 64-bit double.
// Integer-valued floats always have zero lower-32 bits, so we must read the upper half.
function _floatHigh32(v) {
  _view.setFloat64(0, v, true);
  return _view.getUint32(4, true);
}

function SetRandomSeedHelper(a, b) {
  var ax = _floatHigh32(a);
  var bx = _floatHigh32(b);
  _rng_seed_x = (ax ^ (_world_seed >>> 13)) >>> 0;
  _rng_seed_y = bx >>> 0;
}

function SetRandomSeed(x, y) {
  SetRandomSeedHelper(x, y);
  var ws = _world_seed;
  for (var i = 0; i < (ws & 3); i++) Next();
}

function Next() {
  _rng_seed_x = (Math.imul(214013, _rng_seed_x) + 2531011) >>> 0;
  _rng_seed_y = (Math.imul(17405, _rng_seed_y) + 10395331) >>> 0;
  return ((_rng_seed_x ^ _rng_seed_y) >>> 0) & 0x7FFF;
}

// ---- Offset extraction ----

// computeOffsets: accepts 16-char hex steamId string
// Lua: string.sub(id,8,12) → JS substring(7,12), string.sub(id,12) → JS substring(11)
function computeOffsets(steamId) {
  var sx = parseInt(steamId.substring(7, 12), 16);
  var sy = parseInt(steamId.substring(11), 16);
  return { sx: sx, sy: sy };
}

// getEwSeed: accepts decimal SteamID64 string (e.g. "76561198012345678")
function getEwSeed(steamId) {
  var id = BigInt(steamId);
  var hex = id.toString(16).padStart(16, '0');
  var sx = parseInt(hex.slice(7, 12), 16) || 0;
  var sy = parseInt(hex.slice(11), 16) || 0;
  return { sx: sx, sy: sy, hex: hex };
}

// ---- Deck generation ----

// generatePerkDeck: main entry point used by the UI
// Mirrors EW override_perk_list.lua → vanilla perk_get_spawn_order()
function generatePerkDeck(worldSeed, sx, sy) {
  setWorldSeed(worldSeed >>> 0);
  SetRandomSeed(1.0 + sx, 2.0 + sy);

  var pool = _PERK_POOL.map(function(p) { return p.id; });
  var deck = [];
  while (pool.length > 0) {
    var idx = Next() % pool.length;
    deck.push(pool[idx]);
    pool.splice(idx, 1);
  }
  return deck;
}

// Return 3 perks per Holy Mountain for numMountains mountains
function getHolyMountainPerks(deck, numMountains) {
  if (numMountains === undefined) numMountains = 12;
  var mountains = [];
  for (var i = 0; i < numMountains; i++) {
    mountains.push(deck.slice(i * 3, i * 3 + 3));
  }
  return mountains;
}

// ---- Backward-compat wrappers (used by tests) ----

// buildPerkDeck: hex steamId, perkPool optional (falls back to _PERK_POOL)
function buildPerkDeck(worldSeed, steamId, perkPool) {
  var off = computeOffsets(steamId);
  setWorldSeed(worldSeed >>> 0);
  SetRandomSeed(1.0 + off.sx, 2.0 + off.sy);

  var pool = (perkPool || _PERK_POOL).map(function(p) { return p.id; });
  var deck = [];
  while (pool.length > 0) {
    var idx = Next() % pool.length;
    deck.push(pool[idx]);
    pool.splice(idx, 1);
  }
  return deck;
}

// getPerksPerMountain: returns first 7 mountains (original spec)
function getPerksPerMountain(deck) {
  return getHolyMountainPerks(deck, 7);
}

if (typeof module !== 'undefined') {
  module.exports = {
    setWorldSeed, SetRandomSeedHelper, SetRandomSeed, Next,
    computeOffsets, getEwSeed,
    generatePerkDeck, getHolyMountainPerks,
    buildPerkDeck, getPerksPerMountain,
  };
}
