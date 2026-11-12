/* AI4En · 家长端增强套装（只读视角）
 * 在原有家长页上补齐左侧模块：概览 / 任务进度 / 订正档案 / 学情分析 / 每周回顾 / 家校留言 / 使用说明
 * 只使用既有接口 /api/parent/overview；周记与留言草稿保存在本机浏览器，不上传服务器。
 */
'use strict';

var PN_MODULES = [
  { key: 'overview', icon: 'compass', label: '概览', desc: '孩子任务与本周重点' },
  { key: 'tasks', icon: 'task', label: '任务进度', desc: '每个任务的提交与反馈' },
  { key: 'revisions', icon: 'rotate', label: '订正档案', desc: '老师确认的反馈与订正情况' },
  { key: 'insights', icon: 'chart', label: '学情分析', desc: '按老师反馈等级汇总' },
  { key: 'weekly', icon: 'calendar', label: '每周回顾', desc: '按周看变化，写下陪伴记录' },
  { key: 'messages', icon: 'message', label: '家校留言', desc: '本地草稿，可复制发给老师' },
  { key: 'help', icon: 'book', label: '使用说明', desc: '能看到什么、看不到什么' }
];

var PN_LS_NOTES = 'ai4en-parent-weekly-notes-v1';
var PN_LS_MSGS = 'ai4en-parent-messages-v1';

/* ---------------------------------------------------------------- 小工具 */
function pnRead(key, fallback) {
  try {
    var raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    var val = JSON.parse(raw);
    return (val === null || val === undefined) ? fallback : val;
  } catch (e) { return fallback; }
}

function pnWrite(key, value) {
  try { window.localStorage.setItem(key, JSON.stringify(value)); return true; }
  catch (e) { return false; }
}

function pnTime(value) {
  return value ? String(value).replace('T', ' ').slice(0, 16) : '';
}

function pnDay(value) {
  return value ? String(value).replace('T', ' ').slice(0, 10) : '';
}

function pnPct(part, total) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

function pnWeek(dateStr) {
  var d = new Date(String(dateStr || '').replace(' ', 'T'));
  if (isNaN(d.getTime())) return '';
  var t = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  var dow = (t.getDay() + 6) % 7;
  t.setDate(t.getDate() - dow + 3);
  var first = new Date(t.getFullYear(), 0, 4);
  var fdow = (first.getDay() + 6) % 7;
  first.setDate(first.getDate() - fdow + 3);
  var week = 1 + Math.round((t.getTime() - first.getTime()) / 604800000);
  return t.getFullYear() + ' 年第 ' + week + ' 周';
}

/* ---------------------------------------------------------------- 数据 */
async function pnData(force) {
  if (!force && S.pnData) return S.pnData;
  var data = await api('/api/parent/overview');
  S.pnData = data;
  S.pnAt = new Date().toISOString();
  return data;
}

function pnTasks(data) { return (data && data.tasks) || []; }
function pnFeedback(t) { return (t && t.feedback) || []; }
function pnSub(t) { return (t && t.submission) || null; }

function pnSummary(data) {
  var tasks = pnTasks(data);
  var out = {
    total: tasks.length, submitted: 0, pending: 0, revise: 0, resubmitted: 0,
    feedback: 0, levels: { '已完成': 0, '需局部修改': 0, '需教师帮助': 0 },
    lessons: []
  };
  var lessonIndex = {};
  tasks.forEach(function (t) {
    var sub = pnSub(t);
    var list = pnFeedback(t);
    if (sub) out.submitted++; else out.pending++;
    if (sub && sub.status === 'revision_requested') out.revise++;
    if (sub && sub.status === 'resubmitted') out.resubmitted++;
    out.feedback += list.length;
    list.forEach(function (f) {
      var lv = f && f.level ? f.level : '';
      if (out.levels[lv] === undefined) out.levels[lv] = 0;
      out.levels[lv]++;
    });
    var key = t.lesson_title || '未命名课例';
    if (!lessonIndex[key]) {
      lessonIndex[key] = { title: key, tasks: 0, submitted: 0, feedback: 0 };
      out.lessons.push(lessonIndex[key]);
    }
    lessonIndex[key].tasks++;
    if (sub) lessonIndex[key].submitted++;
    lessonIndex[key].feedback += list.length;
  });
  return out;
}

function pnFocusText(sum) {
  if (!sum.total) return '还没有可查看的任务。老师发布任务后，这里会自动出现。';
  if (sum.revise) return '有 ' + sum.revise + ' 个任务老师要求订正。建议先陪孩子把老师反馈读一遍，再动手改。';
  if (sum.pending) return '还有 ' + sum.pending + ' 个任务没有提交。留意截止时间，必要时在「家校留言」里和老师沟通。';
  if (sum.feedback) return '目前共 ' + sum.feedback + ' 条老师已确认的反馈，可以到「订正档案」逐条过一遍。';
  return '任务都已提交。可以到「学情分析」看看孩子这段时间的反馈分布。';
}

