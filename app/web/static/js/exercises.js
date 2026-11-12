/* AI4En · 练习与小测、任务发布、结果与日志、批改 */
'use strict';

/* ---------------------------------------------------------------- 练习与小测 */
var TYPE_LABEL = { choice: '选择题', fill: '填空题', short: '开放表达' };

function exercisesTab(lesson) {
  var ex = S.ex || { items: [], support: 'frame' };
  var items = ex.items || [];
  var cardHtml = items.map(function (item, i) { return exEditorCard(item, i); }).join('');
  var latestTask = (S.tasks && S.tasks.length) ? S.tasks[0] : null;

  return lessonHeader(lesson,
      (latestTask ? '<a class="btn" target="_blank" rel="noopener" href="/print/task/' + latestTask.id + '/paper">打印学生卷</a>' +
        '<a class="btn" target="_blank" rel="noopener" href="/print/task/' + latestTask.id + '/answers">打印答案页</a>' : '') +
      btn('预览学生页', 'preview-questions') +
      btn('保存题目', 'save-ex', '', 'primary')) +
    lessonTabs(lesson, 'exercises') +
    banner('同一表达任务提供两种支持方式：有句架、给关键词。两种方式使用同一组目标词句，不通过增加新语法制造难度差异。', 'info', 'i') +
    '<div class="card" style="margin-top:16px"><div class="row" style="justify-content:space-between">' +
      '<div class="row"><span class="small" style="font-weight:600">当前支持方式</span>' +
      '<select class="select" style="width:170px" data-state="ex" data-bind="support">' +
      '<option value="frame"' + (ex.support === 'frame' ? ' selected' : '') + '>有句架（给句型）</option>' +
      '<option value="keywords"' + (ex.support === 'keywords' ? ' selected' : '') + '>给关键词</option></select>' +
      '<span class="tiny muted">学生答题时只看到所选支持，两种方式答案不变。</span></div>' +
      '<div class="row">' + btn('新增选择题', 'add-ex', 'data-type="choice"', 'sm') +
      btn('新增填空题', 'add-ex', 'data-type="fill"', 'sm') + btn('新增开放题', 'add-ex', 'data-type="short"', 'sm') + '</div></div>' +
    '</div>' +
    (S.exMissing && S.exMissing.length ? '<div style="margin-top:12px">' + banner('发布前还需要补齐：' + S.exMissing.join('；'), 'warn', '!') + '</div>' : '') +
    '<div class="stack" style="margin-top:16px">' + (cardHtml || empty('还没有题目。')) + '</div>' +
    '<div class="card" style="margin-top:16px"><div class="row" style="justify-content:space-between">' +
      '<span class="tiny muted">共 ' + items.length + ' 题：选择 ' + countType(items, 'choice') + ' · 填空 ' + countType(items, 'fill') + ' · 开放 ' + countType(items, 'short') + '</span>' +
      '<span class="row">' + btn('核对答案', 'save-ex', '', 'sm') + btn('保存题目', 'save-ex', '', 'primary') + '</span></div></div>';
}

function countType(items, type) {
  return items.filter(function (i) { return i.type === type; }).length;
}

