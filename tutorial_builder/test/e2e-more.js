// Caption-file and no-transcript paths.
const path = require('path');
const { chromium } = require('playwright');
const wire = require('./routes');
let pass = 0, fail = 0;
const ok = (c, name, extra) => { if (c) { pass++; console.log('  ok   ' + name); } else { fail++; console.log('  FAIL ' + name + (extra !== undefined ? '  -> ' + JSON.stringify(extra).slice(0, 300) : '')); } };
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await wire(ctx);
  const errors = [];
  const run = async (prep) => {
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto('file://' + path.join(__dirname, '../tutorial-builder.html') + '#model=Xenova/whisper-tiny');
    await prep(page);
    await page.setInputFiles('#videoIn', path.join(__dirname, 'material/buffer-demo.webm'));
    await page.waitForSelector('#editView:not([hidden])', { timeout: 200000 });
    const r = await page.evaluate(() => ({ n: app.project.steps.length, texts: app.project.steps.map((s) => s.text), sents: app.project.sentences.length, pics: app.project.steps.filter((s) => s.pic).length }));
    await page.close();
    return r;
  };
  console.log('\nCaption file');
  let r = await run(async (p) => { await p.setInputFiles('#capIn', path.join(__dirname, 'material/buffer-demo.vtt')); });
  console.log('  ' + r.texts.map((t, i) => (i + 1) + '. ' + t.slice(0, 60)).join('\n  '));
  ok(r.sents === 8, 'uses the caption cues as the transcript', r.sents);
  ok(r.n === 6, 'drafts one step per screen from captions', r.n);
  ok(/^First, open the Vector menu/.test(r.texts[1]), 'step text comes from the captions, tidied', r.texts[1]);
  console.log('\nNo transcript');
  r = await run(async (p) => { await p.check('input[name=model][value=none]'); });
  ok(r.n === 6 && r.sents === 0 && r.texts.every((t) => !t), 'no-transcript mode still finds the steps from pauses and screen changes', r);
  ok(r.pics === r.n, 'and takes a picture for each', r.pics);
  console.log('\nCancel');
  for (const stage of ['frames', 'listen']) {
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto('file://' + path.join(__dirname, '../tutorial-builder.html') + '#model=Xenova/whisper-tiny');
    await page.check('input[name=model][value=accurate]');     // the earlier test left "No transcript" remembered
    await page.setInputFiles('#videoIn', path.join(__dirname, 'material/buffer-demo.webm'));
    await page.waitForFunction((st) => [...document.querySelectorAll('.stage')][st === 'frames' ? 1 : 3].classList.contains('active'), stage, { timeout: 120000, polling: 100 }).catch(async (e) => { console.log('  state:', await page.evaluate(() => [...document.querySelectorAll('.stage')].map((s) => s.className + ':' + s.querySelector('.detail').textContent).join(' | ') + ' alert:' + document.querySelector('#procAlert').textContent)); throw e; });
    const box = await page.locator('#cancelBtn').boundingBox();
    const t0 = Date.now();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);   // one real click, as a person would
    await page.waitForSelector('#startView:not([hidden])', { timeout: 30000 });
    const ms = Date.now() - t0;
    console.log('  back at the start after ' + ms + ' ms');
    // the speech model holds the page while it works on one chunk of audio, so allow for one chunk
    ok(ms < (stage === 'frames' ? 1500 : 6000), 'Cancel during ' + (stage === 'frames' ? 'the screen check' : 'transcription') + ' returns to the start promptly', ms);
    // start again straight away: the cancelled job must not take over
    await page.setInputFiles('#videoIn', path.join(__dirname, 'material/buffer-demo.webm'));
    await page.waitForSelector('#editView:not([hidden])', { timeout: 200000 });
    await new Promise((r) => setTimeout(r, 3000));
    const r2 = await page.evaluate(() => ({ view: !document.querySelector('#editView').hidden, steps: app.project.steps.length }));
    ok(r2.view && r2.steps === 6, 'a new run after cancelling finishes normally', r2);
    await page.close();
  }

  ok(errors.length === 0, 'no script errors', errors);
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  await browser.close();
})();
