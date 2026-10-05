// Renders the App Store icon (1024, no alpha) and the launch splash from icon.svg.
// Usage: node resources/make-assets.js   (needs Playwright + ImageMagick)
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const { execFileSync } = require('child_process');
const fs = require('fs'), path = require('path');
const svg = fs.readFileSync(path.join(__dirname, 'icon.svg'), 'utf8');
const A = path.join(__dirname, '..', 'ios', 'App', 'App', 'Assets.xcassets');
(async () => {
  const b = await chromium.launch(), p = await b.newPage();
  const shot = async (size, html, out) => {
    await p.setViewportSize({ width: size, height: size });
    await p.setContent(`<style>html,body{margin:0;width:${size}px;height:${size}px}svg{display:block;width:100%;height:100%}</style>${html}`);
    await p.screenshot({ path: out });
    execFileSync('convert', [out, '-alpha', 'off', out]);
  };
  await shot(1024, svg, path.join(A, 'AppIcon.appiconset', 'AppIcon-512@2x.png'));
  const splash = `<div style="width:100%;height:100%;background:#F5F3EC;display:grid;place-items:center"><div style="width:420px;height:420px;border-radius:96px;overflow:hidden">${svg}</div></div>`;
  for (const f of ['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png'])
    await shot(2732, splash, path.join(A, 'Splash.imageset', f));
  await b.close(); console.log('assets ok');
})();
