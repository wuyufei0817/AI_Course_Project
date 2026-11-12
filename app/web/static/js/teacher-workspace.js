/* 教师工作台：导航、课例上下文与教学入口；业务写入复用原接口。 */
'use strict';

var TEACHER_MODULES = [
  { group: '教学总览', key: 'home', label: '工作台', icon: 'home' },
  { group: '教学总览', key: 'lessons', label: '课例库', icon: 'book' },
  { group: '课前与课堂', key: 'plan', label: '教案备课', icon: 'task' },
  { group: '课前与课堂', key: 'slides', label: '课件与教具', icon: 'cards' },
  { group: '课前与课堂', key: 'activities', label: '课堂互动', icon: 'compass' },
  { group: '课前与课堂', key: 'exercises', label: '练习与命题', icon: 'task' },
  { group: '课后与评价', key: 'tasks', label: '任务管理', icon: 'calendar' },
  { group: '课后与评价', key: 'reviews', label: '批改与订正', icon: 'rotate' },
  { group: '课后与评价', key: 'results', label: '学情分析', icon: 'chart' },
  { group: '课后与评价', key: 'logs', label: '教学日志', icon: 'book' },
  { group: '教师支持', key: 'guide', label: '教师成长与帮助', icon: 'book' }
];
var TW = { lessons: [], current: null, userId: null, hash: '', dirty: new Set(), allowLeave: false };