function exEditorCard(item, i) {
  var type = item.type || 'choice';
  var inner = '';
  if (type === 'choice') {
    var options = item.options || ['', '', '', ''];
    inner = '<div class="grid option-edit-grid">' + options.map(function (opt, j) {
      var letter = String.fromCharCode(65 + j);
      return '<div class="ex-opt"><span class="opt-key">' + letter + '</span>' +
        '<input class="input" data-state="ex" data-bind="items.' + i + '.options.' + j + '" value="' + esc(opt) + '">' +
        '<label class="ans-flag" title="设为正确答案"><input type="radio" name="exans-' + i + '" data-state="ex" data-bind="items.' + i + '.answer" value="' + letter + '"' +
        (item.answer === letter ? ' checked' : '') + '><span aria-hidden="true">✓</span></label></div>';
    }).join('') + '</div>';
  } else if (type === 'fill') {
    inner = '<div class="form-grid cols-2"><div class="field"><label>参考答案</label>' +
      '<input class="input" data-state="ex" data-bind="items.' + i + '.answer" value="' + esc(item.answer || '') + '"></div>' +
      '<div class="field"><label>可接受答案（逗号分隔）</label>' +
      '<input class="input" data-state="ex" data-bind="items.' + i + '.acceptText" value="' + esc((item.accept || []).join(', ')) + '"></div></div>' +
      '<div class="tiny muted" style="margin-top:6px">' + esc(item.rule || '不区分大小写，忽略首尾空格与句末标点。') + '</div>';
  } else {
    inner = '<div class="field"><label>参考答案示例</label><textarea class="textarea" rows="2" data-state="ex" data-bind="items.' + i + '.answer">' + esc(item.answer || '') + '</textarea></div>' +
      '<div class="form-grid cols-2" style="margin-top:10px">' +
      '<div class="field"><label>评价要点 1</label><input class="input" data-state="ex" data-bind="items.' + i + '.criteria.0" value="' + esc((item.criteria || [])[0] || '') + '"></div>' +
      '<div class="field"><label>评价要点 2</label><input class="input" data-state="ex" data-bind="items.' + i + '.criteria.1" value="' + esc((item.criteria || [])[1] || '') + '"></div>' +
      '<div class="field"><label>句架（有句架支持）</label><input class="input" data-state="ex" data-bind="items.' + i + '.frame" value="' + esc(item.frame || '') + '"></div>' +
      '<div class="field"><label>关键词（给关键词支持）</label><input class="input" data-state="ex" data-bind="items.' + i + '.keywords" value="' + esc(item.keywords || '') + '"></div></div>';
  }
  return '<div class="card ex-editor"><div class="row question-toolbar" style="justify-content:space-between;margin-bottom:12px">' +
    '<div class="row"><span class="q-no">' + (i + 1) + '</span>' +
    '<select class="select" style="width:120px" data-act="ex-type" data-i="' + i + '">' +
    ['choice', 'fill', 'short'].map(function (t) {
      return '<option value="' + t + '"' + (t === type ? ' selected' : '') + '>' + TYPE_LABEL[t] + '</option>';
    }).join('') + '</select>' +
    '<input class="input sm" style="width:90px" data-state="ex" data-bind="items.' + i + '.tag" value="' + esc(item.tag || '') + '" placeholder="标签">' +
    '<input class="input sm" style="width:130px" data-state="ex" data-bind="items.' + i + '.target" value="' + esc(item.target || '') + '" placeholder="目标词句"></div>' +
    '<div class="row">' + btn('↑', 'move-ex', 'data-i="' + i + '" data-dir="-1" title="上移"', 'sm ghost icon-btn') +
    btn('↓', 'move-ex', 'data-i="' + i + '" data-dir="1" title="下移"', 'sm ghost icon-btn') +
    btn('×', 'del-ex', 'data-i="' + i + '" title="删除"', 'sm ghost icon-btn danger-text') + '</div></div>' +
    '<div class="form-grid"><div class="field"><label>题干</label><textarea class="textarea" rows="1" data-state="ex" data-bind="items.' + i + '.stem">' + esc(item.stem || '') + '</textarea></div>' +
    inner +
    '<details class="ex-more"><summary>提示与解析</summary><div class="form-grid cols-2">' +
    '<div class="field"><label>提示（学生点“提示”时显示）</label><input class="input" data-state="ex" data-bind="items.' + i + '.hint" value="' + esc(item.hint || '') + '"></div>' +
    '<div class="field"><label>解析（教师答案页）</label><input class="input" data-state="ex" data-bind="items.' + i + '.analysis" value="' + esc(item.analysis || '') + '"></div>' +
    '</div></details></div></div>';
}

ACTIONS['ex-type'] = function (el) {
  var i = parseInt(el.getAttribute('data-i'), 10);
  var type = el.value;
  var item = S.ex.items[i];
  item.type = type;
  if (type === 'choice' && !(item.options || []).length) { item.options = ['', '', '', '']; item.answer = ''; }
  if (type === 'fill') { item.accept = item.accept || []; }
  if (type === 'short') { item.criteria = item.criteria || ['', '']; item.frame = item.frame || ''; item.keywords = item.keywords || ''; }
  render();
};

