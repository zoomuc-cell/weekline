#!/usr/bin/env python3
"""Builds www/ for the iOS app from the published PWA (repo root).

Same app, plus what only a native app can do on iPhone:
  - meeting alerts are handed to iOS, so they arrive even when the app is closed
  - backups go out through the share sheet (Files, AirDrop, mail ...)
"""
import pathlib, shutil, sys

HERE = pathlib.Path(__file__).parent
DIST = HERE.parent  # the published PWA at the repo root
WWW = HERE / 'www'

NATIVE = r'''
/* ---------- iOS app: alerts scheduled by iOS, backup through the share sheet ---------- */
/* runs inside the app scope so it can swap the browser versions of notifRow, wlNotify and wlBackup */
(function(){
  var C=window.Capacitor;if(!C||!C.isNativePlatform||!C.isNativePlatform())return;
  var LN=C.Plugins.LocalNotifications,FS=C.Plugins.Filesystem,SH=C.Plugins.Share;
  var EN=document.documentElement.lang==='en',perm='prompt',last=[];
  var TX=EN?{on:'Device alerts on · meeting prep and departure alerts arrive even when the app is closed.',
             off:'Alerts are off. Turn them on in Settings › WEEKLINE › Notifications.',
             btn:'Turn on meeting alerts',yes:'Meeting alerts are on',no:'Alerts were not allowed',
             saved:'Backup ready to save',fail:'Could not create the backup file'}
           :{on:'기기 알림 켜짐 · 앱을 닫아도 미팅 준비·출발 알림이 옵니다.',
             off:'알림이 꺼져 있습니다. 설정 › WEEKLINE › 알림에서 켜 주세요.',
             btn:'미팅 알림 켜기',yes:'미팅 알림을 켰습니다',no:'알림이 허용되지 않았습니다',
             saved:'백업 파일을 저장할 곳을 고르세요',fail:'백업 파일을 만들지 못했습니다'};
  function hash(s){var h=7;for(var i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))|0;return (h&0x7fffffff)||1;}
  /* iOS keeps at most 64 pending alerts: hand over the next 60, rebuilt on every change */
  function sync(){
    if(perm!=='granted')return;
    var now=Date.now(),list=[];
    last.forEach(function(d){var p=d.id.split('-');if(p.length!==3)return;var v=d.data()||{};
      (v.items||[]).forEach(function(a){
        var t=new Date(+p[0],+p[1]-1,+p[2],0,a.at,0).getTime();if(a.sent||!a.text||t<=now+5000)return;
        list.push({id:hash(d.id+'/'+(a.id||a.at+':'+a.text)),title:'WEEKLINE',body:a.text,schedule:{at:new Date(t),allowWhileIdle:true}});});});
    list.sort(function(x,y){return x.schedule.at-y.schedule.at;});list=list.slice(0,60);
    LN.getPending().then(function(r){var ids=(r.notifications||[]).map(function(n){return {id:n.id};});return ids.length?LN.cancel({notifications:ids}):null;})
      .then(function(){return list.length?LN.schedule({notifications:list}):null;}).catch(function(){});
  }
  wlNotify=function(){};   /* iOS delivers the alerts itself */
  notifRow=function(){
    if(perm==='granted')return '<span class="xs muted">'+TX.on+'</span>';
    if(perm==='denied')return '<span class="xs muted">'+TX.off+'</span>';
    return '<button class="btn" data-act="wlnotif-ios">'+TX.btn+'</button>';
  };
  wlBackup=function(){
    var data={};wlKeys().forEach(function(k){try{data[k.slice(WL.P.length)]=JSON.parse(localStorage.getItem(k));}catch(e){}});
    var name='weekline-backup-'+todayStr()+'.json';
    FS.writeFile({path:name,directory:'CACHE',encoding:'utf8',data:JSON.stringify({app:'WEEKLINE',version:1,exported:new Date().toISOString(),data:data})})
      .then(function(r){toast(TX.saved);return SH.share({title:name,files:[r.uri]});})
      .catch(function(e){if(!/cancel/i.test(String(e&&e.message||e)))toast(TX.fail);});
  };
  document.addEventListener('click',function(e){
    var b=e.target.closest&&e.target.closest('[data-act="wlnotif-ios"]');if(!b)return;
    LN.requestPermissions().then(function(r){perm=r.display;toast(perm==='granted'?TX.yes:TX.no);render();sync();});
  });
  LN.checkPermissions().then(function(r){perm=r.display;render();sync();}).catch(function(){});
  window.claude.use('db').then(function(db){if(db)db.collection('alerts').onSnapshot(function(s){last=s.docs;sync();});});
  document.addEventListener('visibilitychange',function(){if(!document.hidden)LN.checkPermissions().then(function(r){if(r.display!==perm){perm=r.display;render();}sync();});});
})();
'''

CSS = '''/* iOS app: keep content clear of the notch / Dynamic Island */
body{padding-top:env(safe-area-inset-top,0px)}
body::before{content:"";position:fixed;top:0;left:0;right:0;height:env(safe-area-inset-top,0px);background:var(--bg);z-index:60}
</style>'''

INIT = "\nS.ui.meeting=freshMeeting();applyZoom();render();connect();\n"


def patch(src, out, links):
    s = src.read_text(encoding='utf-8')
    def rep(old, new, count=1):
        nonlocal s
        n = s.count(old)
        if n != count:
            sys.exit(f'{src}: expected {count} x {old[:60]!r}, found {n}')
        s = s.replace(old, new)
    # the app has no service worker or web manifest
    rep('<link rel="manifest" href="manifest.webmanifest">', '')
    # the app's file server answers folder paths with the root page, so link to files
    for old, new in links:
        rep(old, new)
    rep('</style>', CSS)
    rep(INIT, NATIVE + INIT)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(s, encoding='utf-8')


if WWW.exists():
    shutil.rmtree(WWW)
WWW.mkdir()
patch(DIST / 'index.html', WWW / 'index.html',
      [('href="en/"', 'href="en/index.html"'), ("location.replace('en/'+location.hash)", "location.replace('en/index.html'+location.hash)")])
patch(DIST / 'en' / 'index.html', WWW / 'en' / 'index.html', [('href="../"', 'href="../index.html"')])
for f in ['privacy.html', 'en/privacy.html']:
    t = (DIST / f).read_text(encoding='utf-8')
    assert t.count('href="./"') == 1, f
    (WWW / f).write_text(t.replace('href="./"', 'href="index.html"'), encoding='utf-8')
for f in ['icon-192.png', 'apple-touch-icon.png']:
    shutil.copy(DIST / f, WWW / f)
for p in sorted(WWW.rglob('*')):
    if p.is_file():
        print(p.relative_to(WWW), p.stat().st_size)
