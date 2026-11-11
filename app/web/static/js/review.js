/* AI4En · 结果统计、教学日志、批改与订正 */
'use strict';

async function teacherResultData(lesson) {
  var tasks = (lesson.tasks || []).filter(function (t) { return t.status !== 'draft'; });
  var explicit = (S.query || {}).task;
  var wanted = Number(explicit || S.resultTaskId);
  var task = tasks.find(function (t) { return t.id === wanted; });
  if (!task && !explicit) task = tasks[0];
  if (!task) { S.resultTaskId = null; S.results = null; return null; }
  S.resultTaskId = task.id;
  S.results = await api('/api/tasks/' + task.id + '/results');
  return S.results;
}
function teacherTaskPicker(lesson, key) {
  var tasks = (lesson.tasks || []).filter(function (t) { return t.status !== 'draft'; });
  return '<div class="tw-task-picker"><label for="tw-result-task">选择任务</label><select id="tw-result-task" class="select" data-act="switch-result" data-module="' + key + '">' +
    tasks.map(function (t) { return '<option value="' + t.id + '"' + (S.resultTaskId === t.id ? ' selected' : '') + '>' + esc(t.title) + '</option>'; }).join('') +
    '</select><span class="tiny muted">数据来自实际提交记录</span></div>';
}
function teacherNoResults(lesson, key) {
  return lessonHeader(lesson, '') + lessonTabs(lesson, key) + empty((S.query || {}).task ? '当前任务尚无可查看的发布结果。请在任务管理选择已发布任务。' : '还没有已发布任务。先在任务管理发布练习，学生提交后即可查看。') +
    '<a class="btn primary" href="#/lesson/' + lesson.id + '/tasks">前往任务管理</a>';
}
function teacherResultRows(data) {
  var items = data.items || [], subs = data.submissions || [];
  var itemRows = items.map(function (it, i) {
    var rate = it.type === 'short' ? '教师复核' : it.wrong_rate === null ? '暂无记录' : (it.wrong_rate + '%');
    return '<tr><td class="center">' + (i + 1) + '</td><td>' + esc(String(it.stem).slice(0, 42)) + '</td>' +
      '<td>' + chip(TYPE_LABEL[it.type] || it.type, 'plain') + '</td><td>' + it.valid + '</td>' +
      '<td>' + it.wrong + '</td><td>' + rate + '</td><td>' + (it.pending || 0) + '</td></tr>';
  }).join('');

  var subRows = subs.map(function (s) {
    return '<tr><td><b>' + esc(s.student_name) + '</b><div class="tiny muted">' + esc(String(s.submitted_at).slice(0, 16)) + '</div></td>' +
      '<td>' + subChip(s.status) + '</td><td>' + s.objective_correct + ' / ' + s.objective_total + '</td>' +
      '<td>' + (s.pending ? chip(s.pending + ' 项待复核', 'amber') : '<span class="muted tiny">无</span>') + '</td>' +
      '<td class="actions"><a class="btn sm" href="#/review/' + s.id + '">查看与批改</a></td></tr>';
  }).join('');

  var wrongItems = items.filter(function (i) { return i.wrong > 0; });
  var wrongHtml = wrongItems.length ? wrongItems.map(function (it) {
    return '<label class="row" style="padding:6px 0;align-items:flex-start"><input type="checkbox" data-pick="' + it.id + '">' +
      '<span class="small">' + esc(it.stem) + ' <span class="chip red">错 ' + it.wrong + ' 人</span>' +
      (it.tag ? ' <span class="chip plain">' + esc(it.tag) + '</span>' : '') + '</span></label>';
  }).join('') : '<div class="muted small">本次没有错误题目。</div>';

  return { items: itemRows, submissions: subRows, wrong: wrongHtml };
}
function teacherStats(stats) {
  return '<div class="grid stats" style="margin-bottom:16px">' +
    '<div class="stat teal"><div class="num">' + stats.submitted + ' / ' + stats.assigned + '</div><div class="label">已提交 / 布置人数</div><div class="extra">提交率 ' + stats.rate + '%</div></div>' +
    '<div class="stat"><div class="num">' + stats.pending_review + '</div><div class="label">待复核反馈项</div><div class="extra">开放题需教师确认</div></div>' +
    '<div class="stat"><div class="num">' + stats.not_submitted.length + '</div><div class="label">未提交</div><div class="extra">' + esc(stats.not_submitted.join('、') || '全部已提交') + '</div></div></div>';
}
async function resultsTab(lesson) {
  var data = await teacherResultData(lesson);
  if (!data) return teacherNoResults(lesson, 'results');
  var rows = teacherResultRows(data);
  return lessonHeader(lesson, '') + lessonTabs(lesson, 'results') + teacherTaskPicker(lesson, 'results') + teacherStats(data.stats) +
    '<div class="card"><div class="section-title"><span class="dot"></span>单题情况</div><p class="card-sub">错误率以有效客观题作答为分母；开放题由教师复核，不自动判错。</p>' +
    '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>#</th><th>题干</th><th>类型</th><th>有效作答</th><th>错误</th><th>错误率</th><th>待复核</th></tr></thead><tbody>' + rows.items + '</tbody></table></div></div>' +
    '<div class="card tw-tool-section"><div class="section-title"><span class="dot"></span>典型错题与复习组卷</div><div class="card-sub">选择 1–7 题生成草稿任务，不影响已发布内容。</div>' + rows.wrong +
    '<div class="row">' + btn('组成复习练习', 'make-review', '', 'primary') + '</div></div>';
}
async function reviewsTab(lesson) {
  var data = await teacherResultData(lesson);
  if (!data) return teacherNoResults(lesson, 'reviews');
  var filter = (S.query || {}).filter || 'all';
  var subs = data.submissions.filter(function (s) {
    return filter === 'pending' ? s.pending > 0 : filter === 'all' || s.status === filter;
  });
  var rows = teacherResultRows(Object.assign({}, data, { submissions: subs }));
  return lessonHeader(lesson, '') + lessonTabs(lesson, 'reviews') + teacherTaskPicker(lesson, 'reviews') +
    '<div class="card"><div class="tw-review-toolbar"><div><h3>学生提交</h3><p class="small muted">确认反馈后学生才能查看；首次作答和订正版本保留对照。</p></div>' +
    '<label for="tw-review-filter">筛选作答<select class="select" id="tw-review-filter">' + [['all','全部'],['pending','待复核'],['revision_requested','待订正'],['resubmitted','已订正']].map(function (f) {
      return '<option value="' + f[0] + '"' + (filter === f[0] ? ' selected' : '') + '>' + f[1] + '</option>';
    }).join('') + '</select></label></div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>学生</th><th>状态</th><th>客观题</th><th>待复核</th><th>操作</th></tr></thead><tbody>' +
    (rows.submissions || '<tr><td colspan="5" class="muted">暂无符合条件的提交。</td></tr>') + '</tbody></table></div></div>' +
    (data.stats.not_submitted.length ? '<div class="banner warn tw-tool-section"><span>未提交：' + esc(data.stats.not_submitted.join('、')) + '</span></div>' : '');
}
async function teachingLogsTab(lesson) {
  var data = await teacherResultData(lesson);
  if (!S.logForm || S.logLessonId !== lesson.id) {
    var last = (lesson.logs || [])[0] || {};
    S.logForm = { completed: last.completed || '', issues: last.issues || '', next_adjust: last.next_adjust || '' };
    S.logLessonId = lesson.id;
  }
  return lessonHeader(lesson, (lesson.logs || []).length ? link('打印教学日志', '/print/log/' + lesson.id) : '') + lessonTabs(lesson, 'logs') +
    (data ? teacherTaskPicker(lesson, 'logs') : banner('尚未发布任务，也可以先记录课堂反思；发布后可据统计生成草稿。', 'info')) +
    '<div class="card"><div class="section-title"><span class="dot"></span>本次教学反思</div><div class="form-grid">' +
    [['completed','本课完成情况'],['issues','常见问题'],['next_adjust','下次调整']].map(function (f) {
      return '<div class="field"><label for="log-' + f[0] + '">' + f[1] + '</label><textarea class="textarea" rows="3" id="log-' + f[0] + '" data-state="logForm" data-bind="' + f[0] + '">' + esc(S.logForm[f[0]]) + '</textarea></div>';
    }).join('') + '</div><div class="row tw-tool-section">' + (data ? btn('据统计生成草稿', 'log-draft', 'data-task="' + data.task.id + '"') : '') + btn('保存日志', 'save-log', '', 'primary') + '</div></div>' +
    '<section class="card tw-tool-section"><div class="section-title"><span class="dot"></span>历史日志</div>' +
    ((lesson.logs || []).map(function (log) {
      return '<details class="tw-log-entry"><summary>' + esc(log.updated_at) + ' · ' + esc((log.completed || '教学反思').slice(0, 32)) + '</summary><dl>' +
        [['completed','完成情况'],['issues','常见问题'],['next_adjust','下次调整']].map(function (f) { return '<dt>' + f[1] + '</dt><dd>' + nl2br(log[f[0]]) + '</dd>'; }).join('') + '</dl></details>';
    }).join('') || '<p class="muted">保存后，历史反思会保留在这里。</p>') + '</section>';
}
function observationSection(data) {
  var students = data.students || [], observations = data.observations || [];
  var studentOptions = students.map(function (s) {
    return '<option value="' + s.id + '">' + esc(s.name) + '</option>';
  }).join('');
  var obsList = observations.slice(0, 8).map(function (o) {
    return '<div class="row" style="padding:6px 0;border-bottom:1px solid #eef2f3;align-items:flex-start">' +
      '<span style="min-width:64px;font-weight:600">' + esc(o.student_name) + '</span>' +
      chip(o.result, o.result === '独立完成' ? 'teal' : o.result === '需要提示' ? 'amber' : 'red') +
      '<span class="tiny muted" style="min-width:96px">' + (o.kind === 'oral' ? '口头问答' : '独立运用') + '</span>' +
      '<span class="small" style="flex:1">' + esc(o.note || '—') + '</span>' +
      '<span class="tiny muted">' + esc(String(o.created_at).slice(5, 16)) + '</span></div>';
  }).join('');
  var obsCard = '<div class="card"><div class="section-title"><span class="dot"></span>课堂观察与独立运用检查</div>' +
    '<div class="card-sub">同目标换一张动物图再问一次，记录学生能否独立完成；口头问答也可在这里留一条观察意见。</div>' +
    '<div class="form-grid cols-2">' +
    '<div class="field"><label for="obsStudent">学生</label><select class="select" id="obsStudent">' + (studentOptions || '<option value="">暂无学生</option>') + '</select></div>' +
    '<div class="field"><label for="obsKind">类型</label><select class="select" id="obsKind"><option value="independent">同目标独立运用检查</option><option value="oral">口头问答观察</option></select></div>' +
    '<div class="field"><label for="obsResult">结果</label><select class="select" id="obsResult"><option value="独立完成">独立完成</option><option value="需要提示">需要提示</option><option value="需要帮助">需要帮助</option></select></div>' +
    '<div class="field"><label for="obsNote">观察意见</label><input class="input" id="obsNote" placeholder="例如：换 dog 图后能独立说出 It\'s a dog。"></div>' +
    '</div><div class="row" style="margin:10px 0 6px">' + btn('记录观察', 'save-observation', '', 'sm primary') +
    '<span class="tiny muted">只作课堂记录，不换算成个人成绩</span></div>' +
    (obsList || '<div class="tiny muted">还没有观察记录。</div>') + '</div>';

  return '<section class="tw-tool-section">' + obsCard + '</section>';
}
async function dictationSection(lesson) {
  var data = await api('/api/lessons/' + lesson.id + '/dictations');
  var dictations = data.dictations || [];
  var wordList = lesson.vocab || [];
  var dictChecks = wordList.map(function (w) {
    return '<label class="row" style="gap:6px;margin-right:14px"><input type="checkbox" data-dict="' + esc(w) + '"><span class="small">' + esc(w) + '</span></label>';
  }).join('');
  var dictList = dictations.slice(0, 3).map(function (d) {
    return '<div class="tiny" style="padding:4px 0">' + esc(String(d.created_at).slice(5, 16)) + ' · ' + d.words.length + ' 词 · 错词 ' +
      (d.wrong.length ? '<b style="color:#b91c1c">' + esc(d.wrong.join('、')) + '</b>' : '无') +
      (d.note ? ' · ' + esc(d.note) : '') + '</div>';
  }).join('');
  var dictCard = '<div class="card"><div class="section-title"><span class="dot"></span>听写登记</div>' +
    '<div class="card-sub">用课例词表打印答题纸，教师朗读批改后勾选错词登记；错词与错题清单一起用于下次复习。</div>' +
    '<div class="row" style="margin-bottom:8px"><a class="btn sm" target="_blank" rel="noopener" href="/print/dictation/' + lesson.id + '">打印听写答题纸</a>' +
    '<span class="tiny muted">词表：' + esc(wordList.join(' / ')) + '</span></div>' +
    '<div class="row" style="flex-wrap:wrap;margin-bottom:8px">' + (dictChecks || '<span class="tiny muted">课例还没有目标词。</span>') + '</div>' +
    '<div class="field"><label>备注（可选）</label><input class="input" id="dictNote" placeholder="例如：panda 的重音需要再练"></div>' +
    '<div class="row" style="margin-top:10px">' + btn('登记本次听写', 'save-dictation', '', 'sm primary') + '</div>' +
    (dictList ? '<div style="margin-top:10px;border-top:1px solid #eef2f3;padding-top:8px">' + dictList + '</div>' : '') + '</div>';

  return '<section class="tw-tool-section">' + dictCard + '</section>';
}

