# -*- coding: utf-8 -*-
"""打印视图：教案、学生卷、答案页、词卡任务卡、反馈订正样例、教学日志、操作卡。

页面为 A4 单栏，浏览器“打印 → 另存为 PDF”即可导出；交付的 PDF 由同一视图生成。
"""
from __future__ import annotations

import html

from . import api, content, db, guide

CSS = """
@page { size: A4; margin: 16mm 15mm; }
* { box-sizing: border-box; }
body { margin: 0; font-family: "Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", sans-serif;
       color: #1b2b28; font-size: 10.5pt; line-height: 1.65; background: #fff; }
.wrap { max-width: 180mm; margin: 0 auto; padding: 0; }
.brand { display: flex; justify-content: space-between; align-items: flex-end;
         border-bottom: 2px solid #2f5c51; padding-bottom: 6px; margin-bottom: 16px; }
.brand .name { font-size: 9pt; letter-spacing: .18em; color: #2f5c51; font-weight: 700; }
.brand .meta { font-size: 8.5pt; color: #5c6f68; }
h1 { font-family: Georgia, "Noto Serif SC", serif; font-size: 19pt; margin: 4px 0 6px; line-height: 1.3; }
h2 { font-family: Georgia, "Noto Serif SC", serif; font-size: 12pt; margin: 18px 0 6px; color: #2f5c51; }
h3 { font-size: 10.5pt; margin: 12px 0 4px; }
p { margin: 4px 0; }
.sub { color: #5c6f68; font-size: 9.5pt; }
.tag { display: inline-block; font-size: 8pt; border: 1px solid #dfe6dc; color: #2f5c51;
       border-radius: 3px; padding: 1px 6px; margin-right: 6px; background: #f3f5ee; }
table { width: 100%; border-collapse: collapse; margin: 6px 0 10px; }
th, td { border: 1px solid #e2e7df; padding: 6px 7px; vertical-align: top; text-align: left; font-size: 9.5pt; }
th { background: #f1f5f9; font-weight: 700; }
td.num { width: 26px; text-align: center; color: #5c6f68; }
.kv { margin: 3px 0; }
.kv b { color: #2f5c51; }
ol, ul { margin: 4px 0 4px 18px; padding: 0; }
li { margin: 2px 0; }
.box { border: 1px solid #e2e7df; background: #fbfdfd; padding: 8px 10px; border-radius: 4px; margin: 6px 0; }
.box.green { border-color: #cfe0d6; background: #f4f7f0; }
.box.amber { border-color: #f3d9a5; background: #fffaf0; }
.label { font-size: 8.5pt; color: #5c6f68; letter-spacing: .08em; text-transform: uppercase; }
.blank { border-bottom: 1px solid #1b2b28; display: inline-block; min-width: 90px; }
.footer { margin-top: 18px; border-top: 1px solid #e2e7df; padding-top: 6px;
          font-size: 8.5pt; color: #5c6f68; display: flex; justify-content: space-between; }
.cards { display: flex; flex-wrap: wrap; gap: 8px; }
.card { width: 84mm; border: 1px dashed #8fa79c; border-radius: 6px; padding: 10px 12px; page-break-inside: avoid; }
.card .w { font-size: 17pt; font-weight: 700; letter-spacing: .02em; }
.card .ct { float: right; width: 22mm; height: 22mm; object-fit: contain; border-radius: 50%;
              background: #f6f2e7; padding: 2.5mm; box-sizing: border-box; }
.card .ct-letter { display: flex; align-items: center; justify-content: center; border-radius: 50%;
                  background: #eef4ee; color: #2f5c51; font-family: Georgia, serif; font-size: 20pt; font-weight: 700; }
.card .zh { color: #5c6f68; font-size: 9.5pt; }
.card .s { font-size: 9pt; margin-top: 6px; }
.q { margin: 10px 0; page-break-inside: avoid; }
.q .stem { font-weight: 600; }
.opts { margin: 4px 0 0 16px; color: #314741; }
.opt { display: inline-block; min-width: 44%; }
.line { border-bottom: 1px solid #c9d3cb; height: 20px; margin-top: 6px; }
.note { font-size: 9pt; color: #5c6f68; }
h2, h3 { break-after: avoid; page-break-after: avoid; }
tr, .card, .box, .q { break-inside: avoid; page-break-inside: avoid; }
@media print { body { background: #fff; } .wrap { max-width: none; } }
"""

