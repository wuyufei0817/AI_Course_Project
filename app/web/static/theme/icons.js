/* AI4En · 线性图标集（无 emoji）
   用法：ai4enIcon('check') 或 ai4enIcon('check', 'ico-sm')，返回内联 SVG。 */
(function () {
  'use strict';
  var P = {
    spark: '<path d="M12 3.2l1.9 5 5 1.9-4.4 2.8 1 5.3-3.5-2.9-3.5 2.9 1-5.3L5.1 10l5-1.8Z"/>',
    check: '<path d="M4.5 12.5l4.6 4.6L19.5 6.8"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    target: '<circle cx="12" cy="12" r="7.2"/><circle cx="12" cy="12" r="2.6"/>',
    upload: '<path d="M12 16.5V4.8m0 0L7.8 9M12 4.8 16.2 9M4.8 19.2h14.4"/>',
    download: '<path d="M12 4.8v11.7m0 0L7.8 12.3M12 16.5l4.2-4.2M4.8 19.2h14.4"/>',
    book: '<path d="M3.6 5.6A1.6 1.6 0 0 1 5.2 4H9a2.4 2.4 0 0 1 2.4 2.4v12.8A2.4 2.4 0 0 0 9 17.8H4.6a1 1 0 0 1-1-1Z"/><path d="M20.4 5.6A1.6 1.6 0 0 0 18.8 4H15a2.4 2.4 0 0 0-2.4 2.4v12.8A2.4 2.4 0 0 1 15 17.8h4.4a1 1 0 0 0 1-1Z"/>',
    chat: '<path d="M4.4 6.2A1.8 1.8 0 0 1 6.2 4.4h11.6a1.8 1.8 0 0 1 1.8 1.8v7.2a1.8 1.8 0 0 1-1.8 1.8H10l-4.6 4V15.2H6.2a1.8 1.8 0 0 1-1.8-1.8Z"/>',
    edit: '<path d="M4 20l4.6-1L19 8.6 15.4 5 5 15.4Z"/><path d="M13.6 6.8l3.6 3.6"/>',
    trash: '<path d="M4.8 7.2h14.4M9.4 7.2V4.8h5.2v2.4M6.8 7.2 7.9 19.2h8.2l1.1-12"/>',
    wand: '<path d="M5 19 19 5"/><path d="M14.8 4.6l1.8 1.8M18.4 8.2l1.8 1.8M4.6 14.8l1.8 1.8"/>',
    expand: '<path d="M4.4 9.2V4.4h4.8M19.6 9.2V4.4h-4.8M4.4 14.8v4.8h4.8M19.6 14.8v4.8h-4.8"/>',
    menu: '<path d="M4.4 7h15.2M4.4 12h15.2M4.4 17h15.2"/>',
    puzzle: '<path d="M4.6 6.2A1.6 1.6 0 0 1 6.2 4.6h3.1a1.9 1.9 0 1 1 3.8 0h3.1a1.6 1.6 0 0 1 1.6 1.6v3.1a1.9 1.9 0 1 1 0 3.8v3.1a1.6 1.6 0 0 1-1.6 1.6H4.6Z"/>',
    link: '<path d="M9.6 14.4 14.4 9.6"/><path d="M11.4 7.2l1.6-1.6a3.4 3.4 0 0 1 4.8 4.8l-1.6 1.6"/><path d="M12.6 16.8 11 18.4a3.4 3.4 0 0 1-4.8-4.8l1.6-1.6"/>',
    cards: '<rect x="3.6" y="5.6" width="9.2" height="12" rx="1.6"/><path d="m14.6 7 3.4 1-2.6 9.8-3.4-1"/>',
    hammer: '<path d="M13.6 4.4l6 6-2.4 2.4-6-6Z"/><path d="M11.2 9.2 4.8 15.6a2 2 0 0 0 2.8 2.8l6.4-6.4"/>',
    jump: '<path d="M4.8 16.8h14.4"/><path d="M12 4.8v8m0-8-3 3m3-3 3 3"/>',
    scooter: '<circle cx="6.6" cy="17" r="2.4"/><circle cx="17.4" cy="17" r="2.4"/><path d="M9 17h5.8M4.4 12.4h4.2L12 7h2.6l2.4 10"/>',
    play: '<path d="M8 5.6 18 12 8 18.4Z"/>',
    star: '<path d="m12 4 2.4 5.2 5.6.6-4.2 3.8 1.2 5.4-5-2.9-5 2.9 1.2-5.4L4 9.8l5.6-.6Z"/>',
    clock: '<circle cx="12" cy="12" r="7.6"/><path d="M12 7.8V12l3 2"/>',
    users: '<circle cx="9" cy="8.6" r="3"/><path d="M3.8 18.8c.5-3 2.6-4.6 5.2-4.6s4.7 1.6 5.2 4.6"/><path d="M15.4 6.4a3 3 0 0 1 0 5.6M16.6 14.6c2.1.4 3.4 1.9 3.8 4.2"/>',
    chart: '<path d="M4.4 19.2h15.2"/><rect x="5.8" y="11" width="3" height="6.4" rx=".8"/><rect x="10.5" y="7" width="3" height="10.4" rx=".8"/><rect x="15.2" y="9.4" width="3" height="8" rx=".8"/>',
    mic: '<rect x="9.2" y="4" width="5.6" height="10" rx="2.8"/><path d="M5.8 11.6a6.2 6.2 0 0 0 12.4 0M12 17.8V20"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    refresh: '<path d="M4.8 12a7.2 7.2 0 0 1 12.3-5.1L20 9.6"/><path d="M20 4.8v4.8h-4.8"/><path d="M19.2 12a7.2 7.2 0 0 1-12.3 5.1L4 14.4"/><path d="M4 19.2v-4.8h4.8"/>',
    home: '<path d="M4 10.4 12 4l8 6.4V19a1 1 0 0 1-1 1h-5v-5.4H10V20H5a1 1 0 0 1-1-1Z"/>',
    game: '<rect x="3.4" y="7.4" width="17.2" height="9.6" rx="4.6"/><path d="M8 10.6v3.2M6.4 12.2h3.2M15 11.4h.1M17 13.4h.1"/>',
    fork: '<path d="M7 3.5v7a2 2 0 0 0 4 0v-7M9 10.5V20.5"/><path d="M16.5 3.5c1.6 1 2.5 2.6 2.5 4.5 0 1.6-.9 2.6-2.5 3v9.5"/>',
    shirt: '<path d="M8.5 4 4 6.6l1.6 3.2 2-.9v8.6a1 1 0 0 0 1 1h6.8a1 1 0 0 0 1-1V8.9l2 .9L20 6.6 15.5 4a3.5 3.5 0 0 1-7 0Z"/>',
    compass: '<circle cx="12" cy="12" r="7.6"/><path d="m14.8 9.2-1.7 4.1-4.1 1.7 1.7-4.1Z"/>',
    cross: '<rect x="4.4" y="4.4" width="15.2" height="15.2" rx="3.2"/><path d="M12 8.4v7.2M8.4 12h7.2"/>',
    sun: '<circle cx="12" cy="12" r="3.8"/><path d="M12 3.6v2M12 18.4v2M3.6 12h2M18.4 12h2M6 6l1.4 1.4M16.6 16.6 18 18M18 6l-1.4 1.4M7.4 16.6 6 18"/>',
    school: '<path d="M4 20V10.4L12 4l8 6.4V20"/><path d="M9.4 20v-5.2h5.2V20"/>',
    plane: '<path d="M3.6 13.2 20.4 4l-4.2 16-4.4-6.2Z"/><path d="m11.8 13.8 8.6-9.8"/>',
    phone: '<rect x="6.6" y="3.4" width="10.8" height="17.2" rx="2.4"/><path d="M10.8 17.6h2.4"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3.4v2.2M12 18.4v2.2M4.6 12h2.2M17.2 12h2.2M6.8 6.8l1.6 1.6M15.6 15.6l1.6 1.6M17.2 6.8l-1.6 1.6M8.4 15.6l-1.6 1.6"/>'
  };
  window.ai4enIcon = function (name, cls, size) {
    var path = P[name] || P.star;
    var s = size || 18;
    return '<svg class="ico-svg ' + (cls || '') + '" viewBox="0 0 24 24" width="' + s + '" height="' + s +
      '" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      path + '</svg>';
  };
}());
