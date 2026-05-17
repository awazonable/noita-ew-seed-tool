// Search condition definitions for Seed Search feature
// Each condition: { perkId: string, mountain: number|'any', type: 'exactly'|'within', players: 'all'|'any' }
//
// mountain: 1-7 = specific Holy Mountain, 'any' = any of HM 1-7
// type 'exactly': perk must appear in that specific mountain (positions mountain*3 ± 2)
// type 'within':  perk must appear in HM 1 through HM mountain
// type is ignored when mountain === 'any'
// players 'all': every player must satisfy this condition
// players 'any': at least one player must satisfy this condition (default)

var COND_EXACTLY     = 'exactly';
var COND_WITHIN      = 'within';
var COND_PLAYERS_ALL = 'all';
var COND_PLAYERS_ANY = 'any';

// validateConditions: pure function — returns { valid: bool, warnings: string[] }
// conditions: array of { perkId, mountain, type }
function validateConditions(conditions) {
  if (!Array.isArray(conditions) || conditions.length === 0) {
    return { valid: false, warnings: [] };
  }

  var warnings = [];
  var hasEmpty = false;
  var seen = {};

  for (var i = 0; i < conditions.length; i++) {
    var c = conditions[i];
    if (!c.perkId) {
      hasEmpty = true;
      continue;
    }
    var key = c.perkId + ':' + c.mountain;
    if (seen[key]) {
      warnings.push('Duplicate condition: same perk at same mountain (' + c.perkId + ', HM ' + c.mountain + ')');
    } else {
      seen[key] = true;
    }
  }

  return {
    valid: !hasEmpty,
    warnings: warnings,
  };
}

// toWorkerConditions: converts UI format → worker protocol format
// Input:  [{ perkId, mountain, type: 'exactly'|'within', players: 'all'|'any', rerolls?: number }]
// Output: [{ perk, mountain, mode: 'exact'|'within', players: 'all'|'any'[, rerolls: number] }]
// rerolls is only included in the output when > 0.
function toWorkerConditions(conditions) {
  return conditions.map(function(c) {
    var result = {
      perk:     c.perkId,
      mountain: c.mountain,
      mode:     c.type === 'exactly' ? 'exact' : 'within',
      players:  c.players || COND_PLAYERS_ANY,
    };
    if (c.rerolls > 0) result.rerolls = c.rerolls;
    return result;
  });
}

if (typeof module !== 'undefined') {
  module.exports = { COND_EXACTLY, COND_WITHIN, COND_PLAYERS_ALL, COND_PLAYERS_ANY, validateConditions, toWorkerConditions };
}
