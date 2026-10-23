/* ===== 头疼日记 · 应用主逻辑 ===== */

(function () {
  'use strict';

  const S = window.Store;
  const A = window.Analyze;

  /* ---------- 选项配置 ---------- */

  const CFG = {
    sleepOpts: [
      { v: 4.5, l: '< 5' }, { v: 5.5, l: '5–6' }, { v: 6.5, l: '6–7' },
      { v: 7.5, l: '7–8' }, { v: 8.5, l: '8–9' }, { v: 9.5, l: '> 9' }
    ],
    score5: [
      { v: 1, l: '很差' }, { v: 2, l: '较差' }, { v: 3, l: '一般' }, { v: 4, l: '较好' }, { v: 5, l: '很好' }
    ],
    stress5: [
      { v: 1, l: '很低' }, { v: 2, l: '较低' }, { v: 3, l: '一般' }, { v: 4, l: '较大' }, { v: 5, l: '很大' }
    ],
    neck5: [
      { v: 1, l: '无' }, { v: 2, l: '轻微' }, { v: 3, l: '一般' }, { v: 4, l: '明显' }, { v: 5, l: '严重' }
    ],
    caffeineOpts: [
      { v: 0, l: '0' }, { v: 1, l: '1' }, { v: 2, l: '2' }, { v: 3, l: '3' }, { v: 4, l: '4+' }
    ],
    waterOpts: [
      { v: 2, l: '< 3' }, { v: 4, l: '3–5' }, { v: 7, l: '6–8' }, { v: 10, l: '> 8' }
    ],
    screenOpts: [
      { v: 2, l: '< 3h' }, { v: 4, l: '3–5h' }, { v: 6.5, l: '5–8h' }, { v: 9.5, l: '8–11h' }, { v: 12, l: '> 11h' }
    ],
    alcoholOpts: [
      { v: 0, l: '没喝' }, { v: 1, l: '1 杯' }, { v: 2, l: '2 杯+' }
    ],
    exerciseOpts: [
      { v: 0, l: '0' }, { v: 20, l: '< 30′' }, { v: 45, l: '30–60′' }, { v: 75, l: '60–90′' }, { v: 120, l: '> 90′' }
    ],
    foods: ['奶酪/乳制品', '红酒', '巧克力', '加工肉制品', '腌制品', '含味精/鸡精', '代糖', '柑橘', '坚果', '冰淇淋', '豆类/豆制品', '动物内脏', '无花果', '香蕉', '洋葱', '麸质/面食'],
    menstrual: [
      { v: '', l: '不适用' }, { v: 'pre', l: '经前 1–3 天' }, { v: 'during', l: '经期中' },
      { v: 'post', l: '经期后' }, { v: 'none', l: '非经期' }, { v: 'peri', l: '更年期' }
    ],
    locations: ['左侧', '右侧', '双侧', '后枕', '前额', '眼周', '整个头'],
    qualities: ['搏动/跳痛', '压迫/紧箍', '胀痛', '针刺/电击', '钝痛'],
    symptoms: ['恶心', '呕吐', '畏光', '畏声', '眩晕', '视觉先兆', '视物模糊', '颈肩僵硬', '流泪鼻塞', '肢体麻木'],
    meds: ['未用药', '布洛芬', '对乙酰氨基酚', '阿司匹林', '双氯芬酸', '萘普生', '佐米曲普坦', '利扎曲普坦', '复方止痛药（含咖啡因）', '其他'],
    // 发作前 0–24 小时的前驱表现：用来识别「因果倒置」（想吃巧克力可能已经是发作的一部分）
    prodrome: ['频繁打哈欠', '嗜睡/异常疲倦', '情绪低落或烦躁', '特别想吃某种东西', '颈部僵硬', '频繁排尿', '注意力涣散', '恶心感', '无明显前驱'],
    relief: [
      { v: 'resolved', l: '完全缓解' }, { v: 'partial', l: '部分缓解' }, { v: 'none', l: '无效' }, { v: '', l: '还未评估' }
    ],
    impact: [
      { v: 0, l: '没影响' }, { v: 1, l: '轻微' }, { v: 2, l: '影响工作' }, { v: 3, l: '只能卧床' }
    ]
  };

  // 每日打卡里的"今天还遇到这些吗"分组 —— 全部平铺可见，不折叠
  const TOGGLE_GROUPS = [
    {
      key: 'env', title: '环境与感官刺激',
      items: [
        ['weather', '天气 / 气压变化', '暴风雨来临前、气压下降时最常见'],
        ['heat', '闷热高湿', ''],
        ['coldWind', '骤冷 / 空调直吹', '空调、风扇对着吹'],
        ['glare', '强光反光', '阳光刺眼、水面或屏幕反光'],
        ['flicker', '频闪灯光', '老旧荧光灯、坏灯管、低频调光'],
        ['noise', '强噪音', '突如其来的或持续的巨大声响'],
        ['smell', '强烈气味', '香水、油漆、油烟、清洁剂'],
        ['smoke', '烟味 / 二手烟', ''],
        ['altitude', '高海拔', '登山、高原出差'],
        ['travel', '长途出行 / 时差', '跨时区、坐夜车']
      ]
    },
    {
      key: 'body', title: '身体状态与情绪',
      items: [
        ['skipMeal', '跳餐 / 饿肚子', '低血糖是明确诱因'],
        ['overwork', '体力透支', '加班、熬夜赶工、长途奔波'],
        ['posture', '久坐伏案', '连续几小时同一姿势'],
        ['emotion', '情绪波动', '激动、争吵、受惊、极度紧张'],
        ['snore', '打鼾 / 憋醒', '可能提示睡眠呼吸暂停，晨起头痛要留意'],
        ['sexual', '有性生活', ''],
        ['trauma', '头部撞击', '']
      ]
    },
    {
      key: 'med', title: '药物与激素',
      items: [
        ['hormoneMed', '激素类药', '口服避孕药、激素替代治疗'],
        ['vasodilator', '血管扩张药', '硝酸甘油等']
      ]
    }
  ];

  const ICON = {
    today: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4.5" width="18" height="16.5" rx="3.2"/><path d="M8 2.8v3.4M16 2.8v3.4M3 9.6h18"/><circle cx="12" cy="15.2" r="1.6" fill="currentColor" stroke="none"/></svg>',
    list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r="1.3" fill="currentColor" stroke="none"/><circle cx="4" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="4" cy="18" r="1.3" fill="currentColor" stroke="none"/></svg>',
    chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V9M10 20V4M16 20v-7M22 20H2"/></svg>',
    gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-2.88 1.2V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 7.1 19.4a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 3 15a1.7 1.7 0 0 0-1.55-1H1.3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 3 8.9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 7.4 4.4h.1A1.7 1.7 0 0 0 9 2.85V2.7a2 2 0 1 1 4 0v.1A1.7 1.7 0 0 0 14.6 4.4a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.6 9v.1a1.7 1.7 0 0 0 1.55 1h.15a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.8 1z"/></svg>',
    bolt: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 4.5 13.5H11L10 22l8.5-11.5H12z"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5 9.5 18 20 6.5"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>'
  };

  /* ---------- 状态 ---------- */

  const state = {
    tab: 'today',
    settings: null,
    ds: null,
    range: '90',
    lag: 0,
    heatMonths: 3,
    openFolds: {},
    sheet: null,
    draft: null,
    emailSent: false,
    emailDraft: '',
    cloudMsg: ''
  };

  /* ---------- 工具 ---------- */

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  let toastTimer = null;
  function toast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
  }

  function sevClass(v) {
    const n = Number(v) || 0;
    if (n <= 2) return 's1';
    if (n <= 4) return 's2';
    if (n <= 6) return 's3';
    if (n <= 8) return 's4';
    return 's5';
  }
  function sevColor(v) {
    const n = Number(v) || 0;
    if (n <= 0) return '#DDE2E7';
    if (n <= 2) return 'var(--sev-1)';
    if (n <= 4) return 'var(--sev-2)';
    if (n <= 6) return 'var(--sev-3)';
    if (n <= 8) return 'var(--sev-4)';
    return 'var(--sev-5)';
  }

  function durText(a) {
    if (!a.startAt || !a.endAt) return '';
    const m = Math.round((new Date(a.endAt) - new Date(a.startAt)) / 60000);
    if (m <= 0) return '';
    if (m < 60) return m + ' 分钟';
    const h = Math.floor(m / 60), r = m % 60;
    return h + ' 小时' + (r ? ' ' + r + ' 分' : '');
  }

  /* ---------- 通用组件 ---------- */

  function chips(field, options, selected, opts) {
    const multi = opts && opts.multi;
    const vals = multi ? (Array.isArray(selected) ? selected : []) : [selected];
    return '<div class="chips">' + options.map((o) => {
      const v = typeof o === 'object' ? o.v : o;
      const l = typeof o === 'object' ? o.l : o;
      const on = vals.indexOf(v) >= 0;
      return '<button type="button" class="chip' + (on ? ' on' : '') + '" data-chip="' + esc(field) + '" data-val="' + esc(v) + '" data-multi="' + (multi ? 1 : 0) + '">' + esc(l) + '</button>';
    }).join('') + '</div>';
  }

  function seg(field, options, value, opts) {
    const vertical = opts && opts.vertical;
    return '<div class="seg' + (vertical ? ' vertical' : '') + '" data-seg="' + esc(field) + '">' + options.map((o) => {
      const on = String(o.v) === String(value == null ? '' : value);
      return '<button type="button" data-seg-val="' + esc(o.v) + '" class="' + (on ? 'on' : '') + '">' + esc(o.l) + '</button>';
    }).join('') + '</div>';
  }

  function fieldWrap(label, inner, hint, val) {
    return '<div class="field">' +
      '<div class="field-label"><span>' + esc(label) + '</span>' + (val != null ? '<span class="val">' + esc(val) + '</span>' : '') + '</div>' +
      inner +
      (hint ? '<div class="field-hint">' + hint + '</div>' : '') +
      '</div>';
  }

  function toggle(field, on, label, desc) {
    return '<div class="switch-row"><div><div class="lab">' + esc(label) + '</div>' +
      (desc ? '<div class="desc">' + esc(desc) + '</div>' : '') +
      '</div><button type="button" class="switch' + (on ? ' on' : '') + '" data-toggle="' + esc(field) + '"></button></div>';
  }

  /* ---------- 渲染 ---------- */

  const TABS = ['today', 'records', 'analysis', 'settings'];

  function tabFromHash() {
    const h = String(location.hash || '').replace('#', '');
    return TABS.indexOf(h) >= 0 ? h : 'today';
  }

  function render() {
    const app = document.getElementById('app');
    let body = '';
    if (state.tab === 'today') body = viewToday();
    else if (state.tab === 'records') body = viewRecords();
    else if (state.tab === 'analysis') body = viewAnalysis();
    else body = viewSettings();
    app.innerHTML = body + navHTML();
  }

  function navHTML() {
    const items = [
      ['today', '今天', ICON.today],
      ['records', '记录', ICON.list],
      ['analysis', '分析', ICON.chart],
      ['settings', '设置', ICON.gear]
    ];
    return '<nav class="nav">' + items.map((it) =>
      '<button data-act="tab" data-tab="' + it[0] + '" class="' + (state.tab === it[0] ? 'on' : '') + '">' + it[2] + '<span>' + it[1] + '</span></button>'
    ).join('') + '</nav>';
  }

  function topbar(title, sub, rightHTML) {
    return '<div class="topbar"><div><div class="date-cn">' + S.dateStr().replace(/-/g, '.') + ' · ' + S.WEEK_CN[new Date().getDay()] + '</div>' +
      '<h1>' + esc(title) + '</h1>' + (sub ? '<div class="sub">' + sub + '</div>' : '') +
      '</div>' + (rightHTML || '') + '</div>';
  }

  /* ---------- 今天 ---------- */

  function viewToday() {
    const today = S.dateStr();
    const day = state.ds.dayIndex.get(today);
    const todayAttacks = state.ds.attackByDate.get(today) || [];

    let hero;
    if (day) {
      const bits = [];
      if (day.sleep != null) bits.push({ k: '睡眠', v: sleepLabel(day.sleep) });
      if (day.stress != null) bits.push({ k: '压力', v: day.stress + '/5' });
      if (day.caffeine != null) bits.push({ k: '咖啡因', v: day.caffeine + ' 杯' });
      if (day.water != null) bits.push({ k: '饮水', v: waterLabel(day.water) });
      hero = '<div class="card hero">' +
        '<div class="hero-row"><div class="hero-badge">' + ICON.check + '</div>' +
        '<div class="hero-txt"><div class="t1">今天已打卡</div>' +
        '<div class="t2">' + (day.hadHeadache ? '记录了头痛' : '无头痛') + ' · 点击可修改</div></div></div>' +
        '<div class="stat-grid mt-16" style="grid-template-columns:repeat(' + Math.min(4, bits.length || 1) + ',1fr)">' + bits.map((b) =>
          '<div class="stat-cell"><div class="v">' + esc(b.v) + '</div><div class="k">' + esc(b.k) + '</div></div>'
        ).join('') + '</div>' +
        '<div class="btn-row mt-12"><button class="btn ghost sm" data-act="edit-day" data-date="' + today + '">修改今日打卡</button></div>' +
        '</div>';
    } else {
      hero = '<div class="card hero">' +
        '<div class="hero-row"><div class="hero-badge">' + ICON.today + '</div>' +
        '<div class="hero-txt"><div class="t1">今天还没打卡</div>' +
        '<div class="t2">花 20 秒记录今天，分析才有对照</div></div></div>' +
        '<div class="mt-16"><button class="btn" data-act="edit-day" data-date="' + today + '">开始今日打卡</button></div>' +
        '</div>';
    }

    const streak = calcStreak();

    let attackList = '';
    if (todayAttacks.length) {
      attackList = '<div class="section-title">今天的发作</div><div class="card pad-0">' +
        todayAttacks.map(attackRow).join('') + '</div>';
    }

    const recent = state.ds.attacks.slice().reverse().slice(0, 3).filter((a) => !todayAttacks.some((t) => t.id === a.id));
    let recentHTML = '';
    if (recent.length) {
      recentHTML = '<div class="section-title">最近</div><div class="card pad-0">' +
        recent.map(attackRow).join('') + '</div>';
    }

    return topbar('头疼日记', null) +
      hero +
      '<div class="mt-12"><button class="btn" data-act="new-attack" style="background:#B4553F">' +
      '<span style="width:18px;height:18px;display:inline-block">' + ICON.bolt + '</span> 头痛发作了，记一下</button></div>' +
      '<div class="center tiny mt-8">记录越完整，越容易找出规律</div>' +
      attackList + recentHTML +
      '<div class="section-title">连续记录</div>' +
      '<div class="card"><div class="flex"><div class="grow"><div style="font-size:26px;font-weight:650">' + streak + ' <span style="font-size:14px;font-weight:500;color:var(--ink-3)">天</span></div>' +
      '<div class="tiny mt-8">每天打卡，数据才站得住脚</div></div>' +
      '<button class="btn ghost sm" data-act="tab" data-tab="analysis">看分析</button></div></div>';
  }

  function sleepLabel(v) {
    const o = CFG.sleepOpts.find((x) => Math.abs(x.v - v) < 0.01);
    return o ? o.l + 'h' : v + 'h';
  }
  function waterLabel(v) {
    const o = CFG.waterOpts.find((x) => Math.abs(x.v - v) < 0.01);
    return o ? o.l : v + '';
  }

  function calcStreak() {
    let n = 0;
    let d = S.dateStr();
    for (let i = 0; i < 400; i++) {
      if (state.ds.dayIndex.has(d)) { n++; d = S.addDays(d, -1); }
      else if (i === 0) { d = S.addDays(d, -1); }
      else break;
    }
    return n;
  }

  function attackRow(a) {
    const sev = Number(a.severity) || 0;
    const sym = (a.symptoms || []).slice(0, 3).join('、');
    const sub = [S.fmtTime(a.startAt), durText(a), sym].filter(Boolean).join(' · ');
    return '<button class="list-item" data-act="edit-attack" data-id="' + esc(a.id) + '">' +
      '<span class="dot" style="background:' + sevColor(sev) + '"></span>' +
      '<div class="li-main"><div class="li-t">头痛 <b style="color:' + sevColor(sev) + '">' + sev + '</b>/10' +
      (a.medicine && a.medicine !== '未用药' ? ' <span class="pill calm">' + esc(a.medicine) + '</span>' : '') +
      '</div><div class="li-s">' + esc(sub || '无更多细节') + '</div></div>' +
      '<div class="li-date">' + S.fmtDateShort(a.date) + '</div></button>';
  }

  /* ---------- 记录 ---------- */

  function viewRecords() {
    const days = state.ds.days.slice().reverse();
    const attackOnly = state.ds.attacks.filter((a) => !state.ds.dayIndex.has(a.date));

    const rows = [];
    days.forEach((d) => {
      rows.push({ date: d.date, type: 'day', obj: d });
    });
    attackOnly.forEach((a) => {
      rows.push({ date: a.date, type: 'attack', obj: a });
    });
    rows.sort((x, y) => (x.date < y.date ? 1 : x.date > y.date ? -1 : 0));

    if (!rows.length) {
      return topbar('记录', '还没有任何记录') +
        '<div class="card"><div class="empty">从今天开始，先做一次打卡。<br>哪怕这天没头痛，也要记 —— 那是分析的对照。</div>' +
        '<button class="btn mt-12" data-act="edit-day" data-date="' + S.dateStr() + '">今日打卡</button></div>';
    }

    // 按月份分组
    const groups = [];
    let g = null;
    rows.forEach((r) => {
      const m = r.date.slice(0, 7);
      if (!g || g.month !== m) { g = { month: m, items: [] }; groups.push(g); }
      g.items.push(r);
    });

    const html = groups.map((grp) => {
      const p = grp.month.split('-');
      return '<div class="month-head">' + p[0] + ' 年 ' + Number(p[1]) + ' 月</div><div class="card pad-0">' +
        grp.items.map((r) => {
          if (r.type === 'attack') return attackRow(r.obj);
          return dayRow(r.obj);
        }).join('') + '</div>';
    }).join('');

    const head = topbar('记录', '共 ' + rows.length + ' 条', 
      '<button class="btn ghost sm" data-act="edit-day" data-date="' + S.dateStr() + '">打卡</button>');

    return head + '<div class="mt-8"></div>' + html;
  }

  function dayRow(d) {
    const hd = state.ds.headacheDates.has(d.date);
    const attacks = state.ds.attackByDate.get(d.date) || [];
    const maxSev = attacks.length ? Math.max.apply(null, attacks.map((a) => Number(a.severity) || 0)) : null;
    const bits = [];
    if (d.sleep != null) bits.push('睡 ' + sleepLabel(d.sleep));
    if (d.stress != null) bits.push('压力 ' + d.stress);
    if (d.caffeine != null) bits.push('咖啡 ' + d.caffeine);
    if (d.alcohol) bits.push('饮酒');
    if (d.skipMeal) bits.push('跳餐');
    if (d.weather) bits.push('气压变化');
    if (d.heat) bits.push('闷热');
    if (d.coldWind) bits.push('冷风');
    if (d.noise) bits.push('噪音');
    if (d.glare) bits.push('强光');
    if (d.flicker) bits.push('频闪');
    if (d.smell) bits.push('气味');
    if (d.smoke) bits.push('烟味');
    if (d.overwork) bits.push('劳累');
    if (d.emotion) bits.push('情绪');
    if (d.posture) bits.push('伏案');
    if (d.snore) bits.push('打鼾');
    if (d.sexual) bits.push('性生活');
    if (d.trauma) bits.push('头部撞击');
    if (d.travel) bits.push('出行');
    if (d.altitude) bits.push('高海拔');
    if (d.hormoneMed) bits.push('激素药');
    if (d.vasodilator) bits.push('血管药');
    if (d.menstrual === 'pre') bits.push('经前');
    else if (d.menstrual === 'during') bits.push('经期中');
    else if (d.menstrual === 'post') bits.push('经期后');
    else if (d.menstrual === 'peri') bits.push('更年期');
    if (d.foods && d.foods.length) bits.push(d.foods.slice(0, 2).join('/'));
    const bitText = bits.length > 5 ? bits.slice(0, 5).join(' · ') + ' 等' : bits.join(' · ');

    return '<button class="list-item" data-act="edit-day" data-date="' + esc(d.date) + '">' +
      '<span class="dot" style="background:' + (hd ? sevColor(maxSev || 3) : '#CDD5DC') + '"></span>' +
      '<div class="li-main"><div class="li-t">' +
      (hd ? '头痛日' : '无头痛') +
      (maxSev != null ? ' <span class="pill warn">' + maxSev + '/10</span>' : '') +
      '</div><div class="li-s">' + esc(bitText || '未填细节') + '</div></div>' +
      '<div class="li-date">' + S.fmtDateCN(d.date, false) + '<br>' + S.WEEK_CN[S.parseDate(d.date).getDay()] + '</div></button>';
  }

  /* ---------- 分析 ---------- */

  function viewAnalysis() {
    const full = state.ds;
    const ds = A.sliceRange(full, state.range);
    const sum = A.summary(ds);
    const quality = A.dataQuality(ds);
    const factors = A.factorStats(ds, { lag: state.lag, menstrual: true });
    const nums = A.numericCompare(ds);
    const dist = A.distribution(ds);
    const heat = A.heatmap(full, state.heatMonths);
    const load = A.loadStats(ds);
    const moh = A.medicationRisk(full, 30);
    const prod = A.prodromeStats(ds);
    const guess = A.guessCompare(ds);

    const head = topbar('分析', '找出跟你头痛真正相关的因素');

    const rangeSeg = '<div class="seg" data-seg="__range" style="margin-bottom:14px">' +
      [['30', '近 30 天'], ['90', '近 90 天'], ['180', '近半年'], ['all', '全部']].map((r) =>
        '<button data-range="' + r[0] + '" class="' + (state.range === r[0] ? 'on' : '') + '">' + r[1] + '</button>'
      ).join('') + '</div>';

    if (sum.totalRecorded === 0 && sum.attackCount === 0) {
      return head + rangeSeg + '<div class="card"><div class="empty">这个时间段还没有数据。<br>先打卡几天，再来看规律。</div></div>';
    }

    const kpi = '<div class="kpi-row">' +
      kpiCell('打卡天数', sum.totalRecorded, '天', '有每日记录的日子') +
      kpiCell('头痛天数', sum.headacheDays, '天', sum.rate != null ? '占记录日 ' + Math.round(sum.rate * 100) + '%' : '') +
      kpiCell('发作次数', sum.attackCount, '次', '') +
      kpiCell('平均强度', sum.avgSeverity != null ? sum.avgSeverity.toFixed(1) : '—', sum.avgSeverity != null ? '/10' : '', sum.avgDuration ? '平均持续 ' + Math.round(sum.avgDuration) + ' 分' : '') +
      '</div>';

    // 数据质量提示
    let qualityHTML = '';
    if (quality.issues.length) {
      qualityHTML = '<div class="insight">' + quality.issues.map((i) => '· ' + i.text.replace(/\*\*/g, '')).join('<br>') +
        '<br><span style="opacity:.75">' + quality.noHeadacheDays + ' 个无头痛日 / ' + quality.headacheDays + ' 个头痛日可做对照。</span></div>';
    }

    // 前驱期提醒（因果倒置）
    let prodHTML = '';
    if (prod.ratio != null && prod.ratio >= 0.25 && prod.withProdrome >= 2) {
      prodHTML = '<div class="insight plain">' + prod.total + ' 次发作里，有 <b>' + prod.withProdrome + '</b> 次在发作前几小时就出现了前驱表现' +
        (prod.top.length ? '（最多见：' + prod.top.slice(0, 3).map((t) => t.label + ' ' + t.n + ' 次').join('、') + '）' : '') +
        '。<br>这类表现会制造假的诱因：比如「特别想吃巧克力」往往已经是发作开始的一部分，而不是原因。看到食物类因素时，先分辨它是不是只在前驱期才出现。</div>';
    }

    // 诱因
    const lagSeg = '<div class="seg" data-seg="__lag" style="margin-bottom:12px">' +
      '<button data-lag="0" class="' + (state.lag === 0 ? 'on' : '') + '">看当天</button>' +
      '<button data-lag="1" class="' + (state.lag === 1 ? 'on' : '') + '">看前一天</button>' +
      '<button data-lag="2" class="' + (state.lag === 2 ? 'on' : '') + '">看前两天</button>' +
      '</div>';

    const strong = factors.filter((f) => f.strength === 'high' || f.strength === 'mid').slice(0, 12);
    const weak = factors.filter((f) => f.strength === 'low').slice(0, 14);

    let factorHTML = '';
    if (strong.length) {
      factorHTML += '<div class="card pad-0">' + strong.map(factorRow).join('') + '</div>';
    } else {
      factorHTML += '<div class="card"><div class="empty">还没有哪个因素显示出明显关联。<br>通常需要 20–30 天、且无头痛日也有打卡的数据。</div></div>';
    }
    if (weak.length) {
      const shown = state.showWeakAll ? weak : weak.slice(0, 3);
      factorHTML += '<div class="section-title">数据太少、暂不可判断 <span style="font-weight:400;text-transform:none">（继续记录）</span></div>' +
        '<div class="card pad-0">' + shown.map(factorRowWeak).join('') + '</div>';
      if (weak.length > 3) {
        factorHTML += '<button class="btn line sm mt-12" style="width:100%" data-act="toggle-weak">' +
          (state.showWeakAll ? '收起' : '展开其余 ' + (weak.length - 3) + ' 项') + '</button>';
      }
    }

    // 你以为的 vs 数据说的
    let guessHTML = '';
    if (guess.rows.length) {
      const rows = guess.rows.slice(0, 6).map((r) => {
        const b = r.best;
        let verdict, cls;
        if (!b) { verdict = '暂无对应数据'; cls = 'cool'; }
        else if (b.diff >= 0.15) { verdict = '数据支持 ' + (b.rr === Infinity ? '∞' : b.rr.toFixed(1) + '×'); cls = 'hot'; }
        else if (b.diff <= -0.05) { verdict = '数据反而更低'; cls = 'cool'; }
        else { verdict = '数据没支持'; cls = 'mid'; }
        return '<div class="factor"><div class="factor-top">' +
          '<span class="factor-name">' + esc(r.label) + '</span>' +
          '<span class="factor-rr ' + cls + '">' + esc(verdict) + '</span></div>' +
          '<div class="factor-meta"><span>你选了 ' + r.n + ' 次</span>' +
          (b ? '<span>有它时 <b>' + Math.round(b.p1 * 100) + '%</b> vs 无它 <b>' + Math.round(b.p0 * 100) + '%</b></span>' : '<span>—</span>') +
          '</div></div>';
      }).join('');
      guessHTML = '<div class="section-title">你以为的 vs 数据说的</div>' +
        '<div class="card pad-0">' + rows + '</div>' +
        (guess.missed.length ? '<div class="insight plain mt-12">你可能一直忽略的：' +
          guess.missed.map((f) => '「' + f.label + '」' + (f.rr === Infinity ? '∞' : f.rr.toFixed(1) + '×')).join('、') +
          '。这些在数据上比你以为的更明显。</div>' : '');
    }

    // 多因素叠加
    let loadHTML = '';
    if (load.evaluableDays >= 10) {
      loadHTML = '<div class="section-title">多因素叠加 <span style="font-weight:400;text-transform:none">当天同时踩中几条</span></div>' +
        '<div class="card">' +
        load.buckets.map((b) => {
          const pct = b.rate == null ? 0 : Math.round(b.rate * 100);
          const w = b.n && pct > 0 ? Math.max(2, pct) : 0;
          const label = b.count >= 3 ? '3 项以上' : b.count + ' 项';
          const color = b.count >= 3 ? '#B4553F' : b.count === 2 ? '#C98A6B' : '#9FB3C4';
          return '<div style="margin-bottom:11px">' +
            '<div style="display:flex;justify-content:space-between;font-size:12.5px;color:var(--ink-2);margin-bottom:4px">' +
            '<span>' + label + '</span><span>' + (b.n ? pct + '% · ' + b.n + ' 天' : '—') + '</span></div>' +
            '<div class="bar-track"><div style="width:' + w + '%;height:100%;border-radius:99px;background:' + color + '"></div></div></div>';
        }).join('') +
        '<div class="field-hint mt-8">统计项：睡眠不足、睡眠质量差、压力大、跳餐、饮水少、饮酒、气压变化、颈肩紧张。</div>' +
        '</div>' +
        (load.lowRate != null && load.highRate != null
          ? '<div class="insight mt-12">0–1 项时头痛率 <b>' + Math.round(load.lowRate * 100) + '%</b>，2 项以上是 <b>' + Math.round(load.highRate * 100) + '%</b>。' +
            (load.highRate > load.lowRate + 0.1
              ? '这说明你更像是被「几件小事叠在一起」推过阈值的 —— 单躲某一个因素往往不够。'
              : '目前看不出明显的叠加效应，单一因素可能更值得关注。') + '</div>'
          : '');
    }

    // 药物过度使用
    let mohHTML = '';
    if (moh.totalDays > 0) {
      const lv = moh.level === 'risk'
        ? { t: '已达过度使用风险', c: '#B4553F' }
        : moh.level === 'warn' ? { t: '接近过度使用', c: '#B4793F' } : { t: '频率安全', c: 'var(--ink-3)' };
      let body;
      if (moh.level === 'risk') {
        body = '<div class="insight mt-12" style="background:#FBEFEC">近 ' + moh.windowDays + ' 天里，曲普坦或含咖啡因复方用了 <b>' + moh.specificDays +
          '</b> 天、单纯止痛药 <b>' + moh.simpleDays + '</b> 天。达到这个频率后，头痛本身会被药物反过来维持，形成「越吃越痛、越痛越吃」。' +
          '<br>这不是让你硬扛。带上这份记录找神经内科，通常需要用预防性用药来脱困。</div>';
      } else {
        body = '<div class="field-hint mt-12">控制在这个频率内，止痛药一般不会反过来加重头痛。临床上把「曲普坦 / 含咖啡因复方每月 ≥10 天」或「单纯止痛药每月 ≥15 天」视为药物过度使用性头痛的门槛。</div>';
      }
      mohHTML = '<div class="section-title">用药与反弹性头痛</div><div class="card">' +
        '<div class="flex" style="align-items:center;gap:8px"><div class="grow" style="min-width:0;font-size:14px;font-weight:600">' +
        '近 ' + moh.windowDays + ' 天有 <span style="color:' + lv.c + '">' + moh.totalDays + '</span> 天用了止痛药</div>' +
        '<span class="pill" style="color:' + lv.c + '">' + lv.t + '</span></div>' +
        '<div class="tiny mt-8">单纯止痛药 ' + moh.simpleDays + ' 天 · 曲普坦 / 含咖啡因复方 ' + moh.specificDays + ' 天</div>' +
        body + '</div>';
    }

    // 数值对比
    let numHTML = '';
    if (nums.length) {
      numHTML = '<div class="section-title">头痛日 vs 无头痛日</div><div class="card pad-0">' +
        nums.map((f) => {
          const delta = f.delta;
          const flat = Math.abs(delta) < (f.min || 0.01);
          const sign = delta > 0 ? '高' : '低';
          const color = flat ? 'var(--ink-3)' : '#C0503F';
          const text = flat ? '基本持平' : sign + ' ' + Math.abs(delta).toFixed(f.digits) + ' ' + f.unit;
          return '<div class="factor"><div class="factor-top">' +
            '<span class="factor-name">' + esc(f.label) + '</span>' +
            '<span class="factor-rr" style="color:' + color + '">' + text + '</span></div>' +
            '<div class="factor-meta mt-8"><span>头痛日 <b>' + f.hv.toFixed(f.digits) + '</b> ' + f.unit + '（' + f.h + ' 天）</span>' +
            '<span>无痛日 <b>' + f.nv.toFixed(f.digits) + '</b> ' + f.unit + '（' + f.n + ' 天）</span></div></div>';
        }).join('') + '</div>';
    }

    // 分布
    let distHTML = '<div class="section-title">发作时间分布</div><div class="card">' +
      '<div class="field-label"><span>一天中的时段</span></div>' +
      dist.hours.map((h) => barLine(h.label, h.n, dist.maxHour, '#7C9AB5')).join('') +
      '<div class="divider"></div>' +
      '<div class="field-label"><span>星期</span><span class="val" style="font-size:12px">工作日 ' + dist.weekdays + ' / 周末 ' + dist.weekend + '</span></div>' +
      dist.week.map((h) => barLine(h.label, h.n, dist.maxWeek, '#B9A88E')).join('') +
      '</div>';

    // 热力图
    const weekHead = '<div class="heat-week">' + ['日', '一', '二', '三', '四', '五', '六'].map((w) => '<span>' + w + '</span>').join('') + '</div>';
    const heatHTML = '<div class="section-title">日历 <span style="font-weight:400;text-transform:none">颜色越深痛得越厉害</span></div>' +
      '<div class="card">' +
      heat.map((m) => '<div class="heat-month">' +
        '<div class="heat-title">' + m.label + '</div>' + weekHead +
        '<div class="heat-grid">' + m.cells.map((c) => {
          if (!c) return '<div class="heat-cell empty-cell"></div>';
          const bg = c.headache ? sevColor(c.severity || 3) : (c.recorded ? '#E6EBEF' : '#F4F6F8');
          const cls = c.headache ? ' has-data' : (c.recorded ? ' has-rec' : '');
          return '<button class="heat-cell' + cls + '" style="background:' + bg + '" data-act="jump-day" data-date="' + c.date + '">' + c.day + '</button>';
        }).join('') + '</div></div>').join('') +
      '<div class="heat-legend">轻 <i style="background:var(--sev-1)"></i><i style="background:var(--sev-2)"></i><i style="background:var(--sev-3)"></i><i style="background:var(--sev-4)"></i><i style="background:var(--sev-5)"></i> 重' +
      ' <span style="margin-left:6px">浅灰 = 有打卡无头痛　白色 = 无记录</span></div>' +
      '</div>';

    // 结论文本
    const top = strong.filter((f) => f.diff > 0 && f.strength !== 'low');
    let insight = '';
    if (top.length) {
      const t = top.slice(0, 3).map((f) => '「' + f.label + '」').join('、');
      insight = '<div class="insight">在你当前的记录里，' + t + ' 出现时，头痛的比例明显更高。' +
        '<br>数值只是相关，不是因果 —— 但值得优先规避它们试试。<br>' +
        '<span style="opacity:.75">说明：这些结论建立在 ' + ds.days.length + ' 天打卡、' + sum.headacheDays + ' 个头痛日之上，样本越多越可靠。</span></div>';
    } else if (ds.days.length > 0) {
      insight = '<div class="insight plain">目前还没有足够强的关联。继续每天打卡（包括不头痛的日子），通常在 3–4 周后会浮现出规律。</div>';
    }

    return head + rangeSeg + kpi + qualityHTML + prodHTML + insight +
      '<div class="section-title">诱因排行 <span style="font-weight:400;text-transform:none">按头痛率差异排序</span></div>' +
      lagSeg +
      '<div class="tiny mb-12" style="padding:0 4px">同一天的因素更可能是即时影响；前一两天的更可能是延迟影响 —— 酒精、睡眠、食物常常延迟 6 小时到 2 天才发作。</div>' +
      factorHTML + guessHTML + loadHTML + numHTML + mohHTML + distHTML + heatHTML;
  }

  function kpiCell(k, v, unit, t) {
    return '<div class="kpi"><div class="k">' + esc(k) + '</div>' +
      '<div class="v">' + esc(v) + (unit ? '<small>' + esc(unit) + '</small>' : '') + '</div>' +
      (t ? '<div class="t">' + esc(t) + '</div>' : '') + '</div>';
  }

  function barLine(label, n, max, color) {
    const w = (n <= 0 || max <= 0) ? 0 : Math.max(3, Math.round((n / max) * 100));
    return '<div style="margin-bottom:9px"><div style="display:flex;justify-content:space-between;font-size:12.5px;color:var(--ink-2);margin-bottom:4px">' +
      '<span>' + esc(label) + '</span><span>' + n + ' 次</span></div>' +
      '<div class="bar-track"><div style="width:' + w + '%;background:' + color + ';height:100%;border-radius:99px"></div></div></div>';
  }

  function factorRow(f) {
    const p1 = Math.round(f.p1 * 100), p0 = Math.round(f.p0 * 100);
    let rrText;
    if (f.rr === null) rrText = '—';
    else if (f.rr === Infinity) rrText = '∞';
    else if (f.rr === 0) rrText = '没痛过';
    else rrText = f.rr < 0.15 ? '< 0.1×' : f.rr.toFixed(1) + '×';
    const rrCls = f.rr === null ? 'cool' : (f.diff > 0.05 ? 'hot' : (f.diff < -0.05 ? 'cool' : 'mid'));
    const bar = (label, pct, cls) =>
      '<div style="display:flex;align-items:center;gap:8px;margin-top:5px">' +
      '<span style="font-size:10.5px;color:var(--ink-3);width:20px;flex:0 0 auto">' + label + '</span>' +
      '<div class="bar-track" style="flex:1;margin:0"><div class="' + cls + '" style="width:' + Math.max(1.5, pct) + '%"></div></div>' +
      '</div>';
    return '<div class="factor">' +
      '<div class="factor-top"><span class="factor-name">' + esc(f.label) + '</span>' +
      '<span class="factor-rr ' + rrCls + '">' + rrText + '</span></div>' +
      bar('有', p1, 'bar-a') + bar('无', p0, 'bar-b') +
      '<div class="factor-meta" style="margin-top:8px"><span>' + f.n1 + ' 天有 / ' + f.n0 + ' 天无</span>' +
      '<span>头痛率 <b>' + p1 + '%</b> vs <b>' + p0 + '%</b></span></div></div>';
  }

  function factorRowWeak(f) {
    return '<div class="factor"><div class="factor-top"><span class="factor-name" style="color:var(--ink-2)">' + esc(f.label) + '</span>' +
      '<span class="factor-rr cool">' + f.n1 + ' 天有 / ' + f.n0 + ' 天无</span></div></div>';
  }

  /* ---------- 设置 ---------- */

  /* ---------- 云同步卡片 ---------- */

  function cloudCard() {
    const C = window.Cloud;
    if (!C) {
      return '<div class="card"><div style="font-size:14px;font-weight:600">云端备份</div>' +
        '<div class="tiny mt-8">云服务组件未加载，刷新页面再试。</div></div>';
    }
    if (!C.isSignedIn()) {
      const err = C.error ? '<div class="field-hint" style="color:#B4483A;margin-top:8px">' + esc(C.error) + '</div>' : '';
      return '<div class="card">' +
        '<div style="font-size:14px;font-weight:600">云端备份</div>' +
        '<div class="tiny mt-8">登录后，每天的打卡会同时存一份到云端。换手机或电脑登录同一账号，记录就跟过来。' +
        '<br>不登录也能照常用，只是数据仅在本机。</div>' +
        '<div class="divider"></div>' +
        '<button class="btn" data-act="cloud-workbuddy">使用 WorkBuddy 登录</button>' +
        '<button class="btn line sm" style="margin-top:8px" data-act="cloud-email">用邮箱验证码登录</button>' +
        err + '</div>';
    }
    const ts = C.lastSyncAt();
    const when = ts ? esc(S.fmtDateTime(ts)) : '还没同步过';
    return '<div class="card">' +
      '<div class="flex"><div class="grow"><div style="font-size:14px;font-weight:600">云端已连接</div>' +
      '<div class="tiny mt-8">' + esc(C.accountLabel()) + '</div>' +
      '<div class="tiny mt-8">上次同步 ' + when + '</div></div>' +
      '<span class="pill calm">已同步</span></div>' +
      '<div class="divider"></div>' +
      '<div class="btn-row"><button class="btn ghost sm grow" data-act="cloud-sync">立即同步</button>' +
      '<button class="btn line sm" data-act="cloud-logout">退出登录</button></div>' +
      '</div>';
  }

  function openEmailLoginSheet() {
    const sent = state.emailSent === true;
    const err = state.cloudMsg ? '<div class="field-hint" style="color:#B4483A;margin-top:8px">' + esc(state.cloudMsg) + '</div>' : '';
    let h = '<div class="field-hint">验证码发到邮箱，不用设密码。第一次登录会自动创建账号。</div>';
    h += '<div class="field" style="margin-top:16px"><div class="field-label"><span>邮箱</span></div>' +
      '<input type="email" inputmode="email" autocomplete="email" id="cloudEmail" placeholder="you@example.com" value="' + esc(state.emailDraft || '') + '">' +
      '</div>';
    if (sent) {
      h += '<div class="field"><div class="field-label"><span>验证码</span></div>' +
        '<input type="text" inputmode="numeric" autocomplete="one-time-code" id="cloudCode" placeholder="邮件里的数字" maxlength="8">' +
        '</div>';
      h += '<div class="field-hint">没收到？检查垃圾邮件，或点「重发」。</div>';
    }
    h += err;
    h += '<div class="btn-row sheet-actions">' +
      (sent
        ? '<button class="btn line" data-act="cloud-resend">重发</button><button class="btn grow" data-act="cloud-verify">登录</button>'
        : '<button class="btn grow" data-act="cloud-send-code">获取验证码</button>') +
      '</div>';
    openSheet(sent ? '输入验证码' : '邮箱登录', h);
    state.sheet = { kind: 'cloud-email' };
  }

  function readCloudEmail() {
    const el = document.getElementById('cloudEmail');
    return el ? String(el.value || '').trim() : '';
  }

  function readCloudCode() {
    const el = document.getElementById('cloudCode');
    return el ? String(el.value || '').trim() : '';
  }

  async function cloudAfterLogin() {
    try { await Cloud.syncNow(S); } catch (e) { /* 忽略，稍后可手动同步 */ }
    await reload();
    render();
    toast('已登录，记录已与云端合并');
  }

  function viewSettings() {
    const st = state.settings;
    const head = topbar('设置', '数据存在这台设备，可备份到云端');

    const storageInfo = '<div class="card"><div class="flex"><div class="grow">' +
      '<div style="font-size:14px;font-weight:600">本地存档</div>' +
      '<div class="tiny mt-8">' + state.ds.days.length + ' 天打卡 · ' + state.ds.attacks.length + ' 次发作</div>' +
      '</div><div class="pill">' + (S.mode === 'idb' ? '设备存储' : '兼容模式') + '</div></div>' +
      '<div class="divider"></div>' +
      '<div class="btn-row"><button class="btn ghost sm grow" data-act="export-json">导出存档</button>' +
      '<button class="btn line sm grow" data-act="export-csv">导出表格</button></div>' +
      '<div class="field-hint mt-8">存档是 .json 文件，可在另一台设备「导入」实现手机↔电脑迁移，也可以直接存网盘备份。</div>' +
      '<div class="field-hint" style="color:#B4483A;margin-top:6px">注意：清理浏览器数据 / 无痕模式会一并清掉记录，请定期导出。</div>' +
      '</div>';

    const importCard = '<div class="card"><div style="font-size:14px;font-weight:600;margin-bottom:4px">导入存档</div>' +
      '<div class="tiny mb-12">读取之前导出的 .json 存档，与现有记录合并（新的覆盖旧的）。</div>' +
      '<input type="file" accept="application/json,.json" id="importFile" class="hidden">' +
      '<button class="btn line" data-act="pick-import">选择存档文件</button></div>';

    const optionCard = '<div class="card">' +
      toggle('hideMenstrual', st.hideMenstrual, '隐藏「生理周期」选项', '这一项默认就在打卡表单里。如果与你无关，可以关掉；勾选「不适用」也不会影响分析。') +
      '</div>';

    const aboutCard = '<div class="card"><div style="font-size:14px;font-weight:600;margin-bottom:10px">怎么用才有用</div>' +
      '<div class="onboard-step"><div class="onboard-num">1</div><div><div class="t">每天都打卡，不只是头痛的时候</div>' +
      '<div class="d">这是最关键的一条。只有记录「有诱因但没头痛」的日子，才能算出某个因素到底有没有推高你的头痛概率。只记头痛日，几乎所有因素都会显得可疑。</div></div></div>' +
      '<div class="onboard-step"><div class="onboard-num">2</div><div><div class="t">发作当下立刻记，连前驱期一起记</div>' +
      '<div class="d">疼痛程度、部位、伴随症状，事后再回忆会失真很多。发作前几小时如果有打哈欠、特别想吃什么、情绪变化，也勾上 —— 这些前驱表现能帮你区分「真诱因」和「发作已经开始」。' +
      '</div></div></div>' +
      '<div class="onboard-step"><div class="onboard-num">3</div><div><div class="t">止痛药要记，是因为吃多了会反过来加重头痛</div>' +
      '<div class="d">每月用曲普坦或含咖啡因的复方 ≥10 天、或单纯止痛药 ≥15 天，就可能进入「药物过度使用性头痛」，越吃越痛。分析页会自动帮你算这个天数。</div></div></div>' +
      '<div class="onboard-step"><div class="onboard-num">4</div><div><div class="t">至少坚持 3–4 周再看分析</div>' +
      '<div class="d">样本太少时，任何「风险倍数」都只是噪声。图表里会标注样本不足的因素。</div></div></div>' +
      '<div class="onboard-step"><div class="onboard-num">5</div><div><div class="t">就医时带上导出的表格</div>' +
      '<div class="d">「导出表格」生成的是一天一行的时间表，包含强度、时长、用药与效果，医生看这个比看日记快得多。</div></div></div>' +
      '</div>';

    const dangerCard = '<div class="card"><div style="font-size:14px;font-weight:600;margin-bottom:4px">清空数据</div>' +
      '<div class="tiny mb-12">删除本设备上的全部记录，不可恢复。建议先导出存档。</div>' +
      '<button class="btn danger" data-act="clear-all">清空全部记录</button></div>';

    return head + cloudCard() + storageInfo + importCard + optionCard + aboutCard + dangerCard +
      '<div class="center tiny" style="padding:10px 0 24px;line-height:1.8">头疼日记 · 不登录时记录只保存在这台设备的浏览器里<br>' +
      '本工具用于自我观察和就医参考，不能替代医生的诊断与治疗<br>' +
      '反复头痛或症状加重时，请及时就医</div>';
  }

  /* ---------- 弹层 ---------- */

  function openSheet(title, bodyHTML, opts) {
    closeSheet(true); // 保留 draft：紧接着就要用它渲染新表单
    const root = document.getElementById('sheet-root');
    root.innerHTML = '<div class="sheet-mask" data-act="close-sheet"></div>' +
      '<div class="sheet" role="dialog" aria-modal="true">' +
      '<div class="sheet-head"><h2>' + esc(title) + '</h2>' +
      '<button class="sheet-close" data-act="close-sheet">✕</button></div>' +
      '<div class="sheet-body">' + bodyHTML + '</div></div>';
    requestAnimationFrame(() => {
      const mask = $('.sheet-mask', root), sheet = $('.sheet', root);
      if (mask) mask.classList.add('show');
      if (sheet) sheet.classList.add('show');
    });
    state.sheet = opts || {};
  }

  function closeSheet(keepDraft) {
    const root = document.getElementById('sheet-root');
    const mask = $('.sheet-mask', root), sheet = $('.sheet', root);
    if (mask) mask.classList.remove('show');
    if (sheet) sheet.classList.remove('show');
    state.sheet = null;
    if (!keepDraft) state.draft = null;
    setTimeout(() => { if (!state.sheet) root.innerHTML = ''; }, 280);
  }

  /* ---------- 每日打卡表单 ---------- */

  function defaultDay(date) {
    return {
      date,
      sleep: null, sleepQuality: null, stress: null,
      caffeine: 0, caffeineLate: false,
      water: null, screen: null,
      alcohol: 0, skipMeal: false,
      exercise: 0, neck: null,
      // 环境
      weather: false, heat: false, coldWind: false,
      glare: false, flicker: false, noise: false,
      smell: false, smoke: false, altitude: false, travel: false,
      // 身体与情绪
      overwork: false, posture: false, emotion: false, snore: false, sexual: false, trauma: false,
      // 药物
      hormoneMed: false, vasodilator: false,
      foods: [],
      menstrual: '',
      hadHeadache: null,
      note: '',
      updatedAt: 0
    };
  }

  async function openDaySheet(date) {
    const existing = await S.get('days', date);
    const d = existing ? JSON.parse(JSON.stringify(existing)) : defaultDay(date);
    state.draft = { kind: 'day', data: d };
    renderDaySheet(true);
  }

  function renderDaySheet(firstRender) {
    const d = state.draft.data;
    const st = state.settings;
    if (!firstRender) {
      const body = $('.sheet-body');
      if (body) { body.innerHTML = dayFormHTML(); return; }
    }
    openSheet('每日打卡', dayFormHTML());
  }

  // 布尔开关平铺成芯片：一眼能看到全部项目，点一下即开/关
  function boolChips(items, d) {
    return '<div class="chips">' + items.map((it) => {
      const on = d[it[0]] === true;
      return '<button type="button" class="chip' + (on ? ' on' : '') + '" data-boolchip="' + esc(it[0]) + '"' +
        (it[2] ? ' title="' + esc(it[2]) + '"' : '') + '>' + esc(it[1]) + '</button>';
    }).join('') + '</div>';
  }

  function groupChips(g, d) {
    const active = g.items.filter((it) => d[it[0]] === true).length;
    return '<div class="field">' +
      '<div class="field-label"><span>' + esc(g.title) + '</span>' +
      (active ? '<span class="val">已选 ' + active + '</span>' : '') + '</div>' +
      boolChips(g.items, d) + '</div>';
  }

  function dayFormHTML() {
    const d = state.draft.data;
    const st = state.settings;
    const maxDate = S.dateStr();

    let h = '';
    h += '<div class="field"><div class="field-label"><span>记录日期</span></div>' +
      '<input type="date" value="' + d.date + '" max="' + maxDate + '" data-day-date="1"></div>';

    h += fieldWrap('昨晚睡了多久', seg('sleep', CFG.sleepOpts, d.sleep), '按实际入睡到醒来的时间估算就行', d.sleep != null ? sleepLabel(d.sleep) : '');
    h += fieldWrap('睡眠质量', seg('sleepQuality', CFG.score5, d.sleepQuality), '');
    h += fieldWrap('今天的压力', seg('stress', CFG.stress5, d.stress), '含工作、家庭、情绪上的紧张');
    h += fieldWrap('咖啡 / 茶（杯）', seg('caffeine', CFG.caffeineOpts, d.caffeine), '');

    if (d.caffeine > 0) {
      h += '<div class="card" style="padding:4px 14px;margin-bottom:22px">' +
        toggle('caffeineLate', d.caffeineLate, '下午 3 点后还喝过', '咖啡因代谢约 5 小时，晚喝更容易影响睡眠') + '</div>';
    }

    h += fieldWrap('饮水量', seg('water', CFG.waterOpts, d.water), '一杯约 250ml');
    h += fieldWrap('屏幕时间', seg('screen', CFG.screenOpts, d.screen), '手机+电脑的总时长');
    h += fieldWrap('喝酒', seg('alcohol', CFG.alcoholOpts, d.alcohol), '红酒、啤酒、白酒都算；红酒含酪胺，更常被点名');
    h += fieldWrap('今天吃过这些吗', chips('foods', CFG.foods, d.foods, { multi: true }), '常见诱因食物，可多选；都没吃就跳过');
    h += fieldWrap('运动时长', seg('exercise', CFG.exerciseOpts, d.exercise), '突然的剧烈运动也可能是诱因');
    h += fieldWrap('颈肩紧张酸痛', seg('neck', CFG.neck5, d.neck), '');

    if (!st.hideMenstrual) {
      h += fieldWrap('生理周期', seg('menstrual', CFG.menstrual, d.menstrual), '与自己无关就保持「不适用」；可在设置页隐藏这一项');
    }

    // 头痛
    const hdSeg = '<div class="seg" data-seg="hadHeadache">' +
      '<button data-seg-val="false" class="' + (d.hadHeadache === false ? 'on' : '') + '">今天没头痛</button>' +
      '<button data-seg-val="true" class="' + (d.hadHeadache === true ? 'on' : '') + '" style="' + (d.hadHeadache === true ? 'background:#B4553F;color:#fff;box-shadow:none' : '') + '">头痛了</button>' +
      '</div>';
    h += fieldWrap('今天头痛了吗', hdSeg, '这一项决定这天能否作为分析的对照');

    h += '<div class="section-title" style="margin:22px 0 8px">今天还遇到这些吗</div>';
    h += '<div class="tiny" style="padding:0 4px 10px;line-height:1.65">有就点亮，没有就跳过。只有勾了，分析里才能和"没勾的日子"作对比。</div>';
    h += TOGGLE_GROUPS.map((g) => groupChips(g, d)).join('');

    h += fieldWrap('备注', '<textarea data-day-field="note" placeholder="今天有什么特别的？比如加班、吵架、换了新枕头…">' + esc(d.note || '') + '</textarea>', '');

    h += '<div class="btn-row sheet-actions"><button class="btn line" data-act="close-sheet">取消</button>' +
      '<button class="btn grow" data-act="save-day">保存打卡</button></div>';
    return h;
  }

  /* ---------- 发作记录表单 ---------- */

  function defaultAttack() {
    const now = new Date();
    return {
      id: S.uid(),
      date: S.dateStr(now),
      startAt: now.toISOString(),
      endAt: '',
      stillOn: true,
      severity: 5,
      locations: [],
      qualities: [],
      symptoms: [],
      prodrome: [],
      aura: false,
      medicine: '未用药',
      medicineDose: '',
      relief: '',
      impact: 1,
      triggers: [],
      note: '',
      createdAt: now.toISOString(),
      updatedAt: 0
    };
  }

  async function openAttackSheet(id) {
    let a;
    if (id) {
      const row = await S.get('attacks', id);
      if (!row) { toast('找不到这条记录'); return; }
      a = JSON.parse(JSON.stringify(row));
      a.stillOn = !a.endAt;
    } else {
      a = defaultAttack();
    }
    state.draft = { kind: 'attack', data: a };
    openSheet(id ? '编辑发作记录' : '记录一次头痛', attackFormHTML());
  }

  function toLocalInput(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    const p = (n) => (n < 10 ? '0' + n : n);
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  function attackFormHTML() {
    const a = state.draft.data;
    let h = '';

    h += '<div class="field"><div class="field-label"><span>什么时候开始的</span></div>' +
      '<input type="datetime-local" value="' + toLocalInput(a.startAt) + '" data-att-field="startAt"></div>';

    h += '<div class="field"><div class="field-label"><span>现在还在痛吗</span></div>' +
      '<div class="seg" data-seg="stillOn">' +
      '<button data-seg-val="true" class="' + (a.stillOn ? 'on' : '') + '">还在痛</button>' +
      '<button data-seg-val="false" class="' + (!a.stillOn ? 'on' : '') + '">已经停了</button></div></div>';

    if (!a.stillOn) {
      h += '<div class="field"><div class="field-label"><span>什么时候结束的</span></div>' +
        '<input type="datetime-local" value="' + toLocalInput(a.endAt) + '" data-att-field="endAt"></div>';
    }

    // 强度
    h += '<div class="field"><div class="field-label"><span>疼痛程度</span><span class="val">' + a.severity + ' / 10</span></div>' +
      '<div class="sev-scale" data-sev>' +
      Array.from({ length: 11 }, (_, i) =>
        '<button type="button" data-sev-val="' + i + '" class="' + (a.severity === i ? 'on ' + sevClass(i) : '') + '">' + i + '</button>'
      ).join('') + '</div>' +
      '<div class="sev-legend"><span>0 几乎没感觉</span><span>5 影响做事</span><span>10 无法忍受</span></div></div>';

    h += fieldWrap('疼痛位置', chips('locations', CFG.locations, a.locations, { multi: true }), '可多选');
    h += fieldWrap('疼痛性质', chips('qualities', CFG.qualities, a.qualities, { multi: true }), '');
    h += fieldWrap('伴随症状', chips('symptoms', CFG.symptoms, a.symptoms, { multi: true }), '偏头痛典型表现：恶心、畏光、畏声');

    h += '<div class="card" style="padding:4px 14px;margin-bottom:22px">' +
      toggle('aura', a.aura, '有先兆', '发作前出现闪光、锯齿状暗点、视野缺损或麻木') + '</div>';

    h += fieldWrap('发作前几小时有没有这些感觉', chips('prodrome', CFG.prodrome, a.prodrome, { multi: true }),
      '这叫前驱期。它常常出现在发作前 2–24 小时，很重要 —— 因为「特别想吃巧克力」这类表现本身就是发作的一部分，不是诱因。');

    h += fieldWrap('用药', chips('medicine', CFG.meds, a.medicine), '');
    if (a.medicine && a.medicine !== '未用药') {
      h += fieldWrap('剂量 / 说明', '<input type="text" data-att-field="medicineDose" value="' + esc(a.medicineDose || '') + '" placeholder="如：1 片 / 400mg">', '');
      h += fieldWrap('服药后效果', seg('relief', CFG.relief, a.relief), '一般在服药 2 小时后评估');
    }

    h += fieldWrap('对生活的影响', seg('impact', CFG.impact, a.impact), '');

    // 诱因候选有 49 项，收起放，痛的时候不用先翻过一整屏
    const tgOpen = (state.openFolds && state.openFolds.triggers) || (Array.isArray(a.triggers) && a.triggers.length > 0);
    h += '<details class="fold" data-fold="triggers"' + (tgOpen ? ' open' : '') + '>' +
      '<summary data-fold="triggers"><span class="fold-t">你觉得是什么引起的</span>' +
      '<span class="fold-d">可选，点开勾选</span></summary>' +
      '<div class="fold-body">' + chips('triggers', triggerOptions(), a.triggers, { multi: true }) + '</div></details>';

    h += fieldWrap('备注', '<textarea data-att-field="note" placeholder="其他想记的：疼痛如何发展的、有没有缓解办法…">' + esc(a.note || '') + '</textarea>', '');

    h += '<div class="btn-row sheet-actions">' +
      (state.draft.data.updatedAt ? '<button class="btn line" data-act="delete-attack">删除</button>' : '<button class="btn line" data-act="close-sheet">取消</button>') +
      '<button class="btn grow" data-act="save-attack">保存</button></div>';
    return h;
  }

  // 发作时「你觉得是什么引起的」可选项：从因子表里挑出最常见的，避免列出四五十个
  const TRIGGER_GUESS = [
    '睡眠不足（< 6 小时）', '睡太多（> 9 小时）', '睡眠质量差（≤ 2 分）', '作息偏离平时 1.5 小时以上（补觉 / 熬夜）',
    '压力大（≥ 4 分）', '压力明显解除（前一天紧绷、今天放松）', '情绪剧烈波动（激动 / 争吵 / 受惊）',
    '跳餐 / 长时间饿肚子', '饮水偏少（< 4 杯）', '喝了酒', '咖啡 / 茶 ≥ 3 杯', '咖啡因比平时明显减少（戒断）',
    '吃了奶酪 / 乳制品（酪胺）', '喝了红葡萄酒', '吃了巧克力（苯乙胺）', '吃了加工肉 / 腌制品（亚硝酸盐）',
    '吃了含味精 / 鸡精的食物', '摄入代糖（阿斯巴甜等）', '吃了柑橘类水果', '吃了坚果', '吃了冰淇淋（快速进食）',
    '吃了麸质 / 面食面包', '吃了高酪胺食物（豆类 / 内脏 / 无花果 / 香蕉）', '吃了洋葱',
    '天气 / 气压明显变化', '闷热 / 高湿', '骤冷 / 空调风扇直吹', '强光 / 刺眼反光', '闪烁灯光 / 荧光 / 屏幕频闪',
    '强噪音', '强烈气味（香水 / 油烟 / 化学品）', '吸烟或长时间二手烟', '屏幕时间 ≥ 10 小时', '高海拔环境',
    '颈肩明显紧张酸痛（≥ 4 分）', '长时间伏案 / 固定姿势', '体力透支 / 过度劳累', '高强度运动（> 90 分钟）',
    '打鼾 / 睡觉被憋醒', '有性生活', '头部受过撞击', '长途出行 / 作息时差', '周末 / 休息日',
    '在服激素类药物（避孕药 / 激素替代）', '在服血管扩张类药物（硝酸酯等）',
    '经前 1–3 天', '经期中', '经期后', '更年期 / 围绝经期'
  ];

  function triggerOptions() {
    const all = new Set(A.FACTORS.map((f) => f.label));
    return TRIGGER_GUESS.filter((l) => all.has(l));
  }

  /* ---------- 事件 ---------- */

  document.addEventListener('click', async (e) => {
    const el = e.target.closest('[data-act]');

    // 芯片 / 分段 / 开关（不依赖 data-act）
    const chip = e.target.closest('[data-chip]');
    if (chip) { handleChip(chip); return; }

    // 平铺的布尔芯片（环境 / 身体 / 药物那几组）
    const bchip = e.target.closest('[data-boolchip]');
    if (bchip) { handleBoolChip(bchip); return; }

    // 折叠区：记住展开状态，表单重绘后不塌回去
    const sum = e.target.closest('summary[data-fold]');
    if (sum) {
      const k = sum.dataset.fold;
      setTimeout(() => { if (state.openFolds) state.openFolds[k] = !!sum.parentElement.open; }, 0);
      return;
    }

    const segBtn = e.target.closest('[data-seg-val]');
    if (segBtn) { handleSeg(segBtn); return; }

    const sevBtn = e.target.closest('[data-sev-val]');
    if (sevBtn) {
      if (!state.draft || state.draft.kind !== 'attack') return;
      state.draft.data.severity = Number(sevBtn.dataset.sevVal);
      refreshSheet();
      return;
    }

    const tog = e.target.closest('[data-toggle]');
    if (tog) { handleToggle(tog); return; }

    const rangeBtn = e.target.closest('[data-range]');
    if (rangeBtn) { state.range = rangeBtn.dataset.range; render(); return; }

    const lagBtn = e.target.closest('[data-lag]');
    if (lagBtn) { state.lag = Number(lagBtn.dataset.lag); render(); return; }

    if (!el) return;
    const act = el.dataset.act;

    if (act === 'tab') {
      state.tab = el.dataset.tab;
      try { history.replaceState(null, '', '#' + state.tab); } catch (err) {}
      render();
      window.scrollTo(0, 0);
    }
    else if (act === 'close-sheet') { closeSheet(); }
    else if (act === 'edit-day') { await openDaySheet(el.dataset.date || S.dateStr()); }
    else if (act === 'save-day') { await saveDay(); }
    else if (act === 'new-attack') { await openAttackSheet(null); }
    else if (act === 'edit-attack') { await openAttackSheet(el.dataset.id); }
    else if (act === 'save-attack') { await saveAttack(); }
    else if (act === 'delete-attack') { await deleteAttack(); }
    else if (act === 'jump-day') {
      const d = el.dataset.date;
      if (state.ds.dayIndex.has(d)) await openDaySheet(d);
      else if (state.ds.attackByDate.has(d)) {
        const list = state.ds.attackByDate.get(d);
        await openAttackSheet(list[0].id);
      } else await openDaySheet(d);
    }
    else if (act === 'export-json') { await exportJSON(); }
    else if (act === 'export-csv') { await exportCSV(); }
    else if (act === 'pick-import') { document.getElementById('importFile').click(); }
    else if (act === 'clear-all') { await clearAll(); }
    else if (act === 'onboard-done') { await S.saveSettings({ onboarded: true }); state.settings = await S.getSettings(); closeSheet(); render(); }
    else if (act === 'cloud-workbuddy') {
      if (!window.Cloud) { toast('云服务未加载'); return; }
      el.disabled = true;
      const r = await Cloud.signInWithWorkBuddy();
      if (r && r.error) { el.disabled = false; toast(r.error); }
    }
    else if (act === 'cloud-email') {
      state.emailSent = false;
      state.cloudMsg = '';
      state.emailDraft = '';
      openEmailLoginSheet();
    }
    else if (act === 'cloud-send-code' || act === 'cloud-resend') {
      const email = readCloudEmail();
      if (!email) { toast('请填写邮箱'); return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast('邮箱格式不对'); return; }
      if (!window.Cloud) { toast('云服务未加载'); return; }
      state.emailDraft = email;
      el.disabled = true;
      const r = await Cloud.sendEmailCode(email);
      el.disabled = false;
      if (r.error) { state.cloudMsg = r.error; openEmailLoginSheet(); return; }
      state.emailSent = true;
      state.cloudMsg = '';
      openEmailLoginSheet();
      toast('验证码已发送');
    }
    else if (act === 'cloud-verify') {
      const code = readCloudCode();
      if (!code) { toast('请填写验证码'); return; }
      if (!window.Cloud) { toast('云服务未加载'); return; }
      el.disabled = true;
      const r = await Cloud.verifyEmailCode(state.emailDraft, code);
      el.disabled = false;
      if (r.error) { state.cloudMsg = r.error; openEmailLoginSheet(); return; }
      state.emailSent = false;
      state.cloudMsg = '';
      closeSheet();
      await cloudAfterLogin();
    }
    else if (act === 'cloud-sync') {
      if (!window.Cloud) { toast('云服务未加载'); return; }
      el.disabled = true;
      const r = await Cloud.syncNow(S);
      el.disabled = false;
      if (r.error) { toast(r.error); return; }
      await reload();
      render();
      toast('已同步');
    }
    else if (act === 'cloud-logout') {
      if (!window.Cloud) return;
      await Cloud.signOut();
      render();
      toast('已退出登录，记录仍保留在本机');
    }
  });

  function handleBoolChip(btn) {
    const field = btn.dataset.boolchip;
    if (!field || !state.draft) return;
    const d = state.draft.data;
    if (!(field in d)) d[field] = false;
    d[field] = d[field] !== true;
    refreshSheet();
  }

  function handleChip(chip) {
    const field = chip.dataset.chip;
    const val = chip.dataset.val;
    const multi = chip.dataset.multi === '1';
    const kind = state.draft && state.draft.kind;
    if (!kind) return;
    const d = state.draft.data;

    const apply = (obj) => {
      if (multi) {
        const arr = Array.isArray(obj[field]) ? obj[field].slice() : [];
        const i = arr.indexOf(val);
        if (i >= 0) arr.splice(i, 1); else arr.push(val);
        obj[field] = arr;
      } else {
        obj[field] = (String(obj[field]) === String(val)) ? '' : val;
      }
    };

    if (kind === 'day') { apply(d); refreshSheet(); }
    else if (kind === 'attack') {
      if (field === 'locations' || field === 'qualities' || field === 'symptoms' || field === 'triggers' || field === 'prodrome') {
        apply(d);
        if (field === 'prodrome') {
          // 「无明显前驱」与其他项互斥
          const NONE = '无明显前驱';
          const arr = Array.isArray(d.prodrome) ? d.prodrome.slice() : [];
          d.prodrome = val === NONE
            ? (arr.indexOf(NONE) >= 0 ? [NONE] : [])
            : arr.filter((x) => x !== NONE);
        }
        refreshSheet();
      } else if (field === 'medicine') {
        d.medicine = val;
        refreshSheet();
      }
    }
  }

  function handleSeg(btn) {
    const wrap = btn.closest('[data-seg]');
    const field = wrap.dataset.seg;
    let raw = btn.dataset.segVal;

    const kind = state.draft && state.draft.kind;
    if (!kind) return;
    const d = state.draft.data;

    const numFields = ['sleep', 'sleepQuality', 'stress', 'caffeine', 'water', 'screen', 'alcohol', 'exercise', 'neck', 'impact', 'severity'];
    let val = numFields.indexOf(field) >= 0 ? Number(raw) : raw;
    if (field === 'hadHeadache' || field === 'stillOn' || field === 'aura') {
      val = raw === 'true' ? true : raw === 'false' ? false : null;
    }

    if (kind === 'day' && (field in d)) { d[field] = val; refreshSheet(); }
    else if (kind === 'attack' && (field in d)) {
      d[field] = val;
      if (field === 'stillOn' && !val && !d.endAt) {
        d.endAt = new Date().toISOString();
      }
      refreshSheet();
    }
  }

  function handleToggle(btn) {
    const field = btn.dataset.toggle;
    const kind = state.draft && state.draft.kind;
    if (!kind) return;
    const d = state.draft.data;
    if (!(field in d)) return;
    d[field] = !d[field];
    // 手点过的折叠区保持展开，别在重绘时塌回去
    const det = btn.closest('details[data-fold]');
    if (det && state.openFolds) state.openFolds[det.dataset.fold] = true;
    refreshSheet();
  }

  // 输入类
  let inputTimer = null;
  document.addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset.dayField) {
      if (!state.draft || state.draft.kind !== 'day') return;
      state.draft.data[t.dataset.dayField] = t.value;
      return;
    }
    if (t.dataset.attField) {
      if (!state.draft || state.draft.kind !== 'attack') return;
      const f = t.dataset.attField;
      const v = t.value;
      if (f === 'startAt' || f === 'endAt') {
        state.draft.data[f] = v ? new Date(v).toISOString() : '';
      } else {
        state.draft.data[f] = v;
      }
      return;
    }
  });

  function refreshSheet() {
    const body = document.querySelector('.sheet-body');
    if (!body || !state.draft) return;
    const scroll = body.scrollTop;
    if (state.draft.kind === 'day') body.innerHTML = dayFormHTML();
    else body.innerHTML = attackFormHTML();
    body.scrollTop = scroll;
  }

  /* ---------- 保存 ---------- */

  async function saveDay() {
    const d = state.draft.data;
    if (!d.date) { toast('请选择日期'); return; }
    d.hadHeadache = d.hadHeadache === true ? true : (d.hadHeadache === false ? false : null);
    d.updatedAt = Date.now();
    await S.put('days', d);
    if (window.Cloud && Cloud.isSignedIn()) Cloud.pushOne('day', d.date, d, d.updatedAt);
    await reload();
    closeSheet();
    render();
    toast('已保存');
    if (d.hadHeadache === true && !state.ds.attackByDate.has(d.date)) {
      setTimeout(() => {
        openSheet('记一下这次发作？', '<div class="muted mb-12">你标记了这天头痛，补充发作细节（强度、部位、用药）会让分析更准。</div>' +
          '<div class="btn-row"><button class="btn line" data-act="close-sheet">先不用</button>' +
          '<button class="btn grow" data-act="new-attack">现在记录</button></div>');
      }, 400);
    }
  }

  async function saveAttack() {
    const a = state.draft.data;
    if (!a.startAt) { toast('请填写开始时间'); return; }
    if (!a.stillOn && !a.endAt) { toast('请填写结束时间'); return; }
    if (a.stillOn) a.endAt = '';
    if (!a.stillOn && new Date(a.endAt) < new Date(a.startAt)) { toast('结束时间不能早于开始时间'); return; }

    a.date = S.dateStr(new Date(a.startAt));
    delete a.stillOn;
    a.updatedAt = Date.now();
    await S.put('attacks', a);
    if (window.Cloud && Cloud.isSignedIn()) Cloud.pushOne('attack', a.id, a, a.updatedAt);

    // 同步当天打卡的头痛标记
    const day = await S.get('days', a.date);
    if (day && day.hadHeadache !== true) {
      day.hadHeadache = true;
      day.updatedAt = Date.now();
      await S.put('days', day);
      if (window.Cloud && Cloud.isSignedIn()) Cloud.pushOne('day', day.date, day, day.updatedAt);
    }

    await reload();
    closeSheet();
    render();
    toast('已记录');
  }

  async function deleteAttack() {
    const a = state.draft.data;
    if (!confirm('确定删除这次发作记录？')) return;
    await S.del('attacks', a.id);
    if (window.Cloud && Cloud.isSignedIn()) Cloud.removeOne('attack', a.id);
    await reload();
    closeSheet();
    render();
    toast('已删除');
  }

  /* ---------- 导出 / 导入 ---------- */

  function download(filename, content, mime) {
    const blob = new Blob([content], { type: mime || 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 5000);
  }

  async function exportJSON() {
    const payload = await S.exportAll();
    const name = '头疼日记_存档_' + S.dateStr() + '.json';
    download(name, JSON.stringify(payload, null, 1));
    toast('存档已导出：' + name);
  }

  function csvCell(v) {
    const s = (v == null ? '' : String(v));
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  async function exportCSV() {
    const days = (await S.all('days')).sort((a, b) => (a.date < b.date ? -1 : 1));
    const attacks = await S.all('attacks');
    const byDate = new Map();
    attacks.forEach((a) => {
      if (!byDate.has(a.date)) byDate.set(a.date, []);
      byDate.get(a.date).push(a);
    });

    const dates = Array.from(new Set(days.map((d) => d.date).concat(Array.from(byDate.keys())))).sort();
    const dayMap = new Map(days.map((d) => [d.date, d]));

    const header = ['日期', '星期', '是否头痛', '发作次数', '最高强度(0-10)', '首次开始', '结束', '持续',
      '部位', '性质', '伴随症状', '先兆', '前驱表现', '用药', '剂量', '服药后效果', '对生活影响',
      '睡眠(h)', '睡眠质量(1-5)', '压力(1-5)', '咖啡因(杯)', '下午后摄入', '饮水(档)', '屏幕(h)', '饮酒(杯)',
      '跳餐', '运动(分)', '颈肩(1-5)',
      '气压变化', '闷热高湿', '骤冷/空调', '强光', '频闪', '强噪音', '强烈气味', '烟味', '高海拔', '出行',
      '体力透支', '长时间伏案', '情绪波动', '打鼾', '性生活', '头部撞击', '激素类药物', '血管扩张药',
      '特殊食物', '生理周期', '备注'];

    const rows = [header];
    dates.forEach((date) => {
      const rec = dayMap.get(date) || {};
      const list = byDate.get(date) || [];
      const top = list.slice().sort((a, b) => (Number(b.severity) || 0) - (Number(a.severity) || 0))[0];
      const first = list.slice().sort((a, b) => (a.startAt < b.startAt ? -1 : 1))[0];
      const reliefMap = { resolved: '完全缓解', partial: '部分缓解', none: '无效' };
      const impactMap = { 0: '没影响', 1: '轻微', 2: '影响工作', 3: '只能卧床' };
      rows.push([
        date,
        S.WEEK_CN[S.parseDate(date).getDay()],
        (list.length || rec.hadHeadache === true) ? '是' : '否',
        list.length || '',
        top ? top.severity : '',
        first ? S.fmtTime(first.startAt) : '',
        first && first.endAt ? S.fmtTime(first.endAt) : '',
        first ? durText(first) : '',
        top ? (top.locations || []).join('/') : '',
        top ? (top.qualities || []).join('/') : '',
        top ? (top.symptoms || []).join('/') : '',
        top ? (top.aura ? '有' : '无') : '',
        top ? (top.prodrome || []).join('/') : '',
        top ? top.medicine : '',
        top ? top.medicineDose : '',
        top ? (reliefMap[top.relief] || '') : '',
        top && top.impact != null ? (impactMap[top.impact] || '') : '',
        rec.sleep != null ? rec.sleep : '',
        rec.sleepQuality != null ? rec.sleepQuality : '',
        rec.stress != null ? rec.stress : '',
        rec.caffeine != null ? rec.caffeine : '',
        rec.caffeineLate ? '是' : '',
        rec.water != null ? rec.water : '',
        rec.screen != null ? rec.screen : '',
        rec.alcohol ? rec.alcohol : '',
        rec.skipMeal ? '是' : '',
        rec.exercise != null ? rec.exercise : '',
        rec.neck != null ? rec.neck : '',
        rec.weather ? '是' : '',
        rec.heat ? '是' : '',
        rec.coldWind ? '是' : '',
        rec.glare ? '是' : '',
        rec.flicker ? '是' : '',
        rec.noise ? '是' : '',
        rec.smell ? '是' : '',
        rec.smoke ? '是' : '',
        rec.altitude ? '是' : '',
        rec.travel ? '是' : '',
        rec.overwork ? '是' : '',
        rec.posture ? '是' : '',
        rec.emotion ? '是' : '',
        rec.snore ? '是' : '',
        rec.sexual ? '是' : '',
        rec.trauma ? '是' : '',
        rec.hormoneMed ? '是' : '',
        rec.vasodilator ? '是' : '',
        (rec.foods || []).join('/'),
        rec.menstrual === 'pre' ? '经前' : rec.menstrual === 'during' ? '经期' : rec.menstrual === 'post' ? '经期后' : rec.menstrual === 'none' ? '非经期' : rec.menstrual === 'peri' ? '更年期' : '',
        (top && top.note ? top.note + ' ' : '') + (rec.note || '')
      ]);
    });

    const csv = '\ufeff' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
    const name = '头痛日记_就医表格_' + S.dateStr() + '.csv';
    download(name, csv, 'text/csv;charset=utf-8');
    toast('表格已导出：' + name);
  }

  document.addEventListener('change', async (e) => {
    if (e.target.dataset && e.target.dataset.dayDate) {
      const nd = e.target.value;
      if (!nd) return;
      if (!state.draft || state.draft.kind !== 'day') return;
      if (nd === state.draft.data.date) return;
      const existing = await S.get('days', nd);
      state.draft.data = existing ? JSON.parse(JSON.stringify(existing)) : defaultDay(nd);
      refreshSheet();
      return;
    }
    if (e.target.id !== 'importFile') return;
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      const stats = await S.importAll(payload, {});
      state.settings = await S.getSettings();
      await reload();
      render();
      toast('已导入：' + stats.days + ' 天打卡、' + stats.attacks + ' 次发作');
    } catch (err) {
      console.error(err);
      alert('导入失败：' + (err && err.message ? err.message : '文件格式不正确'));
    } finally {
      e.target.value = '';
    }
  });

  async function clearAll() {
    if (!confirm('确定清空本设备上的全部记录？此操作不可恢复，建议先导出存档。')) return;
    if (!confirm('再确认一次：所有打卡和发作记录都会被删除。')) return;
    await S.clearAll();
    await reload();
    render();
    toast('已清空');
  }

  /* ---------- 首次引导 ---------- */

  function showOnboard() {
    openSheet('欢迎使用头疼日记', 
      '<div class="muted mb-12">这是一个给自己用的头痛记录本，目标是找出你的诱因。</div>' +
      '<div class="onboard-step"><div class="onboard-num">1</div><div><div class="t">每天打卡，包含没头痛的日子</div>' +
        '<div class="d">只记头痛日，任何因素都会显得可疑。有无头痛日的对照，分析才成立。</div></div></div>' +
      '<div class="onboard-step"><div class="onboard-num">2</div><div><div class="t">发作当下就记</div>' +
        '<div class="d">疼痛程度、部位、用药效果，事后回忆会失真。</div></div></div>' +
      '<div class="onboard-step"><div class="onboard-num">3</div><div><div class="t">记录先存在这台设备，登录后可备份到云端</div>' +
        '<div class="d">不登录也能用。想手机和电脑共用一份、并且每天自动备份到本地，就去「设置 → 云端备份」登录一次。</div></div></div>' +
      '<button class="btn mt-16" data-act="onboard-done">开始记录</button>');
  }

  /* ---------- 启动 ---------- */

  async function reload() {
    const [days, attacks] = await Promise.all([S.all('days'), S.all('attacks')]);
    state.ds = A.buildDataset(days, attacks);
  }

  let booted = false;
  async function boot() {
    if (booted) return;
    booted = true;
    try {
      const hasIDB = await S.probe();
      if (hasIDB) { try { await S.migrateLocalToIDB(); } catch (e) { /* 迁移失败不影响使用 */ } }
      state.tab = tabFromHash();
      state.settings = await S.getSettings();

      // 云登录回调必须赶在首次渲染之前处理完
      if (window.Cloud) {
        try { await Cloud.boot(); } catch (e) { /* 云不可用不影响本地使用 */ }
        if (Cloud.isSignedIn()) {
          try { await Cloud.syncNow(S); } catch (e) { /* 同步失败保留本地数据 */ }
        }
      }

      await reload();
      render();
      // 稍等再弹引导；如果用户已经开始操作，就不要打断他
      if (!state.settings.onboarded) setTimeout(() => { if (!state.sheet) showOnboard(); }, 600);
    } catch (e) {
      console.error('[app] boot failed', e);
      const app = document.getElementById('app');
      if (app) {
        app.innerHTML = '<div class="card" style="margin-top:40px">' +
          '<div style="font-size:15px;font-weight:600;color:#B4483A">加载失败</div>' +
          '<div class="muted mt-8">' + esc(e && e.message ? e.message : '未知错误') + '</div>' +
          '<button class="btn mt-16" onclick="location.reload()">重新加载</button></div>';
      }
    }
  }

  window.addEventListener('DOMContentLoaded', boot);
  if (document.readyState === 'interactive' || document.readyState === 'complete') boot();
})();
