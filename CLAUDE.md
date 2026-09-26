# 構図ファブリカ（Compositio Fabrica）— Claude Code 向け引き継ぎ

イラストの構図案を自動生成し、描きかけの絵を添削するツール。作者は T（アニメーター）。
公開先は GitHub Pages（https://mosamadamepo.github.io/KouzFab/）と Claude のアーティファクト（src をそのまま公開）の 2 つ。

## ファイル構成

| パス | 役割 |
|---|---|
| `src/kouzu-fabrica.html` | **本体（ここを編集する）**。HTML・CSS・JS がすべて入った単一ファイル。約 4,500 行 |
| `index.html` | 配布版。`python3 tools/build.py` で src から作る（**直接編集しない**） |
| `tools/build.py` | src → index.html。`<head>` と MediaPipe Pose の `<script>` を足すだけ |
| `vendor/kouzu3d.js` | three.js 0.160.1 + @pixiv/three-vrm 2.1.2 の ESM バンドル。`tools/` で `npm i && npm run build:3d` |
| `tools/k3d.entry.js` | 上のバンドルの入口 |
| `mediapipe/pose/` | MediaPipe Pose 0.5（旧版）を自前ホスト。骨格検出はブラウザ内で推論 |
| `models/moo.vrm` | 同梱の 3D 素体（VRoid 製、作者が同梱を許可済み） |
| `tests/smoke.js` / `tests/zh.js` | Playwright の動作確認／繁體中文の訳抜けチェック |

## 開発の流れ

```bash
# 編集
$EDITOR src/kouzu-fabrica.html
# ビルドして確認
python3 tools/build.py
python3 -m http.server 8765            # リポジトリ直下で
cd tools && npm i && npx playwright install chromium   # 初回のみ
node ../tests/smoke.js                 # 期待：errors [] / face off-canvas: 0
node ../tests/zh.js                    # 期待：leftover JP in zh mode: 0
# 反映
git add -A && git commit -m "…" && git push   # Pages は数十秒で更新
```

- `tools/.npmrc`（legacy-peer-deps）があるので `npm i` はそのまま通る（three-vrm 2.1.2 の peer 要求と three 0.160.1 の食い違いを無視するため）。`npm run build:3d` を使うときは esbuild の postinstall が npm に止められていることがあるので、`cd tools && npm install-scripts approve esbuild && npm i`。
- `tests/zh.js` はなぞる用の画像をテスト内で作る。リポジトリに画像は置かない（`*.png` は無視される）。
- 文言を足したら、`ZH` 辞書（`// ---------- language` の節）に繁體中文を必ず足す。`tests/zh.js` が 0 になること。
- `PLUS`（= `typeof Pose !== 'undefined'`）が true なのは配布版だけ。3D 素体・骨格検出・カメラバーは配布版のみ。アーティファクト版では出ない前提でコードを書く。
- 配布版の `k3init()` は `./vendor/kouzu3d.js` を動的 import する。

## 守ること（作者との約束）

- **読み込んだ画像は端末の外に出さない**。メモリ上だけで扱い、保存も送信もしない。残してよいのは、なぞった座標、160px のサムネイル（任意）、22×22 マスの統計、学習した重みだけ（localStorage / IndexedDB）。
- X や Pinterest のスクレイピングはしない。
- GitHub のトークンをチャットやコードに書かない。

## コードの地図（src 内の節見出し `// ---------- … ----------` で検索）

