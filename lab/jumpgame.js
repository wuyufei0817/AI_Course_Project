/* ================= 单词跳跳岛（横版跳跃收集） ================= */
window.JumpGame = (function () {
  const W = 1200, H = 560, WORLD = 2600;
  const GRAV = 1750, SPEED = 265, JUMP = -780;

  const CATALOG = [
    { en: "apple", cn: "苹果", emoji: "🍎" },
    { en: "orange", cn: "橙子", emoji: "🍊" },
    { en: "pear", cn: "梨", emoji: "🍐" },
    { en: "banana", cn: "香蕉", emoji: "🍌" },
    { en: "grape", cn: "葡萄", emoji: "🍇" },
    { en: "peach", cn: "桃子", emoji: "🍑" }
  ];
  const LEVELS = [
    { en: "apple", cn: "苹果", emoji: "🍎" },
    { en: "banana", cn: "香蕉", emoji: "🍌" },
    { en: "grape", cn: "葡萄", emoji: "🍇" }
  ];

  const PLATFORMS = [
    { x: 0, y: 470, w: 760, h: 90 },
    { x: 860, y: 470, w: 820, h: 90 },
    { x: 1780, y: 470, w: 820, h: 90 },
    { x: 300, y: 350, w: 160, h: 22 },
    { x: 640, y: 300, w: 150, h: 22 },
    { x: 1050, y: 330, w: 170, h: 22 },
    { x: 1400, y: 300, w: 160, h: 22 },
    { x: 1900, y: 320, w: 170, h: 22 },
    { x: 2250, y: 300, w: 170, h: 22 }
  ];

  const SLOTS = [
    { x: 170, y: 400 }, { x: 430, y: 400 }, { x: 700, y: 400 },
    { x: 980, y: 400 }, { x: 1160, y: 265 }, { x: 1540, y: 400 },
    { x: 1980, y: 255 }, { x: 2320, y: 400 }
  ];

  let els = {}, raf = null, running = false, last = 0, mounted = false;
  let st = null;
  const keys = { left: false, right: false };

  function shuffle(a) { const r = a.slice(); for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; }
  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function buildFruits(target) {
    const slots = shuffle(SLOTS).slice(0, 8);
    const pool = currentPool();
    let others = pool.filter(f => String(f.en).toLowerCase() !== String(target.en).toLowerCase());
    if (!others.length) others = pool;
    const list = [];
    for (let i = 0; i < 3; i++) {
      list.push({ ...target, x: slots[i].x, y: slots[i].y, target: true, taken: false });
    }
    for (let i = 3; i < 8; i++) {
      const f = others[Math.floor(Math.random() * others.length)];
      list.push({ ...f, x: slots[i].x, y: slots[i].y, target: false, taken: false });
    }
    return list;
  }

  /* ---------------- 状态与流程 ---------------- */
  function startGame() {
    st.score = 0;
    startLevel(1);
  }

  function startLevel(lv) {
    st.level = lv;
    st.hearts = 3;
    st.timeLeft = 60;
    st.collected = 0;
    st.target = levels[lv - 1];
    st.fruits = buildFruits(st.target);
    st.player = { x: 80, y: 300, w: 34, h: 46, vx: 0, vy: 0, onGround: false, face: 1, walk: 0, invuln: 0 };
    st.enemy = { x: 1300, y: 430, w: 38, h: 40, dir: 1, min: 1100, max: 1650, speed: 70 };
    st.camX = 0;
    st.lastSafe = { x: 80, y: 300 };
    st.phase = "playing";
    hideOverlay();
    updateHUD();
    last = performance.now();
    if (!running) { running = true; raf = requestAnimationFrame(loop); }
  }

  function updateHUD() {
    if (!els.level) return;
    els.level.textContent = st.level;
    els.score.textContent = st.score;
    els.time.textContent = Math.ceil(st.timeLeft);
    els.hearts.textContent = "❤".repeat(st.hearts) + "♡".repeat(3 - st.hearts);
    els.objective.innerHTML = `找到「<b>${st.target.cn || st.target.en}</b>」 ${st.collected}/3 <span style="opacity:.7">（找英文单词）</span>`;
  }

  function loseHeart() {
    st.hearts = Math.max(0, st.hearts - 1);
    updateHUD();
    if (st.hearts <= 0) gameOver("爱心用完啦！");
  }

  function levelClear() {
    st.phase = "levelclear";
    st.score += 200;
    updateHUD();
    if (st.level < levels.length) {
      showOverlay(`<div class="jg-modal">
        <div class="jg-pause-ico">🏝</div>
        <h3>第 ${st.level} 关完成！</h3>
        <p>收集完成，当前得分 ${st.score}。</p>
        <div class="jg-modal-btns"><button class="btn primary" data-act="next">进入第 ${st.level + 1} 关 ▶</button></div>
      </div>`);
    } else {
      win();
    }
  }

  function win() {
    st.phase = "win";
    showOverlay(`<div class="jg-modal">
      <div class="jg-pause-ico">🏆</div>
      <h3>通关啦！</h3>
      <p>${levels.length} 座小岛全部完成，总分 ${st.score} 分。</p>
      <div class="jg-modal-btns"><button class="btn primary" data-act="again">再玩一次</button></div>
    </div>`);
  }

  function gameOver(msg) {
    st.phase = "gameover";
    showOverlay(`<div class="jg-modal">
      <div class="jg-pause-ico">😵</div>
      <h3>游戏结束</h3>
      <p>${msg} 最终得分 ${st.score} 分。</p>
      <div class="jg-modal-btns"><button class="btn primary" data-act="again">再来一次</button></div>
    </div>`);
  }

  function pause() {
    if (st.phase !== "playing") return;
    st.phase = "paused";
    showOverlay(`<div class="jg-modal">
      <div class="jg-pause-ico">Ⅱ</div>
      <h3>休息一下</h3>
      <p>计时已停止。准备好后继续，或重新开始本局。</p>
      <div class="jg-modal-btns">
        <button class="btn primary" data-act="resume">继续游戏</button>
        <button class="btn" data-act="restart">重新开始</button>
      </div>
    </div>`);
  }

  function resume() {
    if (st.phase !== "paused") return;
    st.phase = "playing";
    hideOverlay();
    last = performance.now();
  }

  function showOverlay(html) {
    els.overlay.innerHTML = html;
    els.overlay.classList.remove("hidden");
  }
  function hideOverlay() {
    els.overlay.classList.add("hidden");
    els.overlay.innerHTML = "";
  }

  /* ---------------- 物理与碰撞 ---------------- */
  function update(dt) {
    const p = st.player;
    st.timeLeft -= dt;
    if (st.timeLeft <= 0) { st.timeLeft = 0; gameOver("时间到啦！"); return; }
    els.time.textContent = Math.ceil(st.timeLeft);

    const dir = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    p.vx = dir * SPEED;
    if (dir) { p.face = dir; p.walk += dt * 9; } else p.walk = 0;

    p.vy += GRAV * dt;
    const prevBottom = p.y + p.h;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.onGround = false;

    for (const pl of PLATFORMS) {
      if (p.x + p.w > pl.x && p.x < pl.x + pl.w) {
        if (p.vy >= 0 && prevBottom <= pl.y + 1 && p.y + p.h >= pl.y) {
          p.y = pl.y - p.h; p.vy = 0; p.onGround = true;
          st.lastSafe = { x: p.x, y: p.y };
        }
      }
    }
    p.x = Math.max(0, Math.min(WORLD - p.w, p.x));

    if (p.y > 740) {
      loseHeart();
      if (st.phase !== "playing") return;
      p.x = st.lastSafe.x; p.y = st.lastSafe.y; p.vy = 0;
      return;
    }
    if (p.invuln > 0) p.invuln -= dt;

    // 小怪巡逻
    const e = st.enemy;
    e.x += e.dir * e.speed * dt;
    if (e.x < e.min) { e.x = e.min; e.dir = 1; }
    if (e.x > e.max) { e.x = e.max; e.dir = -1; }
    if (p.invuln <= 0 && p.x + p.w > e.x && p.x < e.x + e.w && p.y + p.h > e.y && p.y < e.y + e.h) {
      loseHeart();
      if (st.phase !== "playing") return;
      p.invuln = 1.2; p.x -= p.face * 70; p.vy = -380;
    }

    // 收集水果
    for (const f of st.fruits) {
      if (f.taken) continue;
      if (Math.abs(p.x + p.w / 2 - f.x) < 40 && Math.abs(p.y + p.h / 2 - f.y) < 44) {
        f.taken = true;
        if (f.target) { st.collected++; st.score += 100; }
        else { st.score = Math.max(0, st.score - 20); loseHeart(); if (st.phase !== "playing") return; }
        updateHUD();
        if (st.collected >= 3) { levelClear(); return; }
      }
    }

    st.camX = Math.max(0, Math.min(WORLD - W, p.x - W * 0.38));
  }

  /* ---------------- 绘制 ---------------- */
  function drawCloud(ctx, x, y, s) {
    ctx.fillStyle = "rgba(255,255,255,.62)";
    ctx.beginPath();
    ctx.ellipse(x, y, 52 * s, 26 * s, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x + 40 * s, y + 6 * s, 38 * s, 20 * s, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x - 34 * s, y + 8 * s, 30 * s, 17 * s, 0, 0, Math.PI * 2); ctx.fill();
  }

  function drawPlatform(ctx, x, y, w, h) {
    ctx.fillStyle = "#c08a5a";
    roundRect(ctx, x, y, w, h, 10); ctx.fill();
    ctx.fillStyle = "#7dbb6a";
    roundRect(ctx, x, y, w, Math.min(14, h), 7); ctx.fill();
    ctx.fillStyle = "rgba(120,80,40,.35)";
    for (let i = 10; i < w - 6; i += 36) {
      ctx.beginPath(); ctx.arc(x + i, y + Math.min(h - 12, 40), 2.4, 0, 7); ctx.fill();
    }
  }

  function drawFruit(ctx, f) {
    ctx.save();
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    /* 不再画单词对应的图标：看中文找英文，图标会直接泄底 */
    const palette = ["#e2725b", "#e56b7f", "#f0c76a", "#9a80c2", "#ef9b52", "#bcd06a", "#7fb9a8", "#dd8fb0"];
    let h = 0;
    const seed = String(f.en || "");
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 997;
    ctx.fillStyle = palette[h % palette.length];
    ctx.beginPath();
    ctx.arc(f.x, f.y - 2, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.35)";
    ctx.beginPath();
    ctx.arc(f.x - 5, f.y - 7, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#6f9f78";
    ctx.beginPath();
    ctx.ellipse(f.x + 7, f.y - 15, 6, 3.5, -0.6, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = "bold 13px 'Trebuchet MS','Microsoft YaHei'";
    const label = f.en;
    const tw = ctx.measureText(label).width;
    const lw = tw + 18, lh = 22;
    ctx.fillStyle = "rgba(255,255,255,.95)";
    roundRect(ctx, f.x - lw / 2, f.y + 14, lw, lh, 8); ctx.fill();
    ctx.fillStyle = "#3b4a6b";
    ctx.fillText(label, f.x, f.y + 26);
    ctx.restore();
  }

  function drawPlayer(ctx, p, cx) {
    const x = p.x - cx, y = p.y;
    const t = p.onGround ? Math.sin(p.walk) * 3 : 0;
    ctx.save();
    if (p.invuln > 0 && Math.floor(p.invuln * 12) % 2 === 0) ctx.globalAlpha = 0.35;
    // 腿
    ctx.fillStyle = "#e07b39";
    ctx.fillRect(x + 7, y + 33 + Math.max(0, t), 8, 13);
    ctx.fillRect(x + 19, y + 33 + Math.max(0, -t), 8, 13);
    // 身体
    ctx.fillStyle = "#f2a65a";
    roundRect(ctx, x + 4, y + 16, 26, 20, 6); ctx.fill();
    // 头
    ctx.fillStyle = "#ffd9b3";
    ctx.beginPath(); ctx.arc(x + 17, y + 11, 11, 0, Math.PI * 2); ctx.fill();
    // 帽子
    ctx.fillStyle = "#4e9b6b";
    ctx.beginPath(); ctx.arc(x + 17, y + 7, 12, Math.PI, Math.PI * 2); ctx.fill();
    ctx.fillRect(x + 3, y + 6, 28, 4);
    // 眼睛
    ctx.fillStyle = "#333";
    ctx.beginPath(); ctx.arc(x + 13, y + 11, 1.6, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(x + 21, y + 11, 1.6, 0, 7); ctx.fill();
    ctx.restore();
  }

  function drawEnemy(ctx, e) {
    ctx.save();
    ctx.fillStyle = "#9b7bd4";
    ctx.beginPath(); ctx.ellipse(e.x + e.w / 2, e.y + e.h / 2, e.w / 2, e.h / 2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.arc(e.x + 13, e.y + 15, 5, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(e.x + 25, e.y + 15, 5, 0, 7); ctx.fill();
    ctx.fillStyle = "#333";
    ctx.beginPath(); ctx.arc(e.x + 13, e.y + 15, 2, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(e.x + 25, e.y + 15, 2, 0, 7); ctx.fill();
    ctx.restore();
  }

  function draw() {
    const ctx = els.ctx;
    const cx = st.camX;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#bfe6ee"); g.addColorStop(1, "#8cc7d6");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    drawCloud(ctx, 120 - cx * 0.15, 95, 1.1);
    drawCloud(ctx, 560 - cx * 0.12, 60, 1.3);
    drawCloud(ctx, 1000 - cx * 0.18, 110, 0.9);
    drawCloud(ctx, 1560 - cx * 0.1, 72, 1.2);

    ctx.fillStyle = "#8fc98a";
    ctx.beginPath(); ctx.ellipse(260 - cx * 0.5, 600, 430, 260, 0, Math.PI, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(900 - cx * 0.5, 640, 480, 280, 0, Math.PI, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#7dbb78";
    ctx.beginPath(); ctx.ellipse(1520 - cx * 0.5, 620, 430, 250, 0, Math.PI, Math.PI * 2); ctx.fill();

    for (const pl of PLATFORMS) drawPlatform(ctx, pl.x - cx, pl.y, pl.w, pl.h);
    drawEnemy(ctx, { ...st.enemy, x: st.enemy.x - cx });
    for (const f of st.fruits) if (!f.taken) drawFruit(ctx, { ...f, x: f.x - cx });
    drawPlayer(ctx, st.player, cx);
  }

  function loop(ts) {
    if (!running) return;
    const dt = Math.min(0.04, (ts - last) / 1000 || 0);
    last = ts;
    if (st.phase === "playing") update(dt);
    draw();
    raf = requestAnimationFrame(loop);
  }

  /* ---------------- 输入 ---------------- */
  function onKeyDown(e) {
    if (e.code === "ArrowLeft" || e.code === "KeyA") { keys.left = true; e.preventDefault(); }
    if (e.code === "ArrowRight" || e.code === "KeyD") { keys.right = true; e.preventDefault(); }
    if ((e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") && st && st.phase === "playing") {
      if (st.player.onGround) st.player.vy = JUMP;
      e.preventDefault();
    }
    if (e.code === "Escape" && st && st.phase === "playing") pause();
  }
  function onKeyUp(e) {
    if (e.code === "ArrowLeft" || e.code === "KeyA") keys.left = false;
    if (e.code === "ArrowRight" || e.code === "KeyD") keys.right = false;
  }

  /* ---------------- 词池：优先用「⚙️ 词表设置」，没设置时用内置 ---------------- */
  let levels = LEVELS;

  function currentPool() {
    if (window.WordSet) {
      const custom = window.WordSet.words().map(w => ({
        en: w.en, cn: w.zh || "", emoji: window.WordSet.emojiFor(w.en) || ""
      }));
      if (custom.length >= 3) return custom;
    }
    const base = ANIMALS.active ? ANIMALS.words : LEVELS;
    return base.map(w => ({
      en: w.en, cn: w.cn || "",
      emoji: w.emoji || (window.WordSet ? window.WordSet.emojiFor(w.en) : "") || ""
    }));
  }

  function refreshLevels() {
    const pool = currentPool();
    levels = pool.slice(0, Math.min(4, pool.length));
    if (!levels.length) levels = LEVELS;
  }

  /* ---------------- 挂载 ---------------- */
  function mount(root) {
    stop();
    refreshLevels();
    root.innerHTML = `
      <div class="jg">
        <div class="jg-head">
          <div class="jg-title">🏝 单词跳跳岛</div>
          <div class="jg-hud">
            <span>第 <b id="jgLevel">1</b>/${levels.length} 关</span>
            <span>分数 <b id="jgScore">0</b></span>
            <span>时间 <b id="jgTime">60</b>s</span>
            <span class="jg-hearts" id="jgHearts">❤❤❤</span>
            <button class="btn sm" id="jgPause">⏸ 暂停</button>
          </div>
        </div>
        <div class="jg-stage">
          <canvas id="jgCanvas"></canvas>
          <div class="jg-objective" id="jgObjective"></div>
          <div class="jg-overlay hidden" id="jgOverlay"></div>
        </div>
        <div class="jg-controls">
          <button class="btn" data-k="left">◀</button>
          <button class="btn" data-k="jump">▲ 跳</button>
          <button class="btn" data-k="right">▶</button>
          <span class="note">← → / A D 移动，空格 / ↑ 跳跃，Esc 暂停</span>
        </div>
      </div>`;

    const canvas = root.querySelector("#jgCanvas");
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = W * dpr; canvas.height = H * dpr;
    if (dpr !== 1) canvas.style.height = "auto";
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);

    els = {
      canvas, ctx,
      level: root.querySelector("#jgLevel"),
      score: root.querySelector("#jgScore"),
      time: root.querySelector("#jgTime"),
      hearts: root.querySelector("#jgHearts"),
      objective: root.querySelector("#jgObjective"),
      overlay: root.querySelector("#jgOverlay")
    };

    st = {
      level: 1, score: 0, hearts: 3, timeLeft: 60, collected: 0, target: levels[0],
      fruits: [], camX: 0, phase: "ready",
      player: { x: 80, y: 300, w: 34, h: 46, vx: 0, vy: 0, onGround: true, face: 1, walk: 0, invuln: 0 },
      enemy: { x: 1300, y: 430, w: 38, h: 40, dir: 1, min: 1100, max: 1650, speed: 70 },
      lastSafe: { x: 80, y: 300 }
    };
    updateHUD();

    root.querySelector("#jgPause").addEventListener("click", () => { if (st.phase === "playing") pause(); });
    els.overlay.addEventListener("click", (e) => {
      const b = e.target.closest("[data-act]");
      if (!b) return;
      const act = b.dataset.act;
      if (act === "start" || act === "again") startGame();
      else if (act === "resume") resume();
      else if (act === "restart") startGame();
      else if (act === "next") startLevel(st.level + 1);
    });
    root.querySelectorAll("[data-k]").forEach(b => {
      const k = b.dataset.k;
      const press = (e) => { e.preventDefault(); if (k === "jump") { if (st.phase === "playing" && st.player.onGround) st.player.vy = JUMP; } else keys[k] = true; };
      const release = (e) => { e.preventDefault(); if (k !== "jump") keys[k] = false; };
      b.addEventListener("pointerdown", press);
      b.addEventListener("pointerup", release);
      b.addEventListener("pointerleave", release);
    });

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    mounted = true;

    showOverlay(`<div class="jg-modal">
      <div class="jg-pause-ico">🏝</div>
      <h3>单词跳跳岛</h3>
      <p>屏幕上方给出中文，去场上找出对应的<b>英文单词</b>，收集 3 个即可过关。<br>词卡来自「⚙️ 词表设置」，别撞到小怪哦！</p>
      <div class="jg-modal-btns"><button class="btn primary" data-act="start">开始游戏</button></div>
    </div>`);
    draw();
  }

  function stop() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = null;
    if (mounted) {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      mounted = false;
    }
    keys.left = keys.right = false;
  }

  return { mount, stop, refresh: refreshLevels };
})();
