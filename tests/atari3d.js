// パーツ立体アタリ（atari3d.html）を http://localhost:8765/ で開き、絵と資料をテスト内でつくって一通り動かす：
// 絵（左）と資料（右）を並べる → 資料を 2 枚 → ペンで囲んでパーツ化（ふちに吸いつく：ひと筆・クリックで点）→ 投げ縄で 1 つ消す →
// トレイから絵へドラッグ → まとめて操作（矢印・輪・拡大の角）→ 全方式・ローポリ・線画 → ペンでアタリ → ホイールで拡大 → 透過 PNG。
// AI 奥行きはテストではネットに出ないよう、window.__depthOverride の作りものの奥行き（まん中が手前の山）で代える。画像はリポジトリに置かない。
// 先に: python3 -m http.server 8765   （リポジトリ直下で）
const { chromium } = require(require.resolve('playwright', {paths: [__dirname + '/../tools']}));
(async () => {
  const b = await chromium.launch({executablePath: process.env.CHROMIUM || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']});
  const p = await (await b.newContext({viewport: {width: 1500, height: 900}, acceptDownloads: true})).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  p.on('dialog', d => d.accept());
  await p.addInitScript(() => {
    window.__depthOverride = async src => {
      const w = 64, h = Math.max(8, Math.round(64 * src.height / src.width)), data = new Float32Array(w * h);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const dx = x / w - 0.5, dy = y / h - 0.5; data[y * w + x] = Math.max(0, 1 - 2 * Math.hypot(dx, dy)); }
      await new Promise(r => setTimeout(r, 50)); return {w, h, data};
    };
  });
  await p.goto('http://localhost:8765/atari3d.html');
  await p.waitForFunction(() => window.__atari);
  const S = () => p.evaluate(() => { const s = __atari.st; return {view: s.view, refs: s.refs.length, parts: s.parts.length, placed: s.parts.filter(q => q.placed).length, cur: s.cur?.name, method: s.cur?.method}; });
  const png = (w, h, draw) => p.evaluate(([w, h, draw]) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
    new Function('x', 'w', 'h', draw)(x, w, h); return c.toDataURL('image/png').split(',')[1];
  }, [w, h, draw]);
  const file = (name, b64) => ({name, mimeType: 'image/png', buffer: Buffer.from(b64, 'base64')});
  const art = await png(1200, 1600, "x.fillStyle='#fafafa';x.fillRect(0,0,w,h);x.strokeStyle='#333';x.lineWidth=6;x.beginPath();x.arc(600,500,220,0,7);x.stroke();x.strokeRect(300,900,600,500);");
  const ref1 = await png(800, 600, "x.fillStyle='#eee';x.fillRect(0,0,w,h);x.fillStyle='#777';x.fillRect(150,100,500,400);x.fillStyle='#bbb';x.fillRect(200,150,180,300);x.fillStyle='#c33';x.beginPath();x.arc(520,220,60,0,7);x.fill();x.strokeStyle='#111';x.lineWidth=4;x.beginPath();x.moveTo(420,300);x.lineTo(620,300);x.moveTo(420,380);x.lineTo(620,380);x.stroke();");
  const ref2 = await png(600, 800, "x.fillStyle='#fff';x.fillRect(0,0,w,h);const g=x.createLinearGradient(100,100,500,700);g.addColorStop(0,'#c33');g.addColorStop(1,'#36c');x.fillStyle=g;x.beginPath();x.ellipse(300,400,180,300,0,0,7);x.fill();");
  await p.setInputFiles('#fArt', file('art.png', art)); await p.waitForTimeout(300);
  await p.setInputFiles('#fRef', [file('mecha.png', ref1), file('drop.png', ref2)]); await p.waitForTimeout(600);
  const split = await p.evaluate(() => document.body.classList.contains('split') && !!document.querySelector('#artPane').offsetWidth && !!document.querySelector('#refPane').offsetWidth);
  console.log('after refs:', JSON.stringify(await S()), 'split view:', split, 'ref depth:', await p.evaluate(() => __atari.st.refs.map(r => r.dstate).join(',')));
  if (!split) errs.push('panes not side by side');
  const pane = k => k === 'art' ? '#wrapArt' : '#wrapRef';
  const scr = async (q, k) => {
    const [l, t] = await p.$eval(pane(k), e => { const b = e.getBoundingClientRect(); return [b.left, b.top]; });
    const v = await p.evaluate(k => { const s = __atari.st; return (k === 'art' ? s.art : s.ref).v; }, k);
    return [l + v.ox + q[0] * v.s, t + v.oy + q[1] * v.s];
  };
  const stroke = async (pts, k) => { await p.mouse.move(...await scr(pts[0], k)); await p.mouse.down(); for (const q of pts.slice(1)) await p.mouse.move(...await scr(q, k), {steps: 3}); await p.mouse.up(); await p.waitForTimeout(300); };
  const ring = (cx, cy, rx, ry, n = 36) => Array.from({length: n + 1}, (_, i) => [cx + rx * Math.cos(i / n * 6.283), cy + ry * Math.sin(i / n * 6.283)]);
  // 2 枚目（drop）：楕円の少し外をひと筆 → ふちに吸いつく
  await stroke(ring(300, 400, 200, 320), 'ref');
  console.log('confirm marks shown:', await p.evaluate(() => !!__atari.pending && !document.querySelector('#penAsk').hidden), 'parts:', (await S()).parts);
  await p.keyboard.press('Enter'); await p.waitForTimeout(200);
  const fitE = await p.evaluate(() => { const q = __atari.st.cur.refPoly; let e = 0; for (const [x, y] of q) e += Math.abs(Math.hypot((x - 300) / 180, (y - 400) / 300) - 1); return e / q.length; });
  console.log('magnet: mean distance from the ellipse edge (relative):', fitE.toFixed(3)); if (fitE > 0.06) errs.push('magnet did not snap');
  // 1 枚目（mecha）：板の角の少し内側をクリック → 始点クリックで閉じる（角に吸いつく）
  await p.click('#tabsRef .tab:nth-child(1)'); await p.waitForTimeout(200);
  for (const q of [[156, 106], [644, 106], [644, 494], [156, 494], [156, 106]]) { await p.mouse.click(...await scr(q, 'ref')); await p.waitForTimeout(80); }
  await p.click('#bAskOk'); await p.waitForTimeout(400);
  const bb = await p.evaluate(() => { const q = __atari.st.cur.refPoly, xs = q.map(v => v[0]), ys = q.map(v => v[1]); return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)].map(Math.round); });
  console.log('mecha outline bbox (want ≈150,100,650,500):', bb.join(','));
  // 余分にもう 1 つ作って、投げ縄で消す
  await stroke(ring(80, 560, 50, 30), 'ref'); await p.click('#bAskNo'); await p.waitForTimeout(150);
  const afterNo = (await S()).parts;
  await stroke(ring(80, 560, 50, 30), 'ref'); await p.keyboard.press('Enter'); await p.waitForTimeout(150);
  const before = (await S()).parts;
  console.log('✕ keeps', afterNo, '/ ✓ makes', before); if (before !== afterNo + 1) errs.push('confirm marks');
  await p.keyboard.press('l'); await stroke(ring(80, 560, 75, 40), 'ref');
  const afterErase = (await S()).parts;
  await p.keyboard.press('Control+z'); await p.waitForTimeout(150); const undone = (await S()).parts;
  await p.keyboard.press('Control+Shift+z'); await p.waitForTimeout(150); const redone = (await S()).parts;
  console.log('parts before/after erase / undo / redo:', before, afterErase, undone, redone);
  if (afterErase !== before - 1 || undone !== before || redone !== afterErase) errs.push('undo/redo erase');
  await p.keyboard.press('p');
  await p.waitForTimeout(800); // 作りものの奥行きの解析を待つ
  // トレイの 1 つ目（drop）を絵へドラッグ、2 つ目（mecha）はクリックで真ん中に
  const chips = await p.$$('#tray .chip');
  const cb = await chips[0].boundingBox(); const target = await scr([600, 500], 'art');
  await p.mouse.move(cb.x + 30, cb.y + 30); await p.mouse.down(); await p.mouse.move(cb.x + 30, cb.y - 60, {steps: 5}); await p.mouse.move(...target, {steps: 8}); await p.mouse.up(); await p.waitForTimeout(300);
  await (await p.$$('#tray .chip'))[1].click(); await p.waitForTimeout(400);
  console.log('placed:', JSON.stringify(await S()), 'gizmos:', await p.evaluate(() => [!!__atari.tc.object, !!__atari.tcR.object, __atari.tc.mode, __atari.tcR.mode].join(',')));
  // AI 奥行きの立体：作りものの山（まん中が手前）が出ているか
  const dz = await p.evaluate(() => {
    const c = __atari.st.cur; const g = c.mesh.geometry.attributes.position, n = g.count / 2;
    let zc = 0, ze = 0, nc = 0, ne = 0;
    for (let i = 0; i < n; i++) { const r = Math.hypot(g.getX(i) / c.crop.W, g.getY(i) / c.crop.H); if (r < 0.1) { zc += g.getZ(i); nc++; } else if (r > 0.3 && r < 0.4) { ze += g.getZ(i); ne++; } }
    return [c.dstate, (zc / nc - ze / ne).toFixed(1)];
  });
  console.log('depth part state / center-minus-edge z:', dz.join(' / ')); if (dz[0] !== 'ok' || !(+dz[1] > 5)) errs.push('depth shape missing');
  // 本体ドラッグで移動・拡大の角で拡大
  const c0 = await p.evaluate(() => __atari.st.cur.group.position.x);
  const cc = await scr([600, 800], 'art');
  await p.mouse.move(cc[0] + 50, cc[1] + 50); await p.mouse.down(); await p.mouse.move(cc[0] + 130, cc[1] + 50, {steps: 5}); await p.mouse.up();
  console.log('moved by:', Math.round(await p.evaluate(() => __atari.st.cur.group.position.x) - c0));
  await p.keyboard.press('Control+z'); await p.waitForTimeout(150);
  const back = Math.round(await p.evaluate(() => __atari.st.cur.group.position.x) - c0);
  console.log('after Ctrl+Z moved by:', back); if (back !== 0) errs.push('undo move');
  await p.keyboard.press('Control+y'); await p.waitForTimeout(150);
  await p.waitForTimeout(100);
  const s0 = await p.evaluate(() => __atari.st.cur.scl), kb = await (await p.$('#knob')).boundingBox();
  await p.mouse.move(kb.x + 8, kb.y + 8); await p.mouse.down(); await p.mouse.move(kb.x + 60, kb.y - 40, {steps: 5}); await p.mouse.up();
  console.log('knob scale x', (await p.evaluate(() => __atari.st.cur.scl) / s0).toFixed(2));
  for (const m of ['mech', 'inflate', 'extrude', 'lathe', 'relief', 'box', 'cyl', 'sphere', 'depth']) {
    await p.selectOption('#selMethod', m); await p.waitForTimeout(120);
    const n = await p.evaluate(() => __atari.st.cur.mesh?.geometry.attributes.position.count || 0);
    if (!n) errs.push('empty mesh ' + m);
  }
  await p.click('#bLow'); await p.waitForTimeout(300);
  console.log('lowpoly tris:', await p.evaluate(() => __atari.st.cur.mesh.geometry.index.count / 3 | 0));
  for (const m of ['gray', 'flat', 'wire', 'line', 'tex']) { await p.selectOption('#selMode', m); await p.waitForTimeout(100); }
  await p.click('#bLow'); await p.click('#bLine');
  await p.mouse.move(...await scr([100, 100], 'art'));
  for (const k of ['e', 'r', 'w', 'q']) await p.keyboard.press(k);
  console.log('gizmo mode:', await p.evaluate(() => __atari.st.gmode));
  // ペンでアタリ（Alt で吸いつかない）
  await p.keyboard.press('p'); await p.keyboard.down('Alt'); await stroke(ring(600, 1150, 280, 230), 'art'); await p.keyboard.up('Alt'); await p.click('#bAskOk'); await p.waitForTimeout(150);
  console.log('target fit:', await p.evaluate(() => { const c = __atari.st.cur; return [!!c.target, Math.round(c.group.position.y)]; }));
  const z0 = await p.evaluate(() => __atari.st.art.v.s);
  const wc = await scr([600, 800], 'art'); await p.mouse.move(...wc); await p.mouse.wheel(0, -400); await p.waitForTimeout(200);
  console.log('zoom:', +(await p.evaluate(() => __atari.st.art.v.s) / z0).toFixed(2));
  await p.click('#zoomArt [data-z=fit]');
  await p.selectOption('#selMode', 'line');
  await p.click('#bExportMenu'); await p.check('#ckClip');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#bExport')]);
  const buf = require('fs').readFileSync(await dl.path());
  const stat = await p.evaluate(async b64 => {
    const im = new Image(); im.src = 'data:image/png;base64,' + b64; await im.decode();
    const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d'); x.drawImage(im, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data; let op = 0, tr = 0;
    for (let i = 3; i < d.length; i += 4) d[i] > 128 ? op++ : d[i] === 0 && tr++;
    return {w: im.width, h: im.height, opaque: op, transparent: tr};
  }, buf.toString('base64'));
  console.log('png:', JSON.stringify(stat));
  const bad = stat.w !== 1200 || stat.h !== 1600 || stat.opaque < 500 || stat.transparent < stat.w * stat.h * 0.5;
  await p.selectOption('#selMode', 'tex'); await p.keyboard.press('q'); await p.waitForTimeout(300);
  await p.screenshot({path: 'atari3d.png'});
  // 狭い画面ではタブで切り替え
  await p.setViewportSize({width: 700, height: 900}); await p.waitForTimeout(300);
  console.log('narrow: split', await p.evaluate(() => document.body.classList.contains('split')), 'tabs', await p.$$eval('#tabs .tab', t => t.length));
  console.log('errors', errs); await b.close(); process.exit(errs.length || bad ? 1 : 0);
})();
