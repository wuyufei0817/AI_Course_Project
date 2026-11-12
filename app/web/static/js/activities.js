/* AI4En · 课堂活动：词义配对、句子排序、投屏与重玩 */
'use strict';

var GAME = null;

function activitiesTab(lesson) {
  var acts = lesson.activities || [];
  var cards = acts.map(function (a) {
    var data = a.data || {};
    var summary = '';
    if (a.kind === 'match') {
      summary = (data.pairs || []).map(function (p) { return esc(p.left) + ' — ' + esc(p.right); }).join('　');
    } else {
      summary = '句子：' + esc(data.sentence || '') + '　词块：' + (data.tokens || []).map(function (t) { return '[' + esc(t) + ']'; }).join('');
    }
    return '<div class="card activity-card"><div class="row" style="justify-content:space-between">' +
      '<div><h3>' + esc(data.title || (a.kind === 'match' ? '词义配对' : '句子排序')) + '</h3>' +
      '<div class="card-sub" style="margin:2px 0 0">' + esc(data.instruction || '') + '</div></div>' +
      chip(a.kind === 'match' ? '配对' : '排序', 'teal') + '</div>' +
      '<div class="small muted" style="line-height:1.9">' + summary + '</div>' +
      '<div class="row">' + btn('投屏演示', 'play-activity', 'data-id="' + a.id + '"', 'primary sm') +
      btn('编辑内容', 'edit-activity', 'data-id="' + a.id + '"', 'sm') +
      btn('打印词卡', 'print-cards', 'data-lesson="' + lesson.id + '"', 'sm') + '</div>' +
      (a.kind === 'match' && S.user && S.user.role === 'teacher'
        ? '<div class="row" style="flex-wrap:wrap">' +
          '<a class="btn sm" href="#/studio/workshop?lesson=' + encodeURIComponent(lesson.id) + '">打开游戏工坊</a>' +
          btn('从教学背包导入', 'workshop-import', 'data-id="' + a.id + '"', 'sm') + '</div>'
        : '') + '</div>';
  }).join('');

  return lessonHeader(lesson, '<a class="btn" target="_blank" rel="noopener" href="/print/cards/' + lesson.id + '">打印词卡与任务卡</a>') +
    lessonTabs(lesson, 'activities') +
    banner('课堂活动用于投屏组织口头练习：每轮配对 4–6 组、排序 1–2 句。结果只表示本轮活动情况，不自动记入学生个人成绩。', 'info', 'i') +
    (String(lesson.topic).trim().toLowerCase() === 'animals' ?
      '<div class="card activity-card" style="margin-top:16px">' +
        '<div><h3>Animals 动物探险课</h3><p class="card-sub">示范词库 cat / dog / panda / frog。先玩一关，再用完整句回答 Lily。</p></div>' +
        '<div class="row" style="flex-wrap:wrap"><a class="btn primary" href="/static/classroom/#games" target="_blank" rel="noopener">投屏 · 游戏闯关 ↗</a>' +
        '<a class="btn" href="/static/classroom/#lily" target="_blank" rel="noopener">投屏 · Lily 问答 ↗</a></div></div>' : '') +
    '<div class="grid two" style="margin-top:16px">' + (cards || empty('还没有课堂活动。')) + '</div>';
}

ACTIONS['print-cards'] = function (el) {
  window.open('/print/cards/' + el.getAttribute('data-lesson'), '_blank', 'noopener');
};

ACTIONS['play-activity'] = function (el) {
  var id = parseInt(el.getAttribute('data-id'), 10);
  var act = (S.lesson.activities || []).filter(function (a) { return a.id === id; })[0];
  if (!act) return;
  startGame(act);
};

function shuffled(list) {
  var arr = list.slice();
  for (var i = arr.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
  }
  return arr;
}