ACTIONS['add-ex'] = function (el) {
  var type = el.getAttribute('data-type');
  var id = 'q' + (S.ex.items.length + 1);
  var base = { id: id, type: type, stem: '', target: '', tag: type === 'short' ? '句型' : '词汇', hint: '', analysis: '', answer: '' };
  if (type === 'choice') { base.options = ['', '', '', '']; }
  if (type === 'fill') { base.accept = []; base.rule = '不区分大小写，忽略首尾空格与句末标点。'; }
  if (type === 'short') { base.criteria = ['内容是否回应任务', '表达是否基本清楚']; base.frame = ''; base.keywords = ''; }
  S.ex.items.push(base);
  render();
};

ACTIONS['del-ex'] = function (el) {
  S.ex.items.splice(parseInt(el.getAttribute('data-i'), 10), 1);
  render();
};

ACTIONS['move-ex'] = function (el) {
  var i = parseInt(el.getAttribute('data-i'), 10);
  var dir = parseInt(el.getAttribute('data-dir'), 10);
  var j = i + dir;
  if (j < 0 || j >= S.ex.items.length) return;
  var tmp = S.ex.items[i];
  S.ex.items[i] = S.ex.items[j];
  S.ex.items[j] = tmp;
  render();
};

function normalizeExercises() {
  (S.ex.items || []).forEach(function (item, i) {
    item.id = item.id || ('q' + (i + 1));
    if (item.type === 'fill') {
      if (item.acceptText !== undefined) {
        item.accept = String(item.acceptText).split(/[,，]/).map(function (s) { return s.trim(); }).filter(Boolean);
        delete item.acceptText;
      }
      if (!item.accept || !item.accept.length) item.accept = [item.answer || ''];
      if (!item.rule) item.rule = '不区分大小写，忽略首尾空格与句末标点。';
    }
    if (item.type === 'short' && item.criteria) item.criteria = item.criteria.filter(function (c) { return String(c).trim(); });
  });
}

ACTIONS['save-ex'] = async function () {
  normalizeExercises();
  var res = await api('/api/lessons/' + S.lesson.id + '/exercises', 'PATCH', { data: S.ex });
  S.lesson = res.lesson;
  S.ex = clone(res.lesson.exercises.data || { items: [] });
  S.exMissing = res.missing || [];
  S.exMissing.length ? toast('已保存，但有 ' + S.exMissing.length + ' 项需要补齐才能发布', 'error') : toast('题目已保存', 'ok');
  await render();
};

ACTIONS['preview-questions'] = function () {
  normalizeExercises();
  var items = S.ex.items || [];
  var html = items.map(function (item, i) {
    return '<div class="q-item"><div class="q-head"><span class="q-no">' + (i + 1) + '</span>' +
      '<span class="q-stem">' + esc(item.stem) + '</span><span class="q-meta">' + TYPE_LABEL[item.type] + '</span></div>' +
      (item.type === 'choice'
        ? '<div class="opt-list">' + (item.options || []).map(function (o, j) {
            return '<div class="opt-row"><span class="opt-key">' + String.fromCharCode(65 + j) + '</span><span>' + esc(o) + '</span></div>';
          }).join('') + '</div>'
        : '<div class="answer-line"><span class="muted small">' + (item.type === 'fill' ? '填写一个单词' : '写 2 句话') + '</span></div>') +
      (item.type === 'short' && S.ex.support === 'frame' && item.frame
        ? '<div class="tiny muted" style="margin:8px 0 0 36px">句架：' + esc(item.frame) + '</div>' : '') +
      (item.type === 'short' && S.ex.support === 'keywords' && item.keywords
        ? '<div class="tiny muted" style="margin:8px 0 0 36px">关键词：' + esc(item.keywords) + '</div>' : '') +
      '</div>';
  }).join('');
  modal('<h3>学生页预览</h3><div class="modal-sub">学生看不到答案与解析；这里与发布后的学生页面一致。</div>' +
    '<div style="max-height:60vh;overflow:auto">' + (html || '<p class="muted">还没有题目。</p>') + '</div>' +
    '<div class="modal-foot">' + btn('关闭', 'close-modal', '', 'primary') + '</div>');
};

/* ---------------------------------------------------------------- 任务发布 */
function defaultTaskForm(lesson) {
  return {
    id: null,
    title: lesson.title + ' · 课堂短练习',
    instructions: '先读题，再作答。选择题只选一个；填空题只填一个单词；最后一题写 2 句话。提交后不能修改，除非老师要求订正。',
    due_at: '', allow_hints: true, show_result: 'immediately'
  };
}

