#!/usr/bin/env python3
"""
eikAIwa 静的チェック（依存パッケージなし）

これは lint ではない。このリポジトリで実際に壊れうる箇所だけを狙って見る。
ビルド工程が無い構成なので、この1本が「壊れたものを本番に出さない」唯一の防波堤になる。

見るもの:
  1. 問題データの妥当性 — 解答がちょうど10件か、必須項目が欠けていないか、
     同じ状況の中で英文が重複していないか、丁寧さが3種類以上に散っているか。
     （「10通りある意味」が失われていないかを機械で測れる唯一の指標）
  2. キャッシュ版数の一致 — index.html の ?v= と sw.js の VERSION。
     更新漏れは古い CSS/JS が固着する最頻出のハマりどころ。
  3. <script> の読み込み漏れ / 幽霊参照 — js/ にあるのに index.html に無い、
     または index.html にあるのに js/ に無い。
     ビルドが無く同一グローバルスコープなので、これは即・白画面になる。
  4. Service Worker のプリキャッシュ一覧と実ファイルの一致。
     漏れるとオフラインで動かない（しかもオンラインでは気づけない）。
  5. manifest / icons の実在。
  6. ソース中の生 NUL バイト（grep が binary 扱いになり調査を妨げる）。

使い方:  python3 .github/tools/precheck.py
終了コード 0 = 合格 / 1 = 不合格
"""
import json
import os
import re
import sys

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))

errors = []
warnings = []
notes = []


def err(msg):
    errors.append(msg)


def warn(msg):
    warnings.append(msg)


def rel(p):
    return os.path.relpath(p, ROOT)


def read(p):
    with open(p, "r", encoding="utf-8") as f:
        return f.read()


# ==========================================================================
# 1. 問題データ
# ==========================================================================
REQUIRED_SIT = ["id", "category", "difficulty", "place", "listener", "want",
                "situationJa", "answers"]
REQUIRED_ANS = ["en", "ja", "register", "style", "note"]
REGISTERS = {"casual", "neutral", "polite", "formal"}
STYLES = {"oneword", "basic", "contraction", "request", "formal", "casual",
          "existence", "vocab", "context", "considerate", "indirect", "confirm",
          "offer", "apology", "suggest"}
ANSWERS_PER_SITUATION = 10
MIN_REGISTER_SPREAD = 3


def check_content():
    cat_path = os.path.join(ROOT, "data", "categories.json")
    if not os.path.exists(cat_path):
        err("data/categories.json がありません")
        return

    try:
        cats = json.loads(read(cat_path))["categories"]
    except Exception as e:
        err("data/categories.json を読めません: %s" % e)
        return

    seen_ids = {}
    grand_total = 0
    planned_total = 0

    for c in cats:
        cid = c["id"]
        planned = c.get("count", 0)
        planned_total += planned
        path = os.path.join(ROOT, "data", "situations", "%s.json" % cid)

        if not os.path.exists(path):
            warn("未作成: data/situations/%s.json （予定 %d 問）" % (cid, planned))
            continue

        try:
            doc = json.loads(read(path))
        except Exception as e:
            err("%s: JSON を読めません: %s" % (rel(path), e))
            continue

        sits = doc.get("situations")
        if not isinstance(sits, list):
            err("%s: situations が配列ではありません" % rel(path))
            continue

        grand_total += len(sits)
        if len(sits) != planned:
            warn("%s: %d 問（categories.json の予定は %d 問）"
                 % (rel(path), len(sits), planned))

        for s in sits:
            sid = s.get("id", "(id なし)")
            where = "%s [%s]" % (rel(path), sid)

            for k in REQUIRED_SIT:
                if k not in s or s[k] in (None, ""):
                    err("%s: 項目 '%s' がありません" % (where, k))

            if sid in seen_ids:
                err("%s: id が重複しています（%s にも存在）" % (where, seen_ids[sid]))
            else:
                seen_ids[sid] = rel(path)

            if s.get("category") != cid:
                err("%s: category が '%s' になっています（'%s' のはず）"
                    % (where, s.get("category"), cid))

            d = s.get("difficulty")
            if d not in (1, 2, 3):
                err("%s: difficulty は 1..3 のいずれか（現在 %r）" % (where, d))

            want = s.get("want", "")
            if not re.match(r"^You want to |^You want ", want):
                err("%s: want は 'You want to …' の形で書いてください（現在 %r）"
                    % (where, want[:60]))
            if not want.endswith("."):
                err("%s: want はピリオドで終えてください" % where)

            ans = s.get("answers")
            if not isinstance(ans, list):
                err("%s: answers が配列ではありません" % where)
                continue

            if len(ans) != ANSWERS_PER_SITUATION:
                err("%s: 解答が %d 件です（%d 件にしてください）"
                    % (where, len(ans), ANSWERS_PER_SITUATION))

            ens = []
            regs = set()
            for i, a in enumerate(ans):
                aw = "%s answers[%d]" % (where, i)
                for k in REQUIRED_ANS:
                    if k not in a or a[k] in (None, ""):
                        err("%s: 項目 '%s' がありません" % (aw, k))
                r = a.get("register")
                if r not in REGISTERS:
                    err("%s: register が不正です: %r（%s のいずれか）"
                        % (aw, r, "/".join(sorted(REGISTERS))))
                else:
                    regs.add(r)
                st = a.get("style")
                if st and st not in STYLES:
                    warn("%s: 見慣れない style: %r" % (aw, st))
                en = (a.get("en") or "").strip()
                if en:
                    ens.append(en.lower().rstrip(".?!"))
                # 日本語訳に英字だけしか無い等の取り違えを拾う
                ja = a.get("ja") or ""
                if ja and not re.search(r"[ぁ-んァ-ヶ一-龠]", ja):
                    err("%s: ja に日本語が含まれていません: %r" % (aw, ja[:40]))
                # ハングルの混入。IME の取り違えで実際に1件混入したので機械で止める
                for field in ("ja", "note"):
                    v = a.get(field) or ""
                    m = re.search(r"[\uac00-\ud7a3\u1100-\u11ff\u3130-\u318f]", v)
                    if m:
                        err("%s: %s にハングルが混入しています: %r"
                            % (aw, field, m.group()))

            dup = set(x for x in ens if ens.count(x) > 1)
            if dup:
                err("%s: 同じ状況の中で英文が重複しています: %s"
                    % (where, ", ".join(sorted(dup))[:120]))

            if len(regs) < MIN_REGISTER_SPREAD:
                err("%s: 丁寧さの幅が足りません（register が %d 種類、%d 種類以上必要）"
                    " — 言い換えの羅列になっていないか確認してください"
                    % (where, len(regs), MIN_REGISTER_SPREAD))

    notes.append("状況 %d 問 / 予定 %d 問（解答 %d 件）"
                 % (grand_total, planned_total, grand_total * ANSWERS_PER_SITUATION))


