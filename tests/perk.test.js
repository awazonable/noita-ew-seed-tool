'use strict';
const assert = require('assert').strict;
const calc = require('../perk-calculator.js');
const { PERK_POOL, PERK_NAME_MAP } = require('../perk-data.js');

(async () => {
  await calc.initWasm();

  const {
    buildPerkDeck, getPerksPerMountain, computeOffsets,
    getEwSeed, generatePerkDeck, getHolyMountainPerks, parseUrlParams, buildShareUrl,
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

  console.log('\nAll tests passed!');
})().catch(err => { console.error(err); process.exit(1); });
