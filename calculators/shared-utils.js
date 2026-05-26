/**
 * Bonds Calculator Shared Utilities
 * - debounce/throttle
 * - memoization
 * - IndexedDB helpers (via idb-keyval)
 */

// ===== 1. Debounce =====
function debounce(fn, delay) {
  var timer;
  return function() {
    var args = arguments;
    var ctx = this;
    clearTimeout(timer);
    timer = setTimeout(function() { fn.apply(ctx, args); }, delay);
  };
}

// ===== 2. Memoization =====
function createMemo() {
  var cache = new Map();
  return {
    get: function(key) { return cache.get(key); },
    set: function(key, val) { cache.set(key, val); },
    has: function(key) { return cache.has(key); },
    clear: function() { cache.clear(); },
    key: function(inputs) { return JSON.stringify(inputs); }
  };
}

// ===== 3. IndexedDB helpers (using idb-keyval from CDN) =====
var _idbReady = false;
var _idbSet, _idbGet, _idbKeys, _idbDel;

function _loadIdb() {
  if (_idbReady) return Promise.resolve();
  return new Promise(function(resolve, reject) {
    var script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/idb-keyval@6.2.1/dist/umd.js';
    script.onload = function() {
      _idbSet = idbKeyval.set;
      _idbGet = idbKeyval.get;
      _idbKeys = idbKeyval.keys;
      _idbDel = idbKeyval.del;
      _idbReady = true;
      resolve();
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

var _dbCache = {};

function dbSet(key, value) {
  _dbCache[key] = value;
  return _loadIdb().then(function() { return _idbSet(key, value); });
}

function dbGet(key) {
  if (_dbCache.hasOwnProperty(key)) return Promise.resolve(_dbCache[key]);
  return _loadIdb().then(function() {
    return _idbGet(key).then(function(val) {
      if (val !== undefined) _dbCache[key] = val;
      return val;
    });
  });
}

function dbKeys() {
  return _loadIdb().then(function() { return _idbKeys(); });
}

function dbDel(key) {
  delete _dbCache[key];
  return _loadIdb().then(function() { return _idbDel(key); });
}

// ===== 4. Dynamic library loader =====
function loadLib(url, globalName) {
  return new Promise(function(resolve, reject) {
    if (globalName && typeof window[globalName] !== 'undefined') {
      resolve(window[globalName]);
      return;
    }
    var script = document.createElement('script');
    script.src = url;
    script.onload = function() {
      resolve(globalName ? window[globalName] : undefined);
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

// ===== 5. Virtual scroll helper =====
function createVirtualScroll(container, rowHeight, renderFn, totalCount) {
  var buffer = 5;
  var scrollTop = 0;
  var viewportHeight = container.clientHeight;

  function update() {
    scrollTop = container.scrollTop;
    viewportHeight = container.clientHeight;
    var startIdx = Math.max(0, Math.floor(scrollTop / rowHeight) - buffer);
    var endIdx = Math.min(totalCount, Math.ceil((scrollTop + viewportHeight) / rowHeight) + buffer);
    renderFn(startIdx, endIdx);
  }

  container.addEventListener('scroll', debounce(update, 16));
  update();
  return { update: update };
}

// ===== 6. CSS contain for heavy sections =====
function applyContain(selector) {
  var els = document.querySelectorAll(selector);
  for (var i = 0; i < els.length; i++) {
    els[i].style.contain = 'layout paint style';
  }
}
