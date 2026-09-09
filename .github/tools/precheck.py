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
REQUIRED_SIT = ["id", "category", "level", "difficulty", "place", "listener",
                "want", "situationJa", "answers"]
REQUIRED_ANS = ["en", "ja", "register", "style", "note"]
REGISTERS = {"casual", "neutral", "polite", "formal"}
STYLES = {"oneword", "basic", "contraction", "request", "formal", "casual",
          "existence", "vocab", "context", "considerate", "indirect", "confirm",
          "offer", "apology", "suggest", "explain", "negotiate", "propose",
          "decline", "complain", "reassure"}
# 日本語文中に現れても正常なラテン文字語（必要になったら足す）
ALLOWED_JA_LATIN = {"Wi-Fi", "iPhone", "iPad", "Web", "SNS", "Slack"}

ANSWERS_PER_SITUATION = 10
MIN_REGISTER_SPREAD = 3


def stray_latin(text, where, field):
    """日本語で書くべき欄に英単語が残っていないか。

    situationJa / ja / note は日本語で書く決まり（.github/CLAUDE.md 7 節）。
    英文をそのまま貼ったまま訳し忘れる事故が実際に起きたので機械で止める。
    全て大文字の略語（ATM / SIM）と、日本語文に現れて自然な少数の語は許す。
    """
    # 「…」で囲んだ語は「その英語表現そのものを指している」ので対象外にする。
    text = re.sub(r"\u300c[^\u300d]*\u300d", "", text or "")
    for m in re.finditer(r"[A-Za-z][A-Za-z-]{2,}", text):
        w = m.group()
        if w.isupper() or w in ALLOWED_JA_LATIN:
            continue
        err("%s: %s に英単語が残っています: %r" % (where, field, w))

# 段階ごとの、解答に期待される文の数。
#   min / max … 各解答が満たすべき範囲
#   exact_ratio … 「ちょうど exact 文」であってほしい解答の最低割合
# ★ は 1文が基本。ただし「問題を述べる → どうすればよいか尋ねる」のように、
# 2文にするほうが自然な場面が実在する（例: 電車を乗り間違えたと伝える）。
# そこを不正にすると使える言い方を捨てることになるので、
# 「半数以上が1文」かつ「どれも2文以内」に留めている。
# ★★ との違いは、★★ が10件すべてちょうど2文であること。
SENTENCE_RULES = {
    1: {"min": 1, "max": 2, "exact": 1, "exact_ratio": 0.5},
    2: {"min": 2, "max": 2, "exact": 2, "exact_ratio": 1.0},
    3: {"min": 3, "max": 5, "exact": None, "exact_ratio": 0.0},
}

# 文末とみなさない略語。ここを見落とすと "a.m." を2文と数えてしまう。
_ABBREV = re.compile(
    r"\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|vs|etc|e\.g|i\.e|a\.m|p\.m|U\.S|U\.K)\.")


def count_sentences(text):
    """英文の文数を数える。'.' '?' '!' の連なりを1つの終端として扱う。"""
    t = _ABBREV.sub("X", (text or "").strip())
    t = t.replace("...", "\u2026")
    n = len(re.findall(r"[.?!]+(?:\s|$)", t))
    return max(1, n)


def level_file(cat_id, level):
    """★ は <id>.json、★★/★★★ は <id>-2.json / <id>-3.json。"""
    return "data/situations/%s%s.json" % (cat_id, "" if level == 1 else "-%d" % level)


