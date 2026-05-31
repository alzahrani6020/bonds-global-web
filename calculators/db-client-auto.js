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
      save: isRTL ? '💾 حفظ النتيجة' : '💾 Save Result',
      export: isRTL ? '📥 تصدير البيانات' : '📥 Export Data',
      import: isRTL ? '📤 استيراد البيانات' : '📤 Import Data',
      saved: isRTL ? '✅ تم الحفظ' : '✅ Saved',
      exported: isRTL ? '✅ تم التصدير' : '✅ Exported',
      imported: isRTL ? '✅ تم الاستيراد' : '✅ Imported',
      error: isRTL ? '❌ فشل' : '❌ Failed'
    };

    var container = document.createElement('div');
    container.id = 'bonds-db-auto-ui';
    container.style.cssText = 'display:flex; gap:0.5rem; flex-wrap:wrap; margin:1.5rem 0; padding-top:1rem; border-top:1px solid rgba(255,255,255,0.06);';

    var saveBtn = document.createElement('button');
    saveBtn.textContent = t.save;
    saveBtn.className = 'btn-calc secondary';
    saveBtn.style.cssText = 'flex:1; min-width:140px; background:transparent; color:var(--gold); border:1px solid rgba(212,168,83,0.4); padding:0.9rem 2rem; border-radius:10px; font-family:inherit; font-weight:800; font-size:1rem; cursor:pointer;';
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
    importSpan.style.cssText = 'display:block; text-align:center; background:transparent; color:var(--gold); border:1px solid rgba(212,168,83,0.4); padding:0.9rem 2rem; border-radius:10px; font-family:inherit; font-weight:800; font-size:1rem;';
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