function teacherActiveModule() {
  var r = S.route || [];
  if (r[0] === 'lesson') return r[2] || 'plan';
  if (r[0] === 'review') return 'reviews';
  if (r[0] === 'teacher') return 'lessons';
  if (r[0] === 'guide') return 'guide';
  if (r[0] === 'studio') return r[1] === 'mindmap' ? 'plan' : 'activities';
  return 'home';
}
function teacherHref(key, id) {
  if (key === 'home') return '#/';
  if (key === 'lessons') return '#/teacher/lessons';
  if (key === 'guide') return '#/guide';
  return id ? '#/lesson/' + id + '/' + key : '#/teacher/lessons?next=' + key;
}
function teacherPageMeta() {
  var mod = TEACHER_MODULES.find(function (m) { return m.key === teacherActiveModule(); });
  return { title: mod ? mod.label : '教师工作台', sub: S.user.class_name || '英语教学助手' };
}
function teacherNav() {
  var groups = ['教学总览', '课前与课堂', '课后与评价', '教师支持'];
  var active = teacherActiveModule();
  return groups.map(function (group) {
    return '<details class="tw-nav-group" open><summary>' + group + '</summary>' +
      TEACHER_MODULES.filter(function (m) { return m.group === group; }).map(function (m) {
        return '<a href="' + teacherHref(m.key, TW.current) + '"' +
          (m.key === active ? ' class="active" aria-current="page"' : '') + '><span class="ico" aria-hidden="true">' + icon(m.icon) + '</span>' + m.label + '</a>';
      }).join('') + '</details>';
  }).join('');
}
function teacherContext() {
  var selected = TW.lessons.find(function (l) { return l.id === TW.current; });
  return '<div class="tw-context"><label for="tw-current">当前课例</label>' +
    '<select id="tw-current" class="select" aria-label="当前课例"' + (TW.lessons.length ? '' : ' disabled') + '>' +
    (TW.lessons.length ? TW.lessons.map(function (l) {
      return '<option value="' + l.id + '"' + (l.id === TW.current ? ' selected' : '') + '>' + esc(l.title) + '</option>';
    }).join('') : '<option>请先新建课例</option>') + '</select>' +
    (selected ? lessonChip(selected.status) : '') + '<span class="tw-context-hint">切换模块，继续处理同一节课</span></div>';
}
function teacherModuleHeading(key) {
  var mod = TEACHER_MODULES.find(function (m) { return m.key === key; });
  var extras = '';
  if (key === 'plan') extras = '<a class="btn sm" href="#/studio/mindmap?lesson=' + S.lessonId + '">词句思维导图</a>';
  return '<div class="tw-module-heading"><h2>' + (mod ? mod.label : '') + '</h2>' + extras + '</div>';
}
function teacherRemember(id) {
  TW.current = id;
  try { localStorage.setItem('ai4en-teacher-current-' + S.user.id, String(id)); } catch (_) {}
}
async function teacherWorkspaceView(segs) {
  if (TW.userId !== S.user.id) {
    TW.userId = S.user.id; TW.current = null; TW.dirty.clear(); S.lesson = null; S.lessonId = null;
    S.twLoadedLesson = null; S.taskForm = null; S.logForm = null; S.taskDraftToOpen = null;
    try { TW.current = Number(localStorage.getItem('ai4en-teacher-current-' + S.user.id)) || null; } catch (_) {}
  }
  var data = await api('/api/lessons');
  TW.lessons = data.lessons;
  if (!TW.lessons.some(function (l) { return l.id === TW.current; })) TW.current = TW.lessons.length ? TW.lessons[0].id : null;
  if (segs[0] === 'lesson') {
    var id = Number(segs[1]);
    var content = await lessonView(id, segs[2] || 'plan');
    teacherRemember(id);
    return content;
  }
  if (segs[0] === 'review') {
    var review = await reviewView(Number(segs[1]));
    teacherRemember(S.reviewLessonId);
    return review;
  }
  if (segs[0] === 'teacher') return teacherLibrary();
  if (segs[0] === 'guide') {
    if (TW.current) await lessonView(TW.current, 'plan');
    return teacherGrowth();
  }
  if (segs[0] === 'studio') return studioView();
  return teacherDashboard(await api('/api/teacher/overview'));
}
function teacherDashboard(data) {
  var stats = data.stats;
  var current = TW.lessons.find(function (l) { return l.id === TW.current; });
  var metrics = [
    ['待复核反馈', stats.pending_review, '项', 'reviews', '确认后学生才能看到反馈'],
    ['等待学生订正', stats.revision_requested, '份', 'reviews', '跟进教师已要求的订正'],
    ['进行中未提交', stats.not_submitted, '人次', 'tasks', '同一学生跨任务分别计数']
  ];
  var todos = data.tasks.filter(function (t) { return t.pending_review || t.revision_requested || t.not_submitted.length; });
  return pageHead('教师工作台', '把备课、课堂与反馈接在同一节课上。', btn('新建课例', 'new-lesson', '', 'primary')) +
    '<section class="tw-continue"><div><span class="small">继续当前课例</span><h2>' + esc(current ? current.title : '开始准备第一节课') + '</h2>' +
    '<p>' + (current ? esc(current.grade) + ' · ' + current.duration + ' 分钟 · ' + (current.vocab || []).length + ' 个目标词' : '先创建课例，再准备教案、活动和练习。') + '</p></div>' +
    '<a class="btn primary" href="' + teacherHref('plan', TW.current) + '">' + (current ? '继续备课' : '创建课例') + '</a></section>' +
    '<div class="tw-metrics">' + metrics.map(function (m) {
      var target = data.tasks.find(function (t) { return m[3] === 'tasks' ? t.not_submitted.length : (m[0] === '待复核反馈' ? t.pending_review : t.revision_requested); });
      var href = target ? teacherHref(m[3], target.lesson_id) + '?task=' + target.id + (m[0] === '等待学生订正' ? '&filter=revision_requested' : m[0] === '待复核反馈' ? '&filter=pending' : '') : teacherHref(m[3], TW.current);
      return '<a class="tw-metric" href="' + href + '"><span>' + m[0] + '</span><div><strong>' + m[1] + '</strong> ' + m[2] + '</div><p>' + m[4] + '</p></a>';
    }).join('') + '</div>' +
    '<div class="tw-dashboard-grid"><section class="card"><div class="section-title"><span class="dot"></span>教学待办</div>' +
    '<div class="card-sub">' + stats.ongoing_tasks + ' 个进行中任务；数据来自本人的已发布任务。</div>' +
    (todos.length ? todos.map(function (t) {
      return '<article class="tw-todo"><div><b>' + esc(t.title) + '</b><p class="small muted">' + esc(t.lesson_title) + '</p>' +
        '<div class="tw-todo-tags">' + (t.pending_review ? chip(t.pending_review + ' 项待复核', 'amber') : '') +
        (t.revision_requested ? chip(t.revision_requested + ' 份待订正', 'plain') : '') +
        (t.not_submitted.length ? chip(t.not_submitted.length + ' 人未提交', 'plain') : '') + '</div>' +
        (t.not_submitted.length ? '<p class="tiny muted">未提交：' + esc(t.not_submitted.join('、')) + '</p>' : '') + '</div>' +
        '<a class="btn sm" href="' + teacherHref('reviews', t.lesson_id) + '?task=' + t.id + '">处理任务</a></article>';
    }).join('') : '<p class="muted">暂无待办，可以准备下一节课。</p>') + '</section>' +
    '<section class="card"><div class="section-title"><span class="dot"></span>最近课例</div>' +
    data.recent_lessons.map(function (l) {
      return '<a class="tw-recent" href="' + teacherHref('plan', l.id) + '"><b>' + esc(l.title) + '</b>' + lessonChip(l.status) +
        '<span class="tiny muted">更新 ' + esc(l.updated_at.slice(0, 16)) + '</span></a>';
    }).join('') + (data.recent_lessons.length ? '' : '<p class="muted">暂无课例。</p>') +
    '<a class="btn sm" href="#/teacher/lessons">查看课例库（' + stats.lessons + '）</a></section></div>';
}
function teacherLibrary() {
  var grades = Array.from(new Set(TW.lessons.map(function (l) { return l.grade; })));
  return pageHead('课例库', '选择课例，准备并复用本课的教案、活动与练习。', btn('新建课例', 'new-lesson', '', 'primary')) +
    '<div class="tw-filters"><div class="field"><label for="tw-search">搜索课例</label><input id="tw-search" class="input" placeholder="课例名称、主题或目标词"></div>' +
    '<div class="field"><label for="tw-grade">年级</label><select id="tw-grade" class="select"><option value="">全部年级</option>' +
    grades.map(function (g) { return '<option>' + esc(g) + '</option>'; }).join('') + '</select></div>' +
    '<div class="field"><label for="tw-status">课例状态</label><select id="tw-status" class="select"><option value="">全部状态</option><option value="draft">草稿</option><option value="approved">已审核</option></select></div></div>' +
    '<p class="small muted" id="tw-library-count" aria-live="polite"></p><div class="grid two tw-library">' + TW.lessons.map(function (l) {
      var next = (S.query || {}).next;
      if (!TEACHER_MODULES.some(function (m) { return m.key === next; })) next = 'plan';
      return '<article class="card lesson-card" data-lesson-card="' + l.id + '"><div class="top"><div><h3>' + esc(l.title) + '</h3><p class="meta">' + esc(l.grade) + ' · ' + esc(l.topic) + ' · ' + l.duration + ' 分钟</p></div>' + lessonChip(l.status) + '</div>' +
        '<div class="pill-row">' + l.vocab.map(function (w) { return chip(w, 'plain'); }).join(' ') + '</div>' +
        '<p class="small muted">' + l.task_count + ' 个任务 · 更新 ' + esc(l.updated_at.slice(0, 16)) + '</p>' +
        '<div class="row"><a class="btn primary sm" href="' + teacherHref(next || 'plan', l.id) + '">打开课例</a>' +
        '<button class="btn sm" data-act="tw-copy" data-id="' + l.id + '">复制课例</button></div></article>';
    }).join('') + '</div><div id="tw-library-empty" class="card muted" hidden>没有匹配的课例。可以调整筛选条件或新建课例。</div>';
}
function teacherFilterLibrary() {
  var text = q('#tw-search').value.trim().toLowerCase(), grade = q('#tw-grade').value, status = q('#tw-status').value, count = 0;
  qa('[data-lesson-card]').forEach(function (card) {
    var l = TW.lessons.find(function (item) { return item.id === Number(card.dataset.lessonCard); });
    var visible = (!text || [l.title, l.topic].concat(l.vocab).join(' ').toLowerCase().includes(text)) && (!grade || l.grade === grade) && (!status || l.status === status);
    card.hidden = !visible; if (visible) count++;
  });
  q('#tw-library-count').textContent = count + ' / ' + TW.lessons.length + ' 个课例';
  q('#tw-library-empty').hidden = count > 0;
}
function teacherResources(lesson) {
  var tasks = (lesson.tasks || []).filter(function (t) { return t.status !== 'draft'; });
  var selected = tasks.find(function (t) { return t.id === Number((S.query || {}).resource); }) || tasks[0];
  var resources = [
    ['教案', !!(lesson.plan.data.objectives || []).length, '/print/lesson/' + lesson.id, 'plan', '打印教案'],
    ['可编辑课件', !!((lesson.materials.slides || {}).data || []).length, '/api/lessons/' + lesson.id + '/export/pptx', 'slides', '导出 PPTX'],
    ['词卡与任务卡', !!(((lesson.materials.cards || {}).data || {}).word_cards || []).length, '/print/cards/' + lesson.id, 'slides', '打印词卡'],
    ['学生卷', !!selected, selected ? '/print/task/' + selected.id + '/paper' : '', 'tasks', '打印学生卷'],
    ['独立答案页', !!selected, selected ? '/print/task/' + selected.id + '/answers' : '', 'tasks', '打印答案页'],
    ['教学日志', !!(lesson.logs || []).length, '/print/log/' + lesson.id, 'logs', '打印日志']
  ];
  return '<section class="card tw-resource-section"><div class="section-title"><span class="dot"></span>本课资源</div>' +
    (tasks.length ? '<div class="field"><label for="tw-resource-task">试卷对应任务</label><select class="select" id="tw-resource-task">' + tasks.map(function (t) {
      return '<option value="' + t.id + '"' + (selected.id === t.id ? ' selected' : '') + '>' + esc(t.title) + '</option>';
    }).join('') + '</select></div>' : '<p class="small muted">发布任务后可打印对应学生卷和答案页。</p>') +
    '<div class="tw-resource-grid">' + resources.map(function (r) {
      return '<div class="tw-resource"><b>' + r[0] + '</b>' + chip(r[1] ? '已准备' : '待准备', r[1] ? 'teal' : 'gray') +
        (r[1] ? link(r[4], r[2], 'sm') : '<a class="btn sm" href="' + teacherHref(r[3], lesson.id) + '">去准备</a>') + '</div>';
    }).join('') + '</div></section>';
}
async function teacherActivitiesTab(lesson) {
  var data = await api('/api/lessons/' + lesson.id + '/observations');
  return activitiesTab(lesson) + '<section class="card tw-tool-section"><div class="section-title"><span class="dot"></span>拓展课堂玩法</div>' +
    '<p class="small muted">拓展游戏与数字人使用各自的示范素材，不计入本班成绩。</p><div class="row">' +
    [['games', '游戏闯关'], ['dh', '数字人对话'], ['workshop', '游戏工坊'], ['mystery', '水果线索卡']].map(function (m) {
      return '<a class="btn sm" href="#/studio/' + m[0] + '?lesson=' + lesson.id + '">' + m[1] + '</a>';
    }).join('') + '</div></section>' + observationSection(data);
}
function teacherGrowth() {
  return pageHead('教师成长与帮助', '学习审核 AI 内容，准备课堂材料。') +
    '<div class="tw-growth-tools">' + [['detective', '找茬侦探', '练习检查预设教学稿，核对理由与参考改法。'], ['repair', '提示词修理铺', '补齐教学条件，组装可复制的提示词。']].map(function (m) {
      return '<a class="card" href="#/guide?tool=' + m[0] + '"><h3>' + m[1] + '</h3><p class="small muted">' + m[2] + '</p></a>';
    }).join('') + '</div>' + ((S.query || {}).tool ? teacherTrainingEmbed(S.query.tool) : '') + guideView(true);
}
function teacherTrainingEmbed(tool) {
  var route = tool === 'detective' ? 'detective' : 'repair';
  return '<div class="card"><iframe class="embed-frame" title="教师培训练习" src="/static/workshop/index.html?embed=1#' + route + '"></iframe></div>';
}

