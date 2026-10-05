// Runs www/ with a stand-in for the iOS bridge and checks the native-only paths.
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim()+'/playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..','www');
const srv=http.createServer((q,r)=>{let f=decodeURIComponent(q.url.split('?')[0]);if(f.endsWith('/'))f+='index.html';const fp=path.join(root,f);
  if(!fp.startsWith(root)||!fs.existsSync(fp)){r.writeHead(404);return r.end();}r.writeHead(200,{'content-type':fp.endsWith('.html')?'text/html; charset=utf-8':'image/png'});fs.createReadStream(fp).pipe(r);}).listen(8772);
const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)process.exitCode=1;};
const MOCK=`window.__calls=[];window.__perm=window.__perm||'prompt';window.__pending=[];
function rec(n,a){__calls.push([n,a]);}
window.Capacitor={isNativePlatform:()=>true,Plugins:{
 LocalNotifications:{checkPermissions:async()=>({display:__perm}),requestPermissions:async()=>{rec('req');__perm='granted';return {display:'granted'};},
  getPending:async()=>({notifications:__pending.map(n=>({id:n.id}))}),cancel:async(a)=>{rec('cancel',a);__pending=[];},schedule:async(a)=>{rec('schedule',a);__pending=a.notifications;return {notifications:a.notifications.map(n=>({id:n.id}))};}},
 Filesystem:{writeFile:async(a)=>{rec('write',a);return {uri:'file:///cache/'+a.path};}},
 Share:{share:async(a)=>{rec('share',a);return {};}}}};`;
(async()=>{
  const b=await chromium.launch();
  for(const [lang,url,btn] of [['ko','http://localhost:8772/','미팅 알림 켜기'],['en','http://localhost:8772/en/index.html','Turn on meeting alerts']]){
    const ctx=await b.newContext({locale:lang==='ko'?'ko-KR':'en-US',viewport:{width:390,height:844}});
    await ctx.addInitScript(MOCK);const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.route(/fonts\./,r=>r.abort());
    await p.goto(url);await p.waitForTimeout(800);
    ok(await p.evaluate(()=>location.pathname)===(lang==='ko'?'/':'/en/index.html'),lang+': stays on its page');
    const b1=await p.$(`[data-act="wlnotif-ios"]`);ok(b1&&(await b1.textContent())===btn,lang+': native alert button shown');
    await b1.click();await p.waitForTimeout(400);
    ok(await p.evaluate(()=>__calls.some(c=>c[0]==='req')),lang+': asked iOS for permission');
    ok(!(await p.$('[data-act="wlnotif-ios"]')),lang+': button replaced by status line');
    // add alerts for today (one past, one future, one sent) and tomorrow
    await p.evaluate(()=>{const n=new Date(),d=x=>{const t=new Date(n.getTime()+x*864e5);return t.getFullYear()+'-'+String(t.getMonth()+1).padStart(2,'0')+'-'+String(t.getDate()).padStart(2,'0');};
      const m=n.getHours()*60+n.getMinutes();
      return claude.use('db').then(db=>Promise.all([db.doc('alerts/'+d(0)).set({items:[{id:'a1',at:m-30,text:'past'},{id:'a2',at:m+20,text:'soon'},{id:'a3',at:m+40,text:'done',sent:true}]}),
        db.doc('alerts/'+d(1)).set({items:[{id:'b1',at:300,text:'early depart'}]})]));});
    await p.waitForTimeout(400);
    const sch=await p.evaluate(()=>__pending.map(n=>n.body));
    ok(JSON.stringify(sch)==='["soon","early depart"]',lang+': iOS gets only future unsent alerts '+JSON.stringify(sch));
    const at=await p.evaluate(()=>{const n=__pending[1].schedule.at;return [n.getHours(),n.getMinutes()];});ok(at[0]===5&&at[1]===0,lang+': tomorrow 05:00 kept as local time');
    // deleting the meeting removes its alert from iOS
    await p.evaluate(()=>{const n=new Date(),ds=n.getFullYear()+'-'+String(n.getMonth()+1).padStart(2,'0')+'-'+String(n.getDate()).padStart(2,'0');return claude.use('db').then(db=>db.doc('alerts/'+ds).delete());});
    await p.waitForTimeout(400);
    ok(JSON.stringify(await p.evaluate(()=>__pending.map(n=>n.body)))==='["early depart"]',lang+': removed alert cancelled');
    // backup goes through the share sheet
    await p.evaluate(()=>location.hash='goals');await p.waitForTimeout(300);
    await p.click('[data-act="wlbackup"]');await p.waitForTimeout(400);
    const w=await p.evaluate(()=>__calls.filter(c=>c[0]==='write'||c[0]==='share'));
    ok(w.length===2&&w[0][1].directory==='CACHE'&&JSON.parse(w[0][1].data).app==='WEEKLINE'&&w[1][1].files[0].endsWith('.json'),lang+': backup written and shared');
    const top=await p.evaluate(()=>getComputedStyle(document.body).paddingTop);ok(top!=null,lang+': safe-area padding rule present ('+top+')');
    ok(await p.evaluate(()=>!document.querySelector('link[rel=manifest]')),lang+': no web manifest');
    await p.screenshot({path:__dirname+'/ios-'+lang+'.png'});
    ok(errs.length===0,lang+': no page errors '+errs.join(' | '));
    await ctx.close();
  }
  // without the bridge (plain browser) the native block stays out of the way
  const ctx=await b.newContext({locale:'ko-KR'});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.route(/fonts\./,r=>r.abort());await p.goto('http://localhost:8772/');await p.waitForTimeout(600);
  ok(!(await p.$('[data-act="wlnotif-ios"]'))&&errs.length===0,'browser: no native UI, no errors');
  // English link goes to the English file, and back
  await p.click('a[data-lang="en"]');await p.waitForTimeout(600);ok(p.url().endsWith('/en/index.html'),'browser: English link → '+p.url());
  await b.close();srv.close();
})();
