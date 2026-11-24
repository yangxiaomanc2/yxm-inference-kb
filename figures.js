const Fig = (() => {
  const colors = {blue:'#6a9bcc', purple:'#8f7fc0', orange:'#d97757', green:'#788c5d', ochre:'#c2953a', gray:'#b0aea5'};
  const isFigure = d => d?.kind === 'code' || d?.kind === 'arch';
  const linesOf = d => typeof d.code === 'string' && d.code ? d.code.replace(/\n$/, '').split('\n') : [];
  const ranges = value => String(value ?? '').split(',').map(part => {
    const match = /^(\d+)(?:[-–](\d+))?$/.exec(part.trim());
    return match ? [+match[1], +(match[2] ?? match[1])] : [0, 0];
  });
  const label = value => typeof value === 'string' && value.trim().length > 0;

  function validate(d) {
    if (!isFigure(d) || !label(d.caption) || !label(d.title)) return ['缺少图类型、标题或图注'];
    if (d.kind === 'arch') {
      if (!Array.isArray(d.stages) || d.stages.length < 2 || d.stages.length > 8) return ['结构图需要 2–8 个阶段'];
      if (new Set(d.stages.map(s=>s?.key)).size !== d.stages.length || d.stages.some(s =>
        !label(s?.key) || !label(s.label) || !Object.hasOwn(colors,s.color) ||
        (s.sub != null && (!Array.isArray(s.sub) || s.sub.length > 4 || !s.sub.every(label)))))
        return ['结构图阶段需要唯一标识、名称、语义色和至多四个子步骤'];
      return [];
    }
    const length = linesOf(d).length;
    const end = d.startLine + length - 1;
    if (!label(d.file) || !length || length > 40 || !Number.isInteger(d.startLine) ||
        d.startLine < 1 || !Number.isInteger(d.totalLines) || d.totalLines < end)
      return ['源码片段需要版本、真实行号和至多 40 行代码'];
    if (!Array.isArray(d.steps) || d.steps.length < 2 || d.steps.length > 7 || d.steps.some(s =>
      !label(s?.label) || ranges(s.lines).some(([a,b]) => a < d.startLine || b < a || b > end)))
      return ['代码图需要 2–7 个步骤，且高亮行须在片段内'];
    return [];
  }

  function append(parent, tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    parent.append(node);
    return node;
  }

  function sourceLink(parent, data, text) {
    if (typeof data.source !== 'string' || !/^https:\/\/(?:github\.com|huggingface\.co|arxiv\.org)\//.test(data.source))
      return append(parent,'span','',text);
    const link = append(parent,'a','',text);
    link.href = data.source;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    return link;
  }

  function renderCode(fig, d) {
    const control = append(fig,'div','fig-control');
    const play = append(control,'button','','播放');
    play.type = 'button';
    const counter = append(control,'span');
    const panes = append(fig,'div','fig-panes');
    const flow = append(panes,'div','fig-flow');
    const list = append(flow,'ol','fig-steps');
    const buttons = d.steps.map((step,i)=>{
      const btn = append(append(list,'li'),'button','',`${i+1}. ${step.label}`);
      btn.type = 'button';
      append(btn,'span','fig-step-line',`L${step.lines}`);
      btn.addEventListener('click',()=>{playing=false; show(i); sync();});
      return btn;
    });
    const description = append(flow,'p','fig-description');
    const panel = append(panes,'div','fig-code');
    const heading = append(panel,'div','fig-codehead');
    sourceLink(heading,d,d.file);
    const lines = linesOf(d);
    append(heading,'span','',`L${d.startLine}–${d.startLine+lines.length-1} / ${d.totalLines}`);
    const source = append(panel,'div','fig-codebody');
    source.tabIndex = 0;
    source.setAttribute('aria-label','源码');
    const rows = lines.map((line,i)=>{
      const row = append(source,'div','fig-line');
      const lineNo = append(row,'span','fig-lineno',d.startLine+i);
      lineNo.setAttribute('aria-hidden','true');
      append(row,'span','',line || ' ');
      return row;
    });
    const highlight = d.steps.map(step=>ranges(step.lines));
    let current=0, timer, visible=false;
    let playing = !matchMedia('(prefers-reduced-motion: reduce)').matches;
    function show(index) {
      current=index;
      buttons.forEach((button,i)=>button.setAttribute('aria-pressed',String(i===index)));
      rows.forEach((row,i)=>row.classList.toggle('active',highlight[index].some(([a,b])=>a<=d.startLine+i && d.startLine+i<=b)));
      description.textContent=d.steps[index].desc || '';
      counter.textContent=`${index+1} / ${d.steps.length}`;
    }
    function sync() {
      play.textContent=playing?'暂停':'播放';
      play.setAttribute('aria-pressed',String(playing));
      clearInterval(timer);
      if (playing && visible) timer=setInterval(()=>fig.isConnected?show((current+1)%buttons.length):clearInterval(timer),2800);
    }
    play.addEventListener('click',()=>{playing=!playing; sync();});
    const observer = new IntersectionObserver(([entry])=>{visible=entry.isIntersecting; sync();});
    observer.observe(fig);
    fig.disposeFigure = ()=>{observer.disconnect(); clearInterval(timer);};
    show(0);
    sync();
  }

  function renderArch(fig,d) {
    const scroll=append(fig,'div','fig-scroll');
    scroll.tabIndex=0;
    scroll.setAttribute('aria-label',d.title);
    const detail=append(fig,'p','fig-description');
    function svgNode(parent,tag,attrs,text) {
      const node=document.createElementNS('http://www.w3.org/2000/svg',tag);
      for(const [key,value] of Object.entries(attrs)) node.setAttribute(key,value);
      if(text!=null) node.textContent=text;
      parent.append(node);
      return node;
    }
    const measure = text => [...String(text ?? '')].reduce((n,c)=>n+(c.charCodeAt(0)>255 ? 15 : 8),0);
    const gap=28;
    let left=14;
    const geometry=d.stages.map(stage=>{
      const width=Math.max(124,26+Math.max(...[stage.label,stage.dim,...(stage.sub||[])].map(measure)));
      const x=left;
      left+=width+gap;
      return {x,width};
    });
    const height=68+Math.max(...d.stages.map(s=>(s.sub?.length||0)+(s.dim?1:0)))*24;
    const width=left-gap+14;
    const svg=svgNode(scroll,'svg',{viewBox:`0 0 ${width} ${height}`,width,height,role:'group','aria-label':d.title});
    svg.style.minWidth=`${width}px`;
    let selected=null;
    const stages=[];
    const activate=index=>{
      stages.forEach((node,i)=>node.classList.toggle('dim',index!==null&&i!==index));
      detail.textContent=index===null?'':d.stages[index].note||'';
    };
    d.stages.forEach((stage,i)=>{
      const {x,width}=geometry[i];
      const color=colors[stage.color];
      if(i>0){
        const middle=height/2;
        svgNode(svg,'path',{d:`M${x-gap} ${middle-6}H${x-8}V${middle-11}L${x} ${middle}L${x-8} ${middle+11}V${middle+6}H${x-gap}Z`,fill:color,opacity:.32});
      }
      const group=svgNode(svg,'g',{tabindex:0,role:'button','aria-label':[stage.label,stage.dim,stage.note].filter(Boolean).join('，')});
      stages.push(group);
      svgNode(group,'rect',{x,y:15,width,height:height-30,rx:12,fill:color,'fill-opacity':.09,stroke:color});
      svgNode(group,'text',{x:x+width/2,y:40,'text-anchor':'middle',class:'fig-stage-title'},stage.label);
      for(const [j,sub] of (stage.sub||[]).entries())
        svgNode(group,'text',{x:x+width/2,y:63+j*24,'text-anchor':'middle'},sub);
      if(stage.dim)
        svgNode(group,'text',{x:x+width/2,y:63+(stage.sub?.length||0)*24,'text-anchor':'middle',class:'fig-dim'},stage.dim);
      const toggle=()=>{selected=selected===i?null:i; activate(selected);};
      group.addEventListener('mouseenter',()=>activate(i));
      group.addEventListener('mouseleave',()=>activate(selected));
      group.addEventListener('focus',()=>activate(i));
      group.addEventListener('blur',()=>activate(selected));
      group.addEventListener('click',toggle);
      group.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();toggle();}});
    });
  }

  function render(data,number) {
    const fig=document.createElement('figure');
    fig.className=`kb-figure ${data?.kind==='code'?'code-figure':'arch-figure'}`;
    const problems=validate(data);
    if(problems.length){
      append(fig,'p','fig-description',problems.join('。'));
      return fig;
    }
    append(fig,'h4','fig-title',data.title);
    if(data.kind==='code') renderCode(fig,data);
    else renderArch(fig,data);
    const caption=append(fig,'figcaption','',`图 ${number} · ${data.caption}`);
    if(data.kind==='arch' && data.source) {
      caption.append(' · ');
      sourceLink(caption,data,'来源');
    }
    return fig;
  }

  return {isFigure,validate,render};
})();
