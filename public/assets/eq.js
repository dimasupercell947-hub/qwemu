(() => {
  'use strict';
  const audio=document.querySelector('#audio'), transport=document.querySelector('.transport'), volume=document.querySelector('.volume-control');
  if(!audio||!transport||!volume||window.__QWEMU_EQ__)return;window.__QWEMU_EQ__=true;
  const key='qwemu.eq.v1', bands=[['60 Hz','lowshelf',60],['250 Hz','peaking',250],['1 kHz','peaking',1000],['4 kHz','peaking',4000],['12 kHz','highshelf',12000]];
  const presets={'Плоский':[0,0,0,0,0],'Бас':[5,3,0,-1,1],'Рок':[3,2,-1,2,3],'Поп':[2,1,1,2,1],'Вокал':[-2,-1,2,3,1],'Тихий вечер':[2,0,1,0,-1]};
  const clamp=x=>Math.max(-12,Math.min(12,Number(x)||0)), reduced=()=>document.documentElement.classList.contains('reduce-motion')||matchMedia('(prefers-reduced-motion: reduce)').matches;
  let saved={};try{saved=JSON.parse(localStorage.getItem(key)||'{}')||{};}catch{}
  let gains=Array.isArray(saved.gains)&&saved.gains.length===5?saved.gains.map(clamp):[0,0,0,0,0],enabled=saved.enabled!==false;
  let ac=null,src=null,filters=[],analyser=null,raf=0;
  function graph(){if(ac)return true;const AC=window.AudioContext||window.webkitAudioContext;if(!AC)throw Error('Web Audio API недоступен в этом WebView');ac=new AC();src=ac.createMediaElementSource(audio);filters=bands.map(b=>{const f=ac.createBiquadFilter();f.type=b[1];f.frequency.value=b[2];if(b[1]==='peaking')f.Q.value=1;return f;});analyser=ac.createAnalyser();analyser.fftSize=256;analyser.smoothingTimeConstant=.82;src.connect(filters[0]);filters.forEach((f,i)=>f.connect(filters[i+1]||analyser));analyser.connect(ac.destination);apply();return true;}
  function save(){try{localStorage.setItem(key,JSON.stringify({gains,enabled}));}catch{}}
  function apply(){filters.forEach((f,i)=>f.gain.value=enabled?gains[i]:0);toggle.textContent=enabled?'Включён':'Выключен';toggle.classList.toggle('on',enabled);toggle.setAttribute('aria-pressed',String(enabled));status.textContent=enabled?'EQ активен':'EQ отключён';save();}
  function init(){try{graph();if(ac.state==='suspended')ac.resume();return true;}catch(e){status.textContent=e.message;return false;}}
  const canvas=document.createElement('canvas');canvas.className='qwemu-wave';canvas.setAttribute('role','img');canvas.setAttribute('aria-label','Визуализация звучания');transport.insertBefore(canvas,transport.querySelector('.transport-buttons'));const g=canvas.getContext('2d');
  const resize=()=>{let r=canvas.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,2);canvas.width=Math.max(1,r.width*d);canvas.height=Math.max(1,r.height*d);g.setTransform(d,0,0,d,0,0);};resize();new ResizeObserver(resize).observe(canvas);
  function draw(){let r=canvas.getBoundingClientRect(),w=r.width,h=r.height;g.clearRect(0,0,w,h);let data=null;if(analyser&&!audio.paused&&!audio.ended){data=new Uint8Array(analyser.frequencyBinCount);analyser.getByteFrequencyData(data);}const n=40,gap=2.1,bw=Math.max(1,(w-(n-1)*gap)/n);for(let i=0;i<n;i++){let amp=data?Math.max(.06,data[Math.floor(i/n*data.length)]/255):.055;if(data&&!reduced())amp*=1+Math.sin(performance.now()/320+i*.55)*.14;let bh=Math.max(2,amp*h*.82),y=(h-bh)/2,x=i*(bw+gap);let grad=g.createLinearGradient(0,y,0,y+bh);grad.addColorStop(0,'#f3a05a');grad.addColorStop(1,'#df4c49');g.fillStyle=grad;g.beginPath();g.roundRect(x,y,bw,bh,Math.min(bw/2,3));g.fill();}if(data&&!reduced())raf=requestAnimationFrame(draw);else raf=0;}
  function run(){if(!raf)draw();}function halt(){if(raf)cancelAnimationFrame(raf);raf=0;draw();}
  audio.addEventListener('play',()=>{if(init())run();});audio.addEventListener('pause',halt);audio.addEventListener('ended',halt);document.addEventListener('visibilitychange',()=>document.hidden?halt():(!audio.paused&&run()));
  const open=document.createElement('button');open.className='eq-open-button';open.type='button';open.title='Эквалайзер';open.setAttribute('aria-label','Открыть эквалайзер');open.innerHTML='<span aria-hidden="true">▥</span> EQ';volume.insertBefore(open,volume.firstChild);
  const panel=document.createElement('section');panel.className='eq-panel';panel.hidden=true;panel.innerHTML='<header class="eq-header"><div><div class="eq-overline">QWEMU AUDIO LAB</div><h2>Эквалайзер</h2></div><button class="eq-close" type="button" aria-label="Закрыть">×</button></header><div class="eq-presets"><select class="eq-preset" aria-label="Пресет"></select><button class="eq-reset" type="button">Сброс</button></div><div class="eq-bands"></div><footer class="eq-footer"><span class="eq-status">Готов</span><button class="eq-toggle" type="button" aria-pressed="true">Включён</button></footer>';document.body.append(panel);
  const toggle=panel.querySelector('.eq-toggle'),status=panel.querySelector('.eq-status'),select=panel.querySelector('.eq-preset'),holder=panel.querySelector('.eq-bands');
  Object.keys(presets).forEach(name=>{let o=document.createElement('option');o.value=name;o.textContent=name;select.append(o);});
  bands.forEach((b,i)=>{let label=document.createElement('label');label.className='eq-band';label.innerHTML='<span class="eq-val">0 dB</span><input type="range" min="-12" max="12" step=".5" value="'+gains[i]+'" aria-label="'+b[0]+' gain"><span class="eq-name">'+b[0]+'</span>';let input=label.querySelector('input');const text=label.querySelector('.eq-val');text.textContent=(gains[i]>0?'+':'')+gains[i]+' dB';input.addEventListener('input',()=>{gains[i]=clamp(input.value);text.textContent=(gains[i]>0?'+':'')+gains[i]+' dB';select.value='';if(init())apply();});holder.append(label);});
  function sync(){holder.querySelectorAll('input').forEach((el,i)=>{el.value=gains[i];el.previousElementSibling.textContent=(gains[i]>0?'+':'')+gains[i]+' dB';});}
  select.addEventListener('change',()=>{if(!presets[select.value])return;gains=[...presets[select.value]];sync();if(init())apply();});
  panel.querySelector('.eq-reset').addEventListener('click',()=>{gains=[0,0,0,0,0];select.value='Плоский';sync();if(init())apply();});
  toggle.addEventListener('click',()=>{if(init()){enabled=!enabled;apply();}});
  const close=()=>{panel.hidden=true;open.classList.remove('active');open.focus();};panel.querySelector('.eq-close').addEventListener('click',close);
  open.addEventListener('click',()=>{panel.hidden=!panel.hidden;open.classList.toggle('active',!panel.hidden);if(!panel.hidden)init();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden)close();});
  document.addEventListener('click',e=>{if(e.target.closest('#play,[data-action="play-track"]'))init();},true);
  apply();halt();
})();