function tasksTab(lesson) {
  var form = S.taskForm || defaultTaskForm(lesson);
  S.taskForm = form;
  var rows = (S.tasks || []).map(function (t) {
    return '<tr><td><b>' + esc(t.title) + '</b><div class="tiny muted">' + t.item_count + ' 题 · ' +
      (t.published_at ? '发布于 ' + esc(String(t.published_at).slice(0, 16)) : '尚未发布') + '</div></td>' +
      '<td>' + taskChip(t.status) + '</td><td>' + t.student_count + '</td><td>' + t.submitted + '</td>' +
      '<td class="actions">' + btn('预览', 'preview-task', 'data-id="' + t.id + '"', 'sm') +
      (t.status === 'draft' ? btn('编辑草稿', 'tw-edit-task', 'data-id="' + t.id + '"', 'sm') : btn('批改结果', 'goto-results', 'data-id="' + t.id + '"', 'sm')) +
      (t.status === 'ongoing' ? btn('结束', 'end-task', 'data-id="' + t.id + '"', 'sm danger') : '') +
      btn('复制', 'duplicate-task', 'data-id="' + t.id + '"', 'sm') + '</td></tr>';
  }).join('');

  return lessonHeader(lesson, '') + lessonTabs(lesson, 'tasks') +
    '<div class="grid" style="grid-template-columns:minmax(0,1.1fr) minmax(0,.9fr)">' +
    '<div class="card"><div class="section-title"><span class="dot"></span>' + (form.id ? '编辑草稿任务' : '新建任务') + '</div>' +
      '<div class="card-sub">发布时冻结题目与答案；之后修改课例不影响已发布任务。</div>' +
      '<div class="form-grid">' +
      '<div class="field"><label>任务名称</label><input class="input" data-state="taskForm" data-bind="title" value="' + esc(form.title) + '"></div>' +
      '<div class="field"><label>任务说明（学生页首屏显示）</label><textarea class="textarea" rows="3" data-state="taskForm" data-bind="instructions">' + esc(form.instructions) + '</textarea></div>' +
      '<div class="form-grid cols-2">' +
      '<div class="field"><label>提交时间要求</label><input class="input" data-state="taskForm" data-bind="due_at" placeholder="例如 2026-11-06 20:00" value="' + esc(form.due_at) + '"></div>' +
      '<div class="field"><label>班级</label><input class="input" value="' + esc(S.user.class_name || '') + '" disabled></div></div>' +
      '<div class="form-grid cols-2">' +
      '<div class="field"><label>结果展示</label><select class="select" data-state="taskForm" data-bind="show_result">' +
      (META.show_result_options || []).map(function (o) {
        return '<option value="' + o.value + '"' + (form.show_result === o.value ? ' selected' : '') + '>' + esc(o.label) + '</option>';
      }).join('') + '</select></div>' +
      '<div class="field"><label>提示</label><label class="check" style="height:38px"><input type="checkbox" data-state="taskForm" data-bind="allow_hints"' +
      (form.allow_hints ? ' checked' : '') + '> 允许学生点“提示”</label></div></div>' +
      '</div>' +
      '<div class="row" style="margin-top:14px">' + btn('保存草稿', 'save-task', '', 'sm') +
      btn('预览学生页', 'preview-task', form.id ? 'data-id="' + form.id + '"' : 'data-draft="1"', 'sm') +
      btn('发布任务', 'publish-task', '', 'primary') + '</div>' +
    '</div>' +
    '<div class="card"><div class="section-title"><span class="dot"></span>发布检查</div>' +
      '<ul class="small muted" style="line-height:2;padding-left:18px;margin:8px 0">' +
      '<li>课例状态：' + lessonChip(lesson.status) + '</li>' +
      '<li>题目数量：' + ((S.ex.items || []).length) + ' 题</li>' +
      '<li>缺少答案或评价要点时会阻止发布并列出缺失项</li>' +
      '<li>发布后学生只能看到题干与选项，看不到答案</li></ul>' +
      '<div class="banner warn"><span class="icon">!</span><div>草稿任务在学生端不可见；没有题目或答案不完整时不能发布。</div></div>' +
    '</div></div>' +
    '<div class="card" style="margin-top:16px"><div class="section-title"><span class="dot"></span>本课例的任务</div>' +
    '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>任务</th><th>状态</th><th>布置人数</th><th>已提交</th><th></th></tr></thead><tbody>' +
    (rows || '<tr><td colspan="5" class="muted small">还没有任务。</td></tr>') + '</tbody></table></div></div>';
}

