# -*- coding: utf-8 -*-
"""AI4En 课例内容、示例材料与评分逻辑。

本模块的职责：
- 保存演示课例 Animals 的示例内容（明确标记为示例内容）；
- 提供“示例生成器”：在未配置模型时产出可直接编辑的候选内容；
- 提供模型调用封装（密钥只在后端读取，不进入浏览器）；
- 提供客观题判分与开放题反馈草稿（规则生成，标注来源）。

内容来源标记：model = 真实模型调用；sample = 预置示例内容；
rule = 代码规则生成；manual = 教师手工编辑。
"""
from __future__ import annotations

import json
import os
import re
import time
import urllib.error
import urllib.request

SOURCE_LABEL = {
    "model": "真实模型输出",
    "sample": "示例内容",
    "rule": "规则生成",
    "manual": "教师手工编辑",
}

# ---------------------------------------------------------------- 演示课例


def demo_lesson():
    return {
        "title": "Animals: What's this?",
        "grade": "小学三年级",
        "topic": "Animals",
        "vocab": ["cat", "dog", "panda", "frog"],
        "sentences": ["What's this?", "It's a cat."],
        "duration": 40,
        "notes": "教材进度：Unit 4 Animals 第 1 课时。学生已学颜色词 red / black / white / green。教室有多媒体，可投屏。",
        "status": "approved",
        "source": "sample",
    }


def build_plan(lesson):
    """按主题选择模板：Animals 使用本课例的完整示例，其他主题使用通用模板。"""
    if (lesson.get("topic") or "").strip().lower() == "animals":
        return _plan_animals(lesson)
    return _plan_generic(lesson)


def _plan_animals(lesson):
    vocab = lesson.get("vocab") or ["cat", "dog", "panda", "frog"]
    words = "、".join(vocab)
    return {
        "objectives": [
            f"能听懂、认读并说出 {words} {len(vocab)} 个动物单词。",
            "能用 “What's this?” 与 “It's a …” 一问一答说出动物名称。",
            "能在同伴问答中用 2 句话介绍一种动物（名称 + 颜色）。",
        ],
        "key_points": "What's this? 与 It's a … 的问答配对；四个目标词与冠词 a 的搭配。",
        "difficulties": "It's 中 /ts/ 的连读与 a 的弱读；panda 重音在第一音节；学生容易漏说 It's 里的 's。",
        "flow": [
            {
                "stage": "导入",
                "minutes": 5,
                "teacher": "出示 4 张动物剪影，用 What's this? 提问，不急着给答案。",
                "student": "看图猜动物，说出已经会的单词。",
                "check": "教师把学生说出的词记在板书右侧，了解已有词汇。",
            },
            {
                "stage": "词句呈现",
                "minutes": 10,
                "teacher": "逐张呈现图片与词卡，示范 What's this? — It's a cat. 学生跟读两遍。",
                "student": "跟读单词与句子，指图回答。",
                "check": "抽 4 名学生逐图问答，纠正 panda 的重音与 It's 的读音。",
            },
            {
                "stage": "控制操练",
                "minutes": 10,
                "teacher": "组织词义配对（4 组），再做句子排序 It's / a / cat / .，请学生上台操作。",
                "student": "配对、排序，互相检查后重试一次。",
                "check": "教师看错误点，组织全班的第二次练习。",
            },
            {
                "stage": "语言运用",
                "minutes": 10,
                "teacher": "发放口头问答任务卡，示范一次抽卡问答，巡视各组。",
                "student": "同伴轮流抽卡问答，并用 2 句话介绍抽到的动物。",
                "check": "教师巡视记录目标句型的使用情况，用一句话点评。",
            },
            {
                "stage": "总结与任务",
                "minutes": 5,
                "teacher": "回顾 3 个目标，说明 7 题短练习与家庭活动要求。",
                "student": "复述 1 个句子，记下作业要求。",
                "check": "学生复述句子，教师确认全班听清作业。",
            },
        ],
        "board": "左侧：cat / dog / panda / frog 词卡；中间：What's this? — It's a ___. ；右侧：学生生成的新句子。",
        "homework": "完成 7 题短练习（4 选择 + 2 填空 + 1 动物介绍）；把一张动物卡带回家，用 What's this? 问家人一次并记下 1 个回答。",
        "materials": "6 页 PPTX 课件、4 张动物词卡、1 张口头问答任务卡、7 题短练习（学生卷 + 独立答案页）。",
        "rationale": "五个环节按“听—说—练—用—结”推进，操练环节用配对与排序两种互动覆盖词与句，最后把句子放回真实问答。",
        "source": "sample",
    }


