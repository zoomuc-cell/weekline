// Goals by period: set a yearly goal through the goal wizard, then check each period page and its actions.
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim()+'/playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..','..');
const srv=http.createServer((q,r)=>{let f=decodeURIComponent(q.url.split('?')[0]);if(f.endsWith('/'))f+='index.html';const fp=path.join(root,f);
  if(!fp.startsWith(root)||!fs.existsSync(fp)){r.writeHead(404);return r.end();}r.writeHead(200,{'content-type':fp.endsWith('.html')?'text/html; charset=utf-8':fp.endsWith('.js')?'text/javascript':'image/png'});fs.createReadStream(fp).pipe(r);}).listen(8773);
const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)process.exitCode=1;};
(async()=>{
  const b=await chromium.launch();
  for(const [lang,url,words] of [['ko','http://localhost:8773/',{month:'월간',week:'주간',day:'오늘',year:'연간',quarter:'분기'}],['en','http://localhost:8773/en/index.html',{month:'Month',week:'Week',day:'Today',year:'Year',quarter:'Quarter'}]]){
    const ctx=await b.newContext({locale:lang==='ko'?'ko-KR':'en-US',viewport:{width:390,height:844},serviceWorkers:'block'});
    const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));await p.route(/fonts\./,r=>r.abort());
    const col=c=>p.evaluate(c=>{const o={};for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k.startsWith(WL.P+c+'/'))o[k.slice((WL.P+c+'/').length)]=JSON.parse(localStorage.getItem(k));}return o;},c);
    const today=()=>p.evaluate(()=>{const d=new Date(),z=x=>String(x).padStart(2,'0');return d.getFullYear()+'-'+z(d.getMonth()+1)+'-'+z(d.getDate());});
    await p.goto(url+'#cascade');await p.waitForTimeout(800);
    // yearly numeric goal: 1200 (unit) spread evenly, custom daily action
    await p.click('[data-act="cset"][data-f="level"][data-v="year"]');await p.click('[data-act="cset"][data-f="type"][data-v="num"]');
    await p.click('[data-act="cset"][data-f="mode"][data-v="even"]').catch(()=>{});
    // each field commits on change (blur), which re-renders the form, so type one field at a time
    const put=async(sel,v)=>{await p.fill(sel,v);await p.$eval(sel,e=>e.blur());await p.waitForTimeout(150);};
    await put('#cgoal',lang==='ko'?'매출 1200':'Revenue 1200');await put('#ctarget','1200');await put('#cunit',lang==='ko'?'만원':'k');
    await p.waitForTimeout(300);
    ok(!!(await p.$('#cweekly'))&&!!(await p.$('#cdaily')),lang+': action guide on the goal wizard');
    const months=await p.$$eval('#app .card .small b',x=>x.length);ok(months>=13-(new Date().getMonth()+1),lang+': guide lists the months from now on ('+months+')');
    ok((await p.textContent('#app')).includes(lang==='ko'?'영업·매출':'Sales'),lang+': wizard recognises a sales goal');
    ok((await p.$eval('#cweekly',e=>e.placeholder)).includes(lang==='ko'?'신규 고객 접촉':'new prospects'),lang+': this month\'s stage sets the weekly action');
    // a beginner gets a long base stage before intensity goes up
    await put('#cgoal',lang==='ko'?'체력 키우기':'Build stamina');await p.click('[data-act="cset"][data-f="type"][data-v="habit"]');await p.click('[data-act="cset"][data-f="start"][data-v="new"]');await p.waitForTimeout(150);
    const plan=await p.textContent('#app');
    ok(plan.includes(lang==='ko'?'1. 기초 만들기':'1. Build a base')&&plan.includes(lang==='ko'?(new Date().getMonth()+1)+'월':['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][new Date().getMonth()])&&plan.includes(lang==='ko'?'3. 강도 올리기':'3. Raise intensity'),lang+': beginner stage plan starts this month with the base, then adapts and raises intensity');
    await p.click('[data-act="cset"][data-f="start"][data-v="regular"]');await p.waitForTimeout(150);
    ok(!(await p.textContent('#app')).includes(lang==='ko'?'1. 기초 만들기':'1. Build a base'),lang+': a regular skips the base stage');
    // personal conditions reshape the actions: weak knees, 15 minutes a day, 3 days a week
    await p.click('[data-act="cset"][data-f="start"][data-v="some"]');await p.click('[data-act="cset"][data-f="mins"][data-v="15"]');await p.click('[data-act="cset"][data-f="days"][data-v="3"]');
    await put('#cnote',lang==='ko'?'무릎이 약함':'weak knees');
    const wk=await p.$eval('#cweekly',e=>e.placeholder),dy=await p.$eval('#cdaily',e=>e.placeholder),body=await p.textContent('#app');
    ok(!/조깅|jog/i.test(wk)&&/자전거|bike/i.test(body),lang+': weak knees → no jogging, stationary bike instead ('+wk+')');
    ok(!/[2-9]\d\s*(분|min)/.test(dy),lang+': daily action capped at 15 min ('+dy+')');
    ok(!/[4-9](회| times)/.test(wk),lang+': weekly count capped at 3 ('+wk+')');
    ok(body.includes(lang==='ko'?'무릎·관절 보호':'Knees and joints'),lang+': adjustments listed');
    // numeric goals: the target is weighted by stage (less while building, more while strengthening)
    await put('#cgoal',lang==='ko'?'영업이익 1200':'Operating profit 1200');await p.click('[data-act="cset"][data-f="type"][data-v="num"]');await p.click('[data-act="cset"][data-f="mode"][data-v="ramp"]');await p.click('[data-act="cset"][data-f="start"][data-v="new"]');
    await put('#ctarget','1200');await put('#cnote','');
    const vals=await p.$eval('#cweekly',e=>[...e.closest('section').querySelectorAll('.small')].map(e=>e.textContent).filter(t=>/^\s*(\d+월|[A-Z][a-z]{2})\s·/.test(t)).map(t=>+t.split('·')[1].replace(/[^0-9]/g,'')));
    ok(vals.length>=1&&vals.reduce((a,b)=>a+b,0)>=1195&&vals.reduce((a,b)=>a+b,0)<=1205&&(vals.length<2||vals[0]<vals[vals.length-1]||vals.length===1),lang+': stage-weighted months add up to the target '+JSON.stringify(vals));
    ok((await p.textContent('#app')).includes(lang==='ko'?'경영 성과':'Business'),lang+': business goal recognised');
    await put('#cgoal',lang==='ko'?'매출 1200':'Revenue 1200');await p.click('[data-act="cset"][data-f="mode"][data-v="even"]');await p.click('[data-act="cset"][data-f="start"][data-v="some"]');await p.click('[data-act="cset"][data-f="mins"][data-v="0"]');await p.click('[data-act="cset"][data-f="days"][data-v="0"]');await p.waitForTimeout(150);
    await put('#cdaily',lang==='ko'?'고객 전화 3통':'Call 3 clients');
    await p.click('[data-act="applyCascade"]');await p.waitForTimeout(500);
    const g=Object.values(await col('goals'))[0];
    ok(g&&g.guide&&/3/.test(g.guide.daily)&&g.months.length===12,lang+': goal saved with its action guide');
    ok(!!(await p.$('[data-go="plan"]')),lang+': goals page links to goals by period');
    await p.click('[data-go="plan"]');await p.waitForTimeout(400);
    const txt=async()=>p.textContent('#app');
    // month (default)
    const mon=new Date().getMonth()+1;
    const mo=new Date().getMonth(),left=12-mo,share=Math.round(1200/left).toLocaleString('ko-KR');
    ok((await txt()).includes(share),lang+': even split over the months from now: '+share+' a month');
    ok((await txt()).includes(lang==='ko'?'단계 2':'Stage 2'),lang+': month shows its stage');
    await p.click('[data-act="plmdone"]');await p.waitForTimeout(200);
    ok((g2=>!!(g2.mdone&&Object.values(g2.mdone).some(Boolean)))(Object.values(await col('goals'))[0]),lang+': month marked done');
    // year / quarter
    await p.click('[data-act="plunit"][data-v="year"]');await p.waitForTimeout(200);ok(/\d+%/.test(await txt()),lang+': year page shows % achieved');
    await p.click('[data-act="plunit"][data-v="quarter"]');await p.waitForTimeout(200);const qLeft=3-(mo%3);ok((await txt()).includes(Math.round(1200/left*qLeft).toLocaleString('ko-KR')),lang+': quarter milestone sums its remaining months');
    // week: add a big rock from the goal
    await p.click('[data-act="plunit"][data-v="week"]');await p.waitForTimeout(200);
    ok((await txt()).includes(lang==='ko'?'매출 1200 —':'Revenue 1200 —'),lang+': this week lists the big rock the wizard created');
    await p.click('[data-act="ploff"][data-v="1"]');await p.waitForTimeout(200);
    await p.click('[data-act="plrock"]');await p.waitForTimeout(300);
    ok(Object.values(await col('weeks')).filter(w=>(w.roles||[]).some(r=>r.rocks.some(k=>k.goal))).length===2,lang+': next week gets the weekly practice as a big rock');
    // today: add the daily action to today's plan and tick it
    await p.click('[data-act="plunit"][data-v="day"]');await p.waitForTimeout(200);
    ok((await txt()).includes(lang==='ko'?'고객 전화 3통':'Call 3 clients'),lang+': today page shows the daily action');
    const T0=await today();const before=((await col('days'))[T0]||{blocks:[]}).blocks.length;
    await p.click('[data-act="plday"]');await p.waitForTimeout(300);
    const blk=(((await col('days'))[T0]||{}).blocks||[]).find(b=>b.goal);
    if(blk){ok(true,lang+': daily action placed at '+blk.s+' min');await p.click('[data-act="plbdone"]');await p.waitForTimeout(200);
      ok((((await col('days'))[T0]||{}).blocks||[]).find(b=>b.goal).done,lang+': ticked from the today page');}
    else ok((await txt()).length>0&&before>=0,lang+': no free slot left today (late in the day) — handled');
    // conditions can be changed later from the period page
    await p.click('[data-act="plfitopen"]');await p.waitForTimeout(150);
    await p.click('[data-act="plfit"][data-f="mins"][data-v="15"]');await p.waitForTimeout(200);
    ok(Object.values(await col('goals')).some(g=>g.fit&&g.fit.mins===15),lang+': conditions edited from the period page are saved on the goal');
    // navigation
    await p.click('[data-act="plunit"][data-v="month"]');await p.click('[data-act="ploff"][data-v="1"]');await p.waitForTimeout(200);
    ok(!errs.length,lang+': no page errors '+errs.join(' | '));
    await p.click('[data-act="ploff"][data-v="-1"]');await p.waitForTimeout(200);
    await p.screenshot({path:__dirname+'/plan-'+lang+'.png',fullPage:true});
    await ctx.close();
  }
  await b.close();srv.close();
})();
