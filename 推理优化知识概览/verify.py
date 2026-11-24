"""macOS 本地校验：HTML 结构、文件引用、JavaScriptCore 语法与 DOM 模拟。

运行：python3 verify.py
不安装依赖，不启动服务器，不修改网站或浏览器设置。
此检查不代替真实浏览器布局和设备性能测试。
"""
from pathlib import Path
from html.parser import HTMLParser
import ctypes as c
import json

ROOT = Path(__file__).resolve().parent


class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = set()
        self.references = []
        self.inputs = {}

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if "id" in attrs:
            assert attrs["id"] not in self.ids, f"Duplicate ID: {attrs['id']}"
            self.ids.add(attrs["id"])
        if tag in ("script", "link"):
            ref = attrs.get("src") or attrs.get("href")
            if ref:
                self.references.append(ref)
        if tag == "a" and attrs.get("href", "").startswith("#"):
            self.references.append(attrs["href"])
        if tag == "input" and "name" in attrs:
            self.inputs[attrs["name"]] = attrs.get("value", "")


page = Page()
page.feed((ROOT / "index.html").read_text())
for ref in page.references:
    if ref.startswith("#"):
        assert ref[1:] in page.ids, ref
    elif not ref.startswith("http"):
        assert (ROOT / ref).is_file(), ref

jsc = c.CDLL("/System/Library/Frameworks/JavaScriptCore.framework/JavaScriptCore")
jsc.JSGlobalContextCreate.argtypes = [c.c_void_p]
jsc.JSGlobalContextCreate.restype = c.c_void_p
jsc.JSGlobalContextRelease.argtypes = [c.c_void_p]
jsc.JSStringCreateWithUTF8CString.argtypes = [c.c_char_p]
jsc.JSStringCreateWithUTF8CString.restype = c.c_void_p
jsc.JSStringRelease.argtypes = [c.c_void_p]
jsc.JSEvaluateScript.argtypes = [c.c_void_p, c.c_void_p, c.c_void_p, c.c_void_p, c.c_int, c.POINTER(c.c_void_p)]
jsc.JSEvaluateScript.restype = c.c_void_p
jsc.JSCheckScriptSyntax.argtypes = [c.c_void_p, c.c_void_p, c.c_void_p, c.c_int, c.POINTER(c.c_void_p)]
jsc.JSCheckScriptSyntax.restype = c.c_bool
jsc.JSValueToStringCopy.argtypes = [c.c_void_p, c.c_void_p, c.POINTER(c.c_void_p)]
jsc.JSValueToStringCopy.restype = c.c_void_p
jsc.JSStringGetMaximumUTF8CStringSize.argtypes = [c.c_void_p]
jsc.JSStringGetMaximumUTF8CStringSize.restype = c.c_size_t
jsc.JSStringGetUTF8CString.argtypes = [c.c_void_p, c.c_char_p, c.c_size_t]
jsc.JSStringGetUTF8CString.restype = c.c_size_t
ctx = jsc.JSGlobalContextCreate(None)


def text(value):
    string = jsc.JSValueToStringCopy(ctx, value, None)
    size = jsc.JSStringGetMaximumUTF8CStringSize(string)
    buf = c.create_string_buffer(size)
    jsc.JSStringGetUTF8CString(string, buf, size)
    jsc.JSStringRelease(string)
    return buf.value.decode("utf-8")


def evaluate(source):
    string = jsc.JSStringCreateWithUTF8CString(source.encode())
    error = c.c_void_p()
    value = jsc.JSEvaluateScript(ctx, string, None, None, 1, c.byref(error))
    jsc.JSStringRelease(string)
    if error.value:
        raise AssertionError(text(error.value))
    return text(value)


