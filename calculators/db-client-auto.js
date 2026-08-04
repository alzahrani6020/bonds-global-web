/**
 * BondsDB Auto — Universal calculator auto-save, export, import
 * Usage: <script src="db-client-auto.js"></script> in any calculator page.
 * Automatically detects inputs, saves to IndexedDB, adds export/import UI.
 */
(function() {
  'use strict';

  // Wait for BondsDB to be available
  function waitForDB(maxAttempts, cb) {
    var attempts = 0;
    var timer = setInterval(function() {
      attempts++;
      if (typeof BondsDB !== 'undefined') {
        clearInterval(timer);
        cb(true);
      } else if (attempts >= maxAttempts) {
        clearInterval(timer);
        cb(false);
      }
    }, 100);
  }

  function getPageKey() {
    return 'auto-' + location.pathname.replace(/[^a-zA-Z0-9]/g, '_');
  }

  function getAllInputs() {
    return document.querySelectorAll('input:not([type="file"]):not([type="hidden"]), select, textarea');
  }

  function collectFormData() {
    var data = {};
    getAllInputs().forEach(function(el) {
      if (el.id) {
        data[el.id] = el.type === 'checkbox' ? el.checked : el.value;
      }
    });
    return data;
  }

  function restoreFormData(data) {
    if (!data) return;
    getAllInputs().forEach(function(el) {
      if (el.id && data[el.id] !== undefined) {
        if (el.type === 'checkbox') el.checked = data[el.id];
        else el.value = data[el.id];
      }
    });
  }

  function triggerChangeEvents() {
    getAllInputs().forEach(function(el) {
      var evt = document.createEvent('HTMLEvents');
      evt.initEvent('change', true, false);
      el.dispatchEvent(evt);
    });
  }

  function createUI() {
    var isRTL = document.dir === 'rtl' || document.documentElement.lang === 'ar';
    var t = {
      save: isRTL ? "<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 36 36\"><path fill=\"#31373D\" d=\"M4 36s-4 0-4-4V4s0-4 4-4h26c1 0 2 1 2 1l3 3s1 1 1 2v26s0 4-4 4H4z\"/><path fill=\"#55ACEE\" d=\"M5 19v-1s0-2 2-2h21c2 0 2 2 2 2v1H5z\"/><path fill=\"#E1E8ED\" d=\"M5 32.021V19h25v13s0 2-2 2H7c-2 0-2-1.979-2-1.979zM10 3s0-1 1-1h18c1.048 0 1 1 1 1v10s0 1-1 1H11s-1 0-1-1V3zm12 10h5V3h-5v10z\"/></svg> حفظ النتيجة" : "<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 36 36\"><path fill=\"#31373D\" d=\"M4 36s-4 0-4-4V4s0-4 4-4h26c1 0 2 1 2 1l3 3s1 1 1 2v26s0 4-4 4H4z\"/><path fill=\"#55ACEE\" d=\"M5 19v-1s0-2 2-2h21c2 0 2 2 2 2v1H5z\"/><path fill=\"#E1E8ED\" d=\"M5 32.021V19h25v13s0 2-2 2H7c-2 0-2-1.979-2-1.979zM10 3s0-1 1-1h18c1.048 0 1 1 1 1v10s0 1-1 1H11s-1 0-1-1V3zm12 10h5V3h-5v10z\"/></svg> Save Result",
      export: isRTL ? "<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 36 36\"><path fill=\"#D99E82\" d=\"M36 32c0 2.209-1.791 4-4 4H4c-2.209 0-4-1.791-4-4v-9c0-2.209.791-3 3-3h30c2.209 0 3 .791 3 3v9z\"/><path fill=\"#662113\" d=\"M25 20c0 3.866-3.134 7-7 7s-7-3.134-7-7h14z\"/><path fill=\"#C1694F\" d=\"M4 36h28c2.209 0 4-1.791 4-4H0c0 2.209 1.791 4 4 4z\"/><path fill=\"#77B255\" d=\"M26.716 8h-4.783V2c0-1.105-.896-2-2-2h-4.001c-1.104 0-1.999.896-1.999 2v6H9.148c-1.223 0-1.516.623-.651 1.489l7.863 7.863c.865.865 2.28.865 3.146 0l7.863-7.863C28.232 8.623 27.94 8 26.716 8z\"/></svg> تصدير البيانات" : "<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 36 36\"><path fill=\"#D99E82\" d=\"M36 32c0 2.209-1.791 4-4 4H4c-2.209 0-4-1.791-4-4v-9c0-2.209.791-3 3-3h30c2.209 0 3 .791 3 3v9z\"/><path fill=\"#662113\" d=\"M25 20c0 3.866-3.134 7-7 7s-7-3.134-7-7h14z\"/><path fill=\"#C1694F\" d=\"M4 36h28c2.209 0 4-1.791 4-4H0c0 2.209 1.791 4 4 4z\"/><path fill=\"#77B255\" d=\"M26.716 8h-4.783V2c0-1.105-.896-2-2-2h-4.001c-1.104 0-1.999.896-1.999 2v6H9.148c-1.223 0-1.516.623-.651 1.489l7.863 7.863c.865.865 2.28.865 3.146 0l7.863-7.863C28.232 8.623 27.94 8 26.716 8z\"/></svg> Export Data",
      import: isRTL ? "<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 36 36\"><path fill=\"#D99E82\" d=\"M36 32c0 2.209-1.791 4-4 4H4c-2.209 0-4-1.791-4-4v-9c0-2.209.791-3 3-3h30c2.209 0 3 .791 3 3v9z\"/><path fill=\"#662113\" d=\"M25 20c0 3.866-3.134 7-7 7s-7-3.134-7-7h14z\"/><path fill=\"#C1694F\" d=\"M4 36h28c2.209 0 4-1.791 4-4H0c0 2.209 1.791 4 4 4z\"/><path fill=\"#DD2E44\" d=\"M27.435 8.511L19.572.648c-.864-.865-2.28-.865-3.145 0L8.564 8.511C7.7 9.377 7.993 10 9.216 10H14v6c0 1.104.896 2 2 2h4c1.104 0 2-.896 2-2v-6h4.784c1.223 0 1.516-.623.651-1.489z\"/></svg> استيراد البيانات" : "<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 36 36\"><path fill=\"#D99E82\" d=\"M36 32c0 2.209-1.791 4-4 4H4c-2.209 0-4-1.791-4-4v-9c0-2.209.791-3 3-3h30c2.209 0 3 .791 3 3v9z\"/><path fill=\"#662113\" d=\"M25 20c0 3.866-3.134 7-7 7s-7-3.134-7-7h14z\"/><path fill=\"#C1694F\" d=\"M4 36h28c2.209 0 4-1.791 4-4H0c0 2.209 1.791 4 4 4z\"/><path fill=\"#DD2E44\" d=\"M27.435 8.511L19.572.648c-.864-.865-2.28-.865-3.145 0L8.564 8.511C7.7 9.377 7.993 10 9.216 10H14v6c0 1.104.896 2 2 2h4c1.104 0 2-.896 2-2v-6h4.784c1.223 0 1.516-.623.651-1.489z\"/></svg> Import Data",
      saved: isRTL ? "<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 36 36\"><path fill=\"#77B255\" d=\"M36 32c0 2.209-1.791 4-4 4H4c-2.209 0-4-1.791-4-4V4c0-2.209 1.791-4 4-4h28c2.209 0 4 1.791 4 4v28z\"/><path fill=\"#FFF\" d=\"M29.28 6.362c-1.156-.751-2.704-.422-3.458.736L14.936 23.877l-5.029-4.65c-1.014-.938-2.596-.875-3.533.138-.937 1.014-.875 2.596.139 3.533l7.209 6.666c.48.445 1.09.665 1.696.665.673 0 1.534-.282 2.099-1.139.332-.506 12.5-19.27 12.5-19.27.751-1.159.421-2.707-.737-3.458z\"/></svg> تم الحفظ" : "<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 36 36\"><path fill=\"#77B255\" d=\"M36 32c0 2.209-1.791 4-4 4H4c-2.209 0-4-1.791-4-4V4c0-2.209 1.791-4 4-4h28c2.209 0 4 1.791 4 4v28z\"/><path fill=\"#FFF\" d=\"M29.28 6.362c-1.156-.751-2.704-.422-3.458.736L14.936 23.877l-5.029-4.65c-1.014-.938-2.596-.875-3.533.138-.937 1.014-.875 2.596.139 3.533l7.209 6.666c.48.445 1.09.665 1.696.665.673 0 1.534-.282 2.099-1.139.332-.506 12.5-19.27 12.5-19.27.751-1.159.421-2.707-.737-3.458z\"/></svg> Saved",
      exported: isRTL ? "<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 36 36\"><path fill=\"#77B255\" d=\"M36 32c0 2.209-1.791 4-4 4H4c-2.209 0-4-1.791-4-4V4c0-2.209 1.791-4 4-4h28c2.209 0 4 1.791 4 4v28z\"/><path fill=\"#FFF\" d=\"M29.28 6.362c-1.156-.751-2.704-.422-3.458.736L14.936 23.877l-5.029-4.65c-1.014-.938-2.596-.875-3.533.138-.937 1.014-.875 2.596.139 3.533l7.209 6.666c.48.445 1.09.665 1.696.665.673 0 1.534-.282 2.099-1.139.332-.506 12.5-19.27 12.5-19.27.751-1.159.421-2.707-.737-3.458z\"/></svg> تم التصدير" : "<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 36 36\"><path fill=\"#77B255\" d=\"M36 32c0 2.209-1.791 4-4 4H4c-2.209 0-4-1.791-4-4V4c0-2.209 1.791-4 4-4h28c2.209 0 4 1.791 4 4v28z\"/><path fill=\"#FFF\" d=\"M29.28 6.362c-1.156-.751-2.704-.422-3.458.736L14.936 23.877l-5.029-4.65c-1.014-.938-2.596-.875-3.533.138-.937 1.014-.875 2.596.139 3.533l7.209 6.666c.48.445 1.09.665 1.696.665.673 0 1.534-.282 2.099-1.139.332-.506 12.5-19.27 12.5-19.27.751-1.159.421-2.707-.737-3.458z\"/></svg> Exported",
      imported: isRTL ? "<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 36 36\"><path fill=\"#77B255\" d=\"M36 32c0 2.209-1.791 4-4 4H4c-2.209 0-4-1.791-4-4V4c0-2.209 1.791-4 4-4h28c2.209 0 4 1.791 4 4v28z\"/><path fill=\"#FFF\" d=\"M29.28 6.362c-1.156-.751-2.704-.422-3.458.736L14.936 23.877l-5.029-4.65c-1.014-.938-2.596-.875-3.533.138-.937 1.014-.875 2.596.139 3.533l7.209 6.666c.48.445 1.09.665 1.696.665.673 0 1.534-.282 2.099-1.139.332-.506 12.5-19.27 12.5-19.27.751-1.159.421-2.707-.737-3.458z\"/></svg> تم الاستيراد" : "<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 36 36\"><path fill=\"#77B255\" d=\"M36 32c0 2.209-1.791 4-4 4H4c-2.209 0-4-1.791-4-4V4c0-2.209 1.791-4 4-4h28c2.209 0 4 1.791 4 4v28z\"/><path fill=\"#FFF\" d=\"M29.28 6.362c-1.156-.751-2.704-.422-3.458.736L14.936 23.877l-5.029-4.65c-1.014-.938-2.596-.875-3.533.138-.937 1.014-.875 2.596.139 3.533l7.209 6.666c.48.445 1.09.665 1.696.665.673 0 1.534-.282 2.099-1.139.332-.506 12.5-19.27 12.5-19.27.751-1.159.421-2.707-.737-3.458z\"/></svg> Imported",
      error: isRTL ? "<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 36 36\"><path fill=\"#DD2E44\" d=\"M21.533 18.002L33.768 5.768c.976-.976.976-2.559 0-3.535-.977-.977-2.559-.977-3.535 0L17.998 14.467 5.764 2.233c-.976-.977-2.56-.977-3.535 0-.977.976-.977 2.559 0 3.535l12.234 12.234L2.201 30.265c-.977.977-.977 2.559 0 3.535.488.488 1.128.732 1.768.732s1.28-.244 1.768-.732l12.262-12.263 12.234 12.234c.488.488 1.128.732 1.768.732.64 0 1.279-.244 1.768-.732.976-.977.976-2.559 0-3.535L21.533 18.002z\"/></svg> فشل" : "<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 36 36\"><path fill=\"#DD2E44\" d=\"M21.533 18.002L33.768 5.768c.976-.976.976-2.559 0-3.535-.977-.977-2.559-.977-3.535 0L17.998 14.467 5.764 2.233c-.976-.977-2.56-.977-3.535 0-.977.976-.977 2.559 0 3.535l12.234 12.234L2.201 30.265c-.977.977-.977 2.559 0 3.535.488.488 1.128.732 1.768.732s1.28-.244 1.768-.732l12.262-12.263 12.234 12.234c.488.488 1.128.732 1.768.732.64 0 1.279-.244 1.768-.732.976-.977.976-2.559 0-3.535L21.533 18.002z\"/></svg> Failed"
    };

    var container = document.createElement('div');
    container.id = 'bonds-db-auto-ui';
    container.style.cssText = 'display:flex; gap:0.5rem; flex-wrap:wrap; margin:1.5rem 0; padding-top:1rem; border-top:1px solid rgba(255,255,255,0.06);';

    var saveBtn = document.createElement('button');
    saveBtn.textContent = t.save;
    saveBtn.className = 'btn-calc secondary';
    saveBtn.style.cssText = 'flex:1; min-width:140px; background:transparent; color:var(--text); border:1px solid rgba(212,168,83,0.4); padding:0.9rem 2rem; border-radius:10px; font-family:inherit; font-weight:800; font-size:1rem; cursor:pointer;';
    saveBtn.onmouseenter = function() { saveBtn.style.background = 'rgba(212,168,83,0.1)'; };
    saveBtn.onmouseleave = function() { saveBtn.style.background = 'transparent'; };
    saveBtn.onclick = function() {
      var data = collectFormData();
      var name = (document.getElementById('itemName') && document.getElementById('itemName').value) ||
                 (document.querySelector('h1') && document.querySelector('h1').textContent.trim().slice(0,30)) ||
                 getPageKey();
      BondsDB.save('autosave', { id: getPageKey() + '_' + Date.now(), name: name, page: location.pathname, data: data }).then(function() {
        if (typeof BondsUI !== 'undefined') BondsUI.toast(t.saved, 'success');
      }).catch(function() {
        if (typeof BondsUI !== 'undefined') BondsUI.toast(t.error, 'error');
      });
    };

    var exportBtn = document.createElement('button');
    exportBtn.textContent = t.export;
    exportBtn.className = 'btn-calc secondary';
    exportBtn.style.cssText = saveBtn.style.cssText;
    exportBtn.onmouseenter = function() { exportBtn.style.background = 'rgba(212,168,83,0.1)'; };
    exportBtn.onmouseleave = function() { exportBtn.style.background = 'transparent'; };
    exportBtn.onclick = function() {
      BondsDB.exportAll().then(function(data) {
        var filename = 'bonds-backup-' + new Date().toISOString().slice(0,10) + '.json';
        BondsDB.downloadJSON(filename, data);
        if (typeof BondsUI !== 'undefined') BondsUI.toast(t.exported, 'success');
      }).catch(function() {
        if (typeof BondsUI !== 'undefined') BondsUI.toast(t.error, 'error');
      });
    };

    var importLabel = document.createElement('label');
    importLabel.style.cssText = 'flex:1; min-width:140px; cursor:pointer;';
    var importInput = document.createElement('input');
    importInput.type = 'file';
    importInput.accept = '.json';
    importInput.style.display = 'none';
    importInput.onchange = function() {
      var file = importInput.files[0];
      if (!file) return;
      BondsDB.readFile(file).then(function(data) {
        return BondsDB.importAll(data);
      }).then(function() {
        if (typeof BondsUI !== 'undefined') BondsUI.toast(t.imported, 'success');
        // Try to restore current page data
        return BondsDB.autoLoad('autosave', getPageKey());
      }).then(function(data) {
        if (data) { restoreFormData(data); triggerChangeEvents(); }
        importInput.value = '';
      }).catch(function() {
        if (typeof BondsUI !== 'undefined') BondsUI.toast(t.error, 'error');
        importInput.value = '';
      });
    };
    var importSpan = document.createElement('span');
    importSpan.textContent = t.import;
    importSpan.className = 'btn-calc secondary';
    importSpan.style.cssText = 'display:block; text-align:center; background:transparent; color:var(--text); border:1px solid rgba(212,168,83,0.4); padding:0.9rem 2rem; border-radius:10px; font-family:inherit; font-weight:800; font-size:1rem;';
    importLabel.appendChild(importInput);
    importLabel.appendChild(importSpan);

    container.appendChild(saveBtn);
    container.appendChild(exportBtn);
    container.appendChild(importLabel);

    // Insert before closing </body> or at end of .container
    var body = document.body;
    if (body) body.appendChild(container);
  }

  function init() {
    waitForDB(50, function(ok) {
      if (!ok) { console.warn('[BondsDB Auto] BondsDB not found'); return; }

      // Auto-save on input changes
      var timer = null;
      document.addEventListener('change', function(e) {
        var el = e.target;
        if (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA') {
          clearTimeout(timer);
          timer = setTimeout(function() {
            var data = collectFormData();
            BondsDB.autoSave('autosave', getPageKey(), data);
          }, 3000);
        }
      });

      // Auto-load on page load (if no URL params)
      var url = new URL(window.location.href);
      if (!url.search || url.searchParams.toString() === '') {
        BondsDB.autoLoad('autosave', getPageKey()).then(function(data) {
          if (data) {
            restoreFormData(data);
            // Trigger change events so calculators recalculate
            setTimeout(triggerChangeEvents, 500);
          }
        });
      }

      // Add UI buttons
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createUI);
      } else {
        createUI();
      }
    });
  }

  init();
})();
