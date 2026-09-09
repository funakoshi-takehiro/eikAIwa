#!/usr/bin/env python3
"""
書き込み範囲ガードの自己テスト。

.claude/hooks/guard-write-scope.py に実際のフック入力を流し込み、
許可すべきものが許可され、拒否すべきものが拒否されることを確認する。

参照リポジトリの実名はここには書かない。このリポジトリは public にするため、
テストコードに名前が残ると、それ自体が非公開リポジトリ名の公開になる。
ガードは「許可ルート以外のホーム配下は全部保護」という規則なので、
実在しない名前でも同じ判定を通り、テストとしては等価に働く。
実在するディレクトリを使う経路だけは、実体から1つ拾って確認する。

このファイル自身がホーム配下のパス文字列を含むため、Bash から直接
ヒアドキュメントで生成しようとするとガードに弾かれる（＝ガードが効いている証拠）。
そのためテストはファイルとして置き、`python3 .github/tools/guard_selftest.py` で回す。
"""
import json
import os
import subprocess
import sys

HOOK = os.path.join(os.path.dirname(__file__), "..", "..", ".claude", "hooks",
                    "guard-write-scope.py")
HOOK = os.path.normpath(HOOK)

HOME = "/home/user"
OWN = HOME + "/eng_std"

# 架空の参照リポジトリ。実名を書かないための代役。
REF_A = HOME + "/ref_repo_a"
REF_B = HOME + "/ref_repo_b"
REF_C = HOME + "/ref_owner/ref_site"

# (説明, payload, 期待する exit code)
CASES = [
    # --- 許可されるべき ---
    ("eng_std へ Write",
     {"tool_name": "Write", "tool_input": {"file_path": OWN + "/index.html"}}, 0),
    ("eng_std 内の相対パスへ Write",
     {"tool_name": "Write", "tool_input": {"file_path": "css/style.css"}}, 0),
    ("計画ファイルへ Write",
     {"tool_name": "Write", "tool_input": {"file_path": "/root/.claude/plans/x.md"}}, 0),
    ("スクラッチへ Write",
     {"tool_name": "Write", "tool_input": {"file_path": "/tmp/claude-0/x.txt"}}, 0),
    ("参照リポジトリを読むだけの Bash",
     {"tool_name": "Bash", "tool_input": {"command": "cat " + REF_A + "/sw.js"}}, 0),
    ("参照リポジトリを grep するだけ",
     {"tool_name": "Bash", "tool_input": {"command": "grep -r accent " + REF_B}}, 0),
    ("eng_std 内での書き込み Bash",
     {"tool_name": "Bash", "tool_input": {"command": "echo x > " + OWN + "/tmp.txt"}}, 0),
    ("eng_std への git push は止めない",
     {"tool_name": "Bash", "tool_input": {"command": "git push -u origin main"}}, 0),

    # --- ブロックされるべき ---
    ("参照リポジトリへ Write",
     {"tool_name": "Write", "tool_input": {"file_path": REF_A + "/css/style.css"}}, 2),
    ("参照リポジトリへ Edit",
     {"tool_name": "Edit", "tool_input": {"file_path": REF_B + "/src/global.css"}}, 2),
    ("入れ子の参照リポジトリへ Edit",
     {"tool_name": "Edit", "tool_input": {"file_path": REF_C + "/index.html"}}, 2),
    (".. で脱出する相対パス",
     {"tool_name": "Write", "tool_input": {"file_path": "../ref_repo_a/x.js"}}, 2),
    ("リダイレクトで参照リポジトリに書く",
     {"tool_name": "Bash", "tool_input": {"command": "echo hi > " + REF_A + "/x.txt"}}, 2),
    ("参照リポジトリを rm",
     {"tool_name": "Bash", "tool_input": {"command": "rm -rf " + REF_B + "/docs"}}, 2),
    ("参照リポジトリへ git push",
     {"tool_name": "Bash", "tool_input": {"command": "git -C " + REF_A + " push origin main"}}, 2),
    ("参照リポジトリを sed -i",
     {"tool_name": "Bash", "tool_input": {"command": "sed -i s/a/b/ " + REF_B + "/package.json"}}, 2),
    ("参照リポジトリへ cp",
     {"tool_name": "Bash", "tool_input": {"command": "cp a.txt " + REF_C + "/a.txt"}}, 2),
    ("ホーム直下へ Write",
     {"tool_name": "Write", "tool_input": {"file_path": HOME + "/notes.txt"}}, 2),
]


def a_real_protected_dir():
    """実在する保護ディレクトリを1つ、実体から拾う（ソースに名前を残さない）。"""
    try:
        for name in sorted(os.listdir(HOME)):
            p = os.path.join(HOME, name)
            if os.path.isdir(p) and p != OWN:
                return p
    except OSError:
        pass
    return None


def run(payload):
    payload.setdefault("cwd", OWN)
    p = subprocess.run([sys.executable, HOOK],
                       input=json.dumps(payload),
                       capture_output=True, text=True)
    return p.returncode


def main():
    if not os.path.exists(HOOK):
        print("NG: フック本体が見つかりません: " + HOOK)
        return 1

    cases = list(CASES)

    # 実在するディレクトリでの判定も1組だけ確認する（名前は実体から取る）
    real = a_real_protected_dir()
    if real:
        cases.append(("実在する参照ディレクトリへ Write",
                      {"tool_name": "Write", "tool_input": {"file_path": real + "/x.txt"}}, 2))
        cases.append(("実在する参照ディレクトリを rm",
                      {"tool_name": "Bash", "tool_input": {"command": "rm -rf " + real}}, 2))

    ok = ng = 0
    for desc, payload, expected in cases:
        got = run(payload)
        if got == expected:
            ok += 1
            mark = "ok "
        else:
            ng += 1
            mark = "NG "
        want = "許可" if expected == 0 else "ブロック"
        print("  %s %-38s 期待=%s 実際exit=%d" % (mark, desc, want, got))

    print()
    print("  合格 %d / %d" % (ok, ok + ng))
    if not real:
        print("  （/home/user が無い環境のため、実在ディレクトリの2件は省略）")
    if ng:
        print("  失敗 %d 件。ガードが意図通りに効いていません。" % ng)
        return 1
    print("  書き込み範囲ガードは意図通りに動作しています。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
