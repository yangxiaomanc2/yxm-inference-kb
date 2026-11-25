# 大模型推理优化知识库

在线地址：**https://yangxiaomanc2.github.io/yxm-inference-kb/**

以官方技术报告和仓库源码为依据，做源码级的推理优化分析。每一句都写清来源：
哪句来自官方报告，哪句来自源码第几行，哪句只是推断；不确定就写不确定。

## 内容

| 页面 | 内容 |
| --- | --- |
| [知识库主页](./index.html) | 知识页卡片列表，内容存 Supabase，打开即读最新版 |
| [DeepSeek-V4.1-Flash 及 Flash 模型关键优化点](./article.html?p=flash) | CED、CSA2、分层稀疏索引、FP4 KV；890 字节/token 的逐项推导；横向对比 MiMo / Qwen / GLM / Step |
| [DeepInfer 框架与创新点](./article.html?p=deepinfer) | DeepSeek 生产推理引擎源码剖析：零开销异步调度、KV 数据模型、DSpark 投机解码、确定性推理 |
| [DeepSeek Harness 框架与创新点](./article.html?p=harness) | “一切皆插件”的 Agent 运行时：Cordis 架构、agent loop、工具流水线与权限边界 |
| [OpenRSI 框架与创新点](./article.html?p=openrsi) | AI4AI / 递归自我改进：搜索—经验—训练闭环、Frontis-MA1 的奖励设计 |
| [推理优化知识概览](./推理优化知识概览/) | 学习地图：从并行策略到 kernel 开发，带前置依赖、动手练习与官方资料入口 |
| [当前大模型Thinking模式与实现](./当前大模型Thinking模式与实现/) | Thinking/Reasoning 模式、厂商接口、推理训练、vLLM/SGLang 服务端实现与评测方法 |

## 关于内容形态

知识页正文以 markdown 存在 Supabase，页面打开时读取并在浏览器端渲染，
点「编辑」可直接改、改完实时同步到所有打开的设备；每页都有「导出」按钮可下载 markdown。

表里的内容任何人都能读写，所以只放公开信息。文中标注「工程推断」的段落为作者推断，
其余内容来自官方技术报告、仓库源码或公开资料，参考资料附在每页文末。

源码引用以写作时（2026-11）各仓库默认分支为准，后续版本可能变化。
