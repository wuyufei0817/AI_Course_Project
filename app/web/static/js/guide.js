/* AI4En · 使用指南、提示词、培训流程与启动 */
'use strict';

function guideView(embedded) {
  var g = META.guide || { prompts: [], steps: [], training: [], faq: [] };
  var tab = S.guideTab || 'steps';
  var tabs = [['steps', '操作卡'], ['prompts', '提示词模板'], ['training', '60 分钟培训'], ['downloads', '打印与下载'], ['faq', '常见问题']];
  var body = '';

  if (tab === 'steps') {
    body = g.steps.map(function (s, i) {
      return '<div class="card" style="margin-bottom:12px"><div class="guide-step" style="border:none;padding:0">' +
        '<div class="n">' + (i + 1) + '</div><div style="flex:1"><h3>' + esc(s.title) + '</h3>' +
        '<ol class="small muted" style="margin:8px 0 0 18px;line-height:1.95">' +
        s.items.map(function (it) { return '<li>' + esc(it) + '</li>'; }).join('') + '</ol></div></div></div>';
    }).join('');
    body = banner('指南直接解释应用里已有的操作，不另建一套说明。建议打印“操作卡”放在讲台上。', 'info', 'i') +
      '<div style="margin-top:14px">' + body + '</div>' +
      '<div class="card"><div class="section-title"><span class="dot"></span>演示账号</div>' +
      '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>身份</th><th>账号</th><th>密码</th><th>说明</th></tr></thead><tbody>' +
      (META.accounts || []).map(function (a) {
        return '<tr><td>' + esc(a.role) + '</td><td class="mono">' + esc(a.username) + '</td><td class="mono">' + esc(a.password) + '</td><td class="small muted">' + esc(a.note) + '</td></tr>';
      }).join('') + '</tbody></table></div></div>';
  } else if (tab === 'prompts') {
    body = banner('提示词可直接复制到模型服务，也可以交给后端模型接口使用。提示词里的【】换成自己的课例；生成内容仅作候选稿。', 'info', 'i') +
      '<div class="stack" style="margin-top:14px">' + g.prompts.map(function (p, i) {
        return '<div class="prompt-card"><div class="row" style="justify-content:space-between">' +
          '<div><h3>' + esc(p.title) + '</h3><div class="tiny muted">' + esc(p.scene) + '</div></div>' +
          btn('复制提示词', 'copy-prompt', 'data-i="' + i + '"', 'sm') + '</div>' +
          '<details class="prompt-detail"><summary>查看提示词全文</summary><pre>' + esc(p.body) + '</pre></details><div class="tiny muted">' + esc(p.note) + '</div></div>';
      }).join('') + '</div>';
  } else if (tab === 'training') {
    body = '<div class="card"><div class="section-title"><span class="dot"></span>60 分钟教师工作坊</div>' +
      '<div class="card-sub">使用同一课例（Animals）与已有页面，教师跟随完成一轮实际修改；培训结束每人至少完成一次修改、一次导出与一条反馈确认。</div>' +
      '<div class="tbl-wrap"><table class="tbl"><thead><tr><th style="width:110px">时间</th><th>教师实践任务</th><th style="width:200px">可检查的结果</th></tr></thead><tbody>' +
      g.training.map(function (t) {
        return '<tr><td><b>' + esc(t.time) + '</b></td><td>' + esc(t.task) + '</td><td class="small muted">' + esc(t.check) + '</td></tr>';
      }).join('') + '</tbody></table></div></div>' +
      '<div class="grid two" style="margin-top:14px">' +
      '<div class="card"><div class="section-title"><span class="dot"></span>培训前准备</div><ul class="small muted" style="line-height:2;padding-left:18px">' +
      '<li>教师账号 t_wang 与示例课例 Animals 已就绪</li><li>电脑能打开 PPTX 与 PDF，投屏可用</li><li>每人一份操作卡打印稿</li></ul></div>' +
      '<div class="card"><div class="section-title"><span class="dot"></span>培训后检查</div><ul class="small muted" style="line-height:2;padding-left:18px">' +
      '<li>每人完成一次教案修改并保存</li><li>每人导出一份 PPTX 并实际打开</li><li>每人确认一条反馈，写一个下次调整</li></ul></div></div>';
  } else if (tab === 'downloads') {
    body = '<div class="grid two">' +
      '<div class="card"><div class="section-title"><span class="dot"></span>本课例成果包</div>' +
      '<p class="small muted" style="margin-bottom:12px">打开后可“打印 → 另存为 PDF”；课件可直接下载编辑。</p>' +
      '<div class="row" style="flex-wrap:wrap">' +
      link('教案（A4 打印）', '/print/lesson/' + S.lessonId) +
      link('导出 PPTX', '/api/lessons/' + S.lessonId + '/export/pptx') +
      link('词卡与任务卡', '/print/cards/' + S.lessonId) +
      link('学生卷', '/print/task/' + (S.tasks && S.tasks[0] ? S.tasks[0].id : '') + '/paper') +
      link('独立答案页', '/print/task/' + (S.tasks && S.tasks[0] ? S.tasks[0].id : '') + '/answers') +
      link('教学日志', '/print/log/' + S.lessonId) +
      '</div></div>' +
      '<div class="card"><div class="section-title"><span class="dot"></span>培训与验证材料</div>' +
      '<p class="small muted" style="margin-bottom:12px">与应用同一套页面生成，便于打印或随培训发放。</p>' +
      '<div class="row" style="flex-wrap:wrap">' +
      link('教师操作卡', '/print/guide/card') +
      link('可复制提示词', '/print/guide/prompts') +
      link('60 分钟培训流程', '/print/guide/training') +
      '</div></div></div>' +
      '<div class="card" style="margin-top:14px"><div class="section-title"><span class="dot"></span>文件说明</div>' +
      '<ul class="small muted" style="line-height:2;padding-left:18px">' +
      '<li>PPTX 为固定模板、可编辑文本，页序与“课件资源”页预览一致。</li>' +
      '<li>教案、学生卷、答案页共用同一份课例数据；学生卷不含答案，答案页仅教师可见。</li>' +
      '<li>PDF 由打印视图生成（浏览器“另存为 PDF”或交付目录中的同名 PDF）。</li></ul></div>';
  } else {
    body = '<div class="stack">' + g.faq.map(function (item) {
      return '<details class="faq-item"><summary>' + esc(item[0]) + '</summary><p>' + esc(item[1]) + '</p></details>';
    }).join('') + '</div>';
  }

  if (embedded && tab === 'downloads') {
    body = (S.lesson && S.lesson.id === TW.current ? teacherResources(S.lesson) : banner('先在课例库创建或选择课例，再准备本课资源。', 'info')) +
      '<div class="card tw-tool-section"><div class="section-title"><span class="dot"></span>培训材料</div><div class="row">' +
      link('教师操作卡', '/print/guide/card') + link('可复制提示词', '/print/guide/prompts') + link('60 分钟培训流程', '/print/guide/training') +
      link('20 页培训演示', '/static/workshop/index.html#slides') + '</div></div>';
  }
  var intro = pageHead('使用指南', '操作步骤、可复制提示词、60 分钟培训流程与常见问题',
      link('打开课例', '#/lesson/' + S.lessonId + '/plan')) +
    '<div class="card" style="margin-bottom:16px"><div class="section-title"><span class="dot"></span>AI 英语教学工作坊</div>' +
    '<p class="small muted" style="margin-bottom:12px">练习审核预设教学稿、完善提示词和制作游戏。在工作坊存入符合本课词汇的配对游戏后，可回到教师的课堂活动载入草稿。</p>' +
    '<div class="row" style="flex-wrap:wrap"><a class="btn primary" href="#/studio/workshop">进入游戏工坊</a>' +
    '<a class="btn" href="#/studio/mystery">水果线索卡</a>' +
    '<a class="btn" target="_blank" rel="noopener" href="/static/workshop/index.html#slides">20 页培训演示 ↗</a></div></div>' ;
  return (embedded ? '' : intro) +
    '<div class="guide-tabs">' + tabs.map(function (t) {
      return '<button class="btn ' + (tab === t[0] ? 'primary' : '') + ' sm" data-act="guide-tab" data-tab="' + t[0] + '">' + t[1] + '</button>';
    }).join('') + '</div>' + body;
}

