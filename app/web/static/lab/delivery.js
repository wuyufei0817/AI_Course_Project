/* AI4En · 单词快递员
 * 玩法：在草地与小路上找齐 3 个目标单词，送回 SHOP，共 3 关。
 * 目标词与干扰词都取自「⚙️ 词表设置」，换一份词表就换一套内容。
 * 逻辑与渲染分离：dlvUpdate 只改状态，dlvRender 才碰 canvas，便于在 Node 里跑自检。
 */
'use strict';

var DLV_COLS = 22;
var DLV_ROWS = 13;
var DLV_NEED = 3;
var DLV_LEVELS = 3;
var DLV_SPEED = 4.0;
var DLV_GHOST_SPEED = 1.9;
var DLV_LEVEL_TIME = 90;

/* 配色取自参考图：浅绿草地 + 米色小路 + 灰绿树篱 + 奶油色小店 */
var DLV_COLORS = {
  grassLight: '#cfe4b6',
  grassDark: '#c6ddac',
  tuft: 'rgba(255,255,255,.38)',
  road: '#efe3c5',
  hedge: '#6f9f78',
  hedgeDot: '#e9d9a3',
  shopBase: '#f3e6c8',
  awning: '#e08a72',
  awningLight: '#fdf6e3',
  shopText: '#2f6b52',
  star: '#f2d98b',
  starStroke: '#e6c469',
  ghost: '#b3a4dc',
  ghostEye: '#ffffff',
  ghostPupil: '#3a3352',
  labelText: '#4a5a52',
  labelBg: 'rgba(255,255,255,.95)',
  fruitLeaf: '#6f9f78',
  fruitStem: '#8a6a44'
};

