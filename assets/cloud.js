/* 云同步：登录 + 把每日打卡/发作记录备份到云端
 *
 * 设计要点
 * - 本地存储始终是主路径：未登录也能完整使用，断网不丢数据
 * - 登录后双向同步：同一 (kind, rec_key) 按 updatedAt 取新（last-write-wins）
 * - 删除用墓碑行（deleted=true）传播，避免另一台设备把记录又拉回来
 */
window.Cloud = (function () {
  'use strict';

  /* publicConfig 原样落地（来自 workbuddy_cloud_service 的返回值，勿手改） */
  const PUBLIC_CONFIG = {
    endpoint: 'https://headache-diary-04511.app.workbuddy.host',
    oauthRelayBaseUrl: 'https://www.workbuddy.cn/v2/as/genie-baas/oauth',
    publishableKey: 'wbpk_qyYSQn4lNF1tIG2DabhT5Z_VTIaU4vN855DTQ4PMimoTM0Npx0w7TW9'
  };

  const TABLE = 'headache_records';
  const SKEW = 800;               // 时间戳容差（毫秒），避免无意义来回写
  const LAST_SYNC_KEY = 'hd_last_sync';

  let client = null;
  let bootPromise = null;
  let session = null;
  let lastError = '';
  let syncing = false;
  let pendingOtp = null;          // { email, verificationId, isExistingUser }

  /* ---------- 初始化 ---------- */

  function init() {
    if (client) return client;
    if (typeof WorkBuddyCloud === 'undefined' || !WorkBuddyCloud.createWorkBuddyCloud) {
      lastError = '云服务组件未加载';
      return null;
    }
    client = WorkBuddyCloud.createWorkBuddyCloud({
      endpoint: PUBLIC_CONFIG.endpoint,
      oauthRelayBaseUrl: PUBLIC_CONFIG.oauthRelayBaseUrl,
      publishableKey: PUBLIC_CONFIG.publishableKey
    });
    return client;
  }

  /* 处理 OAuth 回调（必须在任何渲染之前跑）+ 恢复已有会话 */
  function boot() {
    if (bootPromise) return bootPromise;
    bootPromise = (async () => {
      const c = init();
      if (!c) return null;

      const url = new URL(location.href);
      const hasCb = url.searchParams.has('code') || url.searchParams.has('error');

      if (hasCb) {
        const provider = url.searchParams.get('provider');
        const fn = provider === 'workbuddy' ? (c.auth.handleWorkBuddyCallback || null)
          : provider === 'wechat' ? (c.auth.handleWechatWebCallback || null) : null;
        if (!fn) {
          lastError = url.searchParams.get('error') ? '登录被取消或授权失败' : '回调缺少有效的登录方式';
          cleanUrl();
          return null;
        }
        try {
          const { data, error } = await fn.call(c.auth);
          if (error) { lastError = error.message || '登录失败'; cleanUrl(); return null; }
          if (data) {
            session = data;
            cleanUrl();
            return session;
          }
        } catch (err) {
          lastError = (err && err.message) || '登录失败';
          cleanUrl();
          return null;
        }
        cleanUrl();
      }

      try {
        const { data, error } = await c.auth.getSession();
        if (error) { if (!isTransient(error)) session = null; }
        else session = data || null;
      } catch (err) {
        session = null;
      }
      return session;
    })();
    return bootPromise;
  }

  function isTransient(err) {
    const kind = err && err.kind;
    return kind === 'network' || kind === 'backend-unavailable';
  }

  /* 清掉回调参数，但保留应用自己的 query（?sharecode=...） */
  function cleanUrl() {
    try {
      const url = new URL(location.href);
      ['code', 'state', 'provider', 'error', 'error_description'].forEach((k) => url.searchParams.delete(k));
      history.replaceState(null, '', url.pathname + url.search + url.hash);
    } catch (e) { /* 忽略 */ }
  }

  /* ---------- 登录 ---------- */

  async function signInWithWorkBuddy() {
    const c = init();
    if (!c) return { error: lastError };
    const back = new URL(location.href);
    back.pathname = '/';
    ['code', 'state', 'provider', 'error', 'error_description'].forEach((k) => back.searchParams.delete(k));
    const { data, error } = await c.auth.signInWithOAuth({
      provider: 'workbuddy',
      redirectTo: back.toString()
    });
    if (error) return { error: error.message || '无法发起登录' };
    location.assign(data.url);
    return { ok: true };
  }

  async function sendEmailCode(email) {
    const c = init();
    if (!c) return { error: lastError };
    const sent = await c.auth.sendOtp({ email });
    if (sent.error) return { error: sent.error.message || '验证码发送失败' };
    pendingOtp = {
      email,
      verificationId: sent.data.verificationId,
      isExistingUser: sent.data.isExistingUser
    };
    return { ok: true };
  }

  async function verifyEmailCode(email, token) {
    const c = init();
    if (!c) return { error: lastError };
    const p = pendingOtp;
    if (!p || p.email !== email) return { error: '请先获取该邮箱的验证码' };
    const done = await c.auth.verifyOtp({
      email: p.email,
      verificationId: p.verificationId,
      isExistingUser: p.isExistingUser,
      token: token
    });
    if (done.error) return { error: done.error.message || '验证码校验失败' };
    pendingOtp = null;
    session = done.data && done.data.session ? done.data.session : await currentSession();
    return { ok: true, session };
  }

  async function currentSession() {
    const c = init();
    if (!c) return null;
    try {
      const { data } = await c.auth.getSession();
      session = data || null;
    } catch (e) { session = null; }
    return session;
  }

  async function signOut() {
    const c = init();
    if (c) { try { await c.auth.signOut(); } catch (e) { /* 忽略 */ } }
    session = null;
    return { ok: true };
  }

  /* ---------- 同步 ---------- */

  function isSignedIn() { return !!session; }

  function accountLabel() {
    if (!session || !session.user) return '';
    const u = session.user;
    if (u.email) return u.email;
    if (u.phone) return String(u.phone).replace(/^(\d{3})\d{4}(\d+)$/, '$1****$2');
    return u.name || '已登录';
  }

  function lastSyncAt() {
    try { return Number(localStorage.getItem(LAST_SYNC_KEY) || 0) || 0; } catch (e) { return 0; }
  }

  function markSynced() {
    try { localStorage.setItem(LAST_SYNC_KEY, String(Date.now())); } catch (e) { /* 忽略 */ }
  }

  function chunk(arr, n) {
    const out = [];
    for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
    return out;
  }

  async function pushRows(rows) {
    const c = init();
    if (!c || !rows.length) return { ok: true, pushed: 0 };
    const name = session && session.user && session.user.name ? session.user.name : null;
    const payload = rows.map((r) => ({
      kind: r.kind,
      rec_key: r.key,
      payload: r.payload,
      client_updated_at: r.updatedAt || 0,
      deleted: !!r.deleted,
      owner_name: name
    }));
    for (const part of chunk(payload, 200)) {
      const { error } = await c.database.from(TABLE).upsert(part, { onConflict: 'owner_id,kind,rec_key' });
      if (error) throw error;
    }
    return { ok: true, pushed: payload.length };
  }

  async function pullRows() {
    const c = init();
    if (!c) return [];
    const { data, error } = await c.database.from(TABLE)
      .select('kind,rec_key,payload,client_updated_at,deleted')
      .order('client_updated_at', { ascending: true });
    if (error) throw error;
    return data || [];
  }

  /* 全量双向同步：本地与云端按 updatedAt 取新 */
  async function syncNow(store) {
    if (!session) return { error: '未登录' };
    if (syncing) return { ok: true, skipped: true };
    syncing = true;
    try {
      const cloudRows = await pullRows();
      const cloudMap = new Map();
      cloudRows.forEach((r) => cloudMap.set(r.kind + '|' + r.rec_key, r));

      const days = await store.all('days');
      const attacks = await store.all('attacks');
      const localRows = [];
      days.forEach((d) => localRows.push({ kind: 'day', key: d.date, payload: d, updatedAt: d.updatedAt || 0 }));
      attacks.forEach((a) => localRows.push({ kind: 'attack', key: a.id, payload: a, updatedAt: a.updatedAt || 0 }));

      const toPush = [];
      const toApply = [];   // { kind, key, payload, deleted }

      localRows.forEach((lr) => {
        const k = lr.kind + '|' + lr.key;
        const cr = cloudMap.get(k);
        if (!cr) { toPush.push(lr); return; }
        cloudMap.delete(k);
        const cloudTs = Number(cr.client_updated_at) || 0;
        if (cloudTs > lr.updatedAt + SKEW) {
          toApply.push({ kind: cr.kind, key: cr.rec_key, payload: cr.payload, deleted: !!cr.deleted });
        } else if (lr.updatedAt > cloudTs + SKEW) {
          toPush.push(lr);
        }
      });

      // 云端独有的行（含别的设备新增、或删除墓碑）
      cloudMap.forEach((cr) => {
        toApply.push({ kind: cr.kind, key: cr.rec_key, payload: cr.payload, deleted: !!cr.deleted });
      });

      // 先写本地，再推云端
      let wrote = 0;
      for (const item of toApply) {
        if (item.deleted) {
          await store.del(item.kind === 'day' ? 'days' : 'attacks', item.key);
        } else if (item.payload) {
          await store.put(item.kind === 'day' ? 'days' : 'attacks', item.payload);
          wrote++;
        }
      }

      await pushRows(toPush);
      markSynced();
      lastError = '';
      return { ok: true, pulled: wrote, pushed: toPush.length };
    } catch (err) {
      lastError = err && (err.message || err.code) ? (err.message || ('同步失败（' + err.code + '）')) : '同步失败';
      return { error: lastError };
    } finally {
      syncing = false;
    }
  }

  /* 单条推送：保存后调用，未登录直接忽略 */
  async function pushOne(kind, key, payload, updatedAt) {
    if (!session) return { skipped: true };
    try {
      await pushRows([{ kind, key, payload, updatedAt }]);
      markSynced();
      return { ok: true };
    } catch (err) {
      lastError = err && err.message ? err.message : '同步失败';
      return { error: lastError };
    }
  }

  /* 单条删除：写墓碑，让其他设备也删掉 */
  async function removeOne(kind, key) {
    if (!session) return { skipped: true };
    try {
      await pushRows([{ kind, key, payload: null, updatedAt: Date.now(), deleted: true }]);
      markSynced();
      return { ok: true };
    } catch (err) {
      lastError = err && err.message ? err.message : '同步失败';
      return { error: lastError };
    }
  }

  return {
    PUBLIC_CONFIG,
    boot, init,
    isSignedIn, accountLabel, lastSyncAt, currentSession,
    signInWithWorkBuddy, sendEmailCode, verifyEmailCode, signOut,
    syncNow, pushOne, removeOne,
    get error() { return lastError; },
    get otpPending() { return !!pendingOtp; }
  };
})();