def _plan_generic(lesson):
    vocab = lesson.get("vocab") or ["word 1", "word 2"]
    sentences = lesson.get("sentences") or ["What's this?", "It's a ..."]
    words = "、".join(vocab)
    return {
        "objectives": [
            f"能听懂、认读并说出 {words} 等 {len(vocab)} 个目标词。",
            f"能用 “{sentences[0]}” 与 “{sentences[1]}” 完成一问一答。",
            "能在同伴对话中用 2 句话介绍目标内容。",
        ],
        "key_points": f"目标句 “{sentences[0]} — {sentences[1]}” 的问答配对；目标词与句型的搭配。",
        "difficulties": "目标句的连读与弱读；学生容易漏说句中的缩写形式；个别单词重音需要提醒。",
        "flow": [
            {
                "stage": "导入",
                "minutes": 5,
                "teacher": f"出示与主题相关的 3–4 张图卡（{words}），用 “{sentences[0]}” 提问，不急着给答案。",
                "student": "看图猜内容，说出已经会的词。",
                "check": "教师把学生说出的词记在板书右侧，了解已有基础。",
            },
            {
                "stage": "词句呈现",
                "minutes": 10,
                "teacher": f"逐张呈现图片与词卡，示范 “{sentences[0]} — {sentences[1]}”，学生跟读两遍。",
                "student": "跟读目标词与句子，指图回答。",
                "check": "抽 4 名学生逐图问答，纠正重音与缩写读音。",
            },
            {
                "stage": "控制操练",
                "minutes": 10,
                "teacher": "组织词义配对（4 组），再做句子排序，请学生上台操作。",
                "student": "配对、排序，互相检查后重试一次。",
                "check": "教师看错误点，组织全班的第二次练习。",
            },
            {
                "stage": "语言运用",
                "minutes": 10,
                "teacher": "发放口头问答任务卡，示范一次抽卡问答，巡视各组。",
                "student": "同伴轮流抽卡问答，并用 2 句话介绍抽到的内容。",
                "check": "教师巡视记录目标句使用情况，用一句话点评。",
            },
            {
                "stage": "总结与任务",
                "minutes": 5,
                "teacher": "回顾 3 个目标，说明短练习与家庭活动要求。",
                "student": "复述 1 个句子，记下作业要求。",
                "check": "学生复述句子，教师确认全班听清作业。",
            },
        ],
        "board": f"左侧：{words} 词卡；中间：{sentences[0]} — {sentences[1]}；右侧：学生生成的新句子。",
        "homework": "完成 7 题短练习（4 选择 + 2 填空 + 1 开放表达）；用一张词卡向家人提问一次并记下 1 个回答。",
        "materials": "6 页 PPTX 课件、目标词卡、1 张口头问答任务卡、7 题短练习（学生卷 + 独立答案页）。",
        "rationale": "五个环节按“听—说—练—用—结”推进，操练用配对与排序覆盖词与句，最后把句子放回真实问答。",
        "source": "sample",
    }


GLOSS = {
    "cat": "猫", "dog": "狗", "panda": "熊猫", "frog": "青蛙",
    "father": "爸爸", "mother": "妈妈", "brother": "哥哥", "sister": "姐姐",
    "apple": "苹果", "banana": "香蕉", "red": "红色", "blue": "蓝色",
}


def build_exercises(lesson):
    if (lesson.get("topic") or "").strip().lower() == "animals":
        return _exercises_animals(lesson)
    return _exercises_generic(lesson)


