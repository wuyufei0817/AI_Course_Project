/* AI4En · 学生端与家长端 */
'use strict';

/* ---------------------------------------------------------------- 学生端路由 */
var STU_FILTERS = [['all', '全部'], ['open', '待完成'], ['submitted', '已提交'], ['revision', '待订正']];

async function studentView(kind) {
  var data = await api('/api/student/overview');
  S.stu = data;
  if (kind === 'tasks') return studentTasksView(data);
  if (kind === 'wrong') return studentWrongView(data);
  if (kind === 'records') return studentRecordsView(data);
  if (kind === 'report') return studentReportView(data);
  if (kind === 'words') return studentWordsView(data);
  if (kind === 'guide') return studentGuideView(data);
  return studentOverviewView(data);
}

function stuHead(title, sub, actions, art) {
  var right = (art ? '<img class="stu-head-art" src="/static/illustrations/learning.webp" width="1200" height="800" alt="" aria-hidden="true" loading="lazy" decoding="async">' : '') +
    (actions || '');
  var guides = {
    tasks: ['teaching', '先完成任务，再查看反馈', ['查看说明与截止时间', '完成作答并提交', '收到订正要求后再修改']],
    words: ['animals', '看一看，想一想，再说出来', ['先看英文和图片回忆', '展开中文与例句核对', '标记本次还需要练的词']],
    wrong: ['learning', '把需要再练的地方找出来', ['回看自己的作答', '读老师确认的建议', '回到任务查看订正要求']],
    records: ['learning', '每一次修改，都有迹可循', ['对照首次与订正答案', '说说自己改了什么', '换一个词再试着表达']],
    report: ['learning', '读懂记录，安排下一步', ['先看任务完成情况', '再看客观题作答统计', '选择一个重点继续练习']],
    guide: ['teaching', '跟着三个步骤开始学习', ['进入我的任务', '作答后等待老师反馈', '按要求订正并回看记录']]
  };
  var guide = guides[(S.route || [])[1]];
  return pageHead(title, esc(S.user.name) + ' · ' + esc(S.user.class_name || '') + (sub ? ' · ' + sub : ''), right) +
    (guide ? '<details class="page-help"><summary>' + guide[1] + '<span>使用提示</span></summary><ol>' + guide[2].map(function (step) { return '<li>' + step + '</li>'; }).join('') + '</ol></details>' : '');
}

function stuTaskState(t) {
  if (t.submission) return t.submission.status;
  return t.status === 'ended' ? 'ended' : 'open';
}

function stuTaskChip(t) {
  var st = stuTaskState(t);
  if (st === 'ended') return chip('已结束 · 未提交', 'red');
  var map = { open: ['未提交', 'amber'], submitted: ['已提交', 'gray'], revision_requested: ['待订正', 'amber'], resubmitted: ['已订正', 'teal'] };
  var item = map[st] || [st, 'gray'];
  return chip(item[0], item[1]);
}

function stuTaskCard(t) {
  var sub = t.submission;
  var action = sub ? (sub.status === 'revision_requested' ? '去订正' : '查看作业与反馈') : (t.status === 'ended' ? '查看任务' : '开始作答');
  return '<div class="card lesson-card ' + (sub ? '' : 'draft') + '"><div class="top"><div><h3>' + esc(t.title) + '</h3>' +
    '<div class="meta">' + esc(t.lesson_title) + ' · ' + t.item_count + ' 题</div></div>' + stuTaskChip(t) + '</div>' +
    '<div class="meta"><span>截止 ' + esc(t.due_at || '不限') + '</span>' +
    (sub ? '<span>提交于 ' + esc(String(sub.submitted_at).slice(0, 16)) + '</span>' : '<span>还没有提交</span>') + '</div>' +
    '<div class="row"><a class="btn primary sm" href="#/student/task/' + t.id + '">' + action + '</a>' +
    (sub ? '<a class="btn sm" href="#/student/wrong">看错题</a>' : '') + '</div></div>';
}

