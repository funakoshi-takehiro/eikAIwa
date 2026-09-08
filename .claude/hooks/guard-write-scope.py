#!/usr/bin/env python3
"""
書き込み範囲ガード (PreToolUse フック)

目的: このセッションで書き込んでよいのは eng_std リポジトリの中だけ、という
      所有者の指示を、モデルの自制ではなくツール実行前の層で担保する。

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

# 明示的に保護する参照リポジトリ（読み取り専用）
PROTECTED_ROOTS = [
    "/home/user/pairmind_hp",
    "/home/user/haichi_webapp_2026_0510",
    "/home/user/pyhiroba",
    "/home/user/funakoshi-takehiro",
]


def resolve(p, cwd):
    if not p:
        return None
    p = os.path.expanduser(p)
    if not os.path.isabs(p):
        p = os.path.join(cwd or "/home/user/eng_std", p)
    return os.path.normpath(p)


def under(path, root):
    return path == root or path.startswith(root.rstrip("/") + "/")


def allowed(path):
    if path is None:
        return True
    for r in PROTECTED_ROOTS:
        if under(path, r):
            return False
    return any(under(path, r) for r in ALLOWED_ROOTS)


def deny(msg):
    sys.stderr.write(
        "書き込み範囲ガードによりブロックしました。\n"
        + msg
        + "\n書き込みが許可されているのは /home/user/eng_std 配下のみです。\n"
        "参照リポジトリ (pairmind_hp / haichi_webapp_2026_0510 / pyhiroba / "
        "funakoshi-takehiro/*) は読み取り専用です。\n"
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
            deny(f"  ツール: {tool}\n  対象: {target}")
        sys.exit(0)

    # --- Bash: ベストエフォート ---
    if tool == "Bash":
        cmd = ti.get("command") or ""

        # 参照クローンへの push を止める（remote 側の認証は無いが、二重の安全弁）
        for r in PROTECTED_ROOTS:
            if re.search(r"\bgit\s+(-C\s+%s\S*\s+)?push\b" % re.escape(r), cmd):
                deny(f"  参照リポジトリへの push: {r}")

        # 書き込み動詞 + 保護パス の同時出現を拾う
        write_verbs = (
            r"(?:>>?|\btee\b|\brm\b|\bmv\b|\bcp\b|\bmkdir\b|\btouch\b|\bchmod\b|"
            r"\bchown\b|\btruncate\b|\bdd\b|\bln\b|\bsed\b[^|]*-i|\bgit\b[^|]*\b"
            r"(?:commit|push|checkout|reset|clean|apply|restore)\b)"
        )
        has_write = re.search(write_verbs, cmd) is not None
        if has_write:
            for r in PROTECTED_ROOTS:
                if r in cmd:
                    deny(f"  コマンド中に保護パスと書き込み操作が同時に現れました: {r}\n"
                         f"  command: {cmd[:400]}")

        sys.exit(0)

    sys.exit(0)


if __name__ == "__main__":
    main()
