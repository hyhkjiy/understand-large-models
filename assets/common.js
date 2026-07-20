/* ==================== 丛书共享脚本 ==================== */
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const f2=(x,d=2)=>(+x).toFixed(d);

/* ---------- 滑块填充色 ---------- */
function paintRange(r){
  const min=+r.min,max=+r.max,v=+r.value;
  r.style.setProperty('--fill',((v-min)/(max-min)*100)+'%');
}
$$('input[type=range]').forEach(r=>{paintRange(r);r.addEventListener('input',()=>paintRange(r));});

/* ---------- 荧光笔:公式项 ↔ 部件联动 ---------- */
$$('.term').forEach(t=>{
  const g=t.dataset.g, box=t.closest('.fbox'), tip=box&&box.querySelector('.tip');
  const on=()=>{ $$(`[data-hg="${g}"]`).forEach(e=>e.classList.add('lit'));
    $$(`.term[data-g="${g}"]`).forEach(e=>e.classList.add('on'));
    if(tip&&t.dataset.tip) tip.innerHTML=t.dataset.tip; };
  const off=()=>{ $$(`[data-hg="${g}"]`).forEach(e=>e.classList.remove('lit'));
    $$(`.term[data-g="${g}"]`).forEach(e=>e.classList.remove('on')); };
  t.addEventListener('mouseenter',on); t.addEventListener('mouseleave',off);
  t.addEventListener('click',()=>{ (t.classList.contains('on')?off:on)(); }); // 触屏支持
});

/* ---------- 跳转 ---------- */
$$('[data-go]').forEach(b=>b.addEventListener('click',()=>{
  document.getElementById(b.dataset.go).scrollIntoView({behavior:'smooth'});
}));

/* ---------- 导航高亮 ---------- */
const io=new IntersectionObserver(es=>{
  es.forEach(e=>{ if(e.isIntersecting){
    $$('.nav-chip').forEach(c=>c.classList.toggle('active',c.dataset.nav===e.target.id));
  }});
},{rootMargin:'-30% 0px -60% 0px'});
$$('section.chapter').forEach(s=>io.observe(s));

/* ---------- 浮窗开关(若本页有急救包) ---------- */
const hp=$('#helpPanel'), hm=$('#helpMask');
if(hp&&hm){
  const helpOpen=o=>{ hp.classList.toggle('open',o); hm.classList.toggle('open',o); };
  $('#helpBtn').addEventListener('click',()=>helpOpen(!hp.classList.contains('open')));
  $('#helpClose').addEventListener('click',()=>helpOpen(false));
  hm.addEventListener('click',()=>helpOpen(false));
  document.addEventListener('keydown',e=>{ if(e.key==='Escape') helpOpen(false); });
  $$('#helpPanel [data-go]').forEach(b=>b.addEventListener('click',()=>helpOpen(false)));
}

/* ---------- 掌握进度(总数由 <body data-prog-total> 提供) ---------- */
const PROG=new Set(), PROG_TOTAL=+(document.body.dataset.progTotal||0);
function markProg(k){
  if(!k) return;
  PROG.add(k);
  const np=$('#navProg');
  if(np&&PROG_TOTAL) np.textContent='掌握 '+PROG.size+'/'+PROG_TOTAL+(PROG.size>=PROG_TOTAL?' ✓':'');
}

/* ---------- 毕业进度(统计本页 .quiz[data-grad]) ---------- */
function gradUpdate(){
  const keys=$$('.quiz[data-grad]').map(q=>q.dataset.key);
  if(!keys.length) return;
  const n=keys.filter(k=>PROG.has(k)).length;
  const box=$('#gradBox');
  if($('#gradScore')) $('#gradScore').textContent=n+' / '+keys.length;
  if($('#gradMsg')) $('#gradMsg').textContent = n>=keys.length
    ? ((box&&box.dataset.done)||'🎓 全对,本册毕业!')
    : ((box&&box.dataset.wait)||'别急,可以随时回各课复习再来。');
}

/* ---------- 过关检查 & 毕业测验 ---------- */
$$('.quiz').forEach(qz=>{
  qz.querySelectorAll('.q-opt').forEach(b=>b.addEventListener('click',()=>{
    qz.querySelectorAll('.q-opt').forEach(x=>x.classList.remove('ok','bad'));
    const ok=b.dataset.ok==='1';
    b.classList.add(ok?'ok':'bad');
    qz.querySelector('.q-fb').textContent=ok?qz.dataset.fbok:qz.dataset.fbbad;
    if(ok){ markProg(qz.dataset.key); if(qz.dataset.grad) gradUpdate(); }
  }));
});