/* ---------------------------------------------------------------- 学习概览 */
function studentOverviewView(data) {
  var s = data.stats;
  var next = data.next_task;
  var accuracy = s.accuracy === null ? '—' : Math.round(s.accuracy) + '%';

  var statCards = [
    ['待完成', String(s.not_submitted), s.not_submitted ? '还有 ' + s.not_submitted + ' 个任务没提交' : '全部已提交', ''],
    ['待订正', String(s.pending_revision), s.pending_revision ? '老师要求你改一改' : '暂时没有订正要求', s.pending_revision ? 'amber' : ''],
    ['已提交', String(s.submitted) + ' / ' + s.assigned, '其中 ' + s.revised + ' 个已完成订正', 'teal'],
    ['客观题正确率', accuracy, s.objective_total ? '基于 ' + s.objective_total + ' 道客观题' : '还没有可统计的作答', '']
  ].map(function (c) {
    return '<div class="stat ' + c[3] + '"><div class="num">' + esc(c[1]) + '</div>' +
      '<div class="label">' + esc(c[0]) + '</div><div class="extra">' + esc(c[2]) + '</div></div>';
  }).join('');

  var nextCard;
  if (next) {
    var reasonChip = next.reason === '老师要求订正' ? chip('待订正', 'amber') : chip(next.reason, 'plain');
    nextCard = '<div class="card stu-next"><div class="row" style="justify-content:space-between">' +
      '<div><h3>' + esc(next.title) + '</h3>' +
      '<div class="card-sub" style="margin:4px 0 0">' + next.item_count + ' 题 · 截止 ' + esc(next.due_at || '不限') + '</div></div>' +
      reasonChip + '</div>' +
      '<div class="row" style="margin-top:14px"><a class="btn primary" href="#/student/task/' + next.id + '">' +
      (next.reason === '老师要求订正' ? '去订正' : '继续完成') + '</a>' +
      '<a class="btn" href="#/student/tasks">全部任务</a></div></div>';
  } else {
    nextCard = '<div class="card stu-next stu-done"><div class="row" style="gap:14px">' +
      '<div class="stu-done-mark">✓</div><div><h3>当前没有待办</h3>' +
      '<div class="card-sub" style="margin:4px 0 0">今天的任务都交了。可以用几分钟把学过的再看一遍。</div></div></div>' +
      '<ul class="stu-empty-list">' +
      '<li>翻一遍错题本，挑一道题重新读题</li>' +
      '<li>读一条老师确认过的反馈，试着改一句</li>' +
      '<li>把今天的单词说给家人听</li></ul>' +
      '<div class="row" style="margin-top:14px"><a class="btn" href="#/student/wrong">去错题本</a>' +
      '<a class="btn" href="#/student/records">看订正记录</a></div></div>';
  }

  var fb = (data.feedback || []).slice(0, 3).map(function (f) {
    return '<div class="stu-fb"><div class="row" style="justify-content:space-between;gap:8px">' +
      '<span class="tiny muted">' + esc(f.task_title) + '</span>' + levelChip(f.level) + '</div>' +
      '<div class="small stu-fb-text">' + nl2br(f.final) + '</div>' +
      '<div class="tiny muted">' + esc(String(f.at).slice(0, 16)) + '</div></div>';
  }).join('');
  var fbCard = '<div class="card"><div class="section-title"><span class="dot"></span>老师最近确认的反馈</div>' +
    (fb || '<div class="stu-empty small muted">还没有已确认的反馈。提交后老师会先改草稿，再确认给你看。</div>') +
    (fb ? '<div class="row" style="margin-top:12px"><a class="btn sm" href="#/student/tasks">回到任务</a></div>' : '') + '</div>';

  var tagBars = (data.tags || []).map(function (t) {
    var rate = t.total ? Math.round(t.correct / t.total * 100) : 0;
    return '<div class="stu-tag"><div class="row" style="justify-content:space-between">' +
      '<span class="small"><b>' + esc(t.tag) + '</b></span>' +
      '<span class="tiny muted">' + t.correct + ' / ' + t.total + ' 正确</span></div>' +
      '<div class="stu-bar"><i style="width:' + rate + '%"></i></div></div>';
  }).join('');
  var tagCard = '<div class="card"><div class="section-title"><span class="dot"></span>掌握情况（按标签）</div>' +
    (tagBars || '<div class="stu-empty small muted">完成一次作业后，这里会按“词汇 / 句型”等标签统计正确率。</div>') + '</div>';

  var timeline = (data.timeline || []).slice(0, 6).map(function (e) {
    return '<li class="stu-tl-item ' + esc(e.kind) + '"><span class="stu-tl-dot"></span>' +
      '<div><div class="small"><b>' + esc(e.title) + '</b></div>' +
      '<div class="tiny muted">' + esc(e.detail) + ' · ' + esc(String(e.at).slice(0, 16)) + '</div></div></li>';
  }).join('');
  var tlCard = '<div class="card"><div class="section-title"><span class="dot"></span>最近动态</div>' +
    (timeline ? '<ul class="stu-timeline">' + timeline + '</ul>' : '<div class="stu-empty small muted">还没有学习记录。</div>') + '</div>';

  return stuHead('学习概览', '这就是你自己的学习档案', '<a class="btn" href="#/student/tasks">我的任务</a>', true) +
    '<div class="grid stats" style="margin-bottom:16px">' + statCards + '</div>' +
    '<div class="grid two" style="margin-bottom:16px">' + nextCard + fbCard + '</div>' +
    '<div class="grid two">' + tagCard + tlCard + '</div>' +
    '<div style="margin-top:16px">' + banner('这里只汇总你本人的作答与老师已确认的反馈；标准答案和其他同学的记录不会出现。', 'info', 'i') + '</div>';
}

