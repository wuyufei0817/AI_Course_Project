"use strict";

const activities = {
  games: { hash: "m6", title: "Animals 游戏闯关", note: "选一关复习词汇。配对后，请学生用完整句回答。" },
  lily: { hash: "m7", title: "Lily 动物园问答", note: "点击开始，看图回答。可用键盘输入完整英文句子。" }
};
const frame = document.querySelector("#activity");
const note = document.querySelector("#activity-note");
const fullscreen = document.querySelector("#fullscreen");
let current;

function showActivity() {
  const next = location.hash === "#lily" ? "lily" : "games";
  if (next === current) return;
  current = next;
  const activity = activities[next];
  for (const id of Object.keys(activities)) {
    const link = document.getElementById(id);
    if (id === current) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }
  frame.title = activity.title;
  frame.allow = next === "lily" ? "microphone 'self'" : "microphone 'none'";
  frame.src = "../lab/?embed=1&lesson=animals&activity=" + next + "#" + activity.hash;
  note.textContent = activity.note;
}

if (!document.fullscreenEnabled) fullscreen.hidden = true;
fullscreen.addEventListener("click", async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch {
    note.textContent = "当前浏览器未进入全屏。可按 F11 切换浏览器全屏。";
  }
});
const FS_ICON = '<svg class="ico-svg" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor"' +
  ' stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M4.4 9.2V4.4h4.8M19.6 9.2V4.4h-4.8M4.4 14.8v4.8h4.8M19.6 14.8v4.8h-4.8"/></svg>';
document.addEventListener("fullscreenchange", () => {
  fullscreen.innerHTML = FS_ICON + (document.fullscreenElement ? " 退出全屏" : " 全屏");
});
window.addEventListener("hashchange", showActivity);
showActivity();
