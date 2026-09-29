// Renders index.html frame by frame in headless Chromium and pipes JPEGs into ffmpeg.
// Usage: NODE_PATH=$(npm root -g) node export.js [--frames a,b,c]  (--frames dumps stills to out/stills)
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs'), path = require('path');

(async () => {
  const out = path.join(__dirname, 'out');
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.on('pageerror', e => { console.error('PAGE ERROR', e); process.exit(1); });
  await page.goto('file://' + path.join(__dirname, 'index.html') + '?export=1');
  await page.waitForFunction(() => window.READY, null, { timeout: 120000 });
  const n = await page.evaluate(() => window.TOTAL_FRAMES);
  const fps = await page.evaluate(() => window.FPS);

  const fi = process.argv.indexOf('--frames');
  if (fi > 0) {
    const dir = path.join(out, 'stills');
    fs.mkdirSync(dir, { recursive: true });
    for (const f of process.argv[fi + 1].split(',').map(Number)) {
      const url = await page.evaluate(f => window.exportFrame(f, 0.9), f);
      fs.writeFileSync(path.join(dir, `f${String(f).padStart(3, '0')}.jpg`), Buffer.from(url.split(',')[1], 'base64'));
    }
    await browser.close();
    return;
  }

  const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(fps), '-i', '-',
    '-vf', 'fps=30,format=yuv420p', '-c:v', 'libx264', '-preset', 'slow', '-crf', '24', '-movflags', '+faststart',
    path.join(out, 'story.mp4')], { stdio: ['pipe', 'inherit', 'inherit'] });
  const t0 = Date.now();
  for (let i = 0; i < n; i++) {
    const url = await page.evaluate(i => window.exportFrame(i, 0.95), i);
    if (!ff.stdin.write(Buffer.from(url.split(',')[1], 'base64'))) await new Promise(r => ff.stdin.once('drain', r));
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  console.log(`frames: ${n} in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  await browser.close();
})();