/* ---------------------------------------------------------------- 我的任务 */
function studentTasksView(data) {
  var tasks = data.tasks || [];
  var filter = S.stuFilter || 'all';
  var counts = { all: tasks.length, open: 0, submitted: 0, revision: 0 };
  tasks.forEach(function (t) {
    var st = stuTaskState(t);
    if (st === 'open' || st === 'ended') counts.open += 1;
    else counts.submitted += 1;
    if (st === 'revision_requested') counts.revision += 1;
  });

  var filters = STU_FILTERS.map(function (f) {
    var n = counts[f[0]];
    return '<button class="btn sm ' + (filter === f[0] ? 'primary' : '') + '" data-act="stu-filter" data-filter="' + f[0] + '">' +
      f[1] + ' <span class="tiny">' + n + '</span></button>';
  }).join('');

  var list = tasks.filter(function (t) {
    var st = stuTaskState(t);
    if (filter === 'open') return st === 'open' || st === 'ended';
    if (filter === 'submitted') return st === 'submitted' || st === 'resubmitted';
    if (filter === 'revision') return st === 'revision_requested';
    return true;
  }).map(stuTaskCard).join('');

  return stuHead('我的任务', '共 ' + tasks.length + ' 个任务', '<a class="btn" href="#/student">返回概览</a>') +
    banner('你只会看到自己班的任务与自己的作答。老师的标准答案和其他同学的记录不会出现在这里。', 'info', 'i') +
    '<div class="row" style="margin:14px 0">' + filters + '</div>' +
    (list ? '<div class="grid two">' + list + '</div>' : empty(filter === 'revision' ? '没有待订正的任务。' : '这个筛选下暂时没有任务。'));
}

/* ---------------------------------------------------------------- 错题本 */
function studentWrongView(data) {
  var wrong = data.wrong || [];
  var byTag = {};
  wrong.forEach(function (w) { byTag[w.tag || '未分类'] = (byTag[w.tag || '未分类'] || 0) + 1; });
  var tagChips = Object.keys(byTag).map(function (k) { return chip(k + ' · ' + byTag[k], 'plain'); }).join(' ');

  var items = wrong.map(function (w, i) {
    var task = (data.tasks || []).find(function (t) { return t.id === w.task_id; });
    var status = task && task.submission ? task.submission.status : '';
    var stateLabel = status === 'revision_requested' ? '老师要求订正' : status === 'resubmitted' ? '订正已提交 · 可回看' : '复习记录';
    return '<div class="card stu-wrong"><div class="row" style="justify-content:space-between;gap:10px">' +
      '<div class="row" style="gap:8px"><span class="stu-wrong-no">' + (i + 1) + '</span>' +
      '<span class="tiny muted">' + esc(w.task_title) + '</span>' + chip(w.tag || '未分类', 'plain') + chip(stateLabel, status === 'revision_requested' ? 'amber' : 'gray') + '</div>' +
      '<a class="btn sm" href="#/student/task/' + w.task_id + '">查看对应任务</a></div>' +
      '<div class="stu-wrong-stem">' + esc(w.stem) + '</div>' +
      '<div class="row" style="gap:16px;align-items:flex-start">' +
      '<div class="small"><span class="tiny muted">' + (w.revised ? '首次作答' : '你的作答') + '</span><div class="stu-answer">' + (w.my_answer ? esc(w.my_answer) : '<span class="muted">未作答</span>') + '</div></div>' +
      (w.revised ? '<div class="small"><span class="tiny muted">订正后</span><div class="stu-answer stu-answer-ok">' + esc(w.revised) + '</div></div>' : '') +
      (w.level ? '<div class="small"><span class="tiny muted">老师的评价</span><div>' + levelChip(w.level) + '</div></div>' : '') +
      '</div>' +
      (w.feedback ? '<div class="feedback-box" style="margin-left:0"><div class="fb-head">老师已确认的反馈</div>' + nl2br(w.feedback) + '</div>' : '') +
      '</div>';
  }).join('');

  return stuHead('错题本', wrong.length ? wrong.length + ' 道需要再看一眼' : '暂时没有错题',
      '<a class="btn" href="#/student">返回概览</a>') +
    banner('这里只展示你的复习记录和老师已确认的反馈。订正提交后记录仍会保留；是否需要继续修改，请查看对应任务。', 'info', 'i') +
    (wrong.length
      ? '<div class="row" style="margin:18px 0">' + tagChips + '</div>' +
        '<div class="stack">' + items + '</div>'
      : empty('还没有错题。完成作业后，选错或需要修改的题目会自动出现在这里。'));
}

