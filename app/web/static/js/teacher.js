/* AI4En · 教师端：工作台、课例框架、教案备课、课件资源 */
'use strict';

/* ---------------------------------------------------------------- 工作台 */
function teacherHomeView(lessons) {
  var classroomLesson = lessons.find(function (lesson) {
    return String(lesson.topic).trim().toLowerCase() === 'animals';
  }) || lessons[0];
  var cards = lessons.map(function (l) {
    var words = (l.vocab || []).slice(0, 6).map(function (w) { return chip(w, 'plain'); }).join(' ');
    return '<div class="card lesson-card ' + (l.status === 'draft' ? 'draft' : '') + '">' +
      '<div class="top"><div><h3>' + esc(l.title) + '</h3>' +
      '<div class="meta">' + esc(l.grade) + ' · 主题 ' + esc(l.topic) + ' · ' + esc(l.duration) + ' 分钟</div></div>' +
      lessonChip(l.status) + '</div>' +
      '<div class="pill-row">' + words + '</div>' +
      '<div class="meta"><span>' + (l.has_plan ? (l.objective_count + ' 个学习目标') : '尚未生成教案') + '</span>' +
      '<span>' + l.task_count + ' 个任务</span><span>更新 ' + esc(String(l.updated_at).slice(0, 16)) + '</span></div>' +
      '<div class="row"><a class="btn primary sm" href="#/lesson/' + l.id + '/plan">打开课例</a>' +
      '<a class="btn sm" href="#/lesson/' + l.id + '/slides">课件</a>' +
      '<a class="btn sm" href="#/lesson/' + l.id + '/results">结果与日志</a></div></div>';
  }).join('');
  return pageHead('教师工作台', esc(S.user.name) + ' · ' + esc(S.user.class_name || '') + ' · 共 ' + lessons.length + ' 个课例',
      btn('新建课例', 'new-lesson', '', 'primary')) +
    '<div class="card" style="margin-bottom:20px"><div class="row" style="justify-content:space-between;align-items:center;gap:14px">' +
      '<div><div class="section-title" style="margin:0">课堂工具</div>' +
      '<div class="tiny muted" style="margin-top:4px">准备游戏、词卡和口语活动。</div></div>' +
      '<div class="row" style="flex-wrap:wrap;justify-content:flex-end">' +
      '<a class="btn sm primary" href="#/studio/games">游戏闯关 →</a>' +
      '<a class="btn sm" href="#/studio/mystery">水果线索卡 →</a>' +
      '<a class="btn sm" href="#/studio">全部拓展 →</a>' +
      (classroomLesson ? '<a class="btn sm" href="#/lesson/' + classroomLesson.id + '/activities">本课课堂活动</a>' : '') +
      '</div></div></div>' +
    '<details class="workspace-notes"><summary>教学流程与使用提示</summary><div class="grid two">' +
      '<div class="card"><div class="section-title"><span class="dot"></span>本课例要解决的问题</div>' +
      '<p class="small muted" style="line-height:1.85">围绕同一份课例（三年级 Animals），把备课、课件、课堂活动、练习与作业反馈连成一条链路：' +
      '教师修改并审核内容，学生只看到已发布的任务，家长只看到自己孩子已确认的反馈。</p></div>' +
      '<div class="card"><div class="section-title"><span class="dot"></span>演示路径（约 8 分钟）</div>' +
      '<p class="small muted" style="line-height:1.85">打开课例 → 改一处活动时间 → 开课件 → 玩一轮配对 → 发布任务 → 学生提交 → 确认反馈 → 学生订正 → 看统计与日志。</p></div>' +
    '</div></details>' +
    '<div class="section-title" style="margin:6px 0 12px"><span class="dot"></span>我的课例</div>' +
    '<div class="grid two">' + (cards || empty('还没有课例，点右上角“新建课例”。')) + '</div>';
}

