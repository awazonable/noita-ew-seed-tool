'use strict';
const assert = require('assert').strict;
const { COND_EXACTLY, COND_WITHIN, COND_PLAYERS_ALL, COND_PLAYERS_ANY, validateConditions, toWorkerConditions } = require('../search-conditions.js');

// --- Constants ---
{
  assert.equal(COND_EXACTLY,     'exactly', 'COND_EXACTLY value');
  assert.equal(COND_WITHIN,      'within',  'COND_WITHIN value');
  assert.equal(COND_PLAYERS_ALL, 'all',     'COND_PLAYERS_ALL value');
  assert.equal(COND_PLAYERS_ANY, 'any',     'COND_PLAYERS_ANY value');
  console.log('PASS: constants');
}

// --- validateConditions: empty / null inputs ---
{
  const r = validateConditions([]);
  assert.equal(r.valid, false, 'empty array → invalid');
  assert.deepEqual(r.warnings, [], 'empty array → no warnings');
  console.log('PASS: validateConditions empty array');
}

{
  const r = validateConditions(null);
  assert.equal(r.valid, false, 'null → invalid');
  console.log('PASS: validateConditions null');
}

{
  const r = validateConditions('not-an-array');
  assert.equal(r.valid, false, 'non-array → invalid');
  console.log('PASS: validateConditions non-array');
}

// --- validateConditions: single valid condition ---
{
  const r = validateConditions([{ perkId: 'INVISIBILITY', mountain: 1, type: COND_EXACTLY }]);
  assert.equal(r.valid, true, 'single valid condition → valid');
  assert.deepEqual(r.warnings, [], 'single valid condition → no warnings');
  console.log('PASS: validateConditions single valid');
}

// --- validateConditions: condition with empty perkId ---
{
  const r = validateConditions([{ perkId: '', mountain: 1, type: COND_EXACTLY }]);
  assert.equal(r.valid, false, 'empty perkId → invalid');
  assert.deepEqual(r.warnings, [], 'empty perkId → no duplicate warning');
  console.log('PASS: validateConditions empty perkId');
}

{
  // One valid, one empty
  const r = validateConditions([
    { perkId: 'INVISIBILITY', mountain: 1, type: COND_EXACTLY },
    { perkId: '', mountain: 2, type: COND_WITHIN },
  ]);
  assert.equal(r.valid, false, 'any empty perkId → invalid');
  console.log('PASS: validateConditions one empty perkId');
}

// --- validateConditions: duplicate detection ---
{
  const r = validateConditions([
    { perkId: 'INVISIBILITY', mountain: 1, type: COND_EXACTLY },
    { perkId: 'INVISIBILITY', mountain: 1, type: COND_WITHIN },
  ]);
  assert.equal(r.valid, true, 'duplicate conditions are still valid (just warned)');
  assert.equal(r.warnings.length, 1, 'one duplicate warning');
  assert(/INVISIBILITY/.test(r.warnings[0]), 'warning mentions perkId');
  console.log('PASS: validateConditions duplicate same perk+mountain');
}

{
  // Same perk, different mountain → no duplicate
  const r = validateConditions([
    { perkId: 'INVISIBILITY', mountain: 1, type: COND_EXACTLY },
    { perkId: 'INVISIBILITY', mountain: 2, type: COND_EXACTLY },
  ]);
  assert.equal(r.valid, true, 'same perk different mountain → valid');
  assert.deepEqual(r.warnings, [], 'different mountain → no warning');
  console.log('PASS: validateConditions same perk different mountain');
}

{
  // Different perk, same mountain → no duplicate
  const r = validateConditions([
    { perkId: 'INVISIBILITY', mountain: 1, type: COND_EXACTLY },
    { perkId: 'TELEPORTITIS', mountain: 1, type: COND_EXACTLY },
  ]);
  assert.equal(r.valid, true, 'different perks same mountain → valid');
  assert.deepEqual(r.warnings, [], 'different perks → no warning');
  console.log('PASS: validateConditions different perk same mountain');
}