/* ---------------------------------------------------------------- 订正记录 */
function studentRecordsView(data) {
  var revisions = data.revisions || [];
  var timeline = (data.timeline || []).map(function (e) {
    return '<li class="stu-tl-item ' + esc(e.kind) + '"><span class="stu-tl-dot"></span>' +
      '<div><div class="small"><b>' + esc(e.title) + '</b></div>' +
      '<div class="tiny muted">' + esc(e.detail) + ' · ' + esc(String(e.at).slice(0, 16)) + '</div></div></li>';
  }).join('');

  var blocks = revisions.map(function (r) {
    var changes = (r.changes || []).map(function (c) {
      return '<div class="stu-change"><div class="small"><b>' + esc(c.stem) + '</b></div>' +
        '<div class="row" style="gap:10px;align-items:flex-start;margin-top:6px">' +
        '<div class="stu-before">' + (c.before ? esc(c.before) : '未作答') + '</div>' +
        '<div class="stu-arrow">→</div>' +
        '<div class="stu-after">' + (c.after ? esc(c.after) : '未作答') + '</div></div></div>';
    }).join('');
    return '<div class="card"><div class="row" style="justify-content:space-between;gap:10px">' +
      '<div><h3>' + esc(r.task_title) + '</h3>' +
      '<div class="card-sub" style="margin:4px 0 0">订正保存于 ' + esc(String(r.at).slice(0, 16)) + '</div></div>' +
      '<a class="btn sm" href="#/student/task/' + r.task_id + '">查看任务</a></div>' +
      (changes ? '<div class="stu-changes">' + changes + '</div>'
               : '<div class="small muted" style="margin-top:10px">这次订正没有改动内容。</div>') + '</div>';
  }).join('');

  return stuHead('订正记录', revisions.length ? '共 ' + revisions.length + ' 次订正' : '还没有订正记录',
      '<a class="btn" href="#/student">返回概览</a>') +
    banner('每次订正都会保留首次作答和订正后的版本，老师可以看到前后对比；你自己也能在这里回看。', 'info', 'i') +
    (revisions.length ? '<div class="stack" style="margin-top:14px">' + blocks + '</div>' : empty('老师要求订正并在任务页提交后，这里会出现前后对比。')) +
    '<div class="card" style="margin-top:16px"><div class="section-title"><span class="dot"></span>学习时间线</div>' +
    (timeline ? '<ul class="stu-timeline">' + timeline + '</ul>' : '<div class="small muted">还没有记录。</div>') + '</div>';
}

/* ---------------------------------------------------------------- 学习报告 */
function studentReportView(data) {
  var s = data.stats;
  var tags = data.tags || [];
  var weeks = data.weeks || [];
  var rate = s.assigned ? Math.round(s.submitted / s.assigned * 100) : 0;
  var accuracy = s.accuracy === null ? '—' : Math.round(s.accuracy) + '%';

  var stats = [
    ['提交率', rate + '%', s.submitted + ' / ' + s.assigned + ' 个任务', 'teal'],
    ['客观题正确率', accuracy, s.objective_total ? '共 ' + s.objective_total + ' 道客观题' : '还没有可统计的作答', ''],
    ['待订正', String(s.pending_revision), s.pending_revision ? '先读反馈再改' : '暂时没有订正', s.pending_revision ? 'amber' : ''],
    ['错题', String(s.wrong), '都在错题本里', s.wrong ? 'amber' : '']
  ].map(function (c) {
    return '<div class="stat ' + c[3] + '"><div class="num">' + esc(c[1]) + '</div>' +
      '<div class="label">' + esc(c[0]) + '</div><div class="extra">' + esc(c[2]) + '</div></div>';
  }).join('');

  var maxTotal = weeks.reduce(function (m, w) { return Math.max(m, w.submitted || 0, 1); }, 1);
  var weekRows = weeks.map(function (w) {
    var acc = w.accuracy === null ? 0 : Math.round(w.accuracy);
    return '<div class="stu-week"><span class="stu-week-label">' + esc(w.label) + ' 起</span>' +
      '<div class="stu-week-bars">' +
        '<div class="stu-bar"><i style="width:' + Math.max(4, Math.round((w.submitted / maxTotal) * 100)) + '%"></i></div>' +
        '<div class="stu-bar alt"><i style="width:' + Math.max(0, acc) + '%"></i></div>' +
      '</div>' +
      '<span class="stu-week-val">' + w.submitted + ' 次 · ' + (w.accuracy === null ? '—' : acc + '%') + '</span></div>';
  }).join('');
  var weekCard = '<div class="card"><div class="section-title"><span class="dot"></span>近四周节奏</div>' +
    (weekRows
      ? '<div class="stu-legend"><span><i class="lg-a"></i>提交次数</span><span><i class="lg-b"></i>客观题正确率</span></div>' + weekRows
      : '<div class="stu-empty small muted">还没有按周统计的作答记录；提交一次作业后这里会出现趋势。</div>') + '</div>';

  var tagRows = tags.map(function (t) {
    var r = t.total ? Math.round(t.correct / t.total * 100) : 0;
    return '<div class="stu-tag"><div class="row" style="justify-content:space-between">' +
      '<span class="small"><b>' + esc(t.tag) + '</b></span>' +
      '<span class="tiny muted">' + t.correct + ' / ' + t.total + ' · ' + r + '%</span></div>' +
      '<div class="stu-bar"><i style="width:' + r + '%"></i></div></div>';
  }).join('');
  var tagCard = '<div class="card"><div class="section-title"><span class="dot"></span>知识点掌握</div>' +
    (tagRows || '<div class="stu-empty small muted">完成一次作业后，这里会按“词汇 / 句型”等标签给出正确率。</div>') + '</div>';

  var advice = [];
  if (s.pending_revision) advice.push('有 ' + s.pending_revision + ' 份作业老师已要求订正：先读反馈，再回到任务页提交订正。');
  if (s.not_submitted) advice.push('还有 ' + s.not_submitted + ' 个任务没有提交，留意截止时间。');
  var weak = tags.filter(function (t) { return t.total && t.correct / t.total < 0.8; })
    .sort(function (a, b) { return a.correct / a.total - b.correct / b.total; })[0];
  if (weak) advice.push('「' + weak.tag + '」正确率 ' + Math.round(weak.correct / weak.total * 100) + '%，可以先去单词卡过一遍，再回错题本重做。');
  if (s.accuracy !== null && s.accuracy >= 90) advice.push('客观题整体正确率不错，下一步把重点放在开放题的完整表达上。');
  if (!advice.length) advice.push('目前没有明显短板，保持每周看一次报告、复盘一次错题即可。');

  var adviceCard = '<div class="card"><div class="section-title"><span class="dot"></span>下一步建议</div>' +
    '<ul class="stu-list">' + advice.map(function (a) { return '<li>' + esc(a) + '</li>'; }).join('') + '</ul>' +
    '<div class="row" style="margin-top:12px"><a class="btn sm primary" href="#/student/wrong">去错题本</a>' +
    '<a class="btn sm" href="#/student/words">去单词卡</a></div></div>';

  return stuHead('学习报告', '近四周的节奏、掌握情况与下一步', '<a class="btn" href="#/student">返回概览</a>') +
    '<div class="grid stats" style="margin-bottom:16px">' + stats + '</div>' +
    '<div class="grid two" style="margin-bottom:16px">' + weekCard + tagCard + '</div>' +
    adviceCard +
    '<div style="margin-top:16px">' + banner('报告只统计你自己的提交与作答，不包含标准答案、班级排名或其他同学的数据。', 'info', 'i') + '</div>';
}