def check_content():
    cat_path = os.path.join(ROOT, "data", "categories.json")
    if not os.path.exists(cat_path):
        err("data/categories.json がありません")
        return

    try:
        doc = json.loads(read(cat_path))
        cats = doc["categories"]
        levels = doc.get("levels") or []
    except Exception as e:
        err("data/categories.json を読めません: %s" % e)
        return

    level_ids = [l["level"] for l in levels] or [1]
    for lv in level_ids:
        if lv not in SENTENCE_RULES:
            err("categories.json の段階 %r に対応する文数ルールがありません" % lv)

    seen_ids = {}
    per_level = dict((lv, 0) for lv in level_ids)
    planned = dict((lv, 0) for lv in level_ids)

    for lv in level_ids:
        rule = SENTENCE_RULES.get(lv, SENTENCE_RULES[1])
        for c in cats:
            cid = c["id"]
            want_n = (c.get("counts") or {}).get(str(lv), 0)
            planned[lv] += want_n
            rel = level_file(cid, lv)
            path = os.path.join(ROOT, rel)

            if not os.path.exists(path):
                if want_n:
                    warn("未作成: %s （%s / 予定 %d 問）"
                         % (rel, EIK_STARS.get(lv, "?"), want_n))
                continue

            try:
                d = json.loads(read(path))
            except Exception as e:
                err("%s: JSON を読めません: %s" % (rel, e))
                continue

            sits = d.get("situations")
            if not isinstance(sits, list):
                err("%s: situations が配列ではありません" % rel)
                continue

            per_level[lv] += len(sits)
            if len(sits) != want_n:
                warn("%s: %d 問（categories.json の予定は %d 問）"
                     % (rel, len(sits), want_n))

            for s_ in sits:
                check_situation(s_, rel, cid, lv, rule, seen_ids)

    parts = []
    for lv in level_ids:
        parts.append("%s %d/%d問" % (EIK_STARS.get(lv, "?"), per_level[lv], planned[lv]))
    total = sum(per_level.values())
    notes.append("　".join(parts) + "　合計 %d問 / %d解答" % (total, total * ANSWERS_PER_SITUATION))


EIK_STARS = {1: "★", 2: "★★", 3: "★★★"}


def check_situation(s, rel, cid, lv, rule, seen_ids):
    sid = s.get("id", "(id なし)")
    where = "%s [%s]" % (rel, sid)

    for k in REQUIRED_SIT:
        if k not in s or s[k] in (None, ""):
            err("%s: 項目 '%s' がありません" % (where, k))

    if sid in seen_ids:
        err("%s: id が重複しています（%s にも存在）" % (where, seen_ids[sid]))
    else:
        seen_ids[sid] = rel

    if s.get("category") != cid:
        err("%s: category が '%s' になっています（'%s' のはず）"
            % (where, s.get("category"), cid))

    if s.get("level") != lv:
        err("%s: level が %r です（このファイルは %s なので %d のはず）"
            % (where, s.get("level"), EIK_STARS.get(lv, "?"), lv))

    # id にも段階が入っていること（ブックマークから段階を判別するのに使う）
    expect_prefix = cid + ("-" if lv == 1 else "-%d-" % lv)
    if not str(sid).startswith(expect_prefix):
        err("%s: id は '%s…' で始めてください（段階を id から判別しています）"
            % (where, expect_prefix))

    d = s.get("difficulty")
    if d not in (1, 2, 3):
        err("%s: difficulty は 1..3 のいずれか（現在 %r）" % (where, d))

    stray_latin(s.get("situationJa") or "", where, "situationJa")

    want = s.get("want", "")
    if not re.match(r"^You want to |^You want ", want):
        err("%s: want は 'You want to …' の形で書いてください（現在 %r）"
            % (where, want[:60]))
    if not want.endswith("."):
        err("%s: want はピリオドで終えてください" % where)

    ans = s.get("answers")
    if not isinstance(ans, list):
        err("%s: answers が配列ではありません" % where)
        return

    if len(ans) != ANSWERS_PER_SITUATION:
        err("%s: 解答が %d 件です（%d 件にしてください）"
            % (where, len(ans), ANSWERS_PER_SITUATION))

    ens = []
    regs = set()
    exact_hits = 0
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
            n = count_sentences(en)
            if n < rule["min"] or n > rule["max"]:
                err("%s: %s は %d〜%d文のはずですが %d文です: %r"
                    % (aw, EIK_STARS.get(lv, "?"), rule["min"], rule["max"], n, en[:70]))
            if rule["exact"] is not None and n == rule["exact"]:
                exact_hits += 1

        ja = a.get("ja") or ""
        if ja and not re.search(r"[ぁ-んァ-ヶ一-龠]", ja):
            err("%s: ja に日本語が含まれていません: %r" % (aw, ja[:40]))
        for field in ("ja", "note"):
            v = a.get(field) or ""
            m = re.search(r"[\uac00-\ud7a3\u1100-\u11ff\u3130-\u318f]", v)
            if m:
                err("%s: %s にハングルが混入しています: %r" % (aw, field, m.group()))
            if field == "ja":
                # note は英語表現を引用して解説するので対象にしない。
                stray_latin(v, aw, field)

    dup = set(x for x in ens if ens.count(x) > 1)
    if dup:
        err("%s: 同じ状況の中で英文が重複しています: %s"
            % (where, ", ".join(sorted(dup))[:120]))

    if len(regs) < MIN_REGISTER_SPREAD:
        err("%s: 丁寧さの幅が足りません（register が %d 種類、%d 種類以上必要）"
            " — 言い換えの羅列になっていないか確認してください"
            % (where, len(regs), MIN_REGISTER_SPREAD))

    if rule["exact"] is not None and ens:
        need = int(round(len(ens) * rule["exact_ratio"]))
        if exact_hits < need:
            err("%s: ちょうど%d文の解答が %d件しかありません（%d件以上必要）"
                " — この段階は「%d文で答える」練習です"
                % (where, rule["exact"], exact_hits, need, rule["exact"]))


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
                doc = json.loads(read(cat_path))
                real = set(c["id"] for c in doc["categories"])
                if sw_cats != real:
                    err("sw.js の CATEGORY_IDS が categories.json と一致しません。"
                        "不足: %s / 余分: %s"
                        % (sorted(real - sw_cats) or "なし", sorted(sw_cats - real) or "なし"))
                # 段階の一覧も揃っているか
                m3 = re.search(r"const LEVELS = \[(.*?)\];", src, re.S)
                if not m3:
                    err("sw.js の LEVELS を読み取れません")
                else:
                    sw_levels = set(int(x) for x in re.findall(r"\d+", m3.group(1)))
                    real_levels = set(l["level"] for l in (doc.get("levels") or []))
                    if real_levels and sw_levels != real_levels:
                        err("sw.js の LEVELS が categories.json と一致しません: %s vs %s"
                            % (sorted(sw_levels), sorted(real_levels)))
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


