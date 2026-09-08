#!/usr/bin/env python3
"""
書き込み範囲ガードの自己テスト。

.claude/hooks/guard-write-scope.py に実際のフック入力を流し込み、
許可すべきものが許可され、拒否すべきものが拒否されることを確認する。

このファイル自身が保護パスの文字列を含むため、Bash から直接
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
REF_PY = HOME + "/pyhiroba"
REF_HP = HOME + "/pairmind_hp"
REF_HA = HOME + "/haichi_webapp_2026_0510"
REF_CEO = HOME + "/funakoshi-takehiro/ceoprofile"
OWN = HOME + "/eng_std"

# (説明, payload, 期待する exit code)
CASES = [
    # --- 許可されるべき ---
    ("eng_std へ Write",
     {"tool_name": "Write", "tool_input": {"file_path": OWN + "/index.html"}}, 0),
    ("eng_std 内の相対パスへ Write",
     {"tool_name": "Write", "tool_input": {"file_path": "css/style.css"}}, 0),
    ("計画ファイルへ Write",
     {"tool_name": "Write", "tool_input": {"file_path": "/root/.claude/plans/x.md"}}, 0),
    ("参照リポジトリを読むだけの Bash",
     {"tool_name": "Bash", "tool_input": {"command": "cat " + REF_PY + "/sw.js"}}, 0),
    ("参照リポジトリを grep するだけ",
     {"tool_name": "Bash", "tool_input": {"command": "grep -r accent " + REF_HP}}, 0),
    ("eng_std 内での書き込み Bash",
     {"tool_name": "Bash", "tool_input": {"command": "echo x > " + OWN + "/tmp.txt"}}, 0),

    # --- ブロックされるべき ---
    ("pyhiroba へ Write",
     {"tool_name": "Write", "tool_input": {"file_path": REF_PY + "/css/style.css"}}, 2),
    ("pairmind_hp へ Edit",
     {"tool_name": "Edit", "tool_input": {"file_path": REF_HP + "/src/styles/global.css"}}, 2),
    ("ceoprofile へ Edit",
     {"tool_name": "Edit", "tool_input": {"file_path": REF_CEO + "/index.html"}}, 2),
    ("hAIchi へ Write",
     {"tool_name": "Write", "tool_input": {"file_path": REF_HA + "/CLAUDE.md"}}, 2),
    (".. で脱出する相対パス",
     {"tool_name": "Write", "tool_input": {"file_path": "../pyhiroba/x.js"}}, 2),
    ("リダイレクトで参照リポジトリに書く",
     {"tool_name": "Bash", "tool_input": {"command": "echo hi > " + REF_PY + "/x.txt"}}, 2),
    ("参照リポジトリを rm",
     {"tool_name": "Bash", "tool_input": {"command": "rm -rf " + REF_HA + "/docs"}}, 2),
    ("参照リポジトリへ git push",
     {"tool_name": "Bash", "tool_input": {"command": "git -C " + REF_PY + " push origin main"}}, 2),
    ("参照リポジトリを sed -i",
     {"tool_name": "Bash", "tool_input": {"command": "sed -i s/a/b/ " + REF_HP + "/package.json"}}, 2),
    ("参照リポジトリへ cp",
     {"tool_name": "Bash", "tool_input": {"command": "cp a.txt " + REF_CEO + "/a.txt"}}, 2),
]


def main():
    if not os.path.exists(HOOK):
        print("NG: フック本体が見つかりません: " + HOOK)
        return 1

    ok = 0
    ng = 0
    for desc, payload, expected in CASES:
        payload.setdefault("cwd", OWN)
        p = subprocess.run([sys.executable, HOOK],
                           input=json.dumps(payload),
                           capture_output=True, text=True)
        got = p.returncode
        mark = "ok " if got == expected else "NG "
        if got == expected:
            ok += 1
        else:
            ng += 1
        want = "許可" if expected == 0 else "ブロック"
        print("  %s %-38s 期待=%s 実際exit=%d" % (mark, desc, want, got))

    print()
    print("  合格 %d / %d" % (ok, ok + ng))
    if ng:
        print("  失敗 %d 件。ガードが意図通りに効いていません。" % ng)
        return 1
    print("  書き込み範囲ガードは意図通りに動作しています。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