def _exercises_generic(lesson):
    vocab = lesson.get("vocab") or ["word"]
    sentences = lesson.get("sentences") or ["What's this?", "It's a ..."]
    items = []
    for i, word in enumerate(vocab[:4]):
        gloss = GLOSS.get(word, "目标词")
        distract = [w for w in vocab if w != word][:3]
        options = [word] + distract
        options = options + ["—"] * (4 - len(options))
        answer = "A"
        items.append({
            "id": f"q{i+1}",
            "type": "choice",
            "stem": f"Which word means “{gloss}”?",
            "options": options,
            "answer": answer,
            "target": word,
            "tag": "词汇",
            "hint": f"{word} 的首字母是 {word[:1].upper()}。",
            "analysis": f"{word} 意为“{gloss}”。",
        })
    noun = vocab[-1]
    gloss = GLOSS.get(noun, "目标词")
    items.append({
        "id": "q5", "type": "fill",
        "stem": sentences[1].replace(noun, "___") + f" （{gloss}）",
        "answer": noun, "accept": [noun], "target": noun, "tag": "词汇",
        "hint": f"{noun[:1]}-… 共 {len(noun)} 个字母。",
        "analysis": f"完整句子：{sentences[1]}",
        "rule": "不区分大小写，忽略首尾空格与句末标点。",
    })
    items.append({
        "id": "q6", "type": "fill",
        "stem": sentences[0].replace(" ", " ___ ", 1),
        "answer": sentences[0].split(" ")[0], "accept": [sentences[0].split(" ")[0]],
        "target": sentences[0], "tag": "句型",
        "hint": "句首疑问词。",
        "analysis": f"完整句子：{sentences[0]}",
        "rule": "不区分大小写，忽略首尾空格与句末标点。",
    })
    items.append({
        "id": "q7", "type": "short",
        "stem": f"用 2 句话完成一次问答：第 1 句用 “{sentences[0]}” 提问，第 2 句用 “{sentences[1]}” 回答。",
        "answer": f"{sentences[0]} {sentences[1]}", "accept": [],
        "target": f"{sentences[0]} / {sentences[1]}", "tag": "句型",
        "hint": "先问再答，注意句末标点。",
        "analysis": f"示例：{sentences[0]} {sentences[1]}",
        "criteria": ["内容是否回应任务：一问一答都写出来", "表达是否基本清楚：句子完整、拼写可辨认"],
        "frame": f"{sentences[0]} ______.",
        "keywords": "、".join(vocab),
        "rule": "开放题不自动判分，由教师确认反馈。",
    })
    return {"support": "frame", "items": items}


def _exercises_animals(lesson):
    return {
        "support": "frame",
        "items": [
            {
                "id": "q1",
                "type": "choice",
                "stem": "This animal says “Meow”. What's this?",
                "options": ["dog", "cat", "panda", "frog"],
                "answer": "B",
                "target": "cat",
                "tag": "词汇",
                "hint": "先想“喵”是哪种动物。",
                "analysis": "Meow 是猫的叫声，cat 意为“猫”。",
            },
            {
                "id": "q2",
                "type": "choice",
                "stem": "— What's this? — ___ a panda.",
                "options": ["It", "It's", "This", "Is"],
                "answer": "B",
                "target": "It's a ...",
                "tag": "句型",
                "hint": "回答里要有 is，缩写成 's 放在 It 后面。",
                "analysis": "完整回答是 It is a panda.，缩写为 It's a panda.",
            },
            {
                "id": "q3",
                "type": "choice",
                "stem": "Which word means “青蛙”?",
                "options": ["frog", "dog", "cat", "panda"],
                "answer": "A",
                "target": "frog",
                "tag": "词汇",
                "hint": "frog 的发音以 /f/ 开头。",
                "analysis": "frog 青蛙；dog 狗；cat 猫；panda 熊猫。",
            },
            {
                "id": "q4",
                "type": "choice",
                "stem": "Look at the ___. It is black and white.",
                "options": ["cat", "frog", "panda", "dog"],
                "answer": "C",
                "target": "panda",
                "tag": "词汇",
                "hint": "黑白相间的动物。",
                "analysis": "熊猫是 black and white，panda 意为“熊猫”。",
            },
            {
                "id": "q5",
                "type": "fill",
                "stem": "— What's this? — It's a ___. （狗）",
                "answer": "dog",
                "accept": ["dog"],
                "target": "dog",
                "tag": "词汇",
                "hint": "d-o-g 三个字母。",
                "analysis": "dog 意为“狗”。",
                "rule": "不区分大小写，忽略首尾空格与句末标点。",
            },
            {
                "id": "q6",
                "type": "fill",
                "stem": "It's ___ frog.",
                "answer": "a",
                "accept": ["a"],
                "target": "a ...",
                "tag": "句型",
                "hint": "单数名词前需要一个冠词。",
                "analysis": "单数可数名词前用 a，构成 It's a frog.",
                "rule": "不区分大小写，忽略首尾空格与句末标点。",
            },
            {
                "id": "q7",
                "type": "short",
                "stem": "用 2 句话介绍你最喜欢的动物。第 1 句用 It's a … ，第 2 句用 It is … 说颜色。",
                "answer": "It's a panda. It is black and white.",
                "accept": [],
                "target": "It's a ... / It is ...",
                "tag": "句型",
                "hint": "先写动物名称，再写颜色。",
                "analysis": "示例：It's a frog. It is green.",
                "criteria": ["内容是否回应任务：写出动物名称与颜色", "表达是否基本清楚：句子完整、单词拼写可辨认"],
                "frame": "It's a ______. It is ______.",
                "keywords": "cat, dog, panda, frog / black, white, green, brown",
                "rule": "开放题不自动判分，由教师确认反馈。",
            },
        ],
    }