ACTIONS['save-task'] = async function () {
  var form = S.taskForm;
  if (!form.title.trim()) { toast('请填写任务名称', 'error'); return; }
  var payload = { title: form.title, instructions: form.instructions, due_at: form.due_at, allow_hints: !!form.allow_hints, show_result: form.show_result };
  if (!form.id) {
    var created = await api('/api/lessons/' + S.lesson.id + '/tasks', 'POST', { class_id: S.user.class_id, title: payload.title, instructions: payload.instructions, due_at: payload.due_at, allow_hints: payload.allow_hints, show_result: payload.show_result });
    form.id = created.task.id;
  }
  await api('/api/tasks/' + form.id, 'PATCH', payload);
  toast('任务草稿已保存', 'ok');
  await reloadLesson();
};

ACTIONS['publish-task'] = async function () {
  var form = S.taskForm;
  if (!form.title.trim()) { toast('请填写任务名称', 'error'); return; }
  if (!form.id) {
    var created = await api('/api/lessons/' + S.lesson.id + '/tasks', 'POST', { class_id: S.user.class_id, title: form.title, instructions: form.instructions, due_at: form.due_at, allow_hints: form.allow_hints, show_result: form.show_result });
    form.id = created.task.id;
  }
  await api('/api/tasks/' + form.id, 'PATCH', { title: form.title, instructions: form.instructions, due_at: form.due_at, allow_hints: !!form.allow_hints, show_result: form.show_result });
  var res = await api('/api/tasks/' + form.id + '/publish', 'POST', {});
  toast(res.notice || '任务已发布', 'ok');
  S.taskForm = null;
  S.resultTaskId = form.id;
  await reloadLesson();
};

async function reloadLesson() {
  var data = await api('/api/lessons/' + S.lesson.id);
  S.lesson = data.lesson;
  S.tasks = data.lesson.tasks;
  await render();
}

ACTIONS['preview-task'] = async function (el) {
  var id = el.getAttribute('data-id');
  if (!id) { toast('请先保存草稿再预览', 'error'); return; }
  var data = await api('/api/tasks/' + id + '/preview');
  var items = data.items || [];
  var html = items.map(function (item, i) {
    return '<div class="q-item"><div class="q-head"><span class="q-no">' + (i + 1) + '</span><span class="q-stem">' + esc(item.stem) + '</span></div>' +
      (item.type === 'choice' ? '<div class="opt-list">' + (item.options || []).map(function (o, j) {
        return '<div class="opt-row"><span class="opt-key">' + String.fromCharCode(65 + j) + '</span><span>' + esc(o) + '</span></div>';
      }).join('') + '</div>' : '<div class="answer-line"><span class="muted small">' +
        (item.type === 'fill' ? '填写一个单词' : '写 2 句话') + '</span></div>') + '</div>';
  }).join('');
  modal('<h3>学生页预览 · ' + esc(data.task.title) + '</h3><div class="modal-sub">' + esc(data.task.instructions || '') + '</div>' +
    '<div class="banner info" style="margin-bottom:12px"><span class="icon">i</span><div>学生看不到答案与解析；这里展示的就是发布后的学生页面。</div></div>' +
    '<div style="max-height:58vh;overflow:auto">' + (html || '<p class="muted">还没有题目。</p>') + '</div>' +
    '<div class="modal-foot">' + btn('关闭', 'close-modal', '', 'primary') + '</div>');
};

ACTIONS['end-task'] = async function (el) {
  var res = await api('/api/tasks/' + el.getAttribute('data-id') + '/end', 'POST', {});
  toast('任务已结束', 'ok');
  await reloadLesson();
};

ACTIONS['duplicate-task'] = async function (el) {
  var res = await api('/api/tasks/' + el.getAttribute('data-id') + '/duplicate', 'POST', {});
  toast(res.notice || '已复制', 'ok');
  await reloadLesson();
};

ACTIONS['goto-results'] = function (el) {
  location.hash = '#/lesson/' + S.lesson.id + '/reviews?task=' + el.getAttribute('data-id');
};
