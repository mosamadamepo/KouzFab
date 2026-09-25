"""src/kouzu-fabrica.html（単一ファイルの本体。Claude のアーティファクト版と同じ）から、
GitHub Pages 用の index.html（リポジトリ直下）を作る。違いは MediaPipe Pose の script タグと <head> だけ。
使い方: python3 tools/build.py
"""
import pathlib
root = pathlib.Path(__file__).resolve().parent.parent
s = (root / 'src' / 'kouzu-fabrica.html').read_text(encoding='utf-8')
i = s.rfind('<script>\n(() => {'); assert i > 0, 'main script block not found'
body = s[:i] + '<script src="mediapipe/pose/pose.js"></script>\n' + s[i:]
html = ('<!doctype html>\n<html lang="ja">\n<head>\n<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
        '<link rel="icon" href="data:,">\n</head>\n<body>\n' + body + '\n</body>\n</html>\n')
(root / 'index.html').write_text(html, encoding='utf-8')
print('built index.html', len(html))
