// 繁體中文表示に日本語が残っていないか（ZH 辞書の抜け）を調べる。期待: leftover JP in zh mode: 0
const { chromium } = require(require.resolve('playwright', {paths: [__dirname + '/../tools']}));
(async () => {
  const b = await chromium.launch({executablePath: process.env.CHROMIUM || undefined}).catch(async e=>{ return await chromium.launch(); });
  const ctx = await b.newContext({viewport:{width:1400,height:900}});
  const p = await ctx.newPage();
  const errs=[]; p.on('pageerror', e=>errs.push(e.message));
  const html = require('fs').readFileSync(require('path').join(__dirname,'..','src','kouzu-fabrica.html'),'utf8');
  await p.setContent('<!doctype html><html><head><meta charset=utf-8></head><body>'+html+'</body></html>', {waitUntil:'load'});
  await p.waitForTimeout(600);
  await p.selectOption('#langSel','zh'); await p.waitForTimeout(300);
  const found = new Set();
  const scan = async (label) => {
    const r = await p.evaluate(() => {
      const out = []; const re = /[ぁ-んァ-ヶー]/;
      const walk = n => { if (n.nodeType === 3) { if (re.test(n.nodeValue)) out.push('T:' + n.nodeValue.trim()); return; } if (n.nodeType !== 1 || n.tagName==='SCRIPT' || n.tagName==='STYLE') return; ['title','placeholder','aria-label','alt'].forEach(a => { const v = n.getAttribute(a); if (v && re.test(v)) out.push('A:' + a + '=' + v); }); n.childNodes.forEach(walk); };
      walk(document.body); return out; });
    r.forEach(x => found.add(label + ' | ' + x));
  };
  await scan('edit');
  // hover/tooltips are attributes -> scanned. Open sketch mode
  await p.click('.thumbs .thumb.sketch'); await p.waitForTimeout(300); await scan('sketch');
  // tools
  for (const t of ['face','flow','tri','loop','marker','vp','erase','select']) { await p.click(`[data-tool=${t}]`); await p.waitForTimeout(50); await scan('tool-'+t); }
  // templates tab empty
  await p.click('#gridTabs [data-tab=tpls]'); await p.waitForTimeout(200); await scan('tpls-empty');
  // trace flow
  // なぞる用の画像はテスト内で作る（リポジトリに画像を置かない）
  const png = Buffer.from((await p.evaluate(() => { const c = document.createElement('canvas'); c.width = 400; c.height = 600; const g = c.getContext('2d'); g.fillStyle = '#e8d8c8'; g.fillRect(0, 0, 400, 600); g.fillStyle = '#c89878'; g.beginPath(); g.arc(200, 180, 60, 0, Math.PI * 2); g.fill(); g.fillRect(150, 240, 100, 250); return c.toDataURL('image/png'); })).split(',')[1], 'base64');
  await p.setInputFiles('#tplFile', [{name: 'shot2.png', mimeType: 'image/png', buffer: png}]); await p.waitForTimeout(700); await scan('trace');
  const box = await p.$eval('#main', e => { const r = e.getBoundingClientRect(); return {x:r.left,y:r.top,w:r.width,h:r.height}; });
  const at = (u,v)=>({x: box.x+box.w*u, y: box.y+box.h*v});
  let a=at(0.4,0.3); await p.mouse.move(a.x,a.y); await p.mouse.down(); let bb=at(0.5,0.3); await p.mouse.move(bb.x,bb.y,{steps:4}); await p.mouse.up();
  await p.click('[data-tool=tri]'); for (const [u,v] of [[0.4,0.15],[0.1,0.9],[0.9,0.9]]) { const q=at(u,v); await p.mouse.click(q.x,q.y); }
  await p.click('[data-tool=vp]'); a=at(0.5,0.8); await p.mouse.click(a.x,a.y);
  await scan('trace-drawn');
  await p.click('#tplSave'); await p.waitForTimeout(400); await scan('tpls-list');
  await p.click('.thumbs .thumb'); await p.waitForTimeout(400); await scan('trace-existing');
  await p.click('#tplCancel'); await p.waitForTimeout(300);
  await p.click('#genBtn'); await p.waitForTimeout(700); await scan('generated');
  await p.click('#varNear'); await p.waitForTimeout(300); await scan('var');
  // toggle layers & modes
  for (const m of ['concept','flat','line']) { await p.click(`#modes [data-mode=${m}]`); await p.waitForTimeout(200); }
  await scan('modes');
  // emphasis on comp
  await p.click('[data-tool=marker]'); a=at(0.6,0.6); await p.mouse.move(a.x,a.y); await p.mouse.down(); for(let i=1;i<=8;i++){const q=at(0.6+0.02*i,0.6);await p.mouse.move(q.x,q.y);} await p.mouse.up(); await p.waitForTimeout(300); await scan('emph');
  // export modal fallback (no downloads capability)
  // exportBtn removed
  await p.click('#gridTabs [data-tab=tpls]'); await p.waitForTimeout(200); await p.click('#tplExport'); await p.waitForTimeout(300); await scan('modal-json'); await p.click('#modalClose');
  await p.click('#gridTabs [data-tab=comps]'); await p.waitForTimeout(200);
  await p.click('#bookClip'); await p.waitForTimeout(2500); await scan('clip');
  await p.click('#sortBtn'); await p.waitForTimeout(200); await scan('sort');
  await p.screenshot({path:'zh.png'});
  // switch back to ja and verify header restored
  await p.selectOption('#langSel','ja'); await p.waitForTimeout(300);
  const back = await p.$eval('#genBtn', e=>e.textContent) + ' / ' + await p.$eval('.brand .logo', e=>e.textContent) + ' / ' + await p.$eval('.stage .tag', e=>e.textContent);
  console.log('errors:', errs); console.log('leftover JP in zh mode:', found.size); [...found].forEach(x=>console.log('  ', x)); console.log('back to ja:', back);
  await b.close();
})().catch(e=>{console.error('FAIL', e.message); process.exit(1);});