{
  // Multiple duplicates
  const r = validateConditions([
    { perkId: 'INVISIBILITY', mountain: 1, type: COND_EXACTLY },
    { perkId: 'INVISIBILITY', mountain: 1, type: COND_WITHIN },
    { perkId: 'TELEPORTITIS', mountain: 3, type: COND_WITHIN },
    { perkId: 'TELEPORTITIS', mountain: 3, type: COND_WITHIN },
  ]);
  assert.equal(r.warnings.length, 2, 'two duplicate pairs → two warnings');
  console.log('PASS: validateConditions multiple duplicates');
}

// --- validateConditions: 'any' mountain ---
{
  const r = validateConditions([
    { perkId: 'INVISIBILITY', mountain: 'any', type: COND_WITHIN },
  ]);
  assert.equal(r.valid, true, 'any mountain → valid');
  assert.deepEqual(r.warnings, [], 'any mountain → no warnings');
  console.log('PASS: validateConditions any mountain');
}

{
  // Same perk, both 'any' → duplicate
  const r = validateConditions([
    { perkId: 'INVISIBILITY', mountain: 'any', type: COND_EXACTLY },
    { perkId: 'INVISIBILITY', mountain: 'any', type: COND_WITHIN },
  ]);
  assert.equal(r.warnings.length, 1, 'same perk twice on any → duplicate warning');
  console.log('PASS: validateConditions duplicate on any mountain');
}

// --- validateConditions: multiple valid conditions (AND) ---
{
  const r = validateConditions([
    { perkId: 'INVISIBILITY', mountain: 1, type: COND_EXACTLY },
    { perkId: 'TELEPORTITIS', mountain: 2, type: COND_WITHIN },
    { perkId: 'STAINLESS_ARMOUR', mountain: 'any', type: COND_WITHIN },
  ]);
  assert.equal(r.valid, true, 'multiple valid conditions → valid');
  assert.deepEqual(r.warnings, [], 'no duplicates → no warnings');
  console.log('PASS: validateConditions multiple valid AND conditions');
}

// --- toWorkerConditions ---
{
  const input = [
    { perkId: 'INVISIBILITY', mountain: 1, type: 'exactly' },
    { perkId: 'EXTRA_HP',     mountain: 3, type: 'within'  },
    { perkId: 'STAINLESS_ARMOUR', mountain: 'any', type: 'within' },
  ];
  const out = toWorkerConditions(input);
  assert.equal(out.length, 3, 'output length matches input');
  assert.deepEqual(out[0], { perk: 'INVISIBILITY',    mountain: 1,     mode: 'exact',  players: 'any' }, 'exactly → exact, players defaults to any');
  assert.deepEqual(out[1], { perk: 'EXTRA_HP',        mountain: 3,     mode: 'within', players: 'any' }, 'within → within, players defaults to any');
  assert.deepEqual(out[2], { perk: 'STAINLESS_ARMOUR', mountain: 'any', mode: 'within', players: 'any' }, 'any mountain preserved, players defaults to any');
  console.log('PASS: toWorkerConditions basic conversion');
}

{
  assert.deepEqual(toWorkerConditions([]), [], 'empty array → empty');
  console.log('PASS: toWorkerConditions empty');
}

// --- toWorkerConditions: players field ---
{
  const input = [
    { perkId: 'INVISIBILITY', mountain: 1, type: 'exactly', players: 'all' },
    { perkId: 'EXTRA_HP',     mountain: 2, type: 'within',  players: 'any' },
    { perkId: 'TELEPORTITIS', mountain: 3, type: 'exactly' }, // players omitted → defaults to 'any'
  ];
  const out = toWorkerConditions(input);
  assert.equal(out[0].players, 'all',  'players: all preserved');
  assert.equal(out[1].players, 'any',  'players: any preserved');
  assert.equal(out[2].players, 'any',  'players omitted → defaults to any');
  console.log('PASS: toWorkerConditions players field');
}

console.log('\nAll search-conditions tests passed!');
