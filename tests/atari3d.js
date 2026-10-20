// パーツ立体アタリ（atari3d.html）を http://localhost:8765/ で開き、絵と資料をテスト内でつくって
// 囲む → 立体化（全方式）→ 位置調整 → 透過 PNG 書き出し まで通す。画像はリポジトリに置かない。
// 先に: python3 -m http.server 8765   （リポジトリ直下で）
const { chromium } = require(require.resolve('playwright', {paths: [__dirname + '/../tools']}));
(async () => {
  const b = await chromium.launch({executablePath: process.env.CHROMIUM || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']});
  const p = await (await b.newContext({viewport: {width: 1400, height: 900}, acceptDownloads: true})).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  p.on('dialog', d => d.accept());
  await p.goto('http://localhost:8765/atari3d.html');
  await p.waitForFunction(() => window.__atari);
  const png = (w, h, draw) => p.evaluate(([w, h, draw]) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
    new Function('x', 'w', 'h', draw)(x, w, h); return c.toDataURL('image/png').split(',')[1];
  }, [w, h, draw]);
  const art = await png(1200, 1600, "x.fillStyle='#fafafa';x.fillRect(0,0,w,h);x.strokeStyle='#333';x.lineWidth=6;x.beginPath();x.arc(600,500,220,0,7);x.stroke();x.strokeRect(300,900,600,500);");
  const ref = await png(800, 600, "x.fillStyle='#eee';x.fillRect(0,0,w,h);const g=x.createLinearGradient(200,100,600,500);g.addColorStop(0,'#c33');g.addColorStop(1,'#36c');x.fillStyle=g;x.beginPath();x.ellipse(400,300,180,240,0,0,7);x.fill();");
  await p.setInputFiles('#fArt', {name: 'art.png', mimeType: 'image/png', buffer: Buffer.from(art, 'base64')});
  await p.waitForTimeout(300);
  const drag = async (sel, pts) => {
    const r = await p.$eval(sel, e => { const b = e.getBoundingClientRect(); return [b.left, b.top, b.width, b.height]; });
    const at = ([u, v]) => [r[0] + u * r[2], r[1] + v * r[3]];
    await p.mouse.move(...at(pts[0])); await p.mouse.down();
    for (const q of pts.slice(1)) await p.mouse.move(...at(q), {steps: 6});
    await p.mouse.up(); await p.waitForTimeout(200);
  };
  const circle = (cx, cy, rx, ry) => Array.from({length: 33}, (_, i) => [cx + rx * Math.cos(i / 32 * 6.283), cy + ry * Math.sin(i / 32 * 6.283)]);
  console.log('armed after art:', await p.evaluate(() => __atari.st.armed));
  await drag('#stArt', circle(0.5, 0.31, 0.2, 0.15));
  // 資料はボタンから：資料タブの空の画面の「資料を開く」→ ファイル選択
  await p.click('#bar [data-view=ref]');
  const [fc] = await Promise.all([p.waitForEvent('filechooser'), p.click('#empty [data-open=ref]')]);
  await fc.setFiles({name: 'ref.png', mimeType: 'image/png', buffer: Buffer.from(ref, 'base64')});
  await p.waitForTimeout(300);
  console.log('armed after ref:', await p.evaluate(() => __atari.st.armed));
  await drag('#stRef', circle(0.5, 0.5, 0.24, 0.42));
  const s1 = await p.evaluate(() => { const c = __atari.st.cur; return {crop: !!c.crop, mesh: !!c.mesh, view: __atari.st.view, pos: c.group.position.toArray().map(Math.round), scl: +c.scl.toFixed(3)}; });
  console.log('part:', JSON.stringify(s1));
  for (const m of ['extrude', 'lathe', 'relief', 'box', 'cyl', 'sphere', 'inflate']) {
    await p.selectOption('#selMethod', m); await p.waitForTimeout(150);
    const n = await p.evaluate(() => __atari.st.cur.mesh?.geometry.attributes.position.count || 0);
    console.log(m, 'verts', n); if (!n) errs.push('empty mesh ' + m);
  }
  for (const m of ['gray', 'flat', 'wire', 'tex']) await p.selectOption('#selMode', m);
  await p.check('#ckEdges');
  // 右ドラッグで回転・ドラッグで移動
  const box = await p.$eval('#stArt', e => { const b = e.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height * 0.31]; });
  await p.mouse.move(...box); await p.mouse.down({button: 'right'}); await p.mouse.move(box[0] + 60, box[1] + 20, {steps: 5}); await p.mouse.up({button: 'right'});
  await p.mouse.move(...box); await p.mouse.down(); await p.mouse.move(box[0] + 30, box[1], {steps: 5}); await p.mouse.up();
  console.log('after drag:', await p.evaluate(() => { const g = __atari.st.cur.group; return [g.position.x | 0, +g.rotation.y.toFixed(2)]; }));
  // 2 つ目：複製して書き出し（囲みで切る）
  await p.click('#bDup'); await p.check('#ckClip');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#bExport')]);
  const buf = require('fs').readFileSync(await dl.path());
  const stat = await p.evaluate(async b64 => {
    const im = new Image(); im.src = 'data:image/png;base64,' + b64; await im.decode();
    const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d'); x.drawImage(im, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data; let op = 0, tr = 0;
    for (let i = 3; i < d.length; i += 4) d[i] > 200 ? op++ : d[i] === 0 && tr++;
    return {w: im.width, h: im.height, opaque: op, transparent: tr};
  }, buf.toString('base64'));
  console.log('png:', dl.suggestedFilename(), JSON.stringify(stat));
  const bad = stat.w !== 1200 || stat.h !== 1600 || stat.opaque < 1000 || stat.transparent < stat.w * stat.h * 0.5;
  await p.screenshot({path: 'atari3d.png'});
  console.log('errors', errs); await b.close(); process.exit(errs.length || bad ? 1 : 0);
})();
