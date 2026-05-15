// Noita EW perk generation — uses rng.wasm from TwoAbove/noita-tools (MIT)
// PRNG: Nolla PRNG (Bob Jenkins hash + Park-Miller LCG)
// Algorithm mirrors noita-tools perk_get_spawn_order with EW per-peer seed override

var _PERK_POOL;
if (typeof module !== 'undefined') {
  _PERK_POOL = require('./perk-data.js').PERK_POOL;
} else {
  _PERK_POOL = typeof PERK_POOL !== 'undefined' ? PERK_POOL : [];
}

// Quick lookup by id for dedup step
var _PERK_MAP = {};
(function() {
  for (var i = 0; i < _PERK_POOL.length; i++) {
    _PERK_MAP[_PERK_POOL[i].id] = _PERK_POOL[i];
  }
})();

// ---- WASM state ----

var _wasm = null;

async function initWasm() {
  if (_wasm) return;
  var wasmBytes;
  if (typeof require !== 'undefined') {
    var path = require('path');
    wasmBytes = require('fs').readFileSync(path.join(__dirname, 'rng.wasm'));
  } else {
    var response = await fetch('./rng.wasm');
    wasmBytes = await response.arrayBuffer();
  }
  var result = await WebAssembly.instantiate(wasmBytes, {});
  _wasm = result.instance.exports;
}

// ---- SteamID parsing ----

// computeOffsets: accepts 16-char hex steamId string
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

// generatePerkDeck: mirrors EW override_perk_list.lua → vanilla perk_get_spawn_order()
// Requires initWasm() to have been called first.
function generatePerkDeck(worldSeed, sx, sy) {
  if (!_wasm) throw new Error('Call initWasm() before generatePerkDeck()');
  var SetWorldSeed = _wasm.SetWorldSeed;
  var SetRandomSeed = _wasm.SetRandomSeed;
  var RandomInt = _wasm.RandomInt;

  SetWorldSeed(worldSeed >>> 0);
  SetRandomSeed(1.0 + sx, 2.0 + sy);

  // Step 1: Build pool — mirrors perk_get_spawn_order pool construction
  // For each stackable perk:
  //   always consume Random(1,2) first; if max_in_perk_pool, override with Random(1,max);
  //   if stackable_is_rare, force count to 1; then consume Random(1, max) for how_many_times
  var deck = [];
  for (var i = 0; i < _PERK_POOL.length; i++) {
    var perk = _PERK_POOL[i];
    if (!perk.stackable) {
      deck.push(perk.id);
    } else {
      var max_perks = RandomInt(1, 2);
      if (perk.maxPool) max_perks = RandomInt(1, perk.maxPool);
      if (perk.rare) max_perks = 1;
      var how_many = RandomInt(1, max_perks);
      for (var j = 0; j < how_many; j++) deck.push(perk.id);
    }
  }

  // Step 2: Fisher-Yates shuffle — mirrors shuffle_table() in noita-tools
  for (var i = deck.length - 1; i >= 1; i--) {
    var j = RandomInt(0, i);
    var tmp = deck[i]; deck[i] = deck[j]; deck[j] = tmp;
  }

  // Step 3: Remove stackable duplicates within min_distance=4 (scan backwards)
  var MIN_DIST = 4;
  for (var i = deck.length - 1; i >= 0; i--) {
    var p = _PERK_MAP[deck[i]];
    if (!p || !p.stackable) continue;
    for (var ri = i - MIN_DIST; ri < i; ri++) {
      if (ri >= 0 && deck[ri] === deck[i]) {
        deck.splice(i, 1);
        break;
      }
    }
  }

  return deck;
}

// getHolyMountainPerks: returns 3 perks per Holy Mountain for numMountains mountains
function getHolyMountainPerks(deck, numMountains) {
  if (numMountains === undefined) numMountains = 7;
  var mountains = [];
  for (var i = 0; i < numMountains; i++) {
    mountains.push(deck.slice(i * 3, i * 3 + 3));
  }
  return mountains;
}

// ---- Backward-compat wrappers (used by tests) ----

// buildPerkDeck: hex steamId string, perkPool param kept for API compat (ignored)
function buildPerkDeck(worldSeed, steamId) {
  var off = computeOffsets(steamId);
  return generatePerkDeck(worldSeed >>> 0, off.sx, off.sy);
}

// getPerksPerMountain: returns first 7 mountains
function getPerksPerMountain(deck) {
  return getHolyMountainPerks(deck, 7);
}

// ---- URL parameter parsing ----

function parseUrlParams(search) {
  var params = new URLSearchParams(search);
  var seed = params.get('seed') || '';
  var steamidParam = params.get('steamid') || '';
  var steamIds = steamidParam
    ? steamidParam.split(',').map(function(s) { return s.trim(); }).filter(Boolean)
    : [];
  var namesParam = params.get('names') || '';
  var names = namesParam
    ? namesParam.split(',')
    : [];
  return { seed: seed, steamIds: steamIds, names: names };
}

// buildShareUrl: constructs a shareable URL encoding seed and all players (steamId + name)
// players: Array<{ steamId: string, name: string }>
// baseUrl: e.g. window.location.origin + window.location.pathname
function buildShareUrl(seed, players, baseUrl) {
  var params = new URLSearchParams();
  if (seed) params.set('seed', seed);
  var validPlayers = players.filter(function(p) { return p.steamId && p.steamId.trim(); });
  if (validPlayers.length > 0) {
    params.set('steamid', validPlayers.map(function(p) { return p.steamId.trim(); }).join(','));
    params.set('names', validPlayers.map(function(p) { return p.name || ''; }).join(','));
  }
  return baseUrl + '?' + params.toString();
}

if (typeof module !== 'undefined') {
  module.exports = {
    initWasm,
    computeOffsets, getEwSeed,
    generatePerkDeck, getHolyMountainPerks,
    buildPerkDeck, getPerksPerMountain,
    parseUrlParams, buildShareUrl,
  };
}
