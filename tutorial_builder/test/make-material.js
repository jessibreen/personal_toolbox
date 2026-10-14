// Builds a synthetic narrated "screen recording" of a QGIS buffer workflow for testing.
// Needs ffmpeg on the PATH. Writes test/material/ (git-ignored).
const fs = require('fs'), os = require('os'), path = require('path'), { execFileSync } = require('child_process');
const OUT = path.join(__dirname, 'material');
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), 'tutorial-builder-'));   // scratch audio and screens
const meSpeak = require('mespeak');
meSpeak.loadConfig(require('mespeak/src/mespeak_config.json'));
meSpeak.loadVoice(require('mespeak/voices/en/en-us.json'));
const { chromium } = require('playwright');

// [screen state, narration, pause after (s)]
const script = [
  ['map', 'Okay, so in this video we will find the homes that are within thirty meters of a stream. I have the streams layer and the homes layer loaded.', 0.9],
  ['map', 'The streams are already in a projection that uses meters.', 1.6],
  ['menu', 'First, open the Vector menu, then Geoprocessing Tools, and choose Buffer.', 1.6],
  ['dialog', 'In the buffer dialog, set the input layer to streams.', 1.2],
  ['dialog30', 'Then set the distance to thirty meters, and tick dissolve result.', 1.8],
  ['buffer', 'Click run. The buffer layer shows a strip along every stream.', 1.7],
  ['select', 'Now open Vector, Research Tools, Select by Location. Select features from homes that intersect the stream buffer.', 1.7],
  ['selected', 'Click run, and the homes near the streams are selected. That is it.', 1.2],
];