function startGame(act) {
  closeGame();
  GAME = {
    act: act,
    kind: act.kind,
    data: act.data || {},
    matched: {},
    sel: null,
    wrong: null,
    placed: [],
    msg: '',
    msgKind: '',
    done: false
  };
  if (act.kind === 'match') {
    GAME.rightOrder = shuffled((GAME.data.pairs || []).map(function (_, i) { return i; }));
  } else {
    GAME.tokenOrder = shuffled((GAME.data.tokens || []).map(function (t) { return t; }));
  }
  var overlay = document.createElement('div');
  overlay.id = 'present';
  overlay.className = 'present-overlay';
  overlay.innerHTML = '<div class="p-head"><div><h2 id="gameTitle"></h2><div class="hint" id="gameHintTop"></div></div>' +
    '<div class="row">' + ' <button class="btn" data-act="game-reset">重新开始</button>' +
    '<button class="btn" data-act="game-close">关闭（Esc）</button></div></div>' +
    '<div id="gameBody"></div><div class="game-hint" id="gameHint" style="margin-top:18px;text-align:center"></div>' +
    '<div id="gameBar" style="margin-top:18px;text-align:center"></div>';
  document.body.appendChild(overlay);
  drawGame();
}

function drawGame() {
  if (!GAME) return;
  var data = GAME.data;
  document.getElementById('gameTitle').textContent = data.title || (GAME.kind === 'match' ? '词义配对' : '句子排序');
  document.getElementById('gameHintTop').textContent = data.instruction || '';
  var body = document.getElementById('gameBody');
  var hint = document.getElementById('gameHint');
  var bar = document.getElementById('gameBar');

  if (GAME.kind === 'match') {
    var pairs = data.pairs || [];
    var left = pairs.map(function (p, i) {
      var cls = 'match-item' + (GAME.matched[i] ? ' done' : '') + (GAME.sel === i ? ' sel' : '') + (GAME.wrong === i ? ' wrong' : '');
      return '<button class="' + cls + '" data-act="game-left" data-i="' + i + '">' +
        (p.image ? '<img class="match-art" src="' + esc(p.image) + '" alt="" width="240" height="240" loading="lazy">' : '') + esc(p.left) + '</button>';
    }).join('');
    var right = (GAME.rightOrder || []).map(function (i) {
      var p = pairs[i] || {};
      var cls = 'match-item' + (GAME.matched[i] ? ' done' : '');
      return '<button class="' + cls + '" data-act="game-right" data-i="' + i + '">' + esc(p.right) + '</button>';
    }).join('');
    body.innerHTML = '<div class="match-board"><div class="match-col">' + left + '</div><div class="match-col">' + right + '</div></div>';
    var doneCount = Object.keys(GAME.matched).length;
    bar.innerHTML = '<span class="hint" style="color:#a9c3c1;font-size:13px">已配对 ' + doneCount + ' / ' + pairs.length +
      ' · 先点左边的词，再点右边的意思；键盘可用 Tab 与回车</span>';
  } else {
    var tokens = (GAME.tokenOrder || []).map(function (t, i) {
      var used = GAME.placed.indexOf(t) >= 0;
      return '<button class="token' + (used ? ' used' : '') + '" data-act="game-token" data-t="' + esc(t) + '"' + (used ? ' disabled' : '') + '>' +
        (i + 1) + '. ' + esc(t) + '</button>';
    }).join('');
    var slot = GAME.placed.length
      ? GAME.placed.map(function (t, i) {
          return '<button class="token" data-act="game-placed" data-i="' + i + '">' + esc(t) + '</button>';
        }).join('')
      : '<span style="color:#a9c3c1;font-size:14px">按顺序点下面的词块，或按数字键 1–9</span>';
    body.innerHTML = '<div style="max-width:920px;margin:0 auto">' +
      '<div class="answer-slot" style="min-height:74px">' + slot + '</div>' +
      '<div class="order-tokens" style="margin-top:22px">' + tokens + '</div>' +
      '<div class="row" style="margin-top:20px;justify-content:center">' +
      '<button class="btn primary" data-act="game-check">检查顺序</button>' +
      '<button class="btn" data-act="game-clear">清空</button></div></div>';
    bar.innerHTML = '<span class="hint" style="color:#a9c3c1;font-size:13px">点已放入的词块可以取回</span>';
  }
  hint.className = 'game-hint ' + (GAME.msgKind || '');
  hint.textContent = GAME.msg || '';
}

function normalizeSentence(text) {
  return String(text || '').replace(/\s+([.,!?])/g, '$1').replace(/\s+/g, ' ').trim().toLowerCase();
}

