/* ================= M7 数字人口语对话引擎（8 个场景） ================= */
window.DH = (function () {

  const SCENES = ANIMALS.active ? { animals: ANIMALS.scene } : {
    restaurant: {
      icon: "🍔", title: "At the Restaurant", cn: "在餐厅 · 点餐",
      grad: "linear-gradient(160deg,#3a1d1d 0%,#160e2b 100%)",
      steps: [
        { dh: "Welcome to Sunny Restaurant! What would you like to eat?", cn: "欢迎来到阳光餐厅！你想吃什么？",
          hint: "I'd like a hamburger, please.", kw: ["hamburger","pizza","noodle","rice","chicken","beef","fish","salad","soup"],
          good: "Nice! You used \"I'd like ...\" — very polite!", retry: "Try: I'd like a hamburger, please." },
        { dh: "Great! Would you like something to drink?", cn: "好的！要来点喝的吗？",
          hint: "I'd like some orange juice.", kw: ["juice","water","milk","cola","tea","coffee","lemonade","sprite"],
          good: "Perfect! \"I'd like ...\" works for drinks too.", retry: "Try: I'd like some orange juice." },
        { dh: "Okay! How much is it altogether?", cn: "好！一共多少钱？",
          hint: "It's thirty yuan.", kw: ["yuan","dollar","dollars","thirty","twenty","ten","fifty","forty"],
          good: "Well done! You can also add \"in total\".", retry: "Try: It's thirty yuan." },
        { dh: "Thank you! Enjoy your meal. Say goodbye to me!", cn: "谢谢！请慢用，跟我道别吧！",
          hint: "Thank you! Goodbye!", kw: ["thank","thanks","bye","goodbye","see you"],
          good: "Excellent! You finished the dialogue. 👏", retry: "Try: Thank you! Goodbye!" }
      ]
    },
    shopping: {
      icon: "👕", title: "At the Clothes Shop", cn: "在服装店 · 购物",
      grad: "linear-gradient(160deg,#331a3f 0%,#160e2b 100%)",
      steps: [
        { dh: "Hi! Welcome to the clothes shop. What can I do for you?", cn: "你好！欢迎光临服装店，需要什么？",
          hint: "I want to buy a T-shirt.", kw: ["t-shirt","tshirt","shirt","dress","skirt","coat","shoes","hat","pants","jacket"],
          good: "Great! \"I want to buy ...\" is very useful.", retry: "Try: I want to buy a T-shirt." },
        { dh: "What size do you need?", cn: "你需要什么尺码？",
          hint: "Size M, please.", kw: ["size","medium","small","large","m","s","l"],
          good: "Good job! Now you can ask about the price.", retry: "Try: Size M, please." },
        { dh: "How about this blue one? How much is it?", cn: "这件蓝色的怎么样？多少钱？",
          hint: "It's fifty yuan.", kw: ["yuan","dollar","dollars","fifty","forty","thirty","twenty"],
          good: "Nice! You can say \"It's too expensive\" to bargain.", retry: "Try: It's fifty yuan." },
        { dh: "Great! Here you are. Anything else?", cn: "好！给你。还需要别的吗？",
          hint: "No, thank you. Goodbye!", kw: ["no","nothing","thank","thanks","bye","goodbye"],
          good: "Perfect! You finished the shopping dialogue. 👏", retry: "Try: No, thank you. Goodbye!" }
      ]
    },
    selfintro: {
      icon: "🙋", title: "Introduce Yourself", cn: "自我介绍",
      grad: "linear-gradient(160deg,#10243f 0%,#0d1030 100%)",
      steps: [
        { dh: "Hello! I'm Lily, your AI English teacher. What's your name?", cn: "你好！我是 Lily，你的 AI 英语老师。你叫什么名字？",
          hint: "My name is ... / I'm ...", kw: ["my name","i'm","i am","name is"],
          good: "Nice to meet you!", retry: "Try: My name is Tom." },
        { dh: "Nice to meet you! How old are you?", cn: "很高兴认识你！你几岁了？",
          hint: "I'm ten years old.", kw: ["years","year","old","ten","eleven","twelve","nine","eight","seven"],
          good: "Great! Numbers are easy for you.", retry: "Try: I'm ten years old." },
        { dh: "What do you like doing in your free time?", cn: "你空闲时间喜欢做什么？",
          hint: "I like playing football.", kw: ["like","playing","reading","singing","drawing","swimming","running","dancing"],
          good: "Wonderful! \"I like + doing\" is correct.", retry: "Try: I like playing football." },
        { dh: "That's wonderful! Tell me one thing about your family.", cn: "太棒了！跟我说一件关于家人的事吧。",
          hint: "There are four people in my family.", kw: ["family","father","mother","brother","sister","parents","people","dad","mom"],
          good: "Excellent! You can introduce your family now. 👏", retry: "Try: There are four people in my family." }
      ]
    },
    asking_way: {
      icon: "🧭", title: "Asking the Way", cn: "问路",
      grad: "linear-gradient(160deg,#0f2e2a 0%,#0d1030 100%)",
      steps: [
        { dh: "Excuse me! Where is the library?", cn: "打扰一下！图书馆在哪里？",
          hint: "Go straight and turn left.", kw: ["go straight","straight","turn left","turn right","left","right"],
          good: "Great directions!", retry: "Try: Go straight and turn left." },
        { dh: "Is it far from here?", cn: "离这儿远吗？",
          hint: "No, it's near.", kw: ["no","near","far","not far","yes"],
          good: "Good! \"near\" means close.", retry: "Try: No, it's near." },
        { dh: "Thank you! How can I get there?", cn: "谢谢！我怎么到那儿？",
          hint: "Walk along this street.", kw: ["walk","along","street","by bus","by bike"],
          good: "Perfect! You gave a clear answer.", retry: "Try: Walk along this street." },
        { dh: "Got it. Thank you very much! Goodbye!", cn: "明白了。非常感谢！再见！",
          hint: "You're welcome. Goodbye!", kw: ["welcome","bye","goodbye","see you"],
          good: "Excellent! You finished the dialogue. 👏", retry: "Try: You're welcome. Goodbye!" }
      ]
    },
    doctor: {
      icon: "🏥", title: "At the Doctor's", cn: "看病",
      grad: "linear-gradient(160deg,#0f2b34 0%,#0d1030 100%)",
      steps: [
        { dh: "Hello! What's the matter with you?", cn: "你好！你哪里不舒服？",
          hint: "I have a cold.", kw: ["cold","fever","headache","cough","stomach","sick","ill"],
          good: "I see. Let me check.", retry: "Try: I have a cold." },
        { dh: "When did it start?", cn: "什么时候开始的？",
          hint: "Since yesterday.", kw: ["yesterday","today","since","last night","this morning"],
          good: "OK, got it.", retry: "Try: Since yesterday." },
        { dh: "Do you have a fever?", cn: "你发烧吗？",
          hint: "Yes, I have a fever.", kw: ["yes","no","fever","have"],
          good: "Thanks for telling me.", retry: "Try: Yes, I have a fever." },
        { dh: "OK. Take this medicine and rest. Goodbye!", cn: "好，吃这个药，好好休息。再见！",
          hint: "Thank you, doctor. Goodbye!", kw: ["thank","thanks","bye","goodbye"],
          good: "Get well soon! 👏", retry: "Try: Thank you, doctor. Goodbye!" }
      ]
    },
    weather: {
      icon: "☀️", title: "Weather Talk", cn: "聊天气",
      grad: "linear-gradient(160deg,#2e2410 0%,#1a1235 100%)",
      steps: [
        { dh: "Good morning! What's the weather like today?", cn: "早上好！今天天气怎么样？",
          hint: "It's sunny.", kw: ["sunny","rainy","cloudy","windy","snowy","hot","cold","warm"],
          good: "Right! Weather words are useful.", retry: "Try: It's sunny." },
        { dh: "Do you like sunny days?", cn: "你喜欢晴天吗？",
          hint: "Yes, I do.", kw: ["yes","no","like","love"],
          good: "Me too!", retry: "Try: Yes, I do." },
        { dh: "What do you usually do on sunny days?", cn: "晴天你通常做什么？",
          hint: "I usually play football.", kw: ["usually","play","football","park","picnic","read"],
          good: "Sounds fun!", retry: "Try: I usually play football." },
        { dh: "Sounds fun! What about rainy days?", cn: "听起来很有趣！那下雨天呢？",
          hint: "I stay at home.", kw: ["stay","home","read","watch","inside"],
          good: "Great! You finished the weather talk. 👏", retry: "Try: I stay at home." }
      ]
    },
    school: {
      icon: "🏫", title: "School Life", cn: "学校生活",
      grad: "linear-gradient(160deg,#1e1a4a 0%,#0d1030 100%)",
      steps: [
        { dh: "Hi! What's your favourite subject?", cn: "嗨！你最喜欢的科目是什么？",
          hint: "My favourite subject is English.", kw: ["favourite","subject","english","math","chinese","music","art","pe"],
          good: "English is fun!", retry: "Try: My favourite subject is English." },
        { dh: "How many classes do you have today?", cn: "你今天有几节课？",
          hint: "I have four classes.", kw: ["four","five","six","three","classes","have"],
          good: "That's a busy day.", retry: "Try: I have four classes." },
        { dh: "What do you do after school?", cn: "放学后你做什么？",
          hint: "I do my homework.", kw: ["homework","play","read","sport","draw","dance"],
          good: "Good habit!", retry: "Try: I do my homework." },
        { dh: "Do you like your school? Why?", cn: "你喜欢你的学校吗？为什么？",
          hint: "Yes, because it's fun.", kw: ["yes","because","fun","like","love","teachers","friends"],
          good: "Excellent! You finished the school talk. 👏", retry: "Try: Yes, because it's fun." }
      ]
    },
    travel: {
      icon: "✈️", title: "At the Airport", cn: "在机场",
      grad: "linear-gradient(160deg,#241a45 0%,#0d1030 100%)",
      steps: [
        { dh: "Welcome to the airport! Where are you going?", cn: "欢迎来到机场！你要去哪里？",
          hint: "I'm going to Beijing.", kw: ["beijing","shanghai","going","go","to"],
          good: "Have a nice trip!", retry: "Try: I'm going to Beijing." },
        { dh: "How will you go there?", cn: "你打算怎么去？",
          hint: "By plane.", kw: ["plane","airplane","train","bus","car","ship"],
          good: "Good choice!", retry: "Try: By plane." },
        { dh: "Do you need help with your bag?", cn: "需要帮忙拿行李吗？",
          hint: "Yes, please.", kw: ["yes","please","no","thanks"],
          good: "Here you are.", retry: "Try: Yes, please." },
        { dh: "Here you are. Have a good time! Goodbye!", cn: "给你。玩得开心！再见！",
          hint: "Thank you! Goodbye!", kw: ["thank","thanks","bye","goodbye"],
          good: "Excellent! You finished the airport dialogue. 👏", retry: "Try: Thank you! Goodbye!" }
      ]
    }
  };

  const state = { key: Object.keys(SCENES)[0], step: 0, score: 0, started: false, waiting: false, mode: "script", history: [] };
  let els = {};
  let voice = null;
  let recog = null;
  let transition = null;

  /* ---------- 语音合成 ---------- */
  function pickVoice() {
    if (!("speechSynthesis" in window)) return;
    const vs = speechSynthesis.getVoices().filter(v => !ANIMALS.active || v.localService);
    voice = vs.find(v => /en[-_]US/i.test(v.lang)) || vs.find(v => /en[-_]GB/i.test(v.lang)) || vs.find(v => /^en/i.test(v.lang)) || null;
  }
  if ("speechSynthesis" in window) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }

  function speak(text, done) {
    if (!("speechSynthesis" in window) || (ANIMALS.active && !voice)) {
      if (done) setTimeout(done, 400);
      return;
    }
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US"; u.rate = 0.92; u.pitch = 1.05;
    if (voice) u.voice = voice;
    els.avatar && els.avatar.classList.add("speaking");
    u.onend = () => { els.avatar && els.avatar.classList.remove("speaking"); done && done(); };
    u.onerror = () => { els.avatar && els.avatar.classList.remove("speaking"); done && done(); };
    speechSynthesis.speak(u);
  }
  function speakCn(text) {
    if (!("speechSynthesis" in window)) return;
    const vs = speechSynthesis.getVoices() || [];
    if (!vs.some(v => /zh/i.test(v.lang))) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "zh-CN"; u.rate = 1; u.volume = 0.85;
    speechSynthesis.speak(u);
  }

  /* ---------- AI 模式（真实大模型） ---------- */
  async function detectMode() {
    try {
      const r = await fetch("/api/health", { cache: "no-store" });
      const j = await r.json();
      state.mode = j && j.hasKey ? "ai" : "script";
    } catch (e) { state.mode = "script"; }
    if (els.mode) {
      els.mode.textContent = state.mode === "ai" ? "● AI 自由对话" : "● 脚本对话";
      els.mode.className = "dh-mode " + state.mode;
    }
  }

  async function askAI(message) {
    const r = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scene: state.key, history: state.history, message })
    });
    if (!r.ok) {
      let msg = "AI 服务不可用";
      try { const j = await r.json(); msg = j.message || msg; } catch (e) {}
      throw new Error(msg);
    }
    const j = await r.json();
    if (!j.reply) throw new Error("AI 返回为空");
    return j.reply;
  }

  /* ---------- 语音识别 ---------- */
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  function setupMic() {
    if (!SR || !els.mic) return;
    const recognition = new SR();
    if (ANIMALS.active) {
      if (!("processLocally" in recognition)) return;
      recognition.processLocally = true;
      if (recognition.processLocally !== true) return;
    }
    recog = recognition;
    recog.lang = "en-US"; recog.interimResults = false; recog.maxAlternatives = 1;
    recog.onstart = () => els.mic.classList.add("listening");
    recog.onend = () => els.mic.classList.remove("listening");
    recog.onresult = (e) => { els.input.value = e.results[0][0].transcript; submit(); };
    recog.onerror = () => { els.mic.classList.remove("listening"); showFeedback("retry", "🎤 语音识别不可用，请用键盘输入。"); };
  }

  /* ---------- DOM 模板 ---------- */
  function template() {
    const sceneBtns = Object.keys(SCENES).map(k => {
      const s = SCENES[k];
      return `<button class="dh-scene" data-key="${k}">${s.icon} ${s.cn.split(" · ")[0]}</button>`;
    }).join("");
    return `
    <div class="dh-app">
      <div class="dh-head">
        <div>
          <div class="dh-badge">课中互动 · 数字人口语对话</div>
          <span class="dh-mode" id="dhMode">${ANIMALS.active ? "● 离线脚本 · 句型练习" : "检测中…"}</span>
          <h2 class="dh-title" id="dhTitle">${SCENES[state.key].title}</h2>
        </div>
        <div class="dh-actions">
          <button class="btn primary" id="dhStart">▶ 开始上课</button>
          <button class="btn" id="dhReplay">🔁 重听</button>
          <button class="btn" id="dhNext">下一轮 ▶</button>
        </div>
      </div>

      <div class="dh-grid">
        <section class="dh-stage" id="dhStage">
          <div class="dh-halo"></div>
          <svg class="dh-avatar" id="dhAvatar" viewBox="0 0 260 320" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="dskin" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffdcc4"/><stop offset="1" stop-color="#f3b892"/></linearGradient>
              <linearGradient id="dshirt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5b7cfa"/><stop offset="1" stop-color="#3b4fd8"/></linearGradient>
              <linearGradient id="dhair" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a2b57"/><stop offset="1" stop-color="#241a3a"/></linearGradient>
            </defs>
            <path d="M55 320 Q58 250 130 236 Q202 250 205 320 Z" fill="url(#dshirt)"/>
            <path d="M110 240 L130 262 L150 240" fill="none" stroke="#2c3aa8" stroke-width="6" stroke-linecap="round"/>
            <rect x="114" y="205" width="32" height="34" rx="14" fill="#f0b58f"/>
            <ellipse cx="130" cy="138" rx="72" ry="80" fill="url(#dskin)"/>
            <ellipse cx="60" cy="145" rx="10" ry="16" fill="#f0b58f"/><ellipse cx="200" cy="145" rx="10" ry="16" fill="#f0b58f"/>
            <path d="M58 120 Q60 46 130 40 Q200 46 202 120 Q196 78 168 66 Q150 58 130 58 Q110 58 92 66 Q64 78 58 120 Z" fill="url(#dhair)"/>
            <path d="M58 120 Q54 160 62 196 L70 150 Z" fill="url(#dhair)"/><path d="M202 120 Q206 160 198 196 L190 150 Z" fill="url(#dhair)"/>
            <path d="M92 118 Q104 110 118 116" stroke="#4a3a63" stroke-width="4" fill="none" stroke-linecap="round"/>
            <path d="M142 116 Q156 110 168 118" stroke="#4a3a63" stroke-width="4" fill="none" stroke-linecap="round"/>
            <g class="dh-eyes"><ellipse cx="104" cy="136" rx="9" ry="12" fill="#243055"/><ellipse cx="156" cy="136" rx="9" ry="12" fill="#243055"/>
              <circle cx="107" cy="132" r="3" fill="#fff"/><circle cx="159" cy="132" r="3" fill="#fff"/></g>
            <ellipse cx="86" cy="162" rx="12" ry="7" fill="#ff9c9c" opacity=".45"/><ellipse cx="174" cy="162" rx="12" ry="7" fill="#ff9c9c" opacity=".45"/>
            <ellipse class="dh-mouth" cx="130" cy="172" rx="19" ry="6" fill="#c94f5a"/>
            <g class="dh-waves" fill="none" stroke="#7fe3ff" stroke-width="4" stroke-linecap="round" opacity="0">
              <path d="M210 150 q14 -10 0 -26"/><path d="M224 158 q22 -14 0 -42"/>
            </g>
          </svg>
          <div class="dh-bubble" id="dhBubble" aria-live="polite">点击「开始上课」，和数字人老师说英语吧！</div>
          <div class="dh-hint" id="dhHint">句型支架：I'd like ...</div>
        </section>

        <aside class="dh-panel">
          <div class="dh-panel-top">
            <span>第 <b id="dhRound">0</b> / <span id="dhTotal">4</span> 轮</span>
            <span>⭐ <b id="dhScore">0</b></span>
          </div>
          <div class="dh-chat" id="dhChat"></div>
          <div class="dh-input-row">
            <button class="btn" id="dhMic" title="点按后说英语">🎤</button>
            <input id="dhInput" placeholder="输入或说出你的回答…" autocomplete="off" disabled/>
            <button class="btn primary" id="dhSend" disabled>发送</button>
          </div>
          <div class="dh-feedback" id="dhFeedback" role="status">等待开始…</div>
        </aside>
      </div>

      <div class="dh-scenes">
        <span class="dh-scenes-lbl">课堂场景：</span>
        ${sceneBtns}
      </div>
    </div>`;
  }

  /* ---------- 渲染与流程 ---------- */
  function addMsg(role, text) {
    const wrap = document.createElement("div");
    wrap.className = "dh-msg " + role;
    const who = document.createElement("span"); who.className = "dh-who";
    who.textContent = role === "dh" ? "AI老师" : "我";
    const txt = document.createElement("span"); txt.textContent = text;
    wrap.append(who, txt);
    els.chat.appendChild(wrap);
    els.chat.scrollTop = els.chat.scrollHeight;
  }

  function setWaiting(on) {
    state.waiting = on;
    els.input.disabled = !on;
    els.send.disabled = !on;
    if (on) els.input.focus({ preventScroll: ANIMALS.active });
  }

  function showFeedback(type, msg, stars) {
    els.feedback.className = "dh-feedback " + type;
    els.feedback.innerHTML = "";
    const t = document.createElement("div"); t.textContent = msg; els.feedback.appendChild(t);
    if (typeof stars === "number") {
      const s = document.createElement("span"); s.className = "dh-stars";
      s.textContent = "⭐".repeat(stars) + "☆".repeat(Math.max(0, 3 - stars));
      els.feedback.appendChild(s);
    }
  }

  function renderStep() {
    const sc = SCENES[state.key];
    const st = sc.steps[state.step];
    els.bubble.textContent = st.dh;
    els.hint.textContent = "句型支架：" + st.hint;
    els.round.textContent = state.step + 1;
    els.total.textContent = sc.steps.length;
    addMsg("dh", st.dh);
    setWaiting(true);
    speak(st.dh);
    if (!ANIMALS.active) speakCn(st.cn);
  }

  function evaluate(text, st) {
    if (st.answer) {
      const normalized = text.toLowerCase().replace(/[’‘]/g, "'").replace(/[.!?。！？]+$/, "").trim().replace(/\s+/g, " ").replace(/^it is /, "it's ");
      return normalized === st.answer;
    }
    const lower = text.toLowerCase().replace(/[^a-z0-9' ]/g, " ");
    return st.kw.some(k => lower.includes(k));
  }

  function submit() {
    if (!state.started || !state.waiting) return;
    const text = els.input.value.trim();
    if (!text) return;
    els.input.value = "";
    addMsg("me", text);
    if (state.mode === "ai") { submitAI(text); return; }
    submitScript(text);
  }

  async function submitAI(text) {
    setWaiting(false);
    showFeedback("info", "AI 老师正在组织回答…");
    try {
      const reply = await askAI(text);
      state.history.push({ role: "user", content: text });
      state.history.push({ role: "assistant", content: reply });
      els.bubble.textContent = reply;
      addMsg("dh", reply);
      els.round.textContent = Math.floor(state.history.length / 2);
      speak(reply);
      showFeedback("ok", "✅ 继续说吧，AI 会一直陪你聊", 3);
      setWaiting(true);
    } catch (e) {
      showFeedback("retry", "⚠️ " + (e.message || "AI 服务不可用") + "（可重试，或点场景按钮重新开始）");
      setWaiting(true);
    }
  }

  function submitScript(text) {
    const st = SCENES[state.key].steps[state.step];
    const ok = evaluate(text, st);
    if (!ok && ANIMALS.active) {
      showFeedback("retry", "💡 " + st.retry, 2);
      return;
    }
    setWaiting(false);
    if (ok) { state.score++; els.score.textContent = state.score; showFeedback("ok", "✅ " + st.good, 3); }
    else { showFeedback("retry", "💡 " + st.retry, 2); }
    state.step++;
    const total = SCENES[state.key].steps.length;
    transition = setTimeout(() => {
      transition = null;
      if (state.step >= total) finish(); else renderStep();
    }, 1400);
  }

  function finish() {
    const sc = SCENES[state.key];
    els.bubble.textContent = "Well done! You finished the whole dialogue! 👏";
    addMsg("dh", "Well done! You finished the whole dialogue! 👏");
    speak("Well done! You finished the whole dialogue!");
    showFeedback("ok", `🎉 完成本场景全部 ${sc.steps.length} 轮对话！得分 ${state.score} / ${sc.steps.length}`, 3);
    setWaiting(false);
    els.start.textContent = "↻ 重新开始";
  }

  function start(key) {
    stop();
    if (key) state.key = key;
    const sc = SCENES[state.key];
    state.started = true; state.step = 0; state.score = 0; state.history = [];
    els.score.textContent = "0";
    els.chat.innerHTML = "";
    els.input.value = "";
    els.feedback.className = "dh-feedback";
    els.feedback.textContent = state.mode === "ai" ? "AI 老师已上线，用英语自由对话吧。" : "对话开始，请听完后回答。";
    els.title.textContent = sc.title;
    els.stage.style.background = sc.grad;
    els.start.textContent = "↻ 重新开始";
    els.hint.textContent = state.mode === "ai" ? "自由对话：想说什么就说什么，AI 会用简单英语回应" : "句型支架：" + sc.steps[0].hint;
    document.querySelectorAll(".dh-scene").forEach(b => b.classList.toggle("active", b.dataset.key === state.key));
    if (state.mode === "ai") {
      const opening = sc.steps[0].dh;
      state.history.push({ role: "assistant", content: opening });
      els.bubble.textContent = opening;
      els.round.textContent = "0";
      els.total.textContent = "∞";
      addMsg("dh", opening);
      setWaiting(true);
      speak(opening);
    } else {
      els.total.textContent = sc.steps.length;
      renderStep();
    }
  }

  function nextStep() {
    if (!state.started || transition !== null) return;
    if (state.mode === "ai") { start(); return; }
    const total = SCENES[state.key].steps.length;
    if (state.step >= total) { start(); return; }
    state.step++;
    if (state.step >= total) finish(); else renderStep();
  }

  function replay() {
    if (!state.started || transition !== null) return;
    if (state.mode === "ai") {
      const last = [...state.history].reverse().find(m => m.role === "assistant");
      if (last) speak(last.content);
      return;
    }
    const sc = SCENES[state.key];
    const idx = Math.min(state.step, sc.steps.length - 1);
    speak(sc.steps[idx].dh);
  }

  function switchScene(key) {
    stop();
    state.key = key; state.started = false; state.waiting = false; state.step = 0; state.score = 0; state.history = [];
    const sc = SCENES[key];
    els.chat.innerHTML = "";
    els.input.value = "";
    els.score.textContent = "0"; els.round.textContent = "0"; els.total.textContent = sc.steps.length;
    els.title.textContent = sc.title;
    els.stage.style.background = sc.grad;
    els.bubble.textContent = "点击「开始上课」，和数字人老师说英语吧！";
    els.hint.textContent = state.mode === "ai" ? "自由对话：想说什么就说什么" : "句型支架：" + sc.steps[0].hint;
    els.feedback.className = "dh-feedback";
    els.feedback.textContent = "已切换场景，点击开始上课。";
    setWaiting(false);
    els.start.textContent = "▶ 开始上课";
    document.querySelectorAll(".dh-scene").forEach(b => b.classList.toggle("active", b.dataset.key === key));
  }

  /* ---------- 挂载 ---------- */
  function mount(root) {
    root.innerHTML = template();
    els = {
      stage: root.querySelector("#dhStage"),
      avatar: root.querySelector("#dhAvatar"),
      bubble: root.querySelector("#dhBubble"),
      hint: root.querySelector("#dhHint"),
      title: root.querySelector("#dhTitle"),
      chat: root.querySelector("#dhChat"),
      input: root.querySelector("#dhInput"),
      send: root.querySelector("#dhSend"),
      mic: root.querySelector("#dhMic"),
      start: root.querySelector("#dhStart"),
      next: root.querySelector("#dhNext"),
      replay: root.querySelector("#dhReplay"),
      round: root.querySelector("#dhRound"),
      total: root.querySelector("#dhTotal"),
      score: root.querySelector("#dhScore"),
      feedback: root.querySelector("#dhFeedback"),
      mode: root.querySelector("#dhMode")
    };
    els.stage.style.background = SCENES[state.key].grad;
    els.total.textContent = SCENES[state.key].steps.length;
    els.hint.textContent = "句型支架：" + SCENES[state.key].steps[0].hint;

    els.start.addEventListener("click", () => start());
    els.next.addEventListener("click", nextStep);
    els.replay.addEventListener("click", replay);
    els.send.addEventListener("click", submit);
    els.input.addEventListener("keydown", (e) => { if (e.key === "Enter") submit(); });
    els.mic.addEventListener("click", () => {
      if (!state.started || !state.waiting) return;
      if (!recog) { showFeedback("retry", "🎤 当前浏览器无法使用本地语音识别，请用键盘输入。"); return; }
      try { recog.start(); } catch (e) { /* 识别中 */ }
    });
    root.querySelectorAll(".dh-scene").forEach(b => {
      b.addEventListener("click", () => { switchScene(b.dataset.key); });
    });
    setupMic();
    if (!ANIMALS.active) detectMode();
  }

  function stop() {
    clearTimeout(transition);
    transition = null;
    if ("speechSynthesis" in window) speechSynthesis.cancel();
    try { if (recog) recog.abort(); } catch (e) {}
  }

  return { mount, stop, SCENES };
})();