/* 编辑保护只作用于教师。拒绝离开时不重新渲染，保留输入与光标。 */
function teacherConfirmLeave() {
  if (!TW.dirty.size) return true;
  if (!window.confirm('当前内容还没有保存。离开后将放弃这些修改，继续吗？')) return false;
  TW.dirty.clear(); S.twLoadedLesson = null; S.taskForm = null; S.logForm = null;
  return true;
}
function teacherBeforeRender() {
  if (TW.userId !== S.user.id) { TW.hash = ''; TW.dirty.clear(); }
  if (TW.hash && location.hash !== TW.hash && !TW.allowLeave && !teacherConfirmLeave()) {
    history.replaceState(null, '', TW.hash); return false;
  }
  TW.allowLeave = false;
  return true;
}
function teacherAfterRender() {
  TW.hash = location.hash;
  if (q('#tw-search')) teacherFilterLibrary();
}
document.addEventListener('click', function (e) {
  if (!S.user || S.user.role !== 'teacher' || e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
  var a = e.target.closest('a[href]');
  if (!a || a.target === '_blank' || a.origin !== location.origin || (a.pathname === location.pathname && a.hash === location.hash)) return;
  if (!teacherConfirmLeave()) { e.preventDefault(); e.stopImmediatePropagation(); }
  else TW.allowLeave = true;
}, true);
document.addEventListener('input', function (e) {
  if (!S.user || S.user.role !== 'teacher') return;
  if (e.target.id === 'tw-search') return teacherFilterLibrary();
  if (e.target.closest('.content') && !['tw-grade', 'tw-status', 'tw-review-filter', 'tw-resource-task'].includes(e.target.id) && !e.target.matches('[data-act="switch-result"]')) {
    TW.dirty.add(e.target.dataset.state || 'other');
  }
});
document.addEventListener('change', function (e) {
  if (!S.user || S.user.role !== 'teacher') return;
  if (e.target.id === 'tw-current') {
    var old = TW.current;
    if (!teacherConfirmLeave()) { e.target.value = old; return; }
    var id = Number(e.target.value), key = teacherActiveModule();
    teacherRemember(id); S.twLoadedLesson = null;
    TW.allowLeave = true;
    if (['home', 'lessons', 'guide'].includes(key)) render();
    else location.hash = teacherHref(key, id);
  }
  if (['tw-grade', 'tw-status'].includes(e.target.id)) teacherFilterLibrary();
  if (e.target.id === 'tw-resource-task') location.hash = teacherHref('slides', S.lessonId) + '?resource=' + e.target.value;
});
window.addEventListener('beforeunload', function (e) {
  if (S.user && S.user.role === 'teacher' && TW.dirty.size) { e.preventDefault(); e.returnValue = ''; }
});
ACTIONS['tw-copy'] = async function (el) {
  var res = await api('/api/lessons/' + el.dataset.id + '/duplicate', 'POST', {});
  toast(res.notice || '已复制课例', 'ok');
  location.hash = teacherHref('plan', res.lesson.id);
};
/* 只有成功的保存才移除对应编辑标记；请求失败时保留提醒。 */
[['save-plan', 'plan'], ['save-cond', 'cond'], ['save-slides', 'slides'], ['save-ex', 'ex'], ['save-task', 'taskForm'], ['publish-task', 'taskForm'], ['save-log', 'logForm'], ['save-observation', 'other'], ['save-dictation', 'other'], ['confirm-fb', 'other']].forEach(function (pair) {
  var base = ACTIONS[pair[0]];
  if (base) ACTIONS[pair[0]] = async function (el) { var before = TW.mutations || 0; await base(el); if ((TW.mutations || 0) > before) TW.dirty.delete(pair[1]); };
});
var teacherBaseLogDraft = ACTIONS['log-draft'];
ACTIONS['log-draft'] = async function (el) { await teacherBaseLogDraft(el); TW.dirty.add('logForm'); };
var teacherBaseLogout = ACTIONS.logout;
ACTIONS.logout = async function () {
  if (S.user && S.user.role === 'teacher' && !teacherConfirmLeave()) return;
  TW.hash = ''; TW.dirty.clear(); TW.userId = null;
  await teacherBaseLogout();
};
document.addEventListener('change', function (e) {
  if (e.target.id === 'tw-review-filter') {
    if (!teacherConfirmLeave()) { e.target.value = (S.query || {}).filter || 'all'; return; }
    location.hash = teacherHref('reviews', S.lessonId) + '?task=' + S.resultTaskId + '&filter=' + e.target.value;
  }
});
var teacherBaseSwitchResult = ACTIONS['switch-result'];
ACTIONS['switch-result'] = function (el) {
  if (!teacherConfirmLeave()) { el.value = S.resultTaskId; return; }
  teacherBaseSwitchResult(el);
};
ACTIONS['tw-edit-task'] = function (el) {
  if (!teacherConfirmLeave()) return;
  var task = S.tasks.find(function (t) { return t.id === Number(el.dataset.id) && t.status === 'draft'; });
  if (!task) return;
  S.taskDraftToOpen = { lessonId: S.lesson.id, taskId: task.id };
  render();
};
/* 按钮增删/排序与文本输入同样属于未保存编辑；无实际变化时不提示。 */
[['add-obj', 'plan'], ['del-obj', 'plan'], ['add-flow', 'plan'], ['del-flow', 'plan'],
 ['add-slide', 'slides'], ['del-slide', 'slides'], ['ex-type', 'ex'], ['add-ex', 'ex'], ['del-ex', 'ex'], ['move-ex', 'ex']].forEach(function (pair) {
  var base = ACTIONS[pair[0]];
  ACTIONS[pair[0]] = async function (el) {
    var before = JSON.stringify(bindState(pair[1]));
    await base(el);
    if (before !== JSON.stringify(bindState(pair[1]))) TW.dirty.add(pair[1]);
  };
});
