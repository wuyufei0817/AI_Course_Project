/* Visual-only click feedback; native pointer, keyboard and form actions are untouched. */
(function () {
  'use strict';
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  var selector = '.btn, .button, .tab, .stage-bar nav a, .tools button';
  document.addEventListener('click', function (event) {
    if (reduced.matches || !(event.target instanceof Element)) return;
    var target = event.target.closest(selector);
    if (!target || !target.isConnected || target.matches(':disabled, [aria-disabled="true"]') ||
        target.closest('[inert]')) return;
    var rect = target.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    var layer = document.createElement('div');
    layer.className = 'tap-feedback';
    layer.setAttribute('aria-hidden', 'true');
    layer.style.left = rect.left + 'px';
    layer.style.top = rect.top + 'px';
    layer.style.width = rect.width + 'px';
    layer.style.height = rect.height + 'px';
    layer.style.borderRadius = getComputedStyle(target).borderRadius;
    var wave = document.createElement('span');
    wave.className = 'tap-wave';
    var size = Math.hypot(rect.width, rect.height) * 2;
    var x = event.detail ? event.clientX - rect.left : rect.width / 2;
    var y = event.detail ? event.clientY - rect.top : rect.height / 2;
    wave.style.width = wave.style.height = size + 'px';
    wave.style.left = (x - size / 2) + 'px';
    wave.style.top = (y - size / 2) + 'px';
    layer.appendChild(wave);
    document.body.appendChild(layer);
    wave.addEventListener('animationend', function () { layer.remove(); }, { once: true });
    // Cleanup also runs if the page is backgrounded or animation is disabled mid-click.
    setTimeout(function () { layer.remove(); }, 500);
  });
}());
