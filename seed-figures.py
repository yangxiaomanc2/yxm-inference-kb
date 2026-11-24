"""Seed the public knowledge base figures from pinned upstream Git objects."""

import json
import os
import re
import subprocess
import sys
import uuid
from urllib.parse import urlencode

BASE = "https://jfvktpiumonhsgsgwbcc.supabase.co/rest/v1/pages_blocks"
SOURCES = {
    "infer": ("DeepInfer", "deepseek-ai/DeepInfer", "a679bb86ce36e883a98a97733492b686e5b9a08e"),
    "harness": ("DeepSeek-Harness", "deepseek-ai/deepseek-harness", "4b399c39a6d1479cd84ca591b4d7c88e24d38a96"),
    "rsi": ("OpenRSI", "FrontisAI/openrsi", "71ae803a035d5e3b78c19fa49ed9f67d0550cbaa"),
}
FLASH_REPORT = "https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash/resolve/main/DeepSeek_V41_Tech_Report.pdf"
RSI_PAPER = "https://arxiv.org/abs/2607.28568"


def upstream(key, path="", first=None, last=None):
    _, repo, revision = SOURCES[key]
    if not path:
        return f"https://github.com/{repo}/tree/{revision}"
    lines = f"#L{first}-L{last}" if first is not None else ""
    return f"https://github.com/{repo}/blob/{revision}/{path}{lines}"


def arch(title, source, caption, *stages):
    return {
        "kind": "arch", "title": title, "caption": caption, "source": source,
        "stages": [
            dict(key=str(i), label=label, color=color, sub=sub, note=note)
            for i, (label, color, sub, note) in enumerate(stages)
        ],
    }


def code(title, key, path, first, last, *steps):
    directory, _, revision = SOURCES[key]
    source = subprocess.check_output([
        "git", "-C", os.path.join(sys.argv[1], directory), "show", f"{revision}:{path}",
    ]).decode("utf-8")
    lines = source.splitlines(keepends=True)
    assert 1 <= first <= last <= len(lines) and last-first < 40
    for _, ranges, _ in steps:
        for part in ranges.split(","):
            assert re.fullmatch(r"\d+(?:-\d+)?", part)
            a, *end = map(int, part.split("-"))
            assert first <= a <= (end[0] if end else a) <= last
    return {
        "kind": "code", "title": title, "caption": f"{path.rsplit('/', 1)[-1]}，{revision[:8]}",
        "file": f"{path} @ {revision[:8]}", "source": upstream(key, path, first, last),
        "startLine": first, "totalLines": len(lines), "code": "".join(lines[first-1:last]),
        "steps": [dict(label=label, lines=ranges, desc=desc) for label, ranges, desc in steps],
    }


def schedule():
    return code("DSpark 怎样分配验证预算", "infer", "csrc/engine/mtp_varlen.hpp", 228, 267,
        ("估算收益", "235-248", "用预期接受 token 数除以预测耗时，记录吞吐最高的预算。"),
        ("枚举预算", "251-258", "先试每条请求一个位置，再按候选置信度追加位置。"),
        ("分配验证长度", "260-266", "把超出每请求基线的预算分配回各条序列。"))