/* ---------------------------------------------------------------- 视图片段 */
function pnStatusChip(t) {
  var sub = pnSub(t);
  if (!sub) return chip('未提交', 'amber');
  return subChip(sub.status);
}

function pnTaskCard(t) {
  var sub = pnSub(t);
  var list = pnFeedback(t);
  var fbHtml = list.map(function (f) {
    return '<div class="feedback-box" style="margin-left:0"><div class="fb-head">老师反馈 ' + levelChip(f.level) + '</div>' +
      (f.stem ? '<div class="tiny muted" style="margin-bottom:4px">' + esc(f.stem) + '</div>' : '') +
      nl2br(f.final || '') + '</div>';
  }).join('');
  return '<div class="card lesson-card"><div class="top"><div><h3>' + esc(t.title) + '</h3>' +
    '<div class="meta">' + esc(t.lesson_title || '') + ' · 截止 ' + esc(t.due_at || '不限') + '</div></div>' +
    pnStatusChip(t) + '</div>' +
    (sub ? '<div class="tiny muted">提交于 ' + esc(pnTime(sub.submitted_at)) + '</div>'
      : '<div class="tiny muted">还没有提交记录</div>') +
    fbHtml +
    (t.suggestion ? '<div class="banner info" style="margin-top:12px"><span class="icon">i</span><div><b>陪伴建议</b><br>' + esc(t.suggestion) + '</div></div>' : '') +
    '</div>';
}

function pnTaskRow(t) {
  var sub = pnSub(t);
  var list = pnFeedback(t);
  var levels = list.map(function (f) { return levelChip(f.level); }).join('');
  var open = String(S.pnOpenTask) === String(t.id) && S.pnOpenTask !== null && S.pnOpenTask !== undefined;
  return '<div class="pn-row' + (open ? ' is-open' : '') + '" data-task="' + esc(t.id) + '" data-lesson="' + esc(t.lesson_title || '') + '">' +
    '<div class="pn-row-main" data-act="pn-toggle-task" data-id="' + esc(t.id) + '">' +
    '<div class="pn-row-title">' + esc(t.title) + (open ? ' ▾' : ' ▸') + '</div>' +
    '<div class="tiny muted">' + esc(t.lesson_title || '') + ' · 截止 ' + esc(t.due_at || '不限') +
    (sub ? ' · 提交于 ' + esc(pnTime(sub.submitted_at)) : '') + '</div></div>' +
    '<div class="pn-row-side">' + pnStatusChip(t) + '<span class="tiny muted">' + list.length + ' 条反馈</span></div>' +
    (levels ? '<div class="pn-row-levels">' + levels + '</div>' : '') +
    (open ? pnTaskDetail(t) : '') +
    '</div>';
}

/* 任务详情：时间线 + 逐条反馈 + 陪伴建议 */
function pnTaskDetail(t) {
  var sub = pnSub(t);
  var list = pnFeedback(t);
  var events = [];
  if (sub && sub.submitted_at) {
    events.push({ at: pnTime(sub.submitted_at), text: sub.status === 'resubmitted' ? '孩子提交了订正' : '孩子提交了作业', kind: 'ok' });
  }
  list.forEach(function (f) {
    events.push({ at: '', text: '老师确认反馈：' + (f.level || '未标注'), kind: 'fb' });
  });
  if (t.due_at) events.push({ at: esc(t.due_at), text: '任务截止时间', kind: '' });

  var timeline = events.map(function (e) {
    return '<li class="pn-tl-item ' + e.kind + '"><span class="pn-tl-dot"></span>' +
      '<div><div>' + esc(e.text) + '</div>' + (e.at ? '<div class="tiny muted">' + esc(e.at) + '</div>' : '') + '</div></li>';
  }).join('');

  var fbHtml = list.map(function (f, i) {
    return '<div class="pn-fb-item"><div class="row" style="justify-content:space-between">' +
      '<span class="tiny muted">反馈 ' + (i + 1) + '</span>' + levelChip(f.level) + '</div>' +
      (f.stem ? '<div class="pn-stem tiny">' + esc(f.stem) + '</div>' : '') +
      '<div class="pn-fb-text">' + nl2br(f.final || '') + '</div></div>';
  }).join('');

  return '<div class="pn-detail">' +
    '<div class="pn-detail-col"><div class="pn-detail-title">时间线</div><ul class="pn-tl">' + timeline + '</ul></div>' +
    '<div class="pn-detail-col"><div class="pn-detail-title">老师反馈（' + list.length + ' 条）</div>' +
    (fbHtml || '<div class="tiny muted">还没有老师确认的反馈。</div>') +
    (t.suggestion ? '<div class="banner info" style="margin-top:10px"><span class="icon">i</span><div><b>陪伴建议</b><br>' + esc(t.suggestion) + '</div></div>' : '') +
    '</div></div>';
}