/* ---------------------------------------------------------------- 课例框架 */
async function lessonView(id, tab) {
  var data = await api('/api/lessons/' + id);
  var lesson = data.lesson;
  if (S.lessonId !== id || !S.plan || S.twLoadedLesson !== id) {
    S.twLoadedLesson = id;
    S.lessonId = id;
    S.plan = clone(lesson.plan.data || {});
    S.slides = clone((lesson.materials.slides || {}).data || []);
    S.ex = clone(lesson.exercises.data || { items: [], support: 'frame' });
    S.slideIdx = 0;
    S.results = null;
    S.resultTaskId = null;
    S.taskForm = null;
    S.logForm = null;
    S.notice = null;
    S.cond = {
      grade: lesson.grade, topic: lesson.topic, duration: lesson.duration,
      vocab: (lesson.vocab || []).join(', '), sentences: (lesson.sentences || []).join('\n'), notes: lesson.notes || ''
    };
  }
  S.lesson = lesson;
  S.planSource = lesson.plan.source;
  S.tasks = lesson.tasks;

  // 放弃修改可能触发课例重置；初始化完成后再载入用户选择的草稿。
  var requestedDraft = S.taskDraftToOpen;
  S.taskDraftToOpen = null;
  if (tab === 'tasks' && requestedDraft && requestedDraft.lessonId === id) {
    var draft = S.tasks.find(function (t) { return t.id === requestedDraft.taskId && t.status === 'draft'; });
    if (draft) S.taskForm = clone(draft);
  }

  if (tab === 'results') return resultsTab(lesson);
  if (tab === 'reviews') return reviewsTab(lesson);
  if (tab === 'logs') return teachingLogsTab(lesson);
  if (tab === 'activities') return teacherActivitiesTab(lesson);
  if (tab === 'slides') return slidesTab(lesson) + teacherResources(lesson);
  if (tab === 'exercises') return exercisesTab(lesson) + await dictationSection(lesson);
  if (tab === 'tasks') return tasksTab(lesson);
  return planTab(lesson);
}

function lessonTabs(lesson, tab) {
  if (S.user.role === 'teacher' && typeof teacherModuleHeading === 'function') return teacherModuleHeading(tab);
  var items = [['plan', '教案备课'], ['slides', '课件资源'], ['activities', '课堂活动'],
               ['exercises', '练习与小测'], ['tasks', '任务发布'], ['results', '结果与日志']];
  return '<div class="tabs">' + items.map(function (it) {
    return '<a href="#/lesson/' + lesson.id + '/' + it[0] + '" class="' + (tab === it[0] ? 'active' : '') + '">' + it[1] + '</a>';
  }).join('') + '</div>';
}

function lessonHeader(lesson, actions) {
  return '<div class="page-head"><div>' +
    '<div class="tiny muted"><a href="#/">工作台</a> / 课例</div>' +
    '<h1>' + esc(lesson.title) + ' ' + lessonChip(lesson.status) + '</h1>' +
    '<div class="sub">' + esc(lesson.grade) + ' · 主题 ' + esc(lesson.topic) + ' · ' + esc(lesson.duration) + ' 分钟 · 目标词 ' +
    esc((lesson.vocab || []).join(' / ')) + '</div></div>' +
    '<div class="page-actions">' + actions + '</div></div>';
}

