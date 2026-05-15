'use strict';
const assert = require('assert').strict;
const calc = require('../perk-calculator.js');
const { checkCondition, checkAllConditions, checkConditionMultiPlayer, checkAllConditionsMultiPlayer, checkAllConditionsAllPlayers, checkAllConditionsWithPlayerMode } = require('../search-engine.js');

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

  // ---- checkConditionMultiPlayer ----
  {
    // Player 1 has INVISIBILITY in HM1 (ws=3280915446)
    // Player 2 has STAINLESS_ARMOUR in HM1 (ws=11111111)
    const ew2 = calc.getEwSeed('76561198208852417'); // same player for simplicity
    const deckA = deck1; // INVISIBILITY in HM1
    const deckB = deck2; // STAINLESS_ARMOUR in HM1
    const decks = [deckA, deckB];

    // Condition satisfied by player 1
    assert(checkConditionMultiPlayer(decks, { perk: 'INVISIBILITY', mountain: 1, mode: 'exact' }),
      'INVISIBILITY: satisfied by player 1');
    // Condition satisfied by player 2
    assert(checkConditionMultiPlayer(decks, { perk: 'STAINLESS_ARMOUR', mountain: 1, mode: 'exact' }),
      'STAINLESS_ARMOUR: satisfied by player 2');
    // Condition satisfied by neither
    assert(!checkConditionMultiPlayer(decks, { perk: 'EXTRA_HP', mountain: 1, mode: 'exact' }),
      'EXTRA_HP in HM1: satisfied by neither');
    // Single-deck edge case
    assert(checkConditionMultiPlayer([deck1], { perk: 'INVISIBILITY', mountain: 1, mode: 'exact' }),
      'single-deck multi-player behaves like single-player');
    console.log('PASS: checkConditionMultiPlayer basic');
  }

  // ---- checkAllConditionsMultiPlayer ----
  {
    const deckA = deck1; // ws=3280915446: HM1=[INVISIBILITY,NO_WAND_EDITING,TELEPORTITIS_DODGE]
    const deckB = deck2; // ws=11111111: HM1=[STAINLESS_ARMOUR,PROTECTION_EXPLOSION,EXTRA_SHOP_ITEM]
    const decks = [deckA, deckB];

    // Both conditions satisfied collectively (each by a different deck)
    assert(checkAllConditionsMultiPlayer(decks, [
      { perk: 'INVISIBILITY',    mountain: 1, mode: 'exact' }, // → deckA
      { perk: 'STAINLESS_ARMOUR', mountain: 1, mode: 'exact' }, // → deckB
    ]), 'cross-player condition satisfaction');

    // Fails if one condition is not met by any player
    assert(!checkAllConditionsMultiPlayer(decks, [
      { perk: 'INVISIBILITY',  mountain: 1, mode: 'exact' }, // → deckA ✓
      { perk: 'EXTRA_HP',      mountain: 1, mode: 'exact' }, // ✗
    ]), 'fails when one condition not met by any player');

    // Empty conditions always matches
    assert(checkAllConditionsMultiPlayer(decks, []),
      'empty conditions → always true (multi-player)');

    // Empty decks array: no player satisfies any condition → fails
    assert(!checkAllConditionsMultiPlayer([], [
      { perk: 'INVISIBILITY', mountain: 1, mode: 'exact' },
    ]), 'empty decks + non-empty conditions → false');

    // Single-deck behaves like single-player
    assert(checkAllConditionsMultiPlayer([deck1], [
      { perk: 'INVISIBILITY',      mountain: 1, mode: 'exact' },
      { perk: 'NO_WAND_EDITING',   mountain: 1, mode: 'exact' },
      { perk: 'TELEPORTITIS_DODGE', mountain: 1, mode: 'exact' },
    ]), 'single deck: all HM1 perks for ws=3280915446');

    console.log('PASS: checkAllConditionsMultiPlayer');
  }

  // ---- checkAllConditionsAllPlayers ----
  {
    const deckA = deck1; // ws=3280915446: HM1=[INVISIBILITY,NO_WAND_EDITING,TELEPORTITIS_DODGE]
    const deckB = deck2; // ws=11111111: HM1=[STAINLESS_ARMOUR,PROTECTION_EXPLOSION,EXTRA_SHOP_ITEM]
    const decks = [deckA, deckB];

    // Both players satisfy all conditions independently
    assert(checkAllConditionsAllPlayers([deck1], [
      { perk: 'INVISIBILITY',       mountain: 1, mode: 'exact' },
      { perk: 'NO_WAND_EDITING',    mountain: 1, mode: 'exact' },
      { perk: 'TELEPORTITIS_DODGE', mountain: 1, mode: 'exact' },
    ]), 'single player satisfies all conditions');

    // One player does not satisfy all conditions → fails
    assert(!checkAllConditionsAllPlayers(decks, [
      { perk: 'INVISIBILITY', mountain: 1, mode: 'exact' }, // deckA ✓, deckB ✗
    ]), 'fails when any player misses a condition');

    // Both players share the same perk in HM1 — deck1 and deck3 both have NO_WAND_EDITING
    assert(checkAllConditionsAllPlayers([deck1, deck3], [
      { perk: 'NO_WAND_EDITING', mountain: 1, mode: 'exact' },
    ]), 'all players have NO_WAND_EDITING in HM1');

    // Empty conditions always matches (regardless of decks)
    assert(checkAllConditionsAllPlayers(decks, []),
      'empty conditions → always true (all-players)');
    assert(checkAllConditionsAllPlayers([], []),
      'empty decks + empty conditions → always true');

    // Empty decks + non-empty conditions → false (no players to satisfy)
    assert(!checkAllConditionsAllPlayers([], [
      { perk: 'INVISIBILITY', mountain: 1, mode: 'exact' },
    ]), 'empty decks + non-empty conditions → false');

    console.log('PASS: checkAllConditionsAllPlayers');
  }

  // ---- checkAllConditionsWithPlayerMode ----
  {
    const deckA = deck1; // ws=3280915446: HM1=[INVISIBILITY,NO_WAND_EDITING,TELEPORTITIS_DODGE]
    const deckB = deck2; // ws=11111111: HM1=[STAINLESS_ARMOUR,PROTECTION_EXPLOSION,EXTRA_SHOP_ITEM]
    const decks = [deckA, deckB];

    // players='any': satisfied if any player has it (OR)
    assert(checkAllConditionsWithPlayerMode(decks, [
      { perk: 'INVISIBILITY', mountain: 1, mode: 'exact', players: 'any' },
    ]), 'any: deckA has INVISIBILITY → match');
    assert(checkAllConditionsWithPlayerMode(decks, [
      { perk: 'STAINLESS_ARMOUR', mountain: 1, mode: 'exact', players: 'any' },
    ]), 'any: deckB has STAINLESS_ARMOUR → match');
    assert(!checkAllConditionsWithPlayerMode(decks, [
      { perk: 'EXTRA_HP', mountain: 1, mode: 'exact', players: 'any' },
    ]), 'any: no player has EXTRA_HP → no match');

    // players='all': every player must have it (AND)
    assert(!checkAllConditionsWithPlayerMode(decks, [
      { perk: 'INVISIBILITY', mountain: 1, mode: 'exact', players: 'all' },
    ]), 'all: deckB lacks INVISIBILITY → no match');
    assert(checkAllConditionsWithPlayerMode([deck1, deck3], [
      { perk: 'NO_WAND_EDITING', mountain: 1, mode: 'exact', players: 'all' },
    ]), 'all: both deck1 and deck3 have NO_WAND_EDITING → match');

    // Mixed: one condition 'any', one 'all'
    assert(checkAllConditionsWithPlayerMode([deck1, deck3], [
      { perk: 'INVISIBILITY',    mountain: 1, mode: 'exact', players: 'any' }, // deck1 ✓
      { perk: 'NO_WAND_EDITING', mountain: 1, mode: 'exact', players: 'all' }, // both ✓
    ]), 'mixed: any+all both satisfied');
    assert(!checkAllConditionsWithPlayerMode(decks, [
      { perk: 'INVISIBILITY',    mountain: 1, mode: 'exact', players: 'any' }, // deck1 ✓
      { perk: 'NO_WAND_EDITING', mountain: 1, mode: 'exact', players: 'all' }, // deck2 ✗
    ]), 'mixed: all condition fails when a player lacks perk');

    // Empty conditions always match
    assert(checkAllConditionsWithPlayerMode(decks, []),
      'empty conditions → always true');
    assert(checkAllConditionsWithPlayerMode([], []),
      'empty decks + empty conditions → true');

    // Empty decks with non-empty conditions
    assert(!checkAllConditionsWithPlayerMode([], [
      { perk: 'INVISIBILITY', mountain: 1, mode: 'exact', players: 'any' },
    ]), 'empty decks + any condition → false');
    assert(!checkAllConditionsWithPlayerMode([], [
      { perk: 'INVISIBILITY', mountain: 1, mode: 'exact', players: 'all' },
    ]), 'empty decks + all condition → false');

    // players defaults to 'any' when omitted
    assert(checkAllConditionsWithPlayerMode([deck1], [
      { perk: 'INVISIBILITY', mountain: 1, mode: 'exact' }, // no players field
    ]), 'players omitted → defaults to any');

    console.log('PASS: checkAllConditionsWithPlayerMode');
  }

  // ---- Regression: issue #30 — PROJECTILE_HOMING "All Players" at seed 7 ----
  // Two players: 76561198208852417 and 76561198900355280
  // At seed 7: Player1 HM1=[ABILITY_ACTIONS_MATERIALIZED,REMOVE_FOG_OF_WAR,FASTER_WANDS]
  //            Player2 HM1=[PROJECTILE_HOMING,FOOD_CLOCK,PROTECTION_MELEE]
  //            Player2 HM2=[PROTECTION_RADIOACTIVITY,UNLIMITED_SPELLS,STAINLESS_ARMOUR]
  {
    const ew2 = calc.getEwSeed('76561198900355280'); // sx=79880, sy=565456
    const deck1_s7 = calc.generatePerkDeck(7, sx, sy);       // Player 1
    const deck2_s7 = calc.generatePerkDeck(7, ew2.sx, ew2.sy); // Player 2
    const decks_s7 = [deck1_s7, deck2_s7];

    // Verify deck contents match investigation
    assert(!checkCondition(deck1_s7, { perk: 'PROJECTILE_HOMING', mountain: 1, mode: 'exact' }),
      'Player 1 does NOT have PROJECTILE_HOMING in HM1 at seed 7');
    assert(checkCondition(deck2_s7, { perk: 'PROJECTILE_HOMING', mountain: 1, mode: 'exact' }),
      'Player 2 has PROJECTILE_HOMING in HM1 at seed 7');
    assert(checkCondition(deck2_s7, { perk: 'UNLIMITED_SPELLS', mountain: 2, mode: 'exact' }),
      'Player 2 has UNLIMITED_SPELLS in HM2 at seed 7');

    // 'all players' on PROJECTILE_HOMING → false (Player 1 lacks it)
    assert(!checkAllConditionsWithPlayerMode(decks_s7, [
      { perk: 'PROJECTILE_HOMING', mountain: 1, mode: 'exact', players: 'all' },
      { perk: 'UNLIMITED_SPELLS',  mountain: 2, mode: 'exact', players: 'any' },
    ]), 'regression #30: seed 7 must NOT hit with PROJECTILE_HOMING all + UNLIMITED_SPELLS any');

    // 'any player' on PROJECTILE_HOMING → true (Player 2 has it)
    assert(checkAllConditionsWithPlayerMode(decks_s7, [
      { perk: 'PROJECTILE_HOMING', mountain: 1, mode: 'exact', players: 'any' },
      { perk: 'UNLIMITED_SPELLS',  mountain: 2, mode: 'exact', players: 'any' },
    ]), 'seed 7 SHOULD hit with PROJECTILE_HOMING any + UNLIMITED_SPELLS any');

    console.log('PASS: regression #30 — PROJECTILE_HOMING All Players seed 7');
  }

  console.log('\nAll search-engine tests passed!');
})().catch(err => { console.error(err); process.exit(1); });
