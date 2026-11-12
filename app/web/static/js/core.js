/* AI4En · 前端核心：状态、接口、路由、外壳、登录 */
'use strict';

var S = {
  user: null,
  route: [],
  lesson: null, plan: null, slides: [], slideIdx: 0, ex: null,
  tasks: [], results: null, resultTaskId: null,
  taskForm: null, cond: null, answers: {}, review: null,
  guideTab: 'steps', modal: null, notice: null, busy: false
};
var META = { accounts: [], levels: ['已完成', '需局部修改', '需教师帮助'], sources: {}, guide: null, show_result_options: [] };
var SOURCE_LABEL = { model: '真实模型输出', sample: '示例内容', rule: '规则生成', manual: '教师手工编辑' };
var SUB_LABEL = { submitted: '已提交', revision_requested: '待订正', resubmitted: '已订正' };
var TASK_LABEL = { draft: '草稿', ongoing: '进行中', ended: '已结束' };
var LESSON_LABEL = { draft: '草稿', approved: '已审核' };
var LEVEL_CLASS = { '已完成': 'teal', '需局部修改': 'amber', '需教师帮助': 'red' };

/* ---------------------------------------------------------------- 基础工具 */
function q(sel, root) { return (root || document).querySelector(sel); }
function qa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
function esc(value) {
  return String(value === undefined || value === null ? '' : value).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function clone(obj) { return JSON.parse(JSON.stringify(obj === undefined ? null : obj)); }
function setPath(obj, path, val) {
  var parts = String(path).split('.');
  var cur = obj;
  for (var i = 0; i < parts.length - 1; i++) {
    var k = parts[i];
    if (cur[k] === undefined || cur[k] === null) cur[k] = /^\d+$/.test(parts[i + 1]) ? [] : {};
    cur = cur[k];
  }
  cur[parts[parts.length - 1]] = val;
}
function getPath(obj, path) {
  return String(path).split('.').reduce(function (o, k) { return o === undefined || o === null ? undefined : o[k]; }, obj);
}
function nl2br(text) { return esc(text).replace(/\n/g, '<br>'); }
function num(value) { return (value === null || value === undefined || value === '') ? '—' : value; }

async function api(path, method, body) {
  var opts = { method: method || 'GET', credentials: 'same-origin', headers: {} };
  if (body !== undefined && body !== null) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  var res = await fetch(path, opts);
  var data = null;
  try { data = await res.json(); } catch (e) { data = { error: '返回内容无法解析' }; }
  if (!res.ok) {
    var err = new Error(data && data.error ? data.error : '请求失败（' + res.status + '）');
    err.status = res.status;
    err.data = data || {};
    throw err;
  }
  if (opts.method !== 'GET' && S.user && S.user.role === 'teacher' && typeof TW !== 'undefined') TW.mutations = (TW.mutations || 0) + 1;
  return data;
}

function toast(message, kind) {
  var box = document.getElementById('toast');
  if (!box) return;
  var el = document.createElement('div');
  el.className = 'toast ' + (kind || '');
  el.textContent = message;
  box.appendChild(el);
  setTimeout(function () { el.remove(); }, kind === 'error' ? 6000 : 3600);
}

function fail(err) {
  if (err && err.status === 401) {
    S.user = null;
    render();
    return;
  }
  var extra = err && err.data && err.data.missing ? '（缺失：' + err.data.missing.join('；') + '）' : '';
  toast((err && err.message ? err.message : '操作失败') + extra, 'error');
}

/* ---------------------------------------------------------------- 片段 */
function btn(label, act, attrs, cls) {
  return '<button class="btn ' + (cls || '') + '" data-act="' + act + '" ' + (attrs || '') + '>' + label + '</button>';
}
function link(label, href, cls) {
  return '<a class="btn ' + (cls || '') + '" href="' + href + '" target="_blank" rel="noopener">' + label + '</a>';
}
function chip(text, kind) { return '<span class="chip ' + (kind || '') + '">' + esc(text) + '</span>'; }
function srcBadge(source) {
  var label = SOURCE_LABEL[source] || source || '未标注';
  var cls = source === 'sample' ? 'sample' : source === 'manual' ? 'manual' : source === 'model' ? 'model' : '';
  return '<span class="badge-src ' + cls + '">' + esc(label) + '</span>';
}
function lessonChip(status) { return chip(LESSON_LABEL[status] || status, status === 'approved' ? 'teal' : 'amber'); }
function taskChip(status) { return chip(TASK_LABEL[status] || status, status === 'ongoing' ? 'teal' : status === 'draft' ? 'amber' : 'gray'); }
function subChip(status) { return chip(SUB_LABEL[status] || status, status === 'resubmitted' ? 'teal' : status === 'revision_requested' ? 'amber' : 'gray'); }
function levelChip(level) {
  if (!level) return '';
  return chip(level, LEVEL_CLASS[level] || 'gray');
}
function pageHead(title, sub, actions) {
  return '<div class="page-head"><div><h1>' + title + '</h1>' +
    (sub ? '<div class="sub">' + sub + '</div>' : '') + '</div>' +
    '<div class="page-actions">' + (actions || '') + '</div></div>';
}
function banner(text, kind, icon) {
  return '<div class="banner ' + (kind || 'info') + '"><span class="icon">' + (icon || '·') + '</span><div>' + text + '</div></div>';
}
function empty(text) { return '<div class="card ui-empty"><img src="/static/illustrations/animals.webp" width="1200" height="800" alt="" aria-hidden="true" loading="lazy"><p>' + esc(text) + '</p></div>'; }

/* ---------------------------------------------------------------- 外壳 */
function roleLabel(role) {
  return role === 'teacher' ? '教师' : role === 'student' ? '学生' : '家长';
}

function pageMeta() {
  if (S.user.role === 'teacher' && typeof teacherPageMeta === 'function') return teacherPageMeta();
  var role = S.user.role;
  var segs = S.route || [];
  var first = segs[0] || '';
  if (first === 'lesson') {
    var tabs = { plan: '教案备课', slides: '课件资源', activities: '课堂活动', exercises: '练习与小测', tasks: '任务发布', results: '结果与日志' };
    return { title: '课例', sub: tabs[segs[2]] || '课例详情' };
  }
  if (first === 'review') return { title: '课例', sub: '批改与订正' };
  if (first === 'studio') return { title: '工具', sub: '拓展：工作坊与完整版' };
  if (first === 'guide') return { title: '帮助', sub: '使用指南与培训' };
  if (role === 'teacher') return { title: '工作台', sub: (S.user.class_name || '') + ' · 全部课例' };
  if (role === 'student') {
    var stuSub = { '': '学习概览', tasks: '我的任务', wrong: '错题本', records: '订正记录', report: '学习报告', words: '单词卡', guide: '使用说明', task: '作业作答' };
    return { title: '学习', sub: stuSub[segs[1] || ''] || '学习档案' };
  }
  return { title: '孩子', sub: '只读查看任务与已确认反馈' };
}

/* ---------------------------------------------------------------- 图标（线性 SVG，替代 emoji） */
var ICON_PATHS = {
  home: '<path d="M3 9.5 10 3l7 6.5V17a1 1 0 0 1-1 1h-3.5v-4.5h-5V18H4a1 1 0 0 1-1-1Z"/>',
  grid: '<rect x="3" y="3" width="5.5" height="5.5" rx="1.2"/><rect x="11.5" y="3" width="5.5" height="5.5" rx="1.2"/><rect x="3" y="11.5" width="5.5" height="5.5" rx="1.2"/><rect x="11.5" y="11.5" width="5.5" height="5.5" rx="1.2"/>',
  book: '<path d="M3 4.5A1.5 1.5 0 0 1 4.5 3H9a2 2 0 0 1 2 2v11a2.2 2.2 0 0 0-2-1.4H4a1 1 0 0 1-1-1Z"/><path d="M17 4.5A1.5 1.5 0 0 0 15.5 3H11a2 2 0 0 0-2 2v11a2.2 2.2 0 0 1 2-1.4h5a1 1 0 0 0 1-1Z"/>',
  compass: '<circle cx="10" cy="10" r="7"/><path d="m12.6 7.4-1.5 3.7-3.7 1.5 1.5-3.7Z"/>',
  task: '<rect x="4" y="3.5" width="12" height="14" rx="1.6"/><path d="M7.2 8h5.6M7.2 11.4h5.6M7.2 14.8h3.4"/>',
  wrong: '<rect x="4" y="3.5" width="12" height="14" rx="1.6"/><path d="m7.4 8.2 5.2 5.2M12.6 8.2l-5.2 5.2"/>',
  rotate: '<path d="M4.2 10a5.8 5.8 0 0 1 9.9-4.1L16 8"/><path d="M16 3.6V8h-4.4"/><path d="M15.8 10a5.8 5.8 0 0 1-9.9 4.1L4 12"/><path d="M4 16.4V12h4.4"/>',
  parent: '<circle cx="10" cy="7" r="3.2"/><path d="M4.4 17c.6-3 2.8-4.6 5.6-4.6s5 1.6 5.6 4.6"/>',
  chart: '<path d="M3.5 16.5h13"/><rect x="5" y="10" width="2.6" height="6" rx=".6"/><rect x="9.2" y="6.2" width="2.6" height="9.8" rx=".6"/><rect x="13.4" y="8.4" width="2.6" height="7.6" rx=".6"/>',
  cards: '<rect x="3" y="5.2" width="8.6" height="11" rx="1.4"/><path d="m13.4 6.4 2.9.9-2.2 8.4-2.8-.8"/>',
  calendar: '<rect x="3.5" y="4.5" width="13" height="12" rx="1.6"/><path d="M3.5 8.2h13M7 3v3M13 3v3"/>',
  message: '<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h9A1.5 1.5 0 0 1 16 5.5v6A1.5 1.5 0 0 1 14.5 13H9l-4 3.5V13H5.5A1.5 1.5 0 0 1 4 11.5Z"/>'
};

function icon(name) {
  var path = ICON_PATHS[name] || ICON_PATHS.task;
  return '<svg class="ico-svg" viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" ' +
    'stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + path + '</svg>';
}

function shellNav() {
  if (S.user.role === 'teacher' && typeof teacherNav === 'function') return teacherNav();
  var role = S.user.role;
  var first = (S.route || [])[0] || '';
  var items = [];
  if (role === 'teacher') {
    items.push(['group', '总览']);
    items.push(['#/', 'home', '工作台', first === '' || first === 'lesson' || first === 'review']);
    items.push(['group', '工具']);
    items.push(['#/studio', 'grid', '拓展', first === 'studio']);
    items.push(['#/guide', 'book', '使用指南', first === 'guide']);
  } else if (role === 'student') {
    var segs = S.route || [];
    var sub = segs[1] || '';
    items.push(['group', '学习']);
    items.push(['#/student', 'compass', '学习概览', sub === '']);
    items.push(['#/student/tasks', 'task', '我的任务', sub === 'tasks' || sub === 'task']);
    items.push(['#/student/words', 'cards', '单词卡', sub === 'words']);
    items.push(['group', '记录']);
    items.push(['#/student/wrong', 'wrong', '错题本', sub === 'wrong']);
    items.push(['#/student/records', 'rotate', '订正记录', sub === 'records']);
    items.push(['#/student/report', 'chart', '学习报告', sub === 'report']);
    items.push(['group', '帮助']);
    items.push(['#/student/guide', 'book', '使用说明', sub === 'guide']);
  } else {
    items.push(['group', '孩子']);
    items.push(['#/', 'parent', '孩子任务', true]);
  }
  return items.map(function (it) {
    if (it[0] === 'group') return '<div class="side-group">' + esc(it[1]) + '</div>';
    return '<a href="' + it[0] + '" class="' + (it[3] ? 'active' : '') + '"' + (it[3] ? ' aria-current="page"' : '') + '><span class="ico">' + icon(it[1]) + '</span>' + esc(it[2]) + '</a>';
  }).join('');
}

function shell(content) {
  var role = S.user.role;
  var meta = pageMeta();
  var foot = role === 'teacher' ? '教师主导 · 结果可核对'
    : role === 'student' ? '老师确认后可见反馈'
      : '只读 · 仅本人孩子';
  return '<div class="shell shell-' + role + '"><aside class="side">' +
      '<a class="side-brand" href="#/"><span class="logo">AI4En</span><span class="sub">英语教学助手</span></a>' +
      '<nav class="side-nav" aria-label="主要导航">' + shellNav() + '</nav>' +
      '<details class="mobile-menu"><summary aria-label="展开或收起页面导航"><svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M3 5h14M3 10h14M3 15h14"/></svg><span>菜单</span></summary><nav class="mobile-nav" aria-label="移动端页面导航">' + shellNav() + '</nav></details>' +
      '<div class="side-foot">' + esc(foot) + '</div></aside>' +
      '<div class="main"><header class="topbar">' +
        '<div class="top-title"><div class="t">' + esc(meta.title) + '</div><p>' + esc(meta.sub) + '</p></div>' +
        '<div class="top-actions"><span class="role-chip">' + roleLabel(role) + '</span>' +
        '<span class="who-name">' + esc(S.user.name) + '</span>' +
        '<button class="btn sm ghost" data-act="logout">退出</button></div>' +
      '</header>' + (role === 'teacher' && typeof teacherContext === 'function' ? teacherContext() : '') +
      '<main class="content"><div class="container">' + content + '</div></main></div></div>';
}

function modal(html) {
  closeModal();
  var trigger = document.activeElement;
  var mask = document.createElement('dialog');
  mask.className = 'app-dialog';
  mask.id = 'modal';
  mask.setAttribute('aria-labelledby', 'modal-title');
  mask.innerHTML = '<div class="modal"><button type="button" class="dialog-close-btn" data-act="close-modal" aria-label="关闭窗口">×</button>' + html + '</div>';
  var heading = mask.querySelector('h3');
  if (heading) heading.id = 'modal-title';
  mask.querySelectorAll('.field').forEach(function (field, i) {
    var label = field.querySelector('label');
    var input = field.querySelector('input, textarea, select');
    if (label && input) { input.id = input.id || 'modal-field-' + i; label.htmlFor = input.id; }
  });
  mask._returnFocus = trigger;
  mask._previousOverflow = document.body.style.overflow;
  mask.addEventListener('click', function (e) {
    var r = mask.getBoundingClientRect();
    if (e.target === mask && (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)) closeModal();
  });
  mask.addEventListener('cancel', function (e) { e.preventDefault(); closeModal(); });
  document.body.appendChild(mask);
  document.body.style.overflow = 'hidden';
  mask.showModal();
  var first = mask.querySelector('input, textarea, select');
  if (first) first.focus();
  return mask;
}
function closeModal() {
  var el = document.getElementById('modal');
  if (el) {
    if (el.close) el.close();
    el.remove();
    document.body.style.overflow = el._previousOverflow || '';
    if (el._returnFocus && el._returnFocus.isConnected) el._returnFocus.focus();
  }
}

/* Native disclosure menu keeps navigation reachable without horizontal scrolling. */
document.addEventListener('click', function (event) {
  var menu = document.querySelector('.mobile-menu[open]');
  if (!menu) return;
  if (event.target.closest('.mobile-nav a') || !menu.contains(event.target)) menu.open = false;
});
document.addEventListener('keydown', function (event) {
  if (event.key !== 'Escape') return;
  var menu = document.querySelector('.mobile-menu[open]');
  if (menu) { menu.open = false; menu.querySelector('summary').focus(); }
});

/* ---------------------------------------------------------------- 视图调度 */
async function render() {
  if (S.user && S.user.role === 'teacher' && typeof teacherBeforeRender === 'function' && !teacherBeforeRender()) return;
  var app = document.getElementById('app');
  if (!S.user) {
    app.innerHTML = typeof loginView === 'function' ? loginView() : '<div class="container">加载中…</div>';
    if (typeof afterRender === 'function') afterRender();
    return;
  }
  var rawHash = location.hash.replace(/^#\/?/, '');
  var query = {};
  var qAt = rawHash.indexOf('?');
  if (qAt >= 0) {
    rawHash.slice(qAt + 1).split('&').forEach(function (pair) {
      var kv = pair.split('=');
      if (kv[0]) query[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1] || '');
    });
    rawHash = rawHash.slice(0, qAt);
  }
  var segs = rawHash.split('/').filter(Boolean);
  S.route = segs;
  S.query = query;
  var main = '';
  try {
    if (S.user.role === 'teacher' && typeof teacherWorkspaceView === 'function') main = await teacherWorkspaceView(segs);
    else if (segs[0] === 'lesson') main = await lessonView(parseInt(segs[1], 10), segs[2] || 'plan');
    else if (segs[0] === 'review') main = await reviewView(parseInt(segs[1], 10));
    else if (segs[0] === 'student' && segs[1] === 'task') main = await studentTaskView(parseInt(segs[2], 10));
    else if (segs[0] === 'student') main = await studentView(segs[1] || '');
    else if (segs[0] === 'studio') main = studioView();
    else if (segs[0] === 'guide') main = guideView();
    else main = await homeView();
  } catch (err) {
    if (err && err.status === 401) { S.user = null; return render(); }
    main = '<div class="card pad-lg">' + banner(esc(err.message || '页面加载失败'), 'error', '!') +
      '<div class="row" style="margin-top:14px"><a class="btn" href="#/">返回首页</a></div></div>';
  }
  app.innerHTML = shell(main);
  if (typeof afterRender === 'function') afterRender();
  if (S.user.role === 'teacher' && typeof teacherAfterRender === 'function') teacherAfterRender();
}

async function homeView() {
  if (S.user.role === 'teacher') {
    var data = await api('/api/lessons');
    return teacherHomeView(data.lessons);
  }
  if (S.user.role === 'student') {
    return studentView('');
  }
  var parent = await api('/api/parent/overview');
  return parentHomeView(parent);
}

/* ---------------------------------------------------------------- 登录 */
function loginView() {
  var accounts = (META.accounts || []).map(function (a) {
    return '<button type="button" class="demo-row" data-act="fill-login" data-u="' + esc(a.username) + '" data-p="' + esc(a.password) + '">' +
      '<span class="r">' + esc(a.role) + '</span>' +
      '<span class="who">' + esc(a.note) + '</span>' +
      '<span class="cred">' + esc(a.username) + ' / ' + esc(a.password) + '</span></button>';
  }).join('');
  return '<div class="login-wrap"><div class="login-left">' +
    '<div><h1 class="brandline">AI4En<span class="brand-sep">·</span>英语教学助手</h1>' +
    '<div class="lead">从备课到反馈的一条教学链路：一份课例同时生成教案、课件、课堂活动与练习，' +
    '学生作答后由教师确认反馈，再完成订正与教学日志。</div>' +
    '<div class="flow-chips"><span>新建课例</span><span>教案</span><span>课件</span><span>课堂活动</span>' +
    '<span>练习与小测</span><span>发布</span><span>提交</span><span>反馈</span><span>订正</span><span>复盘</span></div>' +
    '<div class="login-points">' +
    '<div class="p"><b>教师</b>生成可编辑的教案、课件与练习，发布前逐项核对。</div>' +
    '<div class="p"><b>学生</b>看到本人任务，提交后按教师确认的反馈订正。</div>' +
    '<div class="p"><b>家长</b>只读绑定孩子的任务状态与已确认反馈。</div>' +
    '</div></div><div class="foot">教师主导 · 内容可编辑 · 结果可核对</div></div>' +
    '<div class="login-right"><div class="login-form">' +
    '<h2>登录</h2><div class="sub muted small" style="margin-bottom:18px">使用预置的演示账号进入对应视角</div>' +
    '<form id="loginForm" class="form-grid">' +
    '<div class="field"><label>账号</label><input class="input" id="username" value="t_wang" autocomplete="username"></div>' +
    '<div class="field"><label>密码</label><input class="input" id="password" type="password" value="teach123" autocomplete="current-password"></div>' +
    '<button class="btn primary lg block" type="submit" data-act="login">进入工作台</button>' +
    '</form>' +
    '<div class="demo-table"><div class="demo-title">演示账号<span>点击填入</span></div>' + accounts + '</div>' +
    '</div></div></div>';
}

async function doLogin() {
  var username = q('#username').value.trim();
  var password = q('#password').value;
  try {
    var res = await api('/api/login', 'POST', { username: username, password: password });
    S.user = res.user;
    S.lesson = null; S.plan = null; S.ex = null; S.slides = [];
    location.hash = '#/';
    await render();
  } catch (err) {
    fail(err);
  }
}

/* ---------------------------------------------------------------- 事件总线 */
var ACTIONS = {};

document.addEventListener('click', function (e) {
  var target = e.target.closest('[data-act]');
  if (!target) return;
  if (target.tagName === 'SELECT') return;
  var act = target.getAttribute('data-act');
  var fn = ACTIONS[act];
  if (!fn) return;
  e.preventDefault();
  Promise.resolve(fn(target)).catch(fail);
});

document.addEventListener('submit', function (e) {
  if (e.target.id === 'newLesson') {
    e.preventDefault();
    Promise.resolve(ACTIONS['create-lesson'](q('[data-act="create-lesson"]', document.getElementById('modal')))).catch(fail);
    return;
  }
  if (e.target.id === 'loginForm') {
    e.preventDefault();
    Promise.resolve(doLogin()).catch(fail);
  }
});

function bindState(name) {
  if (name === 'plan') return S.plan;
  if (name === 'ex') return S.ex;
  if (name === 'slides') return S.slides;
  if (name === 'taskForm') return S.taskForm;
  if (name === 'cond') return S.cond;
  if (name === 'answers') return S.answers;
  if (name === 'review') return S.review;
  if (name === 'logForm') return S.logForm;
  return S;
}

document.addEventListener('input', function (e) {
  if (e.target.closest('#newLesson')) {
    var error = document.getElementById('newLessonError');
    if (error) error.hidden = true;
  }
  var node = e.target.closest('[data-bind]');
  if (!node) return;
  var state = bindState(node.getAttribute('data-state'));
  if (!state) return;
  var value = node.type === 'checkbox' ? node.checked : node.value;
  setPath(state, node.getAttribute('data-bind'), value);
});

document.addEventListener('change', function (e) {
  if (e.target.matches('select[data-act]') && ACTIONS[e.target.dataset.act]) {
    Promise.resolve(ACTIONS[e.target.dataset.act](e.target)).catch(fail);
  }
  var node = e.target.closest('[data-bind]');
  if (node) {
    var state = bindState(node.getAttribute('data-state'));
    if (state) setPath(state, node.getAttribute('data-bind'), node.type === 'checkbox' ? node.checked : node.value);
  }
  var radio = e.target.closest('input[type=radio][data-bind]');
  if (radio) {
    qa('.opt-row', radio.closest('.opt-list')).forEach(function (row) { row.classList.remove('selected'); });
    var row = radio.closest('.opt-row');
    if (row) row.classList.add('selected');
  }
});

document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') {
    var overlay = document.getElementById('present');
    if (overlay) { overlay.remove(); return; }
    closeModal();
  }
});

ACTIONS.logout = async function () {
  try { await api('/api/logout', 'POST', {}); } catch (e) { /* 忽略 */ }
  S.user = null;
  location.hash = '#/';
  render();
};

ACTIONS['fill-login'] = function (el) {
  q('#username').value = el.getAttribute('data-u');
  q('#password').value = el.getAttribute('data-p');
};