/* ---------------------------------------------------------------- 教案备课 */
function planTab(lesson) {
  var plan = S.plan || {};
  var objectives = plan.objectives || [];
  var flow = plan.flow || [];
  var total = flow.reduce(function (sum, row) { return sum + (parseInt(row.minutes, 10) || 0); }, 0);

  var objHtml = objectives.map(function (text, i) {
    return '<div class="obj-item"><span class="idx">' + (i + 1) + '</span>' +
      '<input class="input" data-state="plan" data-bind="objectives.' + i + '" value="' + esc(text) + '">' +
      btn('删除', 'del-obj', 'data-i="' + i + '"', 'sm ghost') + '</div>';
  }).join('');

  var flowHtml = flow.map(function (row, i) {
    return '<tr data-flow="' + i + '">' +
      '<td data-label="环节"><input class="stage" data-state="plan" data-bind="flow.' + i + '.stage" value="' + esc(row.stage || '') + '"></td>' +
      '<td data-label="时间"><input class="mins" data-state="plan" data-bind="flow.' + i + '.minutes" value="' + esc(row.minutes || '') + '"></td>' +
      '<td data-label="教师活动"><textarea rows="2" data-state="plan" data-bind="flow.' + i + '.teacher">' + esc(row.teacher || '') + '</textarea></td>' +
      '<td data-label="学生活动"><textarea rows="2" data-state="plan" data-bind="flow.' + i + '.student">' + esc(row.student || '') + '</textarea></td>' +
      '<td data-label="检查方式"><textarea rows="2" data-state="plan" data-bind="flow.' + i + '.check">' + esc(row.check || '') + '</textarea></td>' +
      '<td class="actions">' + btn('删除', 'del-flow', 'data-i="' + i + '"', 'sm ghost') + '</td></tr>';
  }).join('');

  var modelNote = (META.model_configured ? '模型已配置' : '未配置模型，生成时使用示例内容');
  var notice = S.notice
    ? banner(S.notice.text + ' ' +
        (S.notice.retry ? btn('重试', 'generate-plan', '', 'sm') : '') +
        (S.notice.regen ? btn('重新生成课件', 'regen-slides', '', 'sm') : ''),
        S.notice.kind, S.notice.kind === 'error' ? '!' : 'i')
    : '';

  return lessonHeader(lesson,
      '<a class="btn" target="_blank" rel="noopener" href="/print/lesson/' + lesson.id + '">打印教案 PDF</a>' +
      '<a class="btn" target="_blank" rel="noopener" href="/api/lessons/' + lesson.id + '/export/pptx">导出 PPTX</a>' +
      btn('复制课例', 'duplicate-lesson') +
      btn('审核通过', 'approve-lesson', '', 'primary')) +
    lessonTabs(lesson, 'plan') +
    (notice ? '<div style="margin-bottom:16px">' + notice + '</div>' : '') +
    '<div class="plan-layout"><nav class="plan-rail" aria-label="教案分区">' +
      PLAN_SECTIONS.map(function (s) {
        return '<a href="javascript:void 0" data-act="plan-jump" data-sec="' + s[0] + '"' +
          (s[0] === 'sec-cond' ? ' class="active"' : '') + '>' + s[1] + '</a>';
      }).join('') +
    '</nav><div class="plan-main stack">' +

    '<div class="card" id="sec-cond"><div class="section-title"><span class="dot"></span>教学条件</div>' +
      '<div class="card-sub">缺少必填项时会在对应位置提示；没有目标依据不会生成空白课例。</div>' +
      '<div class="form-grid cols-3">' +
        '<div class="field"><label>年级</label><input class="input" data-state="cond" data-bind="grade" value="' + esc(S.cond.grade) + '"></div>' +
        '<div class="field"><label>主题</label><input class="input" data-state="cond" data-bind="topic" value="' + esc(S.cond.topic) + '"></div>' +
        '<div class="field"><label>课时（分钟）</label><input class="input" data-state="cond" data-bind="duration" value="' + esc(S.cond.duration) + '"></div>' +
        '<div class="field"><label>目标词汇（逗号分隔）</label><input class="input" data-state="cond" data-bind="vocab" value="' + esc(S.cond.vocab) + '"></div>' +
        '<div class="field"><label>目标句型（每行一句）</label><textarea class="textarea" rows="2" data-state="cond" data-bind="sentences">' + esc(S.cond.sentences) + '</textarea></div>' +
        '<div class="field"><label>教学备注</label><textarea class="textarea" rows="2" data-state="cond" data-bind="notes">' + esc(S.cond.notes) + '</textarea></div>' +
      '</div>' +
      '<div class="row" style="margin-top:12px">' + btn('保存教学条件', 'save-cond', '', 'sm') +
      '<span class="tiny muted">保存后教案会回到草稿状态，发布前需重新审核。</span></div>' +
    '</div>' +

    '<div class="card" id="sec-gen"><div class="section-title"><span class="dot"></span>生成与审核</div>' +
      '<div class="row" style="margin-bottom:10px">' + srcBadge(lesson.plan.source) +
        '<span class="tiny muted">' + esc(modelNote) + '</span>' +
        '<span class="tiny muted">· 目标 ' + objectives.length + ' 条 · 流程 ' + flow.length + ' 个环节 · 合计 ' + total + ' 分钟</span></div>' +
      (total > 0 && Math.abs(total - (parseInt(lesson.duration, 10) || 40)) > 5 ?
        banner('各环节时间合计 ' + total + ' 分钟，与课时 ' + lesson.duration + ' 分钟不一致，请调整后再审核。', 'warn', '!') : '') +
      '<div class="row" style="margin-top:12px">' +
        btn('生成教案草稿', 'generate-plan', '', 'primary') +
        btn('演示：模型失败', 'generate-plan-fail', '', 'sm') +
        '<span class="tiny muted">生成结果是候选内容，需逐条核对；生成成功不等于已通过教学审核。</span></div>' +
    '</div>' +

    '<div class="card" id="sec-obj"><div class="section-title"><span class="dot"></span>学习目标 <span class="tiny muted">（不超过三项）</span></div>' +
      '<div class="obj-list">' + (objHtml || '<div class="tiny muted">还没有目标，点“生成教案草稿”或手动添加。</div>') + '</div>' +
      '<div class="row" style="margin-top:10px">' + btn('添加目标', 'add-obj', '', 'sm') +
      btn('重新生成目标', 'regen-section', 'data-section="objectives"', 'sm') +
      (objectives.length > 3 ? '<span class="chip red">已超过三项，请精简</span>' : '') + '</div>' +
    '</div>' +

    lessonCheckCard(lesson) +

    '<div class="card" id="sec-key"><div class="section-title"><span class="dot"></span>重点与难点</div>' +
      '<div class="form-grid cols-2">' +
      '<div class="field"><label>重点</label><textarea class="textarea" rows="4" data-state="plan" data-bind="key_points">' + esc(plan.key_points || '') + '</textarea></div>' +
      '<div class="field"><label>难点</label><textarea class="textarea" rows="4" data-state="plan" data-bind="difficulties">' + esc(plan.difficulties || '') + '</textarea></div>' +
      '</div></div>' +

    '<div class="card" id="sec-flow"><div class="section-title"><span class="dot"></span>教学流程</div>' +
      '<div class="card-sub">每个环节写明学生做什么、教师怎样检查；时间合计应与课时一致。</div>' +
      '<div class="tbl-wrap"><table class="tbl flow-table"><thead><tr><th style="width:110px">环节</th><th style="width:70px">时间</th>' +
      '<th>教师活动</th><th>学生活动</th><th>检查方式</th><th style="width:60px"></th></tr></thead><tbody>' +
      (flowHtml || '<tr><td colspan="6" class="muted small">还没有流程，点“生成教案草稿”或手动添加环节。</td></tr>') +
      '</tbody></table></div>' +
      '<div class="row" style="margin-top:10px">' + btn('添加环节', 'add-flow', '', 'sm') +
      btn('重新生成流程', 'regen-section', 'data-section="flow"', 'sm') +
      '<span class="tiny muted">当前合计 ' + total + ' 分钟 · 只替换这一部分，目标和板书保留</span></div>' +
    '</div>' +

    '<div class="card" id="sec-board"><div class="section-title"><span class="dot"></span>板书、作业与材料</div>' +
      '<div class="form-grid cols-2">' +
      '<div class="field"><label>板书建议</label><textarea class="textarea" rows="3" data-state="plan" data-bind="board">' + esc(plan.board || '') + '</textarea></div>' +
      '<div class="field"><label>课后任务</label><textarea class="textarea" rows="3" data-state="plan" data-bind="homework">' + esc(plan.homework || '') + '</textarea></div>' +
      '<div class="field"><label>材料准备</label><textarea class="textarea" rows="2" data-state="plan" data-bind="materials">' + esc(plan.materials || '') + '</textarea></div>' +
      '<div class="field"><label>设计说明</label><textarea class="textarea" rows="2" data-state="plan" data-bind="rationale">' + esc(plan.rationale || '') + '</textarea></div>' +
      '</div></div>' +

    '<div class="card save-bar"><div class="row" style="justify-content:space-between">' +
      '<span class="tiny muted">保存会覆盖当前草稿；审核通过后才允许发布任务。</span>' +
      '<span class="row">' + btn('保存草稿', 'save-plan', '', 'primary') +
      btn('审核通过', 'approve-lesson') + '</span></div></div>' +
    '</div></div>';
}

