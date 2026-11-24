(() => {
  "use strict";
  const data = window.CURRICULUM;
  if (!data) return;
  const $ = (selector) => document.querySelector(selector);
  const allTopics = data.modules.flatMap(module => module.topics.map(topic => ({...topic, module})));
  const topicMap = new Map(allTopics.map(topic => [topic.id, topic]));
  const storageKey = "inference-atlas-progress-v1";
  let completed = new Set();
  let activeFilter = "all";
  let query = "";
  let selectedTopic = null;
  let toastTimer;
  const escape = value => String(value).replace(/[&<>"']/g, character => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[character]));

  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || "[]");
    if (Array.isArray(saved)) completed = new Set(saved.filter(id => topicMap.has(id)));
  } catch {
    $("#storage-status").textContent = "浏览器存储不可用，建议导出进度。";
  }
  function notify(message) {
    const toast = $("#toast");
    toast.textContent = message;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.hidden = true; }, 3600);
  }
  function updateProgress() {
    $("#progress-text").textContent = `${completed.size} / ${allTopics.length}`;
    $("#learning-progress").max = allTopics.length;
    $("#learning-progress").value = completed.size;
    $("#learning-progress").setAttribute("aria-label", `已完成 ${completed.size} 个知识点，共 ${allTopics.length} 个`);
    $("#topic-count").textContent = allTopics.length;
  }
  function saveProgress() {
    try { localStorage.setItem(storageKey, JSON.stringify([...completed])); }
    catch { $("#storage-status").textContent = "进度未能持久化，请导出备份。"; }
    updateProgress();
  }
  function setCompleted(id, value) {
    if (value) completed.add(id); else completed.delete(id);
    saveProgress();
    renderModules();
    updateDialogButton();
  }
  function matches(topic, module) {
    const filterMatch = activeFilter === "all" || (activeFilter === "unfinished" ? !completed.has(topic.id) : topic.tags.includes(activeFilter));
    const haystack = [module.title,module.en,module.description,topic.title,topic.goal,...topic.tags,...topic.learn,...topic.pitfalls,topic.exercise,topic.acceptance].join(" ").toLowerCase();
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return filterMatch && words.every(word => haystack.includes(word));
  }
  function renderModules() {
    let count = 0;
    const markup = data.modules.map(module => {
      const topics = module.topics.filter(topic => matches(topic,module));
      count += topics.length;
      if (!topics.length) return "";
      return `<article class="module-card">
        <div class="module-top"><span class="module-id">${escape(module.id)}</span><span class="module-tag">${escape(module.tag)}</span></div>
        <h3>${escape(module.title)}</h3><div class="module-subtitle">${escape(module.en)}</div>
        <p class="module-description">${escape(module.description)}</p>
        <ul class="topic-list">${topics.map(topic => `<li class="topic-row ${completed.has(topic.id) ? "done" : ""}">
          <input type="checkbox" class="topic-check" data-topic="${escape(topic.id)}" aria-label="标记 ${escape(topic.title)} 为已完成" ${completed.has(topic.id)?"checked":""}>
          <button class="topic-button" data-open="${escape(topic.id)}"><span>${escape(topic.title)}</span><span aria-hidden="true">↗</span></button>
        </li>`).join("")}</ul><div class="module-prereq">前置 · ${escape(module.prereq)}</div>
      </article>`;
    }).join("");
    $("#module-grid").innerHTML = markup;
    $("#result-count").textContent = `显示 ${count} / ${allTopics.length} 个技术单元 · 已完成 ${completed.size} 个`;
    $("#empty-state").hidden = count !== 0;
  }
  function updateDialogButton() {
    const button = $("#toggle-topic");
    if (button && selectedTopic) {
      button.textContent = completed.has(selectedTopic.id) ? "✓ 已完成 · 点击撤销" : "标记为已完成";
      button.setAttribute("aria-pressed", String(completed.has(selectedTopic.id)));
    }
  }
  function openTopic(id, writeHistory = true) {
    const topic = topicMap.get(id);
    if (!topic) return;
    selectedTopic = topic;
    const list = values => `<ul>${values.map(value => `<li>${escape(value)}</li>`).join("")}</ul>`;
    $("#dialog-module").textContent = `${topic.module.id} / ${topic.module.en}`;
    $("#dialog-content").innerHTML = `
      <h2 id="dialog-title">${escape(topic.title)}</h2>
      <div>${topic.tags.map(tag=>`<span class="dialog-tag">${escape(tag)}</span>`).join("")}</div>
      <p class="dialog-intro">${escape(topic.goal)}</p>
      <div class="dialog-section"><h3>需要掌握</h3>${list(topic.learn)}</div>
      <div class="dialog-section"><h3>边界与易错点</h3>${list(topic.pitfalls)}</div>
      <div class="dialog-exercise"><b>动手实践</b>${escape(topic.exercise)}</div>
      <div class="dialog-section"><h3>验收标准</h3><p>${escape(topic.acceptance)}</p></div>
      <div class="dialog-footer"><button id="toggle-topic" class="button primary" aria-pressed="false"></button><span>关联阅读请见“论文与官方资料”</span></div>`;
    $("#toggle-topic").addEventListener("click", () => setCompleted(id, !completed.has(id)));
    updateDialogButton();
    if (!$("#topic-dialog").open) $("#topic-dialog").showModal();
    $("#topic-dialog").scrollTop = 0;
    if (writeHistory) history.replaceState(null, "", `#topic-${id}`);
  }
  const closeDialog = () => $("#topic-dialog").close();
  $("#close-dialog").addEventListener("click", closeDialog);
  $("#topic-dialog").addEventListener("click", event => {
    // Only the actual backdrop closes the dialog; interior padding does not.
    const bounds = event.currentTarget.getBoundingClientRect();
    if (event.target === event.currentTarget && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) closeDialog();
  });
  $("#topic-dialog").addEventListener("close", () => {
    if (location.hash.startsWith("#topic-")) history.replaceState(null, "", "#knowledge");
  });
  $("#module-grid").addEventListener("click", event => {
    const trigger = event.target.closest("[data-open]");
    if (trigger) openTopic(trigger.dataset.open);
  });
  $("#module-grid").addEventListener("change", event => {
    if (event.target.matches(".topic-check")) setCompleted(event.target.dataset.topic,event.target.checked);
  });
  $("#search-input").addEventListener("input", event => {query=event.target.value;renderModules();});
  $("#filters").addEventListener("click", event => {
    const button = event.target.closest("[data-filter]");
    if (!button) return;
    activeFilter = button.dataset.filter;
    for (const item of document.querySelectorAll(".filter")) {
      const active = item === button;
      item.classList.toggle("active",active);
      item.setAttribute("aria-pressed",String(active));
    }
    renderModules();
  });
  document.addEventListener("keydown", event => {
    if (event.key === "/" && !$("#topic-dialog").open && !["INPUT","TEXTAREA","SELECT"].includes(event.target.tagName) && !event.target.isContentEditable) {
      event.preventDefault();
      $("#search-input").focus();
    }
  });
  $("#export-progress").addEventListener("click", () => {
    const payload = {format:"inference-atlas-progress", version:1, exportedAt:new Date().toISOString(), completed:[...completed]};
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:"application/json"}));
    const anchor = document.createElement("a");
    anchor.href=url;anchor.download="inference-atlas-progress.json";anchor.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
    notify("学习进度已导出。");
  });
  $("#import-progress").addEventListener("change", async event => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      if (file.size > 1024*1024) throw new Error("文件过大");
      const payload = JSON.parse(await file.text());
      if (payload.format !== "inference-atlas-progress" || payload.version !== 1 || !Array.isArray(payload.completed) || !payload.completed.every(id=>typeof id==="string")) throw new Error("格式不匹配");
      const ids = payload.completed.filter(id => topicMap.has(id));
      // Merge so importing a backup cannot erase newer progress.
      ids.forEach(id=>completed.add(id));
      saveProgress();renderModules();updateDialogButton();
      notify(`已合并 ${ids.length} 项有效进度，现有进度保留。`);
    } catch { notify("无法导入：请选择本站导出的有效 JSON 进度文件。"); }
    event.target.value="";
  });

  $("#mastery-grid").innerHTML = data.tracks.map((track,index)=>`<article class="mastery-card"><div class="track-number">TRACK 0${index+1}</div><h3>${escape(track.title)}</h3><p>${escape(track.subtitle)}</p>${track.steps.map(([title,body])=>`<div class="mastery-step"><b>${escape(title)}</b><p>${escape(body)}</p></div>`).join("")}<div class="mastery-deliverable">${escape(track.deliverable)}</div></article>`).join("");
  $("#timeline").innerHTML = data.timeline.map(stage=>`<article class="timeline-row"><div class="week">${escape(stage.week)}</div><div><h3>${escape(stage.title)}</h3><p>${escape(stage.content)}</p></div><div class="timeline-output"><span>DELIVERABLE / 阶段产出</span><p>${escape(stage.output)}</p></div></article>`).join("");
  $("#projects").innerHTML = data.projects.map(project=>`<article class="project-card"><small>${escape(project.level)}</small><h3>${escape(project.title)}</h3><p>${escape(project.body)}</p><p class="acceptance">${escape(project.acceptance)}</p></article>`).join("");
  $("#trends").innerHTML = data.trends.map(trend=>`<tr><td>${escape(trend.title)}</td><td>${escape(trend.why)}</td><td>${escape(trend.test)}</td><td><span class="trend-confidence">${escape(trend.confidence)}</span></td></tr>`).join("");
  $("#resource-grid").innerHTML = data.resources.map(group=>`<article class="resource-group"><h3>${escape(group.title)}</h3>${group.links.map(([title,description,url])=>`<a class="resource-link" href="${escape(url)}" target="_blank" rel="noopener noreferrer"><strong>${escape(title)}<span aria-hidden="true">↗</span></strong><small>${escape(description)}</small></a>`).join("")}</article>`).join("");

  function calculate() {
    const form = $("#calculator");
    const values = Object.fromEntries(new FormData(form));
    const names = ["params","layers","batch","tokens","heads","dim","weightBits","kvBits","memory","reserve","bandwidth","compute"];
    const config = Object.fromEntries(names.map(name=>[name,Number(values[name])]));
    if (!form.checkValidity() || names.some(name=>!Number.isFinite(config[name])) || names.filter(name=>name!=="reserve").some(name=>config[name]<=0)) {
      $("#calc-output").innerHTML='<p class="calc-warning">请输入范围内的有效数值；层数、并发、长度、头数和维度须为正整数。</p>';
      return;
    }
    const {params,layers,batch,tokens,heads,dim,weightBits,kvBits,memory,reserve,bandwidth,compute} = config;
    const GiB = 1024**3;
    const weights = params*1e9*weightBits/8;
    const kvPerSequence = 2*layers*tokens*heads*dim*kvBits/8;
    const kv = kvPerSequence*batch;
    const available = memory*GiB*(1-reserve/100);
    const maxBatch = Math.max(0,Math.floor((available-weights)/kvPerSequence));
    const bandwidthMs = (weights+kv)/(bandwidth*1e9)*1000;
    const computeMs = 2*params*1e9*batch/(compute*1e12)*1000;
    const lowerBoundMs = Math.max(bandwidthMs,computeMs);
    const capacity = memory*GiB;
    const weightPercent = Math.min(100,weights/capacity*100);
    const kvPercent = Math.min(100-weightPercent,kv/capacity*100);
    const fmt = number => number.toLocaleString("zh-CN",{maximumFractionDigits:2});
    const metric = (label,value,unit) => `<div class="metric"><span>${label}</span><strong>${fmt(value)} <small>${unit}</small></strong></div>`;
    $("#calc-output").innerHTML=`
      <div class="metric-grid">
        ${metric("权重裸容量",weights/GiB,"GiB")}${metric("KV 裸容量",kv/GiB,"GiB")}
        ${metric("每序列 KV",kvPerSequence/GiB,"GiB")}${metric("容量允许的等长序列上限",maxBatch,"条")}
        ${metric("理想带宽项",bandwidthMs,"ms / step")}${metric("线性层计算项",computeMs,"ms / step")}
      </div>
      <div class="memory-bar" role="img" aria-label="权重和KV占总HBM容量比例"><span style="width:${weightPercent}%"></span><span style="width:${kvPercent}%"></span></div>
      <div class="memory-legend"><span>● 权重 ${fmt(weights/GiB)} GiB</span><span>● KV ${fmt(kv/GiB)} GiB</span></div>
      <p class="calc-foot">简化单步下界 ≥ <strong>${fmt(lowerBoundMs)} ms</strong>。仅从这两个估算项看，${bandwidthMs>=computeMs?"带宽":"线性层计算"}项更大。预留后预算 ${fmt(available/GiB)} GiB；容量上限不代表可满足延迟 SLO 的并发。</p>
      ${weights+kv>available?'<p class="calc-warning">⚠ 权重 + KV 超出预留后的预算，请降低并发/长度或调整精度与并行方案。</p>':""}
      <p class="calc-foot">单卡、无分片、无 prefix 共享、无滑窗；忽略 scale/对齐。Attention 计算与通信未计入。MoE 请分别建模常驻参数和激活参数，本公式不适用。</p>`;
  }
  $("#calculator").addEventListener("submit",event=>event.preventDefault());
  $("#calculator").addEventListener("input",event=>{
    if(event.target.id!=="preset") $("#preset").value="custom";
    calculate();
  });
  $("#calculator").addEventListener("change",calculate);
  $("#preset").addEventListener("change", event=>{
    const preset=event.target.value;
    if(preset==="custom") return;
    const values=preset==="gqa"?{params:8,layers:32,heads:8,dim:128}:{params:7,layers:32,heads:32,dim:128};
    Object.entries(values).forEach(([name,value])=>{$("#calculator").elements[name].value=value;});
    calculate();
  });
  if ("IntersectionObserver" in window) {
    const sections = [...document.querySelectorAll(".section-anchor")];
    const observer = new IntersectionObserver(entries=>{
      for(const entry of entries) if(entry.isIntersecting) {
        document.querySelectorAll(".nav-link").forEach(link=>link.classList.toggle("active",link.hash===`#${entry.target.id}`));
      }
    },{rootMargin:"-12% 0px -65% 0px",threshold:0});
    sections.forEach(section=>observer.observe(section));
  }
  function handleHash() {
    if (location.hash.startsWith("#topic-")) openTopic(location.hash.slice(7),false);
    else if ($("#topic-dialog").open) closeDialog();
  }
  window.addEventListener("hashchange",handleHash);
  updateProgress();renderModules();calculate();handleHash();
})();
