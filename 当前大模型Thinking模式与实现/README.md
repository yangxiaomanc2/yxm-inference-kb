# 当前大模型 Thinking 模式与实现

> 面向模型应用、推理服务和性能优化的技术知识页。本文将用户所说的“thing 模式”按业界通用的 **Thinking / Reasoning 模式**理解。资料核对日期：2026-11-25。

## 1. 一句话理解

Thinking 模式让模型在交付最终答案前，使用额外的生成步骤进行问题分解、候选方案尝试、校验和修正。它不是一个统一的网络结构开关，而是一组由训练方法、推理预算、输出协议和服务端解析共同实现的能力。

生产系统通常需要同时回答四个问题：

1. 模型是否具备经过训练的推理能力。
2. 本次请求允许模型投入多少推理计算。
3. 推理过程是否向调用方返回，返回字段和格式是什么。
4. 推理过程中是否允许工具调用，工具结果如何回填并继续生成。

“开启 Thinking”通常会提高复杂任务的正确率，但也会增加输出 token、首 token 延迟、总延迟和上下文占用。简单任务应使用较低的 effort 或关闭显式推理，最终取值需要用业务数据评测。

## 2. 当前主流实现形态

| 形态 | 典型控制方式 | 推理内容 | 适用场景 |
| --- | --- | --- | --- |
| 独立推理模型 | 选择 reasoning 模型 | 可能隐藏，也可能通过额外字段返回 | 数学、代码、科学问题 |
| 同一模型的混合模式 | 请求参数切换 thinking / non-thinking | 常见为 `reasoning`、`reasoning_content` 或标签包裹 | 对延迟和质量都敏感的通用应用 |
| 自适应 Thinking | 设置 effort，模型自行决定是否思考及思考多少 | 通常返回摘要、加密内容或不返回原始 CoT | 统一接入、动态控制成本 |
| 固定预算 Thinking | 设置 thinking token budget | 可返回 thinking block 或 reasoning 字段 | 需要可预测成本和延迟的任务 |

当前接口趋势是把“是否思考”和“思考多少”分开。前者由模型能力或 thinking 类型决定，后者由 `effort`、`thinking_level` 或 token budget 控制。不同厂商的字段名称仍未统一，网关层应做协议归一化。

## 3. 厂商接口对比

### OpenAI Reasoning API

OpenAI 通过 `reasoning.effort`（Responses API）或 `reasoning_effort`（兼容 Chat Completions 的接口）控制推理力度。可选值由模型决定，常见等级包括 `minimal`、`low`、`medium`、`high`、`xhigh` 和 `max`。

推理 token 会计入输出上限和用量统计。Responses API 可能在 `output` 中返回 reasoning item，其中的 reasoning 内容可能是加密内容，用于后续请求的上下文延续，而不是供应用直接读取完整内部思维。调用方需要为推理 token 和最终答案预留足够的 `max_output_tokens`。

```python
from openai import OpenAI

client = OpenAI()
response = client.responses.create(
    model="reasoning-model",
    reasoning={"effort": "medium"},
    input="审查这段并发代码，列出竞态条件并给出修复方案。",
)
print(response.output_text)
```

工程要点是把 effort 当作质量、延迟和成本的控制旋钮，而不是把每个请求都固定到最高等级。模型可用的 effort 值、默认值和 reasoning item 行为必须以目标模型文档为准。