def graphs():
    infer = upstream("infer")
    harness = upstream("harness")
    rsi = upstream("rsi")
    return {
        "flash": [
            arch("CED 的 global KV 生产路径", FLASH_REPORT, "DeepSeek-V4.1 技术报告。各 decoder 层的 SWA 走独立路径。",
                ("Prompt", "blue", ["完整序列"], "Encoder 接收完整 prompt。"),
                ("Encoder", "purple", ["第 0–19 层", "产生 H_E"], "H_E 是前后半段的边界输出。"),
                ("Global KV", "ochre", ["从 H_E 投影"], "Decoder 的 global KV 由边界输出生产。"),
                ("Decoder", "green", ["第 20–39 层", "读取共享 KV"], "SWA KV 由各层自己的隐藏状态生成。")),
            arch("CSA2 的 Full、Reindex 和 Reuse", FLASH_REPORT, "技术报告 §2.3.2。候选池来自 Full 的打分，省略层间重复。",
                ("Full", "purple", ["全可见位置打分"], "Full 同时从这些分数取自己的 Top-512，用于本层 attention。"),
                ("候选池", "ochre", ["每 8 个位置取块最大值", "选 2,048 个块"], "块候选最多包含 16,384 个位置。"),
                ("Reindex", "purple", ["池内重新打分", "生成 Top-512"], "在候选池内重复索引，缩小打分域。"),
                ("Reuse", "green", ["读取最近的 Top-K"], "Reuse 层复用已有的索引结果。")),
            arch("890 B/token 的 global KV 预算", FLASH_REPORT, "技术报告与模型配置推导。该口径仅统计 global KV。",
                ("生产层", "blue", ["4 个 main KV 生产层"], "其余层读取共享 KV。"),
                ("序列压缩", "ochre", ["压缩因子 2、2、2、1"], "四层合计为每 token 2.5 个 entry。"),
                ("Entry 开销", "ochre", ["Main KV 288 B", "Indexer K 68 B"], "分别按 main KV 和 indexer K 的 entry 计价。"),
                ("每 token", "green", ["720 B + 170 B", "= 890 B"], "两类 KV 的每 token 开销相加。")),
            schedule(),
        ],
        "deepinfer": [
            arch("ZOS 的跨步执行", infer, "DeepInfer a679bb8。图示 ZOS decode 稳态，省略 prompt 与非 ZOS 分支。",
                ("Schedule N", "blue", ["C++ 选批与准备状态"], "Python 编排，C++ 调度器准备此次执行计划。"),
                ("Forward N", "purple", ["GPU 执行第 N 步"], "GPU kernel 消费上一步采样结果以修正长度等状态。"),
                ("Post N−1", "gray", ["收尾上一轮"], "当前 forward 提交后收尾上一轮。"),
                ("Sample N", "green", ["产生第 N 步结果"], "ZOS decode 的 Post N 延至下一次 step。")),
            code("DP 调度器如何决定是否做 Prefill", "infer", "csrc/engine/scheduler.hpp", 308, 340,
                ("检查投票点", "308-312", "不在 ANY 或 ALL 投票点时直接做 decode。"),
                ("发起 DP 投票", "313-322", "候选 rank 需满足缓存水位和等待队列条件，再按 ANY 或 ALL 聚合。"),
                ("尝试构建批次", "323-326", "有意愿的 rank 尝试分配 slot 和 KV 块。"),
                ("确认执行步型", "328-340", "第二轮投票确认至少一个 rank 排出 prefill，否则全组回到 decode。")),
            arch("Compact Prefill 如何保留全长 KV", infer, "DeepInfer a679bb8。边界处保留全长 KV 路径，压缩的是后半段 query。",
                ("Encoder", "blue", ["完整序列"], "前半段保持全长。"),
                ("YoCo Boundary", "ochre", ["完整 H_E → 写 KV", "保留行 → 压缩 query"], "全长 KV 和紧凑 query 由同一个边界张量分别产生。"),
                ("Decoder", "green", ["仅执行保留的 query 行"], "后半段在压缩后的 query 上继续计算。")),
            arch("CSA2 的三张层间共享映射", infer, "DeepInfer a679bb8。三个子步骤表示并列映射。",
                ("Model Config", "blue", ["读取层级配置"], "每层的共享关系在构造期解析。"),
                ("SharedLayerTopology", "ochre", ["main KV 源层", "indexer K 源层", "Top-K 源层"], "分别定位三种数据的生产层。"),
                ("CrossLayerRuntime", "green", ["读取生产层状态"], "执行期把 KV 中间结果、候选池和 Top-K 传给消费层。")),
            schedule(),
        ],
        "harness": [
            arch("Session 事件如何生成模型请求", harness, "DeepSeek Harness 4b399c39。失败尝试与工具结果也进入会话事件流。",
                ("Inbox", "blue", ["接收输入与上下文"], "本轮输入进入 agent loop。"),
                ("Session", "ochre", ["追加事件", "deriveMessages()"], "模型可见内容由日志投影得到。"),
                ("Request", "gray", ["冻结请求与消息"], "冻结约束防止请求构造后被原地改写。"),
                ("Model stream", "purple", ["流式响应"], "响应完成后写入 assistant 事件。"),
                ("Next step", "green", ["记录工具结果"], "工具结果在下一轮重新进入事件投影。")),
            code("从会话日志构建不可变请求", "harness", "packages/core/agent-loop/src/agent.ts", 707, 730,
                ("追加上下文变化", "707-713", "仅当 provider、model、窗口或提示词更新方式变化时写入事件。"),
                ("投影并冻结", "716-724", "冻结请求头，再从 Session 导出消息并冻结消息数组。"),
                ("组装请求", "725-730", "把已冻结的消息和工具历史直接放入实际请求。")),
            arch("工具调用如何通过权限与执行流程", upstream("harness", "docs/tool-execution-pipeline.md"),
                "DeepSeek Harness 4b399c39。主路径为获准执行的调用，拒绝会跳过工具执行。",
                ("Tool Call", "blue", ["记录 tool/call"], "工具调用及参数先进入会话日志。"),
                ("Permission", "gray", ["Allow / Ask / Deny"], "拒绝分支跳过执行，请求批准后按结果继续。"),
                ("Execute", "ochre", ["Guard", "工具执行"], "权限通过后才进入工具执行。"),
                ("Result", "green", ["投影输出", "记录 tool/result"], "批次结束后可补充后续上下文。")),
            code("如何验证请求前缀复用", "harness", "packages/core/agent-loop/tests/request-cache.e2e.ts", 79, 102,
                ("触发连续请求", "79-89", "运行工具轮次和后续对话。"),
                ("收集用量", "91-95", "从会话日志取出 provider 返回的用量。"),
                ("断言缓存读取", "97-102", "首个请求之后的请求均须读到缓存。")),
            arch("上下文压缩与前缀复用", upstream("harness", "packages/compaction/compaction-basic"),
                "DeepSeek Harness 4b399c39。摘要请求与下一次常规请求的可复用前缀不同。",
                ("Context Pressure", "blue", ["达到压缩条件"], "上下文压力或溢出触发压缩。"),
                ("Summary Request", "purple", ["复用既有前缀", "末尾追加摘要指令"], "摘要模型读取旧历史。"),
                ("Replace History", "ochre", ["摘要替换指定历史"], "替换点之后的常规请求前缀发生变化。"),
                ("Next Request", "green", ["用摘要重建请求"], "替换点之前的前缀可以继续复用。")),
        ],
        "openrsi": [
            arch("搜索、经验与训练如何衔接", RSI_PAPER, "Frontis-MA1 论文。首发版按离线闭环解读，属于工程推断。",
                ("OpenMLE-Gym", "blue", ["任务与沙箱评测"], "为任务提供可执行的环境和得分。"),
                ("OpenMLE-Evo", "ochre", ["Draft / Improve", "Debug / Crossover"], "四种算子在训练和搜索时共用。"),
                ("Experience", "gray", ["搜集执行轨迹"], "轨迹成为监督训练等阶段的输入。"),
                ("SFT + RL", "purple", ["训练 Frontis-MA1"], "训练后的模型回到搜索，充当变异引擎。"),
                ("OpenMLE-Evo", "green", ["模型驱动下一轮搜索"], "训练得到的模型继续使用同一组搜索算子。")),
            arch("一次 RL Rollout 的数据流", rsi, "OpenRSI 71ae803。省略 rollout 批次间调度。",
                ("Program Database", "blue", ["取算子和父代"], "同组样本共享父代与提示。"),
                ("Rollout", "purple", ["16 个样本", "SGLang 生成代码"], "共享输入前缀，逐样本采样候选程序。"),
                ("Sandbox", "gray", ["Hack check", "执行评分"], "先检查候选，再执行并评估。"),
                ("Reward", "green", ["计算奖励", "回写数据库"], "候选的执行反馈影响后续训练和父代选择。")),
            code("Improve 算子怎样生成子节点", "rsi",
                "OpenMLE-Evo/third_party/aira-evo/src/dojo/solvers/evo/evo.py", 1064, 1081,
                ("准备父代记忆", "1064", "根据父节点选择 Improve 所需经验。"),
                ("生成新程序", "1065-1075", "把任务、父代、日志和剩余时间交给生成算子。"),
                ("保存谱系", "1076-1081", "新节点携带计划、代码、原父节点和算子指标。")),
            code("搜索如何衡量父代价值", "rsi",
                "OpenMLE-Evo/third_party/aira-evo/src/dojo/solvers/evo/experience.py", 1217, 1247,
                ("计算价值", "1217-1226", "加权合并分数、改进量和方法新颖性。"),
                ("记录评分来源", "1227-1244", "使用 self_validation，官方分数单独记录。"),
                ("生成抽样分布", "1247", "按 utility 和 temperature 计算候选概率。")),
        ],
    }


