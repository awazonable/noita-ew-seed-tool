// WebWorker: Seed search engine
// Loads WASM-based perk calculator and iterates world seeds in chunks.
// Accepts steamIds: string[] (or legacy steamId: string) and checks conditions
// across all players' decks — a condition matches if any player satisfies it.
// Supports multi-worker interleaved distribution via workerIndex / numWorkers.
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

  var step = _state.numWorkers;
  var processed = 0;
  var seed = _state.currentSeed;

  while (seed <= _state.seedEnd && processed < CHUNK_SIZE) {
    processed++;
    var decks = _state.ewSeeds.map(function(ew) {
      return generatePerkDeck(seed >>> 0, ew.sx, ew.sy);
    });
    if (checkAllConditionsWithPlayerMode(decks, _state.conditions)) {
      _state.hitCount++;
      self.postMessage({ type: 'hit', seed: seed });
      if (_state.hitCount >= HIT_LIMIT) {
        _state.processedCount += processed;
        self.postMessage({ type: 'done', total: _state.processedCount, hits: _state.hitCount, hitLimitReached: true });
        _state = null;
        return;
      }
    }
    seed += step;
  }

  _state.processedCount += processed;

  var total = _state.totalSeeds;
  var progress = _state.processedCount;

  if (seed > _state.seedEnd) {
    self.postMessage({ type: 'progress', current: total, total: total });
    self.postMessage({ type: 'done', total: _state.processedCount, hits: _state.hitCount });
    _state = null;
    return;
  }

  _state.currentSeed = seed;

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
        var workerIndex = msg.workerIndex || 0;
        var numWorkers  = msg.numWorkers  || 1;
        var initialSeed = msg.seedStart + workerIndex;
        // Number of seeds this worker will process (interleaved)
        var totalSeeds = initialSeed <= msg.seedEnd
          ? Math.floor((msg.seedEnd - initialSeed) / numWorkers) + 1
          : 0;
        _state = {
          ewSeeds:        ids.map(function(sid) { return getEwSeed(sid); }),
          currentSeed:    initialSeed,
          seedStart:      msg.seedStart,
          seedEnd:        msg.seedEnd,
          numWorkers:     numWorkers,
          totalSeeds:     totalSeeds,
          processedCount: 0,
          conditions:     msg.conditions,
          hitCount:       0,
          paused:         false,
          stopped:        false,
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
        self.postMessage({ type: 'done', total: _state.processedCount, hits: _state.hitCount });
        _state = null;
      }
      break;
  }
};