/* ---------------------------------------------------------------- 单词卡 */
function studentWordsView(data) {
  var words = data.vocab || [];
  if (!S.wordPractice || S.wordPractice.userId !== S.user.id) S.wordPractice = { userId: S.user.id, marks: {}, onlyPending: false };
  var practice = S.wordPractice;
  var remembered = words.filter(function (w) { return practice.marks[w.word] === true; }).length;
  var visible = words.filter(function (w) { return !practice.onlyPending || practice.marks[w.word] !== true; });
  var cards = visible.map(function (w) {
    var thumb = w.image
      ? '<img class="word-thumb" src="' + esc(w.image) + '" alt="" width="240" height="240" loading="lazy" decoding="async">'
      : '<span class="word-initial" aria-hidden="true">' + esc(w.initial || String(w.word).slice(0, 1).toUpperCase()) + '</span>';
    return '<article class="stu-word-practice"><details class="word-card"><summary>' + thumb +
      '<span class="word-en">' + esc(w.word) + '</span>' +
      '<span class="word-hint">看中文与例句</span></summary>' +
      '<div class="word-body"><div class="word-zh">' + esc(w.zh || '—') + '</div>' +
      '<div class="word-sentence">' + esc(w.sentence || '') + '</div></div></details>' +
      '<div class="stu-word-controls"><span class="tiny muted">' + (practice.marks[w.word] === true ? '本次已记住' : practice.marks[w.word] === false ? '本次再练一遍' : '回忆后选一项') + '</span><div class="row">' +
      '<button class="btn sm" data-act="stu-word-mark" data-word="' + esc(w.word) + '" data-mark="yes" aria-pressed="' + (practice.marks[w.word] === true) + '">记住了</button>' +
      '<button class="btn sm" data-act="stu-word-mark" data-word="' + esc(w.word) + '" data-mark="no" aria-pressed="' + (practice.marks[w.word] === false) + '">再练一遍</button></div></div></article>';
  }).join('');

  var sentences = data.sentences || [];
  var sentenceCard = sentences.length
    ? '<div class="card" style="margin-top:16px"><div class="section-title"><span class="dot"></span>本单元句型' +
      '<span class="tiny muted" style="font-weight:400">　先读两遍，再遮住句子自己说一遍</span></div>' +
      '<ul class="stu-sentences">' + sentences.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul></div>'
    : '';

  return stuHead('单词卡', words.length ? '本单元 ' + words.length + ' 个目标词' : '还没有词表', '<a class="btn" href="#/student">返回概览</a>') +
    '<div class="card stu-practice-toolbar"><div><b>本次练习：已记住 ' + remembered + ' / ' + words.length + ' 个词</b><p class="small muted">这是你的自我检查，仅在当前页面会话保留，不计入成绩。</p></div><button class="btn" data-act="stu-word-filter" aria-pressed="' + practice.onlyPending + '">' + (practice.onlyPending ? '查看全部词卡' : '只练未记住的词') + '</button></div>' +
    (words.length
      ? (cards ? '<div class="word-grid" style="margin-top:14px">' + cards + '</div>' : empty('本轮词卡都标记为记住了。可以查看全部词卡，再遮住中文试一次。'))
      : empty('老师还没给这个课例设置目标词汇，完成一次作业后再来看看。')) +
    sentenceCard +
    '<div style="margin-top:16px">' + banner('词卡只包含词汇、中文释义与例句，不包含练习的标准答案。', 'info', 'i') + '</div>';
}

