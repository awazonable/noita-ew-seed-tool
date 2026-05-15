// WebWorker: Seed search engine
// Loads WASM-based perk calculator and iterates world seeds in chunks.
// Accepts steamIds: string[] (or legacy steamId: string) and checks conditions
// across all players' decks — a condition matches if any player satisfies it.
importScripts('perk-data.js', 'search-engine.js', 'perk-calculator.js');

var CHUNK_SIZE = 5000;
var PROGRESS_EVERY = 100000; // send progress message approximately every N seeds
var HIT_LIMIT = 100;

var _state = null;  // active search state, null when idle
var _running = false; // true while a processChunk setTimeout is scheduled

// _initPromise resolves once WASM is loaded
var _initPromise = initWasm();

function scheduleChunk() {
  if (!_running) {
    _running = true;
    setTimeout(processChunk, 0);
  }
}

function processChunk() {
  _running = false;
  if (!_state || _state.stopped) return;
  if (_state.paused) return; // resume will call scheduleChunk

  var chunkEnd = Math.min(_state.currentSeed + CHUNK_SIZE - 1, _state.seedEnd);

  for (var seed = _state.currentSeed; seed <= chunkEnd; seed++) {
    var decks = _state.ewSeeds.map(function(ew) {
      return generatePerkDeck(seed >>> 0, ew.sx, ew.sy);
    });
    if (checkAllConditionsWithPlayerMode(decks, _state.conditions)) {
      _state.hitCount++;
      self.postMessage({ type: 'hit', seed: seed });
      if (_state.hitCount >= HIT_LIMIT) {
        var totalSoFar = seed + 1 - _state.seedStart;
        self.postMessage({ type: 'done', total: totalSoFar, hits: _state.hitCount, hitLimitReached: true });
        _state = null;
        return;
      }
    }
  }

  var nextSeed = chunkEnd + 1;
  var total = _state.seedEnd - _state.seedStart + 1;
  var progress = nextSeed - _state.seedStart;

  if (nextSeed > _state.seedEnd) {
    self.postMessage({ type: 'progress', current: total, total: total });
    self.postMessage({ type: 'done', total: total, hits: _state.hitCount });
    _state = null;
    return;
  }

  _state.currentSeed = nextSeed;

  if (progress % PROGRESS_EVERY < CHUNK_SIZE) {
    self.postMessage({ type: 'progress', current: progress, total: total });
  }

  scheduleChunk();
}

self.onmessage = function(e) {
  var msg = e.data;

  switch (msg.type) {
    case 'start':
      _initPromise.then(function() {
        // Accept steamIds (array) or legacy steamId (string)
        var ids = msg.steamIds || (msg.steamId ? [msg.steamId] : []);
        _state = {
          ewSeeds:     ids.map(function(sid) { return getEwSeed(sid); }),
          currentSeed: msg.seedStart,
          seedStart:   msg.seedStart,
          seedEnd:     msg.seedEnd,
          conditions:  msg.conditions,
          hitCount:    0,
          paused:      false,
          stopped:     false,
        };
        scheduleChunk();
      });
      break;

    case 'pause':
      if (_state) _state.paused = true;
      break;

    case 'resume':
      if (_state && _state.paused) {
        _state.paused = false;
        scheduleChunk();
      }
      break;

    case 'stop':
      if (_state) {
        _state.stopped = true;
        var progress = _state.currentSeed - _state.seedStart;
        self.postMessage({ type: 'done', total: progress, hits: _state.hitCount });
        _state = null;
      }
      break;
  }
};
