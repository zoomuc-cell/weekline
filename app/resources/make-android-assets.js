// Renders the Android launcher icons, splash screens and the Google Play listing graphics from icon.svg.
// Usage: node resources/make-android-assets.js   (needs Playwright + ImageMagick; run build_www.py first for the screenshots)
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const { execFileSync } = require('child_process');
const fs = require('fs'), path = require('path');
const svg = fs.readFileSync(path.join(__dirname, 'icon.svg'), 'utf8');
const glyph = svg.replace(/<rect [^>]*\/>/, '');           // the mark alone, transparent background
const RES = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'res');
const PLAY = path.join(__dirname, '..', 'play');
const DENS = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
(async () => {
  const b = await chromium.launch(), p = await b.newPage();
  const shot = async (w, h, html, out, opaque = true) => {
    fs.mkdirSync(path.dirname(out), { recursive: true });
    await p.setViewportSize({ width: w, height: h });
    await p.setContent(`<style>html,body{margin:0;width:${w}px;height:${h}px;background:transparent}svg{display:block;width:100%;height:100%}</style>${html}`);
    await p.screenshot({ path: out, omitBackground: !opaque });
    if (opaque) execFileSync('convert', [out, '-alpha', 'off', out]);
  };
  for (const [d, k] of Object.entries(DENS)) {
    const dir = path.join(RES, `mipmap-${d}`), s = Math.round(48 * k), f = Math.round(108 * k);
    await shot(s, s, `<div style="width:100%;height:100%;border-radius:12%;overflow:hidden">${svg}</div>`, path.join(dir, 'ic_launcher.png'), false);
    await shot(s, s, `<div style="width:100%;height:100%;border-radius:50%;overflow:hidden">${svg}</div>`, path.join(dir, 'ic_launcher_round.png'), false);
    // adaptive foreground: the mark inside the 66dp safe zone of the 108dp canvas
    await shot(f, f, `<div style="width:100%;height:100%;display:grid;place-items:center"><div style="width:61%;height:61%">${glyph}</div></div>`, path.join(dir, 'ic_launcher_foreground.png'), false);
  }
  const splash = (w, h) => { const s = Math.round(Math.min(w, h) * 0.3);
    return `<div style="width:100%;height:100%;background:#F5F3EC;display:grid;place-items:center"><div style="width:${s}px;height:${s}px;border-radius:22%;overflow:hidden">${svg}</div></div>`; };
  const SPL = { mdpi: [320, 480], hdpi: [480, 800], xhdpi: [720, 1280], xxhdpi: [960, 1600], xxxhdpi: [1280, 1920] };
  for (const [d, [w, h]] of Object.entries(SPL)) {
    await shot(w, h, splash(w, h), path.join(RES, `drawable-port-${d}`, 'splash.png'));
    await shot(h, w, splash(h, w), path.join(RES, `drawable-land-${d}`, 'splash.png'));
  }
  await shot(480, 320, splash(480, 320), path.join(RES, 'drawable', 'splash.png'));

  // Google Play listing: 512 icon, 1024x500 feature graphic, phone screenshots (1080x2160)
  await shot(512, 512, svg, path.join(PLAY, 'icon-512.png'));
  await shot(1024, 500, `<div style="width:100%;height:100%;background:#1E5B47;display:flex;align-items:center;gap:56px;padding:0 90px;box-sizing:border-box;font-family:'Noto Sans KR','Apple SD Gothic Neo',sans-serif;color:#F5F3EC">
      <div style="width:240px;height:240px;flex:none;border-radius:54px;overflow:hidden;box-shadow:0 0 0 6px #A9C9B8">${svg}</div>
      <div><div style="font-size:84px;font-weight:800;letter-spacing:2px">WEEKLINE</div>
      <div style="font-size:38px;margin-top:14px;opacity:.9">한 주를 한 줄로 · 큰 돌부터</div></div></div>`, path.join(PLAY, 'feature-1024x500.png'));
  const www = path.join(__dirname, '..', 'www');
  if (fs.existsSync(path.join(www, 'index.html'))) {
    for (const [lang, file] of [['ko', 'index.html'], ['en', 'en/index.html']]) {
      const ctx = await b.newContext({ viewport: { width: 405, height: 810 }, deviceScaleFactor: 1080 / 405, locale: lang === 'ko' ? 'ko-KR' : 'en-US' });
      const q = await ctx.newPage();
      await q.goto('file://' + path.join(www, file));
      await q.waitForTimeout(1200);
      await q.screenshot({ path: path.join(PLAY, `screenshot-${lang}-1.png`) });
      await ctx.close();
    }
  }
  await b.close(); console.log('android assets ok');
})();