SOURCE_TEXT = content.SOURCE_LABEL


def esc(value):
    return html.escape(str(value if value is not None else ""))


def page(title, body, subtitle=""):
    return ("<!doctype html><html lang=\"zh-CN\"><head><meta charset=\"utf-8\">"
            "<title>" + esc(title) + "</title><style>" + CSS + "</style></head><body><div class=\"wrap\">"
            "<div class=\"brand\"><div class=\"name\">AI4En 英语教学助手</div>"
            "<div class=\"meta\">" + esc(subtitle) + "</div></div>" + body +
            "<div class=\"footer\"><span>AI4En · 教师主导 · 内容可编辑 · 结果可核对</span>"
            "<span>打印 / 另存为 PDF（A4）</span></div></div></body></html>")


def _lesson_for_print(lesson_id, user):
    lesson = api.load_lesson(lesson_id, user["id"])
    return lesson, api.lesson_bundle(lesson)


def lesson_page(lesson_id, user):
    lesson, bundle = _lesson_for_print(lesson_id, user)
    plan = bundle["plan"]["data"]
    flow = "".join(
        "<tr><td class=\"num\">" + str(i) + "</td><td>" + esc(row.get("stage", "")) + "<br><span class=\"note\">"
        + esc(str(row.get("minutes", ""))) + " 分钟</span></td><td>" + esc(row.get("teacher", "")) +
        "</td><td>" + esc(row.get("student", "")) + "</td><td>" + esc(row.get("check", "")) + "</td></tr>"
        for i, row in enumerate(plan.get("flow") or [], 1))
    objectives = "".join("<li>" + esc(o) + "</li>" for o in plan.get("objectives") or [])
    status = "已审核" if lesson["status"] == "approved" else "草稿"
    body = (
        "<h1>" + esc(lesson["title"]) + "</h1>"
        "<div class=\"sub\">" + esc(lesson["grade"]) + " · 主题 " + esc(lesson["topic"]) + " · "
        + esc(lesson["duration"]) + " 分钟 · 教案（" + status + "）</div>"
        "<div style=\"margin:8px 0\"><span class=\"tag\">目标词："
        + esc("、".join(bundle["vocab"])) + "</span><span class=\"tag\">目标句："
        + esc(" / ".join(bundle["sentences"])) + "</span><span class=\"tag\">来源："
        + esc(SOURCE_TEXT.get(bundle["plan"]["source"], bundle["plan"]["source"] or "示例内容")) + "</span></div>"
        "<h2>学习目标</h2><ol>" + objectives + "</ol>"
        "<h2>重点与难点</h2>"
        "<p class=\"kv\"><b>重点：</b>" + esc(plan.get("key_points", "")) + "</p>"
        "<p class=\"kv\"><b>难点：</b>" + esc(plan.get("difficulties", "")) + "</p>"
        "<h2>教学流程</h2>"
        "<table><thead><tr><th style=\"width:26px\">#</th><th style=\"width:92px\">环节 / 时间</th>"
        "<th>教师活动</th><th>学生活动</th><th>检查方式</th></tr></thead><tbody>" + flow + "</tbody></table>"
        "<h2>板书建议</h2><p>" + esc(plan.get("board", "")) + "</p>"
        "<h2>课后任务</h2><p>" + esc(plan.get("homework", "")) + "</p>"
        "<h2>材料准备</h2><p>" + esc(plan.get("materials", "")) + "</p>"
        + ("<h2>设计说明</h2><p>" + esc(plan.get("rationale", "")) + "</p>" if plan.get("rationale") else "")
        + ("<div class=\"box\"><span class=\"label\">教师备注</span><p>" + esc(lesson["notes"]) + "</p></div>"
           if lesson["notes"] else "")
    )
    return page(lesson["title"] + " · 教案", body, "教案 · 打印视图")


def _task_items(task_id, user):
    task = api.teacher_task({"user": user, "params": {}, "query": {}, "body": {}}, task_id)
    snapshot = db.loads(task["snapshot"])
    return task, snapshot


