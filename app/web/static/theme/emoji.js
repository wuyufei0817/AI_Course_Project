/* AI4En · 渲染期 emoji 清理
   完整版（/static/lab）历史内容里仍有 emoji 字符。这里统一在写入 DOM 前替换：
   - 动物 emoji → 本地裁切插画（/static/words/*.webp）
   - 界面 emoji → 线性 SVG 图标
   - 其余 emoji 直接移除，避免系统彩色 emoji 破坏统一视觉。
   只作用于 innerHTML；canvas 绘制由各游戏自行处理。 */
(function () {
  'use strict';
  if (typeof window.ai4enIcon !== 'function') return;

  var IMG = { '🐱': 'cat', '🐶': 'dog', '🐼': 'panda', '🐸': 'frog' };
  var MAP = {
    '🧩': 'puzzle', '🔗': 'link', '🃏': 'cards', '🔨': 'hammer', '🦘': 'jump', '🛵': 'scooter',
    '🏝': 'star', '⭐': 'star', '★': 'star', '▶': 'play', '🔄': 'refresh', '⚙': 'gear', '⚙️': 'gear',
    '💡': 'spark', '✨': 'spark', '🎉': 'spark', '✅': 'check', '🎯': 'target', '📤': 'upload',
    '📘': 'book', '📖': 'book', '📚': 'book', '💬': 'chat', '⬇': 'download', '⬇️': 'download',
    '✏': 'edit', '✏️': 'edit', '🗑': 'trash', '🗑️': 'trash', '🪄': 'wand', '⛶': 'expand', '☰': 'menu',
    '🍔': 'fork', '👕': 'shirt', '🙋': 'user', '🧭': 'compass', '🏥': 'cross', '☀': 'sun', '☀️': 'sun',
    '🏫': 'school', '✈': 'plane', '✈️': 'plane', '📱': 'phone', '🔤': 'cards',
    '▶': 'play', '◀': 'play', '☆': 'star'
  };
  var KEEP = { '✓': 1, '✔': 1, '·': 1, '×': 1 };
  var RE = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{25A0}-\u{25FF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/gu;

  function fill(html) {
    return String(html).replace(RE, function (ch) {
      if (KEEP[ch]) return ch;
      if (IMG[ch]) {
        return '<img class="inline-word-art" src="/static/words/' + IMG[ch] + '.webp" alt="" width="240" height="240" loading="lazy">';
      }
      var name = MAP[ch];
      return name ? window.ai4enIcon(name, 'ico-inline') : '';
    });
  }

  var desc = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
  if (desc && desc.set) {
    Object.defineProperty(Element.prototype, 'innerHTML', {
      configurable: true,
      get: desc.get,
      set: function (value) { desc.set.call(this, fill(value)); }
    });
  }

  /* textContent 走不了 SVG，直接去掉 emoji，避免 toast 等地方露出彩色表情 */
  var td = Object.getOwnPropertyDescriptor(Node.prototype, 'textContent');
  if (td && td.set) {
    Object.defineProperty(Node.prototype, 'textContent', {
      configurable: true,
      get: td.get,
      set: function (value) { td.set.call(this, String(value).replace(RE, '')); }
    });
  }
  window.ai4enDeEmoji = fill;
}());