NOTES = {
    "flash": f"主要依据 [DeepSeek-V4.1 技术报告]({FLASH_REPORT})、模型配置与 DeepInfer `a679bb8`。未公开的数据在原文中标明。",
    "deepinfer": f"代码引用以 [DeepInfer `a679bb8`]({upstream('infer')}) 为准。与 vLLM、SGLang 和 TensorRT-LLM 的对比讨论公开设计，具体实现以各项目版本为准。",
    "harness": f"代码引用以 [DeepSeek Harness `4b399c39`]({upstream('harness')}) 为准。",
    "openrsi": f"代码引用以 [OpenRSI `71ae803`]({upstream('rsi')}) 为准。模型与训练方法见 [Frontis-MA1 论文]({RSI_PAPER})。",
}


def seed_rows():
    rows = []
    for slug, figures in graphs().items():
        page = f"yxm-kb-{slug}"
        notes = NOTES[slug] + " 「工程推断」表示作者依据公开材料作出的判断。"
        for i, (section, data) in enumerate([*(("figure", d) for d in figures), ("notes", {"body": notes})], 1):
            row_id = str(uuid.uuid5(uuid.NAMESPACE_URL, f"yxm-inference-kb/{page}/{section}/{i}"))
            rows.append(dict(id=row_id, page=page, section=section, sort=i*10, data=data))
    return rows