def build_cards(lesson):
    vocab = lesson.get("vocab") or ["cat", "dog", "panda", "frog"]
    # 词卡用本地插画裁切图，不使用 emoji；没有配图的词退化为首字母卡。
    meta = {
        "cat": ("猫", "It's a cat. It is white."),
        "dog": ("狗", "It's a dog. It is brown."),
        "panda": ("熊猫", "It's a panda. It is black and white."),
        "frog": ("青蛙", "It's a frog. It is green."),
    }
    words = []
    for w in vocab:
        zh, sent = meta.get(w, ("", f"It's a {w}."))
        words.append({
            "word": w, "zh": zh, "sentence": sent,
            "image": "/static/words/" + w + ".webp" if w in meta else "",
            "initial": w[:1].upper(),
        })
    return {
        "word_cards": words,
        "talk_card": {
            "title": "口头问答任务卡：Animal Talk",
            "stage": "语言运用（10 分钟）",
            "pattern": "What's this? — It's a …",
            "student_task": "两人一组，轮流抽一张动物卡：用 What's this? 提问，对方用 It's a … 回答，再说 1 句颜色。",
            "teacher_check": "听 3 组问答，记录目标句型是否完整（是否有 It's 与 a）。",
            "tip": "没有图片时直接用文字卡；先示范一组，再让学生自己开始。",
        },
        "handout": {
            "title": "家庭活动：把动物卡带回家",
            "steps": [
                "挑一张今天学过的动物卡。",
                "用 What's this? 问家人一次。",
                "把家人的回答记在卡片背面（中文也可以）。",
            ],
            "note": "家长只需陪孩子完成一次问答，不需要额外购买设备或讲新课。",
        },
    }


def build_slides(lesson):
    """6 页固定模板课件：标题目标 / 词汇 / 句型 / 操练 / 活动 / 总结与作业。"""
    vocab = lesson.get("vocab") or ["cat", "dog", "panda", "frog"]
    plan = build_plan(lesson)
    words = "\n".join(f"• {w}" for w in vocab)
    return [
        {
            "title": "Animals: What's this?",
            "subtitle": f"{lesson.get('grade','小学三年级')} · {lesson.get('duration',40)} 分钟 · Unit 4 第 1 课时",
            "body": "学习目标\n" + "\n".join(f"{i+1}. {o}" for i, o in enumerate(plan["objectives"])),
            "note": "开场 1 分钟：读出 3 个目标，告诉学生今天要完成一次问答。",
        },
        {
            "title": "Words · 四个动物词",
            "body": words + "\n\n听音指图：教师读单词，学生指图片并跟读。",
            "note": "5 分钟：先听再读，panda 的重音在第一音节。",
        },
        {
            "title": "Sentence · 问答句型",
            "body": "What's this?\nIt's a cat. / It's a dog. / It's a panda. / It's a frog.\n\n注意：It's = It is，不要漏掉 's。",
            "note": "5 分钟：教师问、学生答；再交换角色。",
        },
        {
            "title": "Practice · 配对与排序",
            "body": "配对：cat—猫  dog—狗  panda—熊猫  frog—青蛙\n排序：It's / a / cat / .\n\n做错不要紧，看清提示再试一次。",
            "note": "10 分钟：先全班做配对，再请两名学生上台排序。",
        },
        {
            "title": "Activity · Animal Talk",
            "body": "两人一组抽卡问答：\nA: What's this?\nB: It's a panda. It is black and white.\n\n说完交换角色，至少完成 3 轮。",
            "note": "10 分钟：教师巡视 3 组，记录句型是否完整。",
        },
        {
            "title": "Summary & Homework",
            "body": "今天学会了：4 个动物词 + 1 组问答。\n作业：7 题短练习 + 用动物卡问家人一次。\n\n自评：我能说出 3 个动物单词（举手）。",
            "note": "5 分钟：留 1 分钟让学生复述一个句子。",
        },
    ]