# ==========================================================================
# 2. キャッシュ版数
# ==========================================================================
def check_versions():
    idx = os.path.join(ROOT, "index.html")
    sw = os.path.join(ROOT, "sw.js")
    base = os.path.join(ROOT, "js", "base.js")
    if not (os.path.exists(idx) and os.path.exists(sw) and os.path.exists(base)):
        err("index.html / sw.js / js/base.js のいずれかがありません")
        return

    html = read(idx)
    vs = set(re.findall(r"\?v=([A-Za-z0-9._-]+)", html))
    if not vs:
        err("index.html に ?v= のキャッシュ版数が1つもありません")
        return
    if len(vs) > 1:
        err("index.html の ?v= が揃っていません: %s" % ", ".join(sorted(vs)))
        return
    v = vs.pop()

    m = re.search(r"VERSION\s*=\s*'eikaiwa-([A-Za-z0-9._-]+)'", read(sw))
    if not m:
        err("sw.js の VERSION を読み取れません")
    elif m.group(1) != v:
        err("版数が一致しません: index.html の ?v=%s に対し sw.js は eikaiwa-%s"
            % (v, m.group(1)))

    m2 = re.search(r"EIK\.VERSION\s*=\s*'([A-Za-z0-9._-]+)'", read(base))
    if not m2:
        err("js/base.js の EIK.VERSION を読み取れません")
    elif m2.group(1) != v:
        err("版数が一致しません: index.html の ?v=%s に対し js/base.js は %s"
            % (v, m2.group(1)))

    notes.append("キャッシュ版数: %s" % v)


# ==========================================================================
# 3. <script> の読み込み漏れ / 幽霊参照
# ==========================================================================
def check_scripts():
    idx = os.path.join(ROOT, "index.html")
    if not os.path.exists(idx):
        return
    html = read(idx)
    referenced = set(re.findall(r'<script src="(js/[^"?]+)', html))

    on_disk = set()
    for dirpath, _dirs, files in os.walk(os.path.join(ROOT, "js")):
        for f in files:
            if f.endswith(".js"):
                on_disk.add(os.path.relpath(os.path.join(dirpath, f), ROOT).replace(os.sep, "/"))

    for p in sorted(referenced - on_disk):
        err("index.html が存在しない JS を読み込んでいます: %s" % p)
    for p in sorted(on_disk - referenced):
        err("js/ にあるのに index.html から読み込まれていません: %s"
            " （同一グローバルスコープなので未定義エラーで白画面になります）" % p)

    # 依存順のごく基本的な確認: base.js が最初、main.js が最後
    order = re.findall(r'<script src="(js/[^"?]+)', html)
    if order and order[0] != "js/base.js":
        err("index.html の最初の <script> は js/base.js にしてください（現在 %s）" % order[0])
    if order and order[-1] != "js/main.js":
        err("index.html の最後の <script> は js/main.js にしてください（現在 %s）" % order[-1])


