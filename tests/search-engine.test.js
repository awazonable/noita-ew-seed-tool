'use strict';
const assert = require('assert').strict;
const calc = require('../perk-calculator.js');
const { checkCondition, checkAllConditions } = require('../search-engine.js');

(async () => {
  await calc.initWasm();

  // Game-verified SteamID64: 76561198208852417 → sx=69329, sy=74177
  const { sx, sy } = calc.getEwSeed('76561198208852417');

  // Pre-generate the three game-verified decks
  const deck1 = calc.generatePerkDeck(3280915446, sx, sy);
  // HM1: [INVISIBILITY, NO_WAND_EDITING, TELEPORTITIS_DODGE]
  const deck2 = calc.generatePerkDeck(11111111, sx, sy);
  // HM1: [STAINLESS_ARMOUR, PROTECTION_EXPLOSION, EXTRA_SHOP_ITEM]
  const deck3 = calc.generatePerkDeck(12345678, sx, sy);
  // HM1: [REVENGE_EXPLOSION, NO_MORE_SHUFFLE, NO_WAND_EDITING]

  // ---- checkCondition: mode='exact' ----
  {
    assert(checkCondition(deck1, { perk: 'INVISIBILITY', mountain: 1, mode: 'exact' }),
      'INVISIBILITY in HM1 exact (ws=3280915446)');
    assert(checkCondition(deck1, { perk: 'NO_WAND_EDITING', mountain: 1, mode: 'exact' }),
      'NO_WAND_EDITING in HM1 exact');
    assert(checkCondition(deck1, { perk: 'TELEPORTITIS_DODGE', mountain: 1, mode: 'exact' }),
      'TELEPORTITIS_DODGE in HM1 exact');
    assert(!checkCondition(deck1, { perk: 'EXTRA_HP', mountain: 1, mode: 'exact' }),
      'EXTRA_HP not in HM1 exact');
    console.log('PASS: checkCondition exact — ws=3280915446 HM1 verified');
  }

  {
    assert(checkCondition(deck2, { perk: 'STAINLESS_ARMOUR', mountain: 1, mode: 'exact' }),
      'STAINLESS_ARMOUR in HM1 exact (ws=11111111)');
    assert(checkCondition(deck2, { perk: 'PROTECTION_EXPLOSION', mountain: 1, mode: 'exact' }),
      'PROTECTION_EXPLOSION in HM1 exact');
    assert(checkCondition(deck2, { perk: 'EXTRA_SHOP_ITEM', mountain: 1, mode: 'exact' }),
      'EXTRA_SHOP_ITEM in HM1 exact');
    console.log('PASS: checkCondition exact — ws=11111111 HM1 verified');
  }

  {
    assert(checkCondition(deck3, { perk: 'REVENGE_EXPLOSION', mountain: 1, mode: 'exact' }),
      'REVENGE_EXPLOSION in HM1 exact (ws=12345678)');
    assert(checkCondition(deck3, { perk: 'NO_MORE_SHUFFLE', mountain: 1, mode: 'exact' }),
      'NO_MORE_SHUFFLE in HM1 exact');
    assert(checkCondition(deck3, { perk: 'NO_WAND_EDITING', mountain: 1, mode: 'exact' }),
      'NO_WAND_EDITING in HM1 exact');
    console.log('PASS: checkCondition exact — ws=12345678 HM1 verified');
  }

  // ---- checkCondition: mode='within' ----
  {
    // INVISIBILITY is in HM1 → matches within HM1, HM2, HM3...
    assert(checkCondition(deck1, { perk: 'INVISIBILITY', mountain: 1, mode: 'within' }),
      'INVISIBILITY within HM1');
    assert(checkCondition(deck1, { perk: 'INVISIBILITY', mountain: 3, mode: 'within' }),
      'INVISIBILITY within HM3 (already in HM1)');
    // A perk not in HM1 must not match within HM1
    const notInHm1 = deck1[3]; // first perk of HM2
    assert(!checkCondition(deck1, { perk: notInHm1, mountain: 1, mode: 'within' }),
      'HM2 perk not within HM1');
    assert(checkCondition(deck1, { perk: notInHm1, mountain: 2, mode: 'within' }),
      'HM2 perk within HM2');
    console.log('PASS: checkCondition within — range boundaries correct');
  }

  // ---- checkCondition: mountain='any' ----
  {
    // A perk definitely in HM1 should match 'any'
    assert(checkCondition(deck1, { perk: 'INVISIBILITY', mountain: 'any', mode: 'exact' }),
      'INVISIBILITY any mountain');
    // A perk not in HM1-7 should not match 'any'
    // Find a perk that only appears in positions 21+ (HM8+)
    const latePerks = new Set(deck1.slice(21));
    const hm1to7 = new Set(deck1.slice(0, 21));
    const onlyLate = [...latePerks].find(p => !hm1to7.has(p));
    if (onlyLate) {
      assert(!checkCondition(deck1, { perk: onlyLate, mountain: 'any', mode: 'exact' }),
        'perk only in HM8+ not matched by any');
    }
    console.log('PASS: checkCondition any mountain');
  }

  // ---- checkAllConditions: AND logic ----
  {
    // All three HM1 perks for ws=3280915446
    assert(checkAllConditions(deck1, [
      { perk: 'INVISIBILITY',      mountain: 1, mode: 'exact' },
      { perk: 'NO_WAND_EDITING',   mountain: 1, mode: 'exact' },
      { perk: 'TELEPORTITIS_DODGE', mountain: 1, mode: 'exact' },
    ]), 'all three HM1 perks match (ws=3280915446)');
    console.log('PASS: checkAllConditions — ws=3280915446 all 3 HM1 perks');
  }

  {
    assert(checkAllConditions(deck2, [
      { perk: 'STAINLESS_ARMOUR',      mountain: 1, mode: 'exact' },
      { perk: 'PROTECTION_EXPLOSION',  mountain: 1, mode: 'exact' },
      { perk: 'EXTRA_SHOP_ITEM',       mountain: 1, mode: 'exact' },
    ]), 'all three HM1 perks match (ws=11111111)');
    console.log('PASS: checkAllConditions — ws=11111111 all 3 HM1 perks');
  }

  {
    assert(checkAllConditions(deck3, [
      { perk: 'REVENGE_EXPLOSION', mountain: 1, mode: 'exact' },
      { perk: 'NO_MORE_SHUFFLE',   mountain: 1, mode: 'exact' },
      { perk: 'NO_WAND_EDITING',   mountain: 1, mode: 'exact' },
    ]), 'all three HM1 perks match (ws=12345678)');
    console.log('PASS: checkAllConditions — ws=12345678 all 3 HM1 perks');
  }

  {
    // AND fails if any condition is not met
    assert(!checkAllConditions(deck1, [
      { perk: 'INVISIBILITY', mountain: 1, mode: 'exact' },
      { perk: 'EXTRA_HP',     mountain: 1, mode: 'exact' }, // not in HM1
    ]), 'AND fails when one condition unmet');
    console.log('PASS: checkAllConditions — AND short-circuits on failure');
  }

  // ---- checkAllConditions: empty conditions always matches ----
  {
    assert(checkAllConditions(deck1, []), 'empty conditions → always true');
    console.log('PASS: checkAllConditions empty conditions');
  }

  // ---- Boundary: positions exactly at mountain boundary ----
  {
    // Deck positions 0,1,2 = HM1; 3,4,5 = HM2
    // deck[3] should be in HM2 but NOT in HM1
    const hm2perk = deck1[3];
    assert(!checkCondition(deck1, { perk: hm2perk, mountain: 1, mode: 'exact' }),
      'HM2[0] not in HM1 exact');
    assert(checkCondition(deck1, { perk: hm2perk, mountain: 2, mode: 'exact' }),
      'HM2[0] in HM2 exact');
    assert(!checkCondition(deck1, { perk: hm2perk, mountain: 1, mode: 'within' }),
      'HM2[0] not within HM1');
    assert(checkCondition(deck1, { perk: hm2perk, mountain: 2, mode: 'within' }),
      'HM2[0] within HM2');
    console.log('PASS: checkCondition mountain boundary positions');
  }

  console.log('\nAll search-engine tests passed!');
})().catch(err => { console.error(err); process.exit(1); });