ACTIONS['switch-result'] = function (el) {
  location.hash = '#/lesson/' + S.lesson.id + '/' + (el.getAttribute('data-module') || 'results') + '?task=' + el.value;
};

ACTIONS['log-draft'] = async function (el) {
  var res = await api('/api/lessons/' + S.lesson.id + '/logs/draft', 'POST', { task_id: parseInt(el.getAttribute('data-task'), 10) });
  S.logForm = { completed: res.completed, issues: res.issues, next_adjust: res.next_adjust };
  toast('已生成反思草稿（' + res.source_label + '），请修改后保存', 'ok');
  await render();
};

ACTIONS['save-log'] = async function () {
  var res = await api('/api/lessons/' + S.lesson.id + '/logs', 'POST', S.logForm);
  toast('教学日志已保存', 'ok');
  S.lesson = res.lesson;
  await render();
};

ACTIONS['make-review'] = async function () {
  var picks = qa('[data-pick]').filter(function (n) { return n.checked; }).map(function (n) { return n.getAttribute('data-pick'); });
  if (!picks.length) { toast('请先勾选错题', 'error'); return; }
  var res = await api('/api/tasks/' + S.resultTaskId + '/review-set', 'POST', { item_ids: picks });
  toast(res.notice || '已生成复习练习草稿', 'ok');
  location.hash = '#/lesson/' + S.lesson.id + '/tasks';
  S.taskForm = null;
  await reloadLesson();
};