/* ---------------------------------------------------------------- 随机数与地图 */
function dlvRng(seed) {
  var t = (seed || 1) >>> 0;
  return function () {
    t += 0x6D2B79F5;
    var r = t;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function dlvFloor(grid, x, y) {
  var cx = Math.floor(x);
  var cy = Math.floor(y);
  if (!isFinite(cx) || !isFinite(cy)) return false;
  if (cy < 0 || cy >= grid.length) return false;
  if (cx < 0 || cx >= grid[0].length) return false;
  return grid[cy][cx] === 0;
}

function dlvConnected(grid) {
  var rows = grid.length, cols = grid[0].length;
  var total = 0, start = null;
  for (var y = 0; y < rows; y++) {
    for (var x = 0; x < cols; x++) {
      if (grid[y][x] === 0) { total++; if (!start) start = { x: x, y: y }; }
    }
  }
  if (!start) return false;
  var seen = {};
  var queue = [start];
  var count = 0;
  seen[start.y + ':' + start.x] = 1;
  while (queue.length) {
    var cur = queue.shift();
    count++;
    var dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (var i = 0; i < dirs.length; i++) {
      var nx = cur.x + dirs[i][0], ny = cur.y + dirs[i][1];
      if (!dlvFloor(grid, nx, ny)) continue;
      var key = ny + ':' + nx;
      if (seen[key]) continue;
      seen[key] = 1;
      queue.push({ x: nx, y: ny });
    }
  }
  return count === total;
}

function dlvGenMap(rng) {
  var grid = [];
  for (var y = 0; y < DLV_ROWS; y++) {
    var row = [];
    for (var x = 0; x < DLV_COLS; x++) row.push(1);
    grid.push(row);
  }

  /* 0 = 小路（可走），1 = 草地（不可走），2 = 树篱（草地上的装饰） */
  var roads = [];
  var shop = { x: 1, y: DLV_ROWS - 4, w: 3, h: 2 };

  /* 底部横向小路 + 中间纵向小路，保证全图连通 */
  roads.push({ x: 1, y: DLV_ROWS - 4, w: DLV_COLS - 2, h: 2 });
  var centerX = Math.floor(DLV_COLS / 2) - 1;
  roads.push({ x: centerX, y: 1, w: 2, h: DLV_ROWS - 2 });

  /* 上半区再补一条横向小路，留出整片草地方便放树篱岛 */
  if (rng() < 0.85) {
    var hy = 2 + Math.floor(rng() * 2);
    roads.push({ x: 1, y: hy, w: DLV_COLS - 2, h: 2 });
  }

  /* 1–2 条纵向小路 */
  var extraV = rng() < 0.6 ? 2 : 1;
  for (var j = 0; j < extraV; j++) {
    var vx = 3 + Math.floor(rng() * (DLV_COLS - 8));
    var vw = 2;
    if (Math.abs(vx - centerX) < 6) continue;
    roads.push({ x: vx, y: 1, w: vw, h: DLV_ROWS - 2 });
  }

  roads.forEach(function (road) {
    for (var yy = road.y; yy < road.y + road.h; yy++) {
      for (var xx = road.x; xx < road.x + road.w; xx++) {
        if (yy > 0 && yy < DLV_ROWS - 1 && xx > 0 && xx < DLV_COLS - 1) grid[yy][xx] = 0;
      }
    }
  });

  /* 树篱只铺在纯草地上，不压小路 */
  var blocks = [];
  var attempts = 0;
  while (blocks.length < 7 && attempts < 160) {
    attempts++;
    var bw = 2 + Math.floor(rng() * 3);
    var bh = 2;
    var bx = 2 + Math.floor(rng() * (DLV_COLS - bw - 4));
    var by = 2 + Math.floor(rng() * (DLV_ROWS - bh - 4));
    var free = true;
    for (var sy = by; sy < by + bh && free; sy++) {
      for (var sx = bx; sx < bx + bw && free; sx++) {
        if (grid[sy][sx] !== 1) free = false;
      }
    }
    if (!free) continue;
    blocks.push({ x: bx, y: by, w: bw, h: bh });
    for (var sy2 = by; sy2 < by + bh; sy2++) {
      for (var sx2 = bx; sx2 < bx + bw; sx2++) grid[sy2][sx2] = 2;
    }
  }

  var spawn = { x: centerX + 1, y: Math.floor(DLV_ROWS / 2) };
  return { grid: grid, roads: roads, blocks: blocks, shop: shop, spawn: spawn };
}

function dlvFreeSpots(map, rng, count, minDistFromSpawn, exclude) {
  var grid = map.grid;
  var spots = [];
  var used = {};
  (exclude || []).forEach(function (p) { used[Math.floor(p.y) + ':' + Math.floor(p.x)] = 1; });
  used[map.spawn.y + ':' + map.spawn.x] = 1;
  for (var sy = map.shop.y; sy < map.shop.y + map.shop.h; sy++) {
    for (var sx = map.shop.x; sx < map.shop.x + map.shop.w; sx++) used[sy + ':' + sx] = 1;
  }
  var candidates = [];
  for (var yy = 1; yy < DLV_ROWS - 1; yy++) {
    for (var xx = 1; xx < DLV_COLS - 1; xx++) {
      if (!dlvFloor(grid, xx, yy)) continue;
      if (used[yy + ':' + xx]) continue;
      var d = Math.sqrt(Math.pow(xx - map.spawn.x, 2) + Math.pow(yy - map.spawn.y, 2));
      if (d < (minDistFromSpawn || 0)) continue;
      candidates.push({ x: xx, y: yy });
    }
  }
  for (var i = candidates.length - 1; i > 0; i--) {
    var j = Math.floor(rng() * (i + 1));
    var t = candidates[i]; candidates[i] = candidates[j]; candidates[j] = t;
  }
  for (var k = 0; k < candidates.length && spots.length < count; k++) {
    var c = candidates[k];
    var key = c.y + ':' + c.x;
    if (used[key]) continue;
    used[key] = 1;
    spots.push(c);
  }
  return spots;
}

/* ---------------------------------------------------------------- 状态 */
function dlvPickWords(corpus) {
  var words = (corpus.words || []).slice();
  var filtered = [];
  var seen = {};
  words.forEach(function (w) {
    var key = String(w).toLowerCase();
    if (!key || seen[key]) return;
    seen[key] = 1;
    filtered.push(String(w));
  });
  return filtered;
}

function dlvMeaningOf(corpus, word) {
  var key = String(word).toLowerCase();
  var hit = (corpus.gloss || []).filter(function (g) { return g.left.toLowerCase() === key; })[0];
  return hit ? hit.right : '';
}

function dlvColorOf(word) {
  var palette = ['#e2725b', '#e56b7f', '#f0c76a', '#9a80c2', '#ef9b52', '#bcd06a', '#7fb9a8', '#dd8fb0'];
  var hash = 0;
  var text = String(word || '');
  for (var i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) % 997;
  return palette[hash % palette.length];
}

/* 单词 → 图标：优先用词表模块的表，独立运行时用内置小表兜底 */
var DLV_EMOJI = {
  apple: '🍎', banana: '🍌', orange: '🍊', grape: '🍇', strawberry: '🍓', pear: '🍐',
  peach: '🍑', watermelon: '🍉', pineapple: '🍍', cherry: '🍒', lemon: '🍋', mango: '🥭',
  cat: '🐱', dog: '🐶', panda: '🐼', frog: '🐸', monkey: '🐵', tiger: '🐯', lion: '🦁',
  bird: '🐦', fish: '🐟', rabbit: '🐰', bear: '🐻', duck: '🦆', pig: '🐷',
  hamburger: '🍔', sandwich: '🥪', salad: '🥗', 'ice cream': '🍦', juice: '🧃', tea: '🍵'
};

function dlvEmojiFor() {
  /* 不使用 emoji：统一绘制带首字母的水果，避免系统彩色表情破坏视觉。 */
  return '';
}

function dlvNewState(corpus) {
  var words = dlvPickWords(corpus);
  var state = {
    corpus: corpus,
    words: words,
    targetQueue: dlvShuffleWords(words).slice(0, Math.min(DLV_LEVELS, words.length)),
    levelIdx: 0,
    total: Math.min(DLV_LEVELS, words.length),
    score: 0,
    lives: 3,
    time: DLV_LEVEL_TIME,
    timeMax: DLV_LEVEL_TIME,
    need: DLV_NEED,
    collected: 0,
    phase: 'play',
    wait: 0,
    msg: '',
    msgKind: '',
    invuln: 0,
    input: { up: false, down: false, left: false, right: false }
  };
  return state;
}

function dlvShuffleWords(list) {
  var arr = list.slice();
  for (var i = arr.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
  }
  return arr;
}

function dlvStartLevel(state, levelIdx, seed) {
  var rng = dlvRng((seed || Date.now()) + levelIdx * 7919);
  state.rng = rng;
  state.levelIdx = levelIdx;
  state.phase = 'play';
  state.wait = 0;
  state.collected = 0;
  state.time = state.timeMax;
  state.invuln = 0;
  state.msg = 'Collect 3 ' + state.targetQueue[levelIdx] + ' and bring them to the SHOP';
  state.msgKind = '';

  var map = dlvGenMap(rng);
  state.grid = map.grid;
  state.roads = map.roads;
  state.blocks = map.blocks;
  state.shop = map.shop;
  state.spawn = map.spawn;
  state.player = { x: map.spawn.x + 0.5, y: map.spawn.y + 0.5, dir: { x: 0, y: 0 } };

  var target = state.targetQueue[levelIdx];
  var others = state.words.filter(function (w) { return w.toLowerCase() !== String(target).toLowerCase(); });
  var spots = dlvFreeSpots(map, rng, 9, 2);
  var fruits = [];
  var i;
  for (i = 0; i < spots.length && fruits.length < 3; i++) {
    fruits.push({ x: spots[i].x + 0.5, y: spots[i].y + 0.5, word: target, meaning: dlvMeaningOf(state.corpus, target), color: dlvColorOf(target), alive: true });
  }
  var pool = dlvShuffleWords(others);
  for (var k = 0; i < spots.length && k < pool.length; i++, k++) {
    var word = pool[k % pool.length];
    fruits.push({ x: spots[i].x + 0.5, y: spots[i].y + 0.5, word: word, meaning: dlvMeaningOf(state.corpus, word), color: dlvColorOf(word), alive: true });
  }
  state.fruits = fruits;

  var ghostSpots = dlvFreeSpots(map, rng, 3, 5);
  state.ghosts = ghostSpots.map(function (spot) {
    return {
      x: spot.x + 0.5, y: spot.y + 0.5, dir: { x: 0, y: 0 },
      timer: 0.2 + rng() * 0.8, speed: DLV_GHOST_SPEED
    };
  });

  var starSpots = dlvFreeSpots(map, rng, 3, 3);
  state.stars = starSpots.map(function (spot) {
    return { x: spot.x + 0.5, y: spot.y + 0.5, alive: true };
  });

  return state;
}

/* ---------------------------------------------------------------- 物理 */
function dlvBlockedCircle(grid, x, y, radius) {
  return dlvFloor(grid, x, y) === false ||
    dlvFloor(grid, x - radius + 0.001, y - radius + 0.001) === false ||
    dlvFloor(grid, x + radius - 0.001, y - radius + 0.001) === false ||
    dlvFloor(grid, x - radius + 0.001, y + radius - 0.001) === false ||
    dlvFloor(grid, x + radius - 0.001, y + radius - 0.001) === false;
}

function dlvMoveEntity(grid, ent, dx, dy, radius) {
  var r = radius === undefined ? 0.30 : radius;
  var nx = ent.x + dx;
  if (!dlvBlockedCircle(grid, nx, ent.y, r)) ent.x = nx;
  var ny = ent.y + dy;
  if (!dlvBlockedCircle(grid, ent.x, ny, r)) ent.y = ny;
}

function dlvPickGhostDir(state, ghost) {
  var grid = state.grid;
  var gx = Math.floor(ghost.x);
  var gy = Math.floor(ghost.y);
  var dirs = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];
  var open = dirs.filter(function (d) { return dlvFloor(grid, gx + d.x, gy + d.y); });
  if (!open.length) return ghost.dir;
  var forward = open.filter(function (d) { return !(d.x === -ghost.dir.x && d.y === -ghost.dir.y); });
  var pool = forward.length ? forward : open;
  if (state.rng && state.rng() < 0.45) {
    var target = state.player;
    pool.sort(function (a, b) {
      var da = Math.abs(gx + a.x - target.x) + Math.abs(gy + a.y - target.y);
      var db = Math.abs(gx + b.x - target.x) + Math.abs(gy + b.y - target.y);
      return da - db;
    });
    return pool[0];
  }
  return pool[Math.floor((state.rng ? state.rng() : Math.random()) * pool.length)];
}

function dlvDist(a, b) {
  return Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2));
}