var PLAN_SECTIONS = [
  ['sec-cond', '教学条件'],
  ['sec-gen', '生成与审核'],
  ['sec-obj', '学习目标'],
  ['sec-check', '内容检查'],
  ['sec-key', '重点与难点'],
  ['sec-flow', '教学流程'],
  ['sec-board', '板书与作业']
];

ACTIONS['plan-jump'] = function (el) {
  var sec = el.getAttribute('data-sec');
  var target = document.getElementById(sec);
  if (!target) return;
  target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  Array.prototype.forEach.call(document.querySelectorAll('.plan-rail a'), function (a) {
    a.classList.toggle('active', a === el);
  });
};

function newLessonModal() {
  modal('<h3>新建课例</h3><div class="modal-sub">设置这节课的主题与目标。创建后可继续编辑。</div>' +
    '<form id="newLesson" class="form-grid">' +
    '<div class="field"><label>课例标题 <span class="required-mark">*</span></label><input class="input" name="title" required placeholder="例如 Animals: What\'s this?" value=""></div>' +
    '<div class="form-grid cols-2">' +
    '<div class="field"><label>年级 *</label><input class="input" name="grade" required value="小学三年级"></div>' +
    '<div class="field"><label>主题 *</label><input class="input" name="topic" required placeholder="例如 Animals"></div></div>' +
    '<div class="field"><label>目标词汇 *</label><input class="input" name="vocab" required placeholder="cat, dog, panda, frog"><div class="hint">用逗号分隔，至少填写 2 个词。</div></div>' +
    '<div class="field"><label>目标句型 *</label><textarea class="textarea" rows="2" name="sentences" required>What\'s this?\nIt\'s a cat.</textarea><div class="hint">每行填写一个句型。</div></div>' +
    '<div class="field"><label>课时（分钟）</label><input class="input" type="number" min="1" name="duration" value="40"></div>' +
    '<details class="modal-options"><summary>补充教学备注 <span>选填</span></summary><div class="field"><label>教材进度、已有基础与设备</label><textarea class="textarea" rows="2" name="notes" placeholder="例如：学生已学过颜色词，教室可投屏。"></textarea></div></details>' +
    '</form><p class="form-error" id="newLessonError" role="alert" hidden></p><div class="modal-foot">' + btn('取消', 'close-modal') + btn('创建并备课', 'create-lesson', 'type="submit" form="newLesson"', 'primary') + '</div>');
}

