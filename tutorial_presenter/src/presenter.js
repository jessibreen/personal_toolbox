/* Tutorial Presenter
   Point-and-click spotlight, zoom and stepping for any web page.
   Runs from a bookmark. It never edits the page's file: everything it adds
   is removed again when you quit. */
(function () {
  'use strict';

  var KEY = '__tutorialPresenter';
  if (window[KEY]) { window[KEY].quit(); return; }          // second click on the bookmark = off

  var doc = document, root = doc.documentElement, body = doc.body;
  if (!body || !root || !root.attachShadow) return;

  /* ---------- settings (remembered per site) ---------- */
  var cfg = { zoom: true, max: 2.2 };
  try {
    var saved = JSON.parse(localStorage.getItem(KEY) || '{}');
    if (typeof saved.zoom === 'boolean') cfg.zoom = saved.zoom;
    if (saved.max >= 1.2 && saved.max <= 4) cfg.max = saved.max;
  } catch (_) {}
  function save() { try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch (_) {} }

  var reduce = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  var MS = reduce ? 0 : 420;                                  // length of a move
  var EASE = 'cubic-bezier(.3,.7,.2,1)';
  var PAD = 8;                                                // space between item and spotlight edge
  var ACCENT = '#ff8a1f';

  /* ---------- our own layer, kept apart from the page's styles ---------- */
  function mk(tag, cls, text) {
    var e = doc.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function addSheet(target, css) {                            // works even on pages that forbid inline styles
    try {
      var sheet = new CSSStyleSheet();
      sheet.replaceSync(css);
      target.adoptedStyleSheets = Array.prototype.concat.call(target.adoptedStyleSheets || [], sheet);
      return function () {
        target.adoptedStyleSheets = Array.prototype.filter.call(target.adoptedStyleSheets, function (s) { return s !== sheet; });
      };
    } catch (_) {
      var st = mk('style', null, css);
      (target === doc ? (doc.head || root) : target).appendChild(st);
      return function () { st.remove(); };
    }
  }

  var host = mk('div');
  host.setAttribute('data-tutorial-presenter', '');
  var hs = host.style;
  hs.all = 'initial'; hs.position = 'fixed'; hs.left = '0'; hs.top = '0';
  hs.width = '0'; hs.height = '0'; hs.zIndex = '2147483647'; hs.pointerEvents = 'none';
  var shadow = host.attachShadow({ mode: 'open' });
  addSheet(shadow, [
    '*{box-sizing:border-box}',
    '.hole{position:fixed;left:0;top:0;width:0;height:0;border-radius:10px;pointer-events:none;opacity:0;transition:opacity .25s;',
    'box-shadow:0 0 0 2px rgba(255,255,255,.55),0 0 0 200vmax rgba(9,12,18,.66)}',
    '.hover{position:fixed;left:0;top:0;width:0;height:0;border:2px solid ' + ACCENT + ';border-radius:8px;pointer-events:none;opacity:0;',
    'transition:opacity .15s;box-shadow:0 0 0 4px rgba(255,138,31,.22)}',
    '.ui{font:500 13px/1.35 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#fff;letter-spacing:0;text-align:left}',
    '.pill{position:fixed;left:14px;bottom:14px;display:flex;align-items:center;gap:9px;padding:8px 15px 8px 12px;border-radius:999px;',
    'background:rgba(17,20,26,.94);box-shadow:0 6px 22px rgba(0,0,0,.35);transition:opacity .6s;white-space:nowrap}',
    '.pill.idle{opacity:0}',
    '.dot{width:8px;height:8px;border-radius:50%;background:' + ACCENT + ';flex:none}',
    '.badge{position:fixed;left:26px;bottom:27px;width:8px;height:8px;border-radius:50%;background:' + ACCENT + ';opacity:.6}',
    '.toast{position:fixed;left:50%;bottom:26px;transform:translateX(-50%);padding:9px 16px;border-radius:999px;background:rgba(17,20,26,.94);',
    'box-shadow:0 6px 22px rgba(0,0,0,.35);opacity:0;transition:opacity .25s;white-space:nowrap}',
    '.toast.on{opacity:1}',
    '.help{position:fixed;right:16px;bottom:60px;width:360px;max-width:calc(100vw - 32px);padding:16px 18px 14px;border-radius:14px;',
    'background:rgba(17,20,26,.97);box-shadow:0 10px 40px rgba(0,0,0,.45);display:none}',
    '.help.on{display:block}',
    '.help .title{font-size:14px;font-weight:700;margin:0 0 10px}',
    '.row{display:flex;gap:12px;padding:4px 0;font-weight:400}',
    '.row .k{flex:0 0 132px;color:#ffb877;font-weight:600}',
    '.frame{position:fixed;top:14px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:12px;padding:10px 12px 10px 16px;',
    'border-radius:12px;background:rgba(17,20,26,.97);box-shadow:0 10px 40px rgba(0,0,0,.45);pointer-events:auto;max-width:calc(100vw - 28px)}',
    '.frame button{font:inherit;font-weight:600;color:#111;background:' + ACCENT + ';border:0;border-radius:8px;padding:7px 12px;cursor:pointer;white-space:nowrap}',
    '.frame button.x{background:transparent;color:#fff;padding:7px 8px}',
    '.rec{position:fixed;right:14px;bottom:14px;display:flex;align-items:center;gap:8px;height:34px;padding:0 14px 0 12px;border:0;',
    'border-radius:999px;background:rgba(17,20,26,.92);box-shadow:0 6px 22px rgba(0,0,0,.3);color:#fff;font-weight:600;cursor:pointer;',
    'pointer-events:auto;opacity:.4;transition:opacity .2s;white-space:nowrap}',
    '.rec:hover,.rec.on,.rec.wait{opacity:1}',
    '.rec .r{width:10px;height:10px;border-radius:50%;background:#ff3b30;flex:none}',
    '.rec.on .r{animation:blink 1.2s infinite}',
    '.lvl{display:none;width:30px;height:5px;border-radius:3px;background:rgba(255,255,255,.22);overflow:hidden;flex:none}',
    '.rec.on .lvl.live{display:block}',
    '.lvl i{display:block;height:100%;width:0;background:#4cd964;border-radius:3px}',
    '.card{position:fixed;right:16px;bottom:60px;width:380px;max-width:calc(100vw - 32px);padding:16px 18px;border-radius:14px;',
    'background:rgba(17,20,26,.97);box-shadow:0 10px 40px rgba(0,0,0,.45);pointer-events:auto;display:none;font-weight:400}',
    '.card.on{display:block}',
    '.card .title{font-size:14px;font-weight:700;margin:0 0 8px}',
    '.card p{margin:0 0 8px}',
    '.card ol{margin:0 0 10px;padding-left:20px}',
    '.card li{margin:0 0 4px}',
    '.card b{color:#ffb877;font-weight:600}',
    '.card .btns{display:flex;gap:8px;justify-content:flex-end;margin-top:12px}',
    '.card button{font:inherit;font-weight:600;border:0;border-radius:8px;padding:7px 12px;cursor:pointer;color:#111;background:' + ACCENT + '}',
    '.card button.ghost{background:transparent;color:#fff;box-shadow:inset 0 0 0 1px rgba(255,255,255,.3)}',
    '@keyframes blink{50%{opacity:.25}}'
  ].join(''));

  var hole = mk('div', 'hole'), hoverBox = mk('div', 'hover');
  var badge = mk('div', 'badge');
  var pill = mk('div', 'ui pill');
  pill.appendChild(mk('span', 'dot'));
  pill.appendChild(mk('span', null, 'Presenting — click anything to spotlight it · ← → to step · R to record · ? for keys'));
  var toastEl = mk('div', 'ui toast');
  var recBtn = mk('button', 'ui rec');
  recBtn.type = 'button';
  recBtn.title = 'Record a video of this tab (R)';
  var recDot = mk('span', 'r'), recLabel = mk('span', null, 'Record');
  var lvl = mk('span', 'lvl'), lvlFill = mk('i');
  lvl.appendChild(lvlFill);
  recBtn.appendChild(recDot); recBtn.appendChild(lvl); recBtn.appendChild(recLabel);
  var recCard = mk('div', 'ui card');
  var help = mk('div', 'ui help');
  help.appendChild(mk('div', 'title', 'Tutorial Presenter'));
  [
    ['Click', 'Spotlight and zoom in on a step or picture'],
    ['Click it again', 'Widen to the block around it'],
    ['→  or  Space', 'Next item'],
    ['←', 'Previous item'],
    ['Drag across words', 'Highlight them'],
    ['U  /  C', 'Undo last highlight / clear them all'],
    ['Z', 'Zoom on or off (spotlight only)'],
    ['+  /  −', 'Zoom in more / less'],
    ['Esc', 'Back to the whole page'],
    ['⌘-click or Ctrl-click', 'Use a link normally'],
    ['R', 'Start or stop a video recording'],
    ['M', 'Mute or unmute your microphone while recording'],
    ['Q', 'Quit (or click the bookmark again)']
  ].forEach(function (r) {
    var row = mk('div', 'row');
    row.appendChild(mk('span', 'k', r[0]));
    row.appendChild(mk('span', null, r[1]));
    help.appendChild(row);
  });
  [hole, hoverBox, badge, pill, toastEl, help, recBtn, recCard].forEach(function (n) { shadow.appendChild(n); });
  root.appendChild(host);

  var removePageSheet = addSheet(doc, '::highlight(tutorial-presenter){background-color:#ffe24a;color:#111}');

  /* ---------- small UI helpers ---------- */
  var toastT = 0, pillT = 0;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('on');
    clearTimeout(toastT);
    toastT = setTimeout(function () { toastEl.classList.remove('on'); }, 1700);
  }
  function showPill() {
    pill.classList.remove('idle');
    clearTimeout(pillT);
    pillT = setTimeout(function () { pill.classList.add('idle'); }, 6000);
  }
  function inHost(e) {
    return e.composedPath ? e.composedPath().indexOf(host) >= 0 : e.target === host;
  }

  /* ---------- deciding what a click or a step lands on ---------- */
  var MEDIA = /^(IMG|VIDEO|CANVAS|PICTURE|IFRAME)$/;
  var LEAF = /^(P|H[1-6]|IMG|PRE|VIDEO|CANVAS|PICTURE|IFRAME|DT|FIGCAPTION|SUMMARY|TR|CAPTION)$/;
  var GROUP = /^(LI|FIGURE|BLOCKQUOTE|TABLE|DD)$/;
  var SKIP = /^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE|NAV|FOOTER|HEAD|BR|HR|SELECT|OPTION|INPUT|BUTTON|TEXTAREA|LINK|META)$/;

  function isSvg(n) { return n.namespaceURI === 'http://www.w3.org/2000/svg'; }
  function svgRoot(n) {
    var top = null;
    for (var p = n; p && p.nodeType === 1; p = p.parentElement) if (isSvg(p) && p.localName === 'svg') top = p;
    return top;
  }
  function isInline(n) {
    var d = getComputedStyle(n).display;
    return d === 'inline' || d === 'contents';
  }
  function visible(n) {
    if (n.checkVisibility) {
      if (!n.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return false;
    } else if (!n.getClientRects().length) return false;
    var r = n.getBoundingClientRect();
    return r.width > 3 && r.height > 3;
  }
  function layoutHeight(n) {                                   // height before any zoom of ours
    return n.offsetHeight || n.getBoundingClientRect().height / (cur.s || 1);
  }
  function hasText(n) {
    for (var c = n.firstChild; c; c = c.nextSibling) if (c.nodeType === 3 && /\S/.test(c.nodeValue)) return true;
    return false;
  }

  /* the rectangle to light up: hug the words where the block is wider than its text,
     keep the full box where it has its own background or border, and include a list number */
  var rng = doc.createRange();
  function rectOf(n) {
    var r = n.getBoundingClientRect();
    var box = { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
    if (isSvg(n) || MEDIA.test(n.tagName)) return box;
    var cs = getComputedStyle(n);
    var boxed = cs.backgroundImage !== 'none' || cs.boxShadow !== 'none' ||
      !/^(transparent|rgba\(.*,\s*0\))$/.test(cs.backgroundColor) ||
      parseFloat(cs.borderTopWidth) + parseFloat(cs.borderRightWidth) + parseFloat(cs.borderBottomWidth) + parseFloat(cs.borderLeftWidth) > 0;
    if (!boxed) {
      rng.selectNodeContents(n);
      var c = rng.getBoundingClientRect();
      if (c.width > 1 && c.height > 1) {
        box.left = Math.max(box.left, c.left); box.right = Math.min(box.right, c.right);
        box.top = Math.max(box.top, c.top); box.bottom = Math.min(box.bottom, c.bottom);
      }
    }
    if (cs.display === 'list-item' && cs.listStyleType !== 'none' && cs.listStylePosition !== 'inside') {
      var gutter = 2 * parseFloat(cs.fontSize) * (n.offsetWidth ? r.width / n.offsetWidth : 1);
      if (cs.direction === 'rtl') box.right += gutter; else box.left -= gutter;
    }
    return box;
  }

  /* what the pointer is over: the picture itself, or the paragraph/step/cell around the words */
  function pick(t) {
    if (!t || t.nodeType !== 1 || t === body || t === root) return null;
    var n = t;
    if (isSvg(n)) n = svgRoot(n) || n;
    else if (!MEDIA.test(n.tagName)) while (n && n !== body && isInline(n)) n = n.parentElement;
    if (!n || n === body || n === root) return null;
    if (layoutHeight(n) > innerHeight * 1.5 && n.children.length > 1) return null;   // a whole section, not an item
    return n;
  }

  /* the ordered list of things the arrow keys walk through */
  function stops() {
    var out = [], vh = innerHeight;
    (function walk(node) {
      for (var n = node.firstElementChild; n; n = n.nextElementSibling) {
        if (n === host) continue;
        if (isSvg(n)) { if (visible(n)) out.push(n); continue; }
        var tag = n.tagName;
        if (SKIP.test(tag) || !visible(n)) continue;
        var cs = getComputedStyle(n);
        if (cs.position === 'fixed' || cs.position === 'sticky') continue;         // toolbars and banners, not content
        if (LEAF.test(tag)) { out.push(n); continue; }
        if (cs.display === 'inline' || cs.display === 'contents') {
          if (n.querySelector('img,svg,video,canvas,picture')) walk(n);
          continue;
        }
        var words = hasText(n), height = layoutHeight(n);
        var nested = tag !== 'TABLE' && n.querySelector('ol,ul,table');
        var callout = !nested && height <= vh * 0.45 &&                             // a tinted note or tip box
          (cs.backgroundImage !== 'none' || !/^(transparent|rgba\(.*,\s*0\))$/.test(cs.backgroundColor));
        if (GROUP.test(tag) || words || callout) {
          if (callout || (height <= vh * 0.8 && !nested)) { out.push(n); continue; }   // small enough to show whole
          if (words) out.push(n);                                                      // show it, then go inside
        }
        walk(n);
      }
    })(body);
    return out;
  }

  /* ---------- moving the page ---------- */
  var cur = { tx: 0, ty: 0, s: 1 };
  var el = null, prevEl = null, ghost = null, last = null, trail = [];
  var moveStart = 0, settleT = 0, ghostT = 0;
  var bs = body.style;
  var orig = { transform: bs.transform, origin: bs.transformOrigin, transition: bs.transition, overflowX: root.style.overflowX };

  function tf(t) { return 'translate(' + t.tx + 'px,' + t.ty + 'px) scale(' + t.s + ')'; }
  function liveTf() {                                          // where the page visibly is right now, mid-move included
    var m = getComputedStyle(body).transform, v = m && m.match(/matrix\(([^)]+)\)/);
    if (!v) return { tx: 0, ty: 0, s: 1 };
    var a = v[1].split(',').map(parseFloat);
    return { s: a[0], tx: a[4], ty: a[5] };
  }

  function place(animate) {
    var from = liveTf();
    bs.transition = 'none';
    bs.transformOrigin = '0 0';
    bs.transform = 'none';
    var b0 = body.getBoundingClientRect();
    if (el) {
      try { el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' }); }
      catch (_) { el.scrollIntoView(); }
    }
    var b1 = body.getBoundingClientRect();
    var to = { tx: 0, ty: 0, s: 1 };
    if (el && cfg.zoom) {
      var r = rectOf(el), rw = r.right - r.left, rh = r.bottom - r.top;
      var vw = root.clientWidth || innerWidth, vh = innerHeight;
      var mx = Math.max(36, vw * 0.05), my = Math.max(36, vh * 0.07);     // room kept around the item
      var picture = isSvg(el) || MEDIA.test(el.tagName);
      var s = Math.min(cfg.max, (vw - 2 * mx) / rw, (vh - 2 * my) / rh);
      s = Math.max(picture ? 0.5 : 1, s);                                 // pictures may shrink to fit; words never do
      var w = rw * s, h = rh * s;
      var left = w <= vw - 2 * mx ? (vw - w) / 2 : mx;
      var top = h <= vh - 2 * my ? (vh - h) / 2 : my;
      to = { s: s, tx: left - b1.left - s * (r.left - b1.left), ty: top - b1.top - s * (r.top - b1.top) };
    }
    // start from exactly what was on screen, so the jump in scroll position is never seen
    bs.transform = tf({ tx: from.tx + (b0.left - b1.left), ty: from.ty + (b0.top - b1.top), s: from.s });
    if (to.s !== 1 || from.s !== 1) root.style.overflowX = 'hidden';   // no sideways scrollbar while enlarged
    void body.offsetWidth;
    if (animate && MS) bs.transition = 'transform ' + MS + 'ms ' + EASE;
    bs.transform = tf(to);
    cur = to;
    clearTimeout(settleT);
    settleT = setTimeout(settle, animate ? MS + 60 : 0);
  }
  function settle() {                                          // back at normal size: leave the page truly untouched
    if (cur.s === 1 && !cur.tx && !cur.ty) {
      bs.transition = 'none';
      bs.transform = 'none';
      root.style.overflowX = orig.overflowX;
    }
  }

  function focus(target, keepTrail) {
    if (!target || !target.isConnected) return;
    if (!keepTrail) trail = [];
    prevEl = el && el.isConnected ? el : null;
    moveStart = performance.now();
    el = last = target;
    ghost = null;
    hov = null;
    place(true);
    hole.style.opacity = '1';
  }
  function clear() {
    if (!el) return;
    last = el; ghost = el; el = null; prevEl = null; trail = [];
    hole.style.opacity = '0';
    clearTimeout(ghostT);
    ghostT = setTimeout(function () { ghost = null; }, MS + 80);
    place(true);
  }

  function sameBox(a, b) { return Math.abs(a.width - b.width) < 5 && Math.abs(a.height - b.height) < 5; }
  function widen() {
    if (!el) return;
    var r = el.getBoundingClientRect(), p = el.parentElement;
    while (p && p !== body && p !== root) {
      var q = p.getBoundingClientRect();
      if (q.width > 3 && q.height > 3 && !sameBox(q, r)) break;
      p = p.parentElement;
    }
    if (!p || p === body || p === root || layoutHeight(p) > innerHeight * 3) { toast('That is as wide as it goes'); return; }
    var was = el;
    trail.push(was);
    focus(p, true);
  }
  function narrow() {
    var c = trail.pop();
    if (c && c.isConnected) focus(c, true);
  }

  function onScreen(n) {
    var r = n.getBoundingClientRect();
    return r.bottom > 0 && r.top < innerHeight;
  }
  function step(dir) {
    var list = stops();
    if (!list.length) { toast('Nothing to step through on this page'); return; }
    var from = el || (last && last.isConnected && onScreen(last) ? last : null);
    var i = -1, k;
    if (from) {
      var at = list.indexOf(from);
      if (at >= 0) i = at + dir;
      else if (dir > 0) {
        for (k = 0; k < list.length; k++) {
          if ((from.compareDocumentPosition(list[k]) & 4) && !from.contains(list[k])) { i = k; break; }
        }
        if (i < 0) i = list.length;
      } else {
        for (k = list.length - 1; k >= 0; k--) {
          if ((from.compareDocumentPosition(list[k]) & 2) && !list[k].contains(from)) { i = k; break; }
        }
      }
    } else if (dir > 0) {                                      // nothing chosen yet: start with the first item in view
      for (k = 0; k < list.length; k++) if (list[k].getBoundingClientRect().top >= -2) { i = k; break; }
      if (i < 0) i = list.length;
    } else {
      for (k = list.length - 1; k >= 0; k--) if (list[k].getBoundingClientRect().bottom <= innerHeight + 2) { i = k; break; }
    }
    if (i < 0) { toast('Start of the page'); return; }
    if (i >= list.length) { toast('End of the page'); return; }
    focus(list[i]);
  }

  /* ---------- highlighter ---------- */
  var marks = null, markList = [];
  function mark(range) {
    if (!(window.CSS && CSS.highlights && window.Highlight)) { toast('Highlighting needs a newer browser'); return; }
    if (!marks) { marks = new Highlight(); CSS.highlights.set('tutorial-presenter', marks); }
    marks.add(range);
    markList.push(range);
  }
  function unmark(all) {
    if (!marks || !markList.length) return;
    if (all) { markList.forEach(function (r) { marks.delete(r); }); markList = []; toast('Highlights cleared'); }
    else marks.delete(markList.pop());
  }

  /* ---------- drawing the spotlight and the hover outline ---------- */
  var hov = null, hovAt = 0, raf = 0;
  function boxOf(n) {
    var r = rectOf(n);
    return { x: r.left - PAD, y: r.top - PAD, w: r.right - r.left + 2 * PAD, h: r.bottom - r.top + 2 * PAD };
  }
  function setBox(node, b) {
    var st = node.style;
    st.transform = 'translate(' + b.x + 'px,' + b.y + 'px)';
    st.width = b.w + 'px';
    st.height = b.h + 'px';
  }
  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (rec) meter();
    var target = el || ghost;
    if (target) {
      if (!target.isConnected) { if (el) clear(); ghost = null; }
      else {
        var b = boxOf(target);
        if (el && prevEl && prevEl.isConnected && MS) {          // glide the spotlight from the last item to this one
          var t = Math.min(1, (now - moveStart) / MS);
          if (t < 1) {
            var e = 1 - Math.pow(1 - t, 3), a = boxOf(prevEl);
            b = { x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e, w: a.w + (b.w - a.w) * e, h: a.h + (b.h - a.h) * e };
          } else prevEl = null;
        }
        setBox(hole, b);
      }
    }
    if (hov && hov.isConnected && !down && now - hovAt < 1600) {
      var r = rectOf(hov);
      setBox(hoverBox, { x: r.left - 4, y: r.top - 4, w: r.right - r.left + 8, h: r.bottom - r.top + 8 });
      hoverBox.style.opacity = '1';
    } else hoverBox.style.opacity = '0';
  }

  /* ---------- mouse and keyboard ---------- */
  var down = false, downX = 0, downY = 0, dragged = false;
  function passes(e) { return inHost(e) || e.metaKey || e.ctrlKey; }

  function onMove(e) {
    if (inHost(e)) { hov = null; return; }
    var c = pick(e.target);
    hov = c && c !== el ? c : null;
    hovAt = performance.now();
  }
  function onDown(e) {
    if (passes(e)) return;
    e.stopPropagation();
    if (e.type !== 'mousedown' || e.button !== 0) return;
    down = true; dragged = false; downX = e.clientX; downY = e.clientY;
  }
  function onUp(e) {
    if (passes(e)) return;
    e.stopPropagation();
    if (e.type !== 'mouseup' || !down) return;
    down = false;
    if (Math.abs(e.clientX - downX) + Math.abs(e.clientY - downY) < 6) return;
    dragged = true;                                            // a drag, not a click
    var sel = window.getSelection && getSelection();
    if (sel && !sel.isCollapsed && sel.rangeCount) {
      mark(sel.getRangeAt(0).cloneRange());
      sel.removeAllRanges();
    }
  }
  function onClick(e) {
    if (passes(e)) return;
    e.preventDefault();                                        // links stay put while presenting
    e.stopPropagation();
    if (e.button !== 0) return;
    if (dragged) { dragged = false; return; }
    if (e.detail > 1) return;
    var c = pick(e.target);
    if (!c) { clear(); return; }
    if (c === el) widen(); else focus(c);
  }
  function onOther(e) { if (!passes(e)) e.stopPropagation(); }

  function onKey(e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var t = e.target;
    if (t && t.nodeType === 1 && !inHost(e) && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    var used = true;
    switch (e.key) {
      case 'ArrowRight': case 'PageDown': case 'Enter': step(1); break;
      case ' ': step(e.shiftKey ? -1 : 1); break;
      case 'ArrowLeft': case 'PageUp': step(-1); break;
      case 'Escape':
        if (recCard.classList.contains('on')) recCard.classList.remove('on');
        else if (help.classList.contains('on')) help.classList.remove('on'); else clear();
        break;
      case 'z': case 'Z':
        cfg.zoom = !cfg.zoom; save();
        toast(cfg.zoom ? 'Zoom on' : 'Zoom off — spotlight only');
        if (el) { prevEl = null; place(true); }
        break;
      case '+': case '=': case '-': case '_':
        cfg.max = Math.round(Math.max(1.2, Math.min(4, cfg.max + (e.key === '-' || e.key === '_' ? -0.3 : 0.3))) * 10) / 10;
        cfg.zoom = true; save();
        toast('Zoom up to ' + cfg.max + '×');
        if (el) { prevEl = null; place(true); }
        break;
      case 'w': case 'W': widen(); break;
      case 'n': case 'N': narrow(); break;
      case 'u': case 'U': case 'Backspace': unmark(false); break;
      case 'c': case 'C': unmark(true); break;
      case '?': case '/': case 'h': case 'H': help.classList.toggle('on'); break;
      case 'r': case 'R':
        if (rec) stopRec();
        else if (recCard.classList.contains('on')) { recCard.classList.remove('on'); askRec(); }   // R again = record a WebM anyway
        else startRec();
        break;
      case 'm': case 'M': muteRec(); break;
      case 'q': case 'Q': quit(); break;
      default: used = false;
    }
    if (used) { e.preventDefault(); e.stopPropagation(); }
  }
  function onResize() { if (el) { prevEl = null; place(false); } }

  var wired = [
    ['mousemove', onMove], ['pointerdown', onDown], ['mousedown', onDown], ['pointerup', onUp], ['mouseup', onUp],
    ['click', onClick], ['dblclick', onOther], ['auxclick', onOther], ['keydown', onKey], ['resize', onResize]
  ];
  wired.forEach(function (w) { window.addEventListener(w[0], w[1], true); });

  /* ---------- a tutorial shown inside a frame can't be reached from here ---------- */
  (function checkFrames() {
    var vw = innerWidth, vh = innerHeight, best = null, area = 0;
    Array.prototype.forEach.call(doc.querySelectorAll('iframe'), function (f) {
      var r = f.getBoundingClientRect();
      var a = Math.max(0, Math.min(r.right, vw) - Math.max(r.left, 0)) * Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
      if (a > area) { area = a; best = f; }
    });
    if (!best || area < 0.35 * vw * vh || !/^(https?|file):/.test(best.src || '')) return;
    var bar = mk('div', 'ui frame');
    bar.appendChild(mk('span', null, 'This page shows the tutorial inside a frame the presenter can’t reach.'));
    var open = mk('button', null, 'Open it in its own tab');
    open.addEventListener('click', function () {
      window.open(best.src, '_blank');
      bar.remove();
      toast('In the new tab, click the bookmark again');
    });
    var x = mk('button', 'x', '✕');
    x.setAttribute('aria-label', 'Dismiss');
    x.addEventListener('click', function () { bar.remove(); });
    bar.appendChild(open); bar.appendChild(x);
    shadow.appendChild(bar);
  })();

  /* ---------- recording a short video of the tab, with your voice ---------- */
  var rec = null, recWaiting = false, alive = true;
  function recLook() {
    recBtn.classList.toggle('on', !!rec);
    recBtn.classList.toggle('wait', recWaiting);
    if (!rec) { recLabel.textContent = recWaiting ? 'Choose what to record\u2026' : 'Record'; return; }
    var sec = Math.floor((Date.now() - rec.t0) / 1000);
    recLabel.textContent = Math.floor(sec / 60) + ':' + ('0' + sec % 60).slice(-2) +
      (rec.mic ? (rec.muted ? ' \u00b7 mic off' : '') : ' \u00b7 no sound') + ' \u00b7 Stop';
  }
  function stopAll(streams) {
    streams.forEach(function (st) { if (st) st.getTracks().forEach(function (t) { t.stop(); }); });
  }
  function guard(e) { e.preventDefault(); e.returnValue = ''; }   // warn before leaving mid-recording
  function canMp4() {
    return ['video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4;codecs=avc1'].some(function (t) { return MediaRecorder.isTypeSupported(t); });
  }
  /* Firefox can only save WebM, which Canvas won't take, so point to the Mac's own recorder instead */
  function showRecCard() {
    while (recCard.firstChild) recCard.firstChild.remove();
    recCard.appendChild(mk('div', 'title', 'Recording in this browser'));
    recCard.appendChild(mk('p', null, 'This browser can only save WebM videos, and Canvas won’t accept those. ' +
      'Your Mac’s own recorder works with the presenter and saves a file Canvas takes:'));
    var ol = mk('ol');
    [['Press ', '⌘ Shift 5', '.'],
     ['Choose ', 'Record Entire Screen', ' or Record Selected Portion.'],
     ['Open ', 'Options', ' and pick your microphone. It starts out as None.'],
     ['Click ', 'Record', '. To stop, click the stop button in the menu bar.']].forEach(function (x) {
      var li = mk('li');
      li.appendChild(doc.createTextNode(x[0])); li.appendChild(mk('b', null, x[1])); li.appendChild(doc.createTextNode(x[2]));
      ol.appendChild(li);
    });
    recCard.appendChild(ol);
    recCard.appendChild(mk('p', null, 'The video is saved to your Desktop as a .mov file. Close this box before you start.'));
    var btns = mk('div', 'btns');
    var anyway = mk('button', 'ghost', 'Record a WebM anyway'), ok = mk('button', null, 'Got it');
    anyway.type = ok.type = 'button';
    anyway.addEventListener('click', function () { recCard.classList.remove('on'); askRec(); });
    ok.addEventListener('click', function () { recCard.classList.remove('on'); });
    btns.appendChild(anyway); btns.appendChild(ok);
    recCard.appendChild(btns);
    recCard.classList.add('on');
  }
  function startRec() {
    if (rec || recWaiting) return;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia || !window.MediaRecorder) {
      toast('This browser can’t record from a web page'); return;
    }
    if (!canMp4()) { showRecCard(); return; }
    askRec();
  }
  function askRec() {
    var md = navigator.mediaDevices;
    recWaiting = true; recLook();
    md.getDisplayMedia({                                       // must be asked for straight away, while the click or key press counts
      video: { displaySurface: 'browser', frameRate: 30 },
      audio: false, selfBrowserSurface: 'include', surfaceSwitching: 'exclude', systemAudio: 'exclude'
    }).then(function (screen) {
      var set = screen.getVideoTracks()[0].getSettings ? screen.getVideoTracks()[0].getSettings() : {};
      if (set.width && set.height && (set.width < 480 || set.height < 300)) {   // e.g. the browser's little "sharing" bar
        stopAll([screen]);
        throw { name: 'TooSmall' };
      }
      return md.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
        .then(function (mic) { return [screen, mic]; }, function () { return [screen, null]; });
    }).then(function (got) {
      recWaiting = false;
      if (!alive) { stopAll(got); return; }
      beginRec(got[0], got[1]);
    }, function (err) {
      recWaiting = false; recLook();
      var why = err && err.name;
      toast(why === 'TooSmall' ? 'That picked a tiny window, not the tutorial. Press R and choose the browser window or Entire Screen.'
        : why === 'NotAllowedError' ? 'Recording cancelled' : 'Couldn’t start recording');
    });
  }
  function beginRec(screen, mic) {
    var tracks = screen.getVideoTracks().concat(mic ? mic.getAudioTracks() : []);
    var type = [                       // MP4 with H.264 plays everywhere, QuickTime included; otherwise WebM
      'video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4;codecs=avc1.640028,mp4a.40.2', 'video/mp4;codecs=avc1',
      'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'].filter(function (t) {
      return MediaRecorder.isTypeSupported(t);
    })[0];
    var mr;
    try { mr = new MediaRecorder(new MediaStream(tracks), type ? { mimeType: type, videoBitsPerSecond: 4000000 } : undefined); }
    catch (_) { stopAll([screen, mic]); toast('Couldn’t start recording'); recLook(); return; }
    var r = { mr: mr, chunks: [], streams: [screen, mic], mic: !!mic, muted: false, t0: Date.now(), type: mr.mimeType || type || 'video/webm', peak: 0 };
    rec = r;
    if (mic) {                                                 // a small level meter, so a silent microphone is noticed early
      try {
        var AC = window.AudioContext || window.webkitAudioContext;
        r.ac = new AC();
        r.an = r.ac.createAnalyser();
        r.an.fftSize = 1024;
        r.ac.createMediaStreamSource(mic).connect(r.an);
        r.buf = new Float32Array(r.an.fftSize);
        if (r.ac.state === 'suspended' && r.ac.resume) r.ac.resume();
        lvl.classList.add('live');
      } catch (_) { r.an = null; }
    }
    mr.ondataavailable = function (e) { if (e.data && e.data.size) r.chunks.push(e.data); };
    mr.onstop = function () { saveRec(r); };
    screen.getVideoTracks()[0].addEventListener('ended', stopRec);   // the browser's own "Stop sharing" button
    mr.start(1000);
    r.tick = setInterval(recLook, 500);
    r.check = setTimeout(function () {
      if (rec === r && r.an && !r.muted && r.peak < 0.3) toast('We can’t hear you. Check which microphone your Mac is using in System Settings, under Sound.');
    }, 6000);
    window.addEventListener('beforeunload', guard);
    recLook();
    toast(mic ? 'Recording — press R or click Stop to finish' : 'Recording without sound — the microphone wasn’t allowed');
  }
  function meter() {
    var r = rec;
    if (!r || !r.an) return;
    r.an.getFloatTimeDomainData(r.buf);
    var sum = 0;
    for (var i = 0; i < r.buf.length; i++) sum += r.buf[i] * r.buf[i];
    var db = 10 * Math.log10(sum / r.buf.length + 1e-12);         // about -60 for a quiet room, -20 for speech
    var level = Math.max(0, Math.min(1, (db + 60) / 45));
    if (!r.muted) r.peak = Math.max(r.peak, level);
    lvlFill.style.width = Math.round((r.muted ? 0 : level) * 100) + '%';
  }
  function stopRec() {
    var r = rec;
    if (!r) return;
    rec = null;
    clearInterval(r.tick);
    clearTimeout(r.check);
    lvl.classList.remove('live');
    if (r.ac) { try { r.ac.close(); } catch (_) {} }
    window.removeEventListener('beforeunload', guard);
    if (r.mr.state !== 'inactive') r.mr.stop(); else saveRec(r);
    recLook();
  }
  function muteRec() {
    if (!rec || !rec.mic) return;
    rec.muted = !rec.muted;
    rec.streams[1].getAudioTracks().forEach(function (t) { t.enabled = !rec.muted; });
    toast(rec.muted ? 'Microphone off' : 'Microphone on');
    recLook();
  }
  function saveRec(r) {
    if (r.saved) return;
    r.saved = true;
    stopAll(r.streams);
    if (!r.chunks.length) { toast('Nothing was recorded'); return; }
    var d = new Date(), pad = function (n) { return ('0' + n).slice(-2); };
    var topic = (doc.title || 'tutorial').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50) || 'tutorial';
    var name = topic + '-' + d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + '-' + pad(d.getHours()) + pad(d.getMinutes()) +
      (/mp4/.test(r.type) ? '.mp4' : '.webm');
    var url = URL.createObjectURL(new Blob(r.chunks, { type: r.type.split(';')[0] }));
    var a = mk('a');
    a.href = url; a.download = name;
    (host.isConnected ? shadow : root).appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 120000);
    toast('Saved ' + name + ' to your Downloads');
  }
  recBtn.addEventListener('click', function () {
    if (rec) stopRec();
    else if (recCard.classList.contains('on')) recCard.classList.remove('on');
    else startRec();
  });

  /* ---------- off ---------- */
  function quit() {
    alive = false;
    wired.forEach(function (w) { window.removeEventListener(w[0], w[1], true); });
    if (rec) stopRec();
    cancelAnimationFrame(raf);
    [toastT, pillT, settleT, ghostT].forEach(clearTimeout);
    bs.transition = orig.transition;
    bs.transform = orig.transform;
    bs.transformOrigin = orig.origin;
    root.style.overflowX = orig.overflowX;
    if (marks) { try { CSS.highlights.delete('tutorial-presenter'); } catch (_) {} }
    removePageSheet();
    host.remove();
    try { delete window[KEY]; } catch (_) { window[KEY] = undefined; }
  }

  window[KEY] = { quit: quit, version: '1.0', current: function () { return el; } };
  raf = requestAnimationFrame(frame);
  showPill();
})();
