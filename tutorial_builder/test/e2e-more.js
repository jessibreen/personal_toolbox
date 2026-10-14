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
  ok(errors.length === 0, 'no script errors', errors);
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  await browser.close();
})();