# ==========================================================================
# 4. Service Worker のプリキャッシュ一覧
# ==========================================================================
def check_sw_precache():
    sw = os.path.join(ROOT, "sw.js")
    if not os.path.exists(sw):
        return
    src = read(sw)

    m = re.search(r"const SHELL = \[(.*?)\];", src, re.S)
    if not m:
        err("sw.js の SHELL 一覧を読み取れません")
        return
    shell = re.findall(r"'([^']*)'", m.group(1))

    for p in shell:
        if p in ("", "index.html"):
            continue
        if not os.path.exists(os.path.join(ROOT, p)):
            err("sw.js がプリキャッシュしようとしているファイルがありません: %s" % p)

    # js/ と css/ と icons/ の実ファイルが SHELL に入っているか
    must = []
    for d in ("js", "css"):
        for dirpath, _dirs, files in os.walk(os.path.join(ROOT, d)):
            for f in files:
                if f.endswith((".js", ".css")):
                    must.append(os.path.relpath(os.path.join(dirpath, f), ROOT).replace(os.sep, "/"))
    for p in sorted(set(must) - set(shell)):
        err("sw.js の SHELL に入っていません: %s （オフラインで動かなくなります）" % p)

    m2 = re.search(r"const CATEGORY_IDS = \[(.*?)\];", src, re.S)
    if m2:
        sw_cats = set(re.findall(r"'([^']+)'", m2.group(1)))
        cat_path = os.path.join(ROOT, "data", "categories.json")
        if os.path.exists(cat_path):
            try:
                real = set(c["id"] for c in json.loads(read(cat_path))["categories"])
                if sw_cats != real:
                    err("sw.js の CATEGORY_IDS が categories.json と一致しません。"
                        "不足: %s / 余分: %s"
                        % (sorted(real - sw_cats) or "なし", sorted(sw_cats - real) or "なし"))
            except Exception:
                pass
    else:
        err("sw.js の CATEGORY_IDS を読み取れません")


# ==========================================================================
# 5. manifest / icons
# ==========================================================================
def check_manifest():
    p = os.path.join(ROOT, "manifest.webmanifest")
    if not os.path.exists(p):
        err("manifest.webmanifest がありません（インストールできません）")
        return
    try:
        mf = json.loads(read(p))
    except Exception as e:
        err("manifest.webmanifest を読めません: %s" % e)
        return

    for k in ("name", "short_name", "start_url", "scope", "display", "icons"):
        if k not in mf:
            err("manifest に '%s' がありません" % k)

    sizes = set()
    for ic in mf.get("icons", []):
        src = ic.get("src", "")
        if not os.path.exists(os.path.join(ROOT, src)):
            err("manifest が参照するアイコンがありません: %s" % src)
        sizes.add(ic.get("sizes"))
    for need in ("192x192", "512x512"):
        if need not in sizes:
            err("manifest に %s のアイコンがありません（インストール要件）" % need)

    if not os.path.exists(os.path.join(ROOT, ".nojekyll")):
        err(".nojekyll がありません（GitHub Pages で一部ファイルが配信されなくなります）")


# ==========================================================================
# 6. NUL バイト
# ==========================================================================
def check_nul():
    exts = (".js", ".css", ".html", ".json", ".webmanifest", ".py", ".yml", ".md")
    for dirpath, dirs, files in os.walk(ROOT):
        dirs[:] = [d for d in dirs if d not in (".git", "node_modules")]
        for f in files:
            if not f.endswith(exts):
                continue
            p = os.path.join(dirpath, f)
            try:
                with open(p, "rb") as fh:
                    if b"\x00" in fh.read():
                        err("%s: 生の NUL バイトが含まれています" % rel(p))
            except Exception:
                pass


# ==========================================================================
def main():
    check_content()
    check_versions()
    check_scripts()
    check_sw_precache()
    check_manifest()
    check_nul()

    for n in notes:
        print("  ・%s" % n)
    if warnings:
        print()
        for w in warnings:
            print("  [注意] %s" % w)
    if errors:
        print()
        for e in errors:
            print("  [エラー] %s" % e)
        print()
        print("  不合格: エラー %d 件 / 注意 %d 件" % (len(errors), len(warnings)))
        return 1

    print()
    print("  合格（注意 %d 件）" % len(warnings))
    return 0


if __name__ == "__main__":
    sys.exit(main())
