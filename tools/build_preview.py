#!/usr/bin/env python3
"""
プレビュー用の単一 HTML を組み立てる。

なぜ必要か:
  本番は GitHub Pages で配信する PWA（Service Worker + manifest でオフライン動作）
  だが、Pages を有効化するまでは誰も触れない。
  中身をひとつの HTML にまとめておけば、ファイルを開くだけで動作を確認できる。

作られるものの性質:
  - アプリの見た目と学習の流れは本番と同一（同じ CSS / JS / データを使う）
  - Service Worker と manifest は外す。単一ファイルでは意味がないため
    → プレビューは「インストール」も「オフライン」もできない。そこは本番だけの機能
  - 問題データは fetch を差し替えて埋め込みから返す。アプリ側のコードは変更しない

使い方:  python3 tools/build_preview.py [出力先]
"""
import io
import json
import os
import re
import sys

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

# --artifact を付けると、<html>/<head>/<body> を持たない断片を出力する。
# Artifact として公開する場合、その骨組みは公開側が付けるため。
ARTIFACT = "--artifact" in sys.argv
args = [a for a in sys.argv[1:] if not a.startswith("--")]
OUT = args[0] if args else os.path.join(ROOT, "preview", "eikaiwa-preview.html")


def read(rel):
    with io.open(os.path.join(ROOT, rel), encoding="utf-8") as f:
        return f.read()


def main():
    html = read("index.html")

    # ---- 読み込むファイルを index.html の記述順から取る ----
    # 順序は依存関係そのもの。ここで並べ替えてはいけない。
    scripts = re.findall(r'<script src="(js/[^"?]+)', html)
    if not scripts:
        raise SystemExit("index.html から <script> を見つけられませんでした")

    # ---- 問題データを集める ----
    bundle = {"data/categories.json": json.loads(read("data/categories.json"))}
    for c in bundle["data/categories.json"]["categories"]:
        rel = "data/situations/%s.json" % c["id"]
        if os.path.exists(os.path.join(ROOT, rel)):
            bundle[rel] = json.loads(read(rel))

    # ---- 本文を組み立てる ----
    # <head> の外部参照（manifest / アイコン / CSS / JS）を落として、
    # 中身をそのまま埋め込む。
    body = html
    body = re.sub(r'\s*<link rel="manifest"[^>]*>', "", body)
    body = re.sub(r'\s*<link rel="icon"[^>]*>', "", body)
    body = re.sub(r'\s*<link rel="apple-touch-icon"[^>]*>', "", body)
    body = re.sub(r'\s*<link rel="stylesheet" href="css/[^"]*">', "", body)
    body = re.sub(r'\s*<script src="js/[^"]*"></script>', "", body)

    css = read("css/style.css")
    js_parts = []
    for rel in scripts:
        js_parts.append("/* ===== %s ===== */\n%s" % (rel, read(rel)))

    # fetch を差し替えて、埋め込みデータを返す。
    # アプリ側（js/data.js）には一切手を入れない。
    shim = """
/* ── プレビュー用の差し替え ──────────────────────────────────────────────
   単一ファイルでは data/*.json を取りに行けないので、fetch を包んで
   埋め込みデータを返す。アプリ本体のコードは変更していない。
   ────────────────────────────────────────────────────────────────────── */
(function () {
  var BUNDLE = __EIK_BUNDLE__;
  var origFetch = window.fetch ? window.fetch.bind(window) : null;
  window.fetch = function (input) {
    var url = String(typeof input === 'string' ? input : (input && input.url) || '');
    var path = url.split('?')[0];
    for (var key in BUNDLE) {
      if (path.slice(-key.length) === key) {
        return Promise.resolve(new Response(JSON.stringify(BUNDLE[key]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }));
      }
    }
    if (origFetch) return origFetch.apply(null, arguments);
    return Promise.reject(new Error('fetch は利用できません: ' + url));
  };
})();
""".replace("__EIK_BUNDLE__", json.dumps(bundle, ensure_ascii=False, separators=(",", ":")))

    # プレビューであることを画面上でも分かるようにする
    banner = """
<div class="preview-note">
  <strong>プレビュー版</strong>
  <span>ホーム画面への追加とオフライン動作は、GitHub Pages で公開した本番でのみ使えます。</span>
</div>
"""
    banner_css = """
/* プレビュー版であることの表示。本番の index.html には存在しない。 */
.preview-note {
  max-width: 560px; margin: 12px auto 0; padding: 10px 14px;
  display: flex; flex-direction: column; gap: 2px;
  background: var(--accent-soft); border: 1px solid var(--accent-border);
  border-radius: var(--r-sm); color: var(--accent-dk);
  font-size: .78rem; line-height: 1.6;
}
.preview-note strong { font-weight: 700; }
.preview-note span { color: var(--ink-3); }
"""

    body = body.replace("</head>", "<style>\n%s\n%s\n</style>\n</head>" % (css, banner_css))
    body = body.replace('<main id="main" class="main" tabindex="-1">',
                        banner + '<main id="main" class="main" tabindex="-1">')
    body = body.replace("</body>",
                        "<script>\n%s\n%s\n</script>\n</body>" % (shim, "\n".join(js_parts)))

    if ARTIFACT:
        # 文書の骨組みは公開側が付けるので、中身だけにする。
        # <head> の中身（title と style）は body の前にそのまま残す。
        m = re.search(r"<head>(.*?)</head>.*?<body>(.*?)</body>", body, re.S)
        if not m:
            raise SystemExit("head / body を切り出せませんでした")
        head_inner, body_inner = m.group(1), m.group(2)
        # 骨組み側が用意する meta は落とす
        head_inner = re.sub(r'\s*<meta charset[^>]*>', "", head_inner)
        head_inner = re.sub(r'\s*<meta name="viewport"[^>]*>', "", head_inner)
        # 一覧では説明を付けない名前だけのほうが見分けやすいので、
        # <title> はプロダクト名だけにする（説明は公開時の description に回す）
        head_inner = re.sub(r'<title>[^<]*</title>', '<title>eikAIwa</title>', head_inner)
        body = head_inner.strip() + "\n" + body_inner.strip() + "\n"

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with io.open(OUT, "w", encoding="utf-8") as f:
        f.write(body)

    size = os.path.getsize(OUT)
    print("  出力: %s" % os.path.relpath(OUT, ROOT))
    print("  大きさ: %.0f KB" % (size / 1024.0))
    print("  埋め込んだデータ: %d ファイル / 状況 %d 問"
          % (len(bundle),
             sum(len(v.get("situations", [])) for v in bundle.values())))
    print("  埋め込んだ JS: %d ファイル" % len(scripts))


if __name__ == "__main__":
    main()