ACTIONS['new-lesson'] = function () { newLessonModal(); };
ACTIONS['close-modal'] = function () { closeModal(); };

ACTIONS['create-lesson'] = async function (button) {
  var form = q('#newLesson');
  if (!form.reportValidity()) return;
  var fields = new FormData(form);
  var body = {
    title: fields.get('title'), grade: fields.get('grade'), topic: fields.get('topic'),
    vocab: fields.get('vocab'), sentences: fields.get('sentences'),
    duration: fields.get('duration'), notes: fields.get('notes')
  };
  var error = q('#newLessonError');
  if (body.vocab.split(/[,，、]/).filter(function (w) { return w.trim(); }).length < 2) {
    error.textContent = '请填写至少 2 个目标词汇，并用逗号分隔。'; error.hidden = false; return;
  }
  if (button.disabled) return;
  button.disabled = true; button.textContent = '正在创建…'; error.hidden = true;
  var res;
  try { res = await api('/api/lessons', 'POST', body); }
  catch (err) { error.textContent = err.message; error.hidden = false; return; }
  finally { button.disabled = false; button.textContent = '创建并备课'; }
  closeModal();
  toast('课例已创建，可以生成教案草稿', 'ok');
  S.lessonId = null;
  location.hash = '#/lesson/' + res.lesson.id + '/plan';
  await render();
};

/* ---------------------------------------------------------------- 教案动作 */
ACTIONS['save-cond'] = async function () {
  var c = S.cond;
  var lesson = S.lesson;
  var body = {
    grade: c.grade, topic: c.topic, duration: parseInt(c.duration, 10) || 40, notes: c.notes,
    vocab: String(c.vocab).split(/[,，、]/).map(function (s) { return s.trim(); }).filter(Boolean),
    sentences: String(c.sentences).split('\n').map(function (s) { return s.trim(); }).filter(Boolean)
  };
  if (!body.vocab.length || !body.sentences.length) { toast('目标词汇与句型不能为空', 'error'); return; }
  var res = await api('/api/lessons/' + lesson.id, 'PATCH', body);
  S.lesson = res.lesson;
  S.notice = { kind: 'ok', text: '教学条件已保存。' };
  toast('已保存教学条件', 'ok');
  await render();
};

ACTIONS['generate-plan'] = async function () {
  await generateInto('plan', false);
};
ACTIONS['generate-plan-fail'] = async function () {
  await generateInto('plan', true);
};