function pnModuleLinks() {
  var cards = PN_MODULES.filter(function (m) { return m.key !== 'overview'; }).map(function (m) {
    return '<a class="card pn-link" href="#/parent/' + m.key + '">' +
      '<div class="pn-link-ico" aria-hidden="true">' + icon(m.icon) + '</div>' +
      '<div><div class="pn-link-title">' + esc(m.label) + '</div>' +
      '<div class="tiny muted">' + esc(m.desc) + '</div></div></a>';
  }).join('');
  return '<div class="section-title" style="margin-top:22px"><span class="dot"></span>更多模块</div>' +
    '<div class="pn-links">' + cards + '</div>';
}

/* ---------------------------------------------------------------- 各模块视图 */
function pnOverviewView(data) {
  var child = data.child || {};
  var sum = pnSummary(data);
  var recent = pnTasks(data).slice(0, 4).map(pnTaskCard).join('');
  var stats = '<div class="grid stats">' +
    '<div class="stat"><div class="num">' + sum.total + '</div><div class="label">任务总数</div>' +
    '<div class="extra">已提交 ' + sum.submitted + ' 个</div></div>' +
    '<div class="stat teal"><div class="num">' + sum.feedback + '</div><div class="label">已确认反馈</div>' +
    '<div class="extra">只有老师确认后才会显示</div></div>' +
    '<div class="stat amber"><div class="num">' + sum.revise + '</div><div class="label">待订正</div>' +
    '<div class="extra">读完反馈再改</div></div>' +
    '<div class="stat"><div class="num">' + sum.levels['已完成'] + '</div><div class="label">「已完成」反馈</div>' +
    '<div class="extra">另有 ' + (sum.levels['需局部修改'] + sum.levels['需教师帮助']) + ' 条需要继续努力</div></div>' +
    '</div>';
  return pageHead('学习概览', esc(child.name || '') + ' · 家长只读视角',
      btn('刷新数据', 'pn-refresh', '', 'sm ghost')) +
    stats +
    pnReminderHtml(pnTasks(data)) +
    banner(pnFocusText(sum), 'info', 'i') +
    '<div class="section-title" style="margin-top:22px"><span class="dot"></span>最近任务</div>' +
    '<div class="grid two">' + (recent || empty('暂时没有可查看的任务。')) + '</div>' +
    pnModuleLinks();
}

function pnTasksView(data) {
  var tasks = pnTasks(data);
  var filter = S.pnFilter || 'all';
  var counts = { all: tasks.length, pending: 0, submitted: 0, revise: 0, resubmitted: 0 };
  tasks.forEach(function (t) {
    var sub = pnSub(t);
    if (!sub) counts.pending++;
    else {
      counts.submitted++;
      if (sub.status === 'revision_requested') counts.revise++;
      if (sub.status === 'resubmitted') counts.resubmitted++;
    }
  });
  var chips = [
    ['all', '全部 ' + counts.all],
    ['pending', '未提交 ' + counts.pending],
    ['submitted', '已提交 ' + counts.submitted],
    ['revise', '待订正 ' + counts.revise],
    ['resubmitted', '已订正 ' + counts.resubmitted]
  ].map(function (c) {
    var on = filter === c[0] ? ' selected' : '';
    return '<button class="chip plain pn-filter' + on + '" data-act="pn-filter" data-f="' + c[0] + '">' + esc(c[1]) + '</button>';
  }).join('');

  S.pnTasks = tasks;
  var visible = pnVisible(tasks);
  return pageHead('任务进度', '共 ' + counts.all + ' 个任务 · 按状态筛选',
      btn('刷新数据', 'pn-refresh', '', 'sm ghost')) +
    '<div class="row pn-tools">' +
    '<input class="input pn-search" id="pn-search" autocomplete="off" placeholder="搜任务 / 课例 / 反馈内容" value="' + esc(S.pnQuery || '') + '">' +
    '<select class="input pn-select" id="pn-lesson">' + pnLessonOptions(tasks) + '</select>' +
    '<span class="tiny muted" id="pn-count">' + visible.length + ' / ' + counts.all + ' 个任务</span>' +
    '</div>' +
    '<div class="row pn-filters">' + chips + '</div>' +
    '<div id="pn-list">' + pnListHtml(visible) + '</div>' +
    banner('状态说明：「未提交」表示还没有作答记录；「待订正」表示老师要求订正；「已订正」表示订正已提交。点任务行可以展开时间线与逐条反馈。', 'info', 'i');
}

