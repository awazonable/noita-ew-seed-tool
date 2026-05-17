// Seed search condition matching — pure functions, no WASM dependency
// Condition: { perk: string, mountain: number|'any', mode: 'exact'|'within' }
//
// mode 'exact':  perk appears in the specific mountain's 3 slots
//                positions: (mountain-1)*3 .. mountain*3-1
// mode 'within': perk appears at least once in HM1 through HMmountain
//                positions: 0 .. mountain*3-1
// mountain 'any': perk appears anywhere in HM1-7 (positions 0-20)

// checkCondition: returns true if deck satisfies one condition.
// condition.rerolls (default 0): also check the last rerolls*3 positions of the deck.
function checkCondition(deck, condition) {
  var perkId  = condition.perk;
  var mountain = condition.mountain;
  var rerolls = condition.rerolls || 0;
  var i, start, end;

  if (mountain === 'any') {
    var limit = Math.min(21, deck.length);
    for (i = 0; i < limit; i++) {
      if (deck[i] === perkId) return true;
    }
  } else {
    var m = mountain; // 1-indexed
    if (condition.mode === 'exact') {
      start = (m - 1) * 3;
      end = m * 3;
    } else {
      // 'within'
      start = 0;
      end = m * 3;
    }
    for (i = start; i < end && i < deck.length; i++) {
      if (deck[i] === perkId) return true;
    }
  }

  if (rerolls > 0) {
    start = Math.max(0, deck.length - rerolls * 3);
    for (i = start; i < deck.length; i++) {
      if (deck[i] === perkId) return true;
    }
  }

  return false;
}

// checkAllConditions: returns true only if all conditions are satisfied (AND)
function checkAllConditions(deck, conditions) {
  for (var i = 0; i < conditions.length; i++) {
    if (!checkCondition(deck, conditions[i])) return false;
  }
  return true;
}

// checkConditionMultiPlayer: condition is satisfied if ANY deck satisfies it
function checkConditionMultiPlayer(decks, condition) {
  for (var i = 0; i < decks.length; i++) {
    if (checkCondition(decks[i], condition)) return true;
  }
  return false;
}

// checkAllConditionsMultiPlayer: all conditions must be satisfied (AND),
// each condition independently satisfied by any player (OR across players)
function checkAllConditionsMultiPlayer(decks, conditions) {
  for (var i = 0; i < conditions.length; i++) {
    if (!checkConditionMultiPlayer(decks, conditions[i])) return false;
  }
  return true;
}

// checkAllConditionsAllPlayers: every player must satisfy all conditions (AND across all)
function checkAllConditionsAllPlayers(decks, conditions) {
  if (conditions.length === 0) return true;
  for (var i = 0; i < decks.length; i++) {
    if (!checkAllConditions(decks[i], conditions)) return false;
  }
  return decks.length > 0;
}

// checkAllConditionsWithPlayerMode: each condition carries its own players mode
// condition.players === 'all': every player must satisfy this condition
// condition.players === 'any' (default): at least one player must satisfy it
function checkAllConditionsWithPlayerMode(decks, conditions) {
  for (var i = 0; i < conditions.length; i++) {
    var cond = conditions[i];
    if (cond.players === 'all') {
      if (decks.length === 0) return false;
      for (var j = 0; j < decks.length; j++) {
        if (!checkCondition(decks[j], cond)) return false;
      }
    } else {
      if (!checkConditionMultiPlayer(decks, cond)) return false;
    }
  }
  return true;
}

if (typeof module !== 'undefined') {
  module.exports = {
    checkCondition, checkAllConditions,
    checkConditionMultiPlayer, checkAllConditionsMultiPlayer,
    checkAllConditionsAllPlayers, checkAllConditionsWithPlayerMode,
  };
}