async function generateInto(target, simulate) {
  var lesson = S.lesson;
  S.busy = true;
  try {
    var res = await api('/api/lessons/' + lesson.id + '/generate', 'POST', { target: target, simulate_failure: !!simulate });
    S.lesson = res.lesson;
    if (target === 'plan') S.plan = clone(res.lesson.plan.data || {});
    if (target === 'slides') S.slides = clone((res.lesson.materials.slides || {}).data || []);
    if (target === 'exercises') S.ex = clone(res.lesson.exercises.data || { items: [] });
    S.notice = { kind: 'info', text: res.notice };
    toast(res.source_label + '：内容已进入编辑区', 'ok');
  } catch (err) {
    if (err.status === 502) {
      S.notice = { kind: 'error', text: err.message, retry: true };
      toast(err.message, 'error');
    } else {
      throw err;
    }
  } finally {
    S.busy = false;
  }
  await render();
}

ACTIONS['save-plan'] = async function () {
  var res = await api('/api/lessons/' + S.lesson.id + '/plan', 'PATCH', { data: S.plan });
  S.lesson = res.lesson;
  S.plan = clone(res.lesson.plan.data || {});
  S.notice = { kind: 'ok', text: res.notice || '已保存。', regen: true };
  toast('教案已保存为草稿', 'ok');
  await render();
};

ACTIONS['approve-lesson'] = async function () {
  var res = await api('/api/lessons/' + S.lesson.id + '/approve', 'POST', {});
  S.lesson = res.lesson;
  S.plan = clone(res.lesson.plan.data || {});
  S.notice = { kind: 'ok', text: '课例已审核通过，可以发布任务。' };
  toast('已审核通过', 'ok');
  await render();
};

ACTIONS['duplicate-lesson'] = async function () {
  var res = await api('/api/lessons/' + S.lesson.id + '/duplicate', 'POST', {});
  toast(res.notice || '已复制', 'ok');
  S.lessonId = null;
  location.hash = '#/lesson/' + res.lesson.id + '/plan';
  await render();
};

ACTIONS['add-obj'] = function () {
  if (!S.plan.objectives) S.plan.objectives = [];
  if (S.plan.objectives.length >= 5) { toast('目标已较多，请先精简', 'error'); return; }
  S.plan.objectives.push('');
  render();
};
ACTIONS['del-obj'] = function (el) {
  S.plan.objectives.splice(parseInt(el.getAttribute('data-i'), 10), 1);
  render();
};
ACTIONS['add-flow'] = function () {
  if (!S.plan.flow) S.plan.flow = [];
  S.plan.flow.push({ stage: '', minutes: 5, teacher: '', student: '', check: '' });
  render();
};
ACTIONS['del-flow'] = function (el) {
  S.plan.flow.splice(parseInt(el.getAttribute('data-i'), 10), 1);
  render();
};

