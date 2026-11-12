# -*- coding: utf-8 -*-
"""AI4En 自动化验收脚本。

用途：在独立临时数据库上启动一份服务，按验收清单跑完整流程，输出“预期 / 实际”结果。
运行：python tests/smoke_test.py
环境：仅需 Python 3.9+ 标准库；不会修改 data/ai4en.db 里的演示数据。
"""
from __future__ import annotations

import http.cookiejar
from copy import copy
from datetime import datetime, timedelta
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
import uuid
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
APP = os.path.join(ROOT, "app")
PORT = int(os.environ.get("AI4EN_TEST_PORT", "8850"))
EXTERNAL = os.environ.get("AI4EN_BASE", "").rstrip("/")
BASE = EXTERNAL or ("http://127.0.0.1:" + str(PORT))
# 截止时间必须晚于运行时刻，否则提交会被正确拦截，导致用例假失败
DUE_AT = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d %H:%M")
RESULTS = []


def log(msg):
    print(msg, flush=True)


class Client:
    def __init__(self):
        self.jar = http.cookiejar.CookieJar()
        self.opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.jar))

    def request(self, method, path, body=None, raw=False):
        data = None
        headers = {}
        if body is not None:
            data = json.dumps(body, ensure_ascii=False).encode("utf-8")
            headers["Content-Type"] = "application/json"
        req = urllib.request.Request(BASE + path, data=data, method=method, headers=headers)
        try:
            with self.opener.open(req, timeout=30) as resp:
                payload = resp.read()
                if raw:
                    return resp.status, payload, dict(resp.headers)
                return resp.status, json.loads(payload.decode("utf-8")), dict(resp.headers)
        except urllib.error.HTTPError as exc:
            payload = exc.read()
            if raw:
                return exc.code, payload, dict(exc.headers)
            try:
                return exc.code, json.loads(payload.decode("utf-8")), dict(exc.headers)
            except json.JSONDecodeError:
                return exc.code, {"error": payload.decode("utf-8", "ignore")}, dict(exc.headers)

    def get(self, path, **kw):
        return self.request("GET", path, **kw)

    def post(self, path, body=None, **kw):
        return self.request("POST", path, body if body is not None else {}, **kw)

    def patch(self, path, body):
        return self.request("PATCH", path, body)


def record(name, expect, passed, actual):
    RESULTS.append({"name": name, "expect": expect, "passed": bool(passed), "actual": actual})
    log(("  PASS  " if passed else "  FAIL  ") + name + " ｜ 预期：" + expect + " ｜ 实际：" + actual)


def login(username, password):
    c = Client()
    status, data, _ = c.post("/api/login", {"username": username, "password": password})
    return c, status, data


def find_task(tasks, title_prefix):
    for t in tasks:
        if t["title"].startswith(title_prefix):
            return t
    return None