ACTIONS['save-observation'] = async function () {
  var sel = q('#obsStudent');
  if (!sel || !sel.value) { toast('请选择学生', 'error'); return; }
  var res = await api('/api/lessons/' + S.lesson.id + '/observations', 'POST', {
    student_id: parseInt(sel.value, 10),
    kind: q('#obsKind').value,
    result: q('#obsResult').value,
    note: q('#obsNote') ? q('#obsNote').value : ''
  });
  toast(res.notice || '已记录', 'ok');
  await render();
};

ACTIONS['save-dictation'] = async function () {
  var wrong = qa('[data-dict]').filter(function (n) { return n.checked; }).map(function (n) { return n.getAttribute('data-dict'); });
  var res = await api('/api/lessons/' + S.lesson.id + '/dictations', 'POST', {
    words: S.lesson.vocab || [], wrong: wrong, note: q('#dictNote') ? q('#dictNote').value : ''
  });
  toast(res.notice || '已登记', 'ok');
  await render();
};

/* ---------------------------------------------------------------- 批改视图 */
async function reviewView(sid) {
  var data = await api('/api/submissions/' + sid + '/review');
  var sub = data.submission;
  var task = data.task;
  S.reviewLessonId = task.lesson_id;
  var items = data.items || [];
  var answers = data.answers || {};
  var grading = data.grading || {};
  var fbs = {};
  (data.feedback || []).forEach(function (f) { fbs[f.item_id] = f; });
  var history = data.history || [];
  var first = history.length ? history[0].answers : null;

  var itemHtml = items.map(function (item, i) {
    var ans = answers[item.id];
    var isObj = item.type !== 'short';
    var ok = grading[item.id];
    var answerText = '';
    if (item.type === 'choice') {
      answerText = (ans || '未作答') + (ans && item.options ? '（' + (item.options[String(ans).charCodeAt(0) - 65] || '') + '）' : '');
    } else {
      answerText = ans || '未作答';
    }
    var fb = fbs[item.id] || {};
    var fbBlock = item.type === 'short' ? (
      '<div style="margin:10px 0 0 36px">' +
      '<div class="row" style="margin-bottom:6px"><span class="tiny muted">反馈（学生只在确认后可见）</span>' +
      (fb.status === 'confirmed' ? chip('已确认 ' + String(fb.confirmed_at || '').slice(0, 16), 'teal') : chip('未确认', 'amber')) +
      (fb.source ? srcBadge(fb.source) : '') + '</div>' +
      '<textarea class="textarea" rows="4" id="fb-' + item.id + '" placeholder="按“已完成 / 需检查 / 下一步”写，或先生成草稿">' + esc(fb.final || fb.draft || '') + '</textarea>' +
      '<div class="row" style="margin-top:8px">' +
      '<select class="select" style="width:150px" id="lv-' + item.id + '">' +
      '<option value="">评价描述</option>' +
      META.levels.map(function (lv) { return '<option value="' + lv + '"' + (fb.level === lv ? ' selected' : '') + '>' + lv + '</option>'; }).join('') +
      '</select>' + btn('生成反馈草稿', 'draft-fb', 'data-item="' + item.id + '"', 'sm') +
      btn('确认反馈', 'confirm-fb', 'data-item="' + item.id + '"', 'sm primary') + '</div></div>'
    ) : '';
    return '<div class="card" style="margin-bottom:12px"><div class="q-head" style="display:flex;gap:10px;align-items:baseline">' +
      '<span class="q-no">' + (i + 1) + '</span><span class="q-stem">' + esc(item.stem) + '</span>' +
      '<span class="q-meta">' + (TYPE_LABEL[item.type] || item.type) + ' · ' + esc(item.target || '') + '</span></div>' +
      '<div class="row" style="margin-left:36px;gap:18px;align-items:flex-start">' +
      '<div class="small"><span class="muted tiny">学生作答</span><div style="font-weight:600">' + esc(answerText) + '</div></div>' +
      (isObj ? '<div class="small"><span class="muted tiny">正确答案</span><div>' + esc(item.type === 'choice' ? item.answer + '（' + (item.options[String(item.answer).charCodeAt(0) - 65] || '') + '）' : item.answer) + '</div></div>' : '') +
      (isObj && ok !== undefined ? '<div class="small"><span class="muted tiny">判定</span><div>' +
        (ok === true ? chip('正确', 'teal') : ok === false ? chip('错误', 'red') : '—') + '</div></div>' : '') +
      '</div>' + fbBlock + '</div>';
  }).join('');

  var obsRows = (data.observations || []).map(function (o) {
    return '<div style="padding:6px 0;border-bottom:1px solid #eef2f3">' +
      '<div class="row">' + chip(o.kind === 'oral' ? '口头问答' : '独立运用', 'plain') +
      chip(o.result, o.result === '独立完成' ? 'teal' : o.result === '需要提示' ? 'amber' : 'red') +
      '<span class="tiny muted">' + esc(String(o.created_at).slice(0, 16)) + '</span></div>' +
      (o.note ? '<div class="small" style="margin-top:4px">' + esc(o.note) + '</div>' : '') + '</div>';
  }).join('');
  var obsCard = '<div class="card"><div class="section-title"><span class="dot"></span>课堂观察</div>' +
    '<div class="card-sub">教师记录，不进入学生与家长视图。</div>' +
    (obsRows || '<div class="tiny muted">还没有记录。可在“课堂互动”里添加独立运用检查。</div>') + '</div>';

  var compare = '';
  if (first) {
    compare = '<div class="card"><div class="section-title"><span class="dot"></span>首次作答与订正</div>' +
      '<div class="tiny muted">首次作答（' + esc(String(history[0].created_at)) + '）</div>' +
      '<div class="banner warn" style="margin:6px 0 12px">' + nl2br(Object.keys(first).map(function (k) { return k + '：' + first[k]; }).join('\n')) + '</div>' +
      '<div class="tiny muted">当前版本（订正后）</div>' +
      '<div class="banner ok" style="margin-top:6px">' + nl2br(items.filter(function (i2) { return i2.type === 'short'; }).map(function (i2) { return answers[i2.id] || '—'; }).join('\n')) + '</div></div>';
  }

  return '<div class="page-head"><div><div class="tiny muted"><a href="#/lesson/' + task.lesson_id + '/reviews?task=' + task.id + '">批改与订正</a> / 批改</div>' +
    '<h1>' + esc(sub.student_name) + ' · ' + esc(task.title) + '</h1>' +
    '<div class="sub">' + subChip(sub.status) + ' 提交于 ' + esc(sub.submitted_at) + '</div></div>' +
    '<div class="row">' + btn('要求订正', 'request-revision', 'data-id="' + sub.id + '"') +
    '<a class="btn" target="_blank" rel="noopener" href="/print/feedback/' + sub.id + '">打印反馈样例</a>' +
    '<a class="btn" href="#/lesson/' + task.lesson_id + '/reviews?task=' + task.id + '">返回批改列表</a></div></div>' +
    '<div class="grid review-layout">' +
    '<div>' + banner('客观题由代码判定；开放题请用“生成反馈草稿”后改写，点“确认反馈”后学生才可见。', 'info', 'i') +
    '<div style="margin-top:14px">' + itemHtml + '</div></div>' +
    '<div class="stack">' +
    '<div class="card"><div class="section-title"><span class="dot"></span>状态</div>' +
    '<p class="small muted">当前：' + subChip(sub.status) + '</p>' +
    '<p class="small muted" style="margin-top:8px">' + (sub.status === 'revision_requested' ? '已要求订正，等待学生提交。' : '可点“要求订正”发起一次订正；系统保留首次与订正两个版本。') + '</p></div>' +
    obsCard + compare + '</div></div>';
}

ACTIONS['draft-fb'] = async function (el) {
  var item = el.getAttribute('data-item');
  var sid = parseInt(location.hash.split('/')[2], 10);
  var res = await api('/api/submissions/' + sid + '/feedback/draft', 'POST', { item_id: item });
  var ta = document.getElementById('fb-' + item);
  if (ta) ta.value = res.draft;
  if (res.error) toast('模型调用失败，已使用规则生成：' + res.error, 'error');
  else toast('草稿已生成（' + res.source_label + '）', 'ok');
};

ACTIONS['confirm-fb'] = async function (el) {
  var item = el.getAttribute('data-item');
  var sid = parseInt(location.hash.split('/')[2], 10);
  var ta = document.getElementById('fb-' + item);
  var lv = document.getElementById('lv-' + item);
  var res = await api('/api/submissions/' + sid + '/feedback', 'POST', { item_id: item, final: ta ? ta.value : '', level: lv ? lv.value : '' });
  toast(res.notice || '反馈已确认', 'ok');
  await render();
};

ACTIONS['request-revision'] = async function (el) {
  var res = await api('/api/submissions/' + el.getAttribute('data-id') + '/request-revision', 'POST', {});
  toast(res.notice || '已要求订正', 'ok');
  await render();
};
