/* Decorative illustrations stay outside forms, activities and exported materials. */
(function () {
  'use strict';
  function artwork(key, className) {
    var img = document.createElement('img');
    img.src = '/static/illustrations/' + key + '.webp';
    img.alt = '';
    img.setAttribute('aria-hidden', 'true');
    img.className = 'scene-art ' + (className || '');
    img.width = 1200;
    img.height = 800;
    img.decoding = 'async';
    img.loading = 'lazy';
    img.draggable = false;
    return img;
  }
  function add(parent, key, cls) {
    if (!parent || parent.querySelector('.scene-art')) return;
    parent.appendChild(artwork(key, cls));
  }
  function decorate() {
    var root = document.documentElement;
    if (root.classList.contains('app')) {
      var login = document.querySelector('.login-left');
      if (login && !login.querySelector('.scene-art')) {
        login.insertBefore(artwork('teaching', 'login-art'), login.querySelector('.foot'));
      }
      var state = window.S || {}, route = state.route || [];
      var key = 'atelier';
      if (state.user && state.user.role === 'parent') key = 'garden';
      if (state.user && state.user.role === 'student') key = /tasks|task/.test(route[1] || '') ? 'atelier' : /words|guide/.test(route[1] || '') ? 'library' : 'garden';
      if (route[0] === 'guide' || route[0] === 'studio' || /slides|tasks/.test(route[2] || '')) key = 'library';
      if (route[0] === 'review' || route[2] === 'results') key = 'garden';
      if (route[2] === 'activities') key = 'animals';
      document.querySelectorAll('.page-head').forEach(function (head) {
        head.classList.add('journal-heading');
        head.dataset.scene = key;
        if (!head.querySelector('.journal-art')) head.appendChild(artwork(key, 'journal-art'));
      });
    }
    if (root.classList.contains('classroom')) add(document.querySelector('.intro'), 'animals', 'classroom-art');
    if (root.classList.contains('workshop')) {
      add(document.querySelector('.hero-copy'), 'library', 'workshop-art');
      document.querySelectorAll('.page-heading').forEach(function (head) {
        add(head, /studio|lesson/.test(location.hash) ? 'atelier' : 'library', 'heading-art');
      });
    }
    if (root.classList.contains('lab')) {
      add(document.querySelector('.topbar'), 'teaching', 'heading-art');
      add(document.querySelector('#view > .hero'), 'atelier', 'lab-art');
      var labHead = document.querySelector('.topbar');
      if (labHead) { var art = labHead.querySelector('.scene-art'); if (art) art.src = '/static/illustrations/library.webp'; }
    }
    if (root.classList.contains('defense')) {
      var board = document.querySelector('.cover-grid .word-board');
      if (board && !document.querySelector('.cover-art')) {
        var group = document.createElement('div');
        group.className = 'cover-art';
        board.parentNode.insertBefore(group, board);
        group.appendChild(artwork('animals', 'defense-art'));
        group.appendChild(board);
      }
    }
  }
  var queued = false;
  var observer = new MutationObserver(function (records) {
    // Ignore our own inserts and text/input changes to avoid decoration loops.
    var changed = records.some(function (record) {
      return Array.prototype.some.call(record.addedNodes, function (node) {
        return node.nodeType === 1 && !node.classList.contains('scene-art') && !node.classList.contains('cover-art');
      });
    });
    if (!changed || queued) return;
    queued = true;
    requestAnimationFrame(function () { queued = false; decorate(); });
  });
  decorate();
  observer.observe(document.body, { childList: true, subtree: true });
}());