function dlvInShop(state, point) {
  var s = state.shop;
  return point.x >= s.x && point.x <= s.x + s.w && point.y >= s.y && point.y <= s.y + s.h;
}

/* ---------------------------------------------------------------- 状态机 */
function dlvReport(state) {
  if (!state || state.reported) return;
  state.reported = true;
  if (typeof state.onFinish !== 'function') return;
  var points = Math.max(0, Math.round(state.score / 10));
  var stars = state.phase === 'win' ? 3 : (state.score >= 500 ? 2 : 1);
  try {
    state.onFinish({ points: points, stars: stars, score: state.score, phase: state.phase });
  } catch (e) { /* 回调出错不影响游戏 */ }
}

function dlvNextLevel(state) {
  if (state.levelIdx + 1 >= state.total) {
    state.phase = 'win';
    state.msg = 'All levels cleared! Score ' + state.score;
    state.msgKind = 'ok';
    dlvReport(state);
    return;
  }
  dlvStartLevel(state, state.levelIdx + 1, Date.now());
}

function dlvRetryLevel(state) {
  if (state.lives <= 0) {
    state.phase = 'over';
    state.msg = 'Game over · Score ' + state.score;
    state.msgKind = 'bad';
    dlvReport(state);
    return;
  }
  dlvStartLevel(state, state.levelIdx, Date.now());
}

