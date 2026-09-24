# 構図ファブリカ＋（KouzFab）

イラストの構図を自動生成し、描きかけの絵を添削するブラウザアプリです。
このリポジトリは **骨格検出モデル同梱版（＋版）** です。GitHub Pages でそのまま動きます。

- 一枚 HTML 版との違い：`mediapipe/pose/` に MediaPipe Pose（Apache-2.0）を同梱し、「過去絵をなぞる」画面に **「骨格を検出（AI・端末内）」** ボタンが出ます。顔・肩・肘・腰・膝・足・手を拾い、素体（コントラポスト）とテンプレートに反映します。
- 読み込んだ絵は **ブラウザの中だけ** で処理します。どこにも送信・保存しません。外から来るのは、このサイトからのモデルファイルの読み込みだけです。
- 学習（オートなぞりの分類器・癖のパラメータ）と読ませた構図は、ブラウザの localStorage にだけ残ります。別の端末へは「JSONで書き出し／読み込み」で持ち運べます。

## 公開のしかた（GitHub Pages）

1. このフォルダの中身をリポジトリのルートに置いて push（`index.html` がルートにあること）。
2. GitHub の **Settings → Pages → Build and deployment** で **Deploy from a branch** を選び、Branch を `main` / `/ (root)` にして Save。
3. 数分後、`https://<ユーザー名>.github.io/<リポジトリ名>/` で開けます。

### 初回の push（SSH）

```bash
cd KouzFab
git init
git add .
git commit -m "構図ファブリカ＋ 初回"
git branch -M main
git remote add origin git@github.com:mosamadamepo/KouzFab.git
git push -u origin main
```

以後の更新は、差し替えた `index.html` を置いて `git add . && git commit -m "更新" && git push` だけです。

## 構成

```
index.html              アプリ本体（一枚 HTML 版と同じ。骨格検出は mediapipe/pose があるときだけ有効）
mediapipe/pose/         MediaPipe Pose（Apache-2.0）— pose.js, wasm, モデル（full）
LICENSES.md             同梱ライブラリのライセンス表記
.nojekyll               GitHub Pages で _ 始まりのファイルも配信するための印
```

## 使い方（骨格検出）

1. 「過去絵を読ませる」または絵をドロップ／Ctrl+V で貼り付け。
2. 右パネルの **「骨格を検出（AI・端末内）」** を押す。初回だけモデルの読み込みに数秒かかります。
3. 白い四角（関節）はドラッグで直せます。顔の丸・手も同じく。違うところは「消す」か Ctrl+Z。
4. 「テンプレートとして保存」→「構図を生成」で、その骨格の素体（肩・腰の傾き＝コントラポスト）を使った構図が混ざります。
5. 「描きかけを添削」タブでも、骨格から顔を主役として判定します。

苦手なもの：等身の低いデフォルメ、極端なあおり／ふかん、完全な後ろ姿、複数人（いまは1人だけ拾います）。

## ライセンス

- アプリ本体：作者 T（Mazurka Graphic）。
- MediaPipe Pose：Copyright Google LLC, Apache License 2.0（`LICENSES.md`）。
- UTIF.js（TIFF 読み込み、`index.html` に同梱）：MIT。