/* 当前筛选条件下的任务 */
function pnVisible(tasks) {
  var filter = S.pnFilter || 'all';
  return (tasks || []).filter(function (t) {
    var sub = pnSub(t);
    if (filter === 'pending' && sub) return false;
    if (filter === 'submitted' && !sub) return false;
    if (filter === 'revise' && !(sub && sub.status === 'revision_requested')) return false;
    if (filter === 'resubmitted' && !(sub && sub.status === 'resubmitted')) return false;
    var query = String(S.pnQuery || '').trim().toLowerCase();
    if (query) {
      var hay = [t.title, t.lesson_title].concat(pnFeedback(t).map(function (f) {
        return (f.stem || '') + ' ' + (f.final || '');
      })).join(' ').toLowerCase();
      if (hay.indexOf(query) < 0) return false;
    }
    if (S.pnLesson && S.pnLesson !== 'all' && (t.lesson_title || '') !== S.pnLesson) return false;
    return true;
  });
}

function pnLessonOptions(tasks) {
  var seen = {};
  var options = ['<option value="all">全部课例</option>'];
  (tasks || []).forEach(function (t) {
    var title = t.lesson_title || '未命名课例';
    if (seen[title]) return;
    seen[title] = 1;
    options.push('<option value="' + esc(title) + '"' + (S.pnLesson === title ? ' selected' : '') + '>' + esc(title) + '</option>');
  });
  return options.join('');
}

function pnListHtml(visible) {
  return visible.length
    ? '<div class="card pn-list">' + visible.map(pnTaskRow).join('') + '</div>'
    : empty('当前筛选下没有任务。');
}

function pnRevisionsView(data) {
  var items = [];
  pnTasks(data).forEach(function (t) {
    pnFeedback(t).forEach(function (f) { items.push({ task: t, fb: f }); });
  });
  var needFix = items.filter(function (it) {
    var sub = pnSub(it.task);
    return sub && sub.status === 'revision_requested';
  }).length;

  var body = items.map(function (it) {
    var sub = pnSub(it.task);
    var done = sub && sub.status === 'resubmitted';
    return '<div class="card pn-fb-card">' +
      '<div class="row" style="justify-content:space-between">' +
      '<div><div class="pn-row-title">' + esc(it.task.title) + '</div>' +
      '<div class="tiny muted">' + esc(it.task.lesson_title || '') + ' · 提交于 ' + esc(pnTime(sub ? sub.submitted_at : '')) + '</div></div>' +
      '<div class="row">' + levelChip(it.fb.level) + (done ? chip('已订正', 'teal') : chip('未订正', 'amber')) + '</div></div>' +
      (it.fb.stem ? '<div class="tiny muted pn-stem">' + esc(it.fb.stem) + '</div>' : '') +
      '<div class="feedback-box" style="margin-left:0">' + nl2br(it.fb.final || '') + '</div>' +
      '</div>';
  }).join('');

  return pageHead('订正档案', '老师确认过的反馈与孩子的订正情况',
      btn('刷新数据', 'pn-refresh', '', 'sm ghost')) +
    (needFix ? banner('有 ' + needFix + ' 个任务正在等孩子订正，建议一次只处理一条反馈。', 'warn', '!')
      : banner('当前没有待订正的任务。订正记录会保留在「已订正」状态里。', 'info', 'i')) +
    (body ? '<div class="pn-fb-list">' + body + '</div>' : empty('还没有老师确认过的反馈。'));
}

