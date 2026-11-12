# -*- coding: utf-8 -*-
"""演示数据：班级、虚拟账号、Animals 课例包、已发布任务与作答记录。"""
from __future__ import annotations

import os
from datetime import datetime, timedelta

from . import auth, content, db

PASSWORD = {
    "teacher": "teach123",
    "student": "stu123",
    "parent": "par123",
}


def _add(sql, args=()):
    return db.execute(sql, args)


def run(reset=False):
    db.init()
    row = db.query_one("SELECT COUNT(*) AS c FROM users")
    if row and row["c"] and not reset:
        return False
    if reset:
        conn = db.connect()
        try:
            for table in ("sessions", "dictations", "observations", "gen_logs", "teaching_logs", "feedback", "revisions",
                          "submissions", "tasks", "exercises", "activities", "materials",
                          "plans", "lessons", "users", "classes"):
                conn.execute("DELETE FROM " + table)
            conn.execute("DELETE FROM sqlite_sequence")
            conn.commit()
        finally:
            conn.close()

    # ------------------------------------------------------------ 班级
    class_32 = _add("INSERT INTO classes (name, grade) VALUES (?, ?)", ("三年级 2 班", "小学三年级"))
    class_33 = _add("INSERT INTO classes (name, grade) VALUES (?, ?)", ("三年级 3 班", "小学三年级"))

    # ------------------------------------------------------------ 账号
    def add_user(username, name, role, class_id=None, child_id=None):
        return _add(
            "INSERT INTO users (username, password, name, role, class_id, child_id) VALUES (?, ?, ?, ?, ?, ?)",
            (username, auth.hash_password(PASSWORD[role]), name, role, class_id, child_id),
        )

    teacher = add_user("t_wang", "王雅静", "teacher", class_32)
    add_user("t_li", "李海峰", "teacher", class_33)
    students = {}
    for username, name in (
        ("s_zhang", "张小明"), ("s_li", "李佳怡"), ("s_wang", "王浩"),
        ("s_zhao", "赵雨"), ("s_chen", "陈思远"), ("s_sun", "孙悦"),
    ):
        students[username] = add_user(username, name, "student", class_32)
    add_user("s_zhou", "周子涵", "student", class_33)
    add_user("p_zhang", "张小明妈妈", "parent", child_id=students["s_zhang"])
    add_user("p_li", "李佳怡爸爸", "parent", child_id=students["s_li"])

    # ------------------------------------------------------------ 课例 1：Animals（已审核）
    lesson = content.demo_lesson()
    lesson_id = _add(
        """INSERT INTO lessons (teacher_id, title, grade, topic, vocab, sentences, duration, notes, status, source, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (teacher, lesson["title"], lesson["grade"], lesson["topic"], db.dumps(lesson["vocab"]),
         db.dumps(lesson["sentences"]), lesson["duration"], lesson["notes"], lesson["status"],
         lesson["source"], auth.now(), auth.now()),
    )
    plan = content.build_plan(lesson)
    _add("INSERT INTO plans (lesson_id, data, source, updated_at) VALUES (?, ?, ?, ?)",
         (lesson_id, db.dumps(plan), plan.get("source", "sample"), auth.now()))
    now = auth.now()
    _add("INSERT INTO materials (lesson_id, kind, data, source, updated_at) VALUES (?, ?, ?, ?, ?)",
         (lesson_id, "slides", db.dumps(content.build_slides(lesson)), "sample", now))
    _add("INSERT INTO materials (lesson_id, kind, data, source, updated_at) VALUES (?, ?, ?, ?, ?)",
         (lesson_id, "cards", db.dumps(content.build_cards(lesson)), "sample", now))
    exercises = content.build_exercises(lesson)
    _add("INSERT INTO exercises (lesson_id, data, source, updated_at) VALUES (?, ?, ?, ?)",
         (lesson_id, db.dumps(exercises), "sample", now))

    match_pairs = [
        {"left": "cat", "right": "猫", "image": "/static/words/cat.webp"},
        {"left": "dog", "right": "狗", "image": "/static/words/dog.webp"},
        {"left": "panda", "right": "熊猫", "image": "/static/words/panda.webp"},
        {"left": "frog", "right": "青蛙", "image": "/static/words/frog.webp"},
    ]
    _add("INSERT INTO activities (lesson_id, kind, data, source, updated_at) VALUES (?, ?, ?, ?, ?)",
         (lesson_id, "match", db.dumps({
             "title": "词义配对 · 4 组",
             "instruction": "点左边单词，再点右边的意思，配对成功会变绿；全部完成后可以重玩。",
             "pairs": match_pairs,
         }), "sample", now))
    _add("INSERT INTO activities (lesson_id, kind, data, source, updated_at) VALUES (?, ?, ?, ?, ?)",
         (lesson_id, "order", db.dumps({
             "title": "句子排序 · It's a cat.",
             "instruction": "按正确顺序点词块造句，也可以直接用键盘输入序号；提交后看提示。",
             "sentence": "It's a cat.",
             "tokens": ["It's", "a", "cat", "."],
             "hint": "先说 It's，再放 a 和动物词，最后是句号。",
         }), "sample", now))
    for kind, provider in (("plan", "sample"), ("exercises", "sample"), ("cards", "sample")):
        _add("""INSERT INTO gen_logs (lesson_id, kind, provider, model, status, latency_ms, error, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
             (lesson_id, kind, provider, "", "success", 0, "", now))

    # ------------------------------------------------------------ 课例 2：草稿（演示生成）
    lesson2 = {
        "title": "My Family: Who's this?",
        "grade": "小学三年级",
        "topic": "My Family",
        "vocab": ["father", "mother", "brother", "sister"],
        "sentences": ["Who's this?", "It's my father."],
        "duration": 40,
        "notes": "Unit 3 My Family 第 1 课时，待备课。",
    }
    lesson2_id = _add(
        """INSERT INTO lessons (teacher_id, title, grade, topic, vocab, sentences, duration, notes, status, source, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (teacher, lesson2["title"], lesson2["grade"], lesson2["topic"], db.dumps(lesson2["vocab"]),
         db.dumps(lesson2["sentences"]), lesson2["duration"], lesson2["notes"], "draft", "sample",
         now, now),
    )
    _add("INSERT INTO exercises (lesson_id, data, source, updated_at) VALUES (?, ?, ?, ?)",
         (lesson2_id, db.dumps({"support": "frame", "items": []}), "sample", now))

    # ------------------------------------------------------------ 已发布任务
    due_at = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d 20:00")
    snapshot = {
        "title": "Unit 4 Animals · 课堂短练习",
        "instructions": "先读题，再作答。选择题只选一个；填空题只填一个单词；第 7 题写 2 句话。做完点“提交”，提交后不能再改，除非老师要求订正。",
        "due_at": due_at,
        "allow_hints": 1,
        "show_result": "immediately",
        "items": exercises["items"],
        "support": exercises.get("support", "frame"),
        "lesson_title": lesson["title"],
    }
    task_id = _add(
        """INSERT INTO tasks (lesson_id, class_id, title, instructions, due_at, allow_hints, show_result, status, snapshot, student_count, published_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (lesson_id, class_32, snapshot["title"], snapshot["instructions"], snapshot["due_at"], 1,
         snapshot["show_result"], "ongoing", db.dumps(snapshot), 6, "2026-11-03 08:40:00", "2026-11-03 08:30:00"),
    )

    # ------------------------------------------------------------ 学生作答
    def submit(student_key, answers, status="submitted", at="2026-11-03 19:20:00"):
        grading = {}
        for item in exercises["items"]:
            ok, _ = content.grade_item(item, answers.get(item["id"], ""))
            grading[item["id"]] = ok
        sid = _add(
            """INSERT INTO submissions (task_id, student_id, status, answers, grading, submitted_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (task_id, students[student_key], status, db.dumps(answers), db.dumps(grading), at, at),
        )
        return sid

    def feedback(sid, item_id, final, level, status, source="manual", draft=""):
        _add(
            """INSERT INTO feedback (submission_id, item_id, draft, final, level, status, source, confirmed_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (sid, item_id, draft, final, level, status, source,
             "2026-11-03 21:10:00" if status == "confirmed" else None),
        )

    short_item = [i for i in exercises["items"] if i["type"] == "short"][0]

    # 张小明：原始作答有拼写问题 → 教师确认反馈 → 学生已订正
    zhang = submit("s_zhang", {
        "q1": "B", "q2": "B", "q3": "A", "q4": "C", "q5": "dog", "q6": "a",
        "q7": "It's a cat. It is white.",
    }, status="resubmitted", at="2026-11-03 19:22:00")
    draft = content.draft_feedback("It's a cta.", short_item, lesson["vocab"])
    feedback(zhang, "q7",
             "你写出了介绍动物的句型，很好。请对照词卡检查动物名称 cat 中字母的顺序：c-a-t。下一步可以加上颜色：It is white。",
             "需局部修改", "confirmed", source="rule", draft=draft)
    _add("INSERT INTO revisions (submission_id, answers, created_at) VALUES (?, ?, ?)",
         (zhang, db.dumps({"q1": "B", "q2": "B", "q3": "A", "q4": "C", "q5": "dog", "q6": "a",
                           "q7": "It's a cta."}), "2026-11-03 19:22:00"))

    # 李佳怡：全对，反馈已确认
    li = submit("s_li", {
        "q1": "B", "q2": "B", "q3": "A", "q4": "C", "q5": "dog", "q6": "a",
        "q7": "It's a panda. It is black and white.",
    }, at="2026-11-03 19:05:00")
    feedback(li, "q7",
             "两句话都回应了任务：先写动物、再写颜色，句子完整。下一步可以用另一张动物卡（dog）再说一遍，确认能独立完成。",
             "已完成", "confirmed", source="rule",
             draft=content.draft_feedback("It's a panda. It is black and white.", short_item, lesson["vocab"]))

    # 王浩：有错题，反馈草稿未确认（学生看不到）
    wang = submit("s_wang", {
        "q1": "B", "q2": "C", "q3": "A", "q4": "C", "q5": "dog", "q6": "a", "q7": "It a panda.",
    }, at="2026-11-03 20:10:00")
    feedback(wang, "q7", "", "", "draft", source="rule",
             draft=content.draft_feedback("It a panda.", short_item, lesson["vocab"]))

    # 赵雨：第 4 题错，反馈草稿未确认
    zhao = submit("s_zhao", {
        "q1": "B", "q2": "B", "q3": "A", "q4": "B", "q5": "dog", "q6": "a", "q7": "It's a frog. It is green.",
    }, at="2026-11-04 07:40:00")
    feedback(zhao, "q7", "", "", "draft", source="rule",
             draft=content.draft_feedback("It's a frog. It is green.", short_item, lesson["vocab"]))

    # ------------------------------------------------------------ 课堂观察与听写
    _add("""INSERT INTO observations (lesson_id, task_id, student_id, kind, result, note, created_at)
            VALUES (?, ?, ?, 'independent', ?, ?, ?)""",
         (lesson_id, task_id, students["s_zhang"], "独立完成",
          "换一张 dog 图再问 What's this?，先说 It's 再补 a，能独立完成；颜色句也完整。",
          "2026-11-04 10:12:00"))
    _add("""INSERT INTO observations (lesson_id, task_id, student_id, kind, result, note, created_at)
            VALUES (?, ?, ?, 'independent', ?, ?, ?)""",
         (lesson_id, task_id, students["s_wang"], "需要提示",
          "抽到 frog 时先说 It's frog，提醒后才补上 a；建议下节课再单独检查一次。",
          "2026-11-04 10:16:00"))
    _add("INSERT INTO dictations (lesson_id, words, wrong, note, created_at) VALUES (?, ?, ?, ?, ?)",
         (lesson_id, db.dumps(["cat", "dog", "panda", "frog"]), db.dumps(["panda"]),
          "panda 的重音在第一音节，拼写 p-a-n-d-a 需再练一次。", "2026-11-04 10:05:00"))

    # ------------------------------------------------------------ 教学日志
    _add("""INSERT INTO teaching_logs (lesson_id, task_id, completed, issues, next_adjust, source, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)""",
         (lesson_id, task_id,
          "五个环节全部完成，练习已发布：布置 6 人，已提交 4 人。课末有 1 分钟自评。",
          "第 2 题有 1 人把回答写成 This；第 7 题里 a 的漏写和 It's 的缩写是主要问题。",
          "下节课用 3 分钟做 It's 与 a 的听辨；把第 7 题的错句做成一页改错练习，再补一次同目标的小练。",
          "manual", "2026-11-04 18:20:00"))
    return True


if __name__ == "__main__":
    print("seeded" if run(reset=True) else "exists")