来源：[OpenAI Reasoning guide](https://platform.openai.com/docs/guides/reasoning)

### Anthropic Claude Thinking

Anthropic 当前推荐使用 adaptive thinking。请求中设置：

```json
{
  "thinking": {"type": "adaptive"},
  "output_config": {"effort": "high"}
}
```

自适应模式允许模型按问题难度决定是否思考以及思考多少。旧的固定预算模式使用 `thinking.type = "enabled"` 和 `budget_tokens`，适合需要明确控制推理预算的旧模型或特定工作负载。Claude 4.7 及之后的模型不接受旧的固定预算配置，迁移时应改为 adaptive thinking 和 `output_config.effort`。

Claude 的响应可能包含 thinking block、文本 block 和工具调用。流式处理、工具调用、提示词缓存和多轮上下文都必须保留协议要求的 thinking block。应用层不应简单地把 thinking 文本拼接成普通 assistant 文本后再回传。

来源：[Anthropic Extended thinking](https://docs.anthropic.com/en/docs/build-with-claude/extended-thinking)

### Google Gemini Thinking

Gemini 使用 `thinking_level` 或较早模型使用的 `thinking_budget` 控制思考深度。新的模型通常以 `low`、`medium`、`high` 等等级控制质量、延迟和 token 使用量。Gemini 也可以返回 thought steps 或 thought summaries，应用可以用它们解释过程、调试工具调用顺序或分析失败原因。

OpenAI 兼容接口会把 `reasoning_effort` 映射到 Gemini 的 thinking 配置。例如，`low`、`medium`、`high` 分别映射到相应的 `thinking_level`。同一请求不要同时设置 `reasoning_effort` 和原生 `thinking_level` / `thinking_budget`。

来源：[Gemini Thinking](https://ai.google.dev/gemini-api/docs/thinking) 与 [Gemini OpenAI compatibility](https://ai.google.dev/gemini-api/docs/openai)

### DeepSeek 与 Qwen 等开放权重模型

DeepSeek-R1 展示了“训练出可见推理轨迹”的开放权重路线。其训练流程包含冷启动数据、监督微调和两阶段强化学习。R1-Zero 直接进行大规模强化学习，出现了自发的长链推理行为，但也有重复、可读性和语言混杂问题。加入 cold-start 数据后得到的 R1 更适合实际使用。

DeepSeek-R1 系列常见的兼容接口约定是：

```json
{
  "message": {
    "reasoning_content": "推理内容",
    "content": "最终答案"
  }
}
```

Qwen3 等混合模型通常通过 chat template 参数控制 `enable_thinking`。Thinking 模型可能固定生成推理内容，Hybrid 模型则允许每个请求切换。实际部署时必须使用与模型 chat template 匹配的参数，不能仅凭模型名称猜测。

开放模型的“可见推理”不等于经过验证的真实内部过程。推理文本可能是模型生成的解释，不能直接当作安全审计证据或事实证明。应用仍需使用单元测试、工具结果、结构化校验和最终答案评测。

来源：[DeepSeek-R1 官方仓库](https://github.com/deepseek-ai/DeepSeek-R1) 与 [Qwen function calling 文档](https://qwen.readthedocs.io/en/latest/framework/function_call.html)

## 4. 从训练到请求的实现链路

### 4.1 训练阶段

推理能力通常由以下组合产生：

- 预训练提供语言、代码和世界知识。
- Cold-start SFT 提供高质量问题、推理过程和答案格式。
- 结果可验证的强化学习用数学答案、代码测试或规则检查器提供奖励。
- 偏好对齐改善可读性、格式、拒答和工具调用行为。
- 蒸馏把大模型推理轨迹压缩到更小模型，降低部署成本。

GRPO 等方法可以在没有为每个样本训练独立 critic 的情况下，根据同一问题的一组候选答案计算相对奖励。它适合有可验证结果的数学、代码和结构化任务，但奖励函数错误会把模型优化到错误目标。

### 4.2 推理阶段

一次 Thinking 请求可以抽象为：

```text
用户输入
  ↓
选择模式与推理预算
  ↓
Prefill：处理上下文
  ↓
Decode：生成 reasoning / tool call / final answer
  ↓
若有工具调用：执行工具并回填结果
  ↓
继续 Decode
  ↓
返回最终答案与可选的 reasoning 摘要
```

推理预算可通过生成 token 上限、模型 effort、thinking level 或固定 budget 表达。服务端还要同时管理 KV Cache、连续批处理、前缀缓存、并行策略和取消请求。推理 token 增多时，KV Cache 和 decode 时间通常也会增长，长上下文场景尤其明显。

### 4.3 输出协议

建议在业务网关内部统一成如下结构：

```json
{
  "answer": "最终答案",
  "reasoning": "可选的摘要或调试信息",
  "tool_calls": [],
  "usage": {
    "input_tokens": 0,
    "reasoning_tokens": 0,
    "output_tokens": 0
  },
  "finish_reason": "stop"
}
```

适配器至少应兼容以下来源：

- `reasoning`
- 旧版本常见的 `reasoning_content`
- Anthropic 的 thinking block
- Gemini 的 thought step 或 thought summary
- 文本中由 `<think>...</think>`、特殊 token 或模型专用标签包裹的推理段

`reasoning` 和 `reasoning_content` 不能只支持其中一个。服务端升级后字段名变化可能导致客户端静默丢失推理内容，甚至影响工具调用状态判断。

## 5. vLLM 与 SGLang 的服务端实现

### vLLM

vLLM 通过 reasoning parser 把模型原始输出解析成结构化 reasoning 字段和最终 content。在线 Chat Completions、Anthropic Messages API 与 Responses API 均可提供 reasoning 输出，但具体能力取决于模型和接口。

示意启动方式：

```bash
vllm serve <model> \
  --reasoning-parser <parser-name>
```

不同模型需要不同 parser，例如 DeepSeek-R1、DeepSeek-V3、Qwen3、GLM 和其他模型各有对应格式。Qwen 等模型还可能需要通过 `chat_template_kwargs` 控制是否启用 Thinking。若要支持新的格式，可以参考 `ReasoningParser` 实现新的解析器。

vLLM 新版本使用 `reasoning` 字段，旧版本或其他兼容服务可能使用 `reasoning_content`。网关和客户端应同时读取并做版本兼容。

来源：[vLLM Reasoning Outputs](https://docs.vllm.ai/en/latest/features/reasoning_outputs.html)

### SGLang

SGLang 通过 `--reasoning-parser` 选择推理格式解析器，并以 OpenAI 兼容协议返回 `reasoning_content` 和 `content`。不同模型可能使用不同标签，例如 DeepSeek、Qwen、Kimi 和 GPT OSS 的推理边界不相同。

示意启动方式：

```bash
python -m sglang.launch_server \
  --model-path <model> \
  --reasoning-parser <parser-name>
```

新增模型格式时，可以继承 `BaseReasoningFormatDetector`，实现开始标签、结束标签、增量流解析和工具调用边界。解析器必须处理跨 chunk 的标签，不应假设一个 SSE chunk 恰好对应一段完整标签。

来源：[SGLang Separate Reasoning](https://docs.sglang.ai/advanced_features/separate_reasoning.html)

## 6. Thinking 与工具调用

Thinking 模式与工具调用结合后，assistant 一轮可能包含：

1. thinking。
2. 一个或多个 tool call。
3. 工具返回结果。
4. 新一轮 thinking。
5. final answer。

实现时要保存每个 block 的类型、顺序、工具调用 ID 和参数字符串。工具参数可能以流式片段到达，必须在完整后再做 JSON 解析。把 reasoning 文本误判为普通 content，或丢失工具调用前的 thinking block，都会导致下一轮请求上下文不完整。

推荐的执行循环：

```python
while True:
    response = model.generate(messages, tools=tools, effort=effort)
    messages.extend(response.assistant_blocks)

    if not response.tool_calls:
        return response.final_answer

    for call in response.tool_calls:
        result = execute_tool(call.name, call.arguments)
        messages.append(tool_result(call.id, result))
```

工具执行必须设置超时、参数校验、幂等键和最大循环次数。模型的 reasoning 内容可以帮助调试，但不应直接决定权限、金额、删除等高风险操作。

## 7. 推理服务的性能模型

Thinking 任务的端到端延迟可以拆成：

```text
总延迟
≈ 排队等待
 + Prefill 时间
 + reasoning Decode 时间
 + 工具执行时间
 + 工具结果后的 Decode 时间
 + 网络与序列化时间
```

需要单独记录以下指标：

- TTFT：首个可见 token 的时间。
- reasoning token 数和最终输出 token 数。
- TPOT：每个生成 token 的平均时间。
- 端到端延迟和 P50/P95/P99。
- 工具调用次数、工具耗时和失败率。
- KV Cache 命中率、显存占用和抢占次数。
- 每个任务类型的正确率、可验证通过率和单位成本。

只看最终答案长度会低估 Thinking 的成本。推理 token 可能不展示给用户，但依然消耗生成预算、显存和服务时间。对复杂任务，应比较固定 effort、动态 effort 和关闭 Thinking 三种策略，而不是只比较模型名称。

## 8. 评测方法

### 8.1 能力评测

- 数学：答案正确率和步骤可验证率。
- 代码：测试通过率、编译成功率和修复回归率。
- 事实问答：引用正确率和拒答准确率。
- 工具使用：参数正确率、工具选择率、循环次数和最终任务成功率。
- 长上下文：关键信息召回率和上下文长度增长后的退化曲线。

### 8.2 系统评测

对同一数据集记录 `effort`、推理 token、最终 token、TTFT、总延迟和成本，绘制质量—延迟—成本曲线。复杂任务的最优点通常不是最高预算，而是达到目标质量后的最低预算。

### 8.3 过程评测

可检查推理是否出现重复、过早结束、无效搜索、工具参数反复修正和奖励投机。对隐藏推理的闭源模型，应优先评测最终结果、工具轨迹和可验证中间产物，不能把不可见过程当作可审计证据。

## 9. 工程落地清单

- 在模型注册表中记录模型是否支持 Thinking、可用 effort、是否固定思考和 reasoning 字段格式。
- 在网关层统一 `reasoning`、`reasoning_content`、thinking block 和 thought step。
- 为流式解析器增加跨 chunk 标签测试。
- 将 reasoning token 单独计费和监控。
- 工具调用保留 block 顺序、调用 ID 和完整参数。
- 为 effort 设置任务级默认值，并允许按租户、接口和预算覆盖。
- 为简单任务设置低 effort 或关闭 Thinking 的路径。
- 对高风险动作使用独立的权限校验和人工确认。
- 评测时同时测质量、延迟、token、显存、吞吐和成本。
- 部署前核对目标模型的 chat template、parser、工具调用格式和服务端版本。

## 10. 参考资料

1. [OpenAI Reasoning guide](https://platform.openai.com/docs/guides/reasoning)
2. [Anthropic Extended thinking](https://docs.anthropic.com/en/docs/build-with-claude/extended-thinking)
3. [Gemini Thinking](https://ai.google.dev/gemini-api/docs/thinking)
4. [Gemini OpenAI compatibility](https://ai.google.dev/gemini-api/docs/openai)
5. [DeepSeek-R1 官方仓库](https://github.com/deepseek-ai/DeepSeek-R1)
6. [Qwen function calling 文档](https://qwen.readthedocs.io/en/latest/framework/function_call.html)
7. [vLLM Reasoning Outputs](https://docs.vllm.ai/en/latest/features/reasoning_outputs.html)
8. [SGLang Separate Reasoning](https://docs.sglang.ai/advanced_features/separate_reasoning.html)

## 11. 边界与更新说明

本文描述的是跨厂商的实现机制和接口模式，不把某个厂商的模型名称、默认 effort 或 parser 列表当成永久事实。模型和服务端会快速迭代，部署时应重新核对目标版本的官方文档。

本文没有把模型输出的 reasoning 文本当作真实、完整或安全的内部思维记录。对于需要审计的系统，应保存可验证的工具结果、结构化中间产物、评测结果和最终决策依据。