try:
    for name in ("curriculum.js", "app.js"):
        source = jsc.JSStringCreateWithUTF8CString((ROOT / name).read_bytes())
        error = c.c_void_p()
        assert jsc.JSCheckScriptSyntax(ctx, source, None, 1, c.byref(error)), f"{name}: {text(error.value)}"
        jsc.JSStringRelease(source)
    # Minimal DOM, event and storage harness. The application itself is unmodified.
    evaluate("""
      var window=globalThis, listeners={}, nodes={}, store={}, downloads=[];
      function node(key) {
        if (!nodes[key]) nodes[key]={
          value:"",textContent:"",innerHTML:"",hidden:false,open:false,checked:false,
          dataset:{},attributes:{},style:{},
          classList:{toggle:function(){}},
          addEventListener:function(name,fn){(this.events||(this.events={}))[name]=fn;},
          setAttribute:function(name,value){this.attributes[name]=value;},
          showModal:function(){this.open=true;},
          close:function(){this.open=false;if(this.events.close)this.events.close();},
          click:function(){downloads.push(this.download);},
          focus:function(){this.focused=true;}
        };
        return nodes[key];
      }
      var document={
        querySelector:node,
        querySelectorAll:function(){return [];},
        addEventListener:function(name,fn){listeners[name]=fn;},
        createElement:function(){return node("download");}
      };
      var localStorage={getItem:function(k){return store[k]||null;},setItem:function(k,v){store[k]=v;}};
      var location={hash:""};
      var history={replaceState:function(a,b,hash){location.hash=hash;}};
      window.addEventListener=function(name,fn){listeners[name]=fn;};
      var setTimeout=function(){return 1;},clearTimeout=function(){};
      var Blob=function(parts){this.parts=parts;};
      var URL={createObjectURL:function(){return "blob:test";},revokeObjectURL:function(){}};
      var fields={};
      var FormData=function(){return Object.entries(fields).map(function(p){return [p[0],p[1].value];});};
      node("#calculator").elements=fields;
      node("#calculator").checkValidity=function(){
        return Object.entries(fields).every(function(p){
          var key=p[0],v=Number(p[1].value);
          return p[1].value!==""&&Number.isFinite(v)&&(key==="reserve"?v>=0&&v<=95:v>0)&&
          (!["layers","batch","tokens","heads","dim"].includes(key)||Number.isInteger(v));
        });
      };
      function fire(selector,event,target){node(selector).events[event]({target:target||node(selector),preventDefault:function(){}});}
      function assert(value,message){if(!value)throw new Error(message);}
    """)
    inputs = {**page.inputs, "weightBits": "16", "kvBits": "16"}
    evaluate("Object.entries(" + json.dumps(inputs) + ").forEach(function(p){fields[p[0]]={value:p[1]};});")
    evaluate((ROOT / "curriculum.js").read_text())
    result = json.loads(evaluate("""
      var modules=CURRICULUM.modules;
      var topics=modules.flatMap(function(m){return m.topics;});
      assert(modules.length===12,"12 modules");
      assert(topics.length===48,"48 topics");
      assert(new Set(topics.map(function(t){return t.id;})).size===topics.length,"Unique topic IDs");
      topics.forEach(function(t){
        ["id","title","goal","exercise","acceptance"].forEach(function(k){assert(typeof t[k]==="string"&&t[k].length>0,t.id+" "+k);});
        assert(t.learn.length>=4&&t.pitfalls.length>0&&t.tags.length>0,"Complete topic: "+t.id);
      });
      JSON.stringify({modules:modules.length,topics:topics.length,resources:CURRICULUM.resources.reduce(function(n,g){return n+g.links.length;},0)});
    """))
    evaluate((ROOT / "app.js").read_text())
    evaluate("""
      assert(node("#module-grid").innerHTML.includes("PagedAttention"),"Rendered curriculum");
      assert(node("#result-count").textContent.includes("48 / 48"),"All topics rendered");
      assert(node("#calc-output").innerHTML.includes("16 <small>GiB"),"Default KV 16 GiB");
      assert(node("#calc-output").innerHTML.includes("53 <small>条"),"Default max batch 53");
      var initialOutput=node("#calc-output").innerHTML;
      fields.kvBits.value="8";fire("#calculator","input",{id:"kvBits"});
      assert(node("#calc-output").innerHTML.includes("8 <small>GiB"),"FP8 KV halves capacity");
      fields.kvBits.value="16";fields.batch.value="100";fire("#calculator","input",{id:"batch"});
      assert(node("#calc-output").innerHTML.includes("超出"),"Over-budget warning");
      fields.batch.value="";fire("#calculator","input",{id:"batch"});
      assert(node("#calc-output").innerHTML.includes("请输入"),"Invalid input guard");
      fields.batch.value="16";node("#preset").value="mha";fire("#preset","change");
      assert(String(fields.heads.value)==="32","MHA preset");
      assert(node("#calc-output").innerHTML.includes("64 <small>GiB"),"MHA KV 64 GiB");
      node("#preset").value="gqa";fire("#preset","change");
      node("#search-input").value="AWQ";fire("#search-input","input");
      assert(node("#module-grid").innerHTML.includes("GPTQ / AWQ"),"Search actual content");
      node("#search-input").value="definitely-not-a-topic";fire("#search-input","input");
      assert(!node("#empty-state").hidden,"Empty search");
      node("#search-input").value="";fire("#search-input","input");
      var filter={dataset:{filter:"KV Cache"}};
      fire("#filters","click",{closest:function(){return filter;}});
      assert(!node("#module-grid").innerHTML.includes("概率、采样"),"Tag filter");
      filter.dataset.filter="all";fire("#filters","click",{closest:function(){return filter;}});
      fire("#module-grid","click",{closest:function(){return {dataset:{open:"paging"}};}});
      assert(node("#topic-dialog").open,"Dialog opens");
      assert(node("#dialog-content").innerHTML.includes("copy-on-write"),"Dialog full details");
      fire("#toggle-topic","click");
      assert(node("#progress-text").textContent==="1 / 48","Mark completed");
      assert(JSON.parse(store["inference-atlas-progress-v1"])[0]==="paging","Persist progress");
      fire("#toggle-topic","click");
      assert(node("#progress-text").textContent==="0 / 48","Undo completed");
      fire("#close-dialog","click");
      assert(!node("#topic-dialog").open&&location.hash==="#knowledge","Close dialog hash");
      fire("#export-progress","click");
      assert(downloads[0]==="inference-atlas-progress.json","Export download");
      location.hash="#topic-kv-quant";listeners.hashchange();
      assert(node("#topic-dialog").open&&node("#dialog-content").innerHTML.includes("KIVI"),"Topic deeplink");
    """)
    evaluate("""
      node("#import-progress").events.change({target:{
        files:[{size:120,text:async function(){return JSON.stringify({
          format:"inference-atlas-progress",version:1,completed:["paging","kv-quant","unknown"]
        });}}],value:"backup"
      }}).then(function(){
        assert(node("#progress-text").textContent==="2 / 48","Import valid IDs and ignore unknown");
        window.importVerified=true;
      });
    """)
    assert evaluate("Boolean(window.importVerified)") == "true", "Import async validation"
    print("PASS:", json.dumps(result, ensure_ascii=False))
    print("PASS: HTML IDs/local references; JS syntax; initial rendering; search/filter; dialogs/deeplink; progress mark/undo/export/import.")
    print("PASS: calculator default GQA 16 GiB, capacity 53; FP8 halves KV; MHA 64 GiB; invalid input; over-budget warning.")
    print("LIMIT: DOM simulation using JavaScriptCore, not a real-browser layout or accessibility audit.")
finally:
    jsc.JSGlobalContextRelease(ctx)