/* ---------- 手算检查 ---------- */
$$('.try').forEach(t=>{
  const go=()=>{
    const v=parseFloat(t.querySelector('.t-in').value), fb=t.querySelector('.t-fb');
    if(isNaN(v)){ fb.textContent='先填个数字。'; fb.className='t-fb'; return; }
    const ok=Math.abs(v-(+t.dataset.exp))<=+t.dataset.tol;
    fb.textContent=ok?'✓ 正确!':'还差一点——对照上面的算式一步步来。';
    fb.className='t-fb'+(ok?' good':'');
    if(ok) markProg(t.dataset.key);
  };
  t.querySelector('.t-btn').addEventListener('click',go);
  t.querySelector('.t-in').addEventListener('keydown',e=>{ if(e.key==='Enter') go(); });
});

/* ---------- 预测门(页面定义 GATES 后调用 bindGates(GATES)) ---------- */
function bindGates(cfg){
  $$('.g-opt').forEach(b=>b.addEventListener('click',()=>{
    const g=b.dataset.g, c=cfg[g], hit=+b.dataset.i===c.ans;
    const lab=$('#lab-'+g); if(lab) lab.classList.remove('locked');
    const res=$('#gres-'+g);
    res.textContent=(hit?'✓ ':'✗ ')+(hit?c.right:c.wrong);
    res.className='gate-res '+(hit?'good':'miss');
  }));
}

/* ==================== Python 运行器(Pyodide 懒加载) ==================== */
const PY_SRC=[
 {js:'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js',idx:'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/'},
 {js:'https://cdnjs.cloudflare.com/ajax/libs/pyodide/0.23.4/pyodide.js',idx:'https://cdnjs.cloudflare.com/ajax/libs/pyodide/0.23.4/'}];
let pyPromise=null;
function loadScript(u){return new Promise((res,rej)=>{const t=document.createElement('script');t.src=u;t.onload=res;t.onerror=()=>rej(new Error('脚本加载失败'));document.head.appendChild(t);});}
function getPy(status){
  if(pyPromise) return pyPromise;
  pyPromise=(async()=>{
    let err;
    for(const src of PY_SRC){
      try{
        status&&status('正在加载 Python 引擎…(首次约 10~20 秒,请稍候)');
        await loadScript(src.js);
        const py=await loadPyodide({indexURL:src.idx});
        return py;
      }catch(e){ err=e; }
    }
    pyPromise=null;
    throw err||new Error('加载失败');
  })();
  return pyPromise;
}
async function runPy(code,out,btn){
  out.hidden=false; btn.disabled=true; const old=btn.textContent;
  try{
    const py=await getPy(t=>out.textContent=t);
    out.textContent='运行中…'; btn.textContent='运行中…';
    const wrapper='import sys, io\n_b=io.StringIO(); _o=sys.stdout; sys.stdout=_b\n'+
      'try:\n    exec(compile('+JSON.stringify(code)+', "<课程代码>", "exec"), {})\nfinally:\n    sys.stdout=_o\n_b.getvalue()';
    const res=await py.runPythonAsync(wrapper);
    out.textContent=(res&&res.trim())?res:'(程序没有打印任何内容)';
  }catch(e){
    out.textContent='✗ 出错了:'+(e.message||e)+
      '\n提示:首次运行需要联网下载引擎;若始终失败,把代码复制到本地 Python 运行即可,结果完全一样。';
  }
  btn.disabled=false; btn.textContent=old;
}
function copyText(txt,btn){
  const done=()=>{const o=btn.textContent;btn.textContent='已复制 ✓';setTimeout(()=>btn.textContent=o,1400);};
  const fb=()=>{const ta=document.createElement('textarea');ta.value=txt;document.body.appendChild(ta);ta.select();
    try{document.execCommand('copy');done();}catch(e){alert('复制失败,请手动选择代码复制');}
    document.body.removeChild(ta);};
  if(navigator.clipboard&&navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done).catch(fb); else fb();
}
$$('.pyblock').forEach(pb=>{
  const code=pb.querySelector('.pycode').textContent;
  const out=pb.querySelector('.pyout');
  pb.querySelector('.py-copy').addEventListener('click',e=>copyText(code,e.target));
  pb.querySelector('.py-run').addEventListener('click',e=>runPy(code,out,e.target));
});
