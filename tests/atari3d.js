// パーツ立体アタリ（atari3d.html）を http://localhost:8765/ で開き、絵と資料をテスト内でつくって一通り動かす：
// 資料を 2 枚タブで開く → ペンで囲んでパーツ化（ひと筆・クリックで点）→ 投げ縄で 1 つ消す → トレイから絵へドラッグ →
// ハンドル（移動）→ 全方式・ローポリ・線画 → ペンでアタリ → ホイールで拡大 → 透過 PNG 書き出し。画像はリポジトリに置かない。
// 先に: python3 -m http.server 8765   （リポジトリ直下で）
const { chromium } = require(require.resolve('playwright', {paths: [__dirname + '/../tools']}));
(async () => {
  const b = await chromium.launch({executablePath: process.env.CHROMIUM || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']});
  const p = await (await b.newContext({viewport: {width: 1400, height: 900}, acceptDownloads: true})).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  p.on('dialog', d => d.accept());
  await p.goto('http://localhost:8765/atari3d.html');
  await p.waitForFunction(() => window.__atari);
  const S = () => p.evaluate(() => { const s = __atari.st; return {view: s.view, refs: s.refs.length, parts: s.parts.length, placed: s.parts.filter(q => q.placed).length, cur: s.cur?.name, method: s.cur?.method}; });
  const png = (w, h, draw) => p.evaluate(([w, h, draw]) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
    new Function('x', 'w', 'h', draw)(x, w, h); return c.toDataURL('image/png').split(',')[1];
  }, [w, h, draw]);
  const file = (name, b64) => ({name, mimeType: 'image/png', buffer: Buffer.from(b64, 'base64')});
  const art = await png(1200, 1600, "x.fillStyle='#fafafa';x.fillRect(0,0,w,h);x.strokeStyle='#333';x.lineWidth=6;x.beginPath();x.arc(600,500,220,0,7);x.stroke();x.strokeRect(300,900,600,500);");
  // メカっぽい資料：灰色の板に色違いの区画・丸いボタン・黒い線
  const ref1 = await png(800, 600, "x.fillStyle='#eee';x.fillRect(0,0,w,h);x.fillStyle='#777';x.fillRect(150,100,500,400);x.fillStyle='#bbb';x.fillRect(200,150,180,300);x.fillStyle='#c33';x.beginPath();x.arc(520,220,60,0,7);x.fill();x.strokeStyle='#111';x.lineWidth=4;x.beginPath();x.moveTo(420,300);x.lineTo(620,300);x.moveTo(420,380);x.lineTo(620,380);x.stroke();");
  const ref2 = await png(600, 800, "x.fillStyle='#fff';x.fillRect(0,0,w,h);const g=x.createLinearGradient(100,100,500,700);g.addColorStop(0,'#c33');g.addColorStop(1,'#36c');x.fillStyle=g;x.beginPath();x.ellipse(300,400,180,300,0,0,7);x.fill();");
  await p.setInputFiles('#fArt', file('art.png', art)); await p.waitForTimeout(300);
  await p.setInputFiles('#fRef', [file('mecha.png', ref1), file('drop.png', ref2)]); await p.waitForTimeout(400);
  console.log('after refs:', JSON.stringify(await S()));
  const box = async () => p.$eval('#wrap', e => { const b = e.getBoundingClientRect(); return [b.left, b.top]; });
  // 画像座標 → 画面座標
  const scr = async q => { const [l, t] = await box(); const v = await p.evaluate(() => { const s = __atari.st; const im = s.view === 'art' ? s.art : s.ref; return im.v; }); return [l + v.ox + q[0] * v.s, t + v.oy + q[1] * v.s]; };
  const stroke = async pts => { await p.mouse.move(...await scr(pts[0])); await p.mouse.down(); for (const q of pts.slice(1)) await p.mouse.move(...await scr(q), {steps: 3}); await p.mouse.up(); await p.waitForTimeout(250); };
  const ring = (cx, cy, rx, ry, n = 36) => Array.from({length: n + 1}, (_, i) => [cx + rx * Math.cos(i / n * 6.283), cy + ry * Math.sin(i / n * 6.283)]);
  // 2 枚目（drop）でひと筆パーツ化
  await stroke(ring(300, 400, 190, 310));
  // 1 枚目（mecha）へ：クリックで点 → 始点クリックで閉じる
  await p.click('#tabs .tab:nth-child(2)'); await p.waitForTimeout(200);
  for (const q of [[140, 90], [660, 90], [660, 510], [140, 510], [140, 90]]) { await p.mouse.click(...await scr(q)); await p.waitForTimeout(60); }
  await p.waitForTimeout(300);
  // 余分にもう 1 つ作って、投げ縄で消す
  await stroke(ring(100, 540, 60, 40));
  const before = (await S()).parts;
  await p.keyboard.press('l'); await stroke(ring(100, 540, 90, 70));
  console.log('parts before/after erase:', before, (await S()).parts);
  // トレイの 1 つ目（drop）を絵へドラッグ、2 つ目（mecha）はクリックで真ん中に
  await p.click('#tabs .tab:nth-child(1)'); await p.waitForTimeout(200);
  const chips = await p.$$('#tray .chip');
  const cb = await chips[0].boundingBox(); const target = await scr([600, 500]);
  await p.mouse.move(cb.x + 30, cb.y + 30); await p.mouse.down(); await p.mouse.move(cb.x + 30, cb.y - 60, {steps: 5}); await p.mouse.move(...target, {steps: 8}); await p.mouse.up(); await p.waitForTimeout(300);
  await (await p.$$('#tray .chip'))[1].click(); await p.waitForTimeout(300);
  console.log('placed:', JSON.stringify(await S()), 'gizmo attached:', await p.evaluate(() => !!__atari.tc.object));
  // メカ方式の中身（区画で段ができているか）
  const zr = await p.evaluate(() => { const g = __atari.st.cur.mesh.geometry.attributes.position; const z = new Set(); for (let i = 0; i < g.count / 2; i++) z.add(Math.round(g.getZ(i))); return z.size; });
  console.log('mech distinct heights:', zr); if (zr < 10) errs.push('mech too flat');
  // 本体ドラッグで移動
  const c0 = await p.evaluate(() => __atari.st.cur.group.position.x);
  const cc = await scr([600, 800]);
  await p.mouse.move(cc[0] + 40, cc[1] + 40); await p.mouse.down(); await p.mouse.move(cc[0] + 120, cc[1] + 40, {steps: 5}); await p.mouse.up();
  console.log('moved by:', Math.round(await p.evaluate(() => __atari.st.cur.group.position.x) - c0));
  for (const m of ['inflate', 'extrude', 'lathe', 'relief', 'box', 'cyl', 'sphere', 'mech']) {
    await p.selectOption('#selMethod', m); await p.waitForTimeout(120);
    const n = await p.evaluate(() => __atari.st.cur.mesh?.geometry.attributes.position.count || 0);
    if (!n) errs.push('empty mesh ' + m);
  }
  await p.click('#bLow'); await p.waitForTimeout(300);
  console.log('lowpoly verts:', await p.evaluate(() => __atari.st.cur.mesh.geometry.index.count / 3 | 0), 'tris');
  for (const m of ['gray', 'flat', 'wire', 'line', 'tex']) { await p.selectOption('#selMode', m); await p.waitForTimeout(100); }
  await p.click('#bLow'); await p.click('#bLine');
  for (const k of ['e', 'r', 'w']) await p.keyboard.press(k);
  console.log('gizmo mode:', await p.evaluate(() => __atari.tc.mode));
  // ペンでアタリ
  await p.keyboard.press('p'); await stroke(ring(600, 1150, 280, 230));
  console.log('target fit:', await p.evaluate(() => { const c = __atari.st.cur; return [!!c.target, Math.round(c.group.position.y)]; }));
  // ホイールで絵の拡大
  const s0 = await p.evaluate(() => __atari.st.art.v.s);
  const wc = await scr([600, 800]); await p.mouse.move(...wc); await p.mouse.wheel(0, -400); await p.waitForTimeout(200);
  console.log('zoom:', +(await p.evaluate(() => __atari.st.art.v.s) / s0).toFixed(2));
  await p.click('#bZoomFit');
  // 線画だけで書き出し（囲みで切る）
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
  await p.selectOption('#selMode', 'tex'); await p.waitForTimeout(300);
  await p.screenshot({path: 'atari3d.png'});
  console.log('errors', errs); await b.close(); process.exit(errs.length || bad ? 1 : 0);
})();
