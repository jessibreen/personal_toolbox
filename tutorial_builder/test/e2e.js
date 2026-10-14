// End-to-end test of the Tutorial Builder in headless Chromium, with the CDN and model served locally.
const path = require('path'), fs = require('fs');
const { chromium } = require('playwright');
const wire = require('./routes');
const ROOT = path.join(__dirname, '..');
const SHOTS = process.env.SHOTS || path.join(__dirname, 'shots');
fs.mkdirSync(SHOTS, { recursive: true });
const VIDEO = process.argv[2] || 'buffer-demo.webm';
const truth = JSON.parse(fs.readFileSync(path.join(__dirname, 'material/truth.json'), 'utf8'));
let pass = 0, fail = 0;
const ok = (c, name, extra) => { if (c) { pass++; console.log('  ok   ' + name); } else { fail++; console.log('  FAIL ' + name + (extra !== undefined ? '  -> ' + JSON.stringify(extra).slice(0, 400) : '')); } };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  await wire(ctx);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); if (/processed in/.test(m.text())) console.log('  ' + m.text()); });
  const url = 'file://' + path.join(ROOT, 'tutorial-builder.html') + '#model=Xenova/whisper-tiny';
  await page.goto(url);
  await page.screenshot({ path: path.join(SHOTS, 'b01-start.png') });

  console.log('\nProcessing ' + VIDEO);
  const t0 = Date.now();
  await page.setInputFiles('#videoIn', path.join(__dirname, 'material', VIDEO));
  await page.waitForSelector('#procView:not([hidden])');
  await wait(2500);
  await page.screenshot({ path: path.join(SHOTS, 'b02-processing.png') });
  await page.waitForSelector('#editView:not([hidden])', { timeout: 280000 });
  console.log('  took ' + Math.round((Date.now() - t0) / 1000) + ' s');
  const proj = await page.evaluate(() => ({ steps: app.project.steps.map((s) => ({ start: s.start, end: s.end, text: s.text, pic: s.pic && s.pic.t, crop: s.pic && s.pic.crop })), sentences: app.project.sentences.length, samples: app.samples && app.samples.times.length }));
  console.log('  frames sampled', proj.samples, '| sentences', proj.sentences);
  proj.steps.forEach((s, i) => console.log('  step ' + (i + 1) + ' ' + s.start.toFixed(1) + '-' + s.end.toFixed(1) + ' pic@' + (s.pic != null ? s.pic.toFixed(1) : '-') + '  ' + s.text.slice(0, 70)));
  ok(proj.samples > 60, 'samples the video for screen changes', proj.samples);
  ok(proj.sentences >= 5, 'produces a transcript', proj.sentences);
  // expected: the two "map" lines together, then one step per new screen (the dialog's small edit may merge)
  ok(proj.steps.length >= 5 && proj.steps.length <= 8, 'drafts a sensible number of steps', proj.steps.length);
  const screenAt = (t) => (truth.screens.find((s) => t >= s.from && t < s.to) || {}).screen;
  const lineScreens = truth.lines.map((l) => l.screen);
  ok(screenAt(proj.steps[0].pic) === 'map' && proj.steps[0].end > truth.lines[1].start, 'first step keeps both sentences about the map together', proj.steps[0]);
  const picScreens = proj.steps.map((s) => screenAt(s.pic));
  const stepScreens = proj.steps.map((s) => screenAt((s.start + s.end) / 2));
  ok(picScreens.every((x, i) => x === stepScreens[i] || (x === 'dialog30' && stepScreens[i] === 'dialog')), 'each picture shows the screen that step talks about', { picScreens, stepScreens });
  ok(new Set(picScreens).size >= 6, 'pictures cover the different screens', picScreens);
  await page.screenshot({ path: path.join(SHOTS, 'b03-editor.png') });
  await page.screenshot({ path: path.join(SHOTS, 'b03-editor-full.png'), fullPage: true });

  console.log('\nEditing');
  // edit text
  const ta = page.locator('.step textarea').first();
  await ta.fill('Open the project with the **streams** and **homes** layers.');
  ok((await page.evaluate(() => app.project.steps[0].text)).startsWith('Open the project'), 'step text can be edited');
  // split
  const n0 = proj.steps.length;
  const t2 = page.locator('.step textarea').nth(1);
  await t2.fill('First sentence here. Second sentence here.');
  await t2.evaluate((el) => { el.focus(); el.setSelectionRange(21, 21); });
  await page.locator('.step').nth(1).getByRole('button', { name: 'Split at cursor' }).click();
  await wait(800);
  let st = await page.evaluate(() => app.project.steps.map((s) => s.text));
  ok(st.length === n0 + 1 && st[1] === 'First sentence here.' && st[2] === 'Second sentence here.', 'split at the cursor makes two steps', st.slice(0, 4));
  // merge
  await page.locator('.step').nth(1).getByRole('button', { name: 'Merge with next' }).click();
  st = await page.evaluate(() => app.project.steps.map((s) => s.text));
  ok(st.length === n0 && st[1] === 'First sentence here. Second sentence here.', 'merge joins them again', st.slice(0, 3));
  // delete and undo
  await page.locator('.step').nth(2).getByRole('button', { name: 'Delete' }).click();
  ok((await page.evaluate(() => app.project.steps.length)) === n0 - 1, 'delete removes a step');
  await page.locator('.toast button').click();
  ok((await page.evaluate(() => app.project.steps.length)) === n0, 'undo brings it back');
  // move
  const before = await page.evaluate(() => app.project.steps.map((s) => s.id));
  await page.locator('.step').nth(2).getByRole('button', { name: 'Move up' }).click();
  const after = await page.evaluate(() => app.project.steps.map((s) => s.id));
  ok(after[1] === before[2] && after[2] === before[1], 'move up reorders');
  await page.locator('.step').nth(1).getByRole('button', { name: 'Move down' }).click();
  // add a step
  await page.locator('.gap button').nth(0).click({ force: true });
  ok((await page.evaluate(() => app.project.steps.length)) === n0 + 1 && (await page.evaluate(() => document.activeElement.classList.contains('text-in'))), 'add a step inserts an empty one and focuses it');
  await page.keyboard.type('A step I added by hand.');
  // choose another picture
  await page.locator('.step').nth(3).getByRole('button', { name: 'Choose another picture' }).click();
  await page.waitForSelector('.strip button', { timeout: 20000 });
  await wait(1500);
  await page.screenshot({ path: path.join(SHOTS, 'b04-picking.png') });
  const nThumbs = await page.locator('.strip button').count();
  ok(nThumbs >= 3, 'picture picker offers moments from the recording', nThumbs);
  await page.locator('.strip button').first().click();
  await wait(500);
  const want = await page.evaluate(() => player.currentTime);
  await page.getByRole('button', { name: 'Use this frame' }).click();
  await wait(1200);
  const got = await page.evaluate(() => app.project.steps[3].pic.t);
  ok(Math.abs(got - want) < 0.2, 'use this frame replaces the picture', { want, got });
  // crop
  await page.locator('.step').nth(3).getByRole('button', { name: 'Crop' }).click();
  const img = page.locator('.crop-wrap img');
  await img.waitFor();
  const b = await img.boundingBox();
  await page.mouse.move(b.x + b.width * 0.3, b.y + b.height * 0.15);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width * 0.7, b.y + b.height * 0.55, { steps: 6 });
  await page.mouse.up();
  await page.screenshot({ path: path.join(SHOTS, 'b05-crop.png') });
  await page.getByRole('button', { name: 'Apply crop' }).click();
  await wait(800);
  const crop = await page.evaluate(() => app.project.steps[3].pic.crop);
  ok(crop && Math.abs(crop.w / 1440 - 0.4) < 0.03 && Math.abs(crop.h / 900 - 0.4) < 0.03, 'crop is stored in picture pixels', crop);
  const viewSize = await page.evaluate(async () => { const i = new Image(); i.src = app.project.steps[3].pic.view; await i.decode(); return [i.naturalWidth, i.naturalHeight]; });
  ok(Math.abs(viewSize[0] / viewSize[1] - crop.w / crop.h) < 0.02, 'the cropped picture shows in the editor', viewSize);

  // transcript panel
  const rows = await page.locator('.tx-row').count();
  ok(rows === proj.sentences, 'transcript lists every sentence', rows);
  await page.locator('.tx-row button').nth(2).click();
  await wait(400);
  const pt = await page.evaluate(() => player.currentTime);
  ok(pt > 1, 'clicking a time plays from there', pt);
  await page.evaluate(() => player.pause());

  // polish with Claude
  await page.getByRole('button', { name: 'Tidy wording with Claude' }).click();
  await page.screenshot({ path: path.join(SHOTS, 'b06a-key.png') });
  await page.getByRole('button', { name: 'Copy a prompt to paste into a chat instead' }).click();
  const prompt = await page.locator('.dialog textarea[readonly]').inputValue();
  ok(/Keep exactly \d+ steps/.test(prompt) && /^1\. \[/m.test(prompt), 'prompt lists the steps with what was said', prompt.slice(0, 200));
  await page.screenshot({ path: path.join(SHOTS, 'b06-polish.png') });
  const count = await page.evaluate(() => app.project.steps.length);
  const reply = Array.from({ length: count }, (_, i) => (i + 1) + '. Polished step ' + (i + 1) + ' with **Bold** names.').join('\n');
  await page.locator('.dialog textarea:not([readonly])').fill('Here you go:\n\n' + reply);
  await page.getByRole('button', { name: 'Apply to my steps' }).click();
  st = await page.evaluate(() => app.project.steps.map((s) => s.text));
  ok(st.every((t, i) => t === 'Polished step ' + (i + 1) + ' with **Bold** names.'), 'pasted reply replaces every step', st.slice(0, 2));
  await page.locator('.toast button').click();
  st = await page.evaluate(() => app.project.steps.map((s) => s.text));
  ok(st[0].startsWith('Open the project'), 'undo restores the old wording');

  // exports
  console.log('\nExports');
  await page.click('#exportBtn');
  await page.screenshot({ path: path.join(SHOTS, 'b07-export-menu.png') });
  await page.click('[data-export="html"]');
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), page.getByRole('button', { name: 'Export', exact: true }).last().click()]);
  const htmlPath = path.join(SHOTS, dl.suggestedFilename()); await dl.saveAs(htmlPath);
  const out = fs.readFileSync(htmlPath, 'utf8');
  ok(/<ol class="steps">/.test(out) && (out.match(/<li>/g) || []).length === count, 'tutorial page has every step', (out.match(/<li>/g) || []).length);
  ok((out.match(/<img src="data:image\/(webp|jpeg)/g) || []).length === count - 1, 'pictures are built into the page', (out.match(/<img /g) || []).length);
  ok(/<strong>streams<\/strong>/.test(out), 'bold markup becomes bold text');
  ok(/<details>/.test(out), 'transcript section included');
  console.log('  ' + dl.suggestedFilename() + ' ' + Math.round(out.length / 1024) + ' KB');
  await page.click('#exportBtn');
  const [dv] = await Promise.all([page.waitForEvent('download'), page.click('[data-export="vtt"]')]);
  const vtt = fs.readFileSync(await dv.path(), 'utf8');
  ok(/^WEBVTT\n\n00:00:0\d\.\d{3} --> 00:00:\d\d\.\d{3}\n/.test(vtt), 'captions file is valid WebVTT', vtt.slice(0, 80));
  await page.click('#exportBtn');
  const [dt] = await Promise.all([page.waitForEvent('download'), page.click('[data-export="txt"]')]);
  ok(/^\[0:0\d\] /m.test(fs.readFileSync(await dt.path(), 'utf8')), 'transcript text file has times');
  const [dp] = await Promise.all([page.waitForEvent('download'), page.click('#saveBtn')]);
  const projPath = path.join(SHOTS, dp.suggestedFilename()); await dp.saveAs(projPath);
  const pj = JSON.parse(fs.readFileSync(projPath, 'utf8'));
  ok(pj.format === 'tutorial-builder' && pj.steps.length === count && pj.steps[3].pic.crop, 'project file keeps steps, pictures and crops');

  // look at the exported page with the presenter-friendly structure
  const p2 = await ctx.newPage();
  await p2.goto('file://' + htmlPath);
  await p2.screenshot({ path: path.join(SHOTS, 'b08-exported.png'), fullPage: false });
  await p2.close();

  // reload: autosave offers to continue
  console.log('\nReopening');
  await wait(1600);
  await page.goto(url); await page.reload();
  await page.waitForSelector('#resume:not([hidden])', { timeout: 5000 }).catch(() => {});
  ok(await page.isVisible('#resume'), 'after a reload it offers to continue the last tutorial');
  await page.click('#resumeBtn');
  await page.waitForSelector('#editView:not([hidden])');
  ok((await page.evaluate(() => app.project.steps.length)) === count, 'continuing restores every step');
  ok(await page.isVisible('.relink'), 'asks for the recording again to choose pictures');
  await page.screenshot({ path: path.join(SHOTS, 'b09-resumed.png') });
  // open project file route
  await page.evaluate(() => { app.project = null; show('startView'); });
  await page.setInputFiles('#projIn', projPath);
  await page.waitForSelector('#editView:not([hidden])');
  ok((await page.evaluate(() => app.project.steps[3].pic.crop)) != null, 'opening a project file restores crops');
  // relink the video
  await page.setInputFiles('#relinkIn', path.join(__dirname, 'material', VIDEO));
  await page.waitForSelector('.side video', { timeout: 10000 });
  ok(await page.isVisible('.side video'), 'opening the recording again brings the player back');

  // dark scheme, narrow
  const d = await browser.newContext({ viewport: { width: 820, height: 900 }, colorScheme: 'dark' });
  const dp2 = await d.newPage(); await dp2.goto(url);
  await dp2.evaluate(async (data) => { await loadProject(data); }, pj);
  await wait(400);
  await dp2.screenshot({ path: path.join(SHOTS, 'b10-dark-narrow.png') });
  const over = await dp2.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok(over <= 0, 'no sideways scroll in a narrow window', over);
  await d.close();

  ok(errors.length === 0, 'no script errors', errors);
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