def paper_page(task_id, user):
    task, snapshot = _task_items(task_id, user)
    items = snapshot.get("items", [])
    parts = []
    for idx, item in enumerate(items, 1):
        if item["type"] == "choice":
            opts = "".join("<span class=\"opt\">" + "ABCD"[i] + ". " + esc(o) + "</span>"
                           for i, o in enumerate(item.get("options") or []))
            parts.append("<div class=\"q\"><div class=\"stem\">" + str(idx) + ". " + esc(item["stem"]) +
                         "</div><div class=\"opts\">" + opts + "</div></div>")
        elif item["type"] == "fill":
            parts.append("<div class=\"q\"><div class=\"stem\">" + str(idx) + ". " + esc(item["stem"]) +
                         "</div><div class=\"line\"></div></div>")
        else:
            parts.append("<div class=\"q\"><div class=\"stem\">" + str(idx) + ". " + esc(item["stem"]) +
                         "</div><div class=\"line\"></div><div class=\"line\"></div><div class=\"line\"></div></div>")
    body = (
        "<h1>" + esc(task["title"]) + " · 学生卷</h1>"
        "<div class=\"sub\">" + esc(snapshot.get("lesson_title", "")) + " · " + esc(task["due_at"] or "不限时间") +
        " 前提交</div>"
        "<p style=\"margin:12px 0\">班级：<span class=\"blank\"></span>　姓名：<span class=\"blank\"></span>"
        "　学号：<span class=\"blank\"></span></p>"
        "<div class=\"box\"><span class=\"label\">作答说明</span><p>" + esc(task["instructions"] or "按题目要求作答。") + "</p></div>"
        + "".join(parts)
    )
    return page(task["title"] + " · 学生卷", body, "学生卷 · 打印视图")


def answers_page(task_id, user):
    task, snapshot = _task_items(task_id, user)
    items = snapshot.get("items", [])
    rows = []
    for idx, item in enumerate(items, 1):
        if item["type"] == "choice":
            answer = item.get("answer", "")
            detail = "选项 " + str(answer)
        elif item["type"] == "fill":
            answer = item.get("answer", "")
            detail = "；".join(item.get("accept") or []) or answer
            if item.get("rule"):
                detail += "（" + item["rule"] + "）"
        else:
            answer = item.get("answer", "")
            detail = ""
        rows.append(
            "<tr><td class=\"num\">" + str(idx) + "</td><td>" + esc(item.get("stem", "")) + "</td>"
            "<td>" + esc(answer) + "</td><td>" + esc(item.get("analysis", "")) + "</td>"
            "<td>" + esc(item.get("target", "")) + "</td></tr>")
        if item["type"] == "short":
            criteria = "".join("<li>" + esc(c) + "</li>" for c in item.get("criteria") or [])
            rows.append("<tr><td class=\"num\"></td><td colspan=\"4\"><b>评价要点：</b><ul>" + criteria +
                        "</ul><b>句架：</b>" + esc(item.get("frame", "")) + "　<b>关键词：</b>" +
                        esc(item.get("keywords", "")) + "<br><b>可接受答案示例：</b>" + esc(detail) + "</td></tr>")
    body = (
        "<h1>" + esc(task["title"]) + " · 独立答案页</h1>"
        "<div class=\"sub\">教师用 · 请勿发给学生 · " + esc(snapshot.get("lesson_title", "")) + "</div>"
        "<div class=\"box amber\"><span class=\"label\">使用提示</span><p>选择题与填空题按本页答案判定；"
        "开放题不自动判分，请按评价要点确认反馈后再让学生订正。</p></div>"
        "<table><thead><tr><th style=\"width:26px\">#</th><th>题干</th><th style=\"width:130px\">答案</th>"
        "<th style=\"width:180px\">解析</th><th style=\"width:90px\">目标</th></tr></thead><tbody>"
        + "".join(rows) + "</tbody></table>"
    )
    return page(task["title"] + " · 答案页", body, "答案页 · 教师用")


