(function (root) {
  'use strict';
  const clone = v => JSON.parse(JSON.stringify(v));
  const uid = () => 'item-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,9);
  const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function defaults() {
    return {version:1,artifacts:[],progress:{detective:false,repair:false,studio:false},workspace:{topic:'水果购物',grade:'四年级',goal:'在购物情境中提出请求并回应',known:'apple, banana, orange, pear; I’d like some …, please. / Here you are.',draft:'',words:[{word:'apple',meaning:'苹果',clues:['It is a fruit.','It can be red or green.','It grows on a tree.']},{word:'banana',meaning:'香蕉',clues:['It is a fruit.','It is yellow.','It is long.']},{word:'orange',meaning:'橙子',clues:['It is a fruit.','It is round.','Its name is also a colour.']},{word:'pear',meaning:'梨',clues:['It is a fruit.','It can be green or yellow.','It is small at the top and big at the bottom.']}]},repair:null,game:null,slide:0};
  }
  function buildPrompt(f) {
    return `请作为小学英语教学设计助手，协助我设计${f.task || '口语活动'}。\n年级：${f.grade || '待补充'}\n主题：${f.topic || '待补充'}\n教学目标：${f.goal || '待补充'}\n学生已有基础：${f.known || '待补充'}\n活动时间：${f.time || '待补充'}分钟\n人数与组织：${f.group || '待补充'}\n设备与限制：${f.equipment || '待补充'}\n输出格式：${f.format || '待补充'}\n${f.draft ? '教师已修改的参考材料：\n'+f.draft+'\n' : ''}请给出可操作的步骤、目标语言、所需材料、基础支架和一个学习检查办法。检查英语准确性；避免超出已学内容，如有新增词汇需标明并提供支架。输出是待教师审核的初稿，不包含学生个人信息。`;
  }
  function validateGame(g) {
    const e=[];
    if(!g || !['match','mystery'].includes(g.type)) return ['请选择有效的游戏模板'];
    for(const key of ['title','goal','notes'])if(g[key]!==undefined&&(typeof g[key]!=='string'||g[key].length>(key==='notes'?10000:500)))e.push('游戏名称、目标和说明需要使用有效的简短文本');
    if(!Array.isArray(g.cards)||g.cards.length<1||g.cards.length>12) return ['请填写 1—12 张词卡'];
    if(g.type==='match' && g.cards.length<2) e.push('配对游戏至少需要两张词卡');
    const seen=new Set(), meanings=new Set();
    g.cards.forEach((c,i)=>{
      if(!c || typeof c.word!=='string'||!c.word.trim() || c.word.length>200) e.push(`第 ${i+1} 张卡的词语不能为空且应少于200字`);
      if(typeof c?.meaning!=='string'||!c.meaning.trim()||c.meaning.length>200) e.push(`第 ${i+1} 张卡需要简短释义`);
      const key=String(c?.word||'').trim().toLowerCase();
      if(seen.has(key)) e.push('词语不能重复');seen.add(key);
      if(g.type==='match') {const m=String(c?.meaning||'').trim();if(meanings.has(m)) e.push('配对释义不能重复，请增加区分');meanings.add(m);}
      if(c?.clues!==undefined&&(!Array.isArray(c.clues)||c.clues.some(x=>typeof x!=='string'||x.length>400)||c.clues.length>5))e.push(`第 ${i+1} 张卡的线索格式不正确`);
      if(g.type==='mystery'&&(!Array.isArray(c?.clues)||c.clues.length<2||c.clues.length>5||c.clues.some(x=>typeof x!=='string'||!x.trim()||x.length>400)))e.push(`第 ${i+1} 张卡需要 2—5 条简短线索`);
    });return [...new Set(e)];
  }
  function validateBackup(b) {
    if(!b||b.version!==1||!Array.isArray(b.artifacts)||b.artifacts.length>300)throw Error('请选择本网站导出的成果备份（版本1，最多300项）');
    for(const a of b.artifacts){
      if(!a||!['prompt','draft','game','resource'].includes(a.type)||typeof a.title!=='string'||a.title.length>200||!a.data||typeof a.data!=='object'||Array.isArray(a.data))throw Error('备份中的成果格式不正确');
      if(a.type==='game'&&(validateGame(a.data).length||['title','goal','notes'].some(k=>typeof a.data[k]!=='string')))throw Error('备份包含无效游戏词卡或缺少名称、目标、教学说明');
      if(a.type!=='game'&&(typeof a.data.text!=='string'||a.data.text.length>100000))throw Error('备份包含无效文本');
    }return b;
  }
  function saveArtifact(s,a){if(s.artifacts.length>=300)throw Error('教学背包已满300项，请先导出备份并整理后再保存');const item={id:uid(),type:a.type,title:String(a.title||'未命名成果').slice(0,200),data:clone(a.data),created:new Date().toISOString()};s.artifacts.push(item);return item;}
  function mergeBackup(s,b){validateBackup(b);const next=clone(s);if(next.artifacts.length+b.artifacts.length>300)throw Error('成果总数超过300项，请先备份并整理');b.artifacts.forEach(a=>saveArtifact(next,{...a,title:a.title+'（导入）'}));return next;}
  function gameFromWorkspace(w,type='match'){
    return {type,title:w.topic+' · '+(type==='match'?'单词配对':'神秘线索卡'),goal:w.goal,cards:clone(w.words),notes:'适用：'+w.grade+'；活动约8分钟，两人合作。\n先示范1分钟，再两人练习4分钟，展示2分钟，最后检查1分钟。\n提供图片、释义和目标句型作支架；挑战任务可以隐藏提示。\n学习检查：每人用目标句型提出一次请求或进行一次描述。\n已有基础：'+w.known+(w.draft?'\n教师材料：\n'+w.draft:'')};
  }
  const gameCSS=`:root{--ink:#172a29;--teal:#4f8777;--cream:#f7f5ef}*{box-sizing:border-box}body{margin:0;background:var(--cream);color:var(--ink);font-family:'Microsoft YaHei UI','PingFang SC',sans-serif}button{font:inherit;cursor:pointer}button:focus-visible{outline:3px solid #b08a54;outline-offset:4px}:fullscreen{background:var(--cream);overflow:auto}.game-wrap{max-width:1100px;margin:auto;padding:24px}.game-head{display:flex;justify-content:space-between;align-items:center;gap:20px}.game-head h1{font-size:clamp(28px,5vw,48px);margin:12px 0}.game-sub{font-size:19px;line-height:1.8}.game-controls{display:flex;flex-wrap:wrap;gap:10px;margin:20px 0}.game-controls button,.game-next{border:1px solid #4f8777;background:white;border-radius:10px;padding:12px 20px;color:var(--ink)}.game-board{display:grid;grid-template-columns:1fr 1fr;gap:24px}.game-column{display:grid;gap:12px;align-content:start}.game-word{min-height:74px;border:2px solid #d6e2dc;background:#fff;border-radius:12px;font-size:clamp(22px,3vw,34px);padding:16px;color:#172a29}.game-word.selected{border-color:#4f8777;background:#ddede6}.game-word.matched{opacity:.65;border-color:#4f8777;background:#e5f4ec}.game-feedback{min-height:40px;font-size:21px;margin:18px 0;line-height:1.6}.mystery-paper{background:#fff;padding:36px;border:1px solid #dce4db;border-radius:18px;min-height:250px}.clue{font-size:clamp(22px,4vw,36px);font-family:Georgia,serif;line-height:1.5;padding:12px 0;border-bottom:1px dashed #d9dfd9}.answer{color:#4f8777;font-size:38px;margin:22px 0}.game-note{white-space:pre-wrap;line-height:1.9;font-size:17px}.game-progress{font-size:17px;color:#526775}@media(max-width:600px){.game-wrap{padding:14px}.game-board{gap:10px}.game-word{padding:10px;font-size:21px}.game-head{align-items:flex-start;flex-direction:column}.mystery-paper{padding:20px}}@media print{.game-controls,button{display:none}.game-wrap{padding:0}.mystery-paper{break-inside:avoid}}`;
  function mountGame(container,g) {
    const h=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    let current=0,revealed=0,answer=false,left=null,right=null,matched=new Set();
    const rightOrder=g.cards.map((_,i)=>i).sort(()=>Math.random()-.5);
    function render(message=''){
      let body='';
      if(g.type==='match')body=`<div class="game-board"><div class="game-column">${g.cards.map((c,i)=>`<button class="game-word ${matched.has(i)?'matched':''} ${left===i?'selected':''}" data-side="l" data-index="${i}" ${matched.has(i)?'disabled':''}>${h(c.word)}${matched.has(i)?' ✓':''}</button>`).join('')}</div><div class="game-column">${rightOrder.map(i=>`<button class="game-word ${matched.has(i)?'matched':''} ${right===i?'selected':''}" data-side="r" data-index="${i}" ${matched.has(i)?'disabled':''}>${h(g.cards[i].meaning)}${matched.has(i)?' ✓':''}</button>`).join('')}</div></div>`;
      else {const c=g.cards[current];body=`<div class="mystery-paper"><div class="game-progress">神秘卡片 ${current+1} / ${g.cards.length}</div>${revealed?c.clues.slice(0,revealed).map((x,i)=>`<div class="clue">${i+1}. ${h(x)}</div>`).join(''):'<p class="game-sub">准备好了吗？揭示第一条线索。</p>'}${answer?`<div class="answer">${h(c.word)} · ${h(c.meaning)}</div>`:''}</div><div class="game-controls"><button data-action="clue" ${revealed>=c.clues.length?'disabled':''}>揭示线索</button><button data-action="answer">${answer?'隐藏答案':'显示答案'}</button><button data-action="next">下一张卡</button></div>`;}
      container.innerHTML=`<div class="game-wrap"><div class="game-head"><h1>${h(g.title||'英语课堂小游戏')}</h1><span class="game-progress">${g.type==='match'?'单词配对':'神秘线索卡'}</span></div><p class="game-sub">${h(g.goal||'观察、猜测，再用英语说一句话。')}</p><div class="game-controls"><button data-action="reset">重置游戏</button><button data-action="full">全屏展示</button><button data-action="notes">教学说明</button></div>${body}<div class="game-feedback" role="status" aria-live="polite">${h(message|| (g.type==='match'?`先选一个单词，再选释义。已完成 ${matched.size} / ${g.cards.length}`:'根据线索猜一猜，并说出你的理由。'))}</div><div class="game-note" hidden>${h(g.notes||'建议两人合作，先讨论再回答。活动后用目标句型说一句话。')}</div></div>`;
    }
    function click(e){const b=e.target.closest('button');if(!b||!container.contains(b))return;const a=b.dataset.action;
      if(a==='reset'){current=0;revealed=0;answer=false;left=null;right=null;matched.clear();render();}
      else if(a==='clue'){revealed=Math.min(revealed+1,g.cards[current].clues.length);render();}
      else if(a==='answer'){answer=!answer;render();}
      else if(a==='next'){current=(current+1)%g.cards.length;revealed=0;answer=false;render();}
      else if(a==='notes'){const n=container.querySelector('.game-note');n.hidden=!n.hidden;}
      else if(a==='full'){if(document.fullscreenElement){document.exitFullscreen?.().catch(()=>{});}else container.requestFullscreen?.().catch(()=>{});}
      else if(b.dataset.side){const i=Number(b.dataset.index);if(b.dataset.side==='l')left=i;else right=i;if(left!==null&&right!==null){if(left===right){matched.add(left);left=null;right=null;render(matched.size===g.cards.length?'全部配对成功！现在用目标句型说一句话。':'配对正确，继续！');}else{left=null;right=null;render('再想一想：这个单词对应哪个意思？');}}else render();}
    }
    container.addEventListener('click',click);render();return()=>container.removeEventListener('click',click);
  }
  function exportGame(game){const errors=validateGame(game);if(errors.length)throw Error(errors.join('；'));const json=JSON.stringify(game).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHTML(game.title||'英语课堂游戏')}</title><style>${gameCSS}</style></head><body><main id="game"></main><script>const game=${json};(${mountGame.toString()})(document.getElementById('game'),game);<\/script></body></html>`;}
  const api={defaults,buildPrompt,validateGame,validateBackup,mergeBackup,saveArtifact,gameFromWorkspace,escapeHTML,exportGame,mountGame,gameCSS};
  root.WorkshopCore=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