function dlvUpdate(state, dt) {
  if (!state) return state;
  dt = Math.max(0, Math.min(dt, 0.06));

  if (state.phase === 'levelclear') {
    state.wait -= dt;
    if (state.wait <= 0) dlvNextLevel(state);
    return state;
  }
  if (state.phase === 'timeout') {
    state.wait -= dt;
    if (state.wait <= 0) { state.lives--; dlvRetryLevel(state); }
    return state;
  }
  if (state.phase !== 'play') return state;

  state.time -= dt;
  if (state.time <= 0) {
    state.time = 0;
    state.phase = 'timeout';
    state.wait = 1.6;
    state.msg = 'Time is up — try this level again';
    state.msgKind = 'bad';
    return state;
  }
  if (state.invuln > 0) state.invuln -= dt;

  var input = state.input || {};
  var dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  var dy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  if (dx && dy) { dx *= 0.7071; dy *= 0.7071; }
  if (dx || dy) {
    state.player.dir = { x: dx, y: dy };
    dlvMoveEntity(state.grid, state.player, dx * DLV_SPEED * dt, dy * DLV_SPEED * dt, 0.30);
  }

  var grid = state.grid;
  state.ghosts.forEach(function (ghost) {
    ghost.timer -= dt;
    var gx = Math.floor(ghost.x);
    var gy = Math.floor(ghost.y);
    var centered = Math.abs(ghost.x - (gx + 0.5)) < 0.12 && Math.abs(ghost.y - (gy + 0.5)) < 0.12;
    var ahead = dlvFloor(grid, gx + ghost.dir.x, gy + ghost.dir.y);
    if (centered && (ghost.timer <= 0 || !ahead)) {
      var next = dlvPickGhostDir(state, ghost);
      if (next) ghost.dir = next;
      /* 只在换方向的瞬间对齐格心，避免每帧吸附导致原地抖动 */
      ghost.x = gx + 0.5;
      ghost.y = gy + 0.5;
      ghost.timer = 0.9 + (state.rng ? state.rng() : Math.random()) * 1.1;
    }
    dlvMoveEntity(grid, ghost, ghost.dir.x * ghost.speed * dt, ghost.dir.y * ghost.speed * dt, 0.28);
  });

  state.fruits.forEach(function (fruit) {
    if (!fruit.alive) return;
    if (dlvDist(state.player, fruit) > 0.55) return;
    if (fruit.word.toLowerCase() === String(state.targetQueue[state.levelIdx]).toLowerCase()) {
      fruit.alive = false;
      state.collected++;
      state.score += 50;
      if (state.collected >= state.need) {
        state.msg = 'All collected! Go to the SHOP';
        state.msgKind = 'ok';
      } else {
        state.msg = 'Found ' + fruit.word + '! ' + state.collected + '/' + state.need;
        state.msgKind = 'ok';
      }
    } else {
      state.time = Math.max(0, state.time - 3);
      state.msg = 'That is ' + fruit.word + ', not ' + state.targetQueue[state.levelIdx] + '  (−3s)';
      state.msgKind = 'bad';
    }
  });

  state.stars.forEach(function (star) {
    if (!star.alive) return;
    if (dlvDist(state.player, star) > 0.5) return;
    star.alive = false;
    state.score += 10;
  });

  state.ghosts.forEach(function (ghost) {
    if (state.invuln > 0) return;
    if (dlvDist(state.player, ghost) > 0.55) return;
    state.lives--;
    state.invuln = 2;
    state.player.x = state.spawn.x + 0.5;
    state.player.y = state.spawn.y + 0.5;
    state.msg = 'A ghost got you! −1 life';
    state.msgKind = 'bad';
    if (state.lives <= 0) {
      state.phase = 'over';
      state.msg = 'Game over · Score ' + state.score;
      dlvReport(state);
    }
  });

  if (state.collected >= state.need && dlvInShop(state, state.player)) {
    state.score += 100;
    state.phase = 'levelclear';
    state.wait = 1.5;
    state.msg = 'Delivered! +100';
    state.msgKind = 'ok';
  }

  return state;
}