function pnInsightsView(data) {
  var sum = pnSummary(data);
  var levelRows = ['已完成', '需局部修改', '需教师帮助'].map(function (lv) {
    var n = sum.levels[lv] || 0;
    var pct = pnPct(n, sum.feedback);
    var cls = lv === '已完成' ? 'teal' : lv === '需局部修改' ? 'amber' : 'red';
    return '<div class="pn-bar-row"><div class="pn-bar-label">' + levelChip(lv) + '</div>' +
      '<div class="pn-bar"><i class="' + cls + '" style="width:' + (pct || 0) + '%"></i></div>' +
      '<div class="pn-bar-num">' + n + ' 条 · ' + pct + '%</div></div>';
  }).join('');

  var lessonRows = sum.lessons.map(function (l) {
    var pct = pnPct(l.submitted, l.tasks);
    return '<div class="pn-bar-row"><div class="pn-bar-label">' + esc(l.title) + '</div>' +
      '<div class="pn-bar"><i class="blue" style="width:' + pct + '%"></i></div>' +
      '<div class="pn-bar-num">提交 ' + l.submitted + '/' + l.tasks + ' · 反馈 ' + l.feedback + ' 条</div></div>';
  }).join('');

  var submitPct = pnPct(sum.submitted, sum.total);
  var top = Object.keys(sum.levels).sort(function (a, b) { return sum.levels[b] - sum.levels[a]; })[0];

  return pageHead('学情分析', '基于老师已确认的反馈统计 · 不含排名',
      btn('刷新数据', 'pn-refresh', '', 'sm ghost')) +
    '<div class="grid stats">' +
    '<div class="stat"><div class="num">' + submitPct + '%</div><div class="label">提交率</div>' +
    '<div class="extra">' + sum.submitted + ' / ' + sum.total + ' 个任务</div></div>' +
    '<div class="stat teal"><div class="num">' + sum.feedback + '</div><div class="label">反馈总数</div>' +
    '<div class="extra">覆盖 ' + sum.lessons.length + ' 个课例</div></div>' +
    '<div class="stat amber"><div class="num">' + sum.revise + '</div><div class="label">待订正</div>' +
    '<div class="extra">已完成订正 ' + sum.resubmitted + ' 个</div></div>' +
    '<div class="stat"><div class="num">' + (sum.feedback ? esc(top) : '—') + '</div><div class="label">最常见评价</div>' +
    '<div class="extra">按老师反馈等级统计</div></div></div>' +
    pnTrendCard(data) +
    '<div class="card" style="margin-top:16px"><div class="section-title"><span class="dot"></span>反馈等级分布</div>' +
    (sum.feedback ? levelRows : empty('还没有足够的数据。')) + '</div>' +
    '<div class="card" style="margin-top:16px"><div class="section-title"><span class="dot"></span>各课例提交情况</div>' +
    (lessonRows || empty('还没有课例数据。')) + '</div>' +
    banner('这些数字只用来观察趋势，不是成绩。反馈等级由老师逐条确认，家长端不显示标准答案、其他孩子的记录或班级排名。', 'info', 'i');
}

function pnWeeklyView(data) {
  var groups = {};
  var order = [];
  pnTasks(data).forEach(function (t) {
    var sub = pnSub(t);
    var at = sub ? sub.submitted_at : t.due_at;
    var wk = pnWeek(at);
    if (!wk) return;
    if (!groups[wk]) { groups[wk] = { week: wk, tasks: 0, feedback: 0, levels: {} }; order.push(wk); }
    groups[wk].tasks++;
    pnFeedback(t).forEach(function (f) {
      groups[wk].feedback++;
      var lv = f.level || '未标注';
      groups[wk].levels[lv] = (groups[wk].levels[lv] || 0) + 1;
    });
  });

  var notes = pnRead(PN_LS_NOTES, {});
  var blocks = order.map(function (wk) {
    var g = groups[wk];
    var lvText = Object.keys(g.levels).map(function (k) { return k + ' ' + g.levels[k]; }).join(' · ') || '暂无反馈';
    var id = 'pn-note-' + wk.replace(/\s+/g, '-');
    return '<div class="card pn-week">' +
      '<div class="row" style="justify-content:space-between">' +
      '<div class="pn-row-title">' + esc(wk) + '</div>' +
      '<div class="row">' + chip('任务 ' + g.tasks) + chip('反馈 ' + g.feedback, 'teal') + '</div></div>' +
      '<div class="tiny muted" style="margin:6px 0 10px">' + esc(lvText) + '</div>' +
      '<label class="tiny muted" for="' + id + '">本周陪伴记录（只保存在这台设备）</label>' +
      '<textarea class="textarea" rows="3" id="' + id + '" data-week="' + esc(wk) + '" placeholder="例如：周三陪孩子读了 10 分钟单词卡，周四主动订正了一题。">' + esc(notes[wk] || '') + '</textarea>' +
      '<div class="row" style="margin-top:8px">' +
      btn('保存记录', 'pn-note-save', 'data-week="' + esc(wk) + '"', 'sm primary') +
      btn('清空', 'pn-note-clear', 'data-week="' + esc(wk) + '"', 'sm ghost') +
      '</div></div>';
  }).join('');

  return pageHead('每周回顾', '按提交时间归周 · 记录只在本机保存',
      btn('打印本周周报', 'pn-print', '', 'sm') +
      btn('刷新数据', 'pn-refresh', '', 'sm ghost')) +
    (blocks ? blocks : empty('还没有提交记录，等孩子提交第一份作业后再来看看。')) +
    banner('周记不会上传到服务器，也不会同步给老师。如果需要沟通，请复制到「家校留言」再发给老师。', 'info', 'i');
}

