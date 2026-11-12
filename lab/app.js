if(new URLSearchParams(location.search).get('embed')==='1')document.documentElement.classList.add('embed');
/* ================= 工具 ================= */
function $(s, r = document) { return r.querySelector(s); }
function $$(s, r = document) { return Array.from(r.querySelectorAll(s)); }
function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
function toast(msg) {
  let t = document.createElement("div");
  t.textContent = msg;
  t.style.cssText = "position:fixed;left:50%;bottom:34px;transform:translateX(-50%);background:#1b2440;color:#fff;padding:11px 20px;border-radius:10px;font-size:13px;z-index:99;box-shadow:0 10px 30px rgba(0,0,0,.25)";
  document.body.appendChild(t);
  setTimeout(() => { t.style.transition = "opacity .4s"; t.style.opacity = "0"; }, 1600);
  setTimeout(() => t.remove(), 2100);
}
function heatColor(v) {
  if (v >= 85) return "hsl(150,62%,86%)";
  if (v >= 75) return "hsl(150,55%,91%)";
  if (v >= 65) return "hsl(45,80%,89%)";
  return "hsl(0,72%,91%)";
}

/* 检测是否接入了大模型（用于提示词优化 / 教案生成） */
let AI_OK = false;
fetch("/api/health").then(r => r.json()).then(j => { AI_OK = !!(j && j.hasKey); }).catch(() => {});

let m6Timer = null;
let m6Spawn = null;
function clearM6Timer() {
  clearInterval(m6Timer);
  clearInterval(m6Spawn);
  m6Timer = null;
  m6Spawn = null;
}