/* ---------------------------------------------------------------- 课件资源 */
function slidesTab(lesson) {
  var slides = S.slides || [];
  if (!slides.length) {
    return lessonHeader(lesson, '') + lessonTabs(lesson, 'slides') +
      '<div class="card pad-lg"><div class="section-title"><span class="dot"></span>还没有课件</div>' +
      '<p class="small muted" style="margin-bottom:12px">按固定模板生成 6 页课件：标题目标、词汇、句型、操练、活动、总结与作业。</p>' +
      btn('生成课件草稿', 'generate-slides', '', 'primary') + '</div>' + cardsSection(lesson);
  }
  var idx = Math.min(S.slideIdx || 0, slides.length - 1);
  var cur = slides[idx] || {};
  var thumbHtml = slides.map(function (s, i) {
    return '<div class="slide-thumb ' + (i === idx ? 'active' : '') + '" data-act="select-slide" data-i="' + i + '">' +
      '<div class="no">第 ' + (i + 1) + ' 页</div><div class="t">' + esc(s.title || '未命名') + '</div></div>';
  }).join('');
  var bodyText = String(cur.body || '');
  var tooLong = bodyText.length > 240;

  return lessonHeader(lesson,
      '<a class="btn" target="_blank" rel="noopener" href="/api/lessons/' + lesson.id + '/export/pptx">导出 PPTX</a>' +
      '<a class="btn" target="_blank" rel="noopener" href="/print/cards/' + lesson.id + '">打印词卡</a>' +
      btn('生成课件草稿', 'generate-slides') + btn('保存课件', 'save-slides', '', 'primary')) +
    lessonTabs(lesson, 'slides') +
    '<div class="slide-layout"><div class="card" style="padding:14px"><div class="tiny muted" style="margin-bottom:8px">页序（与导出一致）</div>' +
      '<div class="slide-list">' + thumbHtml + '</div>' +
      '<div class="row" style="margin-top:10px">' + btn('新增页', 'add-slide', '', 'sm') + btn('删除本页', 'del-slide', '', 'sm danger') + '</div></div>' +
    '<div class="stack"><div class="card"><div class="row" style="justify-content:space-between;margin-bottom:12px">' +
      '<span class="tiny muted">第 ' + (idx + 1) + ' / ' + slides.length + ' 页 · 标题与正文均为可编辑文本</span>' +
      srcBadge((lesson.materials.slides || {}).source) + '</div>' +
      '<div class="form-grid"><div class="field"><label>标题</label><input class="input" data-state="slides" data-bind="' + idx + '.title" value="' + esc(cur.title || '') + '"></div>' +
      '<div class="field"><label>正文</label><textarea class="textarea" rows="7" data-state="slides" data-bind="' + idx + '.body">' + esc(bodyText) + '</textarea>' +
      '<div class="hint">' + (tooLong ? '<span style="color:#b45309">正文 ' + bodyText.length + ' 字，投屏会偏挤，建议精简到 160 字内。</span>' : '正文 ' + bodyText.length + ' 字') + '</div></div>' +
      '<div class="field"><label>教师备注（仅你自己可见）</label><textarea class="textarea" rows="2" data-state="slides" data-bind="' + idx + '.note">' + esc(cur.note || '') + '</textarea></div></div></div>' +
      '<div class="card"><div class="section-title"><span class="dot"></span>投屏预览</div>' +
      '<div class="slide-canvas"><div class="s-title">' + esc(cur.title || '') + '</div><div class="s-rule"></div>' +
      '<div class="s-body">' + nl2br(bodyText) + '</div>' +
      '<div class="s-foot"><span>AI4En · ' + esc(lesson.title) + '</span><span>' + (idx + 1) + ' / ' + slides.length + '</span></div></div>' +
      '</div></div></div>' + cardsSection(lesson);
}

function cardsSection(lesson) {
  var cards = (lesson.materials.cards || {}).data || {};
  var words = (cards.word_cards || []).map(function (c) {
    return '<div class="card" style="width:150px;padding:12px;text-align:center">' +
      '<div style="font-size:24px">' + esc(c.emoji || '') + '</div>' +
      '<div style="font-weight:800;font-size:16px;margin:4px 0">' + esc(c.word) + '</div>' +
      '<div class="tiny muted">' + esc(c.zh) + '</div>' +
      '<div class="tiny" style="margin-top:6px;color:#25424a">' + esc(c.sentence) + '</div></div>';
  }).join('');
  var talk = cards.talk_card || {};
  return '<div class="card" style="margin-top:16px"><div class="section-title"><span class="dot"></span>词卡与口头问答任务卡</div>' +
    '<div class="card-sub">缺图时使用文字卡；词卡与任务卡使用同一组目标词句。</div>' +
    '<div class="row" style="align-items:stretch">' + words + '</div>' +
    (talk.title ? '<div class="banner info" style="margin-top:14px"><span class="icon">i</span><div><b>' + esc(talk.title) + '</b><br>' +
      '使用环节：' + esc(talk.stage) + ' · 目标句型：' + esc(talk.pattern) + '<br>' +
      '学生任务：' + esc(talk.student_task) + '<br>教师检查：' + esc(talk.teacher_check) + '</div></div>' : '') +
    '</div>';
}

ACTIONS['select-slide'] = function (el) {
  S.slideIdx = parseInt(el.getAttribute('data-i'), 10);
  render();
};
ACTIONS['add-slide'] = function () {
  S.slides.push({ title: '新的一页', body: '', note: '' });
  S.slideIdx = S.slides.length - 1;
  render();
};
ACTIONS['del-slide'] = function () {
  if (S.slides.length <= 1) { toast('至少保留一页', 'error'); return; }
  S.slides.splice(S.slideIdx, 1);
  S.slideIdx = Math.max(0, S.slideIdx - 1);
  render();
};
ACTIONS['save-slides'] = async function () {
  var res = await api('/api/lessons/' + S.lesson.id + '/materials/slides', 'PATCH', { data: S.slides });
  S.lesson = res.lesson;
  toast('课件已保存', 'ok');
  await render();
};
ACTIONS['generate-slides'] = async function () {
  await generateInto('slides', false);
};