/* ---------------------------------------------------------------- 渲染 */
function dlvRoundRect(ctx, x, y, w, h, r) {
  var radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function dlvTileXY(state, tx, ty) {
  return { x: state.ox + tx * state.tile, y: state.oy + ty * state.tile };
}

function dlvDrawMap(state, ctx) {
  var tile = state.tile;
  var colors = DLV_COLORS;
  var x, y, p;

  for (y = 0; y < DLV_ROWS; y++) {
    for (x = 0; x < DLV_COLS; x++) {
      p = dlvTileXY(state, x, y);
      var light = (x + y) % 2 === 0;
      ctx.fillStyle = light ? colors.grassLight : colors.grassDark;
      ctx.fillRect(p.x, p.y, tile + 1, tile + 1);
      if (!light && (x * 31 + y * 17) % 5 === 0) {
        ctx.strokeStyle = colors.tuft;
        ctx.lineWidth = Math.max(1, tile * 0.035);
        ctx.beginPath();
        ctx.moveTo(p.x + tile * 0.46, p.y + tile * 0.64);
        ctx.lineTo(p.x + tile * 0.38, p.y + tile * 0.46);
        ctx.moveTo(p.x + tile * 0.46, p.y + tile * 0.64);
        ctx.lineTo(p.x + tile * 0.54, p.y + tile * 0.46);
        ctx.stroke();
      }
    }
  }

  /* 米色小路：整条路一次画完，两端带圆角 */
  (state.roads || []).forEach(function (road) {
    var p0 = dlvTileXY(state, road.x, road.y);
    ctx.fillStyle = colors.road;
    dlvRoundRect(ctx, p0.x, p0.y, road.w * tile, road.h * tile, tile * 0.9);
    ctx.fill();
  });

  /* 树篱岛：圆角深绿块 + 浅色圆点 */
  (state.blocks || []).forEach(function (block) {
    var p1 = dlvTileXY(state, block.x, block.y);
    ctx.fillStyle = colors.hedge;
    dlvRoundRect(ctx, p1.x + tile * 0.06, p1.y + tile * 0.06,
      block.w * tile - tile * 0.12, block.h * tile - tile * 0.12, tile * 0.5);
    ctx.fill();
    ctx.fillStyle = colors.hedgeDot;
    for (var i = 0; i < block.w; i++) {
      for (var j = 0; j < block.h; j++) {
        for (var k = 0; k < 4; k++) {
          ctx.beginPath();
          ctx.arc(p1.x + tile * (i + (k % 2 ? 0.7 : 0.3)), p1.y + tile * (j + (k > 1 ? 0.7 : 0.3)),
            tile * 0.085, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  });
}

function dlvDrawShop(state, ctx) {
  var tile = state.tile;
  var colors = DLV_COLORS;
  var s = state.shop;
  var p = dlvTileXY(state, s.x, s.y);
  var w = tile * s.w;
  var h = tile * s.h;
  ctx.fillStyle = colors.shopBase;
  dlvRoundRect(ctx, p.x, p.y, w, h, tile * 0.22);
  ctx.fill();
  dlvRoundRect(ctx, p.x, p.y, w, tile * 0.52, tile * 0.22);
  ctx.fillStyle = colors.awningLight;
  ctx.fill();
  var inset = tile * 0.22;
  var count = s.w * 4;
  var stripeW = (w - inset * 2) / count;
  for (var i = 0; i < count; i++) {
    ctx.fillStyle = i % 2 === 0 ? colors.awning : colors.awningLight;
    ctx.fillRect(p.x + inset + stripeW * i, p.y + tile * 0.05, stripeW, tile * 0.36);
  }
  ctx.fillStyle = colors.shopText;
  ctx.font = 'bold ' + Math.round(tile * 0.34) + 'px "Trebuchet MS","Segoe UI",sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('SHOP', p.x + w / 2, p.y + h * 0.63);
  ctx.font = Math.round(tile * 0.19) + 'px "Trebuchet MS","Segoe UI",sans-serif';
  ctx.fillText('Deliver here', p.x + w / 2, p.y + h * 0.87);
}

function dlvDrawFruit(state, ctx, fruit) {
  var tile = state.tile;
  var colors = DLV_COLORS;
  var p = { x: state.ox + fruit.x * tile, y: state.oy + fruit.y * tile };
  var emoji = dlvEmojiFor(fruit.word);

  if (emoji) {
    /* 单词对应什么就画什么：banana 画香蕉，apple 画苹果 */
    ctx.save();
    ctx.font = Math.round(tile * 0.62) + 'px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emoji, p.x, p.y - tile * 0.04);
    ctx.restore();
  } else {
    /* 词表里没有对应图标时，退化成一颗写着首字母的果子 */
    var r = tile * 0.26;
    ctx.fillStyle = fruit.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y - tile * 0.03, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = colors.fruitLeaf;
    ctx.beginPath();
    ctx.ellipse(p.x + r * 0.5, p.y - r * 1.05, r * 0.55, r * 0.28, -0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold ' + Math.round(tile * 0.26) + 'px "Trebuchet MS","Segoe UI",sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(fruit.word || '?').charAt(0).toUpperCase(), p.x, p.y - tile * 0.03);
  }

  var label = fruit.word;
  ctx.font = 'bold ' + Math.round(tile * 0.22) + 'px "Trebuchet MS","Segoe UI",sans-serif';
  var textW = ctx.measureText(label).width;
  var boxW = Math.max(textW + tile * 0.2, tile * 0.5);
  var boxH = tile * 0.34;
  var boxX = p.x - boxW / 2;
  var boxY = p.y + tile * 0.24;
  ctx.fillStyle = colors.labelBg;
  dlvRoundRect(ctx, boxX, boxY, boxW, boxH, boxH * 0.35);
  ctx.fill();
  ctx.fillStyle = colors.labelText;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, p.x, boxY + boxH / 2 + 1);
}

function dlvDrawStar(state, ctx, star) {
  var tile = state.tile;
  var colors = DLV_COLORS;
  var cx = state.ox + star.x * tile;
  var cy = state.oy + star.y * tile;
  var outer = tile * 0.19;
  var inner = outer * 0.45;
  ctx.beginPath();
  for (var i = 0; i < 10; i++) {
    var angle = (Math.PI / 5) * i - Math.PI / 2;
    var radius = i % 2 === 0 ? outer : inner;
    var px = cx + Math.cos(angle) * radius;
    var py = cy + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = colors.star;
  ctx.fill();
  ctx.strokeStyle = colors.starStroke;
  ctx.lineWidth = Math.max(1, tile * 0.028);
  ctx.stroke();
}

function dlvDrawGhost(state, ctx, ghost) {
  var tile = state.tile;
  var colors = DLV_COLORS;
  var cx = state.ox + ghost.x * tile;
  var cy = state.oy + ghost.y * tile;
  var r = tile * 0.26;
  ctx.fillStyle = colors.ghost;
  ctx.beginPath();
  ctx.arc(cx, cy - r * 0.15, r, Math.PI, 0);
  ctx.lineTo(cx + r, cy + r * 0.75);
  for (var i = 0; i < 3; i++) {
    ctx.quadraticCurveTo(cx + r - (r / 3) * (i + 0.5), cy + r * 0.35, cx + r - (r / 3) * (i + 1), cy + r * 0.75);
  }
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = colors.ghostEye;
  ctx.beginPath();
  ctx.arc(cx - r * 0.35, cy - r * 0.2, r * 0.27, 0, Math.PI * 2);
  ctx.arc(cx + r * 0.35, cy - r * 0.2, r * 0.27, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = colors.ghostPupil;
  ctx.beginPath();
  ctx.arc(cx - r * 0.30, cy - r * 0.2, r * 0.12, 0, Math.PI * 2);
  ctx.arc(cx + r * 0.40, cy - r * 0.2, r * 0.12, 0, Math.PI * 2);
  ctx.fill();
}

function dlvDrawPlayer(state, ctx) {
  var tile = state.tile;
  var player = state.player;
  var cx = state.ox + player.x * tile;
  var cy = state.oy + player.y * tile;
  if (state.invuln > 0 && Math.floor(state.invuln * 10) % 2 === 0) return;
  var r = tile * 0.30;
  ctx.fillStyle = 'rgba(0,0,0,.10)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + r * 1.10, r * 0.95, r * 0.35, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#3f5d75';
  dlvRoundRect(ctx, cx - r * 0.52, cy + r * 0.42, r * 0.40, r * 0.55, r * 0.14);
  ctx.fill();
  dlvRoundRect(ctx, cx + r * 0.12, cy + r * 0.42, r * 0.40, r * 0.55, r * 0.14);
  ctx.fill();
  ctx.fillStyle = '#f0a05a';
  dlvRoundRect(ctx, cx - r * 0.55, cy - r * 0.18, r * 1.1, r * 0.78, r * 0.28);
  ctx.fill();
  ctx.fillStyle = '#c0754a';
  dlvRoundRect(ctx, cx - r * 0.78, cy - r * 0.10, r * 0.36, r * 0.60, r * 0.14);
  ctx.fill();
  ctx.fillStyle = '#f5d6b8';
  ctx.beginPath();
  ctx.arc(cx, cy - r * 0.62, r * 0.66, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#3f7d8c';
  ctx.beginPath();
  ctx.arc(cx, cy - r * 0.78, r * 0.72, Math.PI, 0);
  ctx.fill();
  ctx.fillRect(cx - r * 0.92, cy - r * 0.80, r * 1.84, r * 0.20);
  ctx.fillStyle = '#2f3a52';
  ctx.beginPath();
  ctx.arc(cx - r * 0.22, cy - r * 0.52, r * 0.09, 0, Math.PI * 2);
  ctx.arc(cx + r * 0.22, cy - r * 0.52, r * 0.09, 0, Math.PI * 2);
  ctx.fill();
}

function dlvRender(state) {
  var ctx = state.ctx;
  if (!ctx) return;
  var w = state.viewW || 0;
  var h = state.viewH || 0;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#8fbf72';
  ctx.fillRect(0, 0, w, h);
  dlvDrawMap(state, ctx);
  dlvDrawShop(state, ctx);
  state.stars.forEach(function (star) { if (star.alive) dlvDrawStar(state, ctx, star); });
  state.fruits.forEach(function (fruit) { if (fruit.alive) dlvDrawFruit(state, ctx, fruit); });
  state.ghosts.forEach(function (ghost) { dlvDrawGhost(state, ctx, ghost); });
  dlvDrawPlayer(state, ctx);
}

/* ---------------------------------------------------------------- 界面 */
var DLV_HUD = null;

function dlvHudHtml() {
  return '<div class="dlv-hud">' +
    '<div class="dlv-title">🛵 Word Courier</div>' +
    '<div class="dlv-stats">' +
    '<span id="dlv-level">LEVEL 1/3</span>' +
    '<span id="dlv-score">SCORE 0</span>' +
    '<span id="dlv-time">TIME 90s</span>' +
    '<span id="dlv-lives">❤❤❤</span>' +
    '</div></div>' +
    '<div class="dlv-banner"><b id="dlv-target">Collect: —</b><span id="dlv-progress">0/3</span></div>' +
    '<canvas id="dlv-canvas"></canvas>' +
    '<div class="dlv-msg" id="dlv-msg"></div>' +
    '<div class="dlv-pad">' +
    '<button type="button" data-dir="up" aria-label="Up">▲</button>' +
    '<div><button type="button" data-dir="left" aria-label="Left">◀</button>' +
    '<button type="button" data-dir="down" aria-label="Down">▼</button>' +
    '<button type="button" data-dir="right" aria-label="Right">▶</button></div>' +
    '</div>' +
    '<div class="dlv-actions">' +
    '<button class="btn sm ghost" data-dlv="reset">Restart / 重玩本关</button>' +
    '<button class="btn sm" data-dlv="quit">Exit / 退出（Esc）</button>' +
    '</div>';
}

function dlvSyncHud(state) {
  if (!state || !state.dom) return;
  var dom = state.dom;
  var target = state.targetQueue[state.levelIdx] || '—';
  if (dom.level) dom.level.textContent = 'LEVEL ' + (state.levelIdx + 1) + '/' + state.total;
  if (dom.score) dom.score.textContent = 'SCORE ' + state.score;
  if (dom.time) dom.time.textContent = 'TIME ' + Math.ceil(state.time) + 's';
  if (dom.lives) dom.lives.textContent = '●'.repeat(Math.max(0, state.lives)) + '○'.repeat(Math.max(0, 3 - state.lives));
  if (dom.target) dom.target.textContent = 'Collect: ' + target;
  if (dom.progress) dom.progress.textContent = state.collected + '/' + state.need;
  if (dom.msg) {
    dom.msg.textContent = state.msg || '';
    dom.msg.className = 'dlv-msg ' + (state.msgKind || '');
  }
}

function dlvResize(state) {
  var canvas = state.canvas;
  if (!canvas) return;
  var rect = canvas.getBoundingClientRect();
  var width = Math.max(320, rect.width || 960);
  var height = Math.max(240, rect.height || 560);
  var dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  var ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  state.ctx = ctx;
  state.viewW = width;
  state.viewH = height;
  state.tile = Math.min(width / DLV_COLS, height / DLV_ROWS);
  state.ox = (width - state.tile * DLV_COLS) / 2;
  state.oy = (height - state.tile * DLV_ROWS) / 2;
}

function dlvStop(state) {
  if (!state) return;
  if (state.raf) { cancelAnimationFrame(state.raf); state.raf = 0; }
  state.running = false;
  if (state.onKey) document.removeEventListener('keydown', state.onKey);
  if (state.onResize) window.removeEventListener('resize', state.onResize);
}

function dlvLoop(state, now) {
  if (!state || !state.running) return;
  var last = state.last || now;
  var dt = (now - last) / 1000;
  state.last = now;
  if (!state.paused) dlvUpdate(state, dt);
  dlvRender(state);
  dlvSyncHud(state);
  state.raf = requestAnimationFrame(function (t) { dlvLoop(state, t); });
}

function startDelivery(corpus, lesson, opts) {
  var words = dlvPickWords(corpus);
  if (words.length < 4) {
    toast('词表至少要有 4 个单词才能开快递员');
    return;
  }
  dlvQuit(false);

  var state = dlvNewState(corpus);
  state.lesson = lesson || null;
  state.onFinish = (opts && opts.onFinish) || null;

  var overlay = document.createElement('div');
  overlay.id = 'present';
  overlay.className = 'present-overlay lg-stage dlv-stage';
  overlay.innerHTML = dlvHudHtml();
  document.body.appendChild(overlay);

  state.overlay = overlay;
  state.canvas = document.getElementById('dlv-canvas');
  state.dom = {
    level: document.getElementById('dlv-level'),
    score: document.getElementById('dlv-score'),
    time: document.getElementById('dlv-time'),
    lives: document.getElementById('dlv-lives'),
    target: document.getElementById('dlv-target'),
    progress: document.getElementById('dlv-progress'),
    msg: document.getElementById('dlv-msg')
  };

  dlvStartLevel(state, 0, Date.now());
  dlvResize(state);

  state.onResize = function () { dlvResize(state); };
  window.addEventListener('resize', state.onResize);

  state.onKey = function (e) {
    var map = {
      ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
      w: 'up', a: 'left', s: 'down', d: 'right', W: 'up', A: 'left', S: 'down', D: 'right'
    };
    if (e.key === 'Escape') { dlvQuit(true); return; }
    var dir = map[e.key];
    if (!dir) return;
    e.preventDefault();
    state.input[dir] = true;
  };
  var onKeyUp = function (e) {
    var map = {
      ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
      w: 'up', a: 'left', s: 'down', d: 'right', W: 'up', A: 'left', S: 'down', D: 'right'
    };
    var dir = map[e.key];
    if (dir) state.input[dir] = false;
  };
  document.addEventListener('keydown', state.onKey);
  document.addEventListener('keyup', onKeyUp);
  state.onKeyUp = onKeyUp;

  Array.prototype.forEach.call(overlay.querySelectorAll('[data-dir]'), function (button) {
    var dir = button.getAttribute('data-dir');
    var press = function (e) { e.preventDefault(); state.input[dir] = true; };
    var release = function (e) { e.preventDefault(); state.input[dir] = false; };
    button.addEventListener('pointerdown', press);
    button.addEventListener('pointerup', release);
    button.addEventListener('pointerleave', release);
    button.addEventListener('pointercancel', release);
  });

  DLV_HUD = state;
  state.running = true;
  state.last = 0;
  state.raf = requestAnimationFrame(function (t) { dlvLoop(state, t); });
  return state;
}

function dlvQuit(clearOverlay) {
  var state = DLV_HUD;
  if (state) {
    dlvStop(state);
    if (state.onKeyUp) document.removeEventListener('keyup', state.onKeyUp);
    if (state.overlay && state.overlay.parentNode) state.overlay.remove();
    DLV_HUD = null;
  }
  if (clearOverlay !== false) {
    var old = document.getElementById('present');
    if (old) old.remove();
  }
}

/* ---------------------------------------------------------------- 交互 */
function dlvRestart() {
  var state = DLV_HUD;
  if (!state) return;
  var corpus = state.corpus;
  var opts = { onFinish: state.onFinish };
  dlvQuit(true);
  startDelivery(corpus, null, opts);
}

function dlvResetLevel() {
  var state = DLV_HUD;
  if (!state) return;
  if (state.phase === 'over' || state.phase === 'win') return dlvRestart();
  dlvStartLevel(state, state.levelIdx, Date.now());
  state.lives = Math.max(state.lives, 1);
  toast('本关已重开');
}

document.addEventListener('click', function (e) {
  var target = e.target && e.target.closest ? e.target.closest('[data-dlv]') : null;
  if (!target) return;
  e.preventDefault();
  var act = target.getAttribute('data-dlv');
  if (act === 'quit') dlvQuit(true);
  else if (act === 'reset') dlvResetLevel();
});

document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape' && DLV_HUD) dlvQuit(true);
});

/* 给 lab 的关卡系统用的入口 */
window.Delivery = {
  start: function (opts) {
    opts = opts || {};
    var words = (opts.words || []).map(function (w) { return typeof w === 'string' ? w : w.en; });
    var gloss = (opts.gloss || []).slice();
    if (!gloss.length && opts.words) {
      gloss = opts.words.filter(function (w) { return w && w.zh; }).map(function (w) { return { left: w.en, right: w.zh }; });
    }
    return startDelivery({ words: words, gloss: gloss }, opts.lesson || null, opts);
  },
  emojiFor: dlvEmojiFor,
  stop: function () { dlvQuit(true); }
};
