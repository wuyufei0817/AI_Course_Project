# -*- coding: utf-8 -*-
"""AI4En 接口层：课例、材料、活动、任务、作答、反馈、统计与权限。"""
from __future__ import annotations

import re
from datetime import datetime, timedelta

from . import auth, content, db, guide

LEVELS = ("已完成", "需局部修改", "需教师帮助")


class ApiError(Exception):
    def __init__(self, status, message, code="error", extra=None):
        super().__init__(message)
        self.status = status
        self.message = message
        self.code = code
        self.extra = extra or {}


ROUTES = []


def route(method, pattern):
    compiled = re.compile("^" + pattern + "$")

    def wrap(func):
        ROUTES.append((method, compiled, func))
        return func

    return wrap


def dispatch(method, path, query, body, user, token=None):
    for m, pattern, func in ROUTES:
        if m != method:
            continue
        match = pattern.match(path)
        if not match:
            continue
        ctx = {
            "user": user,
            "params": match.groupdict(),
            "query": query,
            "body": body if isinstance(body, dict) else {},
            "method": method,
            "path": path,
            "token": token,
        }
        return func(ctx)
    raise ApiError(404, "接口不存在：" + method + " " + path, "not_found")


# ---------------------------------------------------------------- 基础工具


def need_user(ctx):
    if not ctx["user"]:
        raise ApiError(401, "登录已失效，请重新登录", "unauthorized")
    return ctx["user"]


def need_role(ctx, *roles):
    user = need_user(ctx)
    if user["role"] not in roles:
        raise ApiError(403, "当前身份无权访问该内容", "forbidden")
    return user


def now():
    return auth.now()


def parse_due(value):
    """把 2026-11-06 20:00 / 2026-11-06T20:00 / 2026-11-06 解析成本地时间。"""
    text = str(value or "").strip().replace("T", " ")
    if not text:
        return None
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%Y-%m-%d"):
        try:
            return datetime.strptime(text, fmt)
        except ValueError:
            continue
    return None


def is_overdue(task):
    due = parse_due(task.get("due_at"))
    return bool(due and datetime.now() > due)


def parse_id(value):
    try:
        return int(value)
    except (TypeError, ValueError):
        raise ApiError(400, "编号格式不正确", "bad_id")


def load_lesson(lesson_id, teacher_id):
    lesson = db.query_one("SELECT * FROM lessons WHERE id = ?", (lesson_id,))
    if not lesson:
        raise ApiError(404, "课例不存在", "not_found")
    if lesson["teacher_id"] != teacher_id:
        raise ApiError(403, "只能访问本人课例", "forbidden")
    return lesson


def lesson_bundle(lesson):
    lesson_id = lesson["id"]
    plan_row = db.query_one("SELECT * FROM plans WHERE lesson_id = ?", (lesson_id,))
    materials = {}
    for row in db.query("SELECT * FROM materials WHERE lesson_id = ?", (lesson_id,)):
        materials[row["kind"]] = {"data": db.loads(row["data"]), "source": row["source"], "updated_at": row["updated_at"]}
    ex_row = db.query_one("SELECT * FROM exercises WHERE lesson_id = ?", (lesson_id,))
    activities = []
    for row in db.query("SELECT * FROM activities WHERE lesson_id = ? ORDER BY id", (lesson_id,)):
        activities.append({"id": row["id"], "kind": row["kind"], "data": db.loads(row["data"]),
                           "source": row["source"], "updated_at": row["updated_at"]})
    tasks = db.query("SELECT * FROM tasks WHERE lesson_id = ? ORDER BY id DESC", (lesson_id,))
    logs = db.query("SELECT * FROM teaching_logs WHERE lesson_id = ? ORDER BY id DESC", (lesson_id,))
    return {
        "id": lesson_id,
        "title": lesson["title"],
        "grade": lesson["grade"],
        "topic": lesson["topic"],
        "vocab": db.loads(lesson["vocab"], []),
        "sentences": db.loads(lesson["sentences"], []),
        "duration": lesson["duration"],
        "notes": lesson["notes"],
        "status": lesson["status"],
        "source": lesson["source"],
        "updated_at": lesson["updated_at"],
        "plan": {"data": db.loads(plan_row["data"]) if plan_row else {},
                 "source": plan_row["source"] if plan_row else "",
                 "updated_at": plan_row["updated_at"] if plan_row else ""},
        "materials": materials,
        "exercises": {"data": db.loads(ex_row["data"]) if ex_row else {"items": []},
                      "source": ex_row["source"] if ex_row else "",
                      "updated_at": ex_row["updated_at"] if ex_row else ""},
        "activities": activities,
        "tasks": [_task_brief(t) for t in tasks],
        "logs": logs,
    }


def _task_brief(task):
    snapshot = db.loads(task["snapshot"])
    return {
        "id": task["id"],
        "lesson_id": task["lesson_id"],
        "class_id": task["class_id"],
        "title": task["title"],
        "instructions": task["instructions"],
        "due_at": task["due_at"],
        "allow_hints": bool(task["allow_hints"]),
        "show_result": task["show_result"],
        "status": task["status"],
        "student_count": task["student_count"],
        "published_at": task["published_at"],
        "created_at": task["created_at"],
        "item_count": len(snapshot.get("items", [])),
        "submitted": db.query_one(
            "SELECT COUNT(*) AS c FROM submissions WHERE task_id = ?", (task["id"],))["c"],
    }


def strip_answers(items):
    clean = []
    for item in items:
        copy = dict(item)
        for key in ("answer", "accept", "analysis", "criteria"):
            copy.pop(key, None)
        clean.append(copy)
    return clean


def student_items(items, task):
    """学生（以及教师预览）看到的题目：去掉答案，并只保留本次选用的支架。"""
    support = db.loads(task["snapshot"], {}).get("support", "frame")
    clean = strip_answers(items)
    for item in clean:
        if not task["allow_hints"]:
            for key in ("hint", "frame", "keywords"):
                item.pop(key, None)
        elif support == "keywords":
            item.pop("frame", None)
        else:
            item.pop("keywords", None)
    return clean


def validate_items(items):
    missing = []
    if not items:
        missing.append("题目：至少需要 1 道题")
    for idx, item in enumerate(items, 1):
        tag = "第 " + str(idx) + " 题"
        if not str(item.get("stem") or "").strip():
            missing.append(tag + "：题干为空")
        kind = item.get("type")
        if kind == "choice":
            options = [o for o in (item.get("options") or []) if str(o).strip()]
            if len(options) < 2:
                missing.append(tag + "：选项不足 2 个")
            if not str(item.get("answer") or "").strip():
                missing.append(tag + "：缺少正确答案")
        elif kind == "fill":
            if not str(item.get("answer") or "").strip():
                missing.append(tag + "：缺少参考答案")
        elif kind == "short":
            if not (item.get("criteria") or []):
                missing.append(tag + "：缺少评价要点")
        else:
            missing.append(tag + "：题型未知")
    return missing


def load_task(task_id):
    task = db.query_one("SELECT * FROM tasks WHERE id = ?", (task_id,))
    if not task:
        raise ApiError(404, "任务不存在", "not_found")
    return task


def teacher_task(ctx, task_id):
    user = need_role(ctx, "teacher")
    task = load_task(task_id)
    load_lesson(task["lesson_id"], user["id"])
    return task


def student_task(task, student):
    if task["status"] == "draft":
        raise ApiError(404, "任务不存在", "not_found")
    if task["class_id"] != student["class_id"]:
        raise ApiError(403, "该任务不在你所在的班级", "forbidden")
    return task


def submission_of(task_id, student_id):
    return db.query_one("SELECT * FROM submissions WHERE task_id = ? AND student_id = ?", (task_id, student_id))


def load_submission(ctx, sid):
    row = db.query_one(
        """SELECT s.*, t.title AS task_title, t.class_id, t.lesson_id, t.status AS task_status,
                  u.name AS student_name, u.username AS student_username
           FROM submissions s JOIN tasks t ON t.id = s.task_id
           JOIN users u ON u.id = s.student_id WHERE s.id = ?""", (sid,))
    if not row:
        raise ApiError(404, "作答记录不存在", "not_found")
    user = need_user(ctx)
    if user["role"] == "teacher":
        load_lesson(row["lesson_id"], user["id"])
        return row, "teacher"
    if user["role"] == "student":
        if row["student_id"] != user["id"]:
            raise ApiError(403, "只能查看本人作答", "forbidden")
        return row, "student"
    if user["role"] == "parent":
        if row["student_id"] != user.get("child_id"):
            raise ApiError(403, "只能查看绑定孩子的记录", "forbidden")
        return row, "parent"
    raise ApiError(403, "无权访问", "forbidden")


# ---------------------------------------------------------------- 会话


@route("POST", "/api/login")
def api_login(ctx):
    body = ctx["body"]
    username = str(body.get("username", "")).strip()
    password = str(body.get("password", ""))
    if not username or not password:
        raise ApiError(400, "请输入账号和密码", "missing")
    result = auth.login(username, password)
    if not result:
        raise ApiError(401, "账号或密码不正确", "bad_credentials")
    token, user = result
    return 200, {"ok": True, "user": auth.public_user(user), "token": token}


@route("POST", "/api/logout")
def api_logout(ctx):
    token = ctx.get("token")
    auth.logout(token)
    return 200, {"ok": True}


@route("GET", "/api/me")
def api_me(ctx):
    user = need_user(ctx)
    return 200, {"user": auth.public_user(user)}