function pnMessagesView() {
  var list = pnRead(PN_LS_MSGS, []);
  var rows = list.map(function (m, i) {
    return '<div class="card pn-msg">' +
      '<div class="row" style="justify-content:space-between"><span class="tiny muted">' + esc(m.at || '') + '</span>' +
      '<span class="row">' + btn('复制', 'pn-msg-copy', 'data-i="' + i + '"', 'sm ghost') +
      btn('删除', 'pn-msg-del', 'data-i="' + i + '"', 'sm ghost') + '</span></div>' +
      '<div class="pn-msg-text">' + nl2br(m.text || '') + '</div></div>';
  }).join('');

  return pageHead('家校留言', '先在本机拟稿，再复制发给老师', '') +
    '<div class="card"><div class="section-title"><span class="dot"></span>写一条留言</div>' +
    '<div class="card-sub">建议写清楚：哪一次任务、孩子遇到的困难、希望老师怎么配合。草稿只存在本机。</div>' +
    '<textarea class="textarea" rows="4" id="pn-msg-input" placeholder="例如：王老师，Animals 这次作业的句子排序孩子还不熟练，家里已经练了两遍，想请您看看是否需要再订正一次。"></textarea>' +
    '<div class="row" style="margin-top:10px;justify-content:space-between">' +
    '<span class="tiny muted">共 ' + list.length + ' 条本机草稿</span>' +
    btn('保存草稿', 'pn-msg-save', '', 'primary') + '</div></div>' +
    (rows ? '<div class="pn-msg-list">' + rows + '</div>' : empty('还没有留言草稿。'));
}

function pnHelpView() {
  return pageHead('使用说明', '家长视角的边界与说明', '') +
    '<div class="card pad-lg"><div class="section-title"><span class="dot"></span>这里能看到什么</div>' +
    '<ul class="pn-ul">' +
    '<li>孩子的任务名称、所属课例、截止时间；是否提交、提交时间、订正状态。</li>' +
    '<li>老师<strong>逐条确认</strong>后的反馈内容与等级（已完成 / 需局部修改 / 需教师帮助）。</li>' +
    '<li>基于这些已确认反馈汇总出的提交率、反馈等级分布等趋势数据。</li>' +
    '</ul></div>' +
    '<div class="card pad-lg" style="margin-top:14px"><div class="section-title"><span class="dot"></span>这里看不到什么</div>' +
    '<ul class="pn-ul">' +
    '<li>标准答案与得分排名——家长端不展示，避免把陪伴变成对分数。</li>' +
    '<li>其他孩子的作答记录与班级整体数据。</li>' +
    '<li>老师尚未确认的 AI 草稿反馈。</li>' +
    '</ul></div>' +
    '<div class="card pad-lg" style="margin-top:14px"><div class="section-title"><span class="dot"></span>建议怎么用</div>' +
    '<ul class="pn-ul">' +
    '<li>先看「任务进度」确认有没有待办，再看「订正档案」逐条读老师反馈。</li>' +
    '<li>每周末在「每周回顾」写两三句记录，比一次性复盘更有效。</li>' +
    '<li>留言草稿写好后复制发给老师；本机保存的内容不会自动同步。</li>' +
    '</ul></div>';
}

/* ---------------------------------------------------------------- 路由与外壳 */
function pnPageOf(key) {
  return PN_MODULES.filter(function (m) { return m.key === key; })[0] || PN_MODULES[0];
}

async function pnPage(key) {
  var mod = pnPageOf(key);
  if (mod.key === 'messages') return pnMessagesView();
  if (mod.key === 'help') return pnHelpView();
  var data;
  try {
    data = await pnData();
  } catch (err) {
    return pageHead(esc(mod.label), '家长只读视角', '') +
      '<div class="card pad-lg">' + banner(esc(err && err.message ? err.message : '数据加载失败'), 'error', '!') +
      '<div class="row" style="margin-top:14px">' + btn('重试', 'pn-refresh', '', 'primary') + '</div></div>';
  }
  if (mod.key === 'tasks') return pnTasksView(data);
  if (mod.key === 'revisions') return pnRevisionsView(data);
  if (mod.key === 'insights') return pnInsightsView(data);
  if (mod.key === 'weekly') return pnWeeklyView(data);
  return pnOverviewView(data);
}

function pnNav() {
  var segs = S.route || [];
  var active = segs[0] === 'parent' ? (segs[1] || 'overview') : 'overview';
  return '<div class="side-group">孩子</div>' + PN_MODULES.map(function (m) {
    var on = m.key === active ? ' active' : '';
    return '<a href="#/parent/' + m.key + '" class="' + (on ? 'active' : '') + '">' +
      '<span class="ico">' + icon(m.icon) + '</span>' + esc(m.label) + '</a>';
  }).join('');
}

