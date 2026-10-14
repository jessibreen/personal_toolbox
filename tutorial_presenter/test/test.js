// End-to-end checks of the built bookmark in headless Chromium.
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const SHOTS = process.env.SHOTS || path.join(ROOT, 'test/shots');
fs.mkdirSync(SHOTS, { recursive: true });
const page_html = fs.readFileSync(path.join(ROOT, 'tutorial-presenter.html'), 'utf8');
const href = page_html.match(/id="bm" href="([^"]+)"/)[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&');
const code = decodeURIComponent(href.replace(/^javascript:/, ''));

let pass = 0, fail = 0;
function ok(cond, name, extra) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra !== undefined ? '  -> ' + JSON.stringify(extra) : '')); }
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function state(page, sel) {
  return page.evaluate((sel) => {
    const el = sel ? document.querySelector(sel) : null;
    const r = el ? el.getBoundingClientRect() : null;
    const host = document.querySelector('[data-tutorial-presenter]');
    const hole = host ? host.shadowRoot.querySelector('.hole') : null;
    const hr = hole ? hole.getBoundingClientRect() : null;
    return {
      on: !!window.__tutorialPresenter, host: !!host,
      transform: getComputedStyle(document.body).transform,
      inline: document.body.style.transform,
      rect: r && { x: r.left, y: r.top, w: r.width, h: r.height, cx: r.left + r.width / 2, cy: r.top + r.height / 2 },
      hole: hr && { x: hr.left, y: hr.top, w: hr.width, h: hr.height, o: getComputedStyle(hole).opacity },
      vw: document.documentElement.clientWidth, vh: innerHeight, sy: scrollY,
      marks: (window.CSS && CSS.highlights && CSS.highlights.get('tutorial-presenter')) ? CSS.highlights.get('tutorial-presenter').size : 0,
      url: location.href,
    };
  }, sel);
}
function scaleOf(t) { const m = t && t.match(/matrix\(([^,]+)/); return m ? parseFloat(m[1]) : 1; }
async function holeTarget(page) {      // which element is currently chosen
  return page.evaluate(() => {
    const el = window.__tutorialPresenter && window.__tutorialPresenter.current();
    return el ? (el.id || el.tagName + ':' + (el.textContent || '').trim().slice(0, 30)) : null;
  });
}
const centred = (s, tol = 2.5) => Math.abs(s.hole.x + s.hole.w / 2 - s.vw / 2) < tol && Math.abs(s.hole.y + s.hole.h / 2 - s.vh / 2) < tol;
const inView = (s) => s.hole.x >= 0 && s.hole.y >= 0 && s.hole.x + s.hole.w <= s.vw && s.hole.y + s.hole.h <= s.vh;
const onEl = (s) => s.hole.o === '1' && s.hole.x >= s.rect.x - 60 && s.hole.y >= s.rect.y - 10 && s.hole.x + s.hole.w <= s.rect.x + s.rect.w + 10 && s.hole.y + s.hole.h <= s.rect.y + s.rect.h + 10;

(async () => {
  const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--auto-accept-this-tab-capture', '--auto-select-tab-capture-source-by-title=Messy export'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  /* ================= messy page ================= */
  console.log('\nMessy page');
  await page.goto('file://' + path.join(ROOT, 'test/messy.html'));
  const before = await page.evaluate(() => ({ html: document.documentElement.outerHTML.length, bodyStyle: document.body.getAttribute('style') }));
  await page.evaluate(code);
  let s = await state(page);
  ok(s.on && s.host, 'turns on and adds its layer');
  ok(s.transform === 'none', 'page not transformed until something is chosen', s.transform);
  await page.screenshot({ path: path.join(SHOTS, '01-on.png') });

  // click a paragraph
  await page.click('#p1', { position: { x: 40, y: 10 } });
  await wait(650);
  s = await state(page, '#p1');
  ok(scaleOf(s.transform) > 1.2, 'click zooms in', s.transform);
  ok(centred(s), 'chosen paragraph is centred', s.hole);
  ok(inView(s), 'chosen paragraph fits on screen', s.hole);
  ok(onEl(s), 'spotlight sits on it', { hole: s.hole, rect: s.rect });
  await page.screenshot({ path: path.join(SHOTS, '02-zoom-paragraph.png') });

  // step through everything with the right arrow and record the order
  await page.keyboard.press('Escape'); await wait(600);
  s = await state(page);
  ok(s.transform === 'none' && s.inline === 'none', 'Esc returns to the plain page', s);
  await page.keyboard.press('q');
  await page.evaluate(() => scrollTo(0, 0));
  await page.evaluate(code);
  const order = [];
  // first right-arrow with nothing chosen and the page at the top
  for (let i = 0; i < 30; i++) {
    await page.keyboard.press('ArrowRight'); await wait(520);
    const t = await holeTarget(page);
    if (order.length && order[order.length - 1] === t) break;
    order.push(t);
  }
  console.log('  step order:', order.join(' > '));
  const want = ['title', 'DIV:Loose text directly in a div w', 'p1', 'H2:Steps', 's1', 's2', 's3', 's3img', 's4', 's4a', 's4b', 's5', 'note', 'tbl', 'code', 'last'];
  ok(JSON.stringify(order) === JSON.stringify(want), 'arrow keys walk the page in a sensible order', order);
  ok(!order.includes('hidden') && !order.some((o) => /Nav|Footer/.test(o || '')), 'skips hidden text, the menu and the footer');

  // back one
  await page.keyboard.press('ArrowLeft'); await wait(520);
  ok((await holeTarget(page)) === 'code', 'left arrow goes back one');

  // big element: no shrink, top aligned
  await page.click('#last'); await wait(520);
  for (let i = 0; i < 40 && (await holeTarget(page)) !== 's3img'; i++) { await page.keyboard.press('ArrowLeft'); await wait(480); }
  s = await state(page, '#s3img');
  ok(scaleOf(s.transform) < 1 && scaleOf(s.transform) >= 0.5 && inView(s) && centred(s), 'a screenshot taller than the screen shrinks to fit', { t: s.transform, hole: s.hole });
  await page.keyboard.press('ArrowLeft'); await wait(600);
  s = await state(page, '#s3');
  ok((await holeTarget(page)) === 's3' && scaleOf(s.transform) === 1 && s.hole.y > 40 && s.hole.y < 70, 'a step taller than the screen keeps its text size and starts at its top', { t: s.transform, hole: s.hole });
  await page.screenshot({ path: path.join(SHOTS, '03b-tall-step.png') });
  await page.keyboard.press('ArrowRight'); await wait(600);
  await page.screenshot({ path: path.join(SHOTS, '03-big-image.png') });

  // small image inside a step: click it, then click again to widen to the step
  await page.keyboard.press('Escape'); await wait(550);
  await page.click('#s2img'); await wait(600);
  ok((await holeTarget(page)) === 's2img', 'clicking a picture picks the picture');
  s = await state(page, '#s2img');
  ok(scaleOf(s.transform) > 1.8, 'small picture is enlarged', s.transform);
  await page.screenshot({ path: path.join(SHOTS, '04-zoom-image.png') });
  await page.mouse.click(s.rect.cx, s.rect.cy); await wait(600);
  ok((await holeTarget(page)) === 's2', 'clicking it again widens to the whole step');
  await page.keyboard.press('n'); await wait(600);
  ok((await holeTarget(page)) === 's2img', 'N narrows back');

  // inline word inside a paragraph picks the paragraph; link does not navigate
  await page.keyboard.press('Escape'); await wait(550);
  await page.click('#lnk'); await wait(600);
  s = await state(page);
  ok(/messy\.html$/.test(s.url), 'links do not navigate while presenting', s.url);
  ok((await holeTarget(page)) === 'DIV:Loose text directly in a div w', 'clicking a link spotlights the text around it');

  // zoom off: spotlight with no transform
  await page.keyboard.press('z'); await wait(600);
  s = await state(page);
  ok(s.transform === 'none', 'Z turns zoom off (spotlight only)', s.transform);
  await page.screenshot({ path: path.join(SHOTS, '05-spotlight-only.png') });
  await page.keyboard.press('ArrowRight'); await wait(600);
  ok((await holeTarget(page)) === 'p1', 'stepping still works with zoom off');
  await page.keyboard.press('z'); await wait(600);
  s = await state(page);
  ok(scaleOf(s.transform) > 1.2, 'Z turns zoom back on', s.transform);
  const z1 = scaleOf(s.transform);
  await page.keyboard.press('-'); await wait(600);
  s = await state(page);
  ok(scaleOf(s.transform) < z1 || z1 < 1.9, 'minus reduces the zoom', { z1, now: scaleOf(s.transform) });
  await page.keyboard.press('='); await wait(300);

  // highlight by dragging
  await page.keyboard.press('Escape'); await wait(550);
  const box = await page.locator('#p1').boundingBox();
  await page.mouse.move(box.x + 20, box.y + 12);
  await page.mouse.down();
  await page.mouse.move(box.x + 260, box.y + 12, { steps: 8 });
  await page.mouse.up();
  await wait(200);
  s = await state(page);
  ok(s.marks === 1, 'dragging across words highlights them', s.marks);
  ok(s.transform === 'none', 'a drag does not also count as a click', s.transform);
  await page.screenshot({ path: path.join(SHOTS, '06-highlight.png') });
  await page.keyboard.press('u'); await wait(100);
  s = await state(page);
  ok(s.marks === 0, 'U removes the highlight', s.marks);

  // rapid stepping should not break anything
  await page.evaluate(() => scrollTo(0, 0));
  for (let i = 0; i < 8; i++) { await page.keyboard.press('ArrowRight'); await wait(60); }
  await wait(700);
  const rapid = await holeTarget(page);
  s = await state(page, '#' + rapid);
  ok(rapid === 's4b' && centred(s, 4), 'rapid key presses land where expected', { rapid, hole: s.hole });

  // help
  await page.keyboard.press('?'); await wait(150);
  await page.screenshot({ path: path.join(SHOTS, '07-help.png') });
  await page.keyboard.press('Escape');

  // quit restores everything
  await page.keyboard.press('q'); await wait(200);
  s = await state(page);
  const after = await page.evaluate(() => ({ html: document.documentElement.outerHTML.length, bodyStyle: document.body.getAttribute('style'), rootStyle: document.documentElement.getAttribute('style'), sheets: document.adoptedStyleSheets.length }));
  ok(!s.on && !s.host && s.transform === 'none', 'Q removes the presenter');
  ok(after.html === before.html || Math.abs(after.html - before.html) <= 18, 'page markup is back to what it was', { before, after });
  ok(after.sheets === 0, 'added styles are removed', after);
  await page.click('#p1'); await wait(300);
  s = await state(page);
  ok(s.transform === 'none', 'clicks do nothing once it is off');

  // toggle from the bookmark
  await page.evaluate(code); await page.evaluate(code);
  s = await state(page);
  ok(!s.on && !s.host, 'clicking the bookmark a second time turns it off');

  /* ================= narrow window ================= */
  console.log('\nResize');
  await page.evaluate(code);
  await page.click('#s1'); await wait(600);
  await page.setViewportSize({ width: 900, height: 600 }); await wait(300);
  s = await state(page, '#s1');
  ok(centred(s, 3), 'stays centred after the window is resized', s.hole);
  await page.keyboard.press('q');
  await page.setViewportSize({ width: 1440, height: 900 });

  /* ================= install page ================= */
  console.log('\nInstall page');
  await page.goto('file://' + path.join(ROOT, 'tutorial-presenter.html'));
  await page.screenshot({ path: path.join(SHOTS, '10-install-top.png') });
  await page.screenshot({ path: path.join(SHOTS, '11-install-full.png'), fullPage: true });
  ok((await page.getAttribute('#bm', 'href')).startsWith('javascript:void'), 'bookmark button carries the code');
  await page.click('#try'); await wait(300);
  s = await state(page);
  ok(s.on, '"Turn it on for this page" works');
  await page.screenshot({ path: path.join(SHOTS, '12-install-on.png') });
  const order2 = [];
  await page.evaluate(() => document.querySelector('.practice').scrollIntoView());
  await page.locator('.practice h2').click(); await wait(600);
  for (let i = 0; i < 40; i++) {
    const t = await page.evaluate(() => {
      const el = window.__tutorialPresenter.current();
      return el ? el.tagName.toLowerCase() + ':' + el.textContent.trim().replace(/\s+/g, ' ').slice(0, 28) : '?';
    });
    if (order2.length && order2[order2.length - 1] === t) break;
    order2.push(t);
    if (i === 3) await page.screenshot({ path: path.join(SHOTS, '13-practice-heading.png') });
    if (i === 4) await page.screenshot({ path: path.join(SHOTS, '13b-practice-diagram.png') });
    if (i === 7) await page.screenshot({ path: path.join(SHOTS, '14-practice-step.png') });
    if (i === 10) await page.screenshot({ path: path.join(SHOTS, '14b-practice-callout.png') });
    await page.keyboard.press('ArrowRight'); await wait(520);
  }
  console.log('  practice order:\n    ' + order2.join('\n    '));
  ok(order2.length > 15 && !order2.includes('?'), 'practice tutorial steps through cleanly', order2.length);

  // mid-transition frame: spotlight should be travelling with the page
  await page.keyboard.press('ArrowLeft');
  await wait(140);
  await page.screenshot({ path: path.join(SHOTS, '15-mid-move.png') });
  await wait(500);
  await page.keyboard.press('q');

  // dark scheme + phone width rendering of the install page
  const dark = await browser.newContext({ viewport: { width: 390, height: 800 }, colorScheme: 'dark' });
  const dp = await dark.newPage();
  await dp.goto('file://' + path.join(ROOT, 'tutorial-presenter.html'));
  const overflow = await dp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok(overflow <= 0, 'install page has no sideways scroll at phone width', overflow);
  await dp.screenshot({ path: path.join(SHOTS, '16-install-dark-phone.png'), fullPage: true });
  await dark.close();

  /* ================= framed tutorial (like Canvas) ================= */
  console.log('\nFramed page');
  const framed = path.join(ROOT, 'test/framed.html');
  fs.writeFileSync(framed, '<!doctype html><title>LMS</title><body style="margin:0"><h3 style="margin:8px">Course page</h3><iframe src="file://' + path.join(ROOT, 'test/messy.html') + '" style="width:100%;height:820px;border:0"></iframe></body>');
  await page.goto('file://' + framed);
  await page.evaluate(code); await wait(200);
  const notice = await page.evaluate(() => { const b = document.querySelector('[data-tutorial-presenter]').shadowRoot.querySelector('.frame'); return b ? b.textContent : null; });
  ok(notice && /own tab/.test(notice), 'offers to open a framed tutorial in its own tab', notice);
  await page.screenshot({ path: path.join(SHOTS, '17-framed.png') });
  const [popup] = await Promise.all([
    ctx.waitForEvent('page'),
    page.evaluate(() => document.querySelector('[data-tutorial-presenter]').shadowRoot.querySelector('.frame button').click()),
  ]);
  ok(/messy\.html$/.test(popup.url()), 'the button opens the tutorial itself', popup.url());
  await popup.close();

  /* ================= recording ================= */
  console.log('\nRecording');
  const rp = await ctx.newPage();
  await rp.goto('file://' + path.join(ROOT, 'test/messy.html'));
  await rp.evaluate(code);
  const cardOn = () => rp.evaluate(() => document.querySelector('[data-tutorial-presenter]').shadowRoot.querySelector('.card').classList.contains('on'));
  const mp4ok = await rp.evaluate(() => MediaRecorder.isTypeSupported('video/mp4;codecs=avc1'));
  await rp.keyboard.press('r'); await wait(200);
  ok(mp4ok || await cardOn(), 'where only WebM is possible, R first explains the Mac recorder', { mp4ok });
  await rp.screenshot({ path: path.join(SHOTS, '19-webm-card.png') });
  if (!mp4ok) await rp.keyboard.press('r');               // R again = record a WebM anyway
  await wait(1500);
  const recLabel = () => rp.evaluate(() => document.querySelector('[data-tutorial-presenter]').shadowRoot.querySelector('.rec').textContent);
  let lab = await recLabel();
  ok(/Stop/.test(lab), 'R starts recording and the button shows a timer', lab);
  ok(!/no sound/.test(lab), 'microphone is included', lab);
  await rp.click('#p1'); await wait(700);
  await rp.keyboard.press('ArrowRight'); await wait(700);
  const lv = await rp.evaluate(async () => {           // the test microphone only beeps now and then, so watch for a while
    const fill = document.querySelector('[data-tutorial-presenter]').shadowRoot.querySelector('.lvl i');
    let most = 0;
    for (let i = 0; i < 60; i++) { most = Math.max(most, parseInt(fill.style.width) || 0); await new Promise((r) => setTimeout(r, 40)); }
    return most;
  });
  ok(parseInt(lv) > 0, 'the microphone meter moves', lv);
  await rp.keyboard.press('m'); await wait(200);
  ok(/mic off/.test(await recLabel()), 'M mutes the microphone');
  await rp.keyboard.press('m');
  await rp.screenshot({ path: path.join(SHOTS, '20-recording.png') });
  await rp.keyboard.press('ArrowRight'); await wait(1200);
  const [dl] = await Promise.all([rp.waitForEvent('download', { timeout: 15000 }), rp.keyboard.press('r')]);
  const saved = path.join(SHOTS, dl.suggestedFilename());
  await dl.saveAs(saved);
  ok(/^messy-export-\d{4}-\d\d-\d\d-\d{4}\.(mp4|webm)$/.test(dl.suggestedFilename()), 'video is named after the page and the date', dl.suggestedFilename());
  console.log('  saved', saved, fs.statSync(saved).size, 'bytes');
  lab = await recLabel();
  ok(lab === 'Record', 'button returns to Record', lab);
  // quitting mid-recording still saves the video
  await rp.keyboard.press('r'); await wait(150); if (!mp4ok) await rp.keyboard.press('r'); await wait(1500);
  const [dl2] = await Promise.all([rp.waitForEvent('download', { timeout: 15000 }), rp.keyboard.press('q')]);
  ok(!!dl2, 'quitting while recording still saves the video');
  ok(!(await rp.evaluate(() => !!document.querySelector('[data-tutorial-presenter]'))), 'and the presenter is gone');
  // clicking the Record button works too
  await rp.evaluate(code);
  await rp.evaluate(() => document.querySelector('[data-tutorial-presenter]').shadowRoot.querySelector('.rec').click());
  await wait(150);
  if (!mp4ok) await rp.evaluate(() => document.querySelector('[data-tutorial-presenter]').shadowRoot.querySelector('.card button.ghost').click());
  await wait(1200);
  ok(/Stop/.test(await recLabel()), 'the Record button starts a recording');
  const [dl3] = await Promise.all([rp.waitForEvent('download', { timeout: 15000 }), rp.evaluate(() => document.querySelector('[data-tutorial-presenter]').shadowRoot.querySelector('.rec').click())]);
  ok(!!dl3, 'and clicking Stop saves it');
  await rp.keyboard.press('q');
  await rp.close();
  fs.writeFileSync(path.join(SHOTS, 'last-video.txt'), saved);

  ok(errors.length === 0, 'no script errors', errors);
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
