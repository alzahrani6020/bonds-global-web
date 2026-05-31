/**
 * BondsDB — Client-side IndexedDB wrapper for Bonds calculators
 * All data stays on the user's device. No cloud required.
 * Supports: invoices, scenarios, settings, auto-save, export/import.
 */
(function(global) {
  'use strict';

  var DB_NAME = 'bonds-db';
  var DB_VERSION = 1;
  var STORES = ['invoices', 'scenarios', 'settings', 'autosave'];
  var db = null;

  function openDB() {
    return new Promise(function(resolve, reject) {
      if (db) { resolve(db); return; }
      var req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onerror = function() { reject(req.error); };
      req.onsuccess = function() { db = req.result; resolve(db); };
      req.onupgradeneeded = function(e) {
        var database = e.target.result;
        STORES.forEach(function(store) {
          if (!database.objectStoreNames.contains(store)) {
            database.createObjectStore(store, { keyPath: 'id' });
          }
        });
      };
    });
  }

  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  }

  var BondsDB = {
    init: function() {
      return openDB().then(function() {
        console.log('[BondsDB] Ready');
        return true;
      }).catch(function(e) {
        console.error('[BondsDB] Failed:', e);
        return false;
      });
    },

    // Save or update
    save: function(store, data) {
      return openDB().then(function(database) {
        return new Promise(function(resolve, reject) {
          var tx = database.transaction([store], 'readwrite');
          var os = tx.objectStore(store);
          if (!data.id) data.id = generateId();
          data._updatedAt = new Date().toISOString();
          var req = os.put(data);
          req.onsuccess = function() { resolve(data); };
          req.onerror = function() { reject(req.error); };
        });
      });
    },

    // Get by id
    get: function(store, id) {
      return openDB().then(function(database) {
        return new Promise(function(resolve, reject) {
          var tx = database.transaction([store], 'readonly');
          var req = tx.objectStore(store).get(id);
          req.onsuccess = function() { resolve(req.result || null); };
          req.onerror = function() { reject(req.error); };
        });
      });
    },

    // Get all, sorted by _updatedAt desc
    getAll: function(store) {
      return openDB().then(function(database) {
        return new Promise(function(resolve, reject) {
          var tx = database.transaction([store], 'readonly');
          var req = tx.objectStore(store).getAll();
          req.onsuccess = function() {
            var list = req.result || [];
            list.sort(function(a, b) {
              var ta = a._updatedAt || '';
              var tb = b._updatedAt || '';
              return tb.localeCompare(ta);
            });
            resolve(list);
          };
          req.onerror = function() { reject(req.error); };
        });
      });
    },

    // Delete by id
    delete: function(store, id) {
      return openDB().then(function(database) {
        return new Promise(function(resolve, reject) {
          var tx = database.transaction([store], 'readwrite');
          var req = tx.objectStore(store).delete(id);
          req.onsuccess = function() { resolve(true); };
          req.onerror = function() { reject(req.error); };
        });
      });
    },

    // Auto-save current form state
    autoSave: function(store, key, data) {
      return this.save(store, { id: key, data: data, _type: 'autosave' });
    },

    // Load auto-saved state
    autoLoad: function(store, key) {
      return this.get(store, key).then(function(record) {
        return record ? record.data : null;
      });
    },

    // Export everything as a JSON object
    exportAll: function() {
      var self = this;
      var result = { _meta: { app: 'bonds', version: '1.0', exportedAt: new Date().toISOString() } };
      return Promise.all(STORES.map(function(store) {
        return self.getAll(store).then(function(list) {
          result[store] = list;
        });
      })).then(function() {
        return result;
      });
    },

    // Import from JSON object
    importAll: function(data) {
      var self = this;
      if (!data || typeof data !== 'object') {
        return Promise.reject(new Error('Invalid data'));
      }
      var promises = [];
      STORES.forEach(function(store) {
        if (Array.isArray(data[store])) {
          data[store].forEach(function(item) {
            if (item && item.id) {
              promises.push(self.save(store, item));
            }
          });
        }
      });
      return Promise.all(promises);
    },

    // Download JSON file
    downloadJSON: function(filename, obj) {
      var blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(function() {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
    },

    // Read uploaded JSON file
    readFile: function(file) {
      return new Promise(function(resolve, reject) {
        var reader = new FileReader();
        reader.onload = function(e) {
          try {
            resolve(JSON.parse(e.target.result));
          } catch(err) {
            reject(new Error('Invalid JSON file'));
          }
        };
        reader.onerror = function() { reject(reader.error); };
        reader.readAsText(file);
      });
    },

    // Clear everything (dangerous)
    clearAll: function() {
      return openDB().then(function(database) {
        var promises = STORES.map(function(store) {
          return new Promise(function(resolve, reject) {
            var tx = database.transaction([store], 'readwrite');
            var req = tx.objectStore(store).clear();
            req.onsuccess = function() { resolve(); };
            req.onerror = function() { reject(req.error); };
          });
        });
        return Promise.all(promises);
      });
    }
  };

  // Expose globally
  global.BondsDB = BondsDB;

})(typeof window !== 'undefined' ? window : this);