ACTIONS['guide-tab'] = function (el) {
  S.guideTab = el.getAttribute('data-tab');
  render();
};

ACTIONS['copy-prompt'] = async function (el) {
  var i = parseInt(el.getAttribute('data-i'), 10);
  var prompt = (META.guide.prompts || [])[i];
  if (!prompt) return;
  try {
    await navigator.clipboard.writeText(prompt.body);
    toast('提示词已复制', 'ok');
  } catch (e) {
    toast('浏览器未允许剪贴板，请手动选择文本复制', 'error');
  }
};

function afterRender() {
  document.querySelectorAll('.field').forEach(function (field, i) {
    var label = field.querySelector('label');
    var input = field.querySelector('input:not([type="hidden"]), textarea, select');
    if (!label || !input || label.htmlFor || label.contains(input)) return;
    input.id = input.id || 'view-field-' + i;
    label.htmlFor = input.id;
  });
  window.scrollTo(0, 0);
}

async function init() {
  try { META = await api('/api/meta'); } catch (e) { /* 离线也要能显示登录页 */ }
  try {
    var me = await api('/api/me');
    S.user = me.user;
  } catch (e) {
    S.user = null;
  }
  if (S.user && S.user.role === 'teacher' && !S.lessonId) {
    try {
      var ls = await api('/api/lessons');
      if (ls.lessons && ls.lessons.length) S.lessonId = ls.lessons[0].id;
    } catch (e) { /* 忽略 */ }
  }
  window.addEventListener('hashchange', function () {
    Promise.resolve(render()).catch(function (err) { toast(err.message || '加载失败', 'error'); });
  });
  await render();
}
