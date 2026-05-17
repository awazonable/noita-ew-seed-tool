'use strict';
const assert = require('assert').strict;
const calc = require('../perk-calculator.js');
const { PERK_POOL, PERK_NAME_MAP } = require('../perk-data.js');

(async () => {
  await calc.initWasm();

  const {
    buildPerkDeck, getPerksPerMountain, computeOffsets,
    getEwSeed, generatePerkDeck, getHolyMountainPerks, getRerollSlots, parseUrlParams, buildShareUrl,
    encodeConditions, decodeConditions,
    SEARCH_HIT_LIMIT, encodeResults, decodeResults,
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

    // Default (no argument) must return exactly 7 mountains — game has 7 Holy Mountains
    const mtsDefault = getHolyMountainPerks(deck);
    assert.equal(mtsDefault.length, 7, 'getHolyMountainPerks default returns 7 mountains');

    const mts7 = getPerksPerMountain(deck);
    assert.equal(mts7.length, 7, 'getPerksPerMountain returns 7 mountains');
    assert.deepEqual(mtsDefault, mts7, 'getHolyMountainPerks() and getPerksPerMountain() return identical results');
    console.log('PASS: getHolyMountainPerks / getPerksPerMountain');
  }

  // --- parseUrlParams ---
  {
    const r = parseUrlParams('?seed=786433000&steamid=76561198208852417');
    assert.equal(r.seed, '786433000', 'seed extracted');
    assert.deepEqual(r.steamIds, ['76561198208852417'], 'single steamId extracted');
    assert.deepEqual(r.names, [], 'names empty when param absent');
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
    assert.deepEqual(r.names, [], 'empty names');
    console.log('PASS: parseUrlParams empty');
  }

  {
    const r = parseUrlParams('?steamid=111,,222,');
    assert.deepEqual(r.steamIds, ['111', '222'], 'empty segments filtered');
    console.log('PASS: parseUrlParams filters empty segments');
  }

  // --- parseUrlParams: names ---
  {
    const r = parseUrlParams('?seed=1&steamid=111,222&names=Alice,Bob');
    assert.deepEqual(r.names, ['Alice', 'Bob'], 'names extracted');
    console.log('PASS: parseUrlParams names ASCII');
  }

  {
    // Multi-byte names: URLSearchParams handles %encoding automatically
    const encoded = new URLSearchParams({ names: '太郎,花子' }).toString();
    const r = parseUrlParams('?' + encoded);
    assert.deepEqual(r.names, ['太郎', '花子'], 'multi-byte names decoded correctly');
    console.log('PASS: parseUrlParams names multi-byte');
  }

  {
    const r = parseUrlParams('?seed=1&steamid=111');
    assert.deepEqual(r.names, [], 'names empty when param absent');
    console.log('PASS: parseUrlParams names absent');
  }

  // --- buildShareUrl ---
  {
    const url = buildShareUrl('12345678', [
      { name: 'Alice', steamId: '76561198208852417' },
    ], 'https://example.com/');
    const parsed = new URL(url);
    assert.equal(parsed.searchParams.get('seed'), '12345678', 'seed in URL');
    assert.equal(parsed.searchParams.get('steamid'), '76561198208852417', 'steamid in URL');
    assert.equal(parsed.searchParams.get('names'), 'Alice', 'name in URL');
    console.log('PASS: buildShareUrl single player');
  }

  {
    const url = buildShareUrl('999', [
      { name: 'Player 1', steamId: '111' },
      { name: 'Player 2', steamId: '222' },
    ], 'https://example.com/');
    const parsed = new URL(url);
    assert.equal(parsed.searchParams.get('steamid'), '111,222', 'multiple steamIds');
    assert.equal(parsed.searchParams.get('names'), 'Player 1,Player 2', 'multiple names');
    console.log('PASS: buildShareUrl multiple players');
  }

  {
    // Multi-byte names round-trip
    const url = buildShareUrl('1', [
      { name: '太郎', steamId: '111' },
      { name: '花子', steamId: '222' },
    ], 'https://example.com/');
    const parsed = new URL(url);
    assert.equal(parsed.searchParams.get('names'), '太郎,花子', 'multi-byte names round-trip');
    // Verify round-trip through parseUrlParams
    const r = parseUrlParams('?' + new URL(url).searchParams.toString());
    assert.deepEqual(r.names, ['太郎', '花子'], 'multi-byte names parse round-trip');
    console.log('PASS: buildShareUrl multi-byte names round-trip');
  }

  {
    // Players with empty steamId are excluded
    const url = buildShareUrl('1', [
      { name: 'Alice', steamId: '111' },
      { name: 'NoId', steamId: '' },
    ], 'https://example.com/');
    const parsed = new URL(url);
    assert.equal(parsed.searchParams.get('steamid'), '111', 'empty steamId excluded');
    assert.equal(parsed.searchParams.get('names'), 'Alice', 'name of empty-steamId player excluded');
    console.log('PASS: buildShareUrl excludes empty steamId');
  }

  {
    // No seed — no seed param
    const url = buildShareUrl('', [{ name: 'A', steamId: '1' }], 'https://example.com/');
    const parsed = new URL(url);
    assert.equal(parsed.searchParams.get('seed'), null, 'no seed param when seed empty');
    console.log('PASS: buildShareUrl no seed');
  }

  {
    // No valid players — no steamid/names params
    const url = buildShareUrl('123', [], 'https://example.com/');
    const parsed = new URL(url);
    assert.equal(parsed.searchParams.get('steamid'), null, 'no steamid param with empty players');
    assert.equal(parsed.searchParams.get('names'), null, 'no names param with empty players');
    console.log('PASS: buildShareUrl empty players');
  }

  // --- encodeConditions / decodeConditions ---
  {
    // Basic encode
    const conditions = [
      { perkId: 'PROJECTILE_HOMING', mountain: 1, type: 'exactly', players: 'all' },
      { perkId: 'INVISIBILITY', mountain: 'any', type: 'within', players: 'any' },
    ];
    const encoded = encodeConditions(conditions);
    assert.deepEqual(encoded, [
      'PROJECTILE_HOMING:1:exactly:all',
      'INVISIBILITY:any:within:any',
    ], 'encodeConditions produces colon-separated strings');
    console.log('PASS: encodeConditions basic');
  }

  {
    // Round-trip
    const conditions = [
      { perkId: 'STAINLESS_ARMOUR', mountain: 3, type: 'within', players: 'any' },
      { perkId: 'EXTRA_HP', mountain: 'any', type: 'exactly', players: 'all' },
    ];
    const decoded = decodeConditions(encodeConditions(conditions));
    assert.deepEqual(decoded, conditions, 'encode→decode round-trip');
    console.log('PASS: encodeConditions/decodeConditions round-trip');
  }

  {
    // encodeConditions filters out entries without perkId
    const enc = encodeConditions([
      { perkId: '', mountain: 1, type: 'exactly', players: 'all' },
      { perkId: 'EXTRA_HP', mountain: 2, type: 'within', players: 'any' },
    ]);
    assert.deepEqual(enc, ['EXTRA_HP:2:within:any'], 'encodeConditions filters empty perkId');
    console.log('PASS: encodeConditions filters empty perkId');
  }

  {
    // decodeConditions filters invalid entries
    const decoded = decodeConditions([
      'invalid',                          // too few colons
      'PERK:1:exactly:all',               // valid
      'PERK:99:exactly:all',              // mountain out of range
      'PERK:1:badtype:all',               // invalid type
      'PERK:1:exactly:badplayers',        // invalid players
      '::exactly:all',                    // empty perkId
    ]);
    assert.equal(decoded.length, 1, 'decodeConditions filters invalid entries');
    assert.equal(decoded[0].perkId, 'PERK', 'valid entry preserved');
    assert.equal(decoded[0].mountain, 1);
    assert.equal(decoded[0].type, 'exactly');
    assert.equal(decoded[0].players, 'all');
    console.log('PASS: decodeConditions filters invalid entries');
  }

  {
    // decodeConditions handles empty/non-array input
    assert.deepEqual(encodeConditions([]), [], 'encodeConditions empty');
    assert.deepEqual(decodeConditions([]), [], 'decodeConditions empty array');
    assert.deepEqual(decodeConditions(null), [], 'decodeConditions null');
    console.log('PASS: encodeConditions/decodeConditions edge cases');
  }

  // --- encodeResults / decodeResults ---
  {
    assert.equal(typeof SEARCH_HIT_LIMIT, 'number', 'SEARCH_HIT_LIMIT is a number');
    assert(SEARCH_HIT_LIMIT >= 1, 'SEARCH_HIT_LIMIT is positive');

    // Basic round-trip
    const str = encodeResults(100, 999, [150, 200, 300]);
    assert(typeof str === 'string' && str.length > 0, 'encodeResults returns non-empty string');
    assert(/^[A-Za-z0-9_-]+$/.test(str), 'encodeResults returns URL-safe base64 (no +/=)');
    const decoded = decodeResults(str);
    assert(decoded !== null, 'decodeResults returns non-null for valid input');
    assert.equal(decoded.start, 100, 'round-trip: start');
    assert.equal(decoded.end, 999, 'round-trip: end');
    assert.deepEqual(decoded.hits, [150, 200, 300], 'round-trip: hits');
    console.log('PASS: encodeResults/decodeResults round-trip');
  }

  {
    // Empty hits
    const str = encodeResults(0, 4294967295, []);
    const decoded = decodeResults(str);
    assert.equal(decoded.start, 0, 'empty hits: start=0');
    assert.equal(decoded.end, 4294967295, 'empty hits: end=UINT32_MAX');
    assert.deepEqual(decoded.hits, [], 'empty hits: hits=[]');
    console.log('PASS: encodeResults/decodeResults empty hits');
  }

  {
    // uint32 boundary values
    const str = encodeResults(4294967295, 4294967295, [4294967295]);
    const decoded = decodeResults(str);
    assert.equal(decoded.start, 4294967295, 'uint32 boundary: start');
    assert.equal(decoded.end, 4294967295, 'uint32 boundary: end');
    assert.deepEqual(decoded.hits, [4294967295], 'uint32 boundary: hit');
    console.log('PASS: encodeResults/decodeResults uint32 boundary');
  }

  {
    // Hits capped at SEARCH_HIT_LIMIT
    const manyHits = [];
    for (let i = 0; i < SEARCH_HIT_LIMIT + 10; i++) manyHits.push(i);
    const str = encodeResults(0, 1000, manyHits);
    const decoded = decodeResults(str);
    assert.equal(decoded.hits.length, SEARCH_HIT_LIMIT, 'hits capped at SEARCH_HIT_LIMIT');
    assert.deepEqual(decoded.hits, manyHits.slice(0, SEARCH_HIT_LIMIT), 'first SEARCH_HIT_LIMIT hits preserved');
    console.log('PASS: encodeResults caps hits at SEARCH_HIT_LIMIT');
  }

  {
    // decodeResults invalid inputs
    assert.equal(decodeResults(''), null, 'empty string returns null');
    assert.equal(decodeResults(null), null, 'null returns null');
    assert.equal(decodeResults('!!!'), null, 'invalid base64 returns null');
    console.log('PASS: decodeResults handles invalid input');
  }

  // --- Multi-worker interleave correctness ---
  {
    // Verify interleaved workers partition the seed space exactly (no overlap, full coverage)
    for (const N of [1, 2, 4, 8]) {
      const RANGE = 100;
      const seen = new Set();
      for (let wi = 0; wi < N; wi++) {
        for (let seed = wi; seed < RANGE; seed += N) {
          assert(!seen.has(seed), `duplicate seed ${seed} for N=${N}`);
          seen.add(seed);
        }
      }
      assert.equal(seen.size, RANGE, `N=${N}: all ${RANGE} seeds covered`);
    }
    console.log('PASS: interleaved workers partition seed space without overlap');
  }

  {
    const { checkAllConditionsWithPlayerMode } = require('../search-engine.js');
    const { sx, sy } = computeOffsets('0110000100b7c4ce');
    const conditions = [{ perk: 'INVISIBILITY', mountain: 1, mode: 'exact', players: 'any' }];
    const RANGE_END = 999;

    // Single-worker scan
    const hits1 = [];
    for (let seed = 0; seed <= RANGE_END; seed++) {
      const deck = generatePerkDeck(seed, sx, sy);
      if (checkAllConditionsWithPlayerMode([deck], conditions)) hits1.push(seed);
    }

    // Simulate 4-worker interleaved scan
    const hits4 = [];
    const N = 4;
    for (let wi = 0; wi < N; wi++) {
      for (let seed = wi; seed <= RANGE_END; seed += N) {
        const deck = generatePerkDeck(seed, sx, sy);
        if (checkAllConditionsWithPlayerMode([deck], conditions)) hits4.push(seed);
      }
    }
    hits4.sort((a, b) => a - b);

    assert.deepEqual(hits4, hits1, '4-worker interleave finds same hits as single-worker');
    console.log('PASS: multi-worker interleave produces same results as single-worker scan');
  }

  // --- getRerollSlots ---
  {
    const { sx, sy } = getEwSeed('76561198208852417');
    const deck = generatePerkDeck(3280915446, sx, sy);

    assert.deepEqual(getRerollSlots(deck, 0), [], 'numRerolls=0 → empty array');

    const slots1 = getRerollSlots(deck, 1);
    assert.equal(slots1.length, 1, 'numRerolls=1 → 1 slot');
    assert.deepEqual(slots1[0], deck.slice(deck.length - 3), 'reroll slot 1 = last 3 perks');

    const slots2 = getRerollSlots(deck, 2);
    assert.equal(slots2.length, 2, 'numRerolls=2 → 2 slots');
    assert.deepEqual(slots2[0], deck.slice(deck.length - 3), 'slots2[0] = reroll 1 (newest)');
    assert.deepEqual(slots2[1], deck.slice(deck.length - 6, deck.length - 3), 'slots2[1] = reroll 2');

    const slots3 = getRerollSlots(deck, 3);
    assert.equal(slots3.length, 3, 'numRerolls=3 → 3 slots');
    assert.deepEqual(slots3[2], deck.slice(deck.length - 9, deck.length - 6), 'slots3[2] = reroll 3');

    console.log('PASS: getRerollSlots');
  }

  // --- encodeConditions / decodeConditions with rerolls ---
  {
    // rerolls > 0 produces 5-part encoding
    const enc = encodeConditions([
      { perkId: 'PROJECTILE_HOMING', mountain: 1, type: 'exactly', players: 'all', rerolls: 2 },
    ]);
    assert.deepEqual(enc, ['PROJECTILE_HOMING:1:exactly:all:2'], 'rerolls > 0 → 5-part encoding');
    console.log('PASS: encodeConditions with rerolls > 0');
  }

  {
    // Round-trip with rerolls
    const conditions = [
      { perkId: 'STAINLESS_ARMOUR', mountain: 3, type: 'within', players: 'any', rerolls: 3 },
    ];
    const decoded = decodeConditions(encodeConditions(conditions));
    assert.deepEqual(decoded, conditions, 'encode→decode round-trip with rerolls');
    console.log('PASS: encodeConditions/decodeConditions round-trip with rerolls');
  }

  {
    // Legacy 4-part input decodes without rerolls field (backward compat)
    const decoded = decodeConditions(['EXTRA_HP:2:within:any']);
    assert.equal(decoded.length, 1, 'legacy 4-part decodes successfully');
    assert.equal(decoded[0].perkId, 'EXTRA_HP');
    assert.equal(decoded[0].rerolls, undefined, 'legacy 4-part has no rerolls field');
    console.log('PASS: decodeConditions legacy 4-part format (no rerolls)');
  }

  {
    // Invalid rerolls values in 5-part are rejected
    const decoded = decodeConditions([
      'EXTRA_HP:2:within:any:-1',   // negative rerolls
      'EXTRA_HP:2:within:any:abc',  // non-numeric
      'EXTRA_HP:2:within:any:3',    // valid
    ]);
    assert.equal(decoded.length, 1, 'invalid rerolls values filtered out');
    assert.equal(decoded[0].rerolls, 3, 'valid rerolls preserved');
    console.log('PASS: decodeConditions filters invalid rerolls values');
  }

  console.log('\nAll tests passed!');
})().catch(err => { console.error(err); process.exit(1); });
