/* ===== 头疼日记 · 数据层 ===== */
/* IndexedDB 优先，失败时自动降级到 localStorage；两者数据结构一致 */

(function () {
  'use strict';

  const DB_NAME = 'headache_diary';
  const DB_VER = 1;
  const STORES = ['days', 'attacks', 'meta'];
  const LS_KEY = 'headache_diary_ls_v1';

  let dbp = null;
  let mode = 'idb';
  let lsCache = null;

  /* ---------- IndexedDB ---------- */

  function openIDB() {
    if (dbp) return dbp;
    dbp = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') { reject(new Error('indexedDB unavailable')); return; }
      let req;
      let settled = false;
      const timer = setTimeout(() => finish(reject, new Error('idb open timeout')), 1200);
      function finish(fn, v) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        fn(v);
      }
      try { req = indexedDB.open(DB_NAME, DB_VER); }
      catch (e) { finish(reject, e); return; }
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('days')) db.createObjectStore('days', { keyPath: 'date' });
        if (!db.objectStoreNames.contains('attacks')) db.createObjectStore('attacks', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
      };
      req.onsuccess = () => finish(resolve, req.result);
      req.onerror = () => finish(reject, req.error || new Error('idb open error'));
      req.onblocked = () => finish(reject, new Error('idb blocked'));
    }).catch((e) => { dbp = null; throw e; });
    return dbp;
  }

  function idbOp(store, m, fn) {
    return openIDB().then((db) => new Promise((resolve, reject) => {
      const tx = db.transaction(store, m);
      const st = tx.objectStore(store);
      let result;
      const req = fn(st);
      if (req && typeof req === 'object' && 'onsuccess' in req) {
        req.onsuccess = () => { result = req.result; };
      }
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error || new Error('idb tx error'));
      tx.onabort = () => reject(tx.error || new Error('idb tx abort'));
    }));
  }

  /* ---------- localStorage 兜底 ---------- */

  function local() {
    if (lsCache) return lsCache;
    let obj = {};
    try { obj = JSON.parse(localStorage.getItem(LS_KEY) || '{}') || {}; } catch (e) { obj = {}; }
    STORES.forEach((s) => { if (!obj[s] || typeof obj[s] !== 'object') obj[s] = {}; });
    lsCache = obj;
    return lsCache;
  }

  function localFlush() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(lsCache || local()));
      return true;
    } catch (e) {
      console.error('[store] localStorage write failed', e);
      return false;
    }
  }

  function toLocal(e) {
    if (mode === 'local') return;
    console.warn('[store] IndexedDB 不可用，切换到 localStorage', e && e.message);
    mode = 'local';
  }

  /* ---------- 统一 API ---------- */

  async function get(store, key) {
    if (mode === 'idb') {
      try { return (await idbOp(store, 'readonly', (s) => s.get(key))) || null; }
      catch (e) { toLocal(e); }
    }
    return local()[store][key] || null;
  }

  async function put(store, value) {
    if (mode === 'idb') {
      try { await idbOp(store, 'readwrite', (s) => s.put(value)); return value; }
      catch (e) { toLocal(e); }
    }
    const l = local();
    const key = store === 'days' ? value.date : store === 'attacks' ? value.id : value.key;
    l[store][key] = value;
    localFlush();
    return value;
  }

  async function del(store, key) {
    if (mode === 'idb') {
      try { await idbOp(store, 'readwrite', (s) => s.delete(key)); return; }
      catch (e) { toLocal(e); }
    }
    delete local()[store][key];
    localFlush();
  }

  async function all(store) {
    if (mode === 'idb') {
      try { return (await idbOp(store, 'readonly', (s) => s.getAll())) || []; }
      catch (e) { toLocal(e); }
    }
    return Object.values(local()[store] || {});
  }

  async function bulkPut(store, values) {
    if (!values.length) return;
    if (mode === 'idb') {
      try {
        await openIDB().then((db) => new Promise((resolve, reject) => {
          const tx = db.transaction(store, 'readwrite');
          const st = tx.objectStore(store);
          values.forEach((v) => st.put(v));
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        }));
        return;
      } catch (e) { toLocal(e); }
    }
    const l = local();
    values.forEach((v) => {
      const key = store === 'days' ? v.date : store === 'attacks' ? v.id : v.key;
      l[store][key] = v;
    });
    localFlush();
  }

  /* ---------- 设置 ---------- */

  const DEFAULT_SETTINGS = {
    hideMenstrual: false,  // 是否隐藏「生理周期」选项（默认显示）
    weather: true,         // 是否显示天气突变字段
    onboarded: false,
    customFactors: [],     // 用户自定义诱因
    schema: 2
  };

  let settingsCache = null;

  async function getSettings() {
    if (settingsCache) return settingsCache;
    const row = await get('meta', 'settings');
    settingsCache = Object.assign({}, DEFAULT_SETTINGS, (row && row.v) || {});
    return settingsCache;
  }

  async function saveSettings(patch) {
    const cur = await getSettings();
    settingsCache = Object.assign({}, cur, patch);
    await put('meta', { key: 'settings', v: settingsCache });
    return settingsCache;
  }

  /* ---------- 存储探测与迁移 ---------- */

  // 返回是否用上了 IndexedDB；不能用时降级并返回 false
  async function probe() {
    if (mode !== 'idb') return false;
    try { await openIDB(); return true; }
    catch (e) { toLocal(e); return false; }
  }

  // 上一次可能是在兼容模式下存的数据，切回 IndexedDB 时把它搬过去，避免数据"消失"
  async function migrateLocalToIDB() {
    if (mode !== 'idb') return 0;
    let raw = null;
    try { raw = localStorage.getItem(LS_KEY); } catch (e) { return 0; }
    if (!raw) return 0;
    let obj;
    try { obj = JSON.parse(raw); } catch (e) { return 0; }
    let moved = 0;
    for (const s of STORES) {
      const vals = Object.values(obj[s] || {});
      if (vals.length) { await bulkPut(s, vals); moved += vals.length; }
    }
    if (moved) { try { localStorage.removeItem(LS_KEY); } catch (e) {} lsCache = null; }
    return moved;
  }

  /* ---------- 导入 / 导出 ---------- */

  async function exportAll() {
    const [days, attacks, settings] = await Promise.all([all('days'), all('attacks'), getSettings()]);
    days.sort((a, b) => (a.date < b.date ? -1 : 1));
    attacks.sort((a, b) => (a.startAt < b.startAt ? -1 : 1));
    return {
      app: 'headache-diary',
      schema: 1,
      exportedAt: new Date().toISOString(),
      device: navigator.platform || '',
      settings,
      days,
      attacks
    };
  }

  async function importAll(payload, opts) {
    opts = opts || {};
    if (!payload || payload.app !== 'headache-diary') {
      throw new Error('这不是「头疼日记」的存档文件');
    }
    const days = Array.isArray(payload.days) ? payload.days : [];
    const attacks = Array.isArray(payload.attacks) ? payload.attacks : [];
    const stats = { days: 0, attacks: 0, skipped: 0 };

    if (opts.replace) {
      const oldDays = await all('days');
      const oldAttacks = await all('attacks');
      for (const d of oldDays) await del('days', d.date);
      for (const a of oldAttacks) await del('attacks', a.id);
    }

    const incomingDays = [];
    for (const d of days) {
      if (!d || !d.date) { stats.skipped++; continue; }
      if (!opts.replace) {
        const cur = await get('days', d.date);
        if (cur && (cur.updatedAt || 0) > (d.updatedAt || 0)) { stats.skipped++; continue; }
      }
      incomingDays.push(d);
      stats.days++;
    }
    await bulkPut('days', incomingDays);

    const incomingAttacks = [];
    for (const a of attacks) {
      if (!a || !a.startAt) { stats.skipped++; continue; }
      if (!a.id) a.id = uid();
      if (!opts.replace) {
        const cur = await get('attacks', a.id);
        if (cur && (cur.updatedAt || 0) > (a.updatedAt || 0)) { stats.skipped++; continue; }
      }
      incomingAttacks.push(a);
      stats.attacks++;
    }
    await bulkPut('attacks', incomingAttacks);

    if (payload.settings) {
      settingsCache = Object.assign({}, await getSettings(), payload.settings);
      await put('meta', { key: 'settings', v: settingsCache });
    }
    return stats;
  }

  async function clearAll() {
    for (const s of STORES) {
      const rows = await all(s);
      for (const r of rows) {
        const key = s === 'days' ? r.date : s === 'attacks' ? r.id : r.key;
        await del(s, key);
      }
    }
    settingsCache = null;
  }

  /* ---------- 工具 ---------- */

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  function dateStr(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function parseDate(s) {
    const p = String(s).split('-').map(Number);
    return new Date(p[0], p[1] - 1, p[2]);
  }

  function addDays(s, n) {
    const d = parseDate(s);
    d.setDate(d.getDate() + n);
    return dateStr(d);
  }

  function diffDays(a, b) {
    return Math.round((parseDate(a) - parseDate(b)) / 86400000);
  }

  const WEEK_CN = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

  function fmtDateCN(s, withWeek) {
    const d = parseDate(s);
    const base = (d.getMonth() + 1) + '月' + d.getDate() + '日';
    return withWeek ? base + ' ' + WEEK_CN[d.getDay()] : base;
  }

  function fmtDateShort(s) {
    const d = parseDate(s);
    return (d.getMonth() + 1) + '/' + d.getDate();
  }

  function fmtTime(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  function fmtDateTime(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return fmtDateCN(dateStr(d)) + ' ' + fmtTime(iso);
  }

  function nowLocalInput() {
    const d = new Date();
    return dateStr(d) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  window.Store = {
    get, put, del, all, bulkPut,
    getSettings, saveSettings,
    probe, migrateLocalToIDB,
    exportAll, importAll, clearAll,
    uid, dateStr, parseDate, addDays, diffDays,
    fmtDateCN, fmtDateShort, fmtTime, fmtDateTime,
    nowLocalInput, WEEK_CN,
    get mode() { return mode; }
  };
})();