def request(query, rows=None):
    args = ["curl", "-fsS", "--max-time", "20", "-H", "apikey: "+os.environ["KB_SUPABASE_KEY"],
            BASE+"?"+urlencode(query)]
    if rows is not None:
        args.extend(["-H", "Content-Type: application/json", "-H",
                     "Prefer: resolution=ignore-duplicates,return=representation", "--data-binary", "@-"])
    body = json.dumps(rows).encode() if rows is not None else None
    return json.loads(subprocess.run(args, input=body, check=True, stdout=subprocess.PIPE).stdout)


if __name__ == "__main__":
    rows = seed_rows()
    if "--publish" in sys.argv[2:]:
        query = {"id": "in.("+",".join(row["id"] for row in rows)+")", "select": "id,page,section,sort,data"}
        existing = {row["id"]: row for row in request(query)}
        assert all(existing[row["id"]] == row for row in rows if row["id"] in existing), "Existing figure differs. Review before editing."
        missing = [row for row in rows if row["id"] not in existing]
        if missing:
            request({"on_conflict": "id"}, missing)
        assert {row["id"]: row for row in request(query)} == {row["id"]: row for row in rows}
        print(f"Verified {len(rows)} published rows")
    else:
        print(json.dumps(rows, ensure_ascii=False))