var pnBaseShellNav = (typeof shellNav === 'function') ? shellNav : null;
shellNav = function () {
  if (S.user && S.user.role === 'parent') return pnNav();
  return pnBaseShellNav ? pnBaseShellNav() : '';
};

var pnBaseHomeView = (typeof homeView === 'function') ? homeView : null;
homeView = async function () {
  if (S.user && S.user.role === 'parent') {
    var segs = S.route || [];
    if (!segs.length || segs[0] === 'parent') return pnPage(segs[1] || 'overview');
  }
  return pnBaseHomeView ? pnBaseHomeView() : '';
};

/* ---------------------------------------------------------------- 交互 */
ACTIONS['pn-refresh'] = async function () {
  S.pnData = null;
  toast('已重新读取数据', 'ok');
  await render();
};

ACTIONS['pn-filter'] = async function (el) {
  S.pnFilter = el.getAttribute('data-f') || 'all';
  await render();
};

ACTIONS['pn-note-save'] = function (el) {
  var week = el.getAttribute('data-week');
  var box = el.closest('.pn-week').querySelector('textarea');
  var notes = pnRead(PN_LS_NOTES, {});
  notes[week] = box ? box.value : '';
  if (!pnWrite(PN_LS_NOTES, notes)) return toast('这条浏览器无法保存，请先复制内容备份', 'error');
  toast('本周记录已保存到本机', 'ok');
};

ACTIONS['pn-note-clear'] = function (el) {
  var week = el.getAttribute('data-week');
  var notes = pnRead(PN_LS_NOTES, {});
  delete notes[week];
  pnWrite(PN_LS_NOTES, notes);
  var box = el.closest('.pn-week').querySelector('textarea');
  if (box) box.value = '';
  toast('已清空本周记录', 'ok');
};

ACTIONS['pn-msg-save'] = async function () {
  var input = document.getElementById('pn-msg-input');
  var text = input ? input.value.trim() : '';
  if (!text) return toast('先写点什么再保存', 'error');
  var list = pnRead(PN_LS_MSGS, []);
  list.unshift({ at: new Date().toLocaleString('zh-CN'), text: text });
  if (!pnWrite(PN_LS_MSGS, list)) return toast('这条浏览器无法保存，请先复制内容备份', 'error');
  await render();
  toast('草稿已保存到本机', 'ok');
};

ACTIONS['pn-msg-del'] = async function (el) {
  var i = parseInt(el.getAttribute('data-i'), 10);
  var list = pnRead(PN_LS_MSGS, []);
  list.splice(i, 1);
  pnWrite(PN_LS_MSGS, list);
  await render();
};

ACTIONS['pn-msg-copy'] = async function (el) {
  var i = parseInt(el.getAttribute('data-i'), 10);
  var list = pnRead(PN_LS_MSGS, []);
  var item = list[i];
  if (!item) return;
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(item.text);
    } else {
      var ta = document.createElement('textarea');
      ta.value = item.text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    toast('已复制，可以直接粘贴给老师', 'ok');
  } catch (e) {
    toast('复制失败，请手动选中文字复制', 'error');
  }
};

/* ---------------------------------------------------------------- 到期提醒 */
function pnReminderHtml(tasks, nowMs) {
  var now = typeof nowMs === 'number' ? nowMs : Date.now();
  var items = [];
  (tasks || []).forEach(function (t) {
    if (pnSub(t)) return;
    var due = t.due_at ? new Date(String(t.due_at).replace(' ', 'T')).getTime() : NaN;
    if (isNaN(due)) return;
    var diff = due - now;
    if (diff < 0) items.push({ task: t, text: '已过截止时间，还没提交', bad: true });
    else if (diff <= 48 * 3600 * 1000) {
      items.push({ task: t, text: '还有 ' + Math.max(1, Math.round(diff / 3600000)) + ' 小时截止', bad: false });
    }
  });
  if (!items.length) return '';
  return '<div class="card pn-remind">' +
    '<div class="pn-detail-title" style="margin-bottom:6px">需要留意</div>' +
    items.map(function (item) {
      return '<div class="pn-remind-row' + (item.bad ? ' bad' : '') + '">' +
        '<span class="pn-remind-ico">' + (item.bad ? '⏰' : '⏳') + '</span>' +
        '<div><b>' + esc(item.task.title) + '</b>' +
        '<div class="tiny muted">' + esc(item.text) + ' · 截止 ' + esc(item.task.due_at || '不限') + '</div></div></div>';
    }).join('') + '</div>';
}