def main():
    tmpdir = None
    proc = None
    if EXTERNAL:
        log("测试目标：" + BASE + "（外部已启动的临时数据库服务）")
    else:
        tmpdir = tempfile.mkdtemp(prefix="ai4en-test-")
        db_path = os.path.join(tmpdir, "test.db")
        env = dict(os.environ)
        env["AI4EN_DB_PATH"] = db_path
        env["PYTHONUTF8"] = "1"
        log("启动测试服务：" + BASE + "（临时数据库 " + db_path + "）")
        proc = subprocess.Popen([sys.executable, os.path.join(APP, "server.py"), "--port", str(PORT)],
                                cwd=APP, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT)
    try:
        ready = False
        for _ in range(80):
            try:
                status, data, _ = Client().get("/api/health")
                if status == 200:
                    ready = True
                    break
            except Exception:  # noqa: BLE001
                pass
            time.sleep(0.25)
        if not ready:
            log("服务未启动，测试终止")
            return 1

        # 1 健康检查
        status, data, _ = Client().get("/api/health")
        record("服务健康检查", "HTTP 200 且返回应用名", status == 200 and data.get("app") == "AI4En", "HTTP " + str(status))

        status, raw, _ = Client().get("/static/workshop/index.html", raw=True)
        record("工作坊静态入口", "HTTP 200 且包含工作坊页面", status == 200 and "AI英语教学工作坊" in raw.decode("utf-8", "ignore"), "HTTP " + str(status))
        status, _, _ = Client().get("/static/%2e%2e/index.html", raw=True)
        record("静态目录边界", "编码路径不能跳出 /static/，HTTP 404", status == 404, "HTTP " + str(status))
        status, _, _ = Client().post("/static/workshop/index.html", raw=True)
        record("静态入口仅供读取", "POST 返回 HTTP 405", status == 405, "HTTP " + str(status))

        # 2 未登录访问受限接口
        status, data, _ = Client().get("/api/lessons")
        record("未登录访问课例列表", "HTTP 401", status == 401, "HTTP " + str(status) + " " + data.get("error", ""))

        # 3 教师登录
        teacher, status, data = login("t_wang", "teach123")
        record("教师登录", "HTTP 200 且角色为 teacher", status == 200 and data.get("user", {}).get("role") == "teacher",
               "HTTP " + str(status))

        # 4 课例详情
        status, data, _ = teacher.get("/api/lessons/1")
        lesson = data.get("lesson", {})
        plan = lesson.get("plan", {}).get("data", {})
        items = lesson.get("exercises", {}).get("data", {}).get("items", [])
        ok = status == 200 and len(plan.get("objectives", [])) == 3 and len(items) == 7 and len(lesson.get("activities", [])) == 2
        record("课例包完整性（目标 3 条 / 7 题 / 2 个活动）", "3 条目标、7 道题、2 个活动",
               ok, str(len(plan.get("objectives", []))) + " 目标 / " + str(len(items)) + " 题 / " + str(len(lesson.get("activities", []))) + " 活动")

        # 5 生成教案（示例内容）
        status, data, _ = teacher.post("/api/lessons/1/generate", {"target": "plan"})
        record("生成教案草稿（未配置模型）", "HTTP 200 且标记为示例内容", status == 200 and data.get("source") == "sample",
               "HTTP " + str(status) + " " + str(data.get("source_label")))

        # 6 生成失败注入
        status, data, _ = teacher.post("/api/lessons/1/generate", {"target": "plan", "simulate_failure": True})
        record("生成失败处理", "HTTP 502 且提示保留草稿", status == 502 and data.get("preserved") is True,
               "HTTP " + str(status) + " " + str(data.get("code")))
        status, data, _ = teacher.get("/api/lessons/1")
        after = data["lesson"]["plan"]["data"]
        record("失败后草稿仍在", "失败后教案目标仍为 3 条", len(after.get("objectives", [])) == 3,
               str(len(after.get("objectives", []))) + " 条目标")
        status, data, _ = teacher.get("/api/lessons/1/gen-logs")
        failed = [l for l in data.get("logs", []) if l["status"] == "failed"]
        record("失败写入生成日志", "至少 1 条 failed 记录", len(failed) >= 1, str(len(failed)) + " 条失败记录")

        # 7 保存教案 → 回到草稿；审核通过
        plan["difficulties"] = plan.get("difficulties", "") + "（教师补充：注意 panda 的重音）"
        status, data, _ = teacher.patch("/api/lessons/1/plan", {"data": plan})
        record("保存教案", "HTTP 200 且状态回到草稿", status == 200 and data["lesson"]["status"] == "draft",
               "HTTP " + str(status) + " 状态 " + str(data["lesson"]["status"]))
        status, data, _ = teacher.post("/api/lessons/1/approve")
        record("审核通过", "HTTP 200 且状态为已审核", status == 200 and data["lesson"]["status"] == "approved",
               "HTTP " + str(status))

        # 8 学生视角看不到答案
        student, status, _ = login("s_zhang", "stu123")
        status, data, _ = student.get("/api/tasks/1/student")
        leaked = any("answer" in i or "analysis" in i or "accept" in i for i in data.get("items", []))
        record("学生任务接口不返回答案", "返回题目中不含 answer/analysis/accept", not leaked,
               "泄露" if leaked else "未泄露")
        short = next(item for item in data.get("items", []) if item["id"] == "q7")
        record("学生只获得已选句架支架", "句架有值，关键词字段不存在", bool(short.get("frame")) and "keywords" not in short,
               "句架：" + str(bool(short.get("frame"))) + " / 关键词：" + str("keywords" in short))

        # 9 新建任务并发布
        status, data, _ = teacher.post("/api/lessons/1/tasks", {
            "class_id": 1, "title": "验收任务 · Animals 短练习", "instructions": "按题目要求作答。",
            "due_at": DUE_AT, "allow_hints": True, "show_result": "immediately"})
        task_id = data.get("task", {}).get("id")
        record("创建任务草稿", "HTTP 200 且状态为草稿", status == 200 and data["task"]["status"] == "draft",
               "HTTP " + str(status) + " 任务 " + str(task_id))
        status, data, _ = teacher.post("/api/tasks/" + str(task_id) + "/publish")
        record("发布任务", "HTTP 200 且状态为进行中", status == 200 and data["task"]["status"] == "ongoing",
               "HTTP " + str(status))

        # 10 学生缺题提交
        status, data, _ = student.post("/api/tasks/" + str(task_id) + "/submit",
                                       {"answers": {"q1": "B", "q2": "B"}})
        record("缺题提交被拒绝", "HTTP 400 且列出缺失项", status == 400 and len(data.get("missing", [])) == 5,
               "HTTP " + str(status) + " 缺失 " + str(len(data.get("missing", []))) + " 项")

        # 11 完整提交 + 重复提交
        answers = {"q1": "B", "q2": "B", "q3": "A", "q4": "C", "q5": "dog", "q6": "a", "q7": "It's a frog. It is green."}
        status, data, _ = student.post("/api/tasks/" + str(task_id) + "/submit", {"answers": answers})
        sid = data.get("submission_id")
        record("学生完整提交", "HTTP 200 并返回作答编号", status == 200 and bool(sid), "HTTP " + str(status))
        status, data, _ = student.post("/api/tasks/" + str(task_id) + "/submit", {"answers": answers})
        record("重复提交被阻止", "HTTP 409", status == 409, "HTTP " + str(status))

        # 12 教师批改：生成草稿 → 确认 → 学生可见
        status, data, _ = teacher.post("/api/submissions/" + str(sid) + "/feedback/draft", {"item_id": "q7"})
        draft = data.get("draft", "")
        record("开放题反馈草稿", "HTTP 200 且草稿含三段式", status == 200 and "已完成" in draft and "下一步" in draft,
               "HTTP " + str(status) + " " + draft.split("\n")[0][:24])
        status, data, _ = teacher.post("/api/submissions/" + str(sid) + "/feedback",
                                       {"item_id": "q7", "final": "两句话都写出来了。请检查 frog 的拼写，并补上句末标点。", "level": "需局部修改"})
        record("确认反馈", "HTTP 200", status == 200, "HTTP " + str(status))
        status, data, _ = student.get("/api/tasks/" + str(task_id) + "/student")
        fb = (data.get("submission") or {}).get("feedback", {})
        record("学生看到已确认反馈", "学生视图包含 q7 反馈", "q7" in fb, "反馈条数 " + str(len(fb)))

        # 13 未确认反馈不可见（王浩 q7 草稿未确认）
        wang, _, _ = login("s_wang", "stu123")
        status, data, _ = teacher.get("/api/tasks/1/results")
        wang_sub = [s for s in data.get("submissions", []) if s["student_name"] == "王浩"]
        status, data, _ = wang.get("/api/tasks/1/student")
        fb2 = (data.get("submission") or {}).get("feedback", {})
        record("未确认反馈对学生不可见", "王浩看不到 q7 反馈", len(fb2) == 0, "可见反馈 " + str(len(fb2)) + " 条")

        # 14 要求订正 + 学生订正 + 两个版本
        status, data, _ = teacher.post("/api/submissions/" + str(sid) + "/request-revision")
        record("教师要求订正", "HTTP 200", status == 200, "HTTP " + str(status))
        revised = dict(answers)
        revised["q7"] = "It's a frog. It is green."
        status, data, _ = student.post("/api/submissions/" + str(sid) + "/revise", {"answers": revised})
        record("学生提交订正", "HTTP 200", status == 200, "HTTP " + str(status))
        status, data, _ = teacher.get("/api/submissions/" + str(sid) + "/review")
        record("保留首次与订正两个版本", "history 至少 1 条且状态为已订正",
               len(data.get("history", [])) >= 1 and data["submission"]["status"] == "resubmitted",
               "历史 " + str(len(data.get("history", []))) + " 条 / " + data["submission"]["status"])

        # 15 权限：跨班学生、其他教师、家长越界
        other, status, _ = login("s_zhou", "stu123")
        status, data, _ = other.get("/api/tasks/1/student")
        record("跨班学生访问任务", "HTTP 403", status == 403, "HTTP " + str(status))
        t2, _, _ = login("t_li", "teach123")
        status, data, _ = t2.get("/api/lessons/1")
        record("其他教师访问他人课例", "HTTP 403", status == 403, "HTTP " + str(status))
        parent, _, _ = login("p_zhang", "par123")
        status, data, _ = parent.get("/api/submissions/2/review")
        record("家长访问他人孩子记录", "HTTP 403", status == 403, "HTTP " + str(status))
        status, data, _ = parent.get("/api/parent/overview")
        has_answer = json.dumps(data, ensure_ascii=False).find("answer") >= 0
        record("家长视图不含答案字段", "返回内容不含 answer", not has_answer, "含答案" if has_answer else "未含答案")

        # 16 学生端学习档案
        status, data, _ = student.get("/api/student/overview")
        stats_own = data.get("stats", {})
        record("学生端学习档案", "HTTP 200 且只统计本人",
               status == 200 and stats_own.get("assigned", 0) >= 1 and stats_own.get("submitted", 0) >= 1,
               "HTTP " + str(status) + " / 提交 " + str(stats_own.get("submitted")))
        leaked_any = any(("answer" in w) or ("analysis" in w) for w in data.get("wrong", []))
        record("错题本不含标准答案", "错题只含题干与本人作答", not leaked_any, "泄露" if leaked_any else "未泄露")
        status, data, _ = teacher.get("/api/student/overview")
        record("教师不能读学生档案", "HTTP 403", status == 403, "HTTP " + str(status))
        status, data, _ = parent.get("/api/student/overview")
        record("家长不能读学生档案", "HTTP 403", status == 403, "HTTP " + str(status))

        # 17 统计正确
        status, data, _ = teacher.get("/api/tasks/1/results")
        stats = data.get("stats", {})
        record("统计口径", "布置 6 人、已提交 4 人、待复核 2 条",
               stats.get("assigned") == 6 and stats.get("submitted") == 4 and stats.get("pending_review") == 2,
               str(stats.get("assigned")) + " 人 / " + str(stats.get("submitted")) + " 提交 / " + str(stats.get("pending_review")) + " 待复核")

        # 17 已发布快照不被后续修改影响
        status, data, _ = teacher.get("/api/lessons/1")
        ex = data["lesson"]["exercises"]["data"]
        ex["items"][0]["answer"] = ""
        teacher.patch("/api/lessons/1/exercises", {"data": ex})
        status, data, _ = teacher.get("/api/tasks/" + str(task_id) + "/preview")
        record("已发布任务冻结", "改题后任务仍有 7 题", len(data.get("items", [])) == 7, str(len(data.get("items", []))) + " 题")
        teacher.post("/api/lessons/1/approve")
        status, data, _ = teacher.post("/api/lessons/1/tasks", {"class_id": 1, "title": "缺答案任务", "instructions": ""})
        bad_task = data["task"]["id"]
        status, data, _ = teacher.post("/api/tasks/" + str(bad_task) + "/publish")
        record("答案缺失时阻止发布", "HTTP 400 且列出缺失项", status == 400 and data.get("missing"),
               "HTTP " + str(status) + " 缺失 " + str(len(data.get("missing", []))) + " 项")
        ex["items"][0]["answer"] = "B"
        teacher.patch("/api/lessons/1/exercises", {"data": ex})
        teacher.post("/api/lessons/1/approve")

        # 18 导出 PPTX
        status, raw, headers = teacher.get("/api/lessons/1/export/pptx", raw=True)
        is_zip = raw[:2] == b"PK"
        path = os.path.join(tmpdir or tempfile.gettempdir(), "export.pptx")
        with open(path, "wb") as fh:
            fh.write(raw)
        names = []
        if is_zip:
            with zipfile.ZipFile(path) as z:
                names = z.namelist()
        need = ["[Content_Types].xml", "ppt/presentation.xml", "ppt/slides/slide1.xml",
                "ppt/slides/slide6.xml", "ppt/slideMasters/slideMaster1.xml", "ppt/theme/theme1.xml"]
        record("导出 PPTX", "HTTP 200 且包含完整 OOXML 部件",
               status == 200 and is_zip and all(n in names for n in need),
               "HTTP " + str(status) + " / " + str(len(names)) + " 个部件")
        try:
            from pptx import Presentation  # 可选：仅用于结构复核
            prs = Presentation(path)
            record("PPTX 可被解析", "6 页且首屏文本可读", len(prs.slides) == 6,
                   str(len(prs.slides)) + " 页")
        except ImportError:
            log("  SKIP  未安装 python-pptx，跳过结构解析复核")

        # 19 打印视图权限
        anon = Client()
        status, raw, _ = anon.get("/print/task/1/paper", raw=True)
        record("打印视图需要登录", "HTTP 401", status == 401, "HTTP " + str(status))
        status, raw, _ = teacher.get("/print/task/1/answers", raw=True)
        html = raw.decode("utf-8", "ignore")
        record("答案页可打印（仅教师）", "HTTP 200 且含“独立答案页”", status == 200 and "独立答案页" in html, "HTTP " + str(status))
        status, raw, _ = teacher.get("/print/lesson/1", raw=True)
        record("教案打印视图", "HTTP 200 且含教学流程", status == 200 and "教学流程" in raw.decode("utf-8", "ignore"),
               "HTTP " + str(status))

        # 20 教学日志
        status, data, _ = teacher.post("/api/lessons/1/logs/draft", {"task_id": 1})
        record("据统计生成反思草稿", "HTTP 200 且三个字段齐全", status == 200 and data.get("completed") and data.get("next_adjust"),
               "HTTP " + str(status))
        status, data, _ = teacher.post("/api/lessons/1/logs", {"completed": data["completed"], "issues": data["issues"],
                                                               "next_adjust": data["next_adjust"]})
        record("保存教学日志", "HTTP 200", status == 200, "HTTP " + str(status))

        # 21 错题复习练习
        status, data, _ = teacher.post("/api/tasks/1/review-set", {"item_ids": ["q2", "q7"]})
        review_task = data.get("task", {}).get("id")
        _, preview, _ = teacher.get(f"/api/tasks/{review_task}/preview")
        selected = [item["id"] for item in preview.get("items", [])]
        record("错题组成复习练习", "HTTP 200 且草稿仅含 q2、q7", status == 200 and selected == ["q2", "q7"], str(selected))
        status, _, _ = teacher.post(f"/api/tasks/{review_task}/publish")
        _, published, _ = student.get(f"/api/tasks/{review_task}/student")
        visible = [item["id"] for item in published.get("items", [])]
        record("复习练习发布保留所选题", "HTTP 200 且学生只看到 q2、q7", status == 200 and visible == ["q2", "q7"], f"HTTP {status} / {visible}")

        # Given a review task containing a short-answer question, disable its aids before publishing.
        _, data, _ = teacher.post("/api/tasks/1/review-set", {"item_ids": ["q7"]})
        no_aid_id = data["task"]["id"]
        teacher.patch(f"/api/tasks/{no_aid_id}", {"allow_hints": False})
        teacher.post(f"/api/tasks/{no_aid_id}/publish")
        status, data, _ = student.get(f"/api/tasks/{no_aid_id}/student")
        aid_fields = {"hint", "frame", "keywords"}
        visible_aids = aid_fields.intersection(data.get("items", [{}])[0])
        record("关闭提示后学生响应不含支架或提示", "HTTP 200 且无 hint/frame/keywords", status == 200 and not visible_aids,
               f"HTTP {status} / {sorted(visible_aids)}")

        # 22 权限：学生访问教师接口
        status, data, _ = student.get("/api/tasks/1/results")
        record("学生访问教师统计接口", "HTTP 403", status == 403, "HTTP " + str(status))

        # Given a second client holding a copy of the active cookie, replay it after logout.
        replay = Client()
        for cookie in teacher.jar:
            replay.jar.set_cookie(copy(cookie))
        teacher.post("/api/logout")
        status, _, _ = replay.get("/api/lessons")
        record("退出登录撤销服务器会话", "重放旧会话返回 HTTP 401", status == 401, "HTTP " + str(status))

    finally:
        if proc is not None:
            proc.terminate()
            try:
                proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                proc.kill()
        if tmpdir:
            shutil.rmtree(tmpdir, ignore_errors=True)

    passed = sum(1 for r in RESULTS if r["passed"])
    total = len(RESULTS)
    log("")
    log("验收结果：" + str(passed) + " / " + str(total) + " 通过")
    for r in RESULTS:
        if not r["passed"]:
            log("  未通过：" + r["name"] + "（预期 " + r["expect"] + "，实际 " + r["actual"] + "）")
    out = os.path.join(ROOT, ".tmp", "smoke_result.json")
    try:
        os.makedirs(os.path.dirname(out), exist_ok=True)
        with open(out, "w", encoding="utf-8") as fh:
            json.dump(RESULTS, fh, ensure_ascii=False, indent=2)
    except OSError:
        pass
    return 0 if passed == total else 1


if __name__ == "__main__":
    sys.exit(main())