/* ---------------------------------------------------------------- 使用说明 */
function studentGuideView() {
  var steps = '<div class="grid three" style="margin-bottom:16px">' + [
    ['看任务', '在我的任务里点开一条任务，先读说明和截止时间；能看到“本次可以点提示”这样的规则。'],
    ['作答并提交', '选择题选一个、填空题填一个单词、开放题写两句。最后一题写完后提交，提交后不能自己改。'],
    ['看反馈、订正', '老师确认反馈后，任务页会出现反馈框；如果老师要求订正，会多一个“开始订正”按钮。']
  ].map(function (s, i) {
    return '<div class="card"><div class="row" style="gap:12px;align-items:flex-start">' +
      '<span class="stu-wrong-no">' + (i + 1) + '</span><div><h3>' + esc(s[0]) + '</h3>' +
      '<div class="small muted" style="margin-top:6px;line-height:1.8">' + esc(s[1]) + '</div></div></div></div>';
  }).join('') + '</div>';

  return stuHead('使用说明', '学生端怎么看、怎么交、怎么订正', '<a class="btn" href="#/student/tasks">我的任务</a>') +
    '<div class="grid two" style="margin-bottom:16px">' +
      '<div class="card"><div class="section-title"><span class="dot"></span>你能看到</div><ul class="stu-list">' +
        '<li>自己班的任务说明、题目和截止时间</li>' +
        '<li>自己提交的答案与提交时间</li>' +
        '<li>老师确认后的反馈，以及是否要求订正</li>' +
        '<li>自己的错题、订正前后对比与学习记录</li></ul></div>' +
      '<div class="card"><div class="section-title"><span class="dot"></span>你看不到</div><ul class="stu-list">' +
        '<li>标准答案与解析（只在老师的答案页里）</li>' +
        '<li>其他同学的作答与成绩</li>' +
        '<li>老师还没确认的反馈草稿</li>' +
        '<li>班级排名或统计</li></ul></div>' +
    '</div>' + steps +
    banner('如果提交时提示“还有题目没有作答”，说明漏题了，页面会保留你已经写的内容，补完再提交即可。', 'warn', '!');
}

/* ---------------------------------------------------------------- 学生任务页 */
async function studentTaskView(id) {
  var data = await api('/api/tasks/' + id + '/student');
  S.stTask = data;
  var task = data.task;
  var sub = data.submission;
  var items = data.items || [];

  if (!sub) {
    S.answers = S.answers && S.answerTaskId === id ? S.answers : {};
    S.answerTaskId = id;
    return studentHeader(task, '') + studentForm(task, items, false);
  }
  S.answers = S.answerTaskId === id ? S.answers : clone(sub.answers || {});
  S.answerTaskId = id;

  var feedback = sub.feedback || {};
  var grading = sub.grading || {};
  var answered = Object.keys(sub.answers || {}).length;
  var correct = Object.keys(grading).filter(function (k) { return grading[k] === true; }).length;
  var totalObj = Object.keys(grading).length;

  var summary = '<div class="grid stats" style="margin-bottom:16px">' +
    '<div class="stat teal"><div class="num">' + subChip(sub.status) + '</div><div class="label">提交状态</div>' +
    '<div class="extra">提交于 ' + esc(String(sub.submitted_at).slice(0, 16)) + '</div></div>' +
    '<div class="stat"><div class="num">' + answered + ' / ' + items.length + '</div><div class="label">已作答</div>' +
    '<div class="extra">提交后不能修改，除非老师要求订正</div></div>' +
    '<div class="stat"><div class="num">' + (sub.reveal_result ? correct + ' / ' + totalObj : '—') + '</div><div class="label">客观题正确</div>' +
    '<div class="extra">' + (sub.reveal_result ? '按老师确认的答案判定' : '老师设置了稍后展示') + '</div></div>' +
    '<div class="stat"><div class="num">' + Object.keys(feedback).length + '</div><div class="label">已确认反馈</div>' +
    '<div class="extra">只有老师确认后才会显示</div></div></div>';

  var itemHtml = items.map(function (item, i) {
    var ans = (sub.answers || {})[item.id];
    var ok = grading[item.id];
    var fb = feedback[item.id];
    var body = '';
    if (item.type === 'choice') {
      body = '<div class="opt-list">' + (item.options || []).map(function (o, j) {
        var letter = String.fromCharCode(65 + j);
        var cls = 'opt-row';
        if (sub.reveal_result && ans === letter) cls += ok ? ' correct' : ' wrong';
        else if (sub.reveal_result && item.answer === letter && ans !== letter) cls += ' correct';
        return '<div class="' + cls + '"><span class="opt-key">' + letter + '</span><span>' + esc(o) + '</span>' +
          (ans === letter ? '<span class="chip plain" style="margin-left:auto">你的选择</span>' : '') + '</div>';
      }).join('') + '</div>';
    } else {
      body = '<div class="answer-line" style="margin-left:36px"><span class="tiny muted">你的作答：</span>' +
        '<div>' + (ans ? esc(ans) : '<span class="muted">未作答</span>') + '</div></div>';
    }
    return '<div class="card" style="margin-bottom:12px"><div class="q-head" style="display:flex;gap:10px;align-items:baseline">' +
      '<span class="q-no">' + (i + 1) + '</span><span class="q-stem">' + esc(item.stem) + '</span>' +
      (sub.reveal_result && item.type !== 'short'
        ? '<span class="q-meta">' + (ok === true ? chip('正确', 'teal') : ok === false ? chip('再检查', 'red') : '') + '</span>' : '') +
      '</div>' + body +
      (fb ? '<div class="feedback-box"><div class="fb-head">老师已确认的反馈 ' + levelChip(fb.level) + '</div>' + nl2br(fb.final) + '</div>' : '') +
      '</div>';
  }).join('');

  var reviseBanner = sub.can_revise
    ? '<div class="card revise-banner" style="margin-bottom:16px"><div class="row" style="justify-content:space-between">' +
      '<div><b>老师要求订正</b><div class="small muted">读完老师的反馈再改；提交后首次作答仍会保留。</div></div>' +
      btn(S.revising ? '收起订正' : '开始订正', 'toggle-revise', '', 'primary') + '</div></div>' +
      (S.revising ? studentForm(task, items, true) : '')
    : '';

  return studentHeader(task, '<a class="btn" href="#/student/tasks">返回任务列表</a>') +
    summary + itemHtml + reviseBanner;
}