# ---------------------------------------------------------------- 反馈草稿

VOCAB_HINTS = {
    "cta": "cat",
    "dgo": "dog",
    "pande": "panda",
    "frgo": "frog",
}


def _levenshtein(a, b):
    if a == b:
        return 0
    if not a:
        return len(b)
    if not b:
        return len(a)
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


def draft_feedback(answer_text, item, vocab):
    """规则生成的开放题反馈草稿：已完成什么 / 哪处需检查 / 下一步如何改。"""
    text = (answer_text or "").strip()
    lower = text.lower()
    vocab = [w.lower() for w in (vocab or [])]
    done, check, nxt = [], [], []

    if not text:
        return "已完成：暂未看到作答内容。\n需检查：请先用 It's a … 写出一种动物。\n下一步：对照词卡补一句 It is … 说颜色。"

    if "it's" in lower or "it is" in lower or "its" in lower:
        done.append("用上了介绍动物的句型 It's a …")
    else:
        check.append("句子开头没有出现 It's / It is")
        nxt.append("把句子改成 It's a + 动物单词")

    hit = [w for w in vocab if re.search(r"\b" + re.escape(w) + r"\b", lower)]
    if hit:
        done.append("写出了目标词 " + "、".join(hit))
    else:
        check.append("没有看到四个目标动物词中的任何一个")
        nxt.append("从 cat / dog / panda / frog 中选一个写进句子")

    for token in re.findall(r"[a-z']+", lower):
        if token in vocab or token in {"it's", "it", "is", "a", "and", "the", "this", "what"}:
            continue
        near = [w for w in vocab if _levenshtein(token, w) <= 2 and token not in vocab]
        if near:
            done.append(f"试图写 {near[0]}，字母顺序接近")
            check.append(f"“{token}”拼写需核对，正确拼写是 {near[0]}")
            nxt.append(f"对照词卡把 {token} 改成 {near[0]}")
            break

    colors = [c for c in ("black", "white", "green", "brown", "red", "yellow") if c in lower]
    if colors:
        done.append("补充了颜色 " + "、".join(colors))
    else:
        nxt.append("第 2 句用 It is + 颜色 补一个描述")

    if "." not in text and "!" not in text:
        check.append("句末缺少标点")
        nxt.append("两句都加上句号")

    def line(label, arr, fallback):
        return f"{label}：" + ("；".join(dict.fromkeys(arr)) if arr else fallback)

    return "\n".join([
        line("已完成", done, "完成了作答，字数与要求接近"),
        line("需检查", check, "没有发现明显的拼写或结构问题，请再读一遍看是否通顺"),
        line("下一步", nxt, "用另一张动物卡再说一句 It's a …，确认能独立完成"),
    ])


# ---------------------------------------------------------------- 判分


def normalize(text):
    s = (text or "").strip().lower()
    s = s.replace("’", "'").replace("“", '"').replace("”", '"')
    s = re.sub(r"\s+", " ", s)
    s = re.sub(r"[.!?,;:]+$", "", s)
    return s


def grade_item(item, answer):
    """返回 (正确与否, 说明)。开放题返回 None。"""
    t = item.get("type")
    if t == "choice":
        ok = str(answer or "").strip().upper() == str(item.get("answer", "")).strip().upper()
        return ok, "选项一致" if ok else f"正确选项为 {item.get('answer')}"
    if t == "fill":
        accept = [normalize(a) for a in (item.get("accept") or [item.get("answer", "")])]
        ok = normalize(answer) in accept
        return ok, "与可接受答案一致" if ok else f"可接受答案：{' / '.join(accept)}"
    return None, "开放题由教师确认反馈"


# ---------------------------------------------------------------- 模型调用

MODEL_ENV = ("AI4EN_LLM_BASE_URL", "AI4EN_LLM_API_KEY", "AI4EN_LLM_MODEL")


