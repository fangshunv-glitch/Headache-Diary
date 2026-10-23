/* ===== 头疼日记 · 分析引擎 ===== */
/* 思路：把每天的打卡当作"暴露记录"，头痛发作日当作"结果事件"，
   对比「有该因素的日子里的头痛率」与「没有该因素的日子里的头痛率」，
   得到风险倍数。没有无头痛日的对照，任何相关性都不成立。 */

(function () {
  'use strict';

  const num = (d, k) => {
    const v = d ? d[k] : null;
    return (typeof v === 'number' && isFinite(v)) ? v : null;
  };
  const bflag = (d, k) => (d && typeof d[k] === 'boolean') ? d[k] : undefined;
  const bf = (k) => (d) => bflag(d, k);
  const has = (arr, x) => Array.isArray(arr) && arr.indexOf(x) >= 0;
  const anyOf = (arr, labels) => Array.isArray(arr) && labels.some((l) => arr.indexOf(l) >= 0);

  /* 食物类因子：只要吃过列表中任意一项就算暴露 */
  const foodF = (id, label, labels) => ({
    id, g: '饮食', label,
    test: (d) => (d && Array.isArray(d.foods) ? anyOf(d.foods, labels) : undefined)
  });

  /* ---------- 因子定义：返回 true=暴露 / false=未暴露 / undefined=无数据 ---------- */

  const FACTORS = [
    /* 睡眠与节律 */
    { id: 'sleep_short', g: '睡眠', label: '睡眠不足（< 6 小时）',
      test: (d) => { const v = num(d, 'sleep'); return v == null ? undefined : v < 6; } },
    { id: 'sleep_long', g: '睡眠', label: '睡太多（> 9 小时）',
      test: (d) => { const v = num(d, 'sleep'); return v == null ? undefined : v > 9; } },
    { id: 'sleep_poor', g: '睡眠', label: '睡眠质量差（≤ 2 分）',
      test: (d) => { const v = num(d, 'sleepQuality'); return v == null ? undefined : v <= 2; } },
    { id: 'sleep_shift', g: '睡眠', label: '睡眠比前一天多/少 2 小时以上',
      test: (d, prev) => {
        const a = num(d, 'sleep'), b = num(prev, 'sleep');
        return (a == null || b == null) ? undefined : Math.abs(a - b) >= 2;
      } },
    { id: 'sleep_shift_base', g: '睡眠', label: '作息偏离平时 1.5 小时以上（补觉 / 熬夜）',
      test: (d, prev, ds) => {
        const a = num(d, 'sleep'), b = ds.base.sleep;
        return (a == null || b == null) ? undefined : Math.abs(a - b) >= 1.5;
      } },
    { id: 'snore', g: '睡眠', label: '打鼾 / 睡觉被憋醒', test: bf('snore') },

    /* 饮食与营养 */
    { id: 'caffeine_high', g: '饮食', label: '咖啡 / 茶 ≥ 3 杯',
      test: (d) => { const v = num(d, 'caffeine'); return v == null ? undefined : v >= 3; } },
    { id: 'caffeine_late', g: '饮食', label: '下午 3 点后摄入咖啡因', test: bf('caffeineLate') },
    { id: 'caffeine_none', g: '饮食', label: '当天完全没摄入咖啡因',
      test: (d) => { const v = num(d, 'caffeine'); return v == null ? undefined : v === 0; } },
    { id: 'caffeine_withdraw', g: '饮食', label: '咖啡因比平时明显减少（戒断）',
      test: (d, prev, ds) => {
        const a = num(d, 'caffeine'), b = ds.base.caffeine;
        if (a == null || b == null || b < 1) return undefined;
        return a <= b - 1;
      } },
    { id: 'skip_meal', g: '饮食', label: '跳餐 / 长时间饿肚子', test: bf('skipMeal') },
    { id: 'water_low', g: '饮食', label: '饮水偏少（< 4 杯）',
      test: (d) => { const v = num(d, 'water'); return v == null ? undefined : v < 4; } },
    { id: 'alcohol', g: '饮食', label: '喝了酒',
      test: (d) => { const v = num(d, 'alcohol'); return v == null ? undefined : v >= 1; } },
    { id: 'alcohol_high', g: '饮食', label: '饮酒 ≥ 2 杯',
      test: (d) => { const v = num(d, 'alcohol'); return v == null ? undefined : v >= 2; } },

    foodF('food_cheese', '吃了奶酪 / 乳制品（酪胺）', ['奶酪/乳制品']),
    foodF('food_redwine', '喝了红葡萄酒', ['红酒']),
    foodF('food_choc', '吃了巧克力（苯乙胺）', ['巧克力']),
    foodF('food_nitrite', '吃了加工肉 / 腌制品（亚硝酸盐）', ['加工肉制品', '腌制品']),
    foodF('food_msg', '吃了含味精 / 鸡精的食物', ['含味精/鸡精']),
    foodF('food_tyramine', '吃了高酪胺食物（豆类 / 内脏 / 无花果 / 香蕉）', ['豆类/豆制品', '动物内脏', '无花果', '香蕉']),
    foodF('food_onion', '吃了洋葱', ['洋葱']),
    foodF('food_citrus', '吃了柑橘类水果', ['柑橘']),
    foodF('food_nut', '吃了坚果', ['坚果']),
    foodF('food_icecream', '吃了冰淇淋（快速进食）', ['冰淇淋']),
    foodF('food_gluten', '吃了麸质 / 面食面包', ['麸质/面食']),
    foodF('food_sweetener', '摄入代糖（阿斯巴甜等）', ['代糖']),

    /* 环境与感官 */
    { id: 'weather', g: '环境', label: '天气 / 气压明显变化', test: bf('weather') },
    { id: 'heat', g: '环境', label: '闷热 / 高湿', test: bf('heat') },
    { id: 'cold_wind', g: '环境', label: '骤冷 / 空调风扇直吹', test: bf('coldWind') },
    { id: 'glare', g: '环境', label: '强光 / 刺眼反光', test: bf('glare') },
    { id: 'flicker', g: '环境', label: '闪烁灯光 / 荧光 / 屏幕频闪', test: bf('flicker') },
    { id: 'noise', g: '环境', label: '强噪音', test: bf('noise') },
    { id: 'smell', g: '环境', label: '强烈气味（香水 / 油烟 / 化学品）', test: bf('smell') },
    { id: 'smoke', g: '环境', label: '吸烟或长时间二手烟', test: bf('smoke') },
    { id: 'screen_high', g: '环境', label: '屏幕时间 ≥ 10 小时',
      test: (d) => { const v = num(d, 'screen'); return v == null ? undefined : v >= 10; } },
    { id: 'travel', g: '环境', label: '长途出行 / 作息时差', test: bf('travel') },
    { id: 'altitude', g: '环境', label: '高海拔环境', test: bf('altitude') },

    /* 身体与情绪 */
    { id: 'stress_high', g: '身体', label: '压力大（≥ 4 分）',
      test: (d) => { const v = num(d, 'stress'); return v == null ? undefined : v >= 4; } },
    { id: 'stress_jump', g: '身体', label: '压力比平时高出 1.5 分以上',
      test: (d, prev, ds) => {
        const a = num(d, 'stress'), b = ds.base.stress;
        return (a == null || b == null) ? undefined : (a - b) >= 1.5;
      } },
    { id: 'stress_relief', g: '身体', label: '压力明显解除（前一天紧绷、今天放松）',
      test: (d, prev) => {
        const a = num(d, 'stress'), b = num(prev, 'stress');
        return (a == null || b == null) ? undefined : (b >= 4 && a <= 2);
      } },
    { id: 'emotion', g: '身体', label: '情绪剧烈波动（激动 / 争吵 / 受惊）', test: bf('emotion') },
    { id: 'neck', g: '身体', label: '颈肩明显紧张酸痛（≥ 4 分）',
      test: (d) => { const v = num(d, 'neck'); return v == null ? undefined : v >= 4; } },
    { id: 'posture', g: '身体', label: '长时间伏案 / 固定姿势', test: bf('posture') },
    { id: 'overwork', g: '身体', label: '体力透支 / 过度劳累', test: bf('overwork') },
    { id: 'no_exercise', g: '身体', label: '当天几乎没运动',
      test: (d) => { const v = num(d, 'exercise'); return v == null ? undefined : v < 15; } },
    { id: 'heavy_exercise', g: '身体', label: '高强度运动（> 90 分钟）',
      test: (d) => { const v = num(d, 'exercise'); return v == null ? undefined : v > 90; } },
    { id: 'sexual', g: '身体', label: '有性生活', test: bf('sexual') },
    { id: 'trauma', g: '身体', label: '头部受过撞击', test: bf('trauma') },

    /* 药物与激素 */
    { id: 'hormone_med', g: '药物', label: '在服激素类药物（避孕药 / 激素替代）', test: bf('hormoneMed') },
    { id: 'vasodilator', g: '药物', label: '在服血管扩张类药物（硝酸酯等）', test: bf('vasodilator') },

    /* 生理周期 */
    { id: 'menstrual_pre', g: '周期', label: '经前 1–3 天',
      test: (d) => (d && typeof d.menstrual === 'string' && d.menstrual) ? d.menstrual === 'pre' : undefined },
    { id: 'menstrual_during', g: '周期', label: '经期中',
      test: (d) => (d && typeof d.menstrual === 'string' && d.menstrual) ? d.menstrual === 'during' : undefined },
    { id: 'menstrual_post', g: '周期', label: '经期后',
      test: (d) => (d && typeof d.menstrual === 'string' && d.menstrual) ? d.menstrual === 'post' : undefined },
    { id: 'menstrual_peri', g: '周期', label: '更年期 / 围绝经期',
      test: (d) => (d && typeof d.menstrual === 'string' && d.menstrual) ? d.menstrual === 'peri' : undefined },

    /* 时间 */
    { id: 'weekend', g: '时间', label: '周末 / 休息日',
      test: (d) => {
        if (!d || !d.date) return undefined;
        const p = String(d.date).split('-').map(Number);
        const wd = new Date(p[0], p[1] - 1, p[2]).getDay();
        return wd === 0 || wd === 6;
      } }
  ];

  /* ---------- 个人基线（用于"比平时"这类相对因子） ---------- */

  function median(arr) {
    if (!arr.length) return null;
    const s = arr.slice().sort((a, b) => a - b);
    const m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }

  function baselineOf(days) {
    const pick = (k) => days.map((d) => num(d, k)).filter((v) => v != null);
    const out = {};
    ['sleep', 'caffeine', 'stress', 'sleepQuality', 'screen', 'water'].forEach((k) => {
      const vals = pick(k);
      out[k] = vals.length >= 5 ? median(vals) : null; // 少于 5 天不设基线，避免太随意
    });
    return out;
  }

  /* ---------- 数据集 ---------- */

  function buildDataset(allDays, allAttacks) {
    const days = (allDays || []).slice().sort((a, b) => (a.date < b.date ? -1 : 1));
    const attacks = (allAttacks || []).slice().sort((a, b) => (a.startAt < b.startAt ? -1 : 1));

    const dayIndex = new Map();
    days.forEach((d) => dayIndex.set(d.date, d));

    const attackByDate = new Map();
    const headacheDates = new Set();
    attacks.forEach((a) => {
      const k = a.date || (a.startAt ? a.startAt.slice(0, 10) : null);
      if (!k) return;
      a.date = k;
      if (!attackByDate.has(k)) attackByDate.set(k, []);
      attackByDate.get(k).push(a);
      headacheDates.add(k);
    });
    days.forEach((d) => { if (d.hadHeadache === true) headacheDates.add(d.date); });

    return { days, attacks, dayIndex, attackByDate, headacheDates, base: baselineOf(days) };
  }

  function todayStr() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function sliceRange(ds, range) {
    if (range === 'all') return ds;
    const n = range === '30' ? 30 : range === '180' ? 180 : 90;
    const from = shiftDate(todayStr(), -(n - 1));
    const days = ds.days.filter((d) => d.date >= from);
    const attacks = ds.attacks.filter((a) => a.date >= from);
    return buildDataset(days, attacks);
  }

  /* ---------- 概览 ---------- */

  function summary(ds) {
    const totalRecorded = ds.days.length;
    const headacheDays = ds.headacheDates.size;
    const attackCount = ds.attacks.length;

    // 有记录的天 = 打卡日 ∪ 发作日（有些人只在头痛时记一笔，没打卡）
    const covered = new Set(ds.days.map((d) => d.date));
    ds.headacheDates.forEach((d) => covered.add(d));
    const coveredDays = covered.size;

    const sev = ds.attacks.map((a) => Number(a.severity)).filter((v) => isFinite(v));
    const avgSeverity = sev.length ? sev.reduce((s, v) => s + v, 0) / sev.length : null;

    const durs = ds.attacks.map((a) => {
      if (!a.endAt || !a.startAt) return null;
      const m = (new Date(a.endAt) - new Date(a.startAt)) / 60000;
      return m > 0 ? m : null;
    }).filter((v) => v !== null);
    const avgDuration = durs.length ? durs.reduce((s, v) => s + v, 0) / durs.length : null;

    // 连续无头痛天数
    let best = 0;
    const sorted = Array.from(ds.headacheDates).sort();
    if (sorted.length >= 2) {
      for (let i = 1; i < sorted.length; i++) {
        const gap = Math.round((new Date(sorted[i]) - new Date(sorted[i - 1])) / 86400000) - 1;
        if (gap > best) best = gap;
      }
    }

    // 用药
    const med = ds.attacks.filter((a) => a.medicine && a.medicine !== '未用药');
    const medOk = med.filter((a) => a.relief === 'resolved' || a.relief === 'partial').length;

    return {
      totalRecorded,
      coveredDays,
      headacheDays,
      attackCount,
      rate: coveredDays ? headacheDays / coveredDays : null,
      avgSeverity,
      avgDuration,
      bestStreak: best,
      medCount: med.length,
      medEffective: medOk,
      noHeadacheDays: Math.max(0, totalRecorded - countHeadacheRecordedDays(ds))
    };
  }

  function countHeadacheRecordedDays(ds) {
    let n = 0;
    ds.days.forEach((d) => { if (ds.headacheDates.has(d.date)) n++; });
    return n;
  }

  /* ---------- 因子关联 ---------- */

  const MIN_EXPOSED = 3;
  const MIN_UNEXPOSED = 3;

  function factorStats(ds, opts) {
    const lag = (opts && opts.lag) || 0;
    const out = [];

    for (const f of FACTORS) {
      if (f.id.indexOf('menstrual') === 0 && !(opts && opts.menstrual)) continue;

      let a = 0, b = 0, c = 0, d0 = 0; // a:暴露&头痛 b:暴露&无痛 c:未暴露&头痛 d:未暴露&无痛

      for (const day of ds.days) {
        const refDate = lag ? shiftDate(day.date, -lag) : day.date;
        const refDay = ds.dayIndex.get(refDate);
        if (!refDay) continue;

        let v;
        try { v = f.test(refDay, ds.dayIndex.get(shiftDate(refDate, -1)), ds); } catch (e) { v = undefined; }
        if (v === undefined || v === null) continue;

        const headache = ds.headacheDates.has(day.date);
        if (v) { if (headache) a++; else b++; }
        else { if (headache) c++; else d0++; }
      }

      const n1 = a + b, n0 = c + d0;
      // 完全没有暴露、或完全没有对照，都无法比较，直接跳过
      if (n1 === 0 || n0 === 0) continue;

      if (n1 < MIN_EXPOSED || n0 < MIN_UNEXPOSED) {
        out.push({ id: f.id, g: f.g, label: f.label, n1, n0, a, c, p1: a / n1, p0: c / n0, rr: null, diff: null, strength: 'low', enough: false });
        continue;
      }

      const p1 = a / n1;
      const p0 = c / n0;
      const rr = p0 > 0 ? p1 / p0 : (p1 > 0 ? Infinity : 1);
      const diff = p1 - p0;

      let strength = 'low';
      if (n1 >= 5 && n0 >= 5 && Math.abs(diff) >= 0.15) strength = 'mid';
      if (n1 >= 8 && n0 >= 8 && Math.abs(diff) >= 0.25) strength = 'high';
      if (n1 < 5 || n0 < 5) strength = 'low';

      out.push({ id: f.id, g: f.g, label: f.label, n1, n0, a, c, p1, p0, rr, diff, strength, enough: true });
    }

    out.sort((x, y) => {
      const xs = x.diff === null ? -9 : x.diff;
      const ys = y.diff === null ? -9 : y.diff;
      return ys - xs;
    });
    return out;
  }

  function shiftDate(s, n) {
    const p = String(s).split('-').map(Number);
    const d = new Date(p[0], p[1] - 1, p[2] + n);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  /* ---------- 头痛日 vs 非头痛日的数值对比 ---------- */

  const NUM_FIELDS = [
    { k: 'sleep', label: '睡眠时长', unit: '小时', digits: 1, min: 0.3 },
    { k: 'sleepQuality', label: '睡眠质量', unit: '分', digits: 1, min: 0.3 },
    { k: 'stress', label: '压力程度', unit: '分', digits: 1, min: 0.3 },
    { k: 'water', label: '饮水量', unit: '杯', digits: 1, min: 0.5 },
    { k: 'caffeine', label: '咖啡因', unit: '杯', digits: 1, min: 0.5 },
    { k: 'screen', label: '屏幕时间', unit: '小时', digits: 1, min: 1 },
    { k: 'neck', label: '颈肩紧张', unit: '分', digits: 1, min: 0.3 },
    { k: 'exercise', label: '运动时长', unit: '分钟', digits: 0, min: 10 }
  ];

  function numericCompare(ds) {
    return NUM_FIELDS.map((f) => {
      const h = [], n = [];
      ds.days.forEach((d) => {
        const v = num(d, f.k);
        if (v == null) return;
        if (ds.headacheDates.has(d.date)) h.push(v); else n.push(v);
      });
      if (h.length < 2 || n.length < 2) return { ...f, h: h.length, n: n.length, hv: null, nv: null, delta: null };
      const hv = h.reduce((s, v) => s + v, 0) / h.length;
      const nv = n.reduce((s, v) => s + v, 0) / n.length;
      return { ...f, h: h.length, n: n.length, hv, nv, delta: hv - nv };
    }).filter((x) => x.hv !== null);
  }

  /* ---------- 多因素叠加（阈值效应） ---------- */

  // 这 8 项都是每日必填或常用项，用来衡量"当天一共踩了几条"
  const LOAD_FIELDS = [
    { id: 'sleep_short', label: '睡眠不足' },
    { id: 'sleep_poor', label: '睡眠质量差' },
    { id: 'stress_high', label: '压力大' },
    { id: 'skip_meal', label: '跳餐' },
    { id: 'water_low', label: '饮水少' },
    { id: 'alcohol_high', label: '饮酒' },
    { id: 'weather', label: '气压变化' },
    { id: 'neck', label: '颈肩紧张' }
  ];

  function loadStats(ds) {
    const byId = new Map(FACTORS.map((f) => [f.id, f]));
    const buckets = [0, 1, 2, 3].map((k) => ({ count: k, n: 0, headache: 0, rate: null }));

    ds.days.forEach((day) => {
      let active = 0, evaluable = 0;
      LOAD_FIELDS.forEach((lf) => {
        const f = byId.get(lf.id);
        if (!f) return;
        let v;
        try { v = f.test(day, ds.dayIndex.get(shiftDate(day.date, -1)), ds); } catch (e) { v = undefined; }
        if (v === undefined || v === null) return;
        evaluable++;
        if (v) active++;
      });
      // 当天记录不足 6 项就不参与，避免"填得越全分数越高"的偏差
      if (evaluable < 6) return;
      const k = Math.min(active, 3);
      const b = buckets[k];
      b.n++;
      if (ds.headacheDates.has(day.date)) b.headache++;
    });

    buckets.forEach((b) => { b.rate = b.n ? b.headache / b.n : null; });
    const low = buckets[0].n + buckets[1].n;
    const lowH = buckets[0].headache + buckets[1].headache;
    const high = buckets[2].n + buckets[3].n;
    const highH = buckets[2].headache + buckets[3].headache;
    return {
      buckets,
      evaluableDays: low + high,
      lowRate: low ? lowH / low : null,
      highRate: high ? highH / high : null,
      lowN: low,
      highN: high
    };
  }

  /* ---------- 药物过度使用（MOH）风险 ---------- */

  const MED_CLASS = {
    '佐米曲普坦': 'triptan', '利扎曲普坦': 'triptan', '舒马曲普坦': 'triptan', '麦角胺': 'triptan',
    '复方止痛药（含咖啡因）': 'combo'
  };

  function medicationRisk(ds, windowDays) {
    const n = windowDays || 30;
    const from = shiftDate(todayStr(), -(n - 1));
    const daysUsed = new Map(); // date -> Set(class)

    ds.attacks.forEach((a) => {
      if (!a || !a.date || a.date < from) return;
      const m = a.medicine;
      if (!m || m === '未用药') return;
      const cls = MED_CLASS[m] || 'simple';
      if (!daysUsed.has(a.date)) daysUsed.set(a.date, new Set());
      daysUsed.get(a.date).add(cls);
    });

    let simple = 0, triptan = 0, combo = 0;
    daysUsed.forEach((set) => {
      if (set.has('simple')) simple++;
      if (set.has('triptan')) triptan++;
      if (set.has('combo')) combo++;
    });
    const total = daysUsed.size;

    // 急性期用药天数：曲普坦 / 含咖啡因复方 ≥10 天，单纯止痛药 ≥15 天
    const specific = triptan + combo;
    let level = 'ok';
    if (specific >= 10 || simple >= 15) level = 'risk';
    else if (specific >= 5 || simple >= 8 || total >= 8) level = 'warn';

    return {
      windowDays: n,
      totalDays: total,
      simpleDays: simple,
      triptanDays: triptan,
      comboDays: combo,
      specificDays: specific,
      perMonth: total,
      level,
      thresholds: { specific: 10, simple: 15 }
    };
  }

  /* ---------- 前驱期（因果混淆提醒） ---------- */

  function prodromeStats(ds) {
    const P = '无明显前驱';
    const withP = ds.attacks.filter((a) => Array.isArray(a.prodrome) && a.prodrome.some((x) => x && x !== P));
    const counts = new Map();
    withP.forEach((a) => a.prodrome.forEach((x) => {
      if (!x || x === P) return;
      counts.set(x, (counts.get(x) || 0) + 1);
    }));
    const top = Array.from(counts.entries())
      .map(([label, n]) => ({ label, n }))
      .sort((a, b) => b.n - a.n)
      .slice(0, 5);
    const total = ds.attacks.length;
    return {
      total,
      withProdrome: withP.length,
      ratio: total ? withP.length / total : null,
      top
    };
  }

  /* ---------- 你以为的诱因 vs 数据说的 ---------- */

  // 旧版本选项文字的别名，保证历史记录仍能对上因子
  const LABEL_ALIAS = {
    '强光、闪烁屏幕或强噪音': 'glare',
    '睡眠比平日多/少 2 小时以上': 'sleep_shift',
    '胃不适 / 恶心': null
  };

  function guessCompare(ds) {
    const lags = [0, 1, 2];
    const byLag = lags.map((lag) => new Map(factorStats(ds, { lag }).map((f) => [f.id, f])));
    const labelToId = new Map(FACTORS.map((f) => [f.label, f.id]));
    const resolveId = (label) => labelToId.get(label) || LABEL_ALIAS[label] || null;

    const counts = new Map();
    ds.attacks.forEach((a) => (a.triggers || []).forEach((t) => {
      if (!t) return;
      counts.set(t, (counts.get(t) || 0) + 1);
    }));

    const rows = Array.from(counts.entries()).map(([label, n]) => {
      const id = resolveId(label);
      const cands = byLag.map((m) => (id ? m.get(id) : null)).filter((f) => f && f.diff != null);
      const best = cands.slice().sort((a, b) => b.diff - a.diff)[0] || null;
      return { label, n, best };
    }).sort((a, b) => b.n - a.n);

    const guessed = new Set(counts.keys());
    const l0 = byLag[0], l1 = byLag[1];
    const missed = FACTORS.map((f) => {
      const a = l0.get(f.id), b = l1.get(f.id);
      const pick = [a, b].filter((x) => x && x.diff != null).sort((x, y) => y.diff - x.diff)[0];
      return pick;
    }).filter((f) => f && f.diff >= 0.2 && f.n1 >= 5 && !guessed.has(f.label))
      .sort((a, b) => b.diff - a.diff)
      .slice(0, 4);

    return { rows, missed };
  }

  /* ---------- 分布 ---------- */

  function distribution(ds) {
    const hourBuckets = [0, 0, 0, 0]; // 凌晨 上午 下午 夜间
    const hourLabels = ['凌晨 0–6', '上午 6–12', '下午 12–18', '夜间 18–24'];
    const weekBuckets = [0, 0, 0, 0, 0, 0, 0];

    ds.attacks.forEach((a) => {
      if (a.startAt) {
        const h = new Date(a.startAt).getHours();
        const idx = h < 6 ? 0 : h < 12 ? 1 : h < 18 ? 2 : 3;
        hourBuckets[idx]++;
      }
      if (a.date) {
        const p = a.date.split('-').map(Number);
        weekBuckets[new Date(p[0], p[1] - 1, p[2]).getDay()]++;
      }
    });

    const weekdays = weekBuckets[1] + weekBuckets[2] + weekBuckets[3] + weekBuckets[4] + weekBuckets[5];
    const weekend = weekBuckets[0] + weekBuckets[6];

    return {
      hours: hourLabels.map((l, i) => ({ label: l, n: hourBuckets[i] })),
      week: ['周日', '周一', '周二', '周三', '周四', '周五', '周六'].map((l, i) => ({ label: l, n: weekBuckets[i] })),
      weekdays, weekend,
      maxHour: Math.max.apply(null, hourBuckets.concat([1])),
      maxWeek: Math.max.apply(null, weekBuckets.concat([1]))
    };
  }

  /* ---------- 日历热力图 ---------- */

  function heatmap(ds, monthCount) {
    const today = new Date();
    const months = [];
    for (let i = (monthCount || 3) - 1; i >= 0; i--) {
      const first = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const y = first.getFullYear(), m = first.getMonth();
      const daysInMonth = new Date(y, m + 1, 0).getDate();
      const lead = new Date(y, m, 1).getDay();
      const cells = [];
      for (let p = 0; p < lead; p++) cells.push(null);
      for (let day = 1; day <= daysInMonth; day++) {
        const ds2 = y + '-' + String(m + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
        const atk = ds.attackByDate.get(ds2) || [];
        const dayRec = ds.dayIndex.get(ds2);
        const maxSev = atk.length ? Math.max.apply(null, atk.map((a) => Number(a.severity) || 0)) : 0;
        cells.push({
          date: ds2,
          day,
          recorded: !!dayRec,
          headache: ds.headacheDates.has(ds2),
          severity: atk.length ? maxSev : (dayRec && dayRec.hadHeadache ? 3 : 0)
        });
      }
      months.push({ label: y + ' 年 ' + (m + 1) + ' 月', cells });
    }
    return months;
  }

  /* ---------- 数据质量 ---------- */

  function dataQuality(ds) {
    const rec = ds.days.length;
    const hd = countHeadacheRecordedDays(ds);
    const nh = rec - hd;
    const issues = [];
    if (rec < 10) issues.push({ level: 'warn', text: '打卡记录还不到 10 天，现在得出的任何结论都不可靠。' });
    if (rec > 0 && nh < 3) issues.push({ level: 'warn', text: '几乎没有「不头痛」的日子被记录。你需要在**没头痛的日子也打卡**，才有对照，否则所有因素看起来都跟头痛有关。' });
    if (hd > 0 && nh / Math.max(1, rec) < 0.25) issues.push({ level: 'warn', text: '无头痛日的记录比例偏低，建议坚持每天打卡（哪怕 20 秒）。' });
    if (ds.attacks.length > 0 && rec === 0) issues.push({ level: 'warn', text: '只有头痛记录，没有任何每日打卡，无法做诱因对照。' });
    return { recorded: rec, headacheDays: hd, noHeadacheDays: nh, issues };
  }

  window.Analyze = {
    FACTORS, buildDataset, sliceRange, summary, factorStats,
    numericCompare, distribution, heatmap, dataQuality,
    loadStats, medicationRisk, prodromeStats, guessCompare,
    NUM_FIELDS, LOAD_FIELDS, baselineOf, median, shiftDate
  };
})();