def cards_page(lesson_id, user):
    lesson, bundle = _lesson_for_print(lesson_id, user)
    cards = bundle["materials"].get("cards", {}).get("data") or {}
    def art(c):
        if c.get("image"):
            return "<img class=\"ct\" src=\"" + esc(c["image"]) + "\" alt=\"\" width=\"96\" height=\"96\">"
        return "<div class=\"ct ct-letter\">" + esc(c.get("initial", "")) + "</div>"

    word_cards = "".join(
        "<div class=\"card\">" + art(c)
        + "<div class=\"w\">" + esc(c.get("word", "")) + "</div><div class=\"zh\">" + esc(c.get("zh", "")) + "</div>"
        "<div class=\"s\">" + esc(c.get("sentence", "")) + "</div></div>"
        for c in cards.get("word_cards") or [])
    talk = cards.get("talk_card") or {}
    handout = cards.get("handout") or {}
    body = (
        "<h1>" + esc(lesson["title"]) + " · 词卡与任务卡</h1>"
        "<div class=\"sub\">" + esc(lesson["grade"]) + " · 使用环节：" + esc(talk.get("stage", "")) + "</div>"
        "<h2>动物词卡（沿虚线剪开）</h2><div class=\"cards\">" + word_cards + "</div>"
        "<h2>口头问答任务卡</h2>"
        "<div class=\"box green\"><h3>" + esc(talk.get("title", "")) + "</h3>"
        "<p class=\"kv\"><b>目标句型：</b>" + esc(talk.get("pattern", "")) + "</p>"
        "<p class=\"kv\"><b>学生任务：</b>" + esc(talk.get("student_task", "")) + "</p>"
        "<p class=\"kv\"><b>教师检查：</b>" + esc(talk.get("teacher_check", "")) + "</p>"
        "<p class=\"kv\"><b>提示：</b>" + esc(talk.get("tip", "")) + "</p></div>"
        "<h2>家庭活动卡</h2><div class=\"box\"><h3>" + esc(handout.get("title", "")) + "</h3><ol>"
        + "".join("<li>" + esc(s) + "</li>" for s in handout.get("steps") or []) + "</ol>"
        "<p class=\"note\">" + esc(handout.get("note", "")) + "</p></div>"
    )
    return page(lesson["title"] + " · 词卡任务卡", body, "资源 · 打印视图")


def feedback_page(submission_id, user):
    row, role = api.load_submission({"user": user}, submission_id)
    task = db.query_one("SELECT * FROM tasks WHERE id = ?", (row["task_id"],))
    snapshot = db.loads(task["snapshot"])
    items = {i["id"]: i for i in snapshot.get("items", [])}
    answers = db.loads(row["answers"], {})
    history = db.query("SELECT * FROM revisions WHERE submission_id = ? ORDER BY id", (row["id"],))
    first = db.loads(history[0]["answers"], {}) if history else answers
    feedbacks = db.query("SELECT * FROM feedback WHERE submission_id = ? ORDER BY id", (row["id"],))
    blocks = []
    for fb in feedbacks:
        item = items.get(fb["item_id"], {})
        blocks.append(
            "<div class=\"box green\"><h3>" + esc(item.get("stem", fb["item_id"])) + "</h3>"
            "<p class=\"kv\"><b>首次作答：</b>" + esc(first.get(fb["item_id"], "—")) + "</p>"
            "<p class=\"kv\"><b>教师已确认反馈：</b>" + esc(fb["final"] or "（尚未确认）") + "</p>"
            "<p class=\"kv\"><b>订正后：</b>" + esc(answers.get(fb["item_id"], "—")) + "</p>"
            "<p class=\"kv\"><b>评价描述：</b>" + esc(fb["level"] or "—") + "　<span class=\"note\">确认时间 "
            + esc(fb["confirmed_at"] or "—") + "</span></p></div>")
    body = (
        "<h1>反馈与订正样例</h1>"
        "<div class=\"sub\">" + esc(row["student_name"]) + " · " + esc(row["task_title"]) + " · 状态 "
        + esc(row["status"]) + "</div>"
        "<p class=\"note\">保留首次作答与订正两版；教师确认后的反馈才进入学生页面。</p>"
        + ("".join(blocks) if blocks else "<div class=\"box\">暂无已生成或已确认的开放题反馈。</div>")
        + "<h2>记录时间</h2><p class=\"kv\">首次提交：" + esc(row["submitted_at"]) + "　最近更新："
        + esc(row["updated_at"]) + "</p>"
    )
    return page("反馈与订正样例", body, "反馈记录 · 打印视图")