def model_config():
    base = os.environ.get("AI4EN_LLM_BASE_URL", "").strip()
    key = os.environ.get("AI4EN_LLM_API_KEY", "").strip()
    model = os.environ.get("AI4EN_LLM_MODEL", "").strip() or "gpt-4o-mini"
    return {"base": base, "key": key, "model": model, "configured": bool(base and key)}


PROMPTS = {
    "plan": (
        "你是小学英语教研助手。请为 {grade} 主题 {topic} 生成一份 {duration} 分钟教案，"
        "目标词 {vocab}，目标句 {sentences}。只输出 JSON："
        '{{"objectives":[3条],"key_points":"","difficulties":"","flow":[{{"stage":"","minutes":0,'
        '"teacher":"","student":"","check":""}}],"board":"","homework":"","materials":"","rationale":""}}。'
    ),
    "exercises": (
        "请为 {grade} 主题 {topic} 出 7 道短练习：4 道选择、2 道填空、1 道开放表达。"
        "目标词 {vocab}，目标句 {sentences}。只输出 JSON："
        '{{"support":"frame","items":[{{"id":"q1","type":"choice","stem":"","options":[],"answer":"A",'
        '"target":"","tag":"","hint":"","analysis":""}}]}}。'
    ),
    "feedback": (
        "学生作答：{answer}。题目：{stem}。目标词：{vocab}。"
        "请给出 40 字以内的三段式反馈草稿（已完成 / 需检查 / 下一步），中文，不用分数。"
    ),
    "reflect": (
        "根据本课数据生成教学反思草稿，只写三个字段：本课完成情况、常见问题、下次调整。"
        "数据：{stats}。"
    ),
}


def build_prompt(kind, lesson, extra=None):
    extra = extra or {}
    tpl = PROMPTS[kind]
    return tpl.format(
        grade=lesson.get("grade", ""),
        topic=lesson.get("topic", ""),
        duration=lesson.get("duration", 40),
        vocab="、".join(lesson.get("vocab") or []),
        sentences=" / ".join(lesson.get("sentences") or []),
        answer=extra.get("answer", ""),
        stem=extra.get("stem", ""),
        stats=extra.get("stats", ""),
    )


def call_model(prompt, timeout=40):
    """调用 OpenAI 兼容接口。返回 (text, provider, error, latency_ms)。

    密钥只在后端读取；浏览器拿不到任何密钥。
    """
    cfg = model_config()
    if not cfg["configured"]:
        return None, "sample", "未配置模型（缺少 AI4EN_LLM_BASE_URL / AI4EN_LLM_API_KEY）", 0
    url = cfg["base"].rstrip("/") + "/chat/completions"
    body = json.dumps({
        "model": cfg["model"],
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.4,
    }).encode("utf-8")
    req = urllib.request.Request(url, data=body, method="POST", headers={
        "Content-Type": "application/json",
        "Authorization": "Bearer " + cfg["key"],
    })
    start = time.time()
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = json.loads(resp.read().decode("utf-8"))
        text = raw["choices"][0]["message"]["content"]
        return text, "model", None, int((time.time() - start) * 1000)
    except Exception as exc:  # noqa: BLE001 - 失败原因要原样记录
        return None, "model", f"{type(exc).__name__}: {exc}", int((time.time() - start) * 1000)


def extract_json(text):
    if not text:
        return None
    m = re.search(r"\{.*\}", text, re.S)
    if not m:
        return None
    try:
        return json.loads(m.group(0))
    except json.JSONDecodeError:
        return None


# ---------------------------------------------------------------- 助教完整版代理
# 把原“小学英语AI助教-完整版”的 Node 代理搬到这里：密钥只在后端，浏览器拿不到。
# 配置方式与原项目一致：环境变量 DEEPSEEK_API_KEY，或项目根目录 config.json={"apiKey":"..."}。

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

SCENE_DESC = {
    "restaurant": "a waiter at Sunny Restaurant taking the student's order",
    "shopping": "a shop assistant at a clothes shop helping the student buy clothes",
    "selfintro": "a friendly English teacher meeting a new student for the first time",
    "asking_way": "a kind stranger giving directions to the library",
    "doctor": "a gentle doctor asking about the student's health",
    "weather": "a teacher chatting about the weather and daily activities",
    "school": "a teacher talking about school subjects and daily life",
    "travel": "airport staff helping a traveller check in",
}