def check_public_safety():
    """公開してはいけない文字列が入り込んでいないか。

    問題データは9,000解答あり、目視では追えない。実際に、実在の社名に
    人物名を結び付けた解答が3件混入したまま公開直前まで残った。
    例文には実在の組織・個人を出さない、という決まりを機械で守る。
    ホーム配下の許可外パスは、参照リポジトリ名の再混入を止めるため。

    限界: パスが文字列リテラルとして丸ごと書かれている場合しか拾えない。
    `HOME + "/xxx"` のように連結されると一致しない（自己テストがその形）。
    実際に起きた混入は全てリテラル形だったので、そこを止めるものと割り切る。
    """
    # 例文に出してはいけない実在の固有名詞
    banned_in_data = ["pAIr Mind", "pairmind", "ペアマインド"]
    for dirpath, dirs, files in os.walk(os.path.join(ROOT, "data")):
        dirs[:] = [d for d in dirs if d != ".git"]
        for f in files:
            if not f.endswith(".json"):
                continue
            p = os.path.join(dirpath, f)
            body = read(p)
            for b in banned_in_data:
                if b in body:
                    err("%s: 例文に実在の固有名詞が入っています: %r "
                        "（学習データには架空の名前を使う）" % (rel(p), b))

    # 参照リポジトリの名前・パスがソースへ戻っていないか
    src_exts = (".js", ".css", ".html", ".py", ".sh", ".md", ".json", ".yml")
    pat = re.compile(r"/home/user/(?!eng_std\b)[A-Za-z0-9._-]+")
    for dirpath, dirs, files in os.walk(ROOT):
        dirs[:] = [d for d in dirs if d not in (".git", "node_modules", "data")]
        for f in files:
            if not f.endswith(src_exts):
                continue
            p = os.path.join(dirpath, f)
            for m in pat.finditer(read(p)):
                err("%s: 許可外のホーム配下パスが書かれています: %r "
                    "（public 化で非公開リポジトリ名が露出する）" % (rel(p), m.group()))


# ==========================================================================
def main():
    check_content()
    check_versions()
    check_scripts()
    check_sw_precache()
    check_manifest()
    check_nul()
    check_public_safety()

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