def log_page(lesson_id, user):
    lesson, bundle = _lesson_for_print(lesson_id, user)
    logs = bundle["logs"]
    blocks = []
    for log in logs:
        blocks.append(
            "<div class=\"box\"><p class=\"kv\"><b>本课完成情况</b></p><p>" + esc(log["completed"]) + "</p>"
            "<p class=\"kv\"><b>常见问题</b></p><p>" + esc(log["issues"]) + "</p>"
            "<p class=\"kv\"><b>下次调整</b></p><p>" + esc(log["next_adjust"]) + "</p>"
            "<p class=\"note\">记录时间 " + esc(log["updated_at"]) + " · 来源 "
            + esc(SOURCE_TEXT.get(log["source"], log["source"])) + "</p></div>")
    body = ("<h1>" + esc(lesson["title"]) + " · 教学日志</h1><div class=\"sub\">" + esc(lesson["grade"])
            + " · 与课例关联 · 只用于教学调整</div>" + ("".join(blocks) if blocks else "<p>暂无记录。</p>"))
    return page(lesson["title"] + " · 教学日志", body, "教学日志 · 打印视图")


def dictation_page(lesson_id, user):
    lesson, bundle = _lesson_for_print(lesson_id, user)
    words = bundle["vocab"] or []
    latest = db.query("SELECT * FROM dictations WHERE lesson_id = ? ORDER BY id DESC LIMIT 1", (lesson["id"],))
    last = None
    if latest:
        last = {"words": db.loads(latest[0]["words"], []), "wrong": db.loads(latest[0]["wrong"], []),
                "note": latest[0]["note"], "created_at": latest[0]["created_at"]}
    listen = last["words"] if last else words
    answer_lines = "".join("<div class=\"line\"></div>" for _ in range(max(len(listen), 4)))
    marking = "".join("<span class=\"opt\">□ " + esc(w) + "</span>" for w in listen)
    body = (
        "<h1>" + esc(lesson["title"]) + " · 听写答题纸</h1>"
        "<div class=\"sub\">" + esc(lesson["grade"]) + " · 目标词听写 · 共 " + str(len(listen)) + " 个词</div>"
        "<p style=\"margin:12px 0\">班级：<span class=\"blank\"></span>　姓名：<span class=\"blank\"></span>"
        "　日期：<span class=\"blank\"></span>　得分：<span class=\"blank\"></span></p>"
        "<div class=\"box\"><span class=\"label\">听写说明</span><p>教师读单词，每个词读两遍；学生写英文单词。"
        "写错不要紧，批改后把错词抄进下面的订正栏。</p></div>"
        "<h2>学生作答</h2>" + answer_lines +
        "<h2 style=\"page-break-before:always\">订正栏（错词抄写两遍）</h2>"
        "<div class=\"line\"></div><div class=\"line\"></div><div class=\"line\"></div><div class=\"line\"></div>"
        "<h2>教师用：听写词表与批改</h2>"
        "<div class=\"box green\"><span class=\"label\">本次听写词表</span><p>" + esc(" / ".join(listen)) + "</p></div>"
        "<p class=\"kv\"><b>错词勾选：</b>" + (marking or "—") + "</p>"
        "<div class=\"line\"></div>"
        "<p class=\"note\">批改后回到“结果与日志 → 听写登记”，勾选错词保存；错词会与错题清单一起用于下次复习。"
        + ((" 上次记录：" + esc(last["created_at"]) + "，错词 " + esc("、".join(last["wrong"]) or "无") + "。")
           if last else "") + "</p>"
    )
    return page(lesson["title"] + " · 听写答题纸", body, "听写 · 打印视图")