function evaluateAnswer(q, a) {
  const text = a.trim();
  const words = text.split(/\s+/).filter(Boolean);
  let stars = 0;
  const tips = [];
  if (words.length >= 2) stars++; else tips.push("回答太短，尽量用完整句子");
  if (words.length >= 4) stars++; else tips.push("可以再补充一点信息");
  if (/^[A-Z]/.test(text)) stars++; else tips.push("句首字母要大写");
  if (/[.!?]$/.test(text)) stars++; else tips.push("句末记得加标点");
  const qw = (q.toLowerCase().match(/[a-z']+/g) || []).filter(w => w.length > 2);
  if (qw.some(w => text.toLowerCase().includes(w))) stars++; else tips.push("回答最好回应问题中的关键词");
  return { stars: Math.max(1, Math.min(5, stars)), tips };
}

/* ================= 首页 ================= */
function renderHome() {
  const stats = [
    ["128", "今日生成教学设计"], ["356", "分层练习生成"], ["2.1k", "数字人对话轮次"], ["890", "作业反馈批注"]
  ].map(s => `<div class="stat"><div class="stat-num">${s[0]}</div><div class="stat-lbl">${s[1]}</div></div>`).join("");
  const cols = [
    ["课前 · 备课", "把目标变成可上的课", [["教学设计", "m1"], ["思维导图", "mindmap"], ["资源生成", "m5"]]],
    ["课中 · 互动", "让课堂开口、动手、好玩", [["数字人对话", "m7"], ["游戏闯关", "m6"], ["课堂互动", "m5"]]],
    ["课后 · 评价", "精准练习与及时反馈", [["分层练习", "m2"], ["过程反馈", "m3"]]]
  ].map(c => `
    <div class="col">
      <div class="col-head">${c[0]}</div>
      <div class="col-sub">${c[1]}</div>
      ${c[2].map(l => `<div class="col-link" data-view="${l[1]}">→ <b>${l[0]}</b></div>`).join("")}
    </div>`).join("");
  const apps = DATA.apps.map(a => `<div class="app-item"><div class="n">${a.name}</div><div class="m">${a.mod}</div></div>`).join("");

  return `
  <div class="hero">
    <h2>小学英语 AI 助教 · 全功能工作台</h2>
    <p>覆盖“课前备课 → 课中互动 → 课后反馈”全流程：把课标目标变成任务链，把练习变成分层闯关，把数字人变成会说话的口语陪练。</p>
    <div class="chips">
      <span class="chip">M1 教学设计</span><span class="chip">M2 分层练习</span><span class="chip">M3 过程反馈</span>
      <span class="chip">思维导图</span><span class="chip">M5 资源互动</span><span class="chip">M6 游戏化</span><span class="chip">M7 数字人</span>
    </div>
  </div>
  <div class="grid" style="margin-top:16px"><div class="stats">${stats}</div></div>
  <div class="stage3">${cols}</div>
  <div class="card" style="margin-top:16px">
    <div class="card-head"><div><div class="card-title">AI 在小学英语教学中的八类应用</div><div class="card-sub">逐条对应到产品模块</div></div></div>
    <div class="card-body"><div class="app-grid">${apps}</div></div>
  </div>`;
}
function initHome(root) { /* 使用全局 data-view 委托 */ }

/* ================= M1 教学设计 ================= */
const STOP_WORDS = new Set("the a an and or but to of in on at for with from by is am are was were be been do does did have has had i you he she it we they my your his her its our their this that these those what how would like can may will shall not no yes please thank thanks hello hi let us unit lesson read write listen speak words word".split(" "));

function lessonHTML(L, meta) {
  const m = meta || { unit: L.unit, grade: L.grade, type: L.type };
  const objs = L.objectives.map(o => `<div class="obj-item"><div class="obj-dim">${esc(o.dim)}</div><div class="obj-text">${esc(o.text)}</div></div>`).join("");
  const chain = L.chain.map(c => `
    <div class="tl"><div class="tl-dot"></div><div class="tl-body">
      <div class="tl-top"><span class="tl-stage">${esc(c.stage)}</span><span class="tl-time">${esc(c.time)}</span><span class="tl-form">${esc(c.form)}</span></div>
      <div class="tl-desc">${esc(c.desc)}</div>
      <div class="tl-scaffold">支架：${esc(c.scaffold)}</div>
    </div></div>`).join("");
  const tiers = ["basic", "advanced", "challenge"].map(k => {
    const t = L.tiers[k];
    return `<div class="tier ${k}"><h4>${esc(t.title)}</h4><ul>${t.items.map(i => `<li>${esc(i)}</li>`).join("")}</ul></div>`;
  }).join("");
  const sc = L.scaffolds;
  const scaffold = [
    ["句型", sc.patterns.join(" / ")], ["提示", sc.prompts.join(" / ")], ["范例", sc.models.join(" / ")]
  ].map(r => `<div class="scaffold-row"><div class="scaffold-k">${r[0]}</div><div>${esc(r[1])}</div></div>`).join("");

  return `
  <div class="note" style="margin-bottom:10px">📘 ${esc(m.grade)} · ${esc(m.type)} · ${esc(m.unit)}</div>
  <div class="grid grid-2">
    <div class="card"><div class="card-head"><div class="card-title">能力目标分解</div></div><div class="card-body"><div class="obj-list">${objs}</div></div></div>
    <div class="card"><div class="card-head"><div class="card-title">语言支架（句型 / 提示 / 范例）</div></div><div class="card-body">${scaffold}</div></div>
  </div>
  <div class="card" style="margin-top:16px"><div class="card-head"><div class="card-title">课堂任务链</div><div class="tag green">${L.chain.length} 环节 · 40 分钟</div></div><div class="card-body"><div class="timeline">${chain}</div></div></div>
  <div class="card" style="margin-top:16px"><div class="card-head"><div class="card-title">分层活动</div></div><div class="card-body"><div class="tiers">${tiers}</div></div></div>
  <div class="grid grid-2" style="margin-top:16px">
    <div class="card"><div class="card-head"><div class="card-title">板书提纲</div></div><div class="card-body"><div class="board">${esc(L.board)}</div></div></div>
    <div class="card"><div class="card-head"><div class="card-title">作业建议</div></div><div class="card-body"><div class="note">${esc(L.homework)}</div></div></div>
  </div>`;
}
function m1OutputHTML(meta) { return lessonHTML(DATA.lesson, meta); }

function analyzeTextbook(text) {
  const gradeM = text.match(/([一二三四五六])年级/);
  const grade = gradeM ? gradeM[1] + "年级" : "五年级";
  const unitM = text.match(/(Unit\s*\d+[^\n\r。.!?]{0,40})/i) || text.match(/(第[一二三四五六七八九十]+单元[^\n\r。.!?]{0,30})/);
  const unit = unitM ? unitM[1].trim() : "上传单元";
  const rawWords = (text.match(/[A-Za-z][A-Za-z'-]{1,}/g) || []).map(w => w.toLowerCase());
  const words = [...new Set(rawWords)].filter(w => !STOP_WORDS.has(w) && w.length > 2).slice(0, 10);
  const patterns = (text.match(/[^.!?\n]*(?:what|how|would|do you|does|can|i'd|i am|there is|there are)[^.!?\n]*[.!?]/gi) || [])
    .map(s => s.trim()).slice(0, 5);
  return { grade, unit, words, patterns };
}

function buildLessonFromText(text) {
  const info = analyzeTextbook(text);
  const w = info.words.length ? info.words : ["hamburger", "salad", "juice"];
  const p = info.patterns.length ? info.patterns : ["What would you like?", "I'd like ..., please."];
  const pattern0 = p[0];
  const wordList = w.slice(0, 6).join(", ");
  return {
    unit: info.unit,
    grade: info.grade,
    type: "读写课",
    objectives: [
      { dim: "语言知识", text: `能听、说、读、写词汇：${wordList}` },
      { dim: "语言技能", text: `能运用句型 ${pattern0} 进行交流` },
      { dim: "思维品质", text: "能根据情境选择合适表达并说明理由" },
      { dim: "文化意识", text: "在语境中感受中西方表达差异" },
      { dim: "学习能力", text: "借助支架完成对话，能在小组中合作表达" }
    ],
    chain: [
      { stage: "导入", time: "5'", form: "全班", desc: `看图/视频激活词汇：${w.slice(0, 3).join(" / ")}`, scaffold: pattern0 },
      { stage: "呈现", time: "8'", form: "个体", desc: "听读文本，圈出目标词汇与句型", scaffold: p.slice(0, 2).join(" / ") },
      { stage: "操练", time: "12'", form: "小组", desc: "分层练习：替换词、问答、创编", scaffold: "基础替换 → 进阶问答 → 挑战创编" },
      { stage: "输出", time: "10'", form: "结对", desc: "角色扮演 / 情境对话", scaffold: `A: ${pattern0}  B: ...` },
      { stage: "迁移", time: "5'", form: "全班", desc: "联系生活做小任务并汇报", scaffold: "I'd like ... / I think ..." }
    ],
    tiers: {
      basic: { title: "基础层 · 有支架", items: [`跟读并抄写：${w.slice(0, 3).join(", ")}`, "看图片补全句子", "连线匹配词义"] },
      advanced: { title: "进阶层 · 半开放", items: ["根据情境补全对话", "两人一问一答", "给单词造句"] },
      challenge: { title: "挑战层 · 迁移", items: ["自编对话并表演", "为生活场景设计小海报", "用目标句型做 1 分钟演讲"] }
    },
    scaffolds: {
      patterns: p.slice(0, 5),
      prompts: ["Look at the picture. What can you see?", `Can you use "${w[0]}" to make a sentence?`],
      models: [`A: ${pattern0}  B: I'd like ...`]
    },
    board: `Words: ${w.join(" / ")}\nPattern: ${pattern0}`,
    homework: `① 用 ${pattern0} 写 3 组问答；② 录制一段 30 秒口语。`
  };
}

function normalizeAI(o) {
  if (!o || !Array.isArray(o.objectives) || !Array.isArray(o.chain)) return null;
  const tiers = o.tiers || {}, sc = o.scaffolds || {};
  const norm = {
    unit: o.unit || "AI 生成单元",
    grade: o.grade || "五年级",
    type: o.type || "读写课",
    objectives: o.objectives.filter(x => x && x.dim && x.text).slice(0, 6),
    chain: o.chain.filter(x => x && x.stage).slice(0, 8),
    tiers: {
      basic: { title: (tiers.basic && tiers.basic.title) || "基础层 · 有支架", items: (tiers.basic && Array.isArray(tiers.basic.items)) ? tiers.basic.items : ["跟读目标词汇", "补全句子"] },
      advanced: { title: (tiers.advanced && tiers.advanced.title) || "进阶层 · 半开放", items: (tiers.advanced && Array.isArray(tiers.advanced.items)) ? tiers.advanced.items : ["补全对话", "两人问答"] },
      challenge: { title: (tiers.challenge && tiers.challenge.title) || "挑战层 · 迁移", items: (tiers.challenge && Array.isArray(tiers.challenge.items)) ? tiers.challenge.items : ["自编对话", "生活迁移任务"] }
    },
    scaffolds: {
      patterns: Array.isArray(sc.patterns) ? sc.patterns : ["What would you like?"],
      prompts: Array.isArray(sc.prompts) ? sc.prompts : ["Look at the picture."],
      models: Array.isArray(sc.models) ? sc.models : ["A: What would you like?  B: I'd like ..."]
    },
    board: o.board || "",
    homework: o.homework || "完成本单元相关练习。",
    __ai: true
  };
  if (!norm.objectives.length || !norm.chain.length) return null;
  norm.chain = norm.chain.map(c => ({ stage: c.stage || "环节", time: c.time || "5'", form: c.form || "全班", desc: c.desc || "", scaffold: c.scaffold || "" }));
  return norm;
}

async function generateLessonAI(text) {
  try {
    const r = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "lesson", message: "请根据下面课本内容设计一节小学英语课。只输出 JSON，不要解释：\n" + text.slice(0, 3000) })
    });
    if (!r.ok) return null;
    const j = await r.json();
    let s = (j.reply || "").trim();
    s = s.replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/```$/g, "").trim();
    return normalizeAI(JSON.parse(s));
  } catch (e) { return null; }
}

function renderM1() {
  return `
  <div class="card"><div class="card-body">
    <div class="row">
      <div class="field" style="flex:1;min-width:130px"><label>教材版本</label><select id="f1"><option>人教版 PEP</option><option>外研版</option><option>译林版</option></select></div>
      <div class="field" style="flex:1;min-width:110px"><label>年级</label><select id="f2"><option>五年级 上册</option><option>四年级 上册</option><option>六年级 上册</option></select></div>
      <div class="field" style="flex:1.4;min-width:180px"><label>单元 / 课题</label><input id="f3" value="Unit 3 What would you like?" /></div>
      <div class="field" style="flex:0 0 110px"><label>课时</label><select id="f4"><option>40 分钟</option><option>35 分钟</option></select></div>
      <div class="field" style="flex:0 0 120px"><label>课型</label><select id="f5"><option>读写课</option><option>听说课</option><option>复习课</option></select></div>
    </div>
    <div class="row" style="margin-top:14px">
      <button class="btn primary" id="m1Gen">✨ 生成教学设计</button>
      <span class="note" id="m1Hint">输入课标/教材目标，自动生成任务链与支架</span>
    </div>
  </div></div>

  <div class="card" style="margin-top:16px"><div class="card-head"><div class="card-title">📤 上传课本 / 单元内容</div><span class="tag">txt / md / 粘贴</span></div>
    <div class="card-body">
      <div class="row">
        <input type="file" id="m1File" accept=".txt,.md,.markdown,text/plain" />
        <span class="note" id="m1UpHint">上传不同课本，会生成不同的教学案例</span>
      </div>
      <textarea id="m1Text" rows="5" style="margin-top:10px;width:100%;padding:10px 12px;border:1px solid var(--line);border-radius:10px;font-family:inherit;font-size:13.5px" placeholder="或直接粘贴单元内容：词汇表、句型、课文…"></textarea>
      <div class="row" style="margin-top:10px">
        <button class="btn primary" id="m1UploadGen">✨ 根据上传内容生成案例</button>
        <span class="note">自动抽取词汇 / 句型 / 主题，生成目标、任务链与支架</span>
      </div>
    </div></div>
  <div id="m1Out" class="hidden" style="margin-top:16px"></div>`;
}

function initM1(root) {
  const btn = $("#m1Gen", root), out = $("#m1Out", root), hint = $("#m1Hint", root);
  const fileEl = $("#m1File", root), textEl = $("#m1Text", root), upHint = $("#m1UpHint", root), upBtn = $("#m1UploadGen", root);

  btn.addEventListener("click", () => {
    btn.disabled = true; hint.innerHTML = '<span class="spin"></span> 正在生成目标分解与任务链…';
    out.classList.add("hidden");
    setTimeout(() => {
      const meta = { unit: $("#f3", root).value, grade: $("#f2", root).value, type: $("#f5", root).value };
      out.innerHTML = lessonHTML(DATA.lesson, meta);
      out.classList.remove("hidden");
      btn.disabled = false; hint.textContent = "已生成，可局部修改或一键导出";
      toast("教学设计已生成");
    }, 900);
  });

  fileEl.addEventListener("change", () => {
    const f = fileEl.files[0];
    if (!f) return;
    if (/\.(txt|md|markdown)$/i.test(f.name) || (f.type && f.type.startsWith("text/"))) {
      const r = new FileReader();
      r.onload = () => { textEl.value = r.result; upHint.textContent = "已读取：" + f.name; };
      r.onerror = () => { upHint.textContent = "读取失败，请改用粘贴。"; };
      r.readAsText(f, "utf-8");
    } else {
      upHint.textContent = "支持 txt / md；docx、pdf 请先复制文本粘贴到下方。";
    }
  });

  upBtn.addEventListener("click", async () => {
    const text = textEl.value.trim();
    if (text.length < 10) { toast("请先上传或粘贴单元内容"); return; }
    upBtn.disabled = true; upHint.innerHTML = '<span class="spin"></span> 正在分析课本内容…';
    let lesson = null;
    if (AI_OK) lesson = await generateLessonAI(text);
    if (!lesson) lesson = buildLessonFromText(text);
    const meta = { unit: lesson.unit, grade: lesson.grade, type: lesson.type };
    out.innerHTML = lessonHTML(lesson, meta);
    out.classList.remove("hidden");
    upBtn.disabled = false;
    upHint.textContent = lesson.__ai ? "✅ 已由大模型根据上传内容生成" : "✅ 已根据上传内容生成本地案例";
    toast("教学案例已生成");
  });
}

/* ================= M2 分层练习 ================= */
function normAns(s) {
  return String(s || "").toLowerCase().replace(/[.,!?;:'"]/g, "").replace(/\s+/g, " ").trim();
}

function renderQuestion(e) {
  const q = e.item;
  if (e.type === "choice" || e.type === "dialogue") {
    return `<div class="ex-card" data-qi="${e.qi}"><div class="ex-q">${esc(q.q)}</div>
      <div class="options">${q.options.map((o, j) => `<div class="opt q-opt" data-ok="${j === q.answer ? 1 : 0}">${String.fromCharCode(65 + j)}. ${esc(o)}<div class="why hidden">${esc(q.explain || "")}</div></div>`).join("")}</div></div>`;
  }
  if (e.type === "fill") {
    return `<div class="ex-card" data-qi="${e.qi}"><div class="ex-q">${esc(q.q)}</div>
      <input class="q-input" placeholder="输入答案" /><div class="why hidden">参考答案：${esc(q.answer)}${q.explain ? " · " + esc(q.explain) : ""}</div></div>`;
  }
  return `<div class="ex-card" data-qi="${e.qi}"><div class="ex-q">连词成句：${q.words.map(w => `<span class="q-word">${esc(w)}</span>`).join(" ")}</div>
    <input class="q-input" placeholder="写出完整句子" /><div class="why hidden">参考答案：${esc(q.answer)}</div></div>`;
}

function renderM2() {
  const types = BANK.types.map(t => `<option value="${t.key}">${t.name}</option>`).join("");
  return `<div class="card"><div class="card-body">
    <div class="row">
      <div class="field" style="flex:2;min-width:220px"><label>知识点 / 学习目标</label><input id="m2Point" value="${esc(DATA.exercises.point)}" /></div>
      <div class="field" style="flex:0 0 150px"><label>题型（决定生成内容）</label><select id="m2Type">${types}</select></div>
      <div class="field" style="flex:0 0 110px"><label>每档题量</label><select id="m2Count"><option value="3">3 题</option><option value="5">5 题</option></select></div>
    </div>
    <div class="row" style="margin-top:14px">
      <button class="btn primary" id="m2Gen">🎯 生成三档练习</button>
      <button class="btn" id="m2Grade" disabled>✅ 批改</button>
      <span class="note" id="m2Hint">切换题型会重新生成题目</span>
    </div>
  </div></div>
  <div id="m2Out" class="hidden" style="margin-top:16px"></div>`;
}

function initM2(root) {
  const out = $("#m2Out", root), hint = $("#m2Hint", root), grade = $("#m2Grade", root);
  const typeSel = $("#m2Type", root), countSel = $("#m2Count", root);
  let all = [];

  function sample(type, lv, n) {
    let pool = BANK[type].filter(q => q.lv === lv);
    if (pool.length < n) pool = pool.concat(BANK[type].filter(q => q.lv !== lv));
    return shuffle(pool).slice(0, n);
  }

  function build() {
    const type = typeSel.value, n = +countSel.value;
    const tiers = [
      ["basic", "L1 基础", "有支架 · 保底", 1],
      ["advanced", "L2 进阶", "半开放 · 巩固", 2],
      ["challenge", "L3 挑战", "迁移 · 拓展", 3]
    ];
    all = [];
    let qi = 0;
    const cards = tiers.map(([k, name, sub, lv]) => {
      const items = sample(type, lv, n).map(q => { const e = { type, item: q, tier: k, qi: qi++ }; all.push(e); return e; });
      return `<div class="card"><div class="card-head"><div><div class="card-title">${name}</div><div class="card-sub">${sub}</div></div><span class="tag">${BANK.types.find(t => t.key === type).name}</span></div>
        <div class="card-body"><div class="grid" style="gap:10px">${items.map(renderQuestion).join("")}</div></div></div>`;
    }).join("");
    out.innerHTML = `<div class="grid grid-3">${cards}</div>
      <div id="m2Report" class="hidden" style="margin-top:16px"></div>
      <div id="m2Adapt" class="hidden" style="margin-top:16px"></div>`;
    out.classList.remove("hidden");
    grade.disabled = false;
    hint.textContent = `已生成 ${all.length} 题 · ${BANK.types.find(t => t.key === type).name}`;
    $$(".q-opt", out).forEach(o => o.addEventListener("click", () => {
      const card = o.closest("[data-qi]");
      card.querySelectorAll(".q-opt").forEach(x => x.classList.remove("sel-opt"));
      o.classList.add("sel-opt");
    }));
  }

  function gradeAll() {
    let correct = 0;
    const wrong = [];
    all.forEach(e => {
      const card = $(`[data-qi="${e.qi}"]`, out);
      if (!card) return;
      const q = e.item;
      if (e.type === "choice" || e.type === "dialogue") {
        const sel = card.querySelector(".q-opt.sel-opt");
        const ok = sel && sel.dataset.ok === "1";
        card.querySelectorAll(".q-opt").forEach(o => { if (o.dataset.ok === "1") o.classList.add("right"); });
        card.querySelectorAll(".why").forEach(w => w.classList.remove("hidden"));
        if (ok) correct++;
        else { if (sel) sel.classList.add("wrong"); wrong.push({ q: q.q, ans: q.options[q.answer], why: q.explain || "" }); }
      } else {
        const inp = card.querySelector(".q-input");
        const ok = inp && normAns(inp.value) === normAns(q.answer);
        const why = card.querySelector(".why");
        if (why) why.classList.remove("hidden");
        if (inp) inp.classList.add(ok ? "ok" : "bad");
        if (ok) correct++; else wrong.push({ q: q.q, ans: q.answer, why: "" });
      }
    });
    const total = all.length;
    const rep = $("#m2Report", out);
    rep.classList.remove("hidden");
    rep.innerHTML = `<div class="grade-report">
      <div class="row"><b style="font-size:15px">批改结果：${correct} / ${total}</b><span class="tag green">正确率 ${total ? Math.round(correct / total * 100) : 0}%</span></div>
      ${wrong.length ? wrong.map(w => `<div class="wrong-item"><b>错题</b> · ${esc(String(w.q).replace(/\n/g, " / "))}<br><span class="muted">正确答案：${esc(w.ans)}${w.why ? " · " + esc(w.why) : ""}</span></div>`).join("") : '<div class="note">全部正确，太棒了！</div>'}
    </div>`;
    renderAdapt(out);
    toast("批改完成");
  }

  $("#m2Gen", root).addEventListener("click", build);
  grade.addEventListener("click", gradeAll);
  typeSel.addEventListener("change", () => { if (!out.classList.contains("hidden")) build(); });
  countSel.addEventListener("change", () => { if (!out.classList.contains("hidden")) build(); });
}
function renderAdapt(out) {
  const grades = DATA.students.map(s => {
    const avg = Math.round((s.vocab + s.gram + s.pron + s.use) / 4);
    let tier = "基础组", cls = "", rec = "L1 基础练习";
    if (avg >= 85) { tier = "挑战组"; cls = ""; rec = "L3 挑战练习"; }
    else if (avg >= 70) { tier = "进阶组"; cls = "mid"; rec = "L2 进阶练习"; }
    else { cls = "low"; }
    return { name: s.name, avg, tier, cls, rec };
  });
  const groups = {};
  grades.forEach(g => { (groups[g.tier] = groups[g.tier] || []).push(g); });
  const rows = grades.map(g => `<div class="stu"><div class="stu-name">${g.name}</div><div class="stu-track"><div class="stu-fill ${g.cls}" style="width:${g.avg}%"></div></div><div class="stu-num">${g.avg}</div></div>`).join("");
  const groupHtml = Object.keys(groups).map(k => `<div style="margin-top:8px"><b>${k}</b>：${groups[k].map(g => g.name).join("、")} → 推送 ${groups[k][0].rec}</div>`).join("");
  const el = $("#m2Adapt", out); el.classList.remove("hidden");
  el.innerHTML = `<div class="card"><div class="card-head"><div class="card-title">学情适配 · 分层推送</div><span class="tag gold">按掌握度自动分组</span></div>
    <div class="card-body"><div class="grid grid-2"><div>${rows}</div><div class="note">${groupHtml}</div></div></div></div>`;
}

/* ================= M3 过程反馈 ================= */
function analyzeWriting(text) {
  const anns = [];
  if (!text.trim()) {
    return { anns: [{ seg: "空白", type: "内容", why: "还没有输入作文", fix: "先写 3–5 句", next: "围绕主题写清楚时间、地点、活动" }], scores: [{ name: "语法", val: 2 }, { name: "词汇", val: 2 }, { name: "结构", val: 2 }, { name: "内容", val: 2 }], praise: "先动笔写几句，我再帮你改。" };
  }
  const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
  days.forEach(d => {
    if (new RegExp("\\b" + d + "\\b").test(text)) {
      anns.push({ seg: d, type: "大小写", why: "星期首字母需要大写", fix: d.charAt(0).toUpperCase() + d.slice(1), next: "检查所有专有名词是否大写" });
    }
  });
  const rep = text.match(/\b([A-Za-z]+)\s+(he|she)\s+(is|was|has)\b/);
  if (rep) anns.push({ seg: rep[0], type: "主语重复", why: "一个句子里出现了两个主语", fix: rep[1] + " " + rep[3], next: "每句只保留一个主语" });
  if (/like\s+it\s+very\s+much/i.test(text)) anns.push({ seg: "like it very much", type: "表达单一", why: "可以换成更丰富的表达", fix: "really enjoy it", next: "尝试用 enjoy / love 替换 like" });
  if (!/[.!?]$/.test(text.trim())) anns.push({ seg: "句末", type: "标点", why: "句末缺少标点", fix: "在结尾加一个 .", next: "每句结尾检查标点" });
  if (!anns.length) anns.push({ seg: "整体", type: "优点", why: "句子结构完整、用词准确", fix: "继续保持", next: "尝试用连接词让文章更连贯" });
  const issues = anns.filter(a => a.type !== "优点").length;
  const scores = [
    { name: "语法", val: Math.max(2, 5 - Math.min(3, issues)) },
    { name: "词汇", val: Math.max(2, 5 - Math.min(2, issues)) },
    { name: "结构", val: Math.max(2, 5 - Math.ceil(issues / 2)) },
    { name: "内容", val: Math.max(2, 5 - Math.ceil(issues / 3)) }
  ];
  const praise = issues === 0 ? "书写清楚、表达完整，继续保持！" : "能围绕主题展开，改掉这几处会更棒！";
  return { anns, scores, praise };
}

function writingFeedbackHTML(text) {
  const R = analyzeWriting(text || "");
  const anns = R.anns.map(a => `<div class="anno"><div class="anno-seg">${esc(a.seg)}</div>
    <div class="anno-meta">【${esc(a.type)}】${esc(a.why)} → <span class="anno-fix">${esc(a.fix)}</span></div>
    <div class="anno-next">下一步：${esc(a.next)}</div></div>`).join("");
  const bars = R.scores.map(s => `<div class="bar-row"><div class="bar-lbl">${s.name}</div><div class="bar-track"><div class="bar-fill" style="width:${s.val * 20}%"></div></div><div class="bar-val">${s.val}/5</div></div>`).join("");
  return `<div class="grid grid-2"><div class="card"><div class="card-head"><div class="card-title">逐句批注（错因 · 改写 · 下一步）</div></div><div class="card-body">${anns}</div></div>
    <div class="card"><div class="card-head"><div class="card-title">多维评分</div></div><div class="card-body"><div class="score-bars">${bars}</div>
    <div class="note" style="margin-top:12px">💬 ${esc(R.praise)}</div></div></div></div>`;
}
function oralFeedbackHTML(transcript, seconds) {
  const O = DATA.oral;
  const text = transcript && transcript.trim() ? transcript.trim() : O.transcript;
  const bars = O.scores.map(s => `<div class="bar-row"><div class="bar-lbl">${s.name}</div><div class="bar-track"><div class="bar-fill" style="width:${s.val}%"></div></div><div class="bar-val">${s.val}</div></div>`).join("");
  const issues = O.issues.map(i => `<li>${esc(i)}</li>`).join("");
  const tag = seconds ? `<span class="tag green">🎧 你的录音 ${seconds} 秒</span>` : "";
  return `<div class="grid grid-2"><div class="card"><div class="card-head"><div class="card-title">转写与录音</div>${tag}</div><div class="card-body"><div class="note">“${esc(text)}”</div></div></div>
    <div class="card"><div class="card-head"><div class="card-title">四维评分</div></div><div class="card-body"><div class="score-bars">${bars}</div></div></div>
  </div><div class="card" style="margin-top:16px"><div class="card-head"><div class="card-title">发音与表达建议</div></div><div class="card-body"><ul class="note" style="margin-left:16px">${issues}</ul>
    <div class="note" style="margin-top:10px">💬 ${esc(O.praise)}</div>
    <div class="note" style="margin-top:6px;color:#9aa6c8">（评分为演示数据；接入语音评测 API 后可基于真实录音打分）</div></div></div>`;
}
function renderM3() {
  return `<div class="card"><div class="card-body">
    <div class="tabs" id="m3Tabs"><div class="tab active" data-tab="w">写作反馈</div><div class="tab" data-tab="o">口语反馈</div></div>
    <div id="m3Panel"></div>
  </div></div>`;
}
function initM3(root) {
  const panel = $("#m3Panel", root);
  function showWriting() {
    panel.innerHTML = `<div class="field"><label>学生写作初稿（可编辑）</label><textarea id="wtext" rows="5">${esc(DATA.writing.text)}</textarea></div>
      <div class="row" style="margin-top:12px"><button class="btn primary" id="wGen">💬 生成反馈</button><span class="note">默认给建议，不直接代写</span></div>
      <div id="wOut" class="hidden" style="margin-top:16px"></div>`;
    $("#wGen", panel).addEventListener("click", () => {
      const o = $("#wOut", panel); o.classList.remove("hidden");
      o.innerHTML = writingFeedbackHTML($("#wtext", panel).value);
      toast("写作反馈已生成");
    });
  }
  function showOral() {
    panel.innerHTML = `
    <div class="card"><div class="card-head"><div class="card-title">🎙 口语录音与评测</div><span class="tag" id="recState">未录音</span></div>
      <div class="card-body">
        <div class="row">
          <button class="btn primary" id="recBtn">● 开始录音</button>
          <span class="note" id="recTime">00:00</span>
          <span class="spacer"></span>
          <button class="btn" id="oGen" disabled>💬 生成口语反馈</button>
        </div>
        <audio id="recAudio" controls style="width:100%;margin-top:12px;display:none"></audio>
        <div class="note" id="recNote" style="margin-top:8px">点击「开始录音」，对着麦克风说一句英语；停止后可回放自己的声音。</div>
      </div></div>
    <div id="oOut" class="hidden" style="margin-top:16px"></div>`;

    let mediaRecorder = null, chunks = [], stream = null, timer = null, seconds = 0, audioURL = null;
    const recBtn = $("#recBtn", panel), recState = $("#recState", panel), recTime = $("#recTime", panel),
          recAudio = $("#recAudio", panel), recNote = $("#recNote", panel), oGen = $("#oGen", panel);

    function fmt(s) { return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0"); }

    async function startRec() {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        recNote.textContent = "当前浏览器不支持录音。请用 http://127.0.0.1:8848/static/lab/ 打开并允许麦克风。";
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (e) {
        recNote.textContent = "无法访问麦克风：" + e.message + "（请允许权限；不要用 file:// 直接打开页面）";
        return;
      }
      chunks = []; seconds = 0; recTime.textContent = "00:00";
      mediaRecorder = new MediaRecorder(stream);
      mediaRecorder.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: "audio/webm" });
        if (audioURL) URL.revokeObjectURL(audioURL);
        audioURL = URL.createObjectURL(blob);
        recAudio.src = audioURL; recAudio.style.display = "block";
        recState.textContent = "已录音 " + seconds + "s"; recState.className = "tag green";
        recBtn.textContent = "● 重新录音";
        oGen.disabled = false;
        if (stream) stream.getTracks().forEach(t => t.stop());
      };
      mediaRecorder.start();
      recState.textContent = "录音中…"; recState.className = "tag red";
      recBtn.textContent = "■ 停止";
      timer = setInterval(() => { seconds++; recTime.textContent = fmt(seconds); }, 1000);
    }

    function stopRec() {
      if (mediaRecorder && mediaRecorder.state !== "inactive") mediaRecorder.stop();
      clearInterval(timer);
    }

    recBtn.addEventListener("click", () => {
      if (mediaRecorder && mediaRecorder.state === "recording") stopRec();
      else startRec();
    });

    oGen.addEventListener("click", () => {
      const o = $("#oOut", panel); o.classList.remove("hidden");
      o.innerHTML = oralFeedbackHTML("", seconds);
      toast("口语反馈已生成");
    });
  }
  $$(".tab", $("#m3Tabs", root)).forEach(t => t.addEventListener("click", () => {
    $$(".tab", $("#m3Tabs", root)).forEach(x => x.classList.remove("active"));
    t.classList.add("active");
    t.dataset.tab === "w" ? showWriting() : showOral();
  }));
  showWriting();
}

/* ================= M4 命题评价（已按要求移除） ================= */

/* ================= M5 资源 ================= */
function renderM5() {
  return `<div class="card"><div class="card-body">
    <div class="tabs" id="m5Tabs">
      <div class="tab active" data-tab="d">情境对话</div><div class="tab" data-tab="r">阅读提问链</div>
      <div class="tab" data-tab="t">复述任务卡</div><div class="tab" data-tab="i">课堂互动</div>
    </div>
    <div id="m5Panel"></div>
  </div></div>`;
}
function initM5(root) {
  const panel = $("#m5Panel", root);

  function showDialogue() {
    const keys = Object.keys(DATA.dialogues);
    panel.innerHTML = `<div class="row" id="dPicker">${keys.map(k => `<button class="btn sm" data-d="${k}">${DATA.dialogues[k].icon} ${DATA.dialogues[k].cn}</button>`).join("")}</div>
      <div id="dCard" style="margin-top:14px"></div>`;
    function paint(k) {
      const d = DATA.dialogues[k];
      $("#dCard", panel).innerHTML = `<div class="dialogue" style="background:${d.grad}">
        <div class="d-title">${d.icon} ${d.title}</div><div class="d-sub">${d.cn} · 角色：${d.roles.join(" / ")}</div>
        ${d.lines.map(l => `<div class="d-line"><span class="d-role">${esc(l[0])}</span><span class="d-text">${esc(l[1])}</span></div>`).join("")}
      </div>`;
    }
    $$("#dPicker button", panel).forEach(b => b.addEventListener("click", () => paint(b.dataset.d)));
    paint(keys[0]);
  }

  function showReading() {
    const list = DATA.readings;
    panel.innerHTML = `<div class="row" id="rPicker">${list.map((r, i) => `<button class="btn sm" data-r="${i}">📖 ${esc(r.title)}</button>`).join("")}</div>
      <div id="rBody" style="margin-top:14px"></div>`;
    function paint(i) {
      const R = list[i];
      $("#rBody", panel).innerHTML = `<div class="card" style="border-style:dashed"><div class="card-body"><div class="note" style="line-height:1.9">${esc(R.text)}</div></div></div>
        <div class="card" style="margin-top:14px"><div class="card-head"><div class="card-title">${esc(R.title)} · 提问链</div><span class="tag">字面 → 推断 → 评价 → 迁移</span></div><div class="card-body">
        ${R.chain.map(c => `<div class="chain-item"><div class="chain-lv">${c.level}</div><div class="chain-q">${esc(c.q)}</div></div>`).join("")}</div></div>`;
    }
    $$("#rPicker button", panel).forEach(b => b.addEventListener("click", () => paint(+b.dataset.r)));
    paint(0);
  }

  function showRetell() {
    const list = DATA.readings;
    panel.innerHTML = `<div class="row" id="tPicker">${list.map((r, i) => `<button class="btn sm" data-t="${i}">📖 ${esc(r.title)}</button>`).join("")}</div>
      <div id="tBody" style="margin-top:14px"></div>`;
    function paint(i) {
      const R = list[i];
      $("#tBody", panel).innerHTML = `<div class="retell">
        <div><div class="note" style="margin-bottom:8px">关键词</div><div class="kw-cloud">${R.keywords.map(k => `<span class="kw">${esc(k)}</span>`).join("")}</div></div>
        <div><div class="note" style="margin-bottom:8px">复述支架（按问题复述）</div>${R.chain.map(c => `<div class="frame">${esc(c.q)}</div>`).join("")}</div></div>`;
    }
    $$("#tPicker button", panel).forEach(b => b.addEventListener("click", () => paint(+b.dataset.t)));
    paint(0);
  }

  function showInteraction() {
    panel.innerHTML = `<div class="grid grid-2">
      <div class="card"><div class="card-head"><div class="card-title">随机点名 · 回答点评</div><span class="tag">老师手动输入回答</span></div><div class="card-body">
        <div class="field"><label>课堂问题</label><input id="pickQ" value="What would you like to eat?" /></div>
        <div class="picker-name" id="pickName">—</div>
        <div class="row"><button class="btn primary" id="pickBtn">🎲 随机点名</button><span class="note">抽到学生后，把他的回答输入下方</span></div>
        <div class="field" style="margin-top:10px"><label>学生回答（手动输入）</label><textarea id="pickAnsInput" rows="2" placeholder="把学生说的 / 写的英语回答输入这里…"></textarea></div>
        <div class="row" style="margin-top:8px"><button class="btn primary" id="pickAnsSubmit">✅ 提交并点评</button></div>
        <div class="answer-box" id="pickAnsBox"><span class="note">输入回答后点击「提交并点评」，系统会给出星级与修改建议。</span></div>
      </div></div>
      <div class="card"><div class="card-head"><div class="card-title">课堂投票</div></div><div class="card-body" id="voteBox"></div></div>
    </div>`;
    let timer = null;
    $("#pickBtn", panel).addEventListener("click", () => {
      const names = DATA.students.map(s => s.name);
      clearInterval(timer); let n = 0;
      timer = setInterval(() => {
        $("#pickName", panel).textContent = names[Math.floor(Math.random() * names.length)];
        if (++n > 14) { clearInterval(timer); toast("请这位同学回答～"); }
      }, 70);
    });
    $("#pickAnsSubmit", panel).addEventListener("click", () => {
      const q = $("#pickQ", panel).value.trim();
      const a = $("#pickAnsInput", panel).value.trim();
      const box = $("#pickAnsBox", panel);
      if (!a) { box.innerHTML = '<span class="note">还没有输入回答，请先输入学生的英语回答。</span>'; return; }
      const r = evaluateAnswer(q, a);
      box.innerHTML = `<div class="row"><b>评分</b><span style="color:#f5a623;letter-spacing:2px;font-size:16px">${"★".repeat(r.stars)}${"☆".repeat(5 - r.stars)}</span></div>
        <div class="note" style="margin-top:6px">${r.tips.length ? "建议：" + r.tips.map(t => esc(t)).join("；") : "回答完整，很棒！"}</div>`;
    });
    let votes = [
      { t: "I'd like a hamburger", v: 0 },
      { t: "I'd like a salad", v: 0 },
      { t: "I'd like an ice cream", v: 0 }
    ];

    function paintVote() {
      const box = $("#voteBox", panel);
      box.innerHTML = `
        <div class="row" style="margin-bottom:10px">
          <input id="voteText" placeholder="输入一个句子作为投票选项…" style="flex:1;min-width:0;padding:9px 11px;border:1px solid var(--line);border-radius:9px;font-family:inherit;font-size:13px;outline:none" />
          <button class="btn primary sm" id="voteAdd">＋ 添加</button>
        </div>
        <div id="voteList"></div>
        <div class="row" style="margin-top:8px">
          <button class="btn sm" id="voteReset">重置票数</button>
          <span class="note">可直接修改选项文字；点「×」删除</span>
        </div>`;

      const list = $("#voteList", panel);
      list.innerHTML = votes.length
        ? votes.map((o, i) => `
          <div class="vote-row">
            <input class="vote-input" data-edit="${i}" value="${esc(o.t)}" />
            <span class="tag">${o.v} 票</span>
            <button class="btn sm" data-vote="${i}">投一票</button>
            <button class="btn sm" data-del="${i}">×</button>
          </div>`).join("")
        : '<div class="note">还没有选项，先输入一个句子并添加。</div>';

      $$("[data-vote]", list).forEach(b => b.addEventListener("click", () => { votes[+b.dataset.vote].v++; paintVote(); }));
      $$("[data-del]", list).forEach(b => b.addEventListener("click", () => { votes.splice(+b.dataset.del, 1); paintVote(); }));
      $$("[data-edit]", list).forEach(inp => inp.addEventListener("input", () => { votes[+inp.dataset.edit].t = inp.value; }));

      $("#voteAdd", box).addEventListener("click", addVote);
      $("#voteText", box).addEventListener("keydown", (e) => { if (e.key === "Enter") addVote(); });
      $("#voteReset", box).addEventListener("click", () => { votes.forEach(v => { v.v = 0; }); paintVote(); });
    }

    function addVote() {
      const el = $("#voteText", panel);
      const t = el.value.trim();
      if (!t) return;
      votes.push({ t, v: 0 });
      paintVote();
    }

    paintVote();
  }

  $$(".tab", $("#m5Tabs", root)).forEach(t => t.addEventListener("click", () => {
    $$(".tab", $("#m5Tabs", root)).forEach(x => x.classList.remove("active"));
    t.classList.add("active");
    ({ d: showDialogue, r: showReading, t: showRetell, i: showInteraction })[t.dataset.tab]();
  }));
  showDialogue();
}

/* ================= M6 游戏 ================= */
function renderM6() {
  return `<div class="card game-wrap"><div class="card-body">
    <div class="tabs" id="m6Tabs">
      <div class="tab active" data-tab="map">🗺 闯关地图</div>
      <div class="tab" data-tab="sentence">🧩 连词成句</div>
      <div class="tab" data-tab="pairs">🔗 单词配对</div>
      <div class="tab" data-tab="memory">🃏 记忆翻牌</div>
      <div class="tab" data-tab="whack">🔨 打地鼠</div>
      <div class="tab" data-tab="jump">🏝 跳跳岛</div>
      <div class="tab" data-tab="delivery">🛵 单词快递员</div>
    </div>
    <div id="m6Panel"></div>
  </div></div>`;
}
function initM6(root) {
  const panel = $("#m6Panel", root);
  /* 老师设置的词表优先；没设置时回落到内置示例 */
  function resolveGames() {
    const base = ANIMALS.active ? ANIMALS.games : DATA.games;
    return window.WordSet ? WordSet.games(base) : base;
  }
  let games = resolveGames();
  let score = 0;

  if (window.WordSet) {
    WordSet.onChange = function () {
      games = resolveGames();
      if (window.JumpGame) JumpGame.stop();
      clearM6Timer();
      showMap();
    };
  }

  /* ---- 连词成句（计时 + 连击 + 提示 + 评级） ---- */
  function showSentence() {
    clearM6Timer();
    let idx = 0, selected = [], streak = 0, timeLeft = 90, finished = false;
    const total = games.sentences.length;

    panel.innerHTML = `
      <div class="row" style="margin-bottom:10px">
        <span class="tag">第 <b id="sProg">1</b>/${total} 句</span>
        <span class="tag gold">得分 <b id="sScore">${score}</b></span>
        <span class="tag green">连击 <b id="sStreak">0</b></span>
        <span class="spacer"></span>
        <span class="tag red">⏱ <b id="sTime">90</b>s</span>
      </div>
      <div class="note" id="sHint" style="margin-bottom:8px"></div>
      <div class="sentence-area" id="sSentence"></div>
      <div class="word-bank" id="sBank"></div>
      <div class="row" style="margin-top:14px">
        <button class="btn primary" id="sCheck">✅ 检查</button>
        <button class="btn" id="sHintBtn">💡 提示（-3）</button>
        <button class="btn" id="sNext">下一句 ▶</button>
      </div>
      <div class="note" id="sResult" style="margin-top:10px"></div>`;

    function paint() {
      const pool = panel._pool, sel = panel._selected;
      $("#sSentence", panel).innerHTML = sel.map(id => { const p = pool.find(x => x.id === id); return `<span class="slot-chip" data-rm="${id}">${esc(p.w)}</span>`; }).join("") || '<span class="note">点击下方单词组成句子…</span>';
      $("#sBank", panel).innerHTML = pool.filter(p => !p.used).map(p => `<span class="word-chip" data-add="${p.id}">${esc(p.w)}</span>`).join("");
      $$("[data-add]", panel).forEach(b => b.addEventListener("click", () => { const p = pool.find(x => x.id === +b.dataset.add); if (p && !p.used) { p.used = true; sel.push(p.id); paint(); } }));
      $$("[data-rm]", panel).forEach(b => b.addEventListener("click", () => { const id = +b.dataset.rm; const p = pool.find(x => x.id === id); if (p) p.used = false; sel.splice(sel.indexOf(id), 1); paint(); }));
    }

    function load(i) {
      idx = i; selected = [];
      const item = games.sentences[i];
      const pool = shuffle(item.target.split(" ")).map((w, j) => ({ w, used: false, id: j }));
      panel._pool = pool; panel._item = item; panel._selected = selected;
      $("#sProg", panel).textContent = i + 1;
      $("#sHint", panel).textContent = "提示：" + item.hint;
      $("#sResult", panel).textContent = "";
      paint();
    }

    function finish() {
      if (finished) return;
      finished = true;
      clearM6Timer();
      const stars = score >= 80 ? "★★★" : score >= 50 ? "★★☆" : "★☆☆";
      panel.innerHTML = `<div class="card"><div class="card-body" style="text-align:center;padding:32px">
        <div style="font-size:44px">🧩</div>
        <h3 style="margin:8px 0">本局结束</h3>
        <div style="font-size:22px;color:#f5a623;letter-spacing:4px">${stars}</div>
        <p class="note" style="margin-top:8px">总分 ${score} 分 · 完成 ${idx + 1} 句</p>
        <button class="btn primary" id="sAgain" style="margin-top:10px">再玩一次</button>
      </div></div>`;
      $("#sAgain", panel).addEventListener("click", showSentence);
    }

    load(0);

    $("#sCheck", panel).addEventListener("click", () => {
      if (finished) return;
      const target = games.sentences[idx].target;
      const built = panel._selected.map(id => panel._pool.find(x => x.id === id).w).join(" ");
      const r = $("#sResult", panel);
      if (built.trim().toLowerCase() === target.toLowerCase()) {
        const gain = 10 + streak * 5;
        score += gain; streak++;
        $("#sScore", panel).textContent = score;
        $("#sStreak", panel).textContent = streak;
        r.style.color = "#0f8f55";
        r.textContent = `✅ 正确！+${gain} 分${streak > 1 ? "（连击 x" + streak + "）" : ""}`;
      } else {
        streak = 0; score = Math.max(0, score - 2);
        $("#sScore", panel).textContent = score;
        $("#sStreak", panel).textContent = 0;
        r.style.color = "#c33";
        r.textContent = "❌ 语序还不对，再调整一下（-2 分）";
      }
    });

    $("#sHintBtn", panel).addEventListener("click", () => {
      if (finished) return;
      score = Math.max(0, score - 3);
      $("#sScore", panel).textContent = score;
      const first = games.sentences[idx].target.split(" ")[0];
      const r = $("#sResult", panel);
      r.style.color = "#a9740b";
      r.textContent = `💡 第一个词是：${first}（-3 分）`;
    });

    $("#sNext", panel).addEventListener("click", () => {
      if (finished) return;
      if (idx + 1 < total) load(idx + 1);
      else finish();
    });

    m6Timer = setInterval(() => {
      if (finished) return;
      timeLeft--;
      const el = $("#sTime", panel);
      if (el) el.textContent = timeLeft;
      if (timeLeft <= 0) finish();
    }, 1000);
  }

  /* ---- 单词配对（计时 + 连击 + 评级） ---- */
  function showPairs() {
    clearM6Timer();
    const left = shuffle(games.pairs.map((p, i) => ({ t: p.en, i })));
    const right = shuffle(games.pairs.map((p, i) => ({ t: p.cn, i })));
    let selL = null, selR = null, done = 0, streak = 0, roundScore = 0, timeLeft = 60, finished = false;

    panel.innerHTML = `
      <div class="row" style="margin-bottom:12px">
        <span class="tag">已配对 <b id="pDone">0</b>/${left.length}</span>
        <span class="tag gold">本局得分 <b id="pScore">0</b></span>
        <span class="tag green">连击 <b id="pStreak">0</b></span>
        <span class="spacer"></span>
        <span class="tag red">⏱ <b id="pTime">60</b>s</span>
      </div>
      <div class="pairs">
        <div class="pair-col">${left.map(x => `<button class="pair-tile" data-side="l" data-i="${x.i}">${esc(x.t)}</button>`).join("")}</div>
        <div class="pair-col">${right.map(x => `<button class="pair-tile" data-side="r" data-i="${x.i}">${esc(x.t)}</button>`).join("")}</div>
      </div>
      <div class="row" style="margin-top:12px"><button class="btn" id="pReset">🔄 重新开始</button></div>`;

    function upd() {
      const d = $("#pDone", panel); if (d) d.textContent = done;
      const s = $("#pScore", panel); if (s) s.textContent = roundScore;
      const k = $("#pStreak", panel); if (k) k.textContent = streak;
    }

    function finish(win) {
      if (finished) return;
      finished = true;
      clearM6Timer();
      const maxScore = left.length * (left.length + 9);
      const stars = roundScore >= maxScore * 100 / 136 ? "★★★" : roundScore >= maxScore * 60 / 136 ? "★★☆" : "★☆☆";
      panel.innerHTML = `<div class="card"><div class="card-body" style="text-align:center;padding:32px">
        <div style="font-size:44px">${win ? "🎉" : "⏰"}</div>
        <h3 style="margin:8px 0">${win ? "全部配对成功！" : "时间到！"}</h3>
        <div style="font-size:22px;color:#f5a623;letter-spacing:4px">${stars}</div>
        <p class="note" style="margin-top:8px">本局得分 ${roundScore} 分</p>
        <button class="btn primary" id="pAgain" style="margin-top:10px">再来一局</button>
      </div></div>`;
      $("#pAgain", panel).addEventListener("click", showPairs);
    }

    $$(".pair-tile", panel).forEach(t => t.addEventListener("click", () => {
      if (finished || t.classList.contains("done")) return;
      if (t.dataset.side === "l") { if (selL) selL.classList.remove("sel"); selL = t; }
      else { if (selR) selR.classList.remove("sel"); selR = t; }
      t.classList.add("sel");
      if (selL && selR) {
        const a = selL, b = selR;
        if (a.dataset.i === b.dataset.i) {
          a.classList.add("done"); b.classList.add("done"); selL = selR = null; done++;
          const points = 10 + streak * 2;
          score += points; roundScore += points; streak++;
          upd();
          if (done === left.length) finish(true);
        } else {
          const penalty = Math.min(3, roundScore);
          streak = 0; score -= penalty; roundScore -= penalty;
          a.classList.add("bad"); b.classList.add("bad"); selL = selR = null;
          upd();
          setTimeout(() => { a.classList.remove("bad", "sel"); b.classList.remove("bad", "sel"); }, 500);
        }
      }
    }));

    $("#pReset", panel).addEventListener("click", showPairs);

    m6Timer = setInterval(() => {
      if (finished) return;
      timeLeft--;
      const el = $("#pTime", panel);
      if (el) el.textContent = timeLeft;
      if (timeLeft <= 0) finish(false);
    }, 1000);
  }

  /* ---- 闯关地图（卡通可点击） ---- */
  const LEVELS = [
    { key: "sentence", icon: "🧩", name: "连词成句", sub: "把打乱的单词排成句子", color: "mint" },
    { key: "pairs", icon: "🔗", name: "单词配对", sub: "英文和中文配对消除", color: "sky" },
    { key: "memory", icon: "🃏", name: "记忆翻牌", sub: "翻开卡片，记住配对", color: "peach" },
    { key: "whack", icon: "🔨", name: "打地鼠", sub: "敲对英文单词得分", color: "lemon" },
    { key: "jump", icon: "🦘", name: "单词跳跳岛", sub: ANIMALS.active ? "跳跃收集动物词卡" : "跳跃收集水果，闯三座小岛", color: "sky" },
    { key: "delivery", icon: "🛵", name: "单词快递员", sub: "收集目标单词，送回左下角 SHOP", color: "mint" }
  ];
  function go(key) {
    const tab = $$("#m6Tabs .tab", root).find(t => t.dataset.tab === key);
    if (tab) tab.click();
  }
  function showMap() {
    const wordCount = window.WordSet ? WordSet.words().length : 0;
    panel.innerHTML = `
      <div class="adv-head">
        <div><div class="adv-title">🏝 单词冒险岛</div><div class="adv-sub">选一个关卡开始挑战，答对攒积分！</div></div>
        <div class="row" style="align-items:center;gap:10px">
          <button class="btn" id="m6WordBtn">⚙️ 词表设置${wordCount ? "（" + wordCount + " 词）" : ""}</button>
          <div class="adv-score">⭐ 积分 <b>${score}</b></div>
        </div>
      </div>
      <div class="adv-grid">
        ${LEVELS.map((l, i) => `
          <button class="adv-card ${l.color}" data-go="${l.key}">
            <div class="adv-ico">${l.icon}</div>
            <div class="adv-name">第 ${i + 1} 关 · ${l.name}</div>
            <div class="adv-desc">${l.sub}</div>
            <div class="adv-stars">★★★</div>
            <div class="adv-go">开始 ▶</div>
          </button>`).join("")}
      </div>
      <div class="adv-foot">${ANIMALS.active ? "💡 选一关练习动物词汇。游戏结束后，可以用同一个词做问答。" : "💡 6 个关卡都用「⚙️ 词表设置」里的单词与句子，改完立刻生效。"}</div>`;
    $$("[data-go]", panel).forEach(b => b.addEventListener("click", () => go(b.dataset.go)));
    const wordBtn = $("#m6WordBtn", panel);
    if (wordBtn) wordBtn.addEventListener("click", () => {
      if (!window.WordSet) return toast("词表模块未加载");
      WordSet.openDialog();
    });
  }

  /* ---- 记忆翻牌（英文 ↔ 中文） ---- */
  function showMemory() {
    /* 中文缺省时用配对表补齐，兼容只有 emoji+en 的旧数据 */
    const cnOf = {};
    (games.pairs || []).forEach(p => { cnOf[String(p.en).toLowerCase()] = p.cn; });
    const data = (games.memory || []).slice(0, 8).map(m => ({
      en: m.en,
      zh: m.zh || m.cn || cnOf[String(m.en).toLowerCase()] || m.emoji || m.en
    }));
    const deck = [];
    data.forEach((p, i) => {
      deck.push({ pair: i, face: p.en, kind: "en" });
      deck.push({ pair: i, face: p.zh, kind: "zh" });
    });
    const shuffled = shuffle(deck);
    let first = null, lock = false, matched = 0;
    panel.innerHTML = `
      <div class="mem-head"><span>配对成功 <b id="memMatched">0</b> / ${data.length}</span><span class="spacer"></span><span class="note">翻开两张，英文配中文，配对成功即保留</span></div>
      <div class="mem-grid" id="memGrid">
        ${shuffled.map((c, i) => `<button class="mem-card" data-pair="${c.pair}"><span class="mem-face ${c.kind === "zh" ? "is-zh" : "is-en"}">${esc(c.face)}</span></button>`).join("")}
      </div>
      <div class="mem-foot"><button class="btn" id="memReset">🔄 重新洗牌</button></div>`;
    const cards = $$(".mem-card", panel);
    cards.forEach((card) => card.addEventListener("click", () => {
      if (lock || card.classList.contains("flip") || card.classList.contains("matched")) return;
      card.classList.add("flip");
      if (!first) { first = card; return; }
      const a = first, b = card; first = null;
      if (a.dataset.pair === b.dataset.pair) {
        setTimeout(() => {
          a.classList.add("matched"); b.classList.add("matched");
          matched++; score += 5;
          const m = $("#memMatched", panel); if (m) m.textContent = matched;
          if (matched === data.length) toast("🎉 全部配对成功！");
        }, 260);
      } else {
        lock = true;
        setTimeout(() => { a.classList.remove("flip"); b.classList.remove("flip"); lock = false; }, 680);
      }
    }));
    $("#memReset", panel).addEventListener("click", () => showMemory());
  }

  /* ---- 打地鼠 ---- */
  function showWhack() {
    const G = games.whack;
    let running = false, tIdx = 0, timeLeft = 45, hits = 0, misses = 0;
    panel.innerHTML = `
      <div class="whack-head">
        <div class="whack-target">要打：<b id="whackCn">—</b></div>
        <div class="whack-time">⏱ <b id="whackTime">45</b>s</div>
        <div class="whack-score">得分 <b id="whackScore">0</b></div>
      </div>
      <div class="whack-grid" id="whackGrid">
        ${Array.from({ length: 9 }).map(() => `<button class="whack-hole"></button>`).join("")}
      </div>
      <div class="row" style="margin-top:12px"><button class="btn primary" id="whackStart">▶ 开始</button><span class="note" id="whackHint">看中文，敲对应的英文单词</span></div>`;

    const holes = $$(".whack-hole", panel);
    const cnEl = $("#whackCn", panel), timeEl = $("#whackTime", panel), scoreEl = $("#whackScore", panel);
    function setTarget() { cnEl.textContent = G.targets[tIdx % G.targets.length].cn; }
    function spawnMole() {
      if (!running) return;
      const empty = holes.filter(h => !h.dataset.word);
      if (!empty.length) return;
      const h = empty[Math.floor(Math.random() * empty.length)];
      const t = G.targets[tIdx % G.targets.length];
      const w = Math.random() < 0.55 ? t.en : G.pool[Math.floor(Math.random() * G.pool.length)];
      h.dataset.word = w; h.textContent = w; h.classList.add("up");
      setTimeout(() => { h.classList.remove("up"); delete h.dataset.word; h.textContent = ""; }, 1100);
    }
    function endGame() {
      running = false; clearM6Timer();
      holes.forEach(h => { h.classList.remove("up"); delete h.dataset.word; h.textContent = ""; });
      score += hits * 10;
      $("#whackHint", panel).innerHTML = `⏰ 时间到！命中 <b>${hits}</b> 次，失误 <b>${misses}</b> 次，本局 +${hits * 10} 分`;
      toast("打地鼠结束，+ " + hits * 10 + " 分");
    }
    holes.forEach(h => h.addEventListener("click", () => {
      if (!running || !h.dataset.word) return;
      const w = h.dataset.word;
      const t = G.targets[tIdx % G.targets.length];
      if (w === t.en) {
        hits++; scoreEl.textContent = hits * 10;
        h.classList.add("hit"); setTimeout(() => h.classList.remove("hit"), 260);
        tIdx++; setTarget();
      } else {
        misses++; scoreEl.textContent = Math.max(0, hits * 10 - misses * 5);
        h.classList.add("miss"); setTimeout(() => h.classList.remove("miss"), 260);
      }
      h.classList.remove("up"); delete h.dataset.word; h.textContent = "";
    }));
    $("#whackStart", panel).addEventListener("click", () => {
      if (running) return;
      running = true; tIdx = 0; timeLeft = 45; hits = 0; misses = 0;
      scoreEl.textContent = "0"; timeEl.textContent = "45"; setTarget();
      m6Timer = setInterval(() => { timeLeft--; timeEl.textContent = timeLeft; if (timeLeft <= 0) endGame(); }, 1000);
      m6Spawn = setInterval(spawnMole, 750);
    });
  }

  function showJump() { JumpGame.mount(panel); }

  /* ---- 单词快递员（第 6 关） ---- */
  function showDelivery() {
    clearM6Timer();
    if (window.JumpGame) JumpGame.stop();
    if (!window.Delivery) {
      panel.innerHTML = '<div class="note">快递员模块未加载（delivery.js 缺失）。</div>';
      return;
    }
    const words = window.WordSet ? WordSet.words() : [];
    const enough = words.length >= 4;
    panel.innerHTML = `
      <div class="adv-head">
        <div><div class="adv-title">🛵 单词快递员</div>
          <div class="adv-sub">方向键 / WASD 移动，找齐 3 个目标单词，送回左下角 SHOP。被幽灵撞到掉一颗心。</div></div>
        <div class="adv-score">⭐ 积分 <b>${score}</b></div>
      </div>
      <div class="note" style="margin:12px 0 16px">
        ${enough
          ? "本关用你设置的 " + words.length + " 个词：" + words.slice(0, 10).map(w => w.en).join(" / ") + (words.length > 10 ? " …" : "")
          : "词表里不足 4 个词，先点右上角「⚙️ 词表设置」补几个。"}
      </div>
      <div class="row">
        <button class="btn primary" id="dvStart" ${enough ? "" : "disabled"}>开始 ▶</button>
        <button class="btn" id="dvBack">返回闯关地图</button>
      </div>`;
    const startBtn = $("#dvStart", panel);
    if (startBtn) startBtn.addEventListener("click", () => {
      const pool = WordSet.words();
      Delivery.start({
        words: pool,
        onFinish: (res) => {
          score += res.points;
          toast("本关 " + res.score + " 分，+" + res.points + " 积分");
          showMap();
        }
      });
    });
    const backBtn = $("#dvBack", panel);
    if (backBtn) backBtn.addEventListener("click", () => {
      const t = $$("#m6Tabs .tab", root).find(x => x.dataset.tab === "map");
      if (t) t.click();
    });
  }

  $$(".tab", $("#m6Tabs", root)).forEach(t => t.addEventListener("click", () => {
    $$(".tab", $("#m6Tabs", root)).forEach(x => x.classList.remove("active"));
    t.classList.add("active");
    if (window.JumpGame) JumpGame.stop();
    clearM6Timer();
    ({ map: showMap, sentence: showSentence, pairs: showPairs, memory: showMemory, whack: showWhack, jump: showJump, delivery: showDelivery })[t.dataset.tab]();
  }));
  showMap();
}
function shuffle(a) { const r = a.slice(); for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; }

/* ================= M7 数字人 ================= */
function renderM7() { return `<div id="dhRoot"></div>`; }
function initM7(root) { DH.mount($("#dhRoot", root)); }

/* ================= 学情看板 ================= */
function renderDashboard() {
  const avg = k => Math.round(DATA.students.reduce((a, s) => a + s[k], 0) / DATA.students.length);
  const kpis = [
    ["82.4", "班级平均分"], ["86%", "学生活跃度"], ["+6.2", "本周提升"], ["12", "待强化人数"]
  ].map(k => `<div class="kpi"><div class="kpi-v">${k[0]}</div><div class="kpi-l">${k[1]}</div></div>`).join("");
  const skills = [["词汇", "vocab"], ["语法", "gram"], ["语音", "pron"], ["语用", "use"]];
  const bars = skills.map(([name, key]) => `<div class="bar-row2"><div class="bl">${name}</div><div class="bt"><div class="bar-track2"><div class="bar-fill2" style="width:${avg(key)}%"></div></div></div><div class="bv">${avg(key)}</div></div>`).join("");

  const t = DATA.trend, w = 560, h = 160, pad = 30, min = 50, max = 100;
  const pts = t.scores.map((s, i) => [pad + i * (w - 2 * pad) / (t.scores.length - 1), h - pad - (s - min) / (max - min) * (h - 2 * pad)]);
  const poly = pts.map(p => p.join(",")).join(" ");
  const dots = pts.map(p => `<circle cx="${p[0]}" cy="${p[1]}" r="4" fill="#4b5cf6"/>`).join("");
  const xlab = t.weeks.map((wk, i) => `<text x="${pts[i][0]}" y="${h - 8}" font-size="10" text-anchor="middle" fill="#8892ac">${wk}</text>`).join("");
  const trend = `<svg viewBox="0 0 ${w} ${h}"><polyline points="${poly}" fill="none" stroke="#4b5cf6" stroke-width="2.5" stroke-linejoin="round"/>${dots}${xlab}</svg>`;

  const H = DATA.heatmap;
  const hmHead = `<div class="hm-name"></div>${H.points.map(p => `<div class="hm-head">${p}</div>`).join("")}`;
  const hmRows = H.rows.map(r => `<div class="hm-name">${r.name}</div>${r.vals.map(v => `<div class="hm-cell" style="background:${heatColor(v)}">${v}</div>`).join("")}`).join("");

  return `<div class="kpi-row">${kpis}</div>
    <div class="grid grid-2" style="margin-top:16px">
      <div class="card"><div class="card-head"><div class="card-title">能力维度掌握度</div></div><div class="card-body"><div class="bars">${bars}</div></div></div>
      <div class="card"><div class="card-head"><div class="card-title">班级成长趋势</div><span class="tag green">+20 分</span></div><div class="card-body"><div class="trend-box" style="border:none;padding:0">${trend}</div></div></div>
    </div>
    <div class="card" style="margin-top:16px"><div class="card-head"><div class="card-title">学生 × 知识点 热力图</div><span class="tag">颜色越深掌握越好</span></div>
      <div class="card-body"><div class="heatmap">${hmHead}${hmRows}</div></div></div>`;
}
function initDashboard() { }

/* ================= 工具生态 ================= */
function renderTools() {
  const rows = DATA.tools.map(t => `<tr><td>${t.cat}</td><td>${t.items.map(x => `<a class="tool-link" href="${x.url}" target="_blank" rel="noopener noreferrer">${esc(x.name)} ↗</a>`).join("")}</td></tr>`).join("");
  const apps = DATA.apps.map(a => `<span class="tag green">${a.name}</span>`).join("");
  const presets = DATA.promptPresets.map((p, i) => `<button class="btn sm" data-preset="${i}">${esc(p.name)}</button>`).join("");
  return `<div class="card"><div class="card-head"><div class="card-title">自研核心 + 可对接工具</div><span class="tag">点击名称直达官网 ↗</span></div>
    <div class="card-body"><table class="tool-table"><thead><tr><th>能力</th><th>可对接 / 参考工具</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="note" style="margin-top:12px">以 Agent 编排层为核心，把上述能力作为“可插拔工具”统一调度；课标对齐、任务链、量规等核心教学逻辑自研。</div></div></div>

    <div class="card" style="margin-top:16px"><div class="card-head"><div class="card-title">🧑‍🏫 AI 提示词教练</div><span class="tag">教老师写出好提示词</span></div>
      <div class="card-body">
        <div class="row" id="pPresets" style="margin-bottom:12px">${presets}</div>
        <div class="grid grid-2">
          <div class="field"><label>角色</label><input id="pRole" value="小学英语教师" /></div>
          <div class="field"><label>教学对象</label><input id="pGrade" value="五年级" /></div>
        </div>
        <div class="field" style="margin-top:10px"><label>任务</label><textarea id="pTask" rows="3">为《Unit 3 What would you like?》设计一节 40 分钟读写课</textarea></div>
        <div class="grid grid-2" style="margin-top:10px">
          <div class="field"><label>输出格式</label><input id="pFormat" value="表格 + 分点说明" /></div>
          <div class="field"><label>约束</label><input id="pConstraint" value="贴近学生生活；活动可操作" /></div>
        </div>
        <div class="row" style="margin-top:12px">
          <button class="btn primary" id="pBuild">✨ 生成提示词</button>
          <button class="btn" id="pCopy" disabled>📋 复制</button>
          <button class="btn" id="pAI" disabled>🤖 AI 优化</button>
        </div>
        <textarea id="pOut" rows="7" readonly style="margin-top:12px;width:100%" placeholder="生成的提示词会出现在这里…"></textarea>
        <div class="note" id="pTip" style="margin-top:6px">提示词 = 角色 + 任务 + 对象 + 格式 + 约束。</div>
      </div></div>

    <div class="card" style="margin-top:16px"><div class="card-head"><div class="card-title">八类应用 → 模块映射</div></div><div class="card-body"><div class="row">${apps}</div></div></div>`;
}

function initTools(root) {
  const roleEl = $("#pRole", root), gradeEl = $("#pGrade", root), taskEl = $("#pTask", root),
        fmtEl = $("#pFormat", root), conEl = $("#pConstraint", root), outEl = $("#pOut", root),
        copyEl = $("#pCopy", root), aiEl = $("#pAI", root), tipEl = $("#pTip", root);

  $$("[data-preset]", root).forEach(b => b.addEventListener("click", () => {
    const p = DATA.promptPresets[+b.dataset.preset];
    roleEl.value = p.role; gradeEl.value = p.grade; taskEl.value = p.task; fmtEl.value = p.format; conEl.value = p.constraints;
    tipEl.textContent = "已填入「" + p.name + "」模板，可继续修改。";
  }));

  function compose() {
    return `你是一位${roleEl.value}。\n【教学对象】${gradeEl.value}\n【任务】${taskEl.value}\n【输出格式】${fmtEl.value}\n【要求】${conEl.value}\n\n请直接给出结果，条理清晰，不要解释你的思考过程。`;
  }

  $("#pBuild", root).addEventListener("click", () => {
    outEl.value = compose();
    copyEl.disabled = false;
    aiEl.disabled = !AI_OK;
    tipEl.textContent = AI_OK ? "已生成，可点「AI 优化」让模型帮你润色。" : "已生成；配置 API Key 后可用「AI 优化」。";
  });

  copyEl.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(outEl.value); toast("提示词已复制"); }
    catch (e) { outEl.select(); document.execCommand("copy"); toast("提示词已复制"); }
  });

  aiEl.addEventListener("click", async () => {
    if (!AI_OK) { toast("需先配置 API Key"); return; }
    aiEl.disabled = true; tipEl.textContent = "AI 正在优化提示词…";
    try {
      const r = await fetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "prompt", message: "请把下面这段给小学英语老师用的提示词改写得更清晰、更可执行，保留原意，只输出改写后的提示词：\n\n" + outEl.value })
      });
      if (!r.ok) throw new Error("bad");
      const j = await r.json();
      if (j.reply) { outEl.value = j.reply; tipEl.textContent = "已优化，可直接复制使用。"; }
    } catch (e) { tipEl.textContent = "AI 优化失败，请检查 Key 或网络。"; }
    aiEl.disabled = false;
  });
}

/* ================= 课前 · 思维导图 ================= */
function renderMindmap() { return `<div id="mmRoot"></div>`; }
function initMindmap(root) { MindMap.mount($("#mmRoot", root)); }

/* ================= 视图注册与路由 ================= */
const VIEWS = {
  home: { title: "产品总览", sub: "课前 · 课中 · 课后 全流程 AI 赋能", render: renderHome, init: initHome },
  m1: { title: "教学设计", sub: "课标/教材目标 → 任务链 · 分层活动 · 语言支架", render: renderM1, init: initM1 },
  mindmap: { title: "思维导图", sub: "课前 · 可视化梳理单元知识结构", render: renderMindmap, init: initMindmap },
  m2: { title: "分层练习", sub: "同一目标 → 多难度练习与变式 · 学情适配", render: renderM2, init: initM2 },
  m3: { title: "过程反馈", sub: "写作 / 口语初稿 → 错因 · 改写 · 下一步", render: renderM3, init: initM3 },
  m5: { title: "资源生成", sub: "情境对话 · 阅读提问链 · 复述卡 · 课堂互动", render: renderM5, init: initM5 },
  m6: { title: "游戏闯关", sub: "英语小游戏 · 闯关地图 · 积分激励", render: renderM6, init: initM6 },
  m7: { title: "数字人对话", sub: "课堂互动环节 · 数字人说英语 · 实时口语对话", render: renderM7, init: initM7 },
  dashboard: { title: "学情看板", sub: "多维学情 · 成长趋势 · 班级热力图", render: renderDashboard, init: initDashboard },
  tools: { title: "工具生态", sub: "自研核心 + 可对接的成熟 AI 工具", render: renderTools, init: initTools }
};

let current = "home";
function navigate(key) {
  if (current === "m7" && key !== "m7") DH.stop();
  if (window.JumpGame) JumpGame.stop();
  clearM6Timer();
  current = key;
try { history.replaceState(null, '', '#' + key); } catch (e) {}
  const v = VIEWS[key];
  if (!v) return;
  $("#pageTitle").textContent = v.title;
  $("#pageSub").textContent = v.sub;
  const view = $("#view");
  view.innerHTML = v.render();
  view.classList.remove("fade-in"); void view.offsetWidth; view.classList.add("fade-in");
  $$(".nav-item").forEach(n => n.classList.toggle("active", n.dataset.view === key));
  if (v.init) v.init(view);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* 全局导航委托（侧边栏 + 首页卡片） */
document.addEventListener("click", (e) => {
  const t = e.target.closest(".nav-item, .col-link");
  if (t && t.dataset.view) navigate(t.dataset.view);
});

/* 启动 */
$("#btnExport").addEventListener("click", () => toast("已导出为 Word / PPT（演示）"));
const __startView = (location.hash || "").replace("#", "");
navigate(VIEWS[__startView] ? __startView : "home");
window.addEventListener("hashchange", () => {
  const k = (location.hash || "").replace("#", "");
  if (VIEWS[k] && k !== current) navigate(k);
});