/* ---------------------------------------------------------------- 近 6 周趋势 */
function pnWeekOrder(weekText) {
  var m = /(\d{4})\D+(\d{1,2})/.exec(String(weekText || ''));
  return m ? parseInt(m[1], 10) * 100 + parseInt(m[2], 10) : 0;
}

function pnTrendCard(data) {
  var buckets = {};
  (data.tasks || []).forEach(function (t) {
    var sub = pnSub(t);
    if (!sub || !sub.submitted_at) return;
    var week = pnWeek(sub.submitted_at);
    if (!week) return;
    if (!buckets[week]) buckets[week] = { week: week, done: 0, feedback: 0 };
    buckets[week].done++;
    buckets[week].feedback += pnFeedback(t).length;
  });
  var keys = Object.keys(buckets).sort(function (a, b) { return pnWeekOrder(a) - pnWeekOrder(b); }).slice(-6);
  if (!keys.length) {
    return '<div class="card" style="margin-top:16px"><div class="section-title"><span class="dot"></span>近 6 周趋势</div>' +
      empty('还没有提交记录。') + '</div>';
  }

  var W = 320, H = 120, padX = 26, padY = 18;
  var maxDone = Math.max(1, Math.max.apply(null, keys.map(function (k) { return buckets[k].done; })));
  var maxFb = Math.max(1, Math.max.apply(null, keys.map(function (k) { return buckets[k].feedback; })));
  var slot = (W - padX * 2) / keys.length;
  var barW = Math.min(26, slot * 0.5);

  var bars = keys.map(function (k, i) {
    var b = buckets[k];
    var h = (b.done / maxDone) * (H - padY * 2);
    var x = padX + slot * i + (slot - barW) / 2;
    var y = H - padY - h;
    return '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + barW.toFixed(1) +
      '" height="' + Math.max(1, h).toFixed(1) + '" rx="4" fill="#4f8777" opacity=".85"></rect>' +
      '<text x="' + (x + barW / 2).toFixed(1) + '" y="' + (H - padY + 12) + '" font-size="8" text-anchor="middle" fill="#7b9198">' +
      esc(k.replace(/^\d{4}\s*年\s*第\s*/, '').replace(/\s*周$/, 'w')) + '</text>';
  }).join('');

  var points = keys.map(function (k, i) {
    var b = buckets[k];
    var x = padX + slot * i + slot / 2;
    var y = H - padY - (b.feedback / maxFb) * (H - padY * 2);
    return x.toFixed(1) + ',' + y.toFixed(1);
  }).join(' ');

  return '<div class="card" style="margin-top:16px"><div class="section-title"><span class="dot"></span>近 6 周趋势</div>' +
    '<div class="pn-trend"><svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="近 6 周提交与反馈趋势">' +
    '<line x1="' + padX + '" y1="' + (H - padY) + '" x2="' + (W - padX) + '" y2="' + (H - padY) + '" stroke="#e2ecea"></line>' +
    bars +
    '<polyline points="' + points + '" fill="none" stroke="#d99b1c" stroke-width="2" stroke-linejoin="round"></polyline>' +
    '</svg></div>' +
    '<div class="pn-legend"><span><i class="pn-dot teal"></i>提交数</span><span><i class="pn-dot amber"></i>反馈条数</span>' +
    '<span class="tiny muted">共 ' + keys.length + ' 周</span></div></div>';
}

/* ---------------------------------------------------------------- 交互补充 */
ACTIONS['pn-toggle-task'] = async function (el) {
  var id = el.getAttribute('data-id');
  S.pnOpenTask = String(S.pnOpenTask) === String(id) ? null : id;
  await render();
};

ACTIONS['pn-print'] = function () {
  toast('在打印对话框里选择「另存为 PDF」即可保存周报', 'ok');
  window.print();
};

var pnSearchTimer = null;
document.addEventListener('input', function (e) {
  if (!e.target || e.target.id !== 'pn-search') return;
  S.pnQuery = e.target.value;
  if (pnSearchTimer) clearTimeout(pnSearchTimer);
  pnSearchTimer = setTimeout(function () {
    if (!S.pnTasks) return;
    var visible = pnVisible(S.pnTasks);
    var box = document.getElementById('pn-list');
    if (box) box.innerHTML = pnListHtml(visible);
    var count = document.getElementById('pn-count');
    if (count) count.textContent = visible.length + ' / ' + S.pnTasks.length + ' 个任务';
  }, 160);
});

document.addEventListener('change', function (e) {
  if (!e.target || e.target.id !== 'pn-lesson') return;
  S.pnLesson = e.target.value;
  render();
});
