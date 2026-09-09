#!/usr/bin/env python3
"""guard_selftest.py の追加ケース。

git push の判定は一度壊した実績がある（-C を省略可能にしたため、
あらゆる `git push` に一致し、自分のリポジトリへの正当な push まで拒否した）。
その再発を専用に見張る。

参照リポジトリの実名は書かない（理由は guard_selftest.py の冒頭に同じ）。
"""
import json
import os
import subprocess
import sys

HOOK = os.path.normpath(os.path.join(os.path.dirname(__file__), "..",
                                     ".claude", "hooks", "guard-write-scope.py"))
HOME = "/home/user"
OWN = HOME + "/eng_std"
REF_A = HOME + "/ref_repo_a"
REF_B = HOME + "/ref_repo_b"

CASES = [
    ("自分のリポジトリへ push",
     {"tool_name": "Bash", "tool_input": {"command": "git push -u origin my-branch"},
      "cwd": OWN}, 0),
    ("自分のリポジトリへ push（-C 付き）",
     {"tool_name": "Bash", "tool_input": {"command": "git -C " + OWN + " push origin main"},
      "cwd": OWN}, 0),
    ("自分のリポジトリで commit",
     {"tool_name": "Bash", "tool_input": {"command": "git commit -m 'x'"}, "cwd": OWN}, 0),
    ("参照リポジトリへ push（-C 付き）",
     {"tool_name": "Bash", "tool_input": {"command": "git -C " + REF_A + " push origin main"},
      "cwd": OWN}, 2),
    ("参照リポジトリの中から push",
     {"tool_name": "Bash", "tool_input": {"command": "git push origin main"},
      "cwd": REF_B}, 2),
    ("参照リポジトリの remote を書き換える",
     {"tool_name": "Bash",
      "tool_input": {"command": "git -C " + REF_A + " remote set-url --push origin X"},
      "cwd": OWN}, 2),
]


def main():
    ok = ng = 0
    for desc, payload, expected in CASES:
        p = subprocess.run([sys.executable, HOOK], input=json.dumps(payload),
                           capture_output=True, text=True)
        good = p.returncode == expected
        print("  %s %-40s 期待=%s 実際exit=%d"
              % ("ok " if good else "NG ", desc,
                 "許可" if expected == 0 else "ブロック", p.returncode))
        ok, ng = (ok + 1, ng) if good else (ok, ng + 1)
    print()
    print("  合格 %d / %d" % (ok, ok + ng))
    return 1 if ng else 0


if __name__ == "__main__":
    sys.exit(main())
