#!/usr/bin/env python3
"""
書き込み範囲ガード (PreToolUse フック)

目的: このセッションで書き込んでよいのは eng_std リポジトリの中だけ、という
      所有者の指示を、モデルの自制ではなくツール実行前の層で担保する。

保護対象は「列挙」ではなく「許可されていないもの全部」として導く。
以前は参照リポジトリの名前を直接書いていたが、このリポジトリは public に
するため、それでは非公開リポジトリの名前がそのまま公開されてしまう。
ALLOWED_ROOTS だけを書き、ホーム配下でそこに入らないものは一律で保護する。
名前を書かないので、参照先が増えても減っても、このファイルは変わらない。

守備範囲と限界（正直に書く）:
  - Write / Edit / NotebookEdit は file_path を絶対パス解決して判定するので確実。
  - Bash は「書き込み動詞 + 許可外パス」をパターンで拾うベストエフォート。
    シェルの完全な構文解析はしていないため、網羅性は保証しない。
    変数展開・eval・base64 経由などはすり抜けうる。
  - これは事故防止であってサンドボックスではない。root で動いているため
    このファイル自体を書き換える能力は残る。ハードな境界は「参照リポジトリに
    push 認証情報が無い」ことのみ。

判定: 許可外なら exit 2（stderr がモデルに返る）。許可なら exit 0。
"""
import json
import os
import re
import sys

# 書き込みを許可するルート
ALLOWED_ROOTS = [
    "/home/user/eng_std",
    "/root/.claude/plans",  # 計画ファイル
    "/tmp/claude-0",        # スクラッチ
    "/tmp",                 # 一時ファイル一般
]

# この配下は、ALLOWED_ROOTS に入らない限りすべて読み取り専用として扱う
GUARDED_HOME = "/home/user"


def resolve(p, cwd):
    if not p:
        return None
    p = os.path.expanduser(p)
    if not os.path.isabs(p):
        p = os.path.join(cwd or "/home/user/eng_std", p)
    return os.path.normpath(p)


def under(path, root):
    return path == root or path.startswith(root.rstrip("/") + "/")


def is_allowed_root(path):
    return any(under(path, r) for r in ALLOWED_ROOTS)


def allowed(path):
    """ホーム配下は許可ルート以外すべて拒否。ホームの外は許可ルートのみ。"""
    if path is None:
        return True
    if under(path, GUARDED_HOME) and not is_allowed_root(path):
        return False
    return is_allowed_root(path)


def protected_dirs():
    """実際に存在する保護対象ディレクトリ。名前はここで初めて実体から得る
    （ソースには残さない）。列挙できなくても allowed() 側で拒否される。"""
    out = []
    try:
        for name in sorted(os.listdir(GUARDED_HOME)):
            p = os.path.join(GUARDED_HOME, name)
            if os.path.isdir(p) and not is_allowed_root(p):
                out.append(p)
    except OSError:
        pass
    return out


def deny(msg):
    sys.stderr.write(
        "書き込み範囲ガードによりブロックしました。\n"
        + msg
        + "\n書き込みが許可されているのは /home/user/eng_std 配下のみです。\n"
        "ホーム配下のそれ以外のディレクトリは、すべて読み取り専用として扱います。\n"
    )
    sys.exit(2)


def main():
    try:
        payload = json.load(sys.stdin)
    except Exception:
        sys.exit(0)  # 解釈できない入力で作業を止めない

    tool = payload.get("tool_name") or ""
    ti = payload.get("tool_input") or {}
    cwd = payload.get("cwd") or "/home/user/eng_std"

    # --- ファイル編集系: 確実に判定できる ---
    if tool in ("Write", "Edit", "NotebookEdit", "MultiEdit"):
        target = resolve(ti.get("file_path") or ti.get("notebook_path"), cwd)
        if not allowed(target):
            deny("  ツール: %s\n  対象: %s" % (tool, target))
        sys.exit(0)

    # --- Bash: ベストエフォート ---
    if tool == "Bash":
        cmd = ti.get("command") or ""
        guarded = protected_dirs()

        # 参照クローンへの push を止める（remote 側の認証は無いが、二重の安全弁）。
        # -C を省略可能にすると「あらゆる git push」に一致してしまい、
        # eng_std への正当な push まで拒否される。-C は必須で書く。
        for r in guarded:
            if re.search(r"\bgit\s+-C\s+%s\S*\s+\S*\s*push\b" % re.escape(r), cmd):
                deny("  参照リポジトリへの push を検出しました。")
        # cwd 自体が保護パスの中にあるなら、そこでの push も止める
        if re.search(r"\bgit\b[^|;&]*\bpush\b", cmd) and not allowed(os.path.normpath(cwd)):
            deny("  保護パス内での push: cwd=%s" % cwd)

        # 書き込み動詞 + 保護パス の同時出現を拾う
        write_verbs = (
            r"(?:>>?|\btee\b|\brm\b|\bmv\b|\bcp\b|\bmkdir\b|\btouch\b|\bchmod\b|"
            r"\bchown\b|\btruncate\b|\bdd\b|\bln\b|\bsed\b[^|]*-i|\bgit\b[^|]*\b"
            r"(?:commit|push|checkout|reset|clean|apply|restore)\b)"
        )
        if re.search(write_verbs, cmd):
            # 実在するディレクトリ名での一致
            for r in guarded:
                if r in cmd:
                    deny("  コマンド中に保護パスと書き込み操作が同時に現れました。\n"
                         "  command: %s" % cmd[:400])
            # 実在しなくても、ホーム配下の許可外パスが書かれていれば止める
            for m in re.finditer(r"/home/user/[A-Za-z0-9._-]+", cmd):
                if not allowed(os.path.normpath(m.group())):
                    deny("  コマンド中に許可外のホーム配下パスと書き込み操作が"
                         "同時に現れました。\n  command: %s" % cmd[:400])

        sys.exit(0)

    sys.exit(0)


if __name__ == "__main__":
    main()