def deepseek_config():
    key = os.environ.get("DEEPSEEK_API_KEY", "").strip()
    if not key:
        try:
            with open(os.path.join(ROOT_DIR, "config.json"), encoding="utf-8") as fh:
                key = str(json.load(fh).get("apiKey", "")).strip()
        except (OSError, ValueError):
            key = ""
    base = os.environ.get("DEEPSEEK_BASE_URL", "https://api.deepseek.com").rstrip("/")
    model = os.environ.get("DEEPSEEK_MODEL", "deepseek-chat")
    return {"key": key, "base": base, "model": model, "configured": bool(key)}


def _system_prompt(mode, scene):
    if mode == "student":
        return ("You are a cheerful Chinese grade-5 primary-school student. Answer the teacher's question "
                "in ONE short, simple English sentence (max 15 words). Do not add explanations.")
    if mode == "prompt":
        return ("You are a prompt-engineering coach for Chinese primary-school English teachers. "
                "Rewrite the user's prompt to be clear, specific and easy to execute. "
                "Output ONLY the improved prompt in Chinese. No explanations.")
    if mode == "lesson":
        return ("You are a primary-school English lesson designer. Based on the textbook content the user provides, "
                "design one 40-minute lesson. Output ONLY a JSON object with this shape: "
                '{"unit":"...","grade":"...","type":"读写课","objectives":[{"dim":"语言知识","text":"..."}],'
                '"chain":[{"stage":"导入","time":"5\'","form":"全班","desc":"...","scaffold":"..."}],'
                '"tiers":{"basic":{"title":"基础层 · 有支架","items":["..."]},'
                '"advanced":{"title":"进阶层 · 半开放","items":["..."]},'
                '"challenge":{"title":"挑战层 · 迁移","items":["..."]}},'
                '"scaffolds":{"patterns":["..."],"prompts":["..."],"models":["..."]},"board":"...","homework":"..."} '
                "Rules: 5 objectives; 5 chain items; 3 items per tier; Chinese for dim/desc, English for example sentences; "
                "no markdown; no explanation.")
    s = SCENE_DESC.get(scene, "a friendly English teacher")
    return "\n".join([
        "You are Lily, a warm, patient primary-school English teacher in China (Grade 5).",
        "You are role-playing: " + s + ".",
        "Rules:",
        "- Reply in 1-2 short, simple English sentences (max 25 words), suitable for an 11-year-old.",
        "- Always end your reply with ONE simple question so the student keeps talking.",
        "- If the student makes a clear mistake, gently model the correct form in your reply; do not lecture.",
        "- Be encouraging and playful. Use at most one emoji.",
        "- If the student writes in Chinese, answer in simple English and invite them to try English.",
        "- Stay in the role-play scene; never mention that you are an AI or a model.",
    ])


def deepseek_chat(payload):
    """返回模型回复文本；未配置或调用失败时抛异常，由接口层转成 503/502。"""
    cfg = deepseek_config()
    if not cfg["configured"]:
        raise RuntimeError("no_key")
    message = str(payload.get("message") or "").strip()[:600]
    if not message:
        raise ValueError("empty_message")
    history = payload.get("history") if isinstance(payload.get("history"), list) else []
    messages = [{"role": "system", "content": _system_prompt(str(payload.get("mode") or ""), payload.get("scene"))}]
    for item in history[-10:]:
        if isinstance(item, dict) and item.get("role") in ("user", "assistant") and item.get("content"):
            messages.append({"role": item["role"], "content": str(item["content"])[:1000]})
    messages.append({"role": "user", "content": message})
    max_tokens = {"prompt": 700, "lesson": 2200}.get(str(payload.get("mode") or ""), 200)
    body = json.dumps({"model": cfg["model"], "messages": messages,
                       "temperature": 0.7, "max_tokens": max_tokens}).encode("utf-8")
    req = urllib.request.Request(cfg["base"] + "/chat/completions", data=body, method="POST", headers={
        "Content-Type": "application/json",
        "Authorization": "Bearer " + cfg["key"],
    })
    try:
        with urllib.request.urlopen(req, timeout=45) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", "ignore")[:200]
        raise RuntimeError("upstream " + str(exc.code) + ": " + detail)
    except Exception as exc:  # noqa: BLE001
        raise RuntimeError("upstream: " + type(exc).__name__ + " " + str(exc)[:160])
    try:
        reply = data["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError):
        raise RuntimeError("empty_reply")
    return str(reply).strip()