ACTIONS['game-left'] = function (el) {
  GAME.sel = parseInt(el.getAttribute('data-i'), 10);
  GAME.wrong = null;
  GAME.msg = '已选中 ' + (GAME.data.pairs[GAME.sel] || {}).left + '，再点右边的意思';
  GAME.msgKind = '';
  drawGame();
};

ACTIONS['game-right'] = function (el) {
  var rightIdx = parseInt(el.getAttribute('data-i'), 10);
  if (GAME.sel === null) {
    GAME.msg = '先点左边的单词，再点右边的意思。';
    GAME.msgKind = 'bad';
    return drawGame();
  }
  if (GAME.matched[rightIdx]) return;
  if (GAME.sel === rightIdx) {
    GAME.matched[rightIdx] = true;
    GAME.msg = '配对正确：' + GAME.data.pairs[rightIdx].left + ' — ' + GAME.data.pairs[rightIdx].right;
    GAME.msgKind = 'ok';
    GAME.sel = null;
    GAME.wrong = null;
    if (Object.keys(GAME.matched).length === (GAME.data.pairs || []).length) {
      GAME.msg = '全部配对完成，可以重新开始再练一轮。';
      GAME.done = true;
    }
  } else {
    GAME.wrong = rightIdx;
    GAME.msg = '还不对：' + (GAME.data.pairs[rightIdx] || {}).right + ' 不是 ' + (GAME.data.pairs[GAME.sel] || {}).left + '，再看一眼图或词卡。';
    GAME.msgKind = 'bad';
    setTimeout(function () { if (GAME) { GAME.wrong = null; drawGame(); } }, 700);
  }
  drawGame();
};

ACTIONS['game-token'] = function (el) {
  var t = el.getAttribute('data-t');
  if (GAME.placed.indexOf(t) >= 0) return;
  GAME.placed.push(t);
  GAME.msg = '';
  GAME.msgKind = '';
  drawGame();
};

ACTIONS['game-placed'] = function (el) {
  GAME.placed.splice(parseInt(el.getAttribute('data-i'), 10), 1);
  GAME.msg = '';
  GAME.msgKind = '';
  drawGame();
};

ACTIONS['game-clear'] = function () {
  GAME.placed = [];
  GAME.msg = '';
  GAME.msgKind = '';
  drawGame();
};

ACTIONS['game-check'] = function () {
  var target = normalizeSentence(GAME.data.sentence);
  var mine = normalizeSentence(GAME.placed.join(' '));
  if (!GAME.placed.length) {
    GAME.msg = '先把词块放进句子里，再检查。';
    GAME.msgKind = 'bad';
  } else if (mine === target) {
    GAME.msg = '排序正确：' + GAME.data.sentence + '　可以重玩一轮，或换成另一句再练。';
    GAME.msgKind = 'ok';
    GAME.done = true;
  } else {
    GAME.msg = '顺序还不对。' + (GAME.data.hint ? '提示：' + GAME.data.hint : '先想“谁说、什么、怎么样”。');
    GAME.msgKind = 'bad';
  }
  drawGame();
};

ACTIONS['game-reset'] = function () {
  startGame(GAME.act);
};

ACTIONS['game-close'] = function () {
  closeGame();
};

function closeGame() {
  var overlay = document.getElementById('present');
  if (overlay) overlay.remove();
  GAME = null;
}

document.addEventListener('keydown', function (e) {
  if (!GAME) return;
  if (e.key === 'Escape') { closeGame(); return; }
  if (GAME.kind === 'order' && /^[1-9]$/.test(e.key)) {
    var idx = parseInt(e.key, 10) - 1;
    var tokens = (GAME.tokenOrder || []);
    if (idx < tokens.length && GAME.placed.indexOf(tokens[idx]) < 0) {
      GAME.placed.push(tokens[idx]);
      drawGame();
    }
  }
  if (GAME.kind === 'match' && /^[1-9]$/.test(e.key)) {
    var i = parseInt(e.key, 10) - 1;
    if (i < (GAME.data.pairs || []).length) {
      GAME.sel = i;
      GAME.msg = '已选中 ' + GAME.data.pairs[i].left + '，再点右边的意思';
      drawGame();
    }
  }
  if (e.key === 'Enter' && GAME.kind === 'order') {
    ACTIONS['game-check']();
  }
});