function screenHtml(state) {
  const menu = ['Project', 'Edit', 'View', 'Layer', 'Settings', 'Plugins', 'Vector', 'Raster', 'Database', 'Web', 'Processing', 'Help']
    .map((m) => `<span class="m${m === 'Vector' && (state === 'menu' || state === 'select') ? ' on' : ''}">${m}</span>`).join('');
  const homes = [[300, 420], [380, 360], [520, 300], [610, 470], [700, 250], [820, 330], [900, 520], [460, 560], [1000, 280], [1080, 420]];
  const near = new Set([1, 2, 4, 8]);
  const showBuf = ['buffer', 'select', 'selected'].includes(state);
  const pts = homes.map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="7" fill="${state === 'selected' && near.has(i) ? '#ffe600' : '#c0392b'}" stroke="#333"/>`).join('');
  const stream = 'M120,560 C300,420 360,300 520,290 S760,250 1150,300';
  const dialog = (title, body) => `<div class="dlg"><div class="dt">${title}</div>${body}<div class="btns"><span class="b">Run</span><span class="b">Close</span></div></div>`;
  let overlay = '';
  if (state === 'menu') overlay = `<div class="dd" style="left:388px"><div>Geoprocessing Tools ▸</div><div>Geometry Tools ▸</div><div>Analysis Tools ▸</div><div>Research Tools ▸</div><div>Data Management Tools ▸</div></div>
     <div class="dd" style="left:598px;top:62px"><div>Buffer…</div><div>Clip…</div><div>Convex Hull…</div><div>Difference…</div><div>Dissolve…</div><div>Intersection…</div></div>`;
  if (state === 'dialog' || state === 'dialog30') overlay = dialog('Buffer', `<label>Input layer</label><div class="f">streams [EPSG:32617]</div><label>Distance</label><div class="f">${state === 'dialog30' ? '30' : '10'} &nbsp; meters</div><label><span class="cb">${state === 'dialog30' ? '✔' : ''}</span> Dissolve result</label><label>Buffered</label><div class="f">[Create temporary layer]</div>`);
  if (state === 'select') overlay = dialog('Select by Location', `<label>Select features from</label><div class="f">homes</div><label>Where the features (geometric predicate)</label><div class="f">☑ intersect &nbsp; ☐ contain &nbsp; ☐ disjoint</div><label>By comparing to the features from</label><div class="f">Buffered</div>`);
  const layers = ['homes', 'streams'].concat(showBuf ? ['Buffered'] : []).reverse().map((l) => `<div class="ly">☑ ${l}</div>`).join('');
  return `<!doctype html><html><body style="margin:0;font:15px Arial,sans-serif;background:#ececec">
  <style>.bar{height:32px;background:#f6f6f6;border-bottom:1px solid #ccc;display:flex;gap:4px;padding:0 8px;align-items:center}
  .m{padding:5px 9px}.m.on{background:#3874d8;color:#fff}.tb{height:40px;background:#e3e3e3;border-bottom:1px solid #ccc}
  .side{position:absolute;left:0;top:73px;width:230px;bottom:0;background:#fafafa;border-right:1px solid #bbb;padding:10px}
  .ly{padding:6px 4px}.map{position:absolute;left:231px;top:73px;right:0;bottom:0;background:#fff}
  .dd{position:absolute;top:32px;background:#fff;border:1px solid #999;box-shadow:2px 3px 8px rgba(0,0,0,.3);min-width:210px}
  .dd div{padding:7px 14px}.dd div:first-child{background:#3874d8;color:#fff}
  .dlg{position:absolute;left:470px;top:150px;width:520px;background:#f2f2f2;border:1px solid #888;box-shadow:4px 6px 20px rgba(0,0,0,.35);padding:0 0 14px}
  .dt{background:#d9d9d9;padding:8px 12px;font-weight:bold}.dlg label{display:block;margin:12px 16px 4px}.f{margin:0 16px;padding:6px 8px;background:#fff;border:1px solid #aaa}
  .cb{display:inline-block;width:14px;height:14px;border:1px solid #555;background:#fff;font-size:12px;line-height:14px;text-align:center}
  .btns{text-align:right;margin:16px 16px 0}.b{display:inline-block;padding:6px 16px;border:1px solid #888;background:#fff;margin-left:8px}</style>
  <div class="bar">${menu}</div><div class="tb"></div><div class="side"><b>Layers</b>${layers}</div>
  <div class="map"><svg width="1209" height="827" viewBox="0 0 1209 827">
  ${showBuf ? `<path d="${stream}" fill="none" stroke="rgba(80,160,255,.35)" stroke-width="60" stroke-linecap="round"/>` : ''}
  <path d="${stream}" fill="none" stroke="#1f6fd1" stroke-width="4"/>${pts}</svg></div>${overlay}</body></html>`;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const states = [...new Set(script.map((s) => s[0]))];
  for (const st of states) {
    await page.setContent(screenHtml(st));
    await page.screenshot({ path: path.join(WORK, 'screen-' + st + '.png') });
  }
  await browser.close();

  // audio: each line as wav, then silence; video: each screen held for its line + pause
  const parts = [], concatVideo = [];
  let t = 0.6; // lead-in silence
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'anullsrc=r=22050:cl=mono', '-t', '0.6', path.join(WORK, 'sil-lead.wav')]);
  parts.push('sil-lead.wav');
  const truth = [];
  script.forEach(([st, text, pause], i) => {
    const wav = meSpeak.speak(text, { rawdata: 'buffer', speed: 165, amplitude: 120 });
    const f = 'line' + i + '.wav';
    fs.writeFileSync(path.join(WORK, f), Buffer.from(wav));
    const dur = parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path.join(WORK, f)]).toString());
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', path.join(WORK, f), '-ar', '22050', '-ac', '1', path.join(WORK, 'r' + f)]);
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'anullsrc=r=22050:cl=mono', '-t', String(pause), path.join(WORK, 'sil' + i + '.wav')]);
    parts.push('r' + f, 'sil' + i + '.wav');
    truth.push({ screen: st, start: +t.toFixed(2), end: +(t + dur).toFixed(2), text });
    t += dur + pause;
  });
  // screen changes happen 0.5 s before the line that needs the new screen begins
  const changes = [];
  let cur = null, segStart = 0;
  truth.forEach((l) => {
    if (l.screen !== cur) {
      if (cur) changes.push({ screen: cur, from: segStart, to: l.start - 0.5 });
      cur = l.screen; segStart = changes.length ? l.start - 0.5 : 0;
    }
  });
  changes.push({ screen: cur, from: segStart, to: t });
  let list = '';
  changes.forEach((c) => { list += `file 'screen-${c.screen}.png'\nduration ${(c.to - c.from).toFixed(3)}\n`; });
  list += `file 'screen-${cur}.png'\n`;
  fs.writeFileSync(path.join(WORK, 'video.txt'), list);
  fs.writeFileSync(path.join(WORK, 'audio.txt'), parts.map((p) => `file '${p}'`).join('\n'));
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', path.join(WORK, 'audio.txt'), path.join(WORK, 'narration.wav')]);
  const common = ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', path.join(WORK, 'video.txt'), '-i', path.join(WORK, 'narration.wav'), '-r', '15', '-shortest'];
  execFileSync('ffmpeg', [...common, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', path.join(OUT, 'buffer-demo.mov')]);
  execFileSync('ffmpeg', [...common, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', path.join(OUT, 'buffer-demo.mp4')]);
  execFileSync('ffmpeg', [...common, '-c:v', 'libvpx-vp9', '-b:v', '600k', '-deadline', 'realtime', '-cpu-used', '8', '-c:a', 'libopus', path.join(OUT, 'buffer-demo.webm')]);
  fs.writeFileSync(path.join(OUT, 'truth.json'), JSON.stringify({ lines: truth, screens: changes }, null, 1));
  // the same narration as a caption file, for testing the "I already have captions" route
  const ts = (x) => new Date(x * 1000).toISOString().slice(11, 23);
  fs.writeFileSync(path.join(OUT, 'buffer-demo.vtt'), 'WEBVTT\n\n' + truth.map((l) => ts(l.start) + ' --> ' + ts(l.end) + '\n' + l.text).join('\n\n') + '\n');
  fs.rmSync(WORK, { recursive: true, force: true });
  console.log(JSON.stringify(changes), '\ntotal', t.toFixed(1), 's');
})();
