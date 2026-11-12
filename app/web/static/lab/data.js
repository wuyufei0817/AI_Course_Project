/* ================= 数据层：全部演示内容 ================= */
const DATA = {

  /* ---------- M1 备课 ---------- */
  lesson: {
    unit: "Unit 3  What would you like?",
    grade: "五年级 · 上册",
    type: "读写课",
    objectives: [
      { dim: "语言知识", text: "能听、说、读、写食物类词汇：hamburger, sandwich, salad, ice cream, tea" },
      { dim: "语言技能", text: "能运用 What would you like to eat/drink? — I'd like ... 进行点餐交际" },
      { dim: "思维品质", text: "能根据情境选择合适食物并说明理由，发展逻辑表达" },
      { dim: "文化意识", text: "了解中西方饮食差异，尊重不同饮食习惯" },
      { dim: "学习能力", text: "借助句型支架完成点餐对话，能在小组中合作表达" }
    ],
    chain: [
      { stage: "导入", time: "5'", form: "全班", desc: "看图猜食物，激活旧知", scaffold: "What would you like? I'd like ..." },
      { stage: "呈现", time: "8'", form: "个体", desc: "听读对话，圈出点餐句型", scaffold: "A: What would you like to eat?  B: I'd like a hamburger." },
      { stage: "操练", time: "12'", form: "小组", desc: "分层练习：填空 / 问答 / 创编", scaffold: "基础填空 → 进阶问答 → 挑战创编" },
      { stage: "输出", time: "10'", form: "结对", desc: "角色扮演点餐，制作菜单", scaffold: "Menu: Food / Drink / Price" },
      { stage: "迁移", time: "5'", form: "全班", desc: "为家人点一餐并汇报", scaffold: "I'd like ... for my family." }
    ],
    tiers: {
      basic:    { title: "基础层 · 有支架",   items: ["看菜单选词填空", "跟读句型并连线", "看图说单词"] },
      advanced: { title: "进阶层 · 半开放",   items: ["根据图片补全对话", "两人问答点餐", "给菜单标价"] },
      challenge:{ title: "挑战层 · 迁移",     items: ["自编点餐对话并表演", "为朋友设计健康菜单", "用英语介绍中西方早餐差异"] }
    },
    scaffolds: {
      patterns: ["What would you like to eat?", "What would you like to drink?", "I'd like ..., please.", "Here you are.", "Thank you."],
      prompts: ["Look at the menu. What would you like?", "Is it healthy? Why?"],
      models: ["A: What would you like to eat?  B: I'd like a hamburger, please."]
    },
    board: "What would you like? → I'd like ...\nFood: hamburger / salad / ice cream\nDrink: tea / juice / milk",
    homework: "① 用 I'd like ... 写出自己的晚餐；② 和家人用英语点一次餐。"
  },

  /* ---------- M2 分层练习 ---------- */
  exercises: {
    point: "Unit 3 · 点餐句型 What would you like?",
    basic: [
      { q: "—What would you like to eat?\n—I'd like a ______.", options: ["hamburger", "hamburgers", "hamburger please"], answer: 0, explain: "I'd like a + 可数名词单数" },
      { q: "—What would you like to ______?\n—A cup of tea.", options: ["eat", "drink", "read"], answer: 1, explain: "喝 → drink" },
      { q: "I'd like ______ orange juice.", options: ["a", "an", "some"], answer: 2, explain: "juice 不可数，用 some" }
    ],
    advanced: [
      { q: "A: What would you like to eat?\nB: ______ like a salad.", options: ["I'd", "I am", "I would like to"], answer: 0, explain: "I would = I'd，后接动词原形" },
      { q: "A: Would you like some tea?\nB: Yes, ______.", options: ["I am", "please", "thanks you"], answer: 1, explain: "礼貌接受：Yes, please." },
      { q: "I'd like two ______ (hamburger).", options: ["hamburger", "hamburgers", "hamburgeres"], answer: 1, explain: "two + 可数名词复数" }
    ],
    challenge: [
      { q: "为你的朋友设计一份健康午餐菜单，并用 I'd like ... 写出点餐对话。", open: true },
      { q: "描述你家人的晚餐，至少 4 句，使用 I'd like ...。", open: true },
      { q: "创编一个餐厅对话，包含 3 种食物和 1 种饮料。", open: true }
    ],
    graded: {
      score: 7, total: 9,
      wrong: [
        { no: "基础 2", why: "动词搭配错误：把“喝”选成 eat", next: "复习 drink / eat 的区别" },
        { no: "进阶 3", why: "名词复数漏加 -s：two hamburger", next: "记住“数量 > 1 用复数”" }
      ]
    }
  },

  /* ---------- M3 过程反馈 ---------- */
  writing: {
    prompt: "My Weekend",
    text: "I go to the park with my friend on sunday. We play football and eat ice cream. I like it very much. My friend he is very happy.",
    annotations: [
      { seg: "on sunday", type: "大小写", why: "星期首字母需大写", fix: "on Sunday", next: "检查所有专有名词大写" },
      { seg: "My friend he is", type: "主语重复", why: "主语 he 重复，应去掉", fix: "My friend is", next: "一个句子只保留一个主语" },
      { seg: "I like it very much", type: "表达单一", why: "可换更丰富的表达", fix: "I really enjoy it.", next: "尝试用 enjoy / love 替换 like" },
      { seg: "eat ice cream", type: "细节", why: "可加时间/地点让句子更生动", fix: "eat ice cream in the park", next: "给动词加一个状语" }
    ],
    scores: [
      { name: "语法", val: 4 }, { name: "词汇", val: 4 }, { name: "结构", val: 3 }, { name: "内容", val: 4 }
    ],
    praise: "书写清楚、能围绕周末活动展开，整体表达完整，继续保持！"
  },
  oral: {
    transcript: "I would like a hamburger and a cup of tea.",
    scores: [ { name: "发音", val: 88 }, { name: "流利度", val: 82 }, { name: "语法", val: 90 }, { name: "词汇", val: 85 } ],
    issues: ["th 音偏 /s/：would → /wʊd/ 注意舌尖", "hamburger 重音在第一音节", "连读 cup of → /kʌpəv/ 更自然"],
    praise: "开口自信、句子完整，发音清晰度不错，多练 th 音会更棒！"
  },

  /* ---------- M4 命题评价 ---------- */
  blueprint: {
    levels: ["记忆", "理解", "应用", "分析", "评价"],
    rows: [
      { target: "词汇", cells: [3, 2, 2, 0, 0] },
      { target: "语法", cells: [0, 2, 3, 1, 0] },
      { target: "语篇", cells: [0, 1, 2, 2, 1] },
      { target: "语用", cells: [0, 1, 2, 2, 1] }
    ]
  },
  paper: [
    { no: 1, type: "听力选择", target: "词汇", level: "理解", diff: 0.88, score: 5 },
    { no: 2, type: "词汇匹配", target: "词汇", level: "记忆", diff: 0.92, score: 5 },
    { no: 3, type: "单项选择", target: "语法", level: "应用", diff: 0.75, score: 5 },
    { no: 4, type: "补全对话", target: "语用", level: "应用", diff: 0.70, score: 10 },
    { no: 5, type: "阅读理解", target: "语篇", level: "分析", diff: 0.62, score: 10 },
    { no: 6, type: "写作", target: "语篇", level: "创造", diff: 0.55, score: 15 }
  ],
  rubric: {
    dims: ["内容", "语言", "结构", "书写"],
    levels: ["优秀(5)", "良好(4)", "合格(3)", "待改进(2)"],
    cells: [
      ["内容完整、紧扣主题、有细节", "内容较完整、基本扣题", "内容简单、部分扣题", "内容不完整、偏题"],
      ["词汇丰富、语法准确、少量错误", "词汇够用、语法基本准确", "词汇有限、错误较多", "词汇贫乏、错误频繁"],
      ["逻辑清晰、连接自然", "结构完整、连接基本合理", "结构松散、连接较少", "结构混乱、无连接"],
      ["书写规范、整洁美观", "书写较规范、偶有涂改", "书写可辨认、涂改较多", "书写潦草难辨"]
    ]
  },
  consistency: {
    ai: 86, teacher: 84, kappa: 0.78,
    note: "AI 与教师评分高度一致，主要集中在书写与细节维度略有差异。"
  },

  /* ---------- M5 资源 ---------- */
  dialogues: {
    restaurant: {
      title: "At the Restaurant", cn: "在餐厅", icon: "🍔", grad: "linear-gradient(135deg,#ff9a56,#ff5e62)",
      roles: ["Waiter 服务员", "Customer 顾客"],
      lines: [
        ["Waiter", "Welcome! What would you like to eat?"],
        ["Customer", "I'd like a hamburger, please."],
        ["Waiter", "Would you like something to drink?"],
        ["Customer", "Yes, a cup of tea, please."]
      ]
    },
    shopping: {
      title: "At the Clothes Shop", cn: "在服装店", icon: "👕", grad: "linear-gradient(135deg,#f78fb3,#a06ee1)",
      roles: ["Shop assistant 店员", "Customer 顾客"],
      lines: [
        ["Assistant", "Can I help you?"],
        ["Customer", "I want to buy a T-shirt."],
        ["Assistant", "What size do you need?"],
        ["Customer", "Size M, please. How much is it?"]
      ]
    },
    selfintro: {
      title: "Introduce Yourself", cn: "自我介绍", icon: "🙋", grad: "linear-gradient(135deg,#4facfe,#00f2fe)",
      roles: ["Teacher 老师", "Student 学生"],
      lines: [
        ["Teacher", "Hello! What's your name?"],
        ["Student", "My name is Tom. I'm ten years old."],
        ["Teacher", "What do you like doing?"],
        ["Student", "I like playing football and reading."]
      ]
    },
    asking_way: {
      title: "Asking the Way", cn: "问路", icon: "🧭", grad: "linear-gradient(135deg,#43e97b,#38f9d7)",
      roles: ["Stranger 路人", "You 你"],
      lines: [
        ["You", "Excuse me! Where is the library?"],
        ["Stranger", "Go straight and turn left."],
        ["You", "Is it far from here?"],
        ["Stranger", "No, it's near. You can walk there."]
      ]
    },
    doctor: {
      title: "At the Doctor's", cn: "看病", icon: "🏥", grad: "linear-gradient(135deg,#89f7fe,#66a6ff)",
      roles: ["Doctor 医生", "Patient 病人"],
      lines: [
        ["Doctor", "What's the matter with you?"],
        ["Patient", "I have a cold and a headache."],
        ["Doctor", "Do you have a fever?"],
        ["Patient", "Yes, I have a fever."]
      ]
    },
    weather: {
      title: "Weather Talk", cn: "聊天气", icon: "☀️", grad: "linear-gradient(135deg,#f6d365,#fda085)",
      roles: ["Teacher 老师", "Student 学生"],
      lines: [
        ["Teacher", "What's the weather like today?"],
        ["Student", "It's sunny and warm."],
        ["Teacher", "What do you usually do on sunny days?"],
        ["Student", "I usually play football with my friends."]
      ]
    },
    school: {
      title: "School Life", cn: "学校生活", icon: "🏫", grad: "linear-gradient(135deg,#667eea,#764ba2)",
      roles: ["Teacher 老师", "Student 学生"],
      lines: [
        ["Teacher", "What's your favourite subject?"],
        ["Student", "My favourite subject is English."],
        ["Teacher", "How many classes do you have today?"],
        ["Student", "I have four classes today."]
      ]
    },
    travel: {
      title: "At the Airport", cn: "在机场", icon: "✈️", grad: "linear-gradient(135deg,#a18cd1,#fbc2eb)",
      roles: ["Staff 工作人员", "Traveller 旅客"],
      lines: [
        ["Staff", "Where are you going?"],
        ["Traveller", "I'm going to Beijing."],
        ["Staff", "How will you go there?"],
        ["Traveller", "By plane. Have a nice trip!"]
      ]
    },
    library: {
      title: "At the Library", cn: "在图书馆", icon: "📚", grad: "linear-gradient(135deg,#a1c4fd,#c2e9fb)",
      roles: ["Librarian 图书管理员", "Student 学生"],
      lines: [
        ["Librarian", "Can I help you?"],
        ["Student", "Yes, I'd like to borrow a book."],
        ["Librarian", "What kind of book do you like?"],
        ["Student", "I like story books. Thank you!"]
      ]
    },
    phone: {
      title: "On the Phone", cn: "打电话", icon: "📱", grad: "linear-gradient(135deg,#fbc2eb,#a6c1ee)",
      roles: ["Amy", "Tom"],
      lines: [
        ["Amy", "Hello! This is Amy speaking."],
        ["Tom", "Hi, Amy. This is Tom."],
        ["Amy", "Would you like to go to the park?"],
        ["Tom", "Yes, I'd love to. See you!"]
      ]
    }
  },
  reading: {
    passage: "Tom is a student. He gets up at six thirty every morning. He goes to school by bus. He has four classes in the morning. After school, he plays football with his friends. He likes English very much.",
    chain: [
      { level: "字面", q: "When does Tom get up?" },
      { level: "推断", q: "Why does Tom like English? (guess)" },
      { level: "评价", q: "Do you think Tom has a good day? Why?" },
      { level: "迁移", q: "What about your day? Talk with your partner." }
    ]
  },
  readings: [
    {
      title: "Tom's Day",
      text: "Tom is a student. He gets up at six thirty every morning. He goes to school by bus. He has four classes in the morning. After school, he plays football with his friends. He likes English very much.",
      keywords: ["get up", "six thirty", "by bus", "four classes", "football", "English"],
      chain: [
        { level: "字面", q: "When does Tom get up?" },
        { level: "推断", q: "Why does Tom like English? (guess)" },
        { level: "评价", q: "Do you think Tom has a good day? Why?" },
        { level: "迁移", q: "What about your day? Talk with your partner." }
      ]
    },
    {
      title: "My Family",
      text: "There are four people in my family. My father is a doctor. My mother is a teacher. I have a brother. We are a happy family.",
      keywords: ["four people", "father doctor", "mother teacher", "brother", "happy"],
      chain: [
        { level: "字面", q: "How many people are there in the family?" },
        { level: "推断", q: "What does the father do?" },
        { level: "评价", q: "Is it a happy family? Why?" },
        { level: "迁移", q: "Talk about your family with your partner." }
      ]
    },
    {
      title: "A Sunny Weekend",
      text: "It is sunny today. Amy and I go to the park. We fly a kite and eat ice cream. We have a good time.",
      keywords: ["sunny", "park", "fly a kite", "ice cream", "good time"],
      chain: [
        { level: "字面", q: "What's the weather like today?" },
        { level: "推断", q: "Where do Amy and I go?" },
        { level: "评价", q: "Do they have a good time? Why?" },
        { level: "迁移", q: "What do you do on sunny days?" }
      ]
    }
  ],
  retell: {
    keywords: ["get up", "six thirty", "by bus", "four classes", "football", "English"],
    frames: ["Tom ______ at six thirty.", "He goes to school ______.", "He has ______ in the morning.", "After school, he ______.", "He likes ______ very much."]
  },

  /* ---------- M6 游戏 ---------- */
  games: {
    sentences: [
      { target: "I would like a hamburger", hint: "点餐：我想要一个汉堡" },
      { target: "What would you like to drink", hint: "询问对方想喝什么" },
      { target: "I am going to the park", hint: "我打算去公园" },
      { target: "She likes playing football", hint: "她喜欢踢足球" },
      { target: "We have English on Monday", hint: "我们周一有英语课" }
    ],
    pairs: [
      { en: "hamburger", cn: "汉堡" }, { en: "sandwich", cn: "三明治" },
      { en: "salad", cn: "沙拉" }, { en: "ice cream", cn: "冰淇淋" },
      { en: "juice", cn: "果汁" }, { en: "tea", cn: "茶" },
      { en: "park", cn: "公园" }, { en: "football", cn: "足球" }
    ],
    memory: [
      { cn: "汉堡", en: "hamburger" }, { cn: "三明治", en: "sandwich" },
      { cn: "沙拉", en: "salad" }, { cn: "冰淇淋", en: "ice cream" },
      { cn: "果汁", en: "juice" }, { cn: "茶", en: "tea" },
      { cn: "足球", en: "football" }, { cn: "公园", en: "park" }
    ],
    whack: {
      targets: [
        { cn: "汉堡", en: "hamburger" }, { cn: "三明治", en: "sandwich" },
        { cn: "沙拉", en: "salad" }, { cn: "冰淇淋", en: "ice cream" },
        { cn: "果汁", en: "juice" }, { cn: "茶", en: "tea" }
      ],
      pool: ["hamburger", "sandwich", "salad", "ice cream", "juice", "tea", "football", "park", "book", "pencil"]
    }
  },

  /* ---------- 学情看板 ---------- */
  students: [
    { name: "王小明", cls: "五(1)", vocab: 92, gram: 88, pron: 85, use: 86 },
    { name: "李思思", cls: "五(1)", vocab: 78, gram: 72, pron: 80, use: 74 },
    { name: "张浩然", cls: "五(1)", vocab: 65, gram: 60, pron: 70, use: 62 },
    { name: "陈欣怡", cls: "五(1)", vocab: 88, gram: 90, pron: 92, use: 85 },
    { name: "刘子轩", cls: "五(2)", vocab: 60, gram: 55, pron: 65, use: 58 },
    { name: "赵梦琪", cls: "五(2)", vocab: 84, gram: 80, pron: 78, use: 82 },
    { name: "孙一鸣", cls: "五(2)", vocab: 72, gram: 68, pron: 75, use: 70 },
    { name: "周雨桐", cls: "五(2)", vocab: 95, gram: 93, pron: 90, use: 94 }
  ],
  heatmap: {
    points: ["词汇", "语法", "语音", "语用", "阅读", "写作"],
    rows: [
      { name: "王小明", vals: [92, 88, 85, 86, 80, 82] },
      { name: "李思思", vals: [78, 72, 80, 74, 70, 68] },
      { name: "张浩然", vals: [65, 60, 70, 62, 58, 55] },
      { name: "陈欣怡", vals: [88, 90, 92, 85, 86, 88] },
      { name: "刘子轩", vals: [60, 55, 65, 58, 52, 50] }
    ]
  },
  trend: { weeks: ["第1周", "第2周", "第3周", "第4周", "第5周", "第6周"], scores: [62, 66, 70, 73, 78, 82] },

  /* ---------- 提示词模板 ---------- */
  promptPresets: [
    { name: "备课设计", role: "小学英语教师", task: "为《Unit 3 What would you like?》设计一节 40 分钟读写课，包含任务链、分层活动与语言支架", grade: "五年级", format: "表格 + 分点说明", constraints: "贴近学生生活；活动可操作；给出句型支架" },
    { name: "分层出题", role: "小学英语命题教师", task: "围绕点餐句型生成 L1/L2/L3 三档练习各 5 题，含答案与错因", grade: "五年级", format: "三档分组，每题标注难度与解析", constraints: "同一知识点；难度梯度明显；不得超纲" },
    { name: "作文评语", role: "小学英语教师", task: "为学生的《My Weekend》初稿写反馈，指出错因并给出改写示例", grade: "五年级", format: "逐条：错因 / 改写 / 下一步", constraints: "鼓励为主；不直接代写；语言适龄" },
    { name: "游戏生成", role: "小学英语教师", task: "为食物词汇设计一个课堂小游戏，规则简单、可 5 分钟完成", grade: "五年级", format: "游戏名 + 规则 + 分组 + 评价方式", constraints: "全员参与；安全；有积分激励" }
  ],

  /* ---------- 工具生态 ---------- */
  tools: [
    { cat: "内容生成", items: [
      { name: "DeepSeek", url: "https://chat.deepseek.com" },
      { name: "即梦 AI", url: "https://jimeng.jianying.com" }
    ] },
    { cat: "课件制作", items: [
      { name: "WPS AI", url: "https://ai.wps.cn" },
      { name: "Canva", url: "https://www.canva.cn" },
      { name: "Kimi", url: "https://kimi.moonshot.cn" }
    ] },
    { cat: "互动游戏生成", items: [
      { name: "DeepSeek", url: "https://chat.deepseek.com" }
    ] },
    { cat: "虚拟情景 / 数字人", items: [
      { name: "即梦 AI", url: "https://jimeng.jianying.com" }
    ] },
    { cat: "口语陪练", items: [
      { name: "Elsa Speak", url: "https://elsaspeak.com" },
      { name: "豆包", url: "https://doubao.com" }
    ] },
    { cat: "写作批改", items: [
      { name: "Grammarly", url: "https://www.grammarly.com" },
      { name: "QuillBot", url: "https://quillbot.com" },
      { name: "腾讯元宝", url: "https://yuanbao.tencent.com" },
      { name: "豆包", url: "https://doubao.com" }
    ] },
    { cat: "词汇记忆", items: [
      { name: "Quizlet", url: "https://quizlet.com" },
      { name: "Anki", url: "https://apps.ankiweb.net" }
    ] }
  ],
  apps: [
    { name: "智能语音训练", mod: "M3 / M6" },
    { name: "互动对话练习", mod: "M5 / M7" },
    { name: "个性化学习规划", mod: "M2" },
    { name: "阅读智能推荐", mod: "M5" },
    { name: "作文智能批改", mod: "M3" },
    { name: "智能备课支持", mod: "M1" },
    { name: "实时翻译辅助", mod: "学习辅助" },
    { name: "教学效果分析", mod: "M4 / 看板" }
  ]
};
