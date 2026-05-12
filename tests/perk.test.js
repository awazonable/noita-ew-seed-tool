'use strict';
const assert = require('assert').strict;
const {
  buildPerkDeck, getPerksPerMountain, computeOffsets,
  setWorldSeed, SetRandomSeed, Next,
  getEwSeed, generatePerkDeck,
} = require('../perk-calculator.js');
const { PERK_POOL } = require('../perk-data.js');

// --- computeOffsets ---
{
  // Lua string.sub(id,8,12) → JS substring(7,12), string.sub(id,12) → JS substring(11)
  // SteamID as 16-char hex: "0110000100b7c4ce"
  // positions (1-indexed): 1234567890123456
  // sub(8,12) = chars 8-12 = '1','0','0','b','7' = "100b7" → 65719
  // sub(12)   = chars 12-end = '7','c','4','c','e' = "7c4ce" → 509134
  const s = '0110000100b7c4ce';
  const { sx, sy } = computeOffsets(s);
  assert.equal(sx, 0x100b7, 'sx should be 65719');
  assert.equal(sy, 0x7c4ce, 'sy should be 509134');
  console.log('PASS: computeOffsets basic');
}

{
  // Edge: all zeros steamId (theoretical)
  const s = '0000000000000000';
  const { sx, sy } = computeOffsets(s);
  assert.equal(sx, 0, 'sx=0 for all-zero steamId');
  assert.equal(sy, 0, 'sy=0 for all-zero steamId');
  console.log('PASS: computeOffsets zero');
}

// --- getEwSeed (decimal steamId) ---
{
  // Decimal form of hex '0110000100b7c4ce'
  const hexStr = '0110000100b7c4ce';
  const decStr = BigInt('0x' + hexStr).toString(10);
  const { sx, sy, hex } = getEwSeed(decStr);
  assert.equal(hex, hexStr, 'hex conversion must reproduce original');
  assert.equal(sx, 0x100b7, 'sx from decimal steamId must match hex computeOffsets');
  assert.equal(sy, 0x7c4ce, 'sy from decimal steamId must match hex computeOffsets');
  console.log('PASS: getEwSeed decimal steamId matches computeOffsets');
}

{
  // Real-world Steam ID format (17-digit decimal)
  const { hex } = getEwSeed('76561198012345678');
  assert.equal(hex.length, 16, 'hex must be 16 chars');
  assert(/^[0-9a-f]{16}$/.test(hex), 'hex must be lowercase hex');
  console.log('PASS: getEwSeed real Steam ID format');
}

// --- PERK_POOL integrity ---
{
  assert.equal(PERK_POOL.length, 101, 'Pool must have exactly 101 perks');
  const ids = PERK_POOL.map(p => p.id);
  assert.equal(new Set(ids).size, 101, 'No duplicate perk IDs in pool');

  const excluded = ['MOON_RADAR', 'MAP', 'LEGGY_FEET', 'SAVING_GRACE', 'RESPAWN'];
  for (const id of excluded) {
    assert(!ids.includes(id), id + ' must not be in EW pool');
  }
  console.log('PASS: PERK_POOL integrity');
}

// --- buildPerkDeck ---
{
  const deck = buildPerkDeck(786433000, '0110000100b7c4ce', PERK_POOL);
  assert.equal(deck.length, 101, 'Deck must contain all pool perks');
  assert.equal(new Set(deck).size, 101, 'No duplicates in deck');
  for (const id of deck) {
    assert(PERK_POOL.some(p => p.id === id), 'All deck entries must be in pool');
  }
  console.log('PASS: buildPerkDeck integrity');
}

// --- Determinism ---
{
  const seed = 786433000;
  const steamId = '0110000100b7c4ce';
  const d1 = buildPerkDeck(seed, steamId, PERK_POOL);
  const d2 = buildPerkDeck(seed, steamId, PERK_POOL);
  assert.deepEqual(d1, d2, 'Same inputs must always give same deck');
  console.log('PASS: determinism');
}

// --- World seed sensitivity ---
{
  const steamId = '0110000100b7c4ce';
  const d1 = buildPerkDeck(786433000, steamId, PERK_POOL);
  const d2 = buildPerkDeck(123456789, steamId, PERK_POOL);
  assert.notDeepEqual(d1, d2, 'Different world seeds must give different decks');
  console.log('PASS: world seed sensitivity');
}

// --- SteamID sensitivity ---
{
  const seed = 786433000;
  const d1 = buildPerkDeck(seed, '0110000100b7c4ce', PERK_POOL);
  const d2 = buildPerkDeck(seed, '0110000200a1b2c3', PERK_POOL);
  assert.notDeepEqual(d1, d2, 'Different steamIds must give different decks');
  console.log('PASS: steamId sensitivity');
}

// --- getPerksPerMountain ---
{
  const deck = buildPerkDeck(786433000, '0110000100b7c4ce', PERK_POOL);
  const mountains = getPerksPerMountain(deck);
  assert.equal(mountains.length, 7, 'Must return 7 mountains');
  for (let i = 0; i < 7; i++) {
    assert.equal(mountains[i].length, 3, 'Each mountain must have 3 perks');
    assert.deepEqual(mountains[i], deck.slice(i * 3, i * 3 + 3), 'Mountain perks must be sequential from deck');
  }
  console.log('PASS: getPerksPerMountain');
}

// --- Large world seed (int64 range, truncated to 32 bits internally) ---
{
  const largeSeed = parseInt('3916679801269120000');
  const { sx, sy } = computeOffsets('0110000100b7c4ce');
  const deck = generatePerkDeck(largeSeed, sx, sy);
  assert.equal(deck.length, PERK_POOL.length, 'Large seed deck must have all perks');
  assert.equal(new Set(deck).size, PERK_POOL.length, 'Large seed deck has no duplicates');
  console.log('PASS: large world seed');
}

// --- Known fixed outputs (regression anchors for dual-LCG) ---
{
  const deck = buildPerkDeck(786433000, '0110000100b7c4ce', PERK_POOL);
  assert.equal(deck[0], 'WAND_RADAR',      'Known first perk for seed=786433000');
  assert.equal(deck[1], 'RADAR_ENEMY',     'Known second perk for seed=786433000');
  assert.equal(deck[2], 'EXTRA_KNOCKBACK', 'Known third perk for seed=786433000');
  console.log('PASS: regression test (seed=786433000, steamId=0110000100b7c4ce)');
}

{
  const deck = buildPerkDeck(123456789, '0110000100b7c4ce', PERK_POOL);
  assert.equal(deck[0], 'EXTRA_PERK',         'Known first perk for seed=123456789');
  assert.equal(deck[1], 'LOW_RECOIL',         'Known second perk for seed=123456789');
  assert.equal(deck[2], 'HEARTS_MORE_EXTRA_HP','Known third perk for seed=123456789');
  console.log('PASS: regression test (seed=123456789)');
}

console.log('\nAll tests passed!');
