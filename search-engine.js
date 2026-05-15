// Seed search condition matching — pure functions, no WASM dependency
// Condition: { perk: string, mountain: number|'any', mode: 'exact'|'within' }
//
// mode 'exact':  perk appears in the specific mountain's 3 slots
//                positions: (mountain-1)*3 .. mountain*3-1
// mode 'within': perk appears at least once in HM1 through HMmountain
//                positions: 0 .. mountain*3-1
// mountain 'any': perk appears anywhere in HM1-7 (positions 0-20)

// checkCondition: returns true if deck satisfies one condition
function checkCondition(deck, condition) {
  var perkId = condition.perk;
  var mountain = condition.mountain;

  if (mountain === 'any') {
    var limit = Math.min(21, deck.length);
    for (var i = 0; i < limit; i++) {
      if (deck[i] === perkId) return true;
    }
    return false;
  }

  var m = mountain; // 1-indexed
  if (condition.mode === 'exact') {
    var start = (m - 1) * 3;
    var end = m * 3;
    for (var i = start; i < end && i < deck.length; i++) {
      if (deck[i] === perkId) return true;
    }
    return false;
  } else {
    // 'within'
    var end = m * 3;
    for (var i = 0; i < end && i < deck.length; i++) {
      if (deck[i] === perkId) return true;
    }
    return false;
  }
}

// checkAllConditions: returns true only if all conditions are satisfied (AND)
function checkAllConditions(deck, conditions) {
  for (var i = 0; i < conditions.length; i++) {
    if (!checkCondition(deck, conditions[i])) return false;
  }
  return true;
}

if (typeof module !== 'undefined') {
  module.exports = { checkCondition, checkAllConditions };
}
