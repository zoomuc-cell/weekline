// Runs www/ with a stand-in for the iOS / Android bridge and checks the native-only paths.
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim()+'/playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..','www');
const srv=http.createServer((q,r)=>{let f=decodeURIComponent(q.url.split('?')[0]);if(f.endsWith('/'))f+='index.html';const fp=path.join(root,f);
  if(!fp.startsWith(root)||!fs.existsSync(fp)){r.writeHead(404);return r.end();}r.writeHead(200,{'content-type':fp.endsWith('.html')?'text/html; charset=utf-8':'image/png'});fs.createReadStream(fp).pipe(r);}).listen(8772);
const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)process.exitCode=1;};
const MOCK=`window.__calls=[];window.__perm=window.__perm||'prompt';window.__pending=[];
function rec(n,a){__calls.push([n,a]);}
window.__exact=window.__exact||'granted';
window.Capacitor={isNativePlatform:()=>true,getPlatform:()=>window.__plat||'ios',Plugins:{
 LocalNotifications:{checkPermissions:async()=>({display:__perm}),requestPermissions:async()=>{rec('req');__perm='granted';return {display:'granted'};},
  getPending:async()=>({notifications:__pending.map(n=>({id:n.id}))}),cancel:async(a)=>{rec('cancel',a);__pending=[];},schedule:async(a)=>{rec('schedule',a);__pending=a.notifications;return {notifications:a.notifications.map(n=>({id:n.id}))};},
  checkExactNotificationSetting:async()=>({exact_alarm:__exact}),changeExactNotificationSetting:async()=>{rec('exact');__exact='granted';return {exact_alarm:'granted'};}},
 Filesystem:{writeFile:async(a)=>{rec('write',a);return {uri:'file:///cache/'+a.path};}},
 Share:{share:async(a)=>{rec('share',a);return {};}},
 NativePurchases:{__owned:[],getPurchases:async()=>({purchases:window.Capacitor.Plugins.NativePurchases.__owned}),restorePurchases:async()=>{rec('restore');},
  getProducts:async(o)=>{rec('products',o);return {products:o.productType==='subs'?(window.__plat==='android'?[{identifier:'monthly',priceString:'₩2,900',offerToken:'tm'},{identifier:'yearly',priceString:'₩19,900',offerToken:'ty'}]:[{identifier:'weekline_pro_monthly',priceString:'₩2,900'},{identifier:'weekline_pro_yearly',priceString:'₩19,900'}]):[{identifier:'weekline_pro_lifetime',priceString:'₩39,900'}]};},
  purchaseProduct:async(o)=>{rec('buy',o);window.Capacitor.Plugins.NativePurchases.__owned=[{productIdentifier:o.productIdentifier,purchaseState:'1',isActive:true}];return {transactionId:'t1'};}}}};`;
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
  // Android 12+: without the "Alarms & reminders" permission the app offers to turn on on-time alerts
  {
    const ctx=await b.newContext({locale:'ko-KR',viewport:{width:390,height:844}});
    await ctx.addInitScript("window.__plat='android';window.__exact='denied';window.__perm='granted';"+MOCK);
    const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));await p.route(/fonts\./,r=>r.abort());
    await p.goto('http://localhost:8772/');await p.waitForTimeout(800);
    const ex=await p.$('[data-act="wlnotif-exact"]');ok(ex&&(await ex.textContent())==='정시 알림 허용','android: on-time alert button shown');
    await ex.click();await p.waitForTimeout(400);
    ok(await p.evaluate(()=>__calls.some(c=>c[0]==='exact')),'android: opened the alarm permission screen');
    ok(!(await p.$('[data-act="wlnotif-exact"]')),'android: button gone once allowed');
    await p.screenshot({path:__dirname+'/android-ko.png'});
    ok(errs.length===0,'android: no page errors '+errs.join(' | '));
    await ctx.close();
  }
  // PRO: the meeting planner is free for 14 days, then the app sells PRO and the web points to the app
  const OLD="localStorage.setItem('wl_pro_start',String(Date.now()-15*864e5));";
  for(const plat of ['ios','android']){
    const ctx=await b.newContext({locale:'ko-KR',viewport:{width:390,height:844}});
    await ctx.addInitScript("window.__plat='"+plat+"';window.__perm='granted';"+OLD+MOCK);
    const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));await p.route(/fonts\./,r=>r.abort());
    await p.goto('http://localhost:8772/#meeting');await p.waitForTimeout(900);
    const plans=await p.$$eval('[data-act="probuy"]',x=>x.map(e=>e.dataset.v+':'+e.textContent.match(/₩[\d,]+/)));
    ok(JSON.stringify(plans)==='["yearly:₩19,900","monthly:₩2,900","lifetime:₩39,900"]',plat+': trial over → PRO plans with store prices '+JSON.stringify(plans));
    ok((await p.$$('a[href*="apple.com/legal"]')).length===(plat==='ios'?1:0),plat+': Terms of Use (EULA) link '+(plat==='ios'?'shown':'not needed'));
    await p.click('[data-act="probuy"][data-v="yearly"]');await p.waitForTimeout(500);
    const buy=await p.evaluate(()=>__calls.filter(c=>c[0]==='buy').map(c=>c[1]));
    const want=plat==='android'?{productIdentifier:'weekline_pro',productType:'subs',planIdentifier:'yearly',offerToken:'ty'}:{productIdentifier:'weekline_pro_yearly',productType:'subs'};
    ok(buy.length===1&&JSON.stringify(buy[0])===JSON.stringify(want),plat+': yearly purchase request '+JSON.stringify(buy[0]));
    ok(!(await p.$('[data-act="probuy"]'))&&!!(await p.$('[data-act="mscope"]')),plat+': planner unlocked after purchase');
    ok((await p.textContent('#app')).includes('PRO 사용 중'),plat+': shows PRO active');
    if(plat==='ios'){await p.screenshot({path:__dirname+'/pro-after.png'});}
    ok(errs.length===0,plat+': no page errors '+errs.join(' | '));
    await ctx.close();
  }
  {
    // a bought PRO survives a fresh start (store purchase list), and a refunded one is withdrawn
    const ctx=await b.newContext({locale:'ko-KR',viewport:{width:390,height:844}});
    await ctx.addInitScript(OLD+"localStorage.setItem('wl_pro','1');"+MOCK);
    const p=await ctx.newPage();await p.route(/fonts\./,r=>r.abort());await p.goto('http://localhost:8772/#meeting');await p.waitForTimeout(900);
    ok(!!(await p.$('[data-act="probuy"]')),'refunded/expired PRO is withdrawn when the store no longer lists it');
    await p.screenshot({path:__dirname+'/pro-lock.png'});
    await ctx.close();
  }
  {
    const ctx=await b.newContext({locale:'ko-KR',viewport:{width:390,height:844}});
    const p=await ctx.newPage();await p.route(/fonts\./,r=>r.abort());await p.goto('http://localhost:8772/#meeting');await p.waitForTimeout(700);
    ok((await p.textContent('#app')).includes('PRO 무료 체험 14일 남음')&&!!(await p.$('[data-act="mscope"]')),'browser: planner open during the trial with days left');
    await p.evaluate(()=>{localStorage.setItem('wl_pro_start',String(Date.now()-15*864e5));location.hash='today';});await p.waitForTimeout(200);await p.evaluate(()=>{location.hash='meeting';});await p.waitForTimeout(400);
    ok(!(await p.$('[data-act="mscope"]'))&&!(await p.$('[data-act="probuy"]'))&&!!(await p.$('a[href*="play.google.com"]')),'browser: after the trial the web points to the app');
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
