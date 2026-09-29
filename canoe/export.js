// Renders every frame of index.html to out/frames/*.png with headless Chromium
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
(async () => {
  const dir = path.join(__dirname, 'out', 'frames');
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.on('pageerror', e => { console.error('PAGE ERROR', e); process.exit(1); });
  await page.goto('file://' + path.join(__dirname, 'index.html') + '?export=1');
  await page.waitForFunction(() => window.READY);
  const n = await page.evaluate(() => window.TOTAL_FRAMES);
  for (let i = 0; i < n; i++) {
    const url = await page.evaluate(i => window.exportFrame(i), i);
    fs.writeFileSync(path.join(dir, `f${String(i).padStart(3, '0')}.png`), Buffer.from(url.split(',')[1], 'base64'));
  }
  console.log('frames:', n);
  await browser.close();
})();