function studentHeader(task, actions) {
  var ruleText = [];
  ruleText.push(task.allow_hints ? '本次可以点“提示”' : '本次不提供提示');
  if (task.show_result === 'immediately') ruleText.push('提交后立即显示客观题对错');
  else if (task.show_result === 'after_end') ruleText.push('任务结束后显示对错');
  else ruleText.push('不显示对错，只显示已提交');
  return '<div class="page-head"><div><div class="tiny muted"><a href="#/student">学习概览</a> / <a href="#/student/tasks">我的任务</a> / 作业</div>' +
    '<h1>' + esc(task.title) + '</h1>' +
    '<div class="sub">' + esc(task.instructions || '') + '</div></div><div class="row">' + (actions || '') + '</div></div>' +
    '<div class="row" style="margin-bottom:14px">' + chip('截止 ' + (task.due_at || '不限'), 'plain') + chip(ruleText.join(' · '), 'gray') +
    (task.status === 'ended' ? chip('任务已结束', 'gray') : '') +
    (task.overdue && task.status !== 'ended' ? chip('已过提交时间', 'red') : '') + '</div>';
}

function studentForm(task, items, revising) {
  var editable = revising ? true : (task.status === 'ongoing' && !task.overdue);
  var rows = items.map(function (item, i) {
    var ans = (S.answers || {})[item.id] || '';
    var input = '';
    if (item.type === 'choice') {
      input = '<div class="opt-list">' + (item.options || []).map(function (o, j) {
        var letter = String.fromCharCode(65 + j);
        return '<label class="opt-row' + (ans === letter ? ' selected' : '') + '">' +
          '<input type="radio" name="ans-' + item.id + '" value="' + letter + '" data-state="answers" data-bind="' + item.id + '"' +
          (ans === letter ? ' checked' : '') + (editable ? '' : ' disabled') + '>' +
          '<span class="opt-key">' + letter + '</span><span>' + esc(o) + '</span></label>';
      }).join('') + '</div>';
    } else if (item.type === 'fill') {
      input = '<div class="answer-line"><input class="input" data-state="answers" data-bind="' + item.id + '" value="' + esc(ans) + '"' +
        (editable ? '' : ' disabled') + ' placeholder="填写一个单词"></div>';
    } else {
      var support = '';
      if (S.stTask && S.stTask.items) {
        var extra = item.frame ? '<div class="tiny muted">句架：' + esc(item.frame) + '</div>' : '';
        var kw = item.keywords ? '<div class="tiny muted">关键词：' + esc(item.keywords) + '</div>' : '';
        support = extra + kw;
      }
      input = '<div style="margin-left:36px">' + support +
        '<textarea class="textarea" rows="4" style="margin-top:8px" data-state="answers" data-bind="' + item.id + '"' +
        (editable ? '' : ' disabled') + ' placeholder="写 2 句话">' + esc(ans) + '</textarea></div>';
    }
    return '<div class="q-item"><div class="q-head"><span class="q-no">' + (i + 1) + '</span>' +
      '<span class="q-stem">' + esc(item.stem) + '</span><span class="q-meta">' + (TYPE_LABEL[item.type] || '') + '</span></div>' +
      input +
      (task.allow_hints && item.hint && editable
        ? '<div style="margin:8px 0 0 36px"><button class="btn sm ghost" data-act="show-hint" data-item="' + item.id + '">提示</button>' +
          '<span class="tiny muted" id="hint-' + item.id + '" style="display:none">' + esc(item.hint) + '</span></div>' : '') +
      '</div>';
  }).join('');

  var overdueNote = (!revising && task.overdue)
    ? banner('已超过提交时间（' + esc(task.due_at) + '），本次不能提交。请联系老师说明情况，由老师决定是否补交。', 'warn', '!')
    : '';

  return overdueNote + '<div class="card pad-lg"><div class="section-title"><span class="dot"></span>' +
    (revising ? '订正作答' : '作答') + '</div>' +
    '<div class="card-sub">共 ' + items.length + ' 题。提交前请确认每题都已作答，未作答的题目不会提交成功。</div>' +
    '<div id="answerForm">' + rows + '</div>' +
    '<div class="row" style="margin-top:18px;justify-content:space-between">' +
    '<span class="tiny muted">提交后页面会显示客观题结果与老师已确认的反馈。</span>' +
    (revising ? btn('提交订正', 'submit-revise', 'data-sid="' + (S.stTask && S.stTask.submission ? S.stTask.submission.id : '') + '"', 'primary')
              : (task.overdue ? btn('已过提交时间', 'submit-task', 'disabled', 'primary') : btn('提交作业', 'submit-task', 'data-id="' + task.id + '"', 'primary'))) +
    '</div></div>';
}

