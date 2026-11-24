/* 内容与界面分离；每个单元包含：学习目标、知识细目、关键边界、实践和验收。 */
window.CURRICULUM = {
  modules: [
    {
      id: "M00", title: "数学、数值与编程基础", en: "FOUNDATIONS", tag: "基础", prereq: "无；掌握 Python，逐步补齐 C/C++",
      description: "建立能手算、能解释、能实现参考算子的最小基础。",
      topics: [
        {id:"math", title:"矩阵、张量与计算量", tags:["基础"], goal:"看到计算图就能推 shape、参数量、FLOPs 和数据流。",
          learn:["矩阵乘法 [M,K]×[K,N]：常见 FLOPs 口径为 2MKN；区分 MAC 与 FLOP，说明乘加是否计两次。","内积、范数、转置、broadcast、stride、contiguous；view 与真实数据搬运。","SVD、低秩近似与矩阵分解的几何直觉；理解压缩 rank 与误差。","用 einsum 和 PyTorch 构造 attention/FFN 参考实现，并标注张量生命周期。"],
          pitfalls:["FLOPs 相同不等于延迟相同；布局、形状、数据复用和硬件利用率决定可达性能。"],
          exercise:"手算 [128,4096]×[4096,11008] 的 FLOPs、输入输出字节数与理想算术强度，再用脚本核对。", acceptance:"能解释每个维度与字节项；不把参数容量等同于一次前向的总访存。"},
        {id:"probability", title:"概率、采样与质量指标", tags:["基础"], goal:"理解生成过程和质量评估，使性能优化受质量约束。",
          learn:["Softmax 的减最大值稳定化；log-sum-exp、交叉熵、NLL、PPL 及其统计口径。","temperature、top-k、top-p、随机种子与采样重现性；logits processor 和约束解码。","熵与 KL 散度：解释分布变化，但不将 logit 误差直接等同于任务质量损失。","teacher-forcing 与自回归评估的差异；代码、推理、长上下文、多语言质量回归。"],
          pitfalls:["PPL 改善不保证所有任务改善；不同 tokenizer 的 PPL 不宜直接比较。"],
          exercise:"实现稳定 Softmax 和 top-p 采样，比较温度变化对熵及输出的影响。", acceptance:"能解释量化前后局部误差如何影响后续生成，并设计任务级检验。"},
        {id:"formats", title:"浮点、整数与误差传播", tags:["基础","量化"], goal:"用位宽、范围、误差和硬件支持共同描述数值格式。",
          learn:["FP32/TF32/FP16/BF16、FP8 E4M3/E5M2、INT8/INT4；认识 FP4、微缩放与块浮点。","指数位与尾数位、normal/subnormal、舍入、溢出、饱和、下溢和累加精度。","绝对/相对误差、消减、归约顺序；FP32 accumulation 的收益与代价。","对称/非对称量化：q=clip(round(x/s)+z)，重构 x̂=s(q−z)；scale 与 zero-point 的存储。"],
          pitfalls:["同为 8 bit 的 FP8 与 INT8 不等价；某种格式可存储，不代表目标设备原生支持其计算。"],
          exercise:"绘制几种格式在不同数量级的量化步长，测试大值、近零值与离群值。", acceptance:"能为权重、激活、KV 与累加分别选择精度，并说明失败机制。"},
        {id:"engineering", title:"工程工具与实验复现", tags:["基础"], goal:"具备阅读引擎源码和编写可复现实验的基本工程能力。",
          learn:["Python/PyTorch、C++ 基础、CUDA 或目标芯片语言基础；内存所有权、异步执行和线程安全。","Linux、进程、NUMA、容器、驱动与运行时；包管理、构建链、Git 与性能 PR。","固定模型/数据 revision、随机种子、依赖版本、设备频率、功耗、温度与采样方法。","测试层次：算子参考对照 → 模型一致性 → 任务质量 → 服务负载回归。"],
          pitfalls:["异步设备计时必须用事件或同步；容器镜像相同不代表主机驱动与固件相同。"],
          exercise:"建立一个可复现 benchmark 模板，输出环境清单、原始结果与统计脚本。", acceptance:"另一位工程师可按说明复现结论，允许硬件差异但能解释偏差。"}
      ]
    },
    {
      id:"M01", title:"模型结构与生成计算图", en:"MODEL ARCHITECTURE", tag:"基础", prereq:"M00 数学与 PyTorch",
      description:"把架构名词转换成参数、形状、状态以及执行模式。",
      topics:[
        {id:"decoder",title:"Decoder 全链路与参数推导",tags:["基础"],goal:"能从配置文件独立重建主要推理计算图。",
          learn:["Tokenizer → Embedding → Norm → QKV/RoPE → Attention → Output projection → FFN → LM Head；残差与 pre/post norm。","定义 B、S、D、Hq、Hkv、dh、Dff、L；推导 Q/K/V、logits 与输出 shape。","标准非门控 FFN 约 2DDff 参数；SwiGLU 等门控 FFN 约 3DDff，另计 bias/Norm。","Embedding 与 LM Head 是否共享；词表大时 logits、采样与输出通信可能显著。"],
          pitfalls:["常用 2P/token 只近似 dense 线性层；不能完整覆盖 attention、稀疏激活与通信。"],
          exercise:"选择一个公开 7B/8B 级模型，逐层计算参数并对照 checkpoint。",acceptance:"总数与配置一致，能解释 bias、权重共享、KV 头数带来的差别。"},
        {id:"attention-families",title:"MHA / MQA / GQA / MLA",tags:["基础","KV Cache"],goal:"用缓存结构和计算方式理解 Attention 演进。",
          learn:["MHA 每个 query 头对应独立 KV；MQA 共享一组 KV；GQA 在若干 query 头间共享。","GQA 改变 K/V 投影及缓存容量；核函数是否重复加载共享 KV 决定实际带宽收益。","MLA 缓存低秩联合 latent，并对 RoPE 部分进行解耦；学习投影吸收与重构两类执行思路。","画出每 token、每层的 KV 布局；用模型真实 latent 维度计算 MLA 缓存。"],
          pitfalls:["MLA 不是 GQA 的简单替代参数；压缩节省随模型配置、缓存布局和后端实现而变。"],
          exercise:"比较固定层数下 MHA、GQA、MLA 的每 token 状态字节和可能的额外计算。",acceptance:"能解释为什么 KV 变小并不自动保证 Attention 端到端更快。"},
        {id:"position",title:"RoPE、位置与长上下文",tags:["基础","KV Cache"],goal:"理解位置编码对缓存复用和扩展的约束。",
          learn:["RoPE 旋转的相对位置性质、旋转维度与频率；K 在缓存前后的处理位置。","位置插值、NTK-aware scaling、YaRN 等扩展方法：能力与分布外风险。","滑动窗口、局部/全局混合层、attention sink 与位置偏移的关系。","多轮追加、prefix 复用、左 padding、截断与位置 ID 的一致性。"],
          pitfalls:["把任意片段缓存拼接起来通常不等于精确复用；位置与可见上下文可能已改变。"],
          exercise:"测试增量解码与完整重算在不同 padding、位置偏移下的一致性。",acceptance:"定位一种位置不匹配导致的错误，并说明如何纳入缓存 key 或拒绝复用。"},
        {id:"moe-model",title:"Dense、MoE 与多模态扩展",tags:["基础","前沿"],goal:"区分模型总参数、激活参数、计算量与常驻容量。",
          learn:["Dense FFN 与 MoE router、top-k experts、共享专家、专家容量和 token dispatch/combine。","MoE 总参数决定存储需求，激活专家决定部分计算；专家访问分布影响权重读取。","视觉/音频编码器、patch/token expansion、cross-attention 与 encoder-decoder KV。","LoRA、多适配器服务与权重切换；不同适配器对前缀缓存身份的影响。"],
          pitfalls:["只按激活参数估算 MoE 显存会严重低估；多模态请求的 token 和编码成本不可忽略。"],
          exercise:"为一个 Dense 和一个 MoE 模型建立容量与激活计算对照表。",acceptance:"能指出多模态和多 LoRA 场景中不能直接沿用纯文本估算的部分。"}
      ]
    },
    {
      id:"M02",title:"硬件与性能建模",en:"HARDWARE & ROOFLINE",tag:"基础",prereq:"M00–M01；矩阵计算与 Decoder",
      description:"先预测瓶颈，再用硬件计数器解释理论与实测之间的差距。",
      topics:[
        {id:"hardware",title:"GPU / NPU 存储与执行层次",tags:["基础","算子"],goal:"理解每一级存储、并行和搬运的性能约束。",
          learn:["HBM、L2、shared memory/SRAM、寄存器；缓存行、合并访存、bank conflict、对齐。","SM/warp、SIMT、Tensor Core/MMA；NPU 矩阵单元、向量单元、片上 buffer 与数据搬运。","线程块与占用率，寄存器/共享内存配额，计算与访存流水重叠。","PCIe、NVLink、HCCS/目标设备互联与 RDMA；NUMA、拓扑、P2P 和主机带宽。"],
          pitfalls:["不能把 CUDA 的执行模型逐字套到昇腾或昆仑芯；先核对目标设备编程模型。"],
          exercise:"绘制目标设备数据路径，测量 HBM、P2P、主机到设备三类带宽。",acceptance:"能为每次拷贝或同步指出经过的硬件路径与潜在争用。"},
        {id:"roofline",title:"Roofline、算术强度与下界",tags:["基础"],goal:"建立 FLOPs、bytes、峰值与可达性能的统一模型。",
          learn:["AI=FLOPs/bytes；可达吞吐 ≤ min(Cpeak, BW×AI)，ridge point=Cpeak/BW。","分别构造 kernel 级、阶段级与服务级模型；定义测量的字节来自哪个存储层。","峰值、有效算力与不同 dtype/形状的可达值；持续带宽而非只看宣传规格。","延迟下界 t≥max(F/C,bytes/BW)；再加入 launch、同步、通信、依赖链与重叠。"],
          pitfalls:["Roofline 是上限/下界模型，不包含全部延迟；带宽和算力不能无条件同时达到峰值。"],
          exercise:"对 GEMM、RMSNorm、Decode Attention 画三个测量点并定位限制。",acceptance:"能说明为什么同一个算子换 batch 或形状后会跨越瓶颈边界。"},
        {id:"phase-model",title:"Prefill / Decode 的分阶段模型",tags:["基础","KV Cache"],goal:"摆脱“Prefill 永远算力受限，Decode 永远带宽受限”的二分误区。",
          learn:["Prefill 投影/FFN 随 S 线性，标准全注意力含 S² 项；prefix 命中后只处理增量但仍需访问历史 KV。","Decode 单步读取权重与历史 KV，batch 增大可摊薄权重；长上下文时 attention 占比上升。","B、输入/输出长度、Hkv、量化、MoE 路由、并行度对瓶颈的联合影响。","峰值显存=权重+KV+临时激活/工作区+图池/通信缓冲+框架与分配器预留。"],
          pitfalls:["权重读取一次是理想复用假设；实际 kernel、L2 和权重分片会改变字节流量。"],
          exercise:"手算三种负载：长输入短输出、短输入长输出、长输入长输出，并预测最优策略。",acceptance:"预测与实测不符时能拆成 bytes、利用率、通信或调度四类原因。"},
        {id:"profiling",title:"Profiling 与性能归因",tags:["算子","系统"],goal:"沿着请求时间线定位真正限制端到端收益的部分。",
          learn:["CPU/Python 时间、排队、H2D、kernel launch、设备执行、collective 与 idle bubble。","PyTorch Profiler、Nsight Systems/Compute；昇腾 msprof 与目标平台 profiling 工具。","kernel duration、有效带宽、occupancy、stall、算力利用率；读 timeline 而不是只读汇总表。","Amdahl 定律、warmup、同步计时、置信区间、功耗/频率与热稳定性。"],
          pitfalls:["profiler 本身会扰动短 kernel；GPU utilization 高不代表有用工作比例高。"],
          exercise:"为一次慢请求绘制关键路径，选择一个优化并给出 Amdahl 预期上限。",acceptance:"能解释 kernel 提速 2× 为何只带来很小的服务收益。"}
      ]
    },
    {
      id:"M03",title:"KV Cache：布局与生命周期",en:"KV CACHE · CORE",tag:"KV Cache",prereq:"M01 Attention；M02 容量与带宽",
      description:"第一条核心主线：把 KV 看成有所有权、有位置、有生命周期的状态。",
      topics:[
        {id:"kv-budget",title:"容量公式、布局与带宽预算",tags:["KV Cache"],goal:"精确描述目标模型 KV 的容量与单步访问量。",
          learn:["常规等长 GQA：2LBTHkv dh b；变长序列使用 2L Hkv dh b ΣTi。","block-major、layer-major、K/V 分离与向量化布局；读写模式、对齐与分页粒度。","MLA 缓存按 compressed latent + positional key 逐项计算；混合层逐层求和。","每卡容量需考虑 TP/PP 分片或复制、allocator、padding、量化 scale 与对齐。"],
          pitfalls:["缓存容量不等于每步实际 HBM 读取量；GQA 的共享复用和 kernel 布局会改变读放大。"],
          exercise:"为 32 层、B=16、T=8192、Hkv=8、dh=128、BF16 手算 KV=16 GiB。",acceptance:"能复算一条请求和整个批次的字节数，并说明为何与引擎分配略有差异。"},
        {id:"paging",title:"PagedAttention 与块管理",tags:["KV Cache","系统"],goal:"实现分页缓存分配、映射、共享与回收。",
          learn:["逻辑 token → logical block → physical block；block table 的查表与非连续 attention。","按需分配降低过度预留，末块内部碎片与块大小的取舍。","引用计数、copy-on-write、fork/beam、多序列共享、free list 与回收时机。","抢占、重算或 offload 策略；块不足时的 admission control 与 backpressure。"],
          pitfalls:["分页主要解决分配/碎片与共享，不会自动减少每 token 的 KV 数值容量。"],
          exercise:"用 CPU 实现分页分配器，模拟追加、取消、共享前缀、COW 与重用。",acceptance:"随机事件序列中无重复分配、悬挂引用、越界或过早回收；报告内部碎片。"},
        {id:"prefix",title:"前缀复用、Radix 与缓存身份",tags:["KV Cache","系统"],goal:"让跨请求 KV 复用保持语义正确，并量化收益。",
          learn:["token 级精确前缀、block hash、radix tree、最长公共前缀查找与淘汰。","缓存 key 纳入模型 revision、token 序列、位置/RoPE、LoRA、模态输入与必要执行属性。","请求命中率、token 加权命中率、节省 prefill 计算量与查表/内存代价。","租户隔离、缓存投毒/侧信道边界、访问控制；区分精确复用与近似语义缓存。"],
          pitfalls:["提示词字符串相同仍可能因模板、tokenization 或模态内容不同而无法复用。"],
          exercise:"构造共享系统提示与多轮会话流量，对比 prefix 开关的 TTFT 和实际命中 token。",acceptance:"有跨租户隔离与不匹配身份测试；不把请求命中率当成计算节省比例。"},
        {id:"kv-lifecycle",title:"状态一致性与故障恢复",tags:["KV Cache","系统"],goal:"能在取消、迁移和并行执行中维护状态正确性。",
          learn:["请求到序列再到块的所有权；异步 kernel、传输完成事件和安全释放。","speculative rollback、beam 分叉、滑窗截断与缓存指针推进。","PD 交接时的模型、dtype、布局、block size、位置与版本兼容。","断连、超时、重试、幂等、块租约与泄漏检测；Decode 仍有状态。"],
          pitfalls:["传输发起不代表消费者可读；请求结束也不代表所有异步使用已结束。"],
          exercise:"对模拟 cache manager 注入取消、传输失败、重复完成通知。",acceptance:"在故障下保证无 use-after-free、无越权读、资源最终可回收。"}
      ]
    },
    {
      id:"M04",title:"KV Cache：压缩、分层与调度",en:"KV CACHE · ADVANCED",tag:"KV Cache",prereq:"M03 生命周期；M05 量化基础可并行",
      description:"从减少状态，到减少移动，再到让缓存参与集群决策。",
      topics:[
        {id:"kv-quant",title:"KV 量化与低比特缓存",tags:["KV Cache","量化"],goal:"以质量和解量化成本约束状态压缩。",
          learn:["K 与 V 的分布差异；per-token/per-channel/per-head/per-block scale 的选择。","FP8 与低比特 INT KV；KIVI 的非对称思路、residual 高精度窗口与 scale 元数据。","K 误差影响 QK logits，V 误差影响加权输出；量化误差会经后续生成改变状态。","量化/解量化融合、layout、outlier、校准与不同 attention backend 的适配。"],
          pitfalls:["KV 减半不代表延迟减半；收益可能体现为容纳更大 batch，且低比特质量不能预先保证。"],
          exercise:"在相同请求集上比较 BF16 与一种支持的 KV 量化，分短/长上下文评估。",acceptance:"报告净容量（含 scales）、TTFT/TPOT、goodput、长上下文质量与失效样例。"},
        {id:"kv-sparse",title:"淘汰、稀疏与检索式 Attention",tags:["KV Cache","前沿"],goal:"区分精确缓存管理和改变 Attention 语义的近似方法。",
          learn:["滑窗、attention sink、heavy-hitter、recent+important、token/head/layer 自适应保留。","H2O、StreamingLLM、SnapKV 等代表思路；选择发生在 prefill 还是 decode。","query-aware 检索与跨层复用；索引构建、召回、重排和 fallback 的开销。","区分模型原生稀疏、结构性窗口与运行时近似裁剪；对长程依赖、代码和推理任务做回归。"],
          pitfalls:["高平均 attention 分数不保证未来重要；needle 任务通过也不等于真实任务无退化。"],
          exercise:"在固定 KV 预算下比较全量、recent window 与一个重要性策略。",acceptance:"给出质量—容量—延迟 Pareto 曲线，明确哪些方法不再精确等价。"},
        {id:"kv-tier",title:"HBM → DRAM → SSD 分层",tags:["KV Cache","系统"],goal:"用数据移动模型判断 offload 是否值得。",
          learn:["驻留、卸载、预取、回迁、pinning、异步拷贝、双缓冲和计算重叠。","前缀持久化与活跃 decode KV 的访问频率差异；热度、复用距离、cache admission。","CPU 内存、远程内存、SSD 的容量/带宽/延迟/成本；序列化与布局转换。","LMCache、Mooncake 等方案作为工程阅读对象；核对其与引擎 connector 的版本兼容。"],
          pitfalls:["SSD 容量便宜不能推导活跃 attention 直接读 SSD 高效；突发回迁可能破坏尾延迟。"],
          exercise:"建立 transfer_bytes/effective_BW + fixed_latency 模型，模拟热前缀与冷前缀。",acceptance:"指出哪些复用概率和网络条件下收益为正；提供无复用流量的反例。"},
        {id:"kv-routing",title:"Cache-aware routing 与全局缓存",tags:["KV Cache","系统"],goal:"联合优化缓存局部性与实例负载，而不是只追命中率。",
          learn:["会话 affinity、前缀路由、consistent/rendezvous hashing、全局缓存目录与元数据成本。","排队时间、预估剩余工作、缓存命中节省与迁移成本的路由评分。","副本复制、热点前缀、过期、一致性、容灾与多租户公平。","把状态位置纳入 PD、弹性扩缩容和异构放置；对缓存占用做成本归因。"],
          pitfalls:["全部命中同一实例会造成热点；最高命中率方案未必有最高 SLO goodput。"],
          exercise:"在 Zipf 前缀分布上比较轮询、最短队列和缓存感知路由。",acceptance:"同时报告 token 命中、排队尾延迟、迁移字节和 SLO 内吞吐。"}
      ]
    },
    {
      id:"M05",title:"量化：算法到服务收益",en:"QUANTIZATION",tag:"量化",prereq:"M00 数值；M01 结构；M02 性能模型",
      description:"第二条核心主线：数值方案、布局和内核必须共同成立。",
      topics:[
        {id:"quant-basics",title:"量化设计空间与校准",tags:["量化"],goal:"独立设计精度、粒度和校准方案。",
          learn:["PTQ 与 QAT；weight-only、W8A8、W4A16、FP8、KV quant 分别针对哪些资源。","per-tensor/channel/group/token/block；对称/非对称，静态/动态 scale。","min-max、percentile、MSE、clipping、outlier smoothing、旋转变换的动机。","校准集覆盖业务分布、长度、多语言与模态；训练/校准/评测分离防止过拟合。"],
          pitfalls:["更小的 group 降低误差但增加 scale、寻址和解量化开销；压缩比要算元数据。"],
          exercise:"实现 group-wise INT4 伪量化并打包两个 nibble，测试非整组尾部。",acceptance:"验证饱和、零值、极端值、非整齐维度与 pack/unpack 一致性。"},
        {id:"quant-methods",title:"GPTQ / AWQ / SmoothQuant",tags:["量化"],goal:"理解代表性算法在优化什么误差，而不是只会调用工具。",
          learn:["GPTQ：借助二阶信息近似对权重量化误差做逐步补偿；理解校准激活的作用。","AWQ：利用激活统计识别重要权重通道，通过缩放改善低比特权重量化。","SmoothQuant：将激活 outlier 的量化难度通过等价缩放迁移到权重。","旋转类方案与 GPTQ/AWQ 的差异；混合精度、敏感层保留和逐层误差定位。"],
          pitfalls:["相同 W4 checkpoint 在不同 kernel/layout 下表现不同；算法名不代表硬件执行路径。"],
          exercise:"选两种 PTQ 方案，在相同校准/评测集比较层误差和端到端质量。",acceptance:"能解释结果差异，并把算法效果与 kernel 性能效果分开归因。"},
        {id:"quant-kernel",title:"INT4、FP8 与融合 GEMM",tags:["量化","算子"],goal:"理解压缩格式如何真正变为更少的执行时间。",
          learn:["INT4 packing、group scale、zero-point、预排布、在线解量化与 Tensor Core tile。","W4A16 常通过读压缩权重并融合解量化降低权重带宽；小 M 与大 M 的最优实现可能不同。","FP8 的 E4M3/E5M2、动态缩放与 amax；微缩放/FP4 的块元数据和设备特性。","dequant+GEMM 融合、epilogue、重排成本、activation quant、accumulation 与溢出。"],
          pitfalls:["量化使内存更小但可能更慢：解量化、低 occupancy、形状不适配或缺少原生指令。"],
          exercise:"对同一矩阵形状比较 BF16、weight-only 和原生低精度路径；扫 M/N/K。",acceptance:"给出何时带宽节省覆盖额外计算，以及格式/硬件不支持时的 fallback。"},
        {id:"quant-eval",title:"量化质量门禁与发布",tags:["量化","系统"],goal:"把量化当成受质量 SLO 约束的产品变更。",
          learn:["分层参考：浮点 → fake quant → 实际 kernel → 引擎 → 服务；逐层排查差异。","PPL、任务正确率、代码 pass@k、推理、多语言、长上下文、工具调用与多轮。","固定负载同时测质量、SLO goodput、峰值显存、每百万 token 成本。","灰度、漂移监测、敏感层回退、回滚与版本化；避免只选有利样例。"],
          pitfalls:["贪心解码输出不同不能直接证明实现错误，也不能以“随机性”掩盖数值错误。"],
          exercise:"写一份量化发布报告，包含量化配置、校准数据摘要和预先声明的退化阈值。",acceptance:"即使吞吐提升，只要关键质量门禁不通过也能给出拒绝发布的结论。"}
      ]
    },
    {
      id:"M06",title:"算子开发与 Attention 内核",en:"KERNEL ENGINEERING",tag:"算子",prereq:"M00 编程；M02 硬件；M01 计算图",
      description:"第三条核心主线：先写正确，再设计数据复用和并行。",
      topics:[
        {id:"kernel-toolchain",title:"CUDA / Triton / 国产芯片路径",tags:["算子"],goal:"能选择目标平台上最合适的开发与调试工具。",
          learn:["Triton 的 program、block、mask、向量化、JIT 与 autotune；与 CUDA 线程模型的区别。","CUDA warp、shared memory、MMA；Ascend C 的流水/队列/buffer 与目标昆仑芯 SDK。","Triton 常见 GPU lowering：TTIR → TTGIR → LLVM → 设备代码；国产后端可能采用不同路径。","阅读后端支持矩阵，确认 dtype、atomic、异步拷贝、矩阵指令、调试与 CI 覆盖。"],
          pitfalls:["Triton 编程语言与 NVIDIA Triton Inference Server 是不同产品；移植不等于零调优。"],
          exercise:"实现向量加、RMSNorm 和一个带 tail mask 的 reduction，并对照 PyTorch。",acceptance:"覆盖非连续输入、非整齐长度、dtype 与极值；说明约束或拒绝不支持的输入。"},
        {id:"gemm",title:"GEMM、归约与融合",tags:["算子"],goal:"能从访存复用、并行度和资源占用解释 kernel 性能。",
          learn:["GEMM tiling、分块复用、pipeline、double buffer、异步加载和矩阵指令布局。","小 M GEMV/GEMM、split-K、grouped GEMM、persistent kernel 与负载均衡。","RMSNorm、Softmax、RoPE、SwiGLU、采样等的融合机会；减少中间访存与 launch。","融合代价：寄存器溢出、shared memory 竞争、occupancy 降低、编译时间和适用形状收窄。"],
          pitfalls:["benchmark 上最优 tile 不一定适合动态服务；autotune 搜索与冷启动也有成本。"],
          exercise:"为 RMSNorm+残差或 dequant+GEMM 做一个融合版本，绘制形状性能面。",acceptance:"对有利和不利形状均报告；解释带宽、寄存器、占用率如何变化。"},
        {id:"flashattention",title:"FlashAttention 与在线 Softmax",tags:["算子","KV Cache"],goal:"理解精确 Attention 如何通过 IO 感知获得加速。",
          learn:["QKᵀ、scale、causal mask、Softmax、PV；避免显式物化 S×S score 矩阵。","在线 Softmax 维护 running max、归一化和与输出累积；分块合并时重缩放。","FlashAttention 家族的分块、并行、异步流水思路；版本能力需按硬件核对。","causal、GQA、varlen、head dimension、低精度和数值容差；prefill kernel 的并行划分。"],
          pitfalls:["FlashAttention 通常仍做精确全注意力，降低 IO/中间存储不等于把 FLOPs 变线性。"],
          exercise:"实现小规模分块 online-softmax attention，与 FP32 参考对照。",acceptance:"覆盖大 logits、长序列、全遮罩策略、变长和非整块，解释数值容差来源。"},
        {id:"decode-kernel",title:"Paged Decode、Split-KV 与 MLA",tags:["算子","KV Cache"],goal:"针对低并行度、长上下文和分页访存优化解码。",
          learn:["block table 查表、GQA KV 复用、warp/CTA 映射与不连续加载。","split-KV/Flash-Decoding：沿上下文增加并行，合并 partial Softmax 与 partial output。","MLA latent attention、投影吸收、缓存布局与额外计算的平衡。","KV 量化融合、短/长序列分桶、ragged batch、prefix/chunk 混合调度与 backend dispatch。"],
          pitfalls:["split 过多会增加中间结果和合并开销；长上下文的最优策略不适合所有短请求。"],
          exercise:"实现或改造一个 decode kernel，扫 B、T、Hkv、dh、block size。",acceptance:"能用性能曲线选择 dispatch 边界，并通过分页边界和量化正确性测试。"}
      ]
    },
    {
      id:"M07",title:"编译、图捕获与执行",en:"COMPILATION & RUNTIME",tag:"算子",prereq:"M06 基础算子；PyTorch 执行模型",
      description:"建立手写 kernel、编译生成与运行时调度之间的判断力。",
      topics:[
        {id:"torch-compile",title:"torch.compile 与图编译",tags:["算子"],goal:"理解编译链，以及性能收益为何会失效。",
          learn:["Dynamo 捕获 Python/张量执行、FX 图、guards 与 graph break；理解 shape specialization。","Inductor 融合、调度与代码生成；生成 Triton/外部库调用等路径依平台而定。","动态 shape、symbolic shape、recompile、编译缓存、冷启动与运行时开销。","图级优化与手写 kernel 的边界；用日志/图分析定位 break 和低效 lowering。"],
          pitfalls:["torch.compile 不保证所有算子生成 Triton，也不保证所有动态 shape 一次编译。"],
          exercise:"对一个 Decoder 子图比较 eager、compile 的冷/热耗时与 graph breaks。",acceptance:"说明输入变化如何触发重新编译，给出减少无效 specialization 的办法。"},
        {id:"graph-replay",title:"CUDA Graph、分桶与 Piecewise",tags:["算子","系统"],goal:"在受约束的动态服务里降低 CPU launch 开销。",
          learn:["capture/replay、静态地址、预分配 buffer、形状约束和图池内存。","batch size bucket、padding、piecewise graph，将动态/不支持部分留在图外。","attention 元数据、KV block table 与 replay 前更新；异步拷贝及 stream 约束。","目标 NPU 的图执行机制需独立核对；图捕获与编译不是同一层优化。"],
          pitfalls:["不能普遍“丢弃 guards”；必须证明形状、地址、控制流与状态更新约束成立。"],
          exercise:"测量小 batch Decode 的 eager/graph replay，计入 padding 与额外图池显存。",acceptance:"覆盖请求取消、batch 变化与块表更新；收益包含服务端 CPU 时间。"},
        {id:"runtime-memory",title:"内存规划、工作区与异步执行",tags:["算子","系统"],goal:"理解缓存之外的峰值显存和运行时依赖。",
          learn:["张量存活区间、buffer reuse、in-place、workspace 与峰值内存；缓存分配器 reserved/allocated 的区别。","图池、通信 buffer、量化重排副本、临时 logits 与采样工作区；内存快照和泄漏排查。","stream/event、异步拷贝、计算通信重叠；通过依赖关系保证 buffer 不被过早复用。","CPU/GPU offload、权重流式加载与统一内存的带宽约束；低显存/边缘部署需要不同成本模型。"],
          pitfalls:["nvidia-smi 或设备工具的进程占用不等于活跃张量总量；异步任务结束前不能按 Python 引用消失就释放资源。"],
          exercise:"绘制一次 prefill/decode 的内存时间线，分别测 allocated、reserved、工作区和图池。",acceptance:"解释峰值来源，识别一种内存复用机会，并用同步依赖证明不会覆盖活跃数据。"},
        {id:"dispatch",title:"内核选择、自动调优与可移植性",tags:["算子","系统"],goal:"让优化在真实形状分布上稳定生效。",
          learn:["按设备、dtype、head size、batch、sequence length、量化格式选择 backend。","离线 autotune、在线 tuning、调优缓存 key、回退路径与版本失效。","Triton/厂商库/手写 kernel 的维护成本、编译时间、稳定性和性能比较。","shape 覆盖、性能回归阈值、兼容性 CI、设备测试矩阵与 PR 文档。"],
          pitfalls:["不应把单一热门形状上的收益推广到整个模型或所有国产芯片。"],
          exercise:"建立小型 dispatch 表，让两个 kernel 在不同形状区间发挥优势。",acceptance:"在保留集形状上验证策略，保证 fallback 的正确性并记录调优环境。"}
      ]
    },
    {
      id:"M08",title:"引擎、调度与解码策略",en:"SERVING ENGINE",tag:"系统",prereq:"M03 块管理；M02 阶段性能",
      description:"理解引擎如何把请求组织成设备工作，以及调度如何改变延迟。",
      topics:[
        {id:"engine",title:"vLLM / SGLang 源码主线",tags:["系统","KV Cache"],goal:"沿一条请求走完调度、分配、执行和输出。",
          learn:["请求入口、tokenization、Scheduler、KV manager、Model Runner、Worker、sampler 与流式输出。","continuous batching：每个迭代增删请求；资源预算与 token budget。","SGLang 的 radix/prefix 组织与执行；TensorRT-LLM 的编译/运行时取舍。","使用稳定版本或 commit 阅读；模块名称和职责会演进，不依赖过时类名。"],
          pitfalls:["框架名不能直接说明哪个更快；模型覆盖、后端和负载差异决定结果。"],
          exercise:"画出一次请求从接收到完成的时序图，标注每次 KV 分配、排队与输出。",acceptance:"能在源码中定位一次抢占、一次前缀命中和一次 batch 更新。"},
        {id:"scheduling",title:"Continuous batching 与 Chunked Prefill",tags:["系统"],goal:"在延迟、吞吐、公平和缓存容量之间做调度取舍。",
          learn:["static/dynamic/continuous batching；max sequences、token budget 与并发上限。","chunked prefill 通过分块减少长 prefill 对 decode 的干扰，但增加调度/分块成本。","FCFS、优先级、短任务偏好、deadline、starvation、fairness 与多租户配额。","KV 预估、admission、preemption、重算与 backpressure；输出长度未知的风险。"],
          pitfalls:["增大 batch 可能提高吞吐却破坏 TPOT；短平均长度不能代表长尾容量需求。"],
          exercise:"在混合长短请求下扫描 chunk/token budget，比较 TTFT 与 ITL 尾延迟。",acceptance:"给出满足同一 SLO 的最优区间，并报告抢占率、失败率和队列长度。"},
        {id:"speculation",title:"Speculative Decoding 与多 Token 预测",tags:["系统","前沿"],goal:"理解用额外工作换串行步数的条件。",
          learn:["draft/verify、接受率、验证成本、draft 长度、batch 变化与 KV 回滚。","精确 rejection sampling 的目标分布约束；贪心一致性与采样一致性要分别验证。","小模型 draft、自推测、层跳过、树状候选与 MTP 等预测思路。","低 batch/低利用率下的机会，以及高 batch、低接受率和跨设备 draft 的反效果。"],
          pitfalls:["接受率高不自动代表提速；draft 时间、验证并行效率与额外显存都需要计入。"],
          exercise:"扫描 draft 长度，建立 accepted tokens / 总时间 模型并与实测比较。",acceptance:"报告收益失效的 batch、任务与长度区间；说明是否保持目标分布。"},
        {id:"serving-features",title:"结构化输出、多 LoRA 与 CPU 路径",tags:["系统"],goal:"识别模型外和运行时扩展中的隐藏瓶颈。",
          learn:["grammar/FSM constrained decoding、token mask、JSON schema 与 CPU/GPU mask 开销。","多 LoRA grouped GEMM、adapter 加载/淘汰、隔离和缓存身份。","tokenization、detokenization、流式协议、日志、序列化与 Python GIL。","异步服务、进程划分、pinned memory、CPU 绑定与设备利用率之间的关联。"],
          pitfalls:["GPU kernel 很快时，文本处理和约束解码可能成为主瓶颈；不要只量 model forward。"],
          exercise:"把小请求模型时间与端到端时间分开测，加入结构化输出和多个 LoRA。",acceptance:"能区分 tokenizer、网络、排队、CPU mask 与设备计算的贡献。"}
      ]
    },
    {
      id:"M09",title:"分布式与集群控制平面",en:"DISTRIBUTED INFERENCE",tag:"系统",prereq:"M02 互联；M08 引擎；M04 状态管理",
      description:"把计算切分、通信与状态放置放进同一个成本模型。",
      topics:[
        {id:"parallel",title:"TP / PP / DP / CP 的适配",tags:["系统"],goal:"根据容量、流量与网络选择并行方式。",
          learn:["TP 切权重/激活并引入 collective；PP 切层并产生流水 bubble；DP 复制模型服务不同请求。","CP/sequence/context 分片服务长上下文，区分具体 attention 算法及推理阶段。","拓扑感知分组、组内/组间带宽、AllReduce/AllGather/ReduceScatter。","MLA latent 常在 head-TP 组内复制；其他分片方案需单独考虑通信与实现。"],
          pitfalls:["TP 更大可能降低单请求延迟，却降低每卡吞吐；不同并行方案需在同一 SLO 下比较。"],
          exercise:"给定模型容量、设备数与网络测量，比较 TP×DP 与 TP×PP 的可行配置。",acceptance:"逐项给出每卡权重/KV、通信字节、关键路径与容量约束。"},
        {id:"expert-parallel",title:"EP、All-to-All 与专家负载",tags:["系统","前沿"],goal:"分析 MoE 推理中的计算、通信和负载不平衡。",
          learn:["expert parallel 的 token dispatch/combine，All-to-All 数据路径和 grouped GEMM。","专家放置、副本、热专家、routing skew、容量 padding 与尾部 straggler。","DP Attention + EP MoE 的适用条件；跨节点通信、拓扑和共享专家的影响。","计算通信重叠、dispatch 低延迟内核、专家负载均衡与量化通信。"],
          pitfalls:["训练中的 token dropping/路由修改不能无条件搬到推理；可能影响输出质量。"],
          exercise:"固定 token 数改变专家分布熵，观察专家队列、通信和尾延迟。",acceptance:"区分 router 计算、dispatch、GEMM 与 combine 四段，并说明热点策略代价。"},
        {id:"pd",title:"Prefill–Decode 分离",tags:["系统","KV Cache"],goal:"判断隔离与独立扩缩容的收益能否覆盖传输成本。",
          learn:["混部干扰、阶段独立 SLO、不同并行配置/硬件池与资源配比。","KV producer/consumer、connector、逐层传输与 overlap；首 token/采样状态交接。","传输时间下界=KV 字节/有效链路带宽+固定开销；拓扑、拥塞与格式转换。","prefill/decode 队列、失败重试、路由一致性、弹性与闲置成本。"],
          pitfalls:["PD 不保证提高吞吐或降本；官方实现也明确其主要目标是独立优化阶段延迟。"],
          exercise:"在相同总卡数、负载与质量下比较聚合/分离，扫输入长度与到达率。",acceptance:"报告 KV 传输、两池利用率和排队；找出不适合分离的负载区域。"},
        {id:"control-plane",title:"路由、弹性、可用性与隔离",tags:["系统"],goal:"理解引擎之上的控制平面职责。",
          learn:["请求分类、模型路由、负载均衡、cache-aware placement、会话粘性和 admission。","自动扩缩容、模型冷启动、权重分发、缓存预热、异构卡放置与容量预测。","deadline/超时、限流、熔断、重试风暴、故障域、多租户配额与数据安全。","可观测性：trace ID、请求生命周期、池容量、路由决策与成本标签。"],
          pitfalls:["单实例 kernel 优化不能解决全局热点；盲目扩容也可能因冷启动短期恶化 SLO。"],
          exercise:"模拟一个热点前缀、一个设备故障和一次扩容，评估路由与恢复。",acceptance:"能判断故障属于引擎、网络还是控制平面，并用观测数据支撑。"}
      ]
    },
    {
      id:"M10",title:"评测、质量与成本工程",en:"EVALUATION & ECONOMICS",tag:"系统",prereq:"M02 指标与建模；M08 调度",
      description:"把优化结果翻译成可比较、可回归的 SLO 与商业指标。",
      topics:[
        {id:"metrics",title:"TTFT / TPOT / ITL / Goodput",tags:["系统","基础"],goal:"建立清晰且不能被平均数掩盖的指标口径。",
          learn:["TTFT 从服务端或客户端开始到首 token，需要声明是否含排队、tokenization 和网络。","ITL 为相邻输出 token 的间隔；常见请求 TPOT=(E2E−TTFT)/(输出数−1)，单 token 请求单独处理。","P50/P95/P99 按请求还是按 token 聚合；stream buffering 和 chunk 会改变观测。","tokens/s 区分输入/输出/总量、单请求/系统；goodput 为满足声明质量与延迟 SLO 的有效吞吐。"],
          pitfalls:["平均 TPOT 无法反映一次长暂停；不同客户端观测点与分母的指标不能直接横比。"],
          exercise:"为一段流式响应生成时间戳，计算请求 TPOT、token ITL 分布和 SLO goodput。",acceptance:"能复现计算口径，正确处理失败、取消、无输出与单 token 样本。"},
        {id:"benchmark",title:"负载、统计与性能回归",tags:["系统"],goal:"设计能代表真实服务且能证伪结论的压测。",
          learn:["open-loop 到达率与 closed-loop 固定并发；排队稳定区与饱和拐点。","输入/输出长度联合分布、burst、Zipf 前缀、会话、多模态与工具调用。","warm/cold cache 分开；预热、稳态时间、重复、误差条与异常值审计。","单变量对照、质量一致、同硬件预算、锁版本；留出负载验证泛化。"],
          pitfalls:["只用相同长度随机请求会错过缓存与长尾；只报告成功请求会隐藏失败率。"],
          exercise:"生成三类业务流量，画到达率—goodput—P99 曲线和容量边界。",acceptance:"报告失败/拒绝/超时比例，明确测量窗口、样本数与缓存状态。"},
        {id:"cost",title:"每百万 Token 成本与 TCO",tags:["系统"],goal:"避免重复计数并计算优化的真实经济收益。",
          learn:["实测口径：cost/1M=实例总小时成本/(每小时 SLO 内有效输出 token)×10⁶。","输入、输出、缓存命中 token 分账；声明 token 口径，计入失败/重试资源。","TCO：卡/主机折旧、网络、存储、电力、机房、运维和闲置；边际成本与全成本分开。","拆分 prefill/decode/KV 传输/冷启动，避免共享资源重复分摊；ROI 含开发维护与质量损失。"],
          pitfalls:["若分母已是实测有效吞吐，不应再乘一次 GPU 利用率；GPU busy 也不等于有效利用率。"],
          exercise:"以一个固定业务 SLO 建立表格，比较量化、缓存和扩容的单位成本与回本周期。",acceptance:"成本口径闭合，说明闲置与峰谷流量的影响，能解释为什么高吞吐不一定更便宜。"},
        {id:"quality-routing",title:"模型路由、质量 SLO 与容量规划",tags:["系统","前沿"],goal:"把模型选择和计算预算也纳入优化空间。",
          learn:["大小模型路由、级联、拒答/回退、动态 token budget、reasoning budget。","业务正确率、成功任务数、用户等待时间；token 成本之外的每成功任务成本。","峰谷、预留容量、故障余量、队列模型和 deadline 约束。","以质量/延迟/成本构造 Pareto frontier；按业务分层而非寻找单一全局最优。"],
          pitfalls:["小模型便宜但重试或人工成本可能更高；控制输出长度可能改变解题质量。"],
          exercise:"设计一个小模型优先、低置信度升级的实验，统计总体成功率和成本。",acceptance:"包括路由误判、fallback 延迟和分布漂移；不以单个便宜 token 替代业务收益。"}
      ]
    },
    {
      id:"M11",title:"前沿架构与持续技术判断",en:"RESEARCH FRONTIER",tag:"前沿",prereq:"M01–M10 形成系统视角后持续跟踪",
      description:"辨别哪些变化会真正移动瓶颈，而不是只增加新术语。",
      topics:[
        {id:"hybrid",title:"SSM、线性 Attention 与混合状态",tags:["前沿","KV Cache"],goal:"理解不再以标准 KV 为唯一状态的模型。",
          learn:["SSM/recurrent state、线性 attention、chunkwise recurrence 的状态容量与计算方式。","Transformer/SSM 混合层逐层建模；状态 checkpoint、prefix 复用与回滚。","精确检索能力、训练/推理差异、长序列吞吐与质量边界。","speculative decoding、beam、PD 和分页管理如何适配不同状态结构。"],
          pitfalls:["线性序列复杂度不等于所有任务都更快或更准；固定状态也会有表达与检索约束。"],
          exercise:"对全 Transformer 与一个混合架构分别画状态生命周期和长度—容量曲线。",acceptance:"说明现有 KV manager 哪些抽象可复用，哪些需要重新设计。"},
        {id:"agent-workload",title:"Agent、长上下文与推理时计算",tags:["前沿","系统","KV Cache"],goal:"将多次调用和持久状态视作完整工作负载。",
          learn:["多轮重复上下文、工具等待、分支搜索、回退与跨请求前缀复用。","test-time scaling、长 reasoning、验证器、多候选/树搜索对吞吐与状态的影响。","工作流 DAG、关键路径、token budget 与每成功任务成本。","状态持久化、缓存 TTL、隐私、隔离和知识更新导致的失效。"],
          pitfalls:["输入复用强不代表所有请求都是同一前缀；工具结果插入与模板变化会截断可复用位置。"],
          exercise:"录制一个多轮工具工作流 trace，重放时比较单请求优化与工作流级优化。",acceptance:"报告总任务延迟、成功率、缓存节省和持久状态成本。"},
        {id:"codesign",title:"低精度、稀疏与软硬件协同",tags:["前沿","量化","算子"],goal:"识别新格式/架构如何改变内核和系统设计。",
          learn:["FP4/微缩放与混合精度：数值粒度、原生指令、校准与内核布局协同。","结构化稀疏、动态稀疏和检索 attention 的硬件执行效率；不规则访问的额外成本。","HBM 容量/带宽、片上 SRAM、互联与封装变化对最优 batch/并行方式的影响。","编译器、多后端算子与厂商库演进；选择可维护抽象而非押注单一语言。"],
          pitfalls:["模型层 FLOPs 减少不能直接换算墙钟收益；必须核对硬件稀疏/低精度执行能力。"],
          exercise:"选一项新格式或新 attention，列出模型、内核、引擎、网络四层改造清单。",acceptance:"能提出收益条件、成本与反例，并决定先做哪个最小验证实验。"},
        {id:"research-method",title:"论文复现与技术预测方法",tags:["前沿"],goal:"构建可更新、可证伪的技术观点。",
          learn:["读论文的假设、基线、硬件、负载、质量门禁、消融与实现可用性。","复现最关键图表；检查 speedup 是否同硬件/同 SLO/同质量与同成本。","维护技术雷达：已验证事实、工程可用性、研究假设、预测置信度分层记录。","每月追踪一种新瓶颈；设反例、观测指标、复评日期与停止投入条件。"],
          pitfalls:["论文最新不意味着生产优先；开源代码存在也不代表目标后端可直接部署。"],
          exercise:"写一篇“主张—证据—复现—限制—下一步”的技术分析，包含原始数据。",acceptance:"读者能复核结论，发现反例后能够降低置信度或修改预测。"}
      ]
    }
  ],
  tracks:[
    {title:"KV Cache", subtitle:"从内存管理，到全局状态系统", steps:[
      ["01 · 推得清","推导 MHA/GQA/MLA 与混合层容量，分析布局、带宽和每卡复制/分片。"],
      ["02 · 管得对","实现分页、引用计数、COW、位置身份、前缀复用、取消与回滚。"],
      ["03 · 压得稳","比较 KV 量化、稀疏与淘汰，建立质量—显存—延迟曲线。"],
      ["04 · 移得值","建模 offload/PD 传输，将缓存收益与排队、路由、扩缩容联合验证。"]
    ],deliverable:"毕业作品：一个可测试的缓存管理器 + 一个引擎集成优化；含随机状态测试、长上下文质量和真实负载收益。"},
    {title:"量化",subtitle:"从误差机制，到低比特执行",steps:[
      ["01 · 算得明","理解范围、舍入、scale、粒度、outlier 和累加误差，写 fake quant。"],
      ["02 · 选得准","复现一种 PTQ，比较 GPTQ/AWQ/SmoothQuant，设计代表性校准集。"],
      ["03 · 跑得快","理解 packing、重排、融合 dequant、FP8/微缩放与硬件指令路径。"],
      ["04 · 发得稳","覆盖代码/推理/长上下文质量门禁，报告 SLO 下净成本与回滚策略。"]
    ],deliverable:"毕业作品：同一模型的 BF16 与量化方案对照；交付 checkpoint 配置、校准说明、性能面、质量报告和可复现命令。"},
    {title:"算子开发",subtitle:"从参考实现，到引擎级贡献",steps:[
      ["01 · 写得对","从 vector/reduction/RMSNorm 开始；覆盖 mask、stride、极值与异步计时。"],
      ["02 · 喂得饱","优化 GEMM tiling、流水、寄存器、shared memory、向量化与占用率。"],
      ["03 · 懂 Attention","实现 online Softmax、分页 Decode、split-KV 或量化融合中的一个。"],
      ["04 · 接得上","完成 backend dispatch、动态图/图捕获适配、性能回归与端到端验证。"]
    ],deliverable:"毕业作品：一个目标设备上有用的 kernel PR；含正确性、形状覆盖、profiler 证据、回退路径和端到端数据。"}
  ],
  timeline:[
    {week:"W01–04",title:"建立基础与结构直觉 · M00–M01",content:"每周约 3h 原理、3h 手算/编码、2–6h 实验。补齐数值与张量基础，读配置，写小型 Decoder 参考。",output:"模型 shape/参数量清单；MHA/GQA/MLA 缓存图；稳定 Softmax 与增量一致性测试。"},
    {week:"W05–08",title:"先预测，再测量 · M02–M03",content:"测目标卡带宽/算力，建立容量与阶段下界；阅读引擎缓存分配，完成 CPU 分页模拟。",output:"Roofline 图；理论—实测—归因报告；可随机测试的 cache manager。"},
    {week:"W09–12",title:"深挖缓存与量化 · M04–M05",content:"比较 prefix/KV 量化/offload；复现一种 PTQ；统一质量门禁和负载口径。",output:"KV 优化 Pareto 曲线；量化质量—吞吐—显存报告；一个不适用案例。"},
    {week:"W13–16",title:"开发内核与编译执行 · M06–M07",content:"先 RMSNorm 再 Attention/GEMM；学 profiling、融合和图 replay，集成到锁定版本引擎。",output:"一个可用 kernel 与 dispatch 策略；形状性能面；编译/图捕获边界说明。"},
    {week:"W17–20",title:"引擎与分布式 · M08–M09",content:"读 Scheduler/Runner，压测 chunked prefill/speculation；有多卡时比较 TP/DP/EP 或 PD。",output:"源码时序图；调度参数与 SLO 曲线；多卡实测，或明确标注的离线模拟报告。"},
    {week:"W21–24",title:"成本闭环与技术判断 · M10–M11",content:"固定业务 SLO 复测最有效方案，建立 TCO；复现一篇前沿论文的关键结论并做反例分析。",output:"优化作品集；可提交 PR；成本归因表；带证据与复评计划的技术雷达。"}
  ],
  projects:[
    {title:"Decoder 性能账本",level:"P01 / 基础",body:"从真实 config 推导参数、shape、权重/KV/工作区与前向 FLOPs；写可复算脚本。",acceptance:"验收：覆盖 Dense 与 GQA；说明 LM Head、FA、TP 和 MLA 的适用边界。"},
    {title:"KV 状态管理器",level:"P02 / 核心",body:"实现块分配、引用计数、共享前缀与 COW；模拟取消、回滚、抢占和异步释放。",acceptance:"验收：随机事件测试与不变量断言通过；输出碎片、峰值块数与命中统计。"},
    {title:"量化端到端评估",level:"P03 / 核心",body:"比较基线与一种权重量化 + 一种受支持 KV 量化，保留相同任务与负载。",acceptance:"验收：含校准集说明、scale 元数据、质量门禁、性能分布与负收益区间。"},
    {title:"可合入的 Kernel",level:"P04 / 核心",body:"优化 RMSNorm、dequant GEMM 或 Decode Attention；对接目标引擎和设备后端。",acceptance:"验收：reference 对照、边界 shape、fallback、profiler 与服务端收益齐全。"},
    {title:"调度与状态协同",level:"P05 / 系统",body:"比较 chunked prefill、cache-aware routing 或 PD；使用长短混合与突发流量。",acceptance:"验收：同预算、同 SLO，报告 goodput、排队、传输、缓存命中与失败率。"},
    {title:"研究与成本备忘录",level:"P06 / 综合",body:"选择 MLA/MoE/稀疏/混合架构之一，复现核心结论，再计算业务成本边界。",acceptance:"验收：分清已有事实与预测；至少一个反例、原始数据和后续验证计划。"}
  ],
  trends:[
    {title:"状态管理将成为独立优化层",why:"Agent 多轮复用与长上下文让 KV 的生命周期超过一次请求，分层存储和缓存感知路由价值上升。",test:"看 token 加权复用率、迁移字节、P99 与净成本；若复用低、链路慢或隔离成本高则收益受限。",confidence:"较高 · 方向"},
    {title:"低精度会继续走向块级协同设计",why:"仅压缩权重不足以释放全链路收益；数值格式、scale 粒度、原生指令与内核布局需要匹配。",test:"看真实 kernel 覆盖与质量门禁下 goodput；若解量化或校准成本抵消，采用速度会放缓。",confidence:"较高 · 方向"},
    {title:"MLA / MoE 把优化压力移向新位置",why:"KV 缩小后其他计算与通信更显著；专家路由使负载不均与互联成为重要约束。",test:"测 Attention、专家 GEMM、All-to-All 占比；不同 batch/上下文可能出现相反瓶颈。",confidence:"条件性较高"},
    {title:"PD 与异构池会选择性扩展",why:"阶段资源差异和独立 SLO 支持池化；但必须有足够规模、稳定配比和高效状态传输。",test:"同卡数/同成本比较 goodput 与尾延迟；短请求、小规模或拥塞网络可能更适合聚合。",confidence:"中等 · 负载相关"},
    {title:"混合架构将要求“通用状态”抽象",why:"KV、recurrent state、局部窗口与稀疏检索并存，统一分页不能完全描述所有状态语义。",test:"跟踪质量等效条件下的状态容量、回滚/复用能力与主流引擎支持；架构采用率仍不确定。",confidence:"中等 · 架构相关"},
    {title:"优化指标从每 Token 转向每成功任务",why:"推理时计算、多候选、工具与路由改变 token 数量，单 token 成本不能完整表示业务效率。",test:"跟踪任务成功率、端到端等待和总成本；若任务评价不稳定，指标落地会受限。",confidence:"中等 · 评价相关"}
  ],
  resources:[
    {title:"结构与 Attention",links:[
      ["Attention Is All You Need","Transformer 基础与注意力结构","https://arxiv.org/abs/1706.03762"],
      ["GQA","Grouped-query Attention 原论文","https://arxiv.org/abs/2305.13245"],
      ["DeepSeek-V2 / MLA","低秩联合压缩与解耦 RoPE","https://arxiv.org/abs/2405.04434"],
      ["DeepSeek-V3","MoE 架构、训练与系统背景","https://arxiv.org/abs/2412.19437"]
    ]},
    {title:"KV 与状态系统",links:[
      ["PagedAttention / vLLM","分页 KV 与服务系统原论文","https://arxiv.org/abs/2309.06180"],
      ["KIVI","非对称低比特 KV 量化","https://arxiv.org/abs/2402.02750"],
      ["StreamingLLM","Attention sinks 与流式上下文","https://arxiv.org/abs/2309.17453"],
      ["LMCache 官方文档","跨层级 KV 缓存工程实践","https://docs.lmcache.ai/"]
    ]},
    {title:"量化算法",links:[
      ["GPTQ","二阶近似权重量化","https://arxiv.org/abs/2210.17323"],
      ["AWQ","激活感知权重量化","https://arxiv.org/abs/2306.00978"],
      ["SmoothQuant","平滑激活离群值，W8A8","https://arxiv.org/abs/2211.10438"],
      ["vLLM Quantized KV Cache","FP8、scale 与后端约束；已核对页面","https://docs.vllm.ai/en/latest/features/quantization/quantized_kvcache.html"]
    ]},
    {title:"算子与编译",links:[
      ["FlashAttention","IO 感知精确 Attention","https://arxiv.org/abs/2205.14135"],
      ["Triton Tutorials","从向量到融合 Attention 的官方教程","https://triton-lang.org/main/getting-started/tutorials/index.html"],
      ["PyTorch Compiler","torch.compile 与编译体系","https://docs.pytorch.org/docs/stable/torch.compiler.html"],
      ["CUDA Programming Guide","执行模型、内存与同步","https://docs.nvidia.com/cuda/cuda-c-programming-guide/"]
    ]},
    {title:"引擎与分布式",links:[
      ["vLLM 文档与源码入口","调度、缓存、分布式与 benchmarking","https://docs.vllm.ai/"],
      ["SGLang 官方文档","Radix、服务运行时与部署","https://docs.sglang.ai/"],
      ["vLLM Disaggregated Prefill","PD 目标、connector 与限制；已核对页面","https://docs.vllm.ai/en/latest/features/disagg_prefill.html"],
      ["Speculative Decoding","精确推测采样原论文","https://arxiv.org/abs/2211.17192"]
    ]},
    {title:"国产平台与复现工具",links:[
      ["vllm-ascend","昇腾后端源码、版本和支持矩阵","https://github.com/vllm-project/vllm-ascend"],
      ["Triton Ascend","对应编译后端与算子支持需核对","https://github.com/Ascend/triton-ascend"],
      ["昇腾社区","Ascend C、CANN 与 profiling 官方入口","https://www.hiascend.com/"],
      ["昆仑芯官方入口","获取目标卡 SDK、算子库与工具文档","https://www.kunlunxin.com/"]
    ]}
  ]
};
