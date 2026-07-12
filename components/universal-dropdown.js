/* UniversalDropdown — Bonds Global
 * Custom accessible dropdown that replaces/enhances native <select> elements.
 * Usage:
 *   const dd = UniversalDropdown.fromSelect(document.getElementById('city'), {
 *     search: true, searchPlaceholder: 'ابحث...', sort: true,
 *     deduplicate: true, removeEmpty: true, emptyText: 'لا توجد بيانات'
 *   });
 *   dd.setOptions([{value:'sa', label:'السعودية'}, ...]);
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.UniversalDropdown = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const SVG_ARROW = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="ud-arrow"><path d="m6 9 6 6 6-6"/></svg>';

  const SENTINEL_VALUES = new Set([
    '-', '—', '--', '...', '',
    'غير معروف', 'غير محدد', 'غير متوفر', 'غير محددة',
    'unknown', 'unspecified', 'unavailable', 'not specified', 'n/a', 'na',
    'null', 'undefined'
  ]);

  const defaults = {
    search: true,            // search enabled by default (Select2-style)
    searchPlaceholder: 'بحث...',
    sort: false,
    sortLocale: 'ar',
    deduplicate: false,
    removeEmpty: false,
    emptyText: 'لا توجد بيانات متاحة',
    noResultsText: 'لا توجد نتائج مطابقة',
    loadingText: 'جاري التحميل...',
    placeholder: null,
    selectAllText: 'تحديد الكل',
    clearAllText: 'إلغاء التحديد',
    direction: null, // 'rtl' | 'ltr' | auto-detect
    fixed: false,    // use fixed positioning for menus
    maxHeight: null, // e.g. '260px'
    maxResults: 10,  // show first N results with scrolling
    debounce: 150,   // ms for search input debounce
    onChange: null,  // function(value, label, dd)
    className: '',
    virtualize: false,
    virtualItemHeight: 36,
    virtualOverscan: 5,
    virtualThreshold: 50
  };

  function debounce(fn, wait) {
    let t;
    return function (...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), wait);
    };
  }

  function detectDirection(select) {
    const htmlDir = document.documentElement.getAttribute('dir');
    const bodyDir = document.body ? document.body.getAttribute('dir') : null;
    const closest = select.closest('[dir]');
    if (closest) return closest.getAttribute('dir');
    if (htmlDir) return htmlDir;
    if (bodyDir) return bodyDir;
    return 'rtl';
  }

  function detectTheme(select) {
    const own = select.getAttribute('data-ud-theme');
    if (own) return own;
    const closest = select.closest('[data-ud-theme]');
    if (closest) return closest.getAttribute('data-ud-theme');
    return null;
  }

  function normalizeItems(items) {
    if (!Array.isArray(items)) return [];
    return items.map(item => {
      if (item === null || item === undefined) return null;
      if (typeof item === 'string' || typeof item === 'number') {
        return { value: String(item), label: String(item), disabled: false, type: 'option', icon: null };
      }
      return {
        value: item.value !== undefined ? String(item.value) : String(item.label || ''),
        label: item.label !== undefined ? String(item.label) : String(item.value || ''),
        disabled: !!item.disabled,
        type: item.type === 'group' ? 'group' : 'option',
        group: item.group || null,
        icon: item.icon || null
      };
    }).filter(Boolean);
  }

  function isIconUrl(icon) {
    if (typeof icon !== 'string') return false;
    return /^https?:\/\//.test(icon) || /^\/[^\s]/.test(icon) || /\.(png|jpg|jpeg|svg|webp|gif)(\?.*)?$/i.test(icon);
  }

  function createIconEl(icon, alt) {
    if (!icon) return null;
    alt = alt || '';
    if (isIconUrl(icon)) {
      const img = document.createElement('img');
      img.src = icon;
      img.alt = alt;
      img.className = 'ud-icon';
      img.setAttribute('aria-hidden', 'true');
      return img;
    }
    const span = document.createElement('span');
    span.className = 'ud-icon';
    span.textContent = icon;
    span.setAttribute('aria-hidden', 'true');
    return span;
  }

  function cleanItems(items, opts) {
    let list = normalizeItems(items);
    if (opts.removeEmpty) {
      list = list.filter(i => {
        if (i.type === 'group') return true;
        const val = i.value.trim();
        const lbl = String(i.label).trim();
        if (val === '' || lbl === '') return false;
        const valLower = val.toLowerCase();
        const lblLower = lbl.toLowerCase();
        return !SENTINEL_VALUES.has(valLower) && !SENTINEL_VALUES.has(lblLower);
      });
    }
    if (opts.deduplicate) {
      const seen = new Set();
      list = list.filter(i => {
        const key = i.type + '::' + i.value + '::' + i.label;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }
    if (opts.sort) {
      list.sort((a, b) => a.label.localeCompare(b.label, opts.sortLocale, { sensitivity: 'base' }));
    }
    return list;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  class UniversalDropdown {
    constructor(select, options = {}) {
      if (!select || select.tagName !== 'SELECT') {
        throw new Error('UniversalDropdown requires a <select> element');
      }
      this.select = select;
      this.opts = Object.assign({}, defaults, options);
      if (!this.opts.direction) this.opts.direction = detectDirection(select);
      if (!this.opts.theme) this.opts.theme = detectTheme(select);
      this.items = [];
      this.isOpen = false;
      this.highlightIndex = -1;
      this.searchTerm = '';
      this.isMultiple = select.multiple;
      this.isLoading = false;
      this._clickOutside = this._clickOutside.bind(this);
      this._onKeyDown = this._onKeyDown.bind(this);
      this._onResize = this._onResize.bind(this);
      this._onScroll = this._onScroll.bind(this);
      this._onMenuScroll = this._onMenuScroll.bind(this);
      this._mutationObserver = null;

      this._build();
      this._readOptionsFromSelect();
      this._syncValue();
      this._attachNativeListener();
      this._observeNative();
    }

    static fromSelect(select, options) {
      return new UniversalDropdown(select, options);
    }

    /* ---------- DOM construction ---------- */
    _build() {
      const select = this.select;
      const parent = select.parentNode;

      this.wrapper = document.createElement('div');
      this.wrapper.className = 'ud-dropdown' + (this.opts.className ? ' ' + this.opts.className : '');
      this.wrapper.setAttribute('dir', this.opts.direction);
      if (this.opts.theme) this.wrapper.setAttribute('data-ud-theme', this.opts.theme);
      if (this.opts.fixed || select.dataset.udFixed === 'true') {
        this.wrapper.classList.add('ud-portal');
      }
      if (select.hasAttribute('style')) {
        const sizingProps = ['width', 'max-width', 'min-width', 'height', 'max-height', 'min-height'];
        const styleMap = {};
        select.style.cssText.split(';').forEach(decl => {
          const colon = decl.indexOf(':');
          if (colon === -1) return;
          const prop = decl.slice(0, colon).trim();
          if (sizingProps.includes(prop.toLowerCase())) {
            styleMap[prop] = decl.slice(colon + 1).trim();
          }
        });
        const sizingCss = Object.entries(styleMap).map(([k, v]) => `${k}: ${v}`).join('; ');
        if (sizingCss) this.wrapper.setAttribute('style', sizingCss);
      }

      select.classList.add('ud-native-fallback');
      select.setAttribute('data-ud-native', 'true');
      select.setAttribute('tabindex', '-1');
      select.setAttribute('aria-hidden', 'true');

      this.trigger = document.createElement('button');
      this.trigger.type = 'button';
      this.trigger.className = 'ud-trigger';
      this.trigger.setAttribute('aria-haspopup', 'listbox');
      this.trigger.setAttribute('aria-expanded', 'false');
      this.trigger.setAttribute('tabindex', select.disabled ? '-1' : '0');
      if (select.disabled) this.trigger.classList.add('ud-disabled');

      this.valueEl = document.createElement('span');
      this.valueEl.className = 'ud-trigger-value';
      this.trigger.appendChild(this.valueEl);
      this.trigger.insertAdjacentHTML('beforeend', SVG_ARROW);

      this.menu = document.createElement('div');
      this.menu.className = 'ud-menu';
      this.menu.setAttribute('role', 'listbox');
      if (this.opts.maxHeight) this.menu.style.maxHeight = this.opts.maxHeight;

      this.listEl = document.createElement('ul');
      this.listEl.className = 'ud-list';
      this.menu.appendChild(this.listEl);

      parent.insertBefore(this.wrapper, select);
      this.wrapper.appendChild(select);
      this.wrapper.appendChild(this.trigger);
      this.wrapper.appendChild(this.menu);
      this.select = select;
      this.wrapper._universalDropdown = this;

      this.trigger.addEventListener('click', () => this.toggle());
      this.trigger.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (!this.isOpen) this.open();
          else if (e.key === 'Enter' || e.key === ' ') this._selectHighlighted();
          return;
        }
        // Type-ahead: open dropdown and forward printable keys to search input
        if (!this.isOpen && e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
          e.preventDefault();
          this.open();
          setTimeout(() => {
            const input = this.searchEl && this.searchEl.querySelector('input');
            if (input) {
              input.value = e.key;
              input.focus();
              input.dispatchEvent(new Event('input', { bubbles: true }));
            }
          }, 15);
        }
      });
    }

    /* ---------- Data ---------- */
    _readOptionsFromSelect() {
      const rawItems = [];
      Array.from(this.select.children).forEach(child => {
        if (child.tagName === 'OPTGROUP') {
          const groupLabel = child.getAttribute('label') || '';
          rawItems.push({ value: '__group__' + groupLabel, label: groupLabel, disabled: true, type: 'group' });
          Array.from(child.children).forEach(o => {
            if (o.tagName === 'OPTION') {
              rawItems.push({ value: o.value, label: o.text, disabled: o.disabled, group: groupLabel, type: 'option', icon: o.dataset.icon });
            }
          });
        } else if (child.tagName === 'OPTION') {
          rawItems.push({ value: child.value, label: child.text, disabled: child.disabled, type: 'option', icon: child.dataset.icon });
        }
      });
      this.items = cleanItems(rawItems, this.opts);
      this._renderItems();
    }

    setOptions(items) {
      this.items = cleanItems(items, this.opts);
      const currentValue = this.select.value;

      // Rebuild native select options (preserves form submission / accessibility)
      this.select.innerHTML = '';
      const placeholder = this.opts.placeholder;
      if (placeholder && !this.items.find(i => i.value === '')) {
        const ph = document.createElement('option');
        ph.value = '';
        ph.textContent = typeof placeholder === 'object' ? placeholder.label : placeholder;
        this.select.appendChild(ph);
      }
      this.items.forEach(item => {
        const opt = document.createElement('option');
        opt.value = item.value;
        opt.textContent = item.label;
        opt.disabled = item.disabled;
        if (item.icon) opt.dataset.icon = item.icon;
        this.select.appendChild(opt);
      });

      if (this.items.find(i => i.value === currentValue)) {
        this.select.value = currentValue;
      } else if (this.items.length) {
        this.select.value = this.items[0].value;
      }
      this._renderItems();
      this._syncValue();
      return this;
    }

    get value() {
      if (this.isMultiple) return this._selectedValues();
      return this.select.value;
    }

    set value(val) {
      if (this.isMultiple) {
        const values = Array.isArray(val) ? val : [val];
        Array.from(this.select.options).forEach(o => {
          o.selected = values.includes(o.value);
        });
      } else {
        this.select.value = val;
      }
      this._syncValue();
    }

    get selectedLabel() {
      const items = this._selectedItems();
      return items.map(i => i.label).join(', ');
    }

    setLoading(isLoading) {
      this.isLoading = isLoading;
      if (this.isOpen) this._renderItems();
      this.trigger.classList.toggle('ud-loading', isLoading);
      return this;
    }

    /* ---------- Rendering ---------- */
    _renderItems() {
      this.listEl.innerHTML = '';
      this.menu.setAttribute('aria-multiselectable', this.isMultiple ? 'true' : 'false');
      if (this.actionsEl) {
        this.actionsEl.style.display = (this.isMultiple && this.items.length && !this.isLoading) ? 'flex' : 'none';
      }

      if (this.isLoading) {
        const loading = document.createElement('li');
        loading.className = 'ud-empty ud-loading';
        loading.textContent = this.opts.loadingText;
        this.listEl.appendChild(loading);
        this.itemEls = [];
        this._virtualActive = false;
        return;
      }

      let filtered = this._filteredItems();

      if (!filtered.length) {
        const empty = document.createElement('li');
        empty.className = 'ud-empty';
        empty.textContent = this.searchTerm.trim() ? this.opts.noResultsText : this.opts.emptyText;
        this.listEl.appendChild(empty);
        this.itemEls = [];
        this._virtualActive = false;
        return;
      }

      const useVirtual = this.opts.virtualize && this.items.length > (this.opts.virtualThreshold || 0);

      if (!useVirtual) {
        const maxResults = parseInt(this.opts.maxResults, 10) || 0;
        if (maxResults > 0 && filtered.length > maxResults) {
          filtered = filtered.slice(0, maxResults);
        }
      }
      if (useVirtual) {
        this._virtualActive = true;
        this._virtualRender(filtered);
      } else {
        this._virtualActive = false;
        this._domRender(filtered);
      }
    }

    _domRender(filtered) {
      this.listEl.style.height = '';
      this.listEl.style.position = '';
      this.itemEls = filtered.map((item, idx) => {
        const li = this._createItemEl(item, idx, idx);
        this.listEl.appendChild(li);
        return li;
      });
    }

    _virtualRender(filtered) {
      this.listEl.style.height = (filtered.length * this.opts.virtualItemHeight) + 'px';
      this.listEl.style.position = 'relative';
      const menuHeight = this.menu.clientHeight || parseInt(getComputedStyle(this.menu).maxHeight) || 320;
      const scrollTop = this.menu.scrollTop;
      const itemH = this.opts.virtualItemHeight;
      const overscan = this.opts.virtualOverscan;
      let start = Math.floor(scrollTop / itemH) - overscan;
      let end = Math.ceil((scrollTop + menuHeight) / itemH) + overscan;
      if (start < 0) start = 0;
      if (end > filtered.length) end = filtered.length;

      this.itemEls = [];
      for (let i = start; i < end; i++) {
        const item = filtered[i];
        const li = this._createItemEl(item, i, i);
        li.style.position = 'absolute';
        li.style.top = (i * itemH) + 'px';
        li.style.left = '0';
        li.style.right = '0';
        this.listEl.appendChild(li);
        this.itemEls.push(li);
      }
    }

    _createItemEl(item, dataIndex, highlightIndex) {
      const li = document.createElement('li');
      if (item.type === 'group') {
        li.className = 'ud-group-header';
        li.setAttribute('role', 'group');
        li.setAttribute('aria-label', item.label);
        li.setAttribute('data-index', String(dataIndex));
        li.textContent = item.label;
        return li;
      }
      li.className = 'ud-item' + (this.isMultiple ? ' ud-item--multi' : '');
      li.setAttribute('role', 'option');
      li.setAttribute('data-value', item.value);
      li.setAttribute('data-index', String(dataIndex));
      if (item.disabled) li.classList.add('ud-disabled');
      // Ensure readable text regardless of page theme or browser dark mode
      li.style.color = '#000000';
      li.style.webkitTextFillColor = '#000000';
      const iconEl = createIconEl(item.icon, item.label);
      if (iconEl) li.appendChild(iconEl);
      li.appendChild(document.createTextNode(item.label));
      li.setAttribute('aria-label', item.label);
      li.addEventListener('click', () => {
        if (item.disabled) return;
        this._choose(item.value);
      });
      li.addEventListener('mouseenter', () => {
        if (!item.disabled) this._setHighlight(highlightIndex);
      });
      return li;
    }

    _filteredItems() {
      const term = this.searchTerm.trim().toLowerCase();
      const all = this.items;
      if (!term) return all.slice();
      const seenGroups = new Set();
      const matches = all.filter(i => {
        if (i.type === 'group') return false;
        return i.label.toLowerCase().includes(term) || i.value.toLowerCase().includes(term);
      });
      return matches.reduce((acc, i) => {
        if (i.group && !seenGroups.has(i.group)) {
          seenGroups.add(i.group);
          const header = all.find(x => x.type === 'group' && x.label === i.group);
          if (header) acc.push(header);
        }
        acc.push(i);
        return acc;
      }, []);
    }

    _ensureSearch() {
      if (!this.opts.search || this.searchEl) return;
      this.searchEl = document.createElement('div');
      this.searchEl.className = 'ud-search';
      const input = document.createElement('input');
      input.type = 'text';
      input.placeholder = this.opts.searchPlaceholder;
      input.setAttribute('aria-label', this.opts.searchPlaceholder);
      input.setAttribute('autocomplete', 'off');
      input.setAttribute('autocorrect', 'off');
      input.setAttribute('autocapitalize', 'off');
      input.setAttribute('spellcheck', 'false');

      const doSearch = (value) => {
        this.searchTerm = value;
        this._renderItems();
        this._setHighlight(this.itemEls.length ? 0 : -1);
        if (clearBtn) clearBtn.style.display = value ? 'flex' : 'none';
      };

      const debouncedSearch = this.opts.debounce > 0
        ? debounce(doSearch, this.opts.debounce)
        : doSearch;

      input.addEventListener('input', (e) => {
        debouncedSearch(e.target.value);
      });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          this._moveHighlight(1);
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          this._moveHighlight(-1);
        } else if (e.key === 'Enter') {
          e.preventDefault();
          this._selectHighlighted();
        } else if (e.key === 'Escape') {
          e.stopPropagation();
          this.close();
        }
      });
      const clearBtn = document.createElement('button');
      clearBtn.type = 'button';
      clearBtn.className = 'ud-search-clear';
      clearBtn.setAttribute('aria-label', 'مسح البحث');
      clearBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';
      clearBtn.style.display = 'none';
      clearBtn.addEventListener('click', () => {
        input.value = '';
        this.searchTerm = '';
        this._renderItems();
        this._setHighlight(this.itemEls.length ? 0 : -1);
        clearBtn.style.display = 'none';
        input.focus();
      });
      this.searchEl.appendChild(input);
      this.searchEl.appendChild(clearBtn);
      this.menu.insertBefore(this.searchEl, this.listEl);
    }

    _ensureMultiActions() {
      if (!this.isMultiple) return;
      if (this.actionsEl) return;
      this.actionsEl = document.createElement('div');
      this.actionsEl.className = 'ud-actions';
      const selectAllBtn = document.createElement('button');
      selectAllBtn.type = 'button';
      selectAllBtn.className = 'ud-action-btn ud-action-btn--primary';
      selectAllBtn.textContent = this.opts.selectAllText;
      selectAllBtn.addEventListener('click', () => this._selectAll(true));
      const clearAllBtn = document.createElement('button');
      clearAllBtn.type = 'button';
      clearAllBtn.className = 'ud-action-btn';
      clearAllBtn.textContent = this.opts.clearAllText;
      clearAllBtn.addEventListener('click', () => this._selectAll(false));
      this.actionsEl.appendChild(selectAllBtn);
      this.actionsEl.appendChild(clearAllBtn);
      this.menu.insertBefore(this.actionsEl, this.listEl);
    }

    _selectAll(select) {
      const options = Array.from(this.select.options);
      const prev = options.map(o => o.selected);
      options.forEach(o => { if (!o.disabled) o.selected = select; });
      this._syncValue();
      const changed = prev.some((v, i) => v !== options[i].selected);
      if (changed) {
        this.select.dispatchEvent(new Event('change', { bubbles: true }));
        if (typeof this.opts.onChange === 'function') {
          this.opts.onChange(this._selectedValues(), this.selectedLabel, this);
        }
      }
    }

    _selectedValues() {
      if (!this.isMultiple) return this.select.value ? [this.select.value] : [];
      return Array.from(this.select.options).filter(o => o.selected).map(o => o.value);
    }

    _selectedItems() {
      const values = new Set(this._selectedValues());
      return this.items.filter(i => values.has(i.value));
    }

    _syncValue() {
      if (this.select.disabled) {
        this.trigger.classList.add('ud-disabled');
        this.trigger.setAttribute('tabindex', '-1');
      } else {
        this.trigger.classList.remove('ud-disabled');
        this.trigger.setAttribute('tabindex', '0');
      }

      const selectedItems = this._selectedItems();

      if (selectedItems.length) {
        this.valueEl.innerHTML = '';
        if (this.isMultiple) {
          selectedItems.forEach(i => {
            const chip = document.createElement('span');
            chip.className = 'ud-chip';
            const iconEl = createIconEl(i.icon, i.label);
            if (iconEl) chip.appendChild(iconEl);
            chip.appendChild(document.createTextNode(i.label));
            this.valueEl.appendChild(chip);
          });
        } else {
          const i = selectedItems[0];
          const iconEl = createIconEl(i.icon, i.label);
          if (iconEl) this.valueEl.appendChild(iconEl);
          this.valueEl.appendChild(document.createTextNode(i.label));
        }
        this.valueEl.classList.remove('ud-placeholder');
      } else if (this.opts.placeholder) {
        const ph = typeof this.opts.placeholder === 'object' ? this.opts.placeholder.label : this.opts.placeholder;
        this.valueEl.textContent = ph;
        this.valueEl.classList.add('ud-placeholder');
      } else if (this.items.length) {
        if (!this.isMultiple) {
          const i = this.items[0];
          this.select.value = i.value;
          this.valueEl.innerHTML = '';
          const iconEl = createIconEl(i.icon, i.label);
          if (iconEl) this.valueEl.appendChild(iconEl);
          this.valueEl.appendChild(document.createTextNode(i.label));
        } else {
          this.valueEl.textContent = this.opts.emptyText;
        }
        this.valueEl.classList.remove('ud-placeholder');
      } else {
        this.valueEl.textContent = this.opts.emptyText;
        this.valueEl.classList.add('ud-placeholder');
      }

      if (this.itemEls) {
        const selectedValues = new Set(this._selectedValues());
        this.itemEls.forEach(el => {
          const isSel = selectedValues.has(el.getAttribute('data-value'));
          el.classList.toggle('ud-selected', isSel);
          el.setAttribute('aria-selected', isSel ? 'true' : 'false');
        });
      }
    }

    /* ---------- Behaviour ---------- */
    open() {
      if (this.isOpen || this.select.disabled) return;
      this.isOpen = true;
      this._ensureSearch();
      this._ensureMultiActions();
      this.trigger.setAttribute('aria-expanded', 'true');
      this.menu.classList.add('ud-open');
      this._positionMenu();
      this._renderItems();
      this._setHighlightFromValue();
      this._scrollHighlightedIntoView();
      document.addEventListener('click', this._clickOutside);
      document.addEventListener('keydown', this._onKeyDown);
      window.addEventListener('resize', this._onResize);
      window.addEventListener('scroll', this._onScroll, true);
      this.menu.addEventListener('scroll', this._onMenuScroll);
      if (this.searchEl) {
        setTimeout(() => this.searchEl.querySelector('input').focus(), 10);
      }
    }

    close() {
      if (!this.isOpen) return;
      this.isOpen = false;
      this.trigger.setAttribute('aria-expanded', 'false');
      this.menu.classList.remove('ud-open');
      this.searchTerm = '';
      if (this.searchEl) this.searchEl.querySelector('input').value = '';
      document.removeEventListener('click', this._clickOutside);
      document.removeEventListener('keydown', this._onKeyDown);
      window.removeEventListener('resize', this._onResize);
      window.removeEventListener('scroll', this._onScroll, true);
      this.menu.removeEventListener('scroll', this._onMenuScroll);
      this.trigger.focus();
    }

    toggle() {
      this.isOpen ? this.close() : this.open();
    }

    _choose(value) {
      if (this.isMultiple) {
        this._toggleValue(value);
        return;
      }
      const prev = this.select.value;
      this.select.value = value;
      this._syncValue();
      this.close();
      if (prev !== value) {
        this.select.dispatchEvent(new Event('change', { bubbles: true }));
        if (typeof this.opts.onChange === 'function') {
          this.opts.onChange(value, this.selectedLabel, this);
        }
      }
    }

    _toggleValue(value) {
      const option = Array.from(this.select.options).find(o => o.value === value);
      if (!option) return;
      const prevValues = this._selectedValues();
      option.selected = !option.selected;
      this._syncValue();
      const newValues = this._selectedValues();
      const changed = prevValues.length !== newValues.length ||
        prevValues.some((v, i) => v !== newValues[i]);
      if (changed) {
        this.select.dispatchEvent(new Event('change', { bubbles: true }));
        if (typeof this.opts.onChange === 'function') {
          this.opts.onChange(newValues, this.selectedLabel, this);
        }
      }
    }

    _selectHighlighted() {
      if (this.highlightIndex < 0 || !this.itemEls || !this.itemEls[this.highlightIndex]) return;
      const el = this.itemEls[this.highlightIndex];
      if (el.classList.contains('ud-disabled')) return;
      const value = el.getAttribute('data-value');
      if (this.isMultiple) {
        this._toggleValue(value);
      } else {
        this._choose(value);
      }
    }

    _setHighlight(idx) {
      if (this.itemEls) {
        this.itemEls.forEach(el => {
          const isHighlighted = parseInt(el.getAttribute('data-index'), 10) === idx;
          el.classList.toggle('ud-highlighted', isHighlighted);
        });
      }
      this.highlightIndex = idx;
    }

    _setHighlightFromValue() {
      const selectedValues = this._selectedValues();
      let idx = -1;
      if (selectedValues.length) {
        idx = this.itemEls.findIndex(el => el.getAttribute('data-value') === selectedValues[0]);
      }
      this._setHighlight(idx >= 0 ? idx : (this.itemEls.length ? 0 : -1));
    }

    _moveHighlight(delta) {
      const filtered = this._filteredItems();
      if (!filtered.length) return;
      const len = filtered.length;
      let next = this.highlightIndex + delta;
      if (next < 0) next = len - 1;
      if (next >= len) next = 0;
      // skip disabled
      let guard = 0;
      while (filtered[next].disabled && guard < len) {
        next += delta;
        if (next < 0) next = len - 1;
        if (next >= len) next = 0;
        guard++;
      }
      this._setHighlight(next);
      this._scrollHighlightedIntoView();
    }

    _scrollHighlightedIntoView() {
      if (this.highlightIndex < 0) return;
      if (this._virtualActive) {
        const itemH = this.opts.virtualItemHeight;
        const top = this.highlightIndex * itemH;
        const bottom = top + itemH;
        const visibleTop = this.menu.scrollTop;
        const visibleBottom = visibleTop + (this.menu.clientHeight || 320);
        if (bottom > visibleBottom) {
          this.menu.scrollTop = bottom - (this.menu.clientHeight || 320) + 8;
        } else if (top < visibleTop) {
          this.menu.scrollTop = top - 8;
        }
        this._renderItems();
        return;
      }
      if (!this.itemEls) return;
      const el = this.itemEls[this.highlightIndex];
      if (!el) return;
      const menuRect = this.menu.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      if (elRect.bottom > menuRect.bottom) {
        this.menu.scrollTop += elRect.bottom - menuRect.bottom + 8;
      } else if (elRect.top < menuRect.top) {
        this.menu.scrollTop -= menuRect.top - elRect.top + 8;
      }
    }

    _hasClippingAncestor() {
      let el = this.wrapper.parentElement;
      while (el && el !== document.body && el !== document.documentElement) {
        const style = window.getComputedStyle(el);
        if (style.overflow !== 'visible' || style.overflowX !== 'visible' || style.overflowY !== 'visible') {
          return true;
        }
        el = el.parentElement;
      }
      return false;
    }

    _positionMenu() {
      const rect = this.trigger.getBoundingClientRect();
      const menu = this.menu;
      const isFixed = this.opts.fixed || this.wrapper.classList.contains('ud-portal') || this._hasClippingAncestor();
      const menuHeight = Math.min(menu.offsetHeight || parseInt(getComputedStyle(menu).maxHeight) || 320, window.innerHeight * 0.6);
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const openUp = spaceBelow < menuHeight && spaceAbove > spaceBelow;

      if (isFixed) {
        menu.style.position = 'fixed';
        menu.style.width = rect.width + 'px';
        menu.style.left = rect.left + 'px';
        menu.style.right = 'auto';
        menu.style.top = openUp ? (rect.top - menuHeight - 6) + 'px' : (rect.bottom + 6) + 'px';
      } else {
        menu.style.position = 'absolute';
        menu.style.width = '';
        menu.style.left = '0';
        menu.style.right = '0';
        menu.style.top = openUp ? 'auto' : 'calc(100% + 6px)';
        menu.style.bottom = openUp ? 'calc(100% + 6px)' : 'auto';
      }
    }

    /* ---------- Events ---------- */
    _clickOutside(e) {
      if (!this.wrapper.contains(e.target) && !this.menu.contains(e.target)) {
        this.close();
      }
    }

    _onKeyDown(e) {
      if (!this.isOpen) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        this._moveHighlight(1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        this._moveHighlight(-1);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        this._selectHighlighted();
      } else if (e.key === ' ' && this.isMultiple) {
        e.preventDefault();
        this._selectHighlighted();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this.close();
      } else if (e.key === 'Tab') {
        this.close();
      } else if (e.key.length === 1 && !this.searchEl) {
        // type-to-search when no search box
        this._typeAhead(e.key);
      }
    }

    _typeAhead(char) {
      const term = (this._typeAheadBuffer || '') + char.toLowerCase();
      this._typeAheadBuffer = term;
      clearTimeout(this._typeAheadTimer);
      this._typeAheadTimer = setTimeout(() => { this._typeAheadBuffer = ''; }, 600);
      const idx = this.itemEls.findIndex(el => el.textContent.toLowerCase().startsWith(term));
      if (idx >= 0) {
        this._setHighlight(idx);
        this._scrollHighlightedIntoView();
      }
    }

    _onResize() {
      if (this.isOpen) this._positionMenu();
    }

    _onScroll() {
      if (this.isOpen) this._positionMenu();
    }

    _onMenuScroll() {
      if (this.isOpen && this._virtualActive) {
        this._virtualRender(this._filteredItems());
      }
    }

    _attachNativeListener() {
      this.select.addEventListener('change', () => this._syncValue());
    }

    _observeNative() {
      if (typeof MutationObserver === 'undefined') return;
      this._mutationObserver = new MutationObserver(() => this._readOptionsFromSelect());
      this._mutationObserver.observe(this.select, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled'] });
    }

    /* ---------- Public helpers ---------- */
    destroy() {
      if (this._mutationObserver) this._mutationObserver.disconnect();
      document.removeEventListener('click', this._clickOutside);
      document.removeEventListener('keydown', this._onKeyDown);
      window.removeEventListener('resize', this._onResize);
      window.removeEventListener('scroll', this._onScroll, true);
      if (this.wrapper && this.wrapper.parentNode) {
        this.wrapper.parentNode.insertBefore(this.select, this.wrapper);
        this.wrapper.parentNode.removeChild(this.wrapper);
      }
      this.select.removeAttribute('data-ud-native');
      this.select.removeAttribute('tabindex');
      this.select.removeAttribute('aria-hidden');
      this.select.classList.remove('ud-native-fallback');
    }

    refresh() {
      this._readOptionsFromSelect();
      this._syncValue();
    }
  }

  return UniversalDropdown;
}));