/* ---------------------------------------------------------------- 活动编辑 */
function checkedWorkshopPairs(pairs, vocab) {
  if (!Array.isArray(pairs) || pairs.length < 4 || pairs.length > 6) {
    throw new Error('工作坊导入需包含 4–6 组配对。');
  }
  var allowed = new Set(vocab.map(function (word) { return String(word).trim().toLowerCase(); }));
  var words = new Set();
  var meanings = new Set();
  return pairs.map(function (p) {
    if (!p || typeof p.left !== 'string' || typeof p.right !== 'string') {
      throw new Error('词卡必须有文本词语和释义。');
    }
    var left = p.left.trim(), right = p.right.trim();
    var word = left.toLowerCase(), meaning = right.toLowerCase();
    if (!left || left.length > 80 || !right || right.length > 120 || /[\x00-\x1f\x7f]/.test(left + right)) {
      throw new Error('词卡需填写简短的单行词语和释义。');
    }
    if (!allowed.has(word)) throw new Error('导入词语须属于本课例目标词汇：' + left);
    if (words.has(word) || meanings.has(meaning)) throw new Error('配对词语和释义均不能重复。');
    words.add(word);
    meanings.add(meaning);
    return { left: left, right: right, emoji: typeof p.emoji === 'string' ? p.emoji.slice(0, 12) : '' };
  });
}

function workshopGames(lesson) {
  var raw = localStorage.getItem('primary-english-workshop-v1');
  if (!raw) return [];
  var bag = JSON.parse(raw);
  if (!bag || bag.version !== 1 || !Array.isArray(bag.artifacts) || bag.artifacts.length > 300) {
    throw new Error('无法读取教学背包，请先在工作坊检查本地备份。');
  }
  return bag.artifacts.reduce(function (games, item) {
    if (!item || item.type !== 'game' || !item.data || item.data.type !== 'match' || !Array.isArray(item.data.cards)) return games;
    try {
      var pairs = checkedWorkshopPairs(item.data.cards.map(function (card) {
        return card && { left: card.word, right: card.meaning };
      }), lesson.vocab || []);
      var title = typeof item.title === 'string' ? item.title.trim().slice(0, 100) : '';
      var goal = typeof item.data.goal === 'string' ? item.data.goal.trim().replace(/\s+/g, ' ').slice(0, 240) : '';
      games.push({ title: title || '工作坊词义配对', goal: goal, pairs: pairs });
    } catch (err) {
      // Leave incompatible games in the backpack for their original lesson.
    }
    return games;
  }, []);
}

ACTIONS['workshop-import'] = function (el) {
  if (!S.user || S.user.role !== 'teacher' || !S.lesson) return;
  var id = Number(el.getAttribute('data-id'));
  var act = (S.lesson.activities || []).find(function (a) { return a.id === id && a.kind === 'match'; });
  if (!act) return;
  var games;
  try {
    games = workshopGames(S.lesson);
  } catch (err) {
    return toast('教学背包读取失败。请在同一浏览器打开工作坊并检查本地存储。', 'error');
  }
  S.workshopImport = { lessonId: S.lesson.id, activity: act, games: games };
  var options = games.map(function (game, index) {
    return '<option value="' + index + '">' + esc(game.title) + '（' + game.pairs.length + ' 组）</option>';
  }).join('');
  modal('<h3>从教学背包导入</h3><div class="modal-sub">仅列出本课词汇范围内的 4–6 组单词配对。载入后可以修改，保存时才更新课堂活动。</div>' +
    (options ? '<div class="field"><label for="workshop-game">已保存的配对游戏</label><select id="workshop-game" class="input">' + options + '</select></div>'
      : '<p class="small muted">没有匹配本课的游戏。请在工作坊编辑词卡并点击“存入教学背包”。</p>') +
    '<div class="modal-foot">' + btn('取消', 'close-modal') +
    (options ? btn('载入编辑草稿', 'workshop-load-draft', '', 'primary')
      : '<a class="btn primary" href="#/studio/workshop?lesson=' + encodeURIComponent(S.lesson.id) + '">打开游戏工坊</a>') + '</div>');
};