@route("POST", "/api/chat")
def api_chat(ctx):
    """助教完整版（/static/lab/）的模型代理：密钥只在后端读取。"""
    cfg = content.deepseek_config()
    if not cfg["configured"]:
        raise ApiError(503, "未配置 DeepSeek API Key：设置环境变量 DEEPSEEK_API_KEY，"
                            "或在项目根目录新建 config.json（{\"apiKey\": \"sk-...\"}）", "no_key")
    try:
        reply = content.deepseek_chat(ctx["body"])
    except ValueError:
        raise ApiError(400, "消息为空", "empty_message")
    except Exception as exc:  # noqa: BLE001
        raise ApiError(502, "模型调用失败：" + str(exc)[:200], "upstream")
    return 200, {"reply": reply, "model": cfg["model"]}


@route("GET", "/api/meta")
def api_meta(ctx):
    return 200, {
        "app": "AI4En",
        "accounts": [
            {"role": "教师", "username": "t_wang", "password": "teach123", "note": "三年级 2 班 王雅静"},
            {"role": "学生", "username": "s_zhang", "password": "stu123", "note": "三年级 2 班 张小明"},
            {"role": "学生", "username": "s_li", "password": "stu123", "note": "三年级 2 班 李佳怡"},
            {"role": "家长", "username": "p_zhang", "password": "par123", "note": "张小明妈妈"},
            {"role": "教师", "username": "t_li", "password": "teach123", "note": "三年级 3 班（权限对照）"},
        ],
        "levels": list(LEVELS),
        "show_result_options": [
            {"value": "immediately", "label": "提交后立即显示对错"},
            {"value": "after_end", "label": "任务结束后显示"},
            {"value": "hidden", "label": "不显示对错，只显示已提交"},
        ],
        "sources": content.SOURCE_LABEL,
        "guide": guide.payload(),
    }


# ---------------------------------------------------------------- 课例


@route("GET", "/api/teacher/overview")
def api_teacher_overview(ctx):
    """教师待办只汇总本人的已发布任务，沿用结果页的统计口径。"""
    user = need_role(ctx, "teacher")
    lessons = db.query("SELECT id, title, status, updated_at FROM lessons WHERE teacher_id = ? ORDER BY updated_at DESC, id DESC",
                       (user["id"],))
    tasks = db.query("""SELECT t.*, l.title AS lesson_title FROM tasks t
                        JOIN lessons l ON l.id = t.lesson_id
                        WHERE l.teacher_id = ? AND t.status != 'draft'
                        ORDER BY t.id DESC""", (user["id"],))
    stats = {"lessons": len(lessons), "ongoing_tasks": 0, "pending_review": 0,
             "revision_requested": 0, "not_submitted": 0}
    summaries = []
    for task in tasks:
        result = task_results(task)
        revision_count = sum(s["status"] == "revision_requested" for s in result["submissions"])
        ongoing = task["status"] == "ongoing"
        stats["ongoing_tasks"] += int(ongoing)
        stats["pending_review"] += result["stats"]["pending_review"]
        stats["revision_requested"] += revision_count
        stats["not_submitted"] += len(result["stats"]["not_submitted"]) if ongoing else 0
        summaries.append(dict(result["task"], lesson_title=task["lesson_title"],
                              pending_review=result["stats"]["pending_review"],
                              revision_requested=revision_count,
                              not_submitted=result["stats"]["not_submitted"] if ongoing else []))
    return 200, {"stats": stats, "tasks": summaries, "recent_lessons": lessons[:4]}


@route("GET", "/api/lessons")
def api_lessons(ctx):
    user = need_role(ctx, "teacher")
    rows = db.query("SELECT * FROM lessons WHERE teacher_id = ? ORDER BY id DESC", (user["id"],))
    out = []
    for row in rows:
        plan = db.query_one("SELECT data FROM plans WHERE lesson_id = ?", (row["id"],))
        plan_data = db.loads(plan["data"]) if plan else {}
        out.append({
            "id": row["id"],
            "title": row["title"],
            "grade": row["grade"],
            "topic": row["topic"],
            "status": row["status"],
            "vocab": db.loads(row["vocab"], []),
            "sentences": db.loads(row["sentences"], []),
            "duration": row["duration"],
            "updated_at": row["updated_at"],
            "has_plan": bool(plan_data.get("objectives")),
            "objective_count": len(plan_data.get("objectives") or []),
            "task_count": db.query_one("SELECT COUNT(*) AS c FROM tasks WHERE lesson_id = ?", (row["id"],))["c"],
        })
    return 200, {"lessons": out}