- **constants / state**：`SIZES`・`PATTERNS`・`POSES`・`FACINGS`・`BODYDIRS`・`POSE_DEF`（関節オフセット）・`POSE_Z`（3D の奥行き）。座標は短辺 1000 の仮想座標（`VW`×`VH`）。
- **generator**：`makeComp()` が 1 案をつくる。`buildBody()`（ポーズ・体の入れ方＝まっすぐ／腰を折る／さかさま）、`kousei()`（構成 6 軸）、`scoreComp()`。
- **templates**：過去絵をなぞったテンプレート（`kouzu-templates`）。`tplToFrame()` でスケッチの顔に合わせる。`habits()` が癖の傾向。
- **髪の毛（囲み）**：`fluffLoop()` が囲みを風・重さでぶわっと膨らませる。上部中央の横バー `renderHairPanel()`。
- **3D素体**：`k3loadVRM` / `k3pose`（構図の骨格 → ボーン回転。`c.facing`＝体の向き、`c.headFacing`＝顔の向き＝首のひねり。自動なら体の向きから 45% カメラへ戻し、後ろ向きなら振り返る。生成時の既定は `genFacing` / `genHeadFacing`）/ `k3render`（顔の丸に頭を合わせる。`c.cam` でカメラバーの回転・拡大・移動）/ `k3fingers`（VRM の指ボーンで手の形 `HAND_SHAPES`。置いた手 `c.hands[i].shape`、置いていない腕は `c.handShapes`。`pickHandShape()` が顔との距離帯（`handBand`：そば／中間／遠く）で候補を変え、`autoModel.handPref`（設定パネルやなぞりで選んだ手の形の回数）を重みに足す。`k3pose` 内の 2 本骨 IK で手首を置いた手の位置へ届かせ、3D の手が出ているときは手のスタンプは描かない）/ `k3splitArms`（`k3arm`＝肘から先を 10% 不透明にしてスタンプを使う。既定はオフ）/ `k3variantMats`（2 人目以降を色違い）。
- **カメラバー / 表示バー**：`initCamBar()`（3D カメラ）、`initViewBar()`（キャンバスの見え方＝拡大・回転・移動。`view` と `toUnit()` で座標を逆変換）。
- **本の並び**：`pageOrder`（構図 id と `blank:…`）、`bookSlots()` / `bookSpreads()`（綴じ・1p 単独）、`exportBookPNG()`。見開きは `spread` と `setAspectKeep()`（縦横同倍率で余白を足す）。
- **光**：`lightPoint(c)`。`c.light.dir`（向き）に加えて、光の印をドラッグすると `c.light.pos`（位置）が付き、全体の明暗がそこを中心にずれる。スライダーを動かすと位置は解除。見せ場のスポットは `c.focus` の 1.25 倍の半径。
- **添削**：`analyzeArt()`（9 軸の診断。いまは固定のしきい値で、学習はしない）、`critComps()`（提案）。
- **学習**：`autoModel`（肌色・丸の大きさ等）、マス分類器 `trainCellModel()`、骨格のずれ `learnPoseBias()`。手の形の好み `learnHandShape()`（選び直すと前の 1 回を取り消す）。どれも端末内だけ。

## localStorage のキー

`kouzu-fabrica`（スケッチ・構図案・本の並び・見開き）、`kouzu-templates`、`kouzu-automodel`、`kouzu-learnset`、`kouzu-cellmodel`、`kouzu-lang`、`kouzu-zoom`、`kouzu-props`、`kouzu-k3use`、`kouzu-k3gray`、`kouzu-k3arm`。IndexedDB `kouzu-fabrica` / `files` / `vrm` に読み込んだ VRM。

## 未解決・次にやること

- ~~作者の環境で「構図を生成すると顔も素体も出ない」~~ → 2026-09-25 解決。原因は `tplToFrame()` がスケッチの顔の大きさ（アップ）に合わせて読ませた構図を最大 2.2 倍に拡大し、顔・三角・消失点がキャンバス外へ出ていたこと。いまは「顔・線・三角・（絵の中の）消失点がキャンバスに収まる範囲」までしか拡大・移動しない。
- 添削の分析が甘い：自分の完成絵を基準にする／指摘に ○× を付けて学習、を検討中。
- 見開きのオン・オフが全構図に一括でかかる（1 ページと見開きを混ぜられない）。
- テンプレートの JSON 書き出しに判定の学習データ（マス分類・骨格のずれ）も含める案。
