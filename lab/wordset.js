/* lab · 词表设置（老师输入的单词与句子，决定 6 个游戏用什么内容）
 * 存储在本机 localStorage；没设置过时自动回落到 data.js 里的示例数据。
 * 每行一条：英文 | 中文
 */
(function () {
  'use strict';

  var LS_KEY = 'ai4en-lab-wordset-v1';

  /* 单词 → 图标，游戏里的卡片/水果用它，保证 banana 就是香蕉 */
  var EMOJI = {
    apple: '🍎', banana: '🍌', orange: '🍊', grape: '🍇', strawberry: '🍓', pear: '🍐',
    peach: '🍑', watermelon: '🍉', pineapple: '🍍', cherry: '🍒', lemon: '🍋', mango: '🥭',
    kiwi: '🥝', coconut: '🥥', tomato: '🍅', blueberry: '🫐', avocado: '🥑', melon: '🍈',
    hamburger: '🍔', sandwich: '🥪', salad: '🥗', 'ice cream': '🍦', juice: '🧃', tea: '🍵',
    cake: '🍰', bread: '🍞', milk: '🥛', water: '💧', egg: '🥚', rice: '🍚', noodles: '🍜',
    cheese: '🧀', pizza: '🍕', cookie: '🍪', candy: '🍬', coffee: '☕', soup: '🍲',
    cat: '🐱', dog: '🐶', panda: '🐼', frog: '🐸', monkey: '🐵', tiger: '🐯', lion: '🦁',
    elephant: '🐘', bird: '🐦', fish: '🐟', rabbit: '🐰', bear: '🐻', duck: '🦆', pig: '🐷',
    horse: '🐴', sheep: '🐑', cow: '🐮', mouse: '🐭', fox: '🦊', wolf: '🐺', koala: '🐨',
    book: '📕', pencil: '✏️', ruler: '📏', bag: '🎒', eraser: '🧽', desk: '🪑',
    ball: '⚽', park: '🏞️', school: '🏫', home: '🏠', bus: '🚌', bike: '🚲', car: '🚗'
  };

  function emojiFor(word) {
    var key = String(word || '').toLowerCase().trim();
    if (EMOJI[key]) return EMOJI[key];
    var hit = Object.keys(EMOJI).filter(function (k) { return key.indexOf(k) >= 0; })[0];
    if (hit) return EMOJI[hit];
    return '';
  }

  function read() {
    try {
      var raw = window.localStorage.getItem(LS_KEY);
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (!data || !Array.isArray(data.words)) return null;
      return {
        words: data.words.filter(function (w) { return w && w.en; }).map(function (w) {
          return { en: String(w.en).trim(), zh: String(w.zh || '').trim() };
        }),
        sentences: (data.sentences || []).filter(Boolean).map(function (s) { return String(s).trim(); })
      };
    } catch (e) { return null; }
  }

  function write(data) {
    try { window.localStorage.setItem(LS_KEY, JSON.stringify(data)); return true; }
    catch (e) { return false; }
  }

  function parseWords(text) {
    var out = [];
    String(text || '').split(/\r?\n/).forEach(function (line) {
      var row = line.trim();
      if (!row || row.charAt(0) === '#') return;
      var parts = row.split(/[|｜\t]/);
      var en = (parts[0] || '').trim();
      var zh = (parts[1] || '').trim();
      if (!en) return;
      out.push({ en: en, zh: zh });
    });
    return out;
  }

  function parseSentences(text) {
    return String(text || '').split(/\r?\n/).map(function (s) { return s.trim(); }).filter(Boolean);
  }

  function wordsText(data) {
    return (data.words || []).map(function (w) { return w.en + ' | ' + w.zh; }).join('\n');
  }

  function sentencesText(data) {
    return (data.sentences || []).join('\n');
  }

  /* 把老师词表拼成 lab 现有游戏要的数据结构 */
  function buildGames(base, data) {
    if (!data || !data.words || !data.words.length) return base;
    var words = data.words;
    var sentences = (data.sentences || []).map(function (s) {
      return { target: s.replace(/[.?!]+$/, ''), hint: '' };
    });
    if (!sentences.length && base && base.sentences) sentences = base.sentences;
    return {
      sentences: sentences,
      pairs: words.map(function (w) { return { en: w.en, cn: w.zh }; }),
      memory: words.map(function (w) { return { en: w.en, zh: w.zh }; }),
      whack: {
        targets: words.map(function (w) { return { cn: w.zh, en: w.en }; }),
        pool: words.map(function (w) { return w.en; })
      }
    };
  }

  var api = {
    key: LS_KEY,
    emojiFor: emojiFor,
    read: read,
    write: write,
    parseWords: parseWords,
    parseSentences: parseSentences,
    wordsText: wordsText,
    sentencesText: sentencesText,
    buildGames: buildGames,
    onChange: null,
    current: function () { return read(); },
    words: function () { var d = read(); return d ? d.words : []; },
    sentences: function () { var d = read(); return d ? d.sentences : []; },
    games: function (base) { var d = read(); return buildGames(base, d); },
    clear: function () {
      try { window.localStorage.removeItem(LS_KEY); } catch (e) { /* 忽略 */ }
      if (api.onChange) api.onChange();
    }
  };

  /* ---------------------------------------------------------------- 设置弹层 */
  var STYLE_ID = 'wd-style';
  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      '.wd-mask{position:fixed;inset:0;background:rgba(18,38,45,.42);z-index:80;display:flex;align-items:center;justify-content:center;padding:18px}',
      '.wd-dialog{background:#fff;border-radius:18px;width:min(860px,96vw);max-height:90vh;overflow:auto;box-shadow:0 24px 60px rgba(12,40,48,.28)}',
      '.wd-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:18px 22px 10px}',
      '.wd-title{font-size:19px;font-weight:700;color:#173f45}',
      '.wd-sub{font-size:13px;color:#6b7f85;margin-top:4px;line-height:1.6}',
      '.wd-body{padding:6px 22px 8px;display:grid;grid-template-columns:1fr 1fr;gap:16px}',
      '.wd-col{display:flex;flex-direction:column;gap:8px}',
      '.wd-label{font-size:13px;font-weight:600;color:#255a60;display:flex;justify-content:space-between}',
      '.wd-count{font-weight:400;color:#7b9198}',
      '.wd-area{width:100%;min-height:230px;resize:vertical;border:1px solid #d6e4e6;border-radius:12px;padding:10px 12px;font:13px/1.7 ui-monospace,Consolas,monospace;color:#173f45;background:#fbfdfd}',
      '.wd-area:focus{outline:none;border-color:#2f9e8f;box-shadow:0 0 0 3px rgba(47,158,143,.12)}',
      '.wd-foot{display:flex;align-items:center;gap:10px;padding:10px 22px 18px;flex-wrap:wrap}',
      '.wd-foot .spacer{flex:1}',
      '.wd-tip{font-size:12px;color:#7b9198}',
      '.wd-err{color:#c0504d;font-size:12px;min-height:16px}',
      '@media (max-width:760px){.wd-body{grid-template-columns:1fr}}'
    ].join('\n');
    document.head.appendChild(style);
  }

  api.openDialog = function (onSaved) {
    ensureStyle();
    var data = read();
    var mask = document.createElement('div');
    mask.className = 'wd-mask';
    mask.innerHTML = [
      '<div class="wd-dialog" role="dialog" aria-modal="true">',
      '<div class="wd-head"><div><div class="wd-title">⚙️ 游戏词表设置</div>',
      '<div class="wd-sub">这里填什么，6 个游戏就用什么。每行一条，单词格式：<code>英文 | 中文</code>；句子一行一句。留空则用内置示例。</div></div>',
      '<button class="btn ghost" data-wd="close">关闭</button></div>',
      '<div class="wd-body">',
      '<div class="wd-col"><label class="wd-label">单词表<span class="wd-count" id="wdWordCount">0 个</span></label>',
      '<textarea class="wd-area" id="wdWords" spellcheck="false" placeholder="apple | 苹果\nbanana | 香蕉\ncat | 猫"></textarea></div>',
      '<div class="wd-col"><label class="wd-label">句子表（连词成句用）<span class="wd-count" id="wdSenCount">0 句</span></label>',
      '<textarea class="wd-area" id="wdSentences" spellcheck="false" placeholder="It is a cat.\nWhat is this?"></textarea></div>',
      '</div>',
      '<div class="wd-foot"><span class="wd-tip" id="wdTip"></span><span class="spacer"></span>',
      '<button class="btn" data-wd="sample">填入示例</button>',
      '<button class="btn" data-wd="clear">恢复内置</button>',
      '<button class="btn primary" data-wd="save">保存并使用</button></div>',
      '<div class="wd-err" id="wdErr" style="padding:0 22px 14px"></div>',
      '</div>'
    ].join('');

    var wordsArea = mask.querySelector('#wdWords');
    var senArea = mask.querySelector('#wdSentences');
    var wordCount = mask.querySelector('#wdWordCount');
    var senCount = mask.querySelector('#wdSenCount');
    wordsArea.value = data ? wordsText(data) : '';
    senArea.value = data ? sentencesText(data) : '';

    function refresh() {
      var n = parseWords(wordsArea.value).length;
      var m = parseSentences(senArea.value).length;
      wordCount.textContent = n + ' 个';
      senCount.textContent = m + ' 句';
      return { n: n, m: m };
    }
    wordsArea.addEventListener('input', refresh);
    senArea.addEventListener('input', refresh);
    refresh();

    function close() { mask.remove(); }
    mask.addEventListener('click', function (e) { if (e.target === mask) close(); });
    mask.querySelector('[data-wd="close"]').addEventListener('click', close);

    mask.querySelector('[data-wd="sample"]').addEventListener('click', function () {
      wordsArea.value = 'apple | 苹果\nbanana | 香蕉\norange | 橘子\ngrape | 葡萄\nstrawberry | 草莓\npear | 梨';
      senArea.value = 'It is an apple.\nI like bananas.';
      refresh();
    });

    mask.querySelector('[data-wd="clear"]').addEventListener('click', function () {
      api.clear();
      toast('已恢复内置示例词表');
      close();
      if (onSaved) onSaved(null);
    });

    mask.querySelector('[data-wd="save"]').addEventListener('click', function () {
      var words = parseWords(wordsArea.value);
      var sentences = parseSentences(senArea.value);
      if (!words.length) {
        mask.querySelector('#wdErr').textContent = '至少写一行单词，格式：英文 | 中文';
        return;
      }
      var bad = words.filter(function (w) { return !w.zh; });
      if (bad.length) {
        mask.querySelector('#wdErr').textContent = '这些词缺中文：' + bad.map(function (w) { return w.en; }).join(', ');
        return;
      }
      var payload = { words: words, sentences: sentences };
      if (!write(payload)) {
        mask.querySelector('#wdErr').textContent = '这个浏览器无法保存到本地，请检查隐私模式设置';
        return;
      }
      close();
      toast('已保存：' + words.length + ' 个词 / ' + sentences.length + ' 句');
      if (api.onChange) api.onChange();
      if (onSaved) onSaved(payload);
    });

    document.body.appendChild(mask);
    wordsArea.focus();
  };

  window.WordSet = api;
})();