@route("POST", "/api/lessons")
def api_create_lesson(ctx):
    user = need_role(ctx, "teacher")
    body = ctx["body"]
    title = str(body.get("title", "")).strip()
    topic = str(body.get("topic", "")).strip()
    grade = str(body.get("grade", "")).strip()
    vocab = [w.strip() for w in str(body.get("vocab", "")).replace("，", ",").split(",") if w.strip()]
    sentences = [s.strip() for s in str(body.get("sentences", "")).split("\n") if s.strip()]
    missing = []
    if not title:
        missing.append("课例标题")
    if not grade:
        missing.append("年级")
    if not topic:
        missing.append("主题")
    if len(vocab) < 2:
        missing.append("目标词汇（至少 2 个）")
    if not sentences:
        missing.append("目标句型（至少 1 行）")
    if missing:
        raise ApiError(400, "请补充：" + "、".join(missing), "missing", {"missing": missing})
    stamp = now()
    lesson_id = db.execute(
        """INSERT INTO lessons (teacher_id, title, grade, topic, vocab, sentences, duration, notes, status, source, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (user["id"], title, grade, topic, db.dumps(vocab), db.dumps(sentences),
         int(body.get("duration") or 40), str(body.get("notes", "")), "draft", "manual", stamp, stamp),
    )
    db.execute("INSERT INTO plans (lesson_id, data, source, updated_at) VALUES (?, ?, ?, ?)",
               (lesson_id, db.dumps({}), "manual", stamp))
    db.execute("INSERT INTO exercises (lesson_id, data, source, updated_at) VALUES (?, ?, ?, ?)",
               (lesson_id, db.dumps({"support": "frame", "items": []}), "manual", stamp))
    return 200, {"lesson": lesson_bundle(load_lesson(lesson_id, user["id"]))}


@route("GET", r"/api/lessons/(?P<lesson_id>\d+)")
def api_lesson(ctx):
    user = need_role(ctx, "teacher")
    lesson = load_lesson(parse_id(ctx["params"]["lesson_id"]), user["id"])
    return 200, {"lesson": lesson_bundle(lesson)}


@route("PATCH", r"/api/lessons/(?P<lesson_id>\d+)")
def api_update_lesson(ctx):
    user = need_role(ctx, "teacher")
    lesson = load_lesson(parse_id(ctx["params"]["lesson_id"]), user["id"])
    body = ctx["body"]
    fields, args = [], []
    for key in ("title", "grade", "topic", "notes"):
        if key in body:
            fields.append(key + " = ?")
            args.append(str(body[key]))
    if "duration" in body:
        fields.append("duration = ?")
        args.append(int(body["duration"]))
    if "vocab" in body:
        fields.append("vocab = ?")
        args.append(db.dumps(body["vocab"]))
    if "sentences" in body:
        fields.append("sentences = ?")
        args.append(db.dumps(body["sentences"]))
    if not fields:
        raise ApiError(400, "没有需要保存的内容", "empty")
    fields.append("updated_at = ?")
    args.append(now())
    args.append(lesson["id"])
    db.execute("UPDATE lessons SET " + ", ".join(fields) + " WHERE id = ?", tuple(args))
    return 200, {"lesson": lesson_bundle(load_lesson(lesson["id"], user["id"]))}


@route("PATCH", r"/api/lessons/(?P<lesson_id>\d+)/plan")
def api_save_plan(ctx):
    user = need_role(ctx, "teacher")
    lesson = load_lesson(parse_id(ctx["params"]["lesson_id"]), user["id"])
    data = ctx["body"].get("data")
    if not isinstance(data, dict) or not data:
        raise ApiError(400, "教案内容为空，未保存", "empty")
    stamp = now()
    db.execute("UPDATE plans SET data = ?, source = ?, updated_at = ? WHERE lesson_id = ?",
               (db.dumps(data), "manual", stamp, lesson["id"]))
    db.execute("UPDATE lessons SET status = 'draft', updated_at = ? WHERE id = ?", (stamp, lesson["id"]))
    return 200, {"lesson": lesson_bundle(load_lesson(lesson["id"], user["id"])),
                 "notice": "教案已保存为草稿，发布前请重新审核。"}


@route("POST", r"/api/lessons/(?P<lesson_id>\d+)/approve")
def api_approve(ctx):
    user = need_role(ctx, "teacher")
    lesson = load_lesson(parse_id(ctx["params"]["lesson_id"]), user["id"])
    plan = db.query_one("SELECT data FROM plans WHERE lesson_id = ?", (lesson["id"],))
    data = db.loads(plan["data"]) if plan else {}
    missing = []
    if not data.get("objectives"):
        missing.append("学习目标")
    if not data.get("flow"):
        missing.append("教学流程")
    if missing:
        raise ApiError(400, "教案缺少：" + "、".join(missing) + "，无法审核通过", "missing", {"missing": missing})
    db.execute("UPDATE lessons SET status = 'approved', updated_at = ? WHERE id = ?", (now(), lesson["id"]))
    return 200, {"lesson": lesson_bundle(load_lesson(lesson["id"], user["id"]))}


@route("POST", r"/api/lessons/(?P<lesson_id>\d+)/duplicate")
def api_duplicate_lesson(ctx):
    user = need_role(ctx, "teacher")
    lesson = load_lesson(parse_id(ctx["params"]["lesson_id"]), user["id"])
    stamp = now()
    new_id = db.execute(
        """INSERT INTO lessons (teacher_id, title, grade, topic, vocab, sentences, duration, notes, status, source, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (user["id"], lesson["title"] + "（副本）", lesson["grade"], lesson["topic"], lesson["vocab"],
         lesson["sentences"], lesson["duration"], lesson["notes"], "draft", lesson["source"], stamp, stamp),
    )
    plan = db.query_one("SELECT * FROM plans WHERE lesson_id = ?", (lesson["id"],))
    db.execute("INSERT INTO plans (lesson_id, data, source, updated_at) VALUES (?, ?, ?, ?)",
               (new_id, plan["data"] if plan else db.dumps({}), "manual", stamp))
    for row in db.query("SELECT * FROM materials WHERE lesson_id = ?", (lesson["id"],)):
        db.execute("INSERT INTO materials (lesson_id, kind, data, source, updated_at) VALUES (?, ?, ?, ?, ?)",
                   (new_id, row["kind"], row["data"], "manual", stamp))
    for row in db.query("SELECT * FROM activities WHERE lesson_id = ?", (lesson["id"],)):
        db.execute("INSERT INTO activities (lesson_id, kind, data, source, updated_at) VALUES (?, ?, ?, ?, ?)",
                   (new_id, row["kind"], row["data"], "manual", stamp))
    ex = db.query_one("SELECT * FROM exercises WHERE lesson_id = ?", (lesson["id"],))
    db.execute("INSERT INTO exercises (lesson_id, data, source, updated_at) VALUES (?, ?, ?, ?)",
               (new_id, ex["data"] if ex else db.dumps({"items": []}), "manual", stamp))
    return 200, {"lesson": lesson_bundle(load_lesson(new_id, user["id"])), "notice": "已复制为新课例，不含原学生作答。"}


PLAN_SECTIONS = {
    "objectives": ("objectives",),
    "key_points": ("key_points", "difficulties"),
    "flow": ("flow",),
    "board": ("board", "homework", "materials", "rationale"),
}
SECTION_LABEL = {"objectives": "学习目标", "key_points": "重点与难点", "flow": "教学流程", "board": "板书、作业与材料"}


def _merge_plan_section(lesson_id, new_plan, section):
    """只替换选中的部分，其余教师已编辑内容原样保留。"""
    if section not in PLAN_SECTIONS:
        raise ApiError(400, "不支持的部分：" + section, "bad_section")
    row = db.query_one("SELECT data FROM plans WHERE lesson_id = ?", (lesson_id,))
    old = db.loads(row["data"]) if row else {}
    if not old:
        return new_plan
    merged = dict(old)
    for key in PLAN_SECTIONS[section]:
        if key in new_plan:
            merged[key] = new_plan[key]
    merged["source"] = new_plan.get("source", merged.get("source", "sample"))
    return merged


@route("POST", r"/api/lessons/(?P<lesson_id>\d+)/generate")
def api_generate(ctx):
    user = need_role(ctx, "teacher")
    lesson = load_lesson(parse_id(ctx["params"]["lesson_id"]), user["id"])
    body = ctx["body"]
    target = str(body.get("target") or "plan")
    section = str(body.get("section") or "").strip()
    simulate = bool(body.get("simulate_failure"))
    lesson_dict = {
        "grade": lesson["grade"], "topic": lesson["topic"], "duration": lesson["duration"],
        "vocab": db.loads(lesson["vocab"], []), "sentences": db.loads(lesson["sentences"], []),
    }
    stamp = now()
    kind = {"plan": "plan", "slides": "slides", "cards": "cards", "exercises": "exercises"}.get(target)
    if not kind:
        raise ApiError(400, "不支持的生成类型", "bad_target")

    if simulate:
        db.execute("""INSERT INTO gen_logs (lesson_id, kind, provider, model, status, latency_ms, error, created_at)
                      VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                   (lesson["id"], kind, "model", content.model_config()["model"], "failed", 12,
                    "演示注入：连接超时（simulated failure）", stamp))
        raise ApiError(502, "生成失败：模型服务没有返回结果。输入与已保存草稿均已保留，可以重试或改用示例内容。",
                       "generation_failed", {"preserved": True, "retry": True})

    text, provider, error, latency = content.call_model(content.build_prompt("plan", lesson_dict) if kind == "plan" else
                                                        content.build_prompt("exercises", lesson_dict) if kind == "exercises" else
                                                        "生成课件/词卡草稿", timeout=35)
    data = None
    if text:
        parsed = content.extract_json(text)
        if isinstance(parsed, dict):
            if kind == "plan" and parsed.get("objectives"):
                data = parsed
            elif kind == "exercises" and parsed.get("items"):
                data = parsed

    source = "model" if data else "sample"
    if provider == "model" and not data and text is None and error:
        db.execute("""INSERT INTO gen_logs (lesson_id, kind, provider, model, status, latency_ms, error, created_at)
                      VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                   (lesson["id"], kind, "model", content.model_config()["model"], "failed", latency or 0,
                    error or "模型返回内容无法解析", stamp))
        raise ApiError(502, "生成失败：模型调用没有成功。输入与已保存草稿均已保留，可以重试。",
                       "generation_failed", {"preserved": True, "retry": True, "detail": error})

    if kind == "plan":
        data = data or content.build_plan(lesson_dict)
    elif kind == "exercises":
        data = data or content.build_exercises(lesson_dict)
    elif kind == "cards":
        data = content.build_cards(lesson_dict)
    elif kind == "slides":
        data = {"slides": content.build_slides(lesson_dict)}

    if kind == "plan":
        if section:
            merged = _merge_plan_section(lesson["id"], data, section)
            data = merged
        db.execute("UPDATE plans SET data = ?, source = ?, updated_at = ? WHERE lesson_id = ?",
                   (db.dumps(data), source, stamp, lesson["id"]))
        db.execute("UPDATE lessons SET status = 'draft', updated_at = ? WHERE id = ?", (stamp, lesson["id"]))
    elif kind == "exercises":
        db.execute("UPDATE exercises SET data = ?, source = ?, updated_at = ? WHERE lesson_id = ?",
                   (db.dumps(data), source, stamp, lesson["id"]))
        db.execute("UPDATE lessons SET status = 'draft', updated_at = ? WHERE id = ?", (stamp, lesson["id"]))
    elif kind == "cards":
        db.execute("UPDATE materials SET data = ?, source = ?, updated_at = ? WHERE lesson_id = ? AND kind = 'cards'",
                   (db.dumps(data), source, stamp, lesson["id"]))
    elif kind == "slides":
        db.execute("UPDATE materials SET data = ?, source = ?, updated_at = ? WHERE lesson_id = ? AND kind = 'slides'",
                   (db.dumps(data["slides"]), source, stamp, lesson["id"]))

    db.execute("""INSERT INTO gen_logs (lesson_id, kind, provider, model, status, latency_ms, error, created_at)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
               (lesson["id"], kind, provider, content.model_config()["model"], "success", latency, "", stamp))

    bundle = lesson_bundle(load_lesson(lesson["id"], user["id"]))
    base_notice = ("已生成候选内容，请核对后再保存或审核。" if source == "model"
                   else "未配置模型，本次使用示例内容；可直接编辑，但不能作为真实模型调用的验收证据。")
    if section:
        base_notice = "已重新生成“" + SECTION_LABEL[section] + "”，其他已编辑内容保留。" + base_notice
    return 200, {
        "lesson": bundle,
        "source": source,
        "source_label": content.SOURCE_LABEL.get(source, source),
        "provider": provider,
        "notice": base_notice,
        "model_configured": content.model_config()["configured"],
    }


@route("GET", r"/api/lessons/(?P<lesson_id>\d+)/gen-logs")
def api_gen_logs(ctx):
    user = need_role(ctx, "teacher")
    lesson = load_lesson(parse_id(ctx["params"]["lesson_id"]), user["id"])
    rows = db.query("SELECT * FROM gen_logs WHERE lesson_id = ? ORDER BY id DESC LIMIT 20", (lesson["id"],))
    return 200, {"logs": rows}


@route("PATCH", r"/api/lessons/(?P<lesson_id>\d+)/materials/(?P<kind>\w+)")
def api_save_material(ctx):
    user = need_role(ctx, "teacher")
    lesson = load_lesson(parse_id(ctx["params"]["lesson_id"]), user["id"])
    kind = ctx["params"]["kind"]
    if kind not in ("slides", "cards"):
        raise ApiError(400, "不支持的材料类型", "bad_kind")
    data = ctx["body"].get("data")
    if data is None:
        raise ApiError(400, "材料内容为空", "empty")
    stamp = now()
    row = db.query_one("SELECT 1 FROM materials WHERE lesson_id = ? AND kind = ?", (lesson["id"], kind))
    if row:
        db.execute("UPDATE materials SET data = ?, source = 'manual', updated_at = ? WHERE lesson_id = ? AND kind = ?",
                   (db.dumps(data), stamp, lesson["id"], kind))
    else:
        db.execute("INSERT INTO materials (lesson_id, kind, data, source, updated_at) VALUES (?, ?, ?, ?, ?)",
                   (lesson["id"], kind, db.dumps(data), "manual", stamp))
    return 200, {"lesson": lesson_bundle(load_lesson(lesson["id"], user["id"]))}


@route("PATCH", r"/api/lessons/(?P<lesson_id>\d+)/activities/(?P<aid>\d+)")
def api_save_activity(ctx):
    user = need_role(ctx, "teacher")
    lesson = load_lesson(parse_id(ctx["params"]["lesson_id"]), user["id"])
    aid = parse_id(ctx["params"]["aid"])
    row = db.query_one("SELECT * FROM activities WHERE id = ? AND lesson_id = ?", (aid, lesson["id"]))
    if not row:
        raise ApiError(404, "活动不存在", "not_found")
    data = ctx["body"].get("data")
    if not isinstance(data, dict):
        raise ApiError(400, "活动内容格式不正确", "bad_data")
    if row["kind"] == "match":
        pairs = [p for p in data.get("pairs") or [] if str(p.get("left", "")).strip() and str(p.get("right", "")).strip()]
        if len(pairs) < 2:
            raise ApiError(400, "配对至少需要 2 组词义", "missing")
        lefts = [str(p["left"]).strip().lower() for p in pairs]
        rights = [str(p["right"]).strip().lower() for p in pairs]
        if len(set(lefts)) != len(lefts) or len(set(rights)) != len(rights):
            raise ApiError(400, "配对里有重复的词或意思，请修改后再保存", "duplicate")
        data["pairs"] = pairs
    if row["kind"] == "order":
        tokens = [t for t in data.get("tokens") or [] if str(t).strip()]
        if len(tokens) < 3:
            raise ApiError(400, "排序至少需要 3 个词块", "missing")
        if len(set(tokens)) != len(tokens):
            raise ApiError(400, "词块有重复，请检查后再保存", "duplicate")
        data["tokens"] = tokens
        data["sentence"] = " ".join(tokens).replace(" .", ".").replace(" ?", "?")
    db.execute("UPDATE activities SET data = ?, source = 'manual', updated_at = ? WHERE id = ?",
               (db.dumps(data), now(), aid))
    return 200, {"lesson": lesson_bundle(load_lesson(lesson["id"], user["id"]))}


@route("PATCH", r"/api/lessons/(?P<lesson_id>\d+)/exercises")
def api_save_exercises(ctx):
    user = need_role(ctx, "teacher")
    lesson = load_lesson(parse_id(ctx["params"]["lesson_id"]), user["id"])
    data = ctx["body"].get("data")
    if not isinstance(data, dict) or not isinstance(data.get("items"), list):
        raise ApiError(400, "题目格式不正确", "bad_data")
    for idx, item in enumerate(data["items"], 1):
        item.setdefault("id", "q" + str(idx))
    stamp = now()
    db.execute("UPDATE exercises SET data = ?, source = 'manual', updated_at = ? WHERE lesson_id = ?",
               (db.dumps(data), stamp, lesson["id"]))
    db.execute("UPDATE lessons SET status = 'draft', updated_at = ? WHERE id = ?", (stamp, lesson["id"]))
    return 200, {"lesson": lesson_bundle(load_lesson(lesson["id"], user["id"])),
                 "missing": validate_items(data["items"])}


# ---------------------------------------------------------------- 任务


@route("POST", r"/api/lessons/(?P<lesson_id>\d+)/tasks")
def api_create_task(ctx):
    user = need_role(ctx, "teacher")
    lesson = load_lesson(parse_id(ctx["params"]["lesson_id"]), user["id"])
    body = ctx["body"]
    class_id = int(body.get("class_id") or user.get("class_id") or 0)
    cls = db.query_one("SELECT * FROM classes WHERE id = ?", (class_id,))
    if not cls:
        raise ApiError(400, "请选择班级", "missing")
    if class_id != user.get("class_id"):
        raise ApiError(403, "只能向本人任教班级发布任务", "forbidden")
    ex = db.query_one("SELECT data FROM exercises WHERE lesson_id = ?", (lesson["id"],))
    items = (db.loads(ex["data"]) if ex else {}).get("items") or []
    snapshot = {
        "title": str(body.get("title") or (lesson["title"] + " · 课堂短练习")),
        "instructions": str(body.get("instructions") or ""),
        "due_at": str(body.get("due_at") or ""),
        "allow_hints": 1 if body.get("allow_hints", True) else 0,
        "show_result": str(body.get("show_result") or "immediately"),
        "items": items,
        "support": (db.loads(ex["data"]) if ex else {}).get("support", "frame"),
        "lesson_title": lesson["title"],
    }
    stamp = now()
    task_id = db.execute(
        """INSERT INTO tasks (lesson_id, class_id, title, instructions, due_at, allow_hints, show_result, status, snapshot, student_count, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (lesson["id"], class_id, snapshot["title"], snapshot["instructions"], snapshot["due_at"],
         snapshot["allow_hints"], snapshot["show_result"], "draft", db.dumps(snapshot), 0, stamp),
    )
    return 200, {"task": _task_brief(load_task(task_id))}


@route("PATCH", r"/api/tasks/(?P<task_id>\d+)")
def api_update_task(ctx):
    task = teacher_task(ctx, parse_id(ctx["params"]["task_id"]))
    if task["status"] != "draft":
        raise ApiError(400, "任务已发布，修改题目请复制为新任务", "locked")
    body = ctx["body"]
    snapshot = db.loads(task["snapshot"])
    fields, args = [], []
    for key in ("title", "instructions", "due_at"):
        if key in body:
            fields.append(key + " = ?")
            args.append(str(body[key]))
            snapshot[key] = str(body[key])
    if "allow_hints" in body:
        fields.append("allow_hints = ?")
        args.append(1 if body["allow_hints"] else 0)
        snapshot["allow_hints"] = 1 if body["allow_hints"] else 0
    if "show_result" in body:
        fields.append("show_result = ?")
        args.append(str(body["show_result"]))
        snapshot["show_result"] = str(body["show_result"])
    if not fields:
        raise ApiError(400, "没有需要保存的内容", "empty")
    fields.append("snapshot = ?")
    args.append(db.dumps(snapshot))
    args.append(task["id"])
    db.execute("UPDATE tasks SET " + ", ".join(fields) + " WHERE id = ?", tuple(args))
    return 200, {"task": _task_brief(load_task(task["id"]))}


@route("POST", r"/api/tasks/(?P<task_id>\d+)/publish")
def api_publish_task(ctx):
    task = teacher_task(ctx, parse_id(ctx["params"]["task_id"]))
    lesson = load_lesson(task["lesson_id"], ctx["user"]["id"])
    if task["status"] != "draft":
        raise ApiError(400, "任务已发布，不能重复发布", "locked")
    if lesson["status"] != "approved":
        raise ApiError(400, "课例尚未审核通过，发布前请先审核教案", "not_approved")
    ex = db.query_one("SELECT data FROM exercises WHERE lesson_id = ?", (lesson["id"],))
    snapshot = db.loads(task["snapshot"])
    if snapshot.get("origin") == "review":
        # 错题组卷任务只包含教师勾选的题目，不能被整份练习覆盖
        items = snapshot.get("items") or []
    else:
        items = (db.loads(ex["data"]) if ex else {}).get("items") or []
    missing = validate_items(items)
    if missing:
        raise ApiError(400, "发布被阻止，缺少：" + "；".join(missing), "invalid", {"missing": missing})
    snapshot["items"] = items
    snapshot["support"] = (db.loads(ex["data"]) if ex else {}).get("support", "frame")
    snapshot["lesson_title"] = lesson["title"]
    count = db.query_one("SELECT COUNT(*) AS c FROM users WHERE role = 'student' AND class_id = ?",
                         (task["class_id"],))["c"]
    stamp = now()
    db.execute(
        """UPDATE tasks SET snapshot = ?, status = 'ongoing', student_count = ?, published_at = ?, title = ?,
                            instructions = ?, due_at = ?, allow_hints = ?, show_result = ? WHERE id = ?""",
        (db.dumps(snapshot), count, stamp, task["title"], task["instructions"], task["due_at"],
         task["allow_hints"], task["show_result"], task["id"]),
    )
    return 200, {"task": _task_brief(load_task(task["id"])), "notice": "已发布，题目与答案已冻结为快照。"}


@route("POST", r"/api/tasks/(?P<task_id>\d+)/end")
def api_end_task(ctx):
    task = teacher_task(ctx, parse_id(ctx["params"]["task_id"]))
    if task["status"] != "ongoing":
        raise ApiError(400, "只有进行中的任务可以结束", "bad_state")
    db.execute("UPDATE tasks SET status = 'ended' WHERE id = ?", (task["id"],))
    return 200, {"task": _task_brief(load_task(task["id"]))}


@route("POST", r"/api/tasks/(?P<task_id>\d+)/duplicate")
def api_duplicate_task(ctx):
    task = teacher_task(ctx, parse_id(ctx["params"]["task_id"]))
    lesson = load_lesson(task["lesson_id"], ctx["user"]["id"])
    snapshot = db.loads(task["snapshot"])
    if snapshot.get("origin") != "review":
        ex = db.query_one("SELECT data FROM exercises WHERE lesson_id = ?", (lesson["id"],))
        data = db.loads(ex["data"]) if ex else {"items": []}
        snapshot["items"] = data.get("items") or []
        snapshot["support"] = data.get("support", "frame")
    task_id = db.execute(
        """INSERT INTO tasks (lesson_id, class_id, title, instructions, due_at, allow_hints, show_result, status, snapshot, student_count, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (lesson["id"], task["class_id"], task["title"] + "（新任务）", task["instructions"], task["due_at"],
         task["allow_hints"], task["show_result"], "draft", db.dumps(snapshot), 0, now()),
    )
    return 200, {"task": _task_brief(load_task(task_id)), "notice": "已复制为草稿任务，可改题后重新发布。"}


@route("GET", r"/api/lessons/(?P<lesson_id>\d+)/tasks")
def api_lesson_tasks(ctx):
    user = need_role(ctx, "teacher")
    lesson = load_lesson(parse_id(ctx["params"]["lesson_id"]), user["id"])
    rows = db.query("SELECT * FROM tasks WHERE lesson_id = ? ORDER BY id DESC", (lesson["id"],))
    return 200, {"tasks": [_task_brief(t) for t in rows]}


@route("GET", r"/api/tasks/(?P<task_id>\d+)/preview")
def api_task_preview(ctx):
    task = teacher_task(ctx, parse_id(ctx["params"]["task_id"]))
    snapshot = db.loads(task["snapshot"])
    return 200, {
        "task": {
            "id": task["id"], "title": task["title"], "instructions": task["instructions"],
            "due_at": task["due_at"], "allow_hints": bool(task["allow_hints"]),
            "show_result": task["show_result"], "status": task["status"],
        },
        "items": student_items(snapshot.get("items", []), task),
        "preview": True,
    }


@route("GET", r"/api/tasks/(?P<task_id>\d+)/results")
def api_task_results(ctx):
    task = teacher_task(ctx, parse_id(ctx["params"]["task_id"]))
    return 200, task_results(task)


def task_results(task):
    snapshot = db.loads(task["snapshot"])
    items = snapshot.get("items", [])
    students = db.query("SELECT id, name, username FROM users WHERE role = 'student' AND class_id = ? ORDER BY id",
                        (task["class_id"],))
    subs = db.query("""SELECT s.*, u.name FROM submissions s JOIN users u ON u.id = s.student_id
                       WHERE s.task_id = ? ORDER BY s.submitted_at""", (task["id"],))
    submitted_ids = {s["student_id"] for s in subs}
    assigned = task["student_count"] or len(students)
    grading_map = {s["id"]: db.loads(s["grading"], {}) for s in subs}
    answers_map = {s["id"]: db.loads(s["answers"], {}) for s in subs}

    feedbacks = db.query("""SELECT f.* FROM feedback f JOIN submissions s ON s.id = f.submission_id
                            WHERE s.task_id = ?""", (task["id"],))
    fb_map = {}
    for f in feedbacks:
        fb_map.setdefault(f["submission_id"], {})[f["item_id"]] = f

    observations = db.query("""SELECT o.*, u.name AS student_name FROM observations o
                               JOIN users u ON u.id = o.student_id
                               WHERE o.task_id = ? ORDER BY o.id DESC""", (task["id"],))

    per_item = []
    for item in items:
        valid = 0
        wrong = 0
        pending = 0
        for s in subs:
            ans = answers_map.get(s["id"], {}).get(item["id"])
            if item["type"] == "short":
                if str(ans or "").strip():
                    valid += 1
                    fb = fb_map.get(s["id"], {}).get(item["id"])
                    if not fb or fb["status"] != "confirmed":
                        pending += 1
            else:
                if str(ans or "").strip():
                    valid += 1
                    if grading_map.get(s["id"], {}).get(item["id"]) is False:
                        wrong += 1
        per_item.append({
            "id": item["id"], "type": item["type"], "tag": item.get("tag", ""),
            "stem": item.get("stem", ""), "target": item.get("target", ""),
            "valid": valid, "wrong": wrong, "pending": pending,
            "wrong_rate": round(wrong / valid * 100, 1) if valid else None,
        })

    return {
        "task": _task_brief(task),
        "stats": {
            "assigned": assigned,
            "submitted": len(subs),
            "not_submitted": [s["name"] for s in students if s["id"] not in submitted_ids],
            "rate": round(len(subs) / assigned * 100, 1) if assigned else 0,
            "pending_review": sum(i["pending"] for i in per_item),
        },
        "items": per_item,
        "submissions": [
            {
                "id": s["id"], "student_name": s["name"], "status": s["status"],
                "student_id": s["student_id"],
                "submitted_at": s["submitted_at"],
                "objective_correct": sum(1 for v in grading_map.get(s["id"], {}).values() if v is True),
                "objective_total": sum(1 for v in grading_map.get(s["id"], {}).values() if v is not None),
                "pending": sum(1 for i in items if i["type"] == "short"
                               and str(answers_map.get(s["id"], {}).get(i["id"]) or "").strip()
                               and (fb_map.get(s["id"], {}).get(i["id"]) or {}).get("status") != "confirmed"),
            }
            for s in subs
        ],
        "observations": observations,
        "students": [{"id": s["id"], "name": s["name"]} for s in students],
    }


@route("GET", r"/api/tasks/(?P<task_id>\d+)/submissions")
def api_task_submissions(ctx):
    task = teacher_task(ctx, parse_id(ctx["params"]["task_id"]))
    return 200, task_results(task)


# ---------------------------------------------------------------- 反馈与订正


@route("GET", r"/api/submissions/(?P<sid>\d+)/review")
def api_review(ctx):
    row, role = load_submission(ctx, parse_id(ctx["params"]["sid"]))
    task = load_task(row["task_id"])
    snapshot = db.loads(task["snapshot"])
    items = snapshot.get("items", [])
    feedbacks = db.query("SELECT * FROM feedback WHERE submission_id = ? ORDER BY id", (row["id"],))
    history = db.query("SELECT * FROM revisions WHERE submission_id = ? ORDER BY id", (row["id"],))
    observations = db.query("""SELECT * FROM observations WHERE lesson_id = ? AND student_id = ?
                               AND (task_id = ? OR task_id IS NULL) ORDER BY id DESC""",
                            (task["lesson_id"], row["student_id"], task["id"]))
    data = {
        "submission": {
            "id": row["id"], "status": row["status"], "submitted_at": row["submitted_at"],
            "updated_at": row["updated_at"], "student_name": row["student_name"],
        },
        "task": {"id": task["id"], "title": task["title"], "instructions": task["instructions"],
                 "status": task["status"], "show_result": task["show_result"], "lesson_id": task["lesson_id"],
                 "allow_hints": bool(task["allow_hints"]), "due_at": task["due_at"]},
        "items": items,
        "answers": db.loads(row["answers"], {}),
        "grading": db.loads(row["grading"], {}),
        "history": [{"answers": db.loads(h["answers"], {}), "created_at": h["created_at"]} for h in history],
        "feedback": feedbacks,
        "observations": observations,
    }
    if role != "teacher":
        # 学生与家长只看已确认的反馈，且看不到参考答案与解析
        data["items"] = strip_answers(items)
        data["history"] = [{"answers": h["answers"], "created_at": h["created_at"]} for h in history] if role == "student" else []
        data["feedback"] = [f for f in feedbacks if f["status"] == "confirmed"]
        data.pop("grading", None)
        data.pop("observations", None)
        for f in data["feedback"]:
            f.pop("draft", None)
    return 200, data


@route("POST", r"/api/submissions/(?P<sid>\d+)/feedback/draft")
def api_feedback_draft(ctx):
    row, role = load_submission(ctx, parse_id(ctx["params"]["sid"]))
    if role != "teacher":
        raise ApiError(403, "只有教师可以生成反馈草稿", "forbidden")
    item_id = str(ctx["body"].get("item_id", ""))
    task = load_task(row["task_id"])
    snapshot = db.loads(task["snapshot"])
    items = {i["id"]: i for i in snapshot.get("items", [])}
    item = items.get(item_id)
    if not item:
        raise ApiError(404, "题目不存在", "not_found")
    answers = db.loads(row["answers"], {})
    answer = answers.get(item_id, "")
    lesson = db.query_one("SELECT * FROM lessons WHERE id = ?", (task["lesson_id"],))
    vocab = db.loads(lesson["vocab"], [])

    text, provider, error, latency = None, "rule", None, 0
    if ctx["body"].get("use_model"):
        text, provider, error, latency = content.call_model(
            content.build_prompt("feedback", {"vocab": vocab}, {"answer": answer, "stem": item.get("stem", "")}), timeout=30)
    if not text:
        text = content.draft_feedback(answer, item, vocab)
        provider = "rule"
    elif provider == "model":
        db.execute("""INSERT INTO gen_logs (lesson_id, kind, provider, model, status, latency_ms, error, created_at)
                      VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                   (task["lesson_id"], "feedback", "model", content.model_config()["model"], "success", latency, "", now()))

    old = db.query_one("SELECT * FROM feedback WHERE submission_id = ? AND item_id = ?", (row["id"], item_id))
    if old:
        db.execute("UPDATE feedback SET draft = ?, source = ? WHERE id = ?", (text, provider, old["id"]))
    else:
        db.execute("INSERT INTO feedback (submission_id, item_id, draft, final, level, status, source) VALUES (?, ?, ?, ?, ?, ?, ?)",
                   (row["id"], item_id, text, "", "", "draft", provider))
    return 200, {"draft": text, "source": provider, "source_label": content.SOURCE_LABEL.get(provider, provider),
                 "model_configured": content.model_config()["configured"], "error": error}


@route("POST", r"/api/submissions/(?P<sid>\d+)/feedback")
def api_feedback_confirm(ctx):
    row, role = load_submission(ctx, parse_id(ctx["params"]["sid"]))
    if role != "teacher":
        raise ApiError(403, "只有教师可以确认反馈", "forbidden")
    body = ctx["body"]
    item_id = str(body.get("item_id", ""))
    final = str(body.get("final") or body.get("text") or "").strip()
    level = str(body.get("level") or "")
    if not item_id:
        raise ApiError(400, "缺少题目编号", "missing")
    if not final:
        raise ApiError(400, "反馈内容为空，未发布给学生", "missing")
    if level and level not in LEVELS:
        raise ApiError(400, "评价描述只能是已完成 / 需局部修改 / 需教师帮助", "bad_level")
    stamp = now()
    old = db.query_one("SELECT * FROM feedback WHERE submission_id = ? AND item_id = ?", (row["id"], item_id))
    if old:
        db.execute("UPDATE feedback SET final = ?, level = ?, status = 'confirmed', source = ?, confirmed_at = ? WHERE id = ?",
                   (final, level, old["source"] or "manual", stamp, old["id"]))
    else:
        db.execute("""INSERT INTO feedback (submission_id, item_id, draft, final, level, status, source, confirmed_at)
                      VALUES (?, ?, '', ?, ?, 'confirmed', 'manual', ?)""",
                   (row["id"], item_id, final, level, stamp))
    return 200, {"ok": True, "notice": "反馈已确认，学生端可见。"}


@route("POST", r"/api/submissions/(?P<sid>\d+)/request-revision")
def api_request_revision(ctx):
    row, role = load_submission(ctx, parse_id(ctx["params"]["sid"]))
    if role != "teacher":
        raise ApiError(403, "只有教师可以发起订正", "forbidden")
    if row["status"] == "revision_requested":
        return 200, {"ok": True, "notice": "已要求订正，等待学生提交。"}
    db.execute("UPDATE submissions SET status = 'revision_requested', updated_at = ? WHERE id = ?", (now(), row["id"]))
    return 200, {"ok": True, "notice": "已要求学生订正；学生提交后保留首次与订正两个版本。"}


# ---------------------------------------------------------------- 学生端


@route("GET", "/api/my/tasks")
def api_my_tasks(ctx):
    user = need_role(ctx, "student")
    rows = db.query("""SELECT t.*, l.title AS lesson_title FROM tasks t JOIN lessons l ON l.id = t.lesson_id
                       WHERE t.class_id = ? AND t.status != 'draft' ORDER BY t.id DESC""", (user["class_id"],))
    out = []
    for task in rows:
        sub = submission_of(task["id"], user["id"])
        out.append({
            "id": task["id"], "title": task["title"], "lesson_title": task["lesson_title"],
            "instructions": task["instructions"], "due_at": task["due_at"], "status": task["status"],
            "allow_hints": bool(task["allow_hints"]), "item_count": len(db.loads(task["snapshot"]).get("items", [])),
            "overdue": is_overdue(task),
            "submission": {"id": sub["id"], "status": sub["status"], "submitted_at": sub["submitted_at"],
                           "updated_at": sub["updated_at"]} if sub else None,
        })
    return 200, {"tasks": out}


@route("GET", r"/api/tasks/(?P<task_id>\d+)/student")
def api_student_task(ctx):
    user = need_role(ctx, "student")
    task = student_task(load_task(parse_id(ctx["params"]["task_id"])), user)
    snapshot = db.loads(task["snapshot"])
    sub = submission_of(task["id"], user["id"])
    payload = {
        "task": {
            "id": task["id"], "title": task["title"], "instructions": task["instructions"],
            "due_at": task["due_at"], "status": task["status"], "allow_hints": bool(task["allow_hints"]),
            "show_result": task["show_result"], "overdue": is_overdue(task),
        },
        "items": student_items(snapshot.get("items", []), task),
        "submission": None,
    }
    if sub:
        payload["submission"] = submission_view(task, sub, for_student=True)
    return 200, payload


def submission_view(task, sub, for_student=False):
    answers = db.loads(sub["answers"], {})
    grading = db.loads(sub["grading"], {})
    feedbacks = db.query("SELECT * FROM feedback WHERE submission_id = ? ORDER BY id", (sub["id"],))
    confirmed = {f["item_id"]: {"final": f["final"], "level": f["level"], "confirmed_at": f["confirmed_at"]}
                 for f in feedbacks if f["status"] == "confirmed"}
    history = db.query("SELECT * FROM revisions WHERE submission_id = ? ORDER BY id", (sub["id"],))
    show_result = task["show_result"]
    reveal = show_result == "immediately" or (show_result == "after_end" and task["status"] == "ended")
    view = {
        "id": sub["id"], "status": sub["status"], "submitted_at": sub["submitted_at"],
        "updated_at": sub["updated_at"],
        "answers": answers,
        "feedback": confirmed,
        "reveal_result": reveal,
        "history": [{"answers": db.loads(h["answers"], {}), "created_at": h["created_at"]} for h in history],
        "can_revise": sub["status"] == "revision_requested",
    }
    if reveal and show_result != "hidden":
        view["grading"] = {k: v for k, v in grading.items() if v is not None}
    return view


@route("POST", r"/api/tasks/(?P<task_id>\d+)/submit")
def api_submit(ctx):
    user = need_role(ctx, "student")
    task = student_task(load_task(parse_id(ctx["params"]["task_id"])), user)
    if task["status"] != "ongoing":
        raise ApiError(400, "任务不在提交时间内", "closed")
    if is_overdue(task):
        raise ApiError(400, "已超过提交时间（" + str(task["due_at"]) + "）。如需补交，请让老师在结果页说明。",
                       "overdue")
    if submission_of(task["id"], user["id"]):
        raise ApiError(409, "你已提交过本任务，不能重复提交；如需修改请看老师的订正要求", "duplicate")
    snapshot = db.loads(task["snapshot"])
    items = snapshot.get("items", [])
    answers = ctx["body"].get("answers")
    if not isinstance(answers, dict):
        raise ApiError(400, "作答内容格式不正确", "bad_data")
    missing = [i["id"] for i in items if not str(answers.get(i["id"], "")).strip()]
    if missing:
        raise ApiError(400, "还有题目没有作答：" + "、".join(missing) + "。内容已保留，补完后再提交。",
                       "missing", {"missing": missing})
    grading = {}
    for item in items:
        ok, _ = content.grade_item(item, answers.get(item["id"], ""))
        grading[item["id"]] = ok
    stamp = now()
    sid = db.execute("""INSERT INTO submissions (task_id, student_id, status, answers, grading, submitted_at, updated_at)
                        VALUES (?, ?, 'submitted', ?, ?, ?, ?)""",
                     (task["id"], user["id"], db.dumps(answers), db.dumps(grading), stamp, stamp))
    return 200, {"submission_id": sid, "notice": "已提交。客观题结果与老师已确认的反馈会显示在任务页。"}


@route("POST", r"/api/submissions/(?P<sid>\d+)/revise")
def api_revise(ctx):
    user = need_role(ctx, "student")
    row, role = load_submission(ctx, parse_id(ctx["params"]["sid"]))
    if role != "student":
        raise ApiError(403, "只能提交本人的订正", "forbidden")
    if row["status"] != "revision_requested":
        raise ApiError(400, "当前不需要订正", "bad_state")
    task = load_task(row["task_id"])
    if task["status"] == "ended":
        pass
    snapshot = db.loads(task["snapshot"])
    items = snapshot.get("items", [])
    answers = ctx["body"].get("answers")
    if not isinstance(answers, dict):
        raise ApiError(400, "作答内容格式不正确", "bad_data")
    missing = [i["id"] for i in items if not str(answers.get(i["id"], "")).strip()]
    if missing:
        raise ApiError(400, "还有题目没有作答：" + "、".join(missing), "missing", {"missing": missing})
    grading = {}
    for item in items:
        ok, _ = content.grade_item(item, answers.get(item["id"], ""))
        grading[item["id"]] = ok
    stamp = now()
    db.execute("INSERT INTO revisions (submission_id, answers, created_at) VALUES (?, ?, ?)",
               (row["id"], row["answers"], stamp))
    db.execute("UPDATE submissions SET answers = ?, grading = ?, status = 'resubmitted', updated_at = ? WHERE id = ?",
               (db.dumps(answers), db.dumps(grading), stamp, row["id"]))
    return 200, {"ok": True, "notice": "订正已提交，首次作答仍然保留。"}


# ---------------------------------------------------------------- 学生端：学习概览

@route("GET", "/api/student/overview")
def api_student_overview(ctx):
    """学生本人的学习档案：任务进度、错题、订正与时间线。

    只返回本人数据，且不包含正确答案与解析（与学生任务接口一致）。
    """
    user = need_role(ctx, "student")
    tasks = db.query(
        """SELECT t.*, l.title AS lesson_title, l.vocab AS lesson_vocab, l.sentences AS lesson_sentences
           FROM tasks t JOIN lessons l ON l.id = t.lesson_id
           WHERE t.class_id = ? AND t.status != 'draft' ORDER BY t.id DESC""",
        (user["class_id"],))
    subs = {}
    for row in db.query("SELECT * FROM submissions WHERE student_id = ?", (user["id"],)):
        subs[row["task_id"]] = row

    wrong, feedbacks, revisions_out, timeline = [], [], [], []
    tags = {}
    weeks = {}
    correct_total = graded_total = 0
    pending_revision = revised = 0
    next_task = None

    for task in tasks:
        sub = subs.get(task["id"])
        snapshot = db.loads(task["snapshot"])
        items = snapshot.get("items", [])
        if not sub:
            if task["status"] == "ongoing" and next_task is None:
                next_task = {"id": task["id"], "title": task["title"], "due_at": task["due_at"],
                             "item_count": len(items), "reason": "还没提交"}
            continue
        if sub["status"] == "revision_requested":
            pending_revision += 1
            if next_task is None:
                next_task = {"id": task["id"], "title": task["title"], "due_at": task["due_at"],
                             "item_count": len(items), "reason": "老师要求订正"}
        if sub["status"] == "resubmitted":
            revised += 1

        answers = db.loads(sub["answers"], {})
        grading = db.loads(sub["grading"], {})
        try:
            day = datetime.strptime(str(sub["submitted_at"])[:10], "%Y-%m-%d").date()
        except ValueError:
            day = None
        if day:
            monday = day - timedelta(days=day.weekday())
            bucket = weeks.setdefault(monday, {"start": monday, "submitted": 0, "total": 0, "correct": 0})
            bucket["submitted"] += 1
        fbs = {f["item_id"]: f for f in db.query(
            "SELECT * FROM feedback WHERE submission_id = ?", (sub["id"],))}
        rev_rows = db.query("SELECT * FROM revisions WHERE submission_id = ? ORDER BY id", (sub["id"],))
        first_answers = db.loads(rev_rows[0]["answers"], {}) if rev_rows else {}

        for item in items:
            ans = answers.get(item["id"], "")
            ok = grading.get(item["id"])
            tag = item.get("tag") or "未分类"
            if item["type"] != "short":
                if ok is None:
                    continue
                graded_total += 1
                correct_total += 1 if ok else 0
                if day:
                    weeks[monday]["total"] += 1
                    weeks[monday]["correct"] += 1 if ok else 0
                bucket = tags.setdefault(tag, {"tag": tag, "correct": 0, "total": 0})
                bucket["total"] += 1
                bucket["correct"] += 1 if ok else 0
                if ok is False:
                    wrong.append({
                        "task_id": task["id"], "task_title": task["title"], "item_id": item["id"],
                        "type": item["type"], "stem": item.get("stem", ""), "tag": tag,
                        "target": item.get("target", ""), "my_answer": ans,
                        "feedback": "", "level": "",
                    })
            else:
                fb = fbs.get(item["id"])
                if not fb or fb["status"] != "confirmed":
                    continue
                feedbacks.append({
                    "task_id": task["id"], "task_title": task["title"], "item_id": item["id"],
                    "stem": item.get("stem", ""), "final": fb["final"], "level": fb["level"],
                    "at": fb["confirmed_at"] or sub["updated_at"],
                })
                if fb["level"] in ("需局部修改", "需教师帮助"):
                    original = first_answers.get(item["id"], ans) if first_answers else ans
                    wrong.append({
                        "task_id": task["id"], "task_title": task["title"], "item_id": item["id"],
                        "type": "short", "stem": item.get("stem", ""), "tag": tag,
                        "target": item.get("target", ""), "my_answer": original,
                        "revised": ans if str(ans or "") != str(original or "") else "",
                        "feedback": fb["final"], "level": fb["level"],
                    })

        timeline.append({"at": sub["submitted_at"], "kind": "submit",
                         "title": "提交作业", "detail": task["title"]})
        if sub["status"] == "resubmitted":
            timeline.append({"at": sub["updated_at"], "kind": "revise",
                             "title": "提交订正", "detail": task["title"]})

        if rev_rows:
            first = db.loads(rev_rows[0]["answers"], {})
            changes = []
            for item in items:
                before = str(first.get(item["id"], "") or "")
                after = str(answers.get(item["id"], "") or "")
                if before != after:
                    changes.append({
                        "item_id": item["id"], "stem": item.get("stem", ""),
                        "before": before, "after": after,
                    })
            revisions_out.append({
                "task_id": task["id"], "task_title": task["title"], "submission_id": sub["id"],
                "at": rev_rows[-1]["created_at"], "changes": changes,
            })

    for fb in feedbacks:
        timeline.append({"at": fb["at"], "kind": "feedback",
                         "title": "老师确认了反馈", "detail": fb["task_title"]})
    timeline.sort(key=lambda e: e["at"] or "", reverse=True)

    for task in tasks:
        if task["status"] == "ended" and task["id"] not in subs and next_task is None:
            next_task = {"id": task["id"], "title": task["title"], "due_at": task["due_at"],
                         "item_count": len(db.loads(task["snapshot"]).get("items", [])), "reason": "已结束"}
            break

    assigned = len(tasks)
    submitted = len(subs)

    # 词卡：按本班课例的目标词去重，供学生端「单词卡」使用；不含答案与解析。
    vocab_words, seen_words = [], set()
    for task in tasks:
        for word in db.loads(task.get("lesson_vocab"), []) or []:
            key = str(word).strip().lower()
            if key and key not in seen_words:
                seen_words.add(key)
                vocab_words.append(str(word).strip())
    vocab_cards = content.build_cards({"vocab": vocab_words})["word_cards"] if vocab_words else []

    # 句型：同一课例的目标句型，供单词卡页做跟读提示。
    sentence_list, seen_sentences = [], set()
    for task in tasks:
        for sentence in db.loads(task.get("lesson_sentences"), []) or []:
            key = str(sentence).strip()
            if key and key not in seen_sentences:
                seen_sentences.add(key)
                sentence_list.append(key)

    # 最近 4 周：每周提交数与客观题正确率，供「学习报告」画趋势。
    week_rows = []
    for start in sorted(weeks)[-4:]:
        item = weeks[start]
        week_rows.append({
            "start": start.isoformat(),
            "label": start.strftime("%m/%d"),
            "submitted": item["submitted"],
            "correct": item["correct"],
            "total": item["total"],
            "accuracy": round(item["correct"] / item["total"] * 100, 0) if item["total"] else None,
        })

    cls = db.query_one("SELECT name FROM classes WHERE id = ?", (user.get("class_id"),)) if user.get("class_id") else None

    return 200, {
        "student": {"name": user["name"], "class_name": cls["name"] if cls else ""},
        "stats": {
            "assigned": assigned,
            "submitted": submitted,
            "not_submitted": assigned - submitted,
            "pending_revision": pending_revision,
            "revised": revised,
            "wrong": len(wrong),
            "objective_correct": correct_total,
            "objective_total": graded_total,
            "accuracy": round(correct_total / graded_total * 100, 0) if graded_total else None,
        },
        "tags": sorted(tags.values(), key=lambda t: (-t["total"], t["tag"])),
        "vocab": vocab_cards,
        "sentences": sentence_list,
        "weeks": week_rows,
        "wrong": wrong,
        "feedback": sorted(feedbacks, key=lambda f: f["at"] or "", reverse=True)[:8],
        "revisions": sorted(revisions_out, key=lambda r: r["at"] or "", reverse=True),
        "timeline": timeline[:12],
        "next_task": next_task,
        "tasks": [{
            "id": t["id"], "title": t["title"], "lesson_title": t["lesson_title"],
            "due_at": t["due_at"], "status": t["status"],
            "item_count": len(db.loads(t["snapshot"]).get("items", [])),
            "submission": {"id": subs[t["id"]]["id"], "status": subs[t["id"]]["status"],
                           "submitted_at": subs[t["id"]]["submitted_at"]} if t["id"] in subs else None,
        } for t in tasks],
    }


# ---------------------------------------------------------------- 家长端


@route("GET", "/api/parent/overview")
def api_parent_overview(ctx):
    user = need_role(ctx, "parent")
    child = db.query_one("SELECT * FROM users WHERE id = ?", (user.get("child_id"),))
    if not child:
        raise ApiError(404, "还没有绑定孩子", "no_child")
    tasks = []
    for task in db.query("""SELECT t.*, l.title AS lesson_title FROM tasks t JOIN lessons l ON l.id = t.lesson_id
                            WHERE t.class_id = ? AND t.status != 'draft' ORDER BY t.id DESC""", (child["class_id"],)):
        sub = submission_of(task["id"], child["id"])
        feedback = []
        if sub:
            rows = db.query("SELECT * FROM feedback WHERE submission_id = ? AND status = 'confirmed' ORDER BY id", (sub["id"],))
            snapshot = db.loads(task["snapshot"])
            stems = {i["id"]: i["stem"] for i in snapshot.get("items", [])}
            feedback = [{"item_id": r["item_id"], "stem": stems.get(r["item_id"], ""), "final": r["final"], "level": r["level"]} for r in rows]
        tasks.append({
            "id": task["id"], "title": task["title"], "lesson_title": task["lesson_title"],
            "instructions": task["instructions"], "due_at": task["due_at"], "status": task["status"],
            "submission": {"status": sub["status"], "submitted_at": sub["submitted_at"]} if sub else None,
            "feedback": feedback,
            "suggestion": parent_suggestion(sub, feedback),
        })
    return 200, {"child": {"name": child["name"], "grade": "", "class_name": ""}, "tasks": tasks}


def parent_suggestion(sub, feedback):
    if not sub:
        return "孩子还没有提交。可以先请孩子说说今天学了哪几个动物单词，再一起打开任务页完成。"
    if sub["status"] == "revision_requested":
        return "老师已要求订正。请让孩子先自己读一遍老师的反馈，再动手改，不要直接告诉他答案。"
    if feedback:
        return "让孩子先自己介绍两张动物卡，再根据老师的提示修改一句话；不需要额外购买设备或讲新课。"
    return "孩子已提交，等待老师确认反馈。可以请孩子把今天的问答说给你听一遍。"


# ---------------------------------------------------------------- 教学日志与复习练习


@route("POST", r"/api/lessons/(?P<lesson_id>\d+)/logs")
def api_save_log(ctx):
    user = need_role(ctx, "teacher")
    lesson = load_lesson(parse_id(ctx["params"]["lesson_id"]), user["id"])
    body = ctx["body"]
    completed = str(body.get("completed") or "").strip()
    issues = str(body.get("issues") or "").strip()
    next_adjust = str(body.get("next_adjust") or "").strip()
    if not (completed or issues or next_adjust):
        raise ApiError(400, "日志为空，未保存", "empty")
    task_id = body.get("task_id")
    stamp = now()
    db.execute("""INSERT INTO teaching_logs (lesson_id, task_id, completed, issues, next_adjust, source, updated_at)
                  VALUES (?, ?, ?, ?, ?, 'manual', ?)""",
               (lesson["id"], int(task_id) if task_id else None, completed, issues, next_adjust, stamp))
    return 200, {"lesson": lesson_bundle(load_lesson(lesson["id"], user["id"])), "notice": "教学日志已保存。"}


@route("POST", r"/api/lessons/(?P<lesson_id>\d+)/logs/draft")
def api_log_draft(ctx):
    user = need_role(ctx, "teacher")
    lesson = load_lesson(parse_id(ctx["params"]["lesson_id"]), user["id"])
    task_id = ctx["body"].get("task_id")
    if not task_id:
        raise ApiError(400, "请选择任务", "missing")
    task = load_task(int(task_id))
    if task["lesson_id"] != lesson["id"]:
        raise ApiError(403, "任务不属于该课例", "forbidden")
    result = task_results(task)
    stats = result["stats"]
    wrong = [i for i in result["items"] if i["wrong"] > 0]
    wrong.sort(key=lambda x: -x["wrong"])
    completed = f"五个环节完成；任务布置 {stats['assigned']} 人，已提交 {stats['submitted']} 人（{stats['rate']}%），待复核 {stats['pending_review']} 条。"
    if wrong:
        parts = []
        for w in wrong:
            pos = next((i for i, it in enumerate(result["items"]) if it["id"] == w["id"]), 0) + 1
            parts.append(f"第 {pos} 题「{w['stem'][:18]}…」错 {w['wrong']} 人")
        issues = "主要错题：" + "；".join(parts) + "。"
    else:
        issues = "本次没有客观题错误，开放题主要看句子是否完整。"
    if stats["not_submitted"]:
        issues += " 未提交：" + "、".join(stats["not_submitted"]) + "。"
    target = wrong[0]["target"] if wrong else ""
    next_adjust = ("下节课用 3 分钟做" + (" " + target + " " if target else "目标句") +
                   "的听辨与跟读；把第 7 题的错句做成一页改错练习，再补一次同目标的小练。")
    return 200, {"completed": completed, "issues": issues, "next_adjust": next_adjust,
                 "source": "rule", "source_label": content.SOURCE_LABEL["rule"]}


@route("POST", r"/api/tasks/(?P<task_id>\d+)/review-set")
def api_review_set(ctx):
    task = teacher_task(ctx, parse_id(ctx["params"]["task_id"]))
    lesson = load_lesson(task["lesson_id"], ctx["user"]["id"])
    snapshot = db.loads(task["snapshot"])
    items = snapshot.get("items", [])
    picks = set(str(x) for x in (ctx["body"].get("item_ids") or []))
    chosen = [i for i in items if i["id"] in picks]
    if not chosen:
        raise ApiError(400, "请先勾选至少一道错题", "missing")
    new_snapshot = dict(snapshot)
    new_snapshot["items"] = chosen
    new_snapshot["origin"] = "review"
    new_snapshot["title"] = task["title"] + "（复习练习）"
    new_snapshot["instructions"] = "这是根据本课错题组成的复习练习，先看一遍错句再作答。"
    stamp = now()
    task_id = db.execute(
        """INSERT INTO tasks (lesson_id, class_id, title, instructions, due_at, allow_hints, show_result, status, snapshot, student_count, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (lesson["id"], task["class_id"], new_snapshot["title"], new_snapshot["instructions"], "", 1,
         "immediately", "draft", db.dumps(new_snapshot), 0, stamp),
    )
    return 200, {"task": _task_brief(load_task(task_id)),
                 "notice": "已用 " + str(len(chosen)) + " 道错题生成复习练习草稿，可在“任务发布”里核对后发布。"}


# ---------------------------------------------------------------- 课堂观察与听写

OBS_RESULTS = ("独立完成", "需要提示", "需要帮助")
OBS_KINDS = {"independent": "同目标独立运用检查", "oral": "口头问答观察"}


@route("GET", r"/api/lessons/(?P<lesson_id>\d+)/observations")
def api_lesson_observations(ctx):
    user = need_role(ctx, "teacher")
    lesson = load_lesson(parse_id(ctx["params"]["lesson_id"]), user["id"])
    rows = db.query("""SELECT o.*, u.name AS student_name FROM observations o
                       JOIN users u ON u.id = o.student_id
                       WHERE o.lesson_id = ? ORDER BY o.id DESC""", (lesson["id"],))
    students = db.query("SELECT id, name FROM users WHERE role = 'student' AND class_id = ? ORDER BY id",
                        (user["class_id"],))
    return 200, {"observations": rows, "students": students}


@route("POST", r"/api/lessons/(?P<lesson_id>\d+)/observations")
def api_add_lesson_observation(ctx):
    user = need_role(ctx, "teacher")
    lesson = load_lesson(parse_id(ctx["params"]["lesson_id"]), user["id"])
    body = ctx["body"]
    student = db.query_one("SELECT * FROM users WHERE id = ? AND role = 'student'",
                           (parse_id(body.get("student_id")),))
    if not student or student["class_id"] != user["class_id"]:
        raise ApiError(400, "请选择本班学生", "bad_student")
    kind = str(body.get("kind") or "independent")
    result = str(body.get("result") or "").strip()
    if kind not in OBS_KINDS:
        raise ApiError(400, "观察类型不正确", "bad_kind")
    if result not in OBS_RESULTS:
        raise ApiError(400, "结果只能选：独立完成 / 需要提示 / 需要帮助", "bad_result")
    db.execute("""INSERT INTO observations (lesson_id, task_id, student_id, kind, result, note, created_at)
                  VALUES (?, NULL, ?, ?, ?, ?, ?)""",
               (lesson["id"], student["id"], kind, result, str(body.get("note") or "").strip()[:300], now()))
    return 200, {"ok": True, "notice": "课堂观察已保存。"}


@route("POST", r"/api/tasks/(?P<task_id>\d+)/observations")
def api_add_observation(ctx):
    task = teacher_task(ctx, parse_id(ctx["params"]["task_id"]))
    body = ctx["body"]
    student_id = int(body.get("student_id") or 0)
    student = db.query_one("SELECT * FROM users WHERE id = ? AND role = 'student'", (student_id,))
    if not student or student["class_id"] != task["class_id"]:
        raise ApiError(400, "请选择本班学生", "bad_student")
    kind = str(body.get("kind") or "independent")
    if kind not in OBS_KINDS:
        raise ApiError(400, "观察类型不正确", "bad_kind")
    result = str(body.get("result") or "").strip()
    if result not in OBS_RESULTS:
        raise ApiError(400, "结果只能选：独立完成 / 需要提示 / 需要帮助", "bad_result")
    note = str(body.get("note") or "").strip()[:300]
    db.execute("""INSERT INTO observations (lesson_id, task_id, student_id, kind, result, note, created_at)
                  VALUES (?, ?, ?, ?, ?, ?, ?)""",
               (task["lesson_id"], task["id"], student_id, kind, result, note, now()))
    return 200, {"ok": True, "notice": "已记录 " + student["name"] + " 的" + OBS_KINDS[kind] + "结果。"}


@route("GET", r"/api/tasks/(?P<task_id>\d+)/observations")
def api_list_observations(ctx):
    task = teacher_task(ctx, parse_id(ctx["params"]["task_id"]))
    rows = db.query("""SELECT o.*, u.name AS student_name FROM observations o
                       JOIN users u ON u.id = o.student_id
                       WHERE o.task_id = ? ORDER BY o.id DESC""", (task["id"],))
    return 200, {"observations": rows}


@route("GET", r"/api/lessons/(?P<lesson_id>\d+)/dictations")
def api_list_dictations(ctx):
    user = need_role(ctx, "teacher")
    lesson = load_lesson(parse_id(ctx["params"]["lesson_id"]), user["id"])
    rows = db.query("SELECT * FROM dictations WHERE lesson_id = ? ORDER BY id DESC LIMIT 20", (lesson["id"],))
    out = []
    for r in rows:
        out.append({"id": r["id"], "words": db.loads(r["words"], []), "wrong": db.loads(r["wrong"], []),
                    "note": r["note"], "created_at": r["created_at"]})
    return 200, {"dictations": out}


@route("POST", r"/api/lessons/(?P<lesson_id>\d+)/dictations")
def api_save_dictation(ctx):
    user = need_role(ctx, "teacher")
    lesson = load_lesson(parse_id(ctx["params"]["lesson_id"]), user["id"])
    body = ctx["body"]
    words = [str(w).strip() for w in (body.get("words") or []) if str(w).strip()]
    wrong = [str(w).strip() for w in (body.get("wrong") or []) if str(w).strip()]
    if not words:
        raise ApiError(400, "听写词表为空，未保存", "missing")
    bad = [w for w in wrong if w not in words]
    if bad:
        raise ApiError(400, "错词不在本次听写词表中：" + "、".join(bad), "bad_word")
    note = str(body.get("note") or "").strip()[:200]
    db.execute("INSERT INTO dictations (lesson_id, words, wrong, note, created_at) VALUES (?, ?, ?, ?, ?)",
               (lesson["id"], db.dumps(words), db.dumps(wrong), note, now()))
    return 200, {"ok": True,
                 "notice": "听写已登记：" + str(len(words)) + " 个词，错 " + str(len(wrong)) + " 个。",
                 "wrong": wrong}