def guide_page(view, user):
    data = guide.payload()
    if view == "training":
        rows = "".join("<tr><td>" + esc(t["time"]) + "</td><td>" + esc(t["task"]) + "</td><td>" + esc(t["check"])
                       + "</td></tr>" for t in data["training"])
        body = ("<h1>教师培训：60 分钟工作坊</h1>"
                "<div class=\"sub\">使用同一课例（Animals）与已有页面，教师跟随完成一轮实际修改。</div>"
                "<table><thead><tr><th style=\"width:80px\">时间</th><th>教师实践任务</th><th style=\"width:150px\">可检查的结果</th>"
                "</tr></thead><tbody>" + rows + "</tbody></table>"
                "<h2>培训前准备</h2><ul><li>教师账号 t_wang 与演示课例 Animals 已就绪。</li>"
                "<li>电脑能打开 PPTX 与 PDF；投屏可用。</li><li>每人一份本页打印稿，用于记录卡点。</li></ul>"
                "<h2>培训后检查</h2><ul><li>每人至少完成一次教案修改并保存。</li>"
                "<li>每人导出一份 PPTX 并实际打开。</li><li>每人确认一条反馈，并写出一个下次调整。</li></ul>")
        return page("教师培训 · 60 分钟", body, "培训流程 · 打印视图")
    if view == "prompts":
        blocks = "".join("<div class=\"box\"><h3>" + esc(p["title"]) + "</h3><div class=\"note\">"
                         + esc(p["scene"]) + "</div><pre style=\"white-space:pre-wrap;font-family:inherit;font-size:9.5pt\">"
                         + esc(p["body"]) + "</pre><p class=\"note\">" + esc(p["note"]) + "</p></div>"
                         for p in data["prompts"])
        body = ("<h1>可复制提示词</h1><div class=\"sub\">提示词模板可直接粘贴到模型服务；"
                "应用内“使用指南”页也能一键复制。</div>" + blocks)
        return page("可复制提示词", body, "提示词模板 · 打印视图")
    steps = "".join("<div class=\"box\"><h3>" + esc(s["title"]) + "</h3><ol>"
                    + "".join("<li>" + esc(i) + "</li>" for i in s["items"]) + "</ol></div>"
                    for s in data["steps"])
    body = ("<h1>教师操作卡</h1><div class=\"sub\">按“备课 → 课件 → 活动 → 作业反馈”四步完成一次完整使用。"
            "建议打印后放在讲台上。</div>" + steps
            + "<h2>演示账号</h2><table><thead><tr><th>身份</th><th>账号</th><th>密码</th></tr></thead><tbody>"
            "<tr><td>教师</td><td>t_wang</td><td>teach123</td></tr>"
            "<tr><td>学生</td><td>s_zhang</td><td>stu123</td></tr>"
            "<tr><td>家长</td><td>p_zhang</td><td>par123</td></tr></tbody></table>")
    return page("教师操作卡", body, "使用指南 · 打印视图")


def render(path, query, user):
    """返回 (status, html)。路径不匹配时抛 api.ApiError。"""
    parts = [p for p in path.strip("/").split("/") if p]
    if len(parts) < 2 or parts[0] != "print":
        raise api.ApiError(404, "页面不存在", "not_found")
    if not user:
        raise api.ApiError(401, "请先登录再打开打印视图", "unauthorized")
    kind = parts[1]
    try:
        if kind == "lesson" and len(parts) == 3:
            return 200, lesson_page(int(parts[2]), user)
        if kind == "task" and len(parts) == 4:
            if parts[3] == "paper":
                return 200, paper_page(int(parts[2]), user)
            if parts[3] == "answers":
                return 200, answers_page(int(parts[2]), user)
        if kind == "cards" and len(parts) == 3:
            return 200, cards_page(int(parts[2]), user)
        if kind == "feedback" and len(parts) == 3:
            return 200, feedback_page(int(parts[2]), user)
        if kind == "log" and len(parts) == 3:
            return 200, log_page(int(parts[2]), user)
        if kind == "dictation" and len(parts) == 3:
            return 200, dictation_page(int(parts[2]), user)
        if kind == "guide" and len(parts) >= 3:
            return 200, guide_page(parts[2], user)
    except ValueError:
        raise api.ApiError(400, "编号格式不正确", "bad_id")
    raise api.ApiError(404, "页面不存在", "not_found")
