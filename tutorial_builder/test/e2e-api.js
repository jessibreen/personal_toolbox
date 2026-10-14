// Tidy wording through the Claude API, with the API answered by a stand-in.
const path = require('path'), fs = require('fs');
const { chromium } = require('playwright');
const SHOTS = process.env.SHOTS || path.join(__dirname, 'shots');
let pass = 0, fail = 0;
const ok = (c, name, extra) => { if (c) { pass++; console.log('  ok   ' + name); } else { fail++; console.log('  FAIL ' + name + (extra !== undefined ? '  -> ' + JSON.stringify(extra).slice(0, 300) : '')); } };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const proj = JSON.parse(fs.readFileSync(fs.readdirSync(SHOTS).filter((f) => f.endsWith('.tutorial.json')).map((f) => path.join(SHOTS, f))[0], 'utf8'));
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const calls = [];
  let mode = 'ok';
  await ctx.route('https://api.anthropic.com/v1/messages', async (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST' } });
    const body = JSON.parse(req.postData());
    calls.push({ headers: req.headers(), body });
    const cors = { 'access-control-allow-origin': '*', 'content-type': 'application/json' };
    if (mode === 'badkey') return route.fulfill({ status: 401, headers: cors, body: JSON.stringify({ type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }) });
    await wait(1200);
    const n = (body.messages[0].content.slice(-1)[0].text.match(/^\d+\. \[/gm) || []).length;
    const text = 'Here are the steps:\n\n' + Array.from({ length: n }, (_, i) => (i + 1) + '. Claude step ' + (i + 1) + ' with **Vector** ▸ **Buffer**.').join('\n');
    route.fulfill({ status: 200, headers: cors, body: JSON.stringify({ content: [{ type: 'text', text }] }) });
  });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('file://' + path.join(__dirname, '../tutorial-builder.html'));
  await page.evaluate(async (d) => { await loadProject(d); }, proj);
  const n = proj.steps.length;

  await page.getByRole('button', { name: 'Tidy wording with Claude' }).click();
  await page.fill('#keyIn', 'not-a-key');
  await page.getByRole('button', { name: 'Save key and continue' }).click();
  ok(await page.isVisible('#keyIn'), 'rejects something that isn’t an API key');
  await page.fill('#keyIn', 'sk-ant-test-1234567890abcd');
  await page.getByRole('button', { name: 'Save key and continue' }).click();
  await page.waitForSelector('#withPics');
  await page.screenshot({ path: path.join(SHOTS, 'b11-api-dialog.png') });
  ok(await page.isChecked('#withPics'), 'offers to send the pictures, on by default');
  await page.getByRole('button', { name: 'Rewrite the steps' }).click();
  await wait(500);
  await page.screenshot({ path: path.join(SHOTS, 'b12-api-working.png') });
  await page.waitForSelector('.scrim', { state: 'detached', timeout: 15000 });
  const c = calls[0];
  ok(c.headers['x-api-key'] === 'sk-ant-test-1234567890abcd' && c.headers['anthropic-version'] === '2023-06-01' && c.headers['anthropic-dangerous-direct-browser-access'] === 'true', 'calls the API with the key and the right headers');
  ok(c.body.model === 'claude-sonnet-5-5', 'uses Sonnet by default', c.body.model);
  const imgs = c.body.messages[0].content.filter((x) => x.type === 'image');
  ok(imgs.length === proj.steps.filter((s) => s.pic).length && /^image\/(webp|jpeg)$/.test(imgs[0].source.media_type), 'sends one picture per step that has one', imgs.length);
  ok(/screenshot is attached/.test(c.body.messages[0].content.slice(-1)[0].text), 'prompt tells Claude to use the pictures');
  const texts = await page.evaluate(() => app.project.steps.map((s) => s.text));
  ok(texts.every((t, i) => t === 'Claude step ' + (i + 1) + ' with **Vector** ▸ **Buffer**.'), 'rewrites every step', texts.slice(0, 2));
  await page.locator('.toast button').click();
  ok((await page.evaluate(() => app.project.steps[0].text)) === proj.steps[0].text, 'undo restores the previous wording');

  // without pictures, another model
  await page.getByRole('button', { name: 'Tidy wording with Claude' }).click();
  await page.uncheck('#withPics');
  await page.selectOption('#modelSel', 'claude-haiku-4-5-20251001');
  await page.getByRole('button', { name: 'Rewrite the steps' }).click();
  await page.waitForSelector('.scrim', { state: 'detached', timeout: 15000 });
  ok(!calls[1].body.messages[0].content.some((x) => x.type === 'image') && calls[1].body.model === 'claude-haiku-4-5-20251001', 'can leave the pictures out and use another model');

  // key never ends up in files
  const [dp] = await Promise.all([page.waitForEvent('download'), page.click('#saveBtn')]);
  ok(!fs.readFileSync(await dp.path(), 'utf8').includes('sk-ant-'), 'the key is not in the project file');

  // bad key
  mode = 'badkey';
  await page.getByRole('button', { name: 'Tidy wording with Claude' }).click();
  await page.getByRole('button', { name: 'Rewrite the steps' }).click();
  await page.waitForFunction(() => /didn’t accept/.test(document.querySelector('.dialog [role=status]').textContent), null, { timeout: 10000 });
  await page.screenshot({ path: path.join(SHOTS, 'b13-api-badkey.png') });
  ok(true, 'a rejected key shows a clear message');
  await page.getByRole('button', { name: 'Cancel' }).click();
  await page.getByRole('button', { name: 'Tidy wording with Claude' }).click();
  ok(await page.isVisible('#keyIn'), 'and asks for the key again next time');

  ok(errors.length === 0, 'no script errors', errors);
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  await browser.close();
})();
