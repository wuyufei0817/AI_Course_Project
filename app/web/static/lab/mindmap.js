/* ================= 课前 · 思维导图编辑器 ================= */
window.MindMap = (function () {
  const NODE_W = 140, NODE_H = 42;
  let nodes = [], selId = null, seq = 1, drag = null, els = {};

  function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

  function demo() {
    seq = 1; nodes = [];
    const add = (text, pid, x, y) => { const id = seq++; nodes.push({ id, pid, text, x, y }); return id; };
    const root = add("Unit 3 点餐", null, 60, 250);
    const c1 = add("词汇：food / drink", root, 330, 80);
    const c2 = add("句型：What would you like?", root, 330, 210);
    const c3 = add("活动：角色扮演", root, 330, 340);
    const c4 = add("文化：中西方饮食", root, 330, 470);
    add("hamburger · salad", c1, 640, 40);
    add("juice · tea", c1, 640, 110);
    add("I'd like ...", c2, 640, 180);
    add("Would you like ...?", c2, 640, 250);
    add("Menu 制作", c3, 640, 330);
    add("小组点餐 PK", c3, 640, 400);
    selId = root;
  }

  function selectNode(id) {
    selId = id;
    Object.values(els.nodeMap).forEach(el => el.classList.toggle("sel", +el.dataset.id === id));
    const n = nodes.find(x => x.id === id);
    if (els.tip && n) els.tip.textContent = "已选中：" + n.text;
  }

  function updateLines() {
    const paths = [];
    nodes.forEach(n => {
      if (!n.pid) return;
      const p = nodes.find(x => x.id === n.pid);
      if (!p) return;
      const x1 = p.x + NODE_W, y1 = p.y + NODE_H / 2;
      const x2 = n.x, y2 = n.y + NODE_H / 2;
      const mx = (x1 + x2) / 2;
      paths.push(`<path d="M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}" fill="none" stroke="#b7c4ea" stroke-width="2"/>`);
    });
    els.lines.innerHTML = paths.join("");
  }

  function render() {
    els.canvas.querySelectorAll(".mm-node").forEach(el => el.remove());
    els.nodeMap = {};
    nodes.forEach(n => {
      const el = document.createElement("div");
      el.className = "mm-node" + (n.id === selId ? " sel" : "") + (n.pid ? "" : " root");
      el.dataset.id = n.id;
      el.style.left = n.x + "px";
      el.style.top = n.y + "px";
      el.style.width = NODE_W + "px";
      el.style.minHeight = NODE_H + "px";
      el.textContent = n.text;
      el.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        selectNode(n.id);
        drag = { id: n.id, sx: e.clientX, sy: e.clientY, ox: n.x, oy: n.y, moved: false };
      });
      els.canvas.appendChild(el);
      els.nodeMap[n.id] = el;
    });
    updateLines();
    const n = nodes.find(x => x.id === selId);
    if (els.tip && n) els.tip.textContent = "已选中：" + n.text;
  }

  function addChild() {
    const parent = nodes.find(x => x.id === selId) || nodes.find(x => !x.pid);
    if (!parent) return;
    const siblings = nodes.filter(x => x.pid === parent.id).length;
    const id = seq++;
    nodes.push({ id, pid: parent.id, text: "新节点", x: parent.x + 210, y: parent.y + (siblings - 1) * 62 + 20 });
    selId = id;
    render();
  }

  function renameNode() {
    const n = nodes.find(x => x.id === selId);
    if (!n) return;
    const t = prompt("修改节点文字：", n.text);
    if (t && t.trim()) { n.text = t.trim(); render(); }
  }

  function removeNode() {
    const n = nodes.find(x => x.id === selId);
    if (!n) return;
    if (n.pid === null && nodes.filter(x => !x.pid).length === 1) { alert("根节点不能删除"); return; }
    const kill = new Set([n.id]);
    let changed = true;
    while (changed) {
      changed = false;
      nodes.forEach(x => { if (x.pid && kill.has(x.pid) && !kill.has(x.id)) { kill.add(x.id); changed = true; } });
    }
    nodes = nodes.filter(x => !kill.has(x.id));
    selId = nodes.find(x => !x.pid) ? nodes.find(x => !x.pid).id : null;
    render();
  }

  function autoLayout() {
    const depth = {};
    function d(id) {
      if (depth[id] !== undefined) return depth[id];
      const n = nodes.find(x => x.id === id);
      depth[id] = n && n.pid ? d(n.pid) + 1 : 0;
      return depth[id];
    }
    nodes.forEach(n => d(n.id));
    const byDepth = {};
    nodes.forEach(n => { (byDepth[depth[n.id]] = byDepth[depth[n.id]] || []).push(n); });
    Object.keys(byDepth).forEach(k => {
      byDepth[k].forEach((n, i) => {
        n.x = 40 + (+k) * 210;
        n.y = 50 + i * 66;
      });
    });
    render();
  }

  function exportSVG() {
    const parts = [];
    nodes.forEach(n => {
      if (!n.pid) return;
      const p = nodes.find(x => x.id === n.pid);
      if (!p) return;
      const x1 = p.x + NODE_W, y1 = p.y + NODE_H / 2, x2 = n.x, y2 = n.y + NODE_H / 2, mx = (x1 + x2) / 2;
      parts.push(`<path d="M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}" fill="none" stroke="#b7c4ea" stroke-width="2"/>`);
    });
    nodes.forEach(n => {
      parts.push(`<rect x="${n.x}" y="${n.y}" width="${NODE_W}" height="${NODE_H}" rx="10" fill="#edf3ee" stroke="#4f8777"/>`);
      parts.push(`<text x="${n.x + NODE_W / 2}" y="${n.y + 26}" text-anchor="middle" font-size="12" fill="#24304f" font-family="Microsoft YaHei">${esc(n.text)}</text>`);
    });
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="620">${parts.join("")}</svg>`;
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "mindmap.svg";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  function mount(root) {
    root.innerHTML = `
      <div class="mm-wrap">
        <div class="mm-toolbar">
          <button class="btn primary" id="mmAdd">＋ 添加子节点</button>
          <button class="btn" id="mmRename">✏️ 重命名</button>
          <button class="btn" id="mmDel">🗑 删除</button>
          <button class="btn" id="mmAuto">🪄 自动整理</button>
          <button class="btn" id="mmSvg">⬇ 导出 SVG</button>
          <span class="note" id="mmTip">点击节点选中，拖动可移动</span>
        </div>
        <div class="mm-scroll"><div class="mm-canvas" id="mmCanvas"><svg class="mm-lines" id="mmLines"></svg></div></div>
      </div>`;
    els = {
      canvas: root.querySelector("#mmCanvas"),
      lines: root.querySelector("#mmLines"),
      tip: root.querySelector("#mmTip"),
      nodeMap: {}
    };
    els.canvas.style.width = "1200px";
    els.canvas.style.height = "620px";
    els.lines.setAttribute("width", "1200");
    els.lines.setAttribute("height", "620");

    demo();
    render();

    root.querySelector("#mmAdd").addEventListener("click", addChild);
    root.querySelector("#mmRename").addEventListener("click", renameNode);
    root.querySelector("#mmDel").addEventListener("click", removeNode);
    root.querySelector("#mmAuto").addEventListener("click", autoLayout);
    root.querySelector("#mmSvg").addEventListener("click", exportSVG);

    window.addEventListener("pointermove", (e) => {
      if (!drag) return;
      const n = nodes.find(x => x.id === drag.id);
      if (!n) return;
      const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
      if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
      n.x = Math.max(0, drag.ox + dx);
      n.y = Math.max(0, drag.oy + dy);
      const el = els.nodeMap[n.id];
      if (el) { el.style.left = n.x + "px"; el.style.top = n.y + "px"; }
      updateLines();
    });
    window.addEventListener("pointerup", () => { drag = null; });
  }

  return { mount };
})();