/* ---------------------------------------------------------------- 内容检查 */
var CHECK_STOP = ("a an the is it its it's this that these those and or to of in on at for with by from as " +
  "what what's who who's do does you your my me we our they their he she his her i am are be can may please " +
  "two one three four five first second third next then now today again together listen read write say ask answer " +
  "look at picture pictures card cards word words sentence sentences pair pairs group groups minute minutes " +
  "practice activity summary homework board unit class school teacher student students english chinese yes no not " +
  "black white green brown red yellow blue pink gray grey orange animal animals name names meow woof " +
  "ppt pptx pdf xlsx docx ai ai4en jpg png").split(" ");

function lessonCheckCard(lesson) {
  var plan = S.plan || {};
  var vocab = (lesson.vocab || []).map(function (w) { return String(w).toLowerCase(); });
  var allowed = {};
  vocab.forEach(function (w) { allowed[w] = true; });
  (lesson.sentences || []).join(" ").toLowerCase().replace(/[a-z']+/g, function (m) { allowed[m] = true; return m; });
  CHECK_STOP.forEach(function (w) { allowed[w] = true; });

  var text = [
    (plan.objectives || []).join(" "), plan.key_points || "", plan.difficulties || "",
    (plan.flow || []).map(function (r) { return [r.stage, r.teacher, r.student, r.check].join(" "); }).join(" "),
    plan.board || "", plan.homework || "", plan.materials || "", plan.rationale || ""
  ].join(" ");

  var seen = {};
  var extraWords = [];
  text.toLowerCase().replace(/[a-z][a-z']+/g, function (m) {
    var w = m.replace(/'s$/, "");
    if (w.length > 2 && !allowed[w] && !allowed[m] && !seen[w]) { seen[w] = true; extraWords.push(w); }
    return m;
  });

  var chips = vocab.concat([]).map(function (w) { return chip(w, 'plain'); }).join(' ');
  var sentenceChips = (lesson.sentences || []).map(function (s) { return chip(s, 'plain'); }).join(' ');

  return '<div class="card" id="sec-check"><div class="section-title"><span class="dot"></span>内容检查</div>' +
    '<div class="card-sub">重点词句单独列出；词表以外的英文词只做提示，由教师决定替换或保留。</div>' +
    '<div class="row" style="margin-bottom:8px"><span class="tiny muted" style="width:64px">目标词</span>' + chips + '</div>' +
    '<div class="row" style="margin-bottom:12px"><span class="tiny muted" style="width:64px">目标句</span>' + sentenceChips + '</div>' +
    (extraWords.length
      ? banner('词表以外的词：' + extraWords.slice(0, 12).map(function (w) { return '<b>' + esc(w) + '</b>'; }).join('、') +
               '。这些词不在目标词句里，请确认是本课需要的，还是应当替换。', 'warn', '!')
      : banner('教案中的英文词均在目标词句范围内，没有发现词表以外的词。', 'ok', '✓')) +
    '<div class="tiny muted" style="margin-top:8px">提示不是判定：词表比对不等于课程标准判定，最终由教师核对。</div>' +
    '</div>';
}

ACTIONS['regen-slides'] = async function () {
  if (!window.confirm('重新生成会覆盖当前 6 页课件的标题与正文，确定继续吗？')) return;
  await generateInto('slides', false);
};

/* 局部再生成：先保存当前编辑，再只替换选中的部分，其他内容原样保留 */
ACTIONS['regen-section'] = async function (el) {
  var section = el.getAttribute('data-section');
  var label = { objectives: '学习目标', flow: '教学流程' }[section] || '选中的部分';
  if (!window.confirm('将重新生成“' + label + '”，其他已编辑内容会保留。继续吗？')) return;
  S.busy = true;
  try {
    await api('/api/lessons/' + S.lesson.id + '/plan', 'PATCH', { data: S.plan });
    var res = await api('/api/lessons/' + S.lesson.id + '/generate', 'POST', { target: 'plan', section: section });
    S.lesson = res.lesson;
    S.plan = clone(res.lesson.plan.data || {});
    S.notice = { kind: 'info', text: res.notice };
    toast(res.notice, 'ok');
  } catch (err) {
    if (err.status === 502) {
      S.notice = { kind: 'error', text: err.message, retry: true };
      toast(err.message, 'error');
    } else {
      throw err;
    }
  } finally {
    S.busy = false;
  }
  await render();
};

