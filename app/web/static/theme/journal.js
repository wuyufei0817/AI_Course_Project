/* Fine-pointer light and illustration depth, without layout changes or click interception. */
(function () {
  'use strict';
  var reduce = matchMedia('(prefers-reduced-motion: reduce)');
  var fine = matchMedia('(hover: hover) and (pointer: fine)');
  var frame = 0, current = null, point = null;
  function reset(node) {
    if (!node) return;
    ['--light-x','--light-y','--art-x','--art-y'].forEach(function (key) { node.style.removeProperty(key); });
  }
  document.addEventListener('pointermove', function (event) {
    if (reduce.matches || !fine.matches || event.pointerType === 'touch') return;
    var node = event.target.closest('.journal-heading, .card, .panel, .route-card, .resource-card');
    if (current !== node) { reset(current); current = node; }
    if (!node) return;
    point = { x:event.clientX, y:event.clientY };
    if (frame) return;
    frame = requestAnimationFrame(function () {
      frame = 0;
      if (!current || !current.isConnected || reduce.matches) return;
      var r = current.getBoundingClientRect(), x = point.x-r.left, y = point.y-r.top;
      current.style.setProperty('--light-x', x+'px'); current.style.setProperty('--light-y', y+'px');
      if (current.classList.contains('journal-heading')) {
        current.style.setProperty('--art-x', ((x/r.width-.5)*6)+'px');
        current.style.setProperty('--art-y', ((y/r.height-.5)*4)+'px');
      }
    });
  }, { passive:true });
  document.addEventListener('pointerleave', function () { reset(current); current=null; });
  reduce.addEventListener('change', function () { reset(current); current=null; });
}());
