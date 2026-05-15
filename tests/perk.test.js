'use strict';
const assert = require('assert').strict;
const calc = require('../perk-calculator.js');
const { PERK_POOL, PERK_NAME_MAP } = require('../perk-data.js');

(async () => {
  await calc.initWasm();

  const {
    buildPerkDeck, getPerksPerMountain, computeOffsets,
    getEwSeed, generatePerkDeck, getHolyMountainPerks, parseUrlParams,
  } = calc;

  // --- computeOffsets ---
  {
    // Lua string.sub(id,8,12) → JS substring(7,12), string.sub(id,12) → JS substring(11)
    // "0110000100b7c4ce": sub(8,12) = "100b7" → 65719, sub(12) = "7c4ce" → 509134
    const s = '0110000100b7c4ce';
    const { sx, sy } = computeOffsets(s);
    assert.equal(sx, 0x100b7, 'sx should be 65719');
    assert.equal(sy, 0x7c4ce, 'sy should be 509134');
    console.log('PASS: computeOffsets basic');
  }

  {
    const s = '0000000000000000';
    const { sx, sy } = computeOffsets(s);
    assert.equal(sx, 0, 'sx=0 for all-zero steamId');
    assert.equal(sy, 0, 'sy=0 for all-zero steamId');
    console.log('PASS: computeOffsets zero');
  }

  // --- getEwSeed (decimal steamId) ---
  {
    const hexStr = '0110000100b7c4ce';
    const decStr = BigInt('0x' + hexStr).toString(10);
    const { sx, sy, hex } = getEwSeed(decStr);
    assert.equal(hex, hexStr, 'hex conversion must reproduce original');
    assert.equal(sx, 0x100b7, 'sx from decimal steamId must match hex computeOffsets');
    assert.equal(sy, 0x7c4ce, 'sy from decimal steamId must match hex computeOffsets');
    console.log('PASS: getEwSeed decimal steamId matches computeOffsets');
  }

  {
    // Game-verified SteamID used for all three regression cases
    const { hex, sx, sy } = getEwSeed('76561198208852417');
    assert.equal(hex, '011000010ed121c1', 'hex for known SteamID64');
    assert.equal(sx, 0x10ed1, 'sx=69329 for known SteamID64');
    assert.equal(sy, 0x121c1, 'sy=74177 for known SteamID64');
    console.log('PASS: getEwSeed known SteamID64');
  }

  {
    const { hex } = getEwSeed('76561198012345678');
    assert.equal(hex.length, 16, 'hex must be 16 chars');
    assert(/^[0-9a-f]{16}$/.test(hex), 'hex must be lowercase hex');
    console.log('PASS: getEwSeed real Steam ID format');
  }

  // --- PERK_POOL integrity ---
  {
    assert.equal(PERK_POOL.length, 103, 'Pool must have exactly 103 perks');
    const ids = PERK_POOL.map(p => p.id);
    assert.equal(new Set(ids).size, 103, 'No duplicate perk IDs in pool');

    // Vanilla not_in_default_perk_pool perks must be absent
    for (const id of ['MOON_RADAR', 'MAP', 'LEGGY_FEET']) {
      assert(!ids.includes(id), id + ' must not be in pool (not_in_default_perk_pool)');
    }
    // SAVING_GRACE and RESPAWN remain in pool: EW hide_perk() affects UI only
    assert(ids.includes('SAVING_GRACE'), 'SAVING_GRACE must be in pool');
    assert(ids.includes('RESPAWN'), 'RESPAWN must be in pool');

    // Structural checks per perk entry
    for (const p of PERK_POOL) {
      assert(typeof p.id === 'string' && p.id.length > 0, 'perk.id must be non-empty string');
      assert(typeof p.name === 'string' && p.name.length > 0, 'perk.name must be non-empty: ' + p.id);
      assert(typeof p.stackable === 'boolean', 'perk.stackable must be boolean: ' + p.id);
      assert(typeof p.rare === 'boolean', 'perk.rare must be boolean: ' + p.id);
      assert(p.maxPool === null || (Number.isInteger(p.maxPool) && p.maxPool >= 1),
        'perk.maxPool must be null or positive integer: ' + p.id);
    }
    console.log('PASS: PERK_POOL integrity');
  }

  // --- PERK_NAME_MAP ---
  {
    assert.equal(Object.keys(PERK_NAME_MAP).length, 103, 'PERK_NAME_MAP must have 103 entries');
    assert.equal(PERK_NAME_MAP['INVISIBILITY'], 'Invisibility', 'name lookup works');
    console.log('PASS: PERK_NAME_MAP');
  }

  // --- Game-verified test cases (confirmed against actual Noita EW gameplay) ---
  // SteamID64 76561198208852417 → hex 011000010ed121c1 → sx=69329, sy=74177
  {
    const { sx, sy } = getEwSeed('76561198208852417');

    const d1 = generatePerkDeck(3280915446, sx, sy);
    assert.deepEqual(d1.slice(0, 3), ['INVISIBILITY', 'NO_WAND_EDITING', 'TELEPORTITIS_DODGE'],
      'ws=3280915446 mountain 1 must match game');
    console.log('PASS: game-verified ws=3280915446 → [INVISIBILITY, NO_WAND_EDITING, TELEPORTITIS_DODGE]');

    const d2 = generatePerkDeck(11111111, sx, sy);
    assert.deepEqual(d2.slice(0, 3), ['STAINLESS_ARMOUR', 'PROTECTION_EXPLOSION', 'EXTRA_SHOP_ITEM'],
      'ws=11111111 mountain 1 must match game');
    console.log('PASS: game-verified ws=11111111 → [STAINLESS_ARMOUR, PROTECTION_EXPLOSION, EXTRA_SHOP_ITEM]');

    const d3 = generatePerkDeck(12345678, sx, sy);
    assert.deepEqual(d3.slice(0, 3), ['REVENGE_EXPLOSION', 'NO_MORE_SHUFFLE', 'NO_WAND_EDITING'],
      'ws=12345678 mountain 1 must match game');
    console.log('PASS: game-verified ws=12345678 → [REVENGE_EXPLOSION, NO_MORE_SHUFFLE, NO_WAND_EDITING]');
  }

  // --- Structural: deck validity ---
  {
    const { sx, sy } = computeOffsets('0110000100b7c4ce');
    const deck = generatePerkDeck(786433000, sx, sy);

    assert(Array.isArray(deck), 'deck is an array');
    assert(deck.length >= 103, 'deck has at least 103 entries (stackable perks can add duplicates)');

    const validIds = new Set(PERK_POOL.map(p => p.id));
    for (const id of deck) {
      assert(validIds.has(id), 'deck entry must be a valid perk id: ' + id);
    }

    // Non-stackable perks must appear exactly once
    const nonStack = PERK_POOL.filter(p => !p.stackable).map(p => p.id);
    for (const id of nonStack) {
      const count = deck.filter(x => x === id).length;
      assert.equal(count, 1, 'non-stackable perk must appear exactly once: ' + id);
    }

    // No same perk within 4 consecutive positions (dedup guarantee)
    for (let i = 0; i < deck.length; i++) {
      for (let j = Math.max(0, i - 3); j < i; j++) {
        assert(deck[i] !== deck[j],
          'same perk within 4 positions at [' + j + ',' + i + ']: ' + deck[i]);
      }
    }
    console.log('PASS: deck structural integrity');
  }

  // --- Determinism ---
  {
    const { sx, sy } = computeOffsets('0110000100b7c4ce');
    const d1 = generatePerkDeck(786433000, sx, sy);
    const d2 = generatePerkDeck(786433000, sx, sy);
    assert.deepEqual(d1, d2, 'Same inputs must always give same deck');
    console.log('PASS: determinism');
  }

  // --- World seed sensitivity ---
  {
    const { sx, sy } = computeOffsets('0110000100b7c4ce');
    const d1 = generatePerkDeck(786433000, sx, sy);
    const d2 = generatePerkDeck(123456789, sx, sy);
    assert.notDeepEqual(d1, d2, 'Different world seeds must give different decks');
    console.log('PASS: world seed sensitivity');
  }

  // --- SteamID sensitivity ---
  {
    const off1 = computeOffsets('0110000100b7c4ce');
    const off2 = computeOffsets('0110000200a1b2c3');
    const d1 = generatePerkDeck(786433000, off1.sx, off1.sy);
    const d2 = generatePerkDeck(786433000, off2.sx, off2.sy);
    assert.notDeepEqual(d1, d2, 'Different steamIds must give different decks');
    console.log('PASS: steamId sensitivity');
  }

  // --- buildPerkDeck (backward-compat wrapper) ---
  {
    const deck = buildPerkDeck(786433000, '0110000100b7c4ce');
    const validIds = new Set(PERK_POOL.map(p => p.id));
    assert(deck.length >= 103, 'buildPerkDeck deck has expected minimum length');
    for (const id of deck) {
      assert(validIds.has(id), 'buildPerkDeck entry must be a valid perk id');
    }
    console.log('PASS: buildPerkDeck integrity');
  }

  // --- getHolyMountainPerks / getPerksPerMountain ---
  {
    const { sx, sy } = computeOffsets('0110000100b7c4ce');
    const deck = generatePerkDeck(786433000, sx, sy);
    const mountains = getHolyMountainPerks(deck, 8);
    assert.equal(mountains.length, 8, 'getHolyMountainPerks returns requested count');
    for (let i = 0; i < 8; i++) {
      assert.equal(mountains[i].length, 3, 'each mountain has 3 perks');
      assert.deepEqual(mountains[i], deck.slice(i * 3, i * 3 + 3), 'mountain perks are sequential');
    }

    const mts7 = getPerksPerMountain(deck);
    assert.equal(mts7.length, 7, 'getPerksPerMountain returns 7 mountains');
    console.log('PASS: getHolyMountainPerks / getPerksPerMountain');
  }

  // --- parseUrlParams ---
  {
    const r = parseUrlParams('?seed=786433000&steamid=76561198208852417');
    assert.equal(r.seed, '786433000', 'seed extracted');
    assert.deepEqual(r.steamIds, ['76561198208852417'], 'single steamId extracted');
    console.log('PASS: parseUrlParams single steamId');
  }

  {
    const r = parseUrlParams('?seed=3916679801&steamid=76561198208812345,76561198208812346');
    assert.equal(r.seed, '3916679801');
    assert.deepEqual(r.steamIds, ['76561198208812345', '76561198208812346'], 'multiple steamIds extracted');
    console.log('PASS: parseUrlParams multiple steamIds');
  }

  {
    const r = parseUrlParams('?steamid= 111 , 222 , 333 ');
    assert.deepEqual(r.steamIds, ['111', '222', '333'], 'steamIds trimmed');
    console.log('PASS: parseUrlParams trims whitespace');
  }

  {
    const r = parseUrlParams('?seed=999');
    assert.equal(r.seed, '999');
    assert.deepEqual(r.steamIds, [], 'no steamIds when param absent');
    console.log('PASS: parseUrlParams seed only');
  }

  {
    const r = parseUrlParams('');
    assert.equal(r.seed, '', 'empty seed');
    assert.deepEqual(r.steamIds, [], 'empty steamIds');
    console.log('PASS: parseUrlParams empty');
  }

  {
    const r = parseUrlParams('?steamid=111,,222,');
    assert.deepEqual(r.steamIds, ['111', '222'], 'empty segments filtered');
    console.log('PASS: parseUrlParams filters empty segments');
  }

  console.log('\nAll tests passed!');
})().catch(err => { console.error(err); process.exit(1); });
