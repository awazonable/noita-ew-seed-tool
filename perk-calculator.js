// Noita EW perk generation — Park-Miller LGM PRNG
// Source: Technical:Noita_PRNG wiki + quant.ew EW source code

// Load PERK_LIST from perk-data.js (Node) or global (browser)
var _PERK_LIST;
if (typeof module !== 'undefined') {
  _PERK_LIST = require('./perk-data.js').PERK_LIST;
} else {
  _PERK_LIST = typeof PERK_LIST !== 'undefined' ? PERK_LIST : [];
}

// ---- PRNG ----

function noitaSetRandomSeed(worldSeed, x, y) {
  var w = worldSeed & 0x7fffffff;
  x = x & 0x7fffffff;
  y = y & 0x7fffffff;
  var s = (Math.imul(w, 0x19a065b5) + x) & 0x7fffffff;
  s = (Math.imul(s, 0x19a065b5) + y) & 0x7fffffff;
  return s === 0 ? 1 : s;
}

function noitaNextState(state) {
  return Number(BigInt(state) * 16807n % 2147483647n);
}

function noitaRandom(state) {
  var next = noitaNextState(state);
  return [next, next / 2147483647];
}

function noitaRandomInt(state, a, b) {
  var res = noitaRandom(state);
  return [res[0], Math.floor(res[1] * (b - a + 1)) + a];
}

// ---- EW seed from decimal SteamID64 ----
// Accepts decimal string (e.g. "76561198012345678")
function getEwSeed(steamId) {
  var id = BigInt(steamId);
  var hex = id.toString(16).padStart(16, '0');
  // Lua: string.sub(id, 8, 12) → hex[7..11], string.sub(id, 12) → hex[11..]
  var sx = parseInt(hex.slice(7, 12), 16) || 0;
  var sy = parseInt(hex.slice(11), 16) || 0;
  return { sx: sx, sy: sy, hex: hex };
}

// ---- Deck generation ----
// Mirrors quant.ew override_perk_list.lua → perk_get_spawn_order()
function generatePerkDeck(worldSeed, sx, sy) {
  var state = noitaSetRandomSeed(worldSeed, 1 + sx, 2 + sy);

  // Build deck: stackable non-rare perks get 1..maxPool copies
  var deck = [];
  for (var i = 0; i < _PERK_LIST.length; i++) {
    var entry = _PERK_LIST[i];
    var id = entry[0], stackable = entry[2], maxPool = entry[3], rare = entry[4];
    var count;
    if (!stackable || rare) {
      count = 1;
    } else {
      var r = noitaRandomInt(state, 1, maxPool);
      state = r[0]; count = r[1];
    }
    for (var k = 0; k < count; k++) deck.push(id);
  }

  // Fisher-Yates shuffle
  for (var i = deck.length - 1; i > 0; i--) {
    var r = noitaRandomInt(state, 0, i);
    state = r[0];
    var j = r[1];
    var tmp = deck[i]; deck[i] = deck[j]; deck[j] = tmp;
  }

  // Spread duplicates: no two identical perks within MIN_DIST positions
  var MIN_DIST = 4;
  var result = deck.slice();
  for (var i = 0; i < result.length; i++) {
    for (var j = Math.max(0, i - MIN_DIST); j < i; j++) {
      if (result[j] === result[i]) {
        var perk = result.splice(i, 1)[0];
        result.splice(Math.min(i + MIN_DIST, result.length), 0, perk);
        break;
      }
    }
  }

  return result;
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

// ---- Backward-compat wrappers (used by existing tests) ----

// computeOffsets: accepts 16-char hex steamId string (original format)
function computeOffsets(steamId) {
  var sx = parseInt(steamId.substring(7, 12), 16);
  var sy = parseInt(steamId.substring(11), 16);
  return { sx: sx, sy: sy };
}

// buildPerkDeck: hex steamId, perkPool ignored (uses internal PERK_LIST)
function buildPerkDeck(worldSeed, steamId, perkPool) {
  var off = computeOffsets(steamId);
  return generatePerkDeck(worldSeed >>> 0, off.sx, off.sy);
}

// getPerksPerMountain: returns first 7 mountains
function getPerksPerMountain(deck) {
  return getHolyMountainPerks(deck, 7);
}

if (typeof module !== 'undefined') {
  module.exports = {
    noitaSetRandomSeed, noitaNextState, noitaRandom, noitaRandomInt,
    getEwSeed, generatePerkDeck, getHolyMountainPerks,
    computeOffsets, buildPerkDeck, getPerksPerMountain,
  };
}