ACTIONS['workshop-load-draft'] = function () {
  var pending = S.workshopImport;
  var picker = document.getElementById('workshop-game');
  if (!S.user || S.user.role !== 'teacher' || !pending || !S.lesson || pending.lessonId !== S.lesson.id || !picker) return;
  var game = pending.games[Number(picker.value)];
  if (!game) return;
  S.editAct = clone(pending.activity);
  S.editAct.fromWorkshop = true;
  S.editAct.data = { title: game.title, instruction: game.goal || '完成配对后，用本课目标句型和同伴问答。', pairs: game.pairs };
  S.workshopImport = null;
  drawActivityEditor();
};

ACTIONS['edit-activity'] = function (el) {
  var id = parseInt(el.getAttribute('data-id'), 10);
  var act = (S.lesson.activities || []).filter(function (a) { return a.id === id; })[0];
  if (!act) return;
  S.editAct = clone(act);
  drawActivityEditor();
};

function drawActivityEditor() {
  closeModal();
  var act = S.editAct;
  var data = act.data || {};
  var inner = '';
  if (act.kind === 'match') {
    inner = '<div class="field"><label>标题</label><input class="input" data-state="editAct" data-bind="data.title" value="' + esc(data.title || '') + '"></div>' +
      '<div class="field"><label>玩法说明</label><input class="input" data-state="editAct" data-bind="data.instruction" value="' + esc(data.instruction || '') + '"></div>' +
      (data.pairs || []).map(function (p, i) {
        return '<div class="row" style="margin-top:8px"><input class="input" style="flex:1" data-state="editAct" data-bind="data.pairs.' + i + '.left" value="' + esc(p.left) + '">' +
          '<span class="muted">—</span>' +
          '<input class="input" style="flex:1" data-state="editAct" data-bind="data.pairs.' + i + '.right" value="' + esc(p.right) + '">' +
          '<input class="input" style="width:60px" data-state="editAct" data-bind="data.pairs.' + i + '.emoji" value="' + esc(p.emoji || '') + '" placeholder="图标"></div>';
      }).join('') +
      '<div class="row" style="margin-top:10px"><button class="btn sm" data-act="act-add-pair">添加一组</button>' +
      '<span class="tiny muted">每轮建议 4–6 组</span></div>';
  } else {
    inner = '<div class="field"><label>标题</label><input class="input" data-state="editAct" data-bind="data.title" value="' + esc(data.title || '') + '"></div>' +
      '<div class="field"><label>词块（按正确顺序，用逗号分隔）</label><input class="input" data-state="editAct" data-bind="data.tokensText" value="' + esc((data.tokens || []).join(', ')) + '"></div>' +
      '<div class="field"><label>提示（做错时显示一句）</label><input class="input" data-state="editAct" data-bind="data.hint" value="' + esc(data.hint || '') + '"></div>' +
      '<div class="banner info" style="margin-top:8px"><span class="icon">i</span><div>当前句子：' + esc(data.sentence || '') + '</div></div>';
  }
  modal('<h3>编辑' + (act.kind === 'match' ? '词义配对' : '句子排序') + '</h3>' +
    '<div class="modal-sub">修改只影响本课例的活动卡片，不影响已发布任务的快照。</div>' +
    (act.fromWorkshop ? '<p class="small muted">已载入工作坊草稿。请核对词义与目标句型，再保存。</p>' : '') +
    '<div class="form-grid">' + inner + '</div>' +
    '<div class="modal-foot">' + btn('取消', 'close-modal') + btn('保存活动', 'save-activity', 'data-id="' + act.id + '"', 'primary') + '</div>');
}

ACTIONS['act-add-pair'] = function () {
  S.editAct.data.pairs.push({ left: '', right: '', emoji: '' });
  drawActivityEditor();
};

ACTIONS['save-activity'] = async function (el) {
  var act = S.editAct;
  var data = clone(act.data);
  if (act.fromWorkshop) {
    try {
      data.pairs = checkedWorkshopPairs(data.pairs, S.lesson.vocab || []);
    } catch (err) {
      return toast(err.message, 'error');
    }
  }
  if (act.kind === 'order') {
    data.tokens = String(data.tokensText || '').split(/[,，]/).map(function (s) { return s.trim(); }).filter(Boolean);
    delete data.tokensText;
  }
  var res = await api('/api/lessons/' + S.lesson.id + '/activities/' + el.getAttribute('data-id'), 'PATCH', { data: data });
  S.lesson = res.lesson;
  closeModal();
  toast('活动已保存', 'ok');
  await render();
};