ACTIONS['stu-word-mark'] = function (el) {
  if (!S.wordPractice || S.wordPractice.userId !== S.user.id) return;
  S.wordPractice.marks[el.getAttribute('data-word')] = el.getAttribute('data-mark') === 'yes';
  render();
};
ACTIONS['stu-word-filter'] = function () {
  if (!S.wordPractice || S.wordPractice.userId !== S.user.id) return;
  S.wordPractice.onlyPending = !S.wordPractice.onlyPending;
  render();
};
ACTIONS['stu-filter'] = function (el) {
  S.stuFilter = el.getAttribute('data-filter') || 'all';
  render();
};

ACTIONS['show-hint'] = function (el) {
  var hint = document.getElementById('hint-' + el.getAttribute('data-item'));
  if (hint) hint.style.display = hint.style.display === 'none' ? 'inline' : 'none';
};

ACTIONS['toggle-revise'] = function () {
  S.revising = !S.revising;
  render();
};

ACTIONS['submit-task'] = async function (el) {
  var id = el.getAttribute('data-id');
  var res = await api('/api/tasks/' + id + '/submit', 'POST', { answers: S.answers });
  toast(res.notice || '已提交', 'ok');
  S.answerTaskId = null;
  await render();
};

ACTIONS['submit-revise'] = async function (el) {
  var sid = el.getAttribute('data-sid');
  var res = await api('/api/submissions/' + sid + '/revise', 'POST', { answers: S.answers });
  toast(res.notice || '订正已提交', 'ok');
  S.revising = false;
  S.answerTaskId = null;
  await render();
};

/* ---------------------------------------------------------------- 家长端 */
function parentHomeView(data) {
  var child = data.child || {};
  var cards = (data.tasks || []).map(function (t) {
    var sub = t.submission;
    var statusChip = sub ? subChip(sub.status) : chip('未提交', 'amber');
    var fb = (t.feedback || []).map(function (f) {
      return '<div class="feedback-box" style="margin-left:0"><div class="fb-head">老师反馈 ' + levelChip(f.level) + '</div>' +
        '<div class="tiny muted" style="margin-bottom:4px">' + esc(f.stem) + '</div>' + nl2br(f.final) + '</div>';
    }).join('');
    return '<div class="card lesson-card"><div class="top"><div><h3>' + esc(t.title) + '</h3>' +
      '<div class="meta">' + esc(t.lesson_title) + ' · 截止 ' + esc(t.due_at || '不限') + '</div></div>' + statusChip + '</div>' +
      (sub ? '<div class="tiny muted">提交于 ' + esc(String(sub.submitted_at).slice(0, 16)) + '</div>' : '') +
      fb +
      '<div class="banner info" style="margin-top:12px"><span class="icon">i</span><div><b>陪伴建议</b><br>' + esc(t.suggestion) + '</div></div>' +
      '</div>';
  }).join('');
  return pageHead('孩子任务', '家长视角 · 只读 · 只显示绑定孩子的内容', '') +
    '<div class="card" style="margin-bottom:16px"><div class="row" style="justify-content:space-between">' +
    '<div><div class="tiny muted">我的孩子</div><h3>' + esc(child.name || '') + '</h3></div>' +
    '<div class="row">' + chip('只读', 'gray') + chip('不含答案与排名', 'plain') + '</div></div></div>' +
    banner('这里只显示孩子的任务说明、提交与订正状态、老师已确认的反馈。看不到标准答案、其他孩子记录或班级排名。', 'info', 'i') +
    '<div class="grid two" style="margin-top:16px">' + (cards || empty('暂时没有可查看的任务。')) + '</div>';
}
