// 配布版（index.html）を http://localhost:8765/ で開いて、生成・見開き・本の並び・3D 素体の読み込みまで一通り動くか確かめる。
// 先に: python3 tools/build.py && python3 -m http.server 8765   （リポジトリ直下で）
const { chromium } = require(require.resolve('playwright', {paths: [__dirname + '/../tools']}));
(async () => {
  const b = await chromium.launch({executablePath: process.env.CHROMIUM || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']});
  const p = await (await b.newContext({viewport: {width: 1500, height: 1000}})).newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8765/index.html');
  for (let i = 0; i < 40; i++) { await p.waitForTimeout(500); if (await p.evaluate(() => /読み込み中の素体/.test(document.querySelector('#props')?.textContent || ''))) { console.log('VRM loaded'); break; } }
  await p.click('#genBtn'); await p.waitForTimeout(1500);
  const bad = await p.evaluate(() => JSON.parse(localStorage.getItem('kouzu-fabrica')).comps.filter(c => { const f = c.faces[0]; return !(f.x > 0 && f.x < c.VW && f.y > 0 && f.y < c.VH); }).length);
  console.log('comps with face off-canvas:', bad);
  for (const k of [0, 1, 2]) { await p.evaluate(k => [...document.querySelectorAll('#thumbs .thumb .chk input')][k].click(), k); await p.waitForTimeout(150); }
  await p.click('#hmenuBtn'); await p.click('#spreadChk'); await p.waitForTimeout(1500); await p.click('#spreadChk'); await p.click('#hmenuBtn'); await p.waitForTimeout(800);
  console.log('book:', await p.$eval('#bookCount', e => e.innerText.replace(/\n/g, ' ')));
  await p.click('#modes [data-mode=concept]'); await p.waitForTimeout(1500); await p.screenshot({path: 'smoke.png'});
  console.log('errors', errs); await b.close(); process.exit(errs.length || bad ? 1 : 0);
})();
