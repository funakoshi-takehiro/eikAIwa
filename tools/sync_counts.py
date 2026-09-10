#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""data/categories.json の問題数を、実際のファイルの中身に合わせる。

なぜ要るか:
  categories.json の counts は、アプリが「準備中（N問を予定）」と出すために使う。
  実データを足したのにここを直し忘れると、precheck が
  「45問（categories.json の予定は 15問）」と注意を出す。
  手で13カテゴリ×3段階を数え直すのは間違えるので、機械で合わせる。

使い方:
  python3 tools/sync_counts.py          # 差分を表示するだけ
  python3 tools/sync_counts.py --write  # 実際に書き換える
"""
import io
import json
import os
import sys

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
LEVELS = (1, 2, 3)


def level_path(cat_id, level):
    name = "%s%s.json" % (cat_id, "" if level == 1 else "-%d" % level)
    return os.path.join(ROOT, "data", "situations", name)


def actual_count(cat_id, level):
    p = level_path(cat_id, level)
    if not os.path.exists(p):
        return 0
    with io.open(p, encoding="utf-8") as f:
        return len(json.load(f).get("situations", []))


def main():
    write = "--write" in sys.argv[1:]
    cat_path = os.path.join(ROOT, "data", "categories.json")
    with io.open(cat_path, encoding="utf-8") as f:
        doc = json.load(f)

    changed = []
    for c in doc["categories"]:
        counts = c.setdefault("counts", {})
        for lv in LEVELS:
            key = str(lv)
            now = actual_count(c["id"], lv)
            if counts.get(key) != now:
                changed.append((c["id"], lv, counts.get(key), now))
                counts[key] = now

    if not changed:
        print("  counts は実データと一致しています。")
        return

    for cid, lv, before, after in changed:
        print("  %-11s ★%d  %s → %s" % (cid, lv, before, after))

    if not write:
        print("\n  （--write を付けると書き換えます）")
        return

    with io.open(cat_path, "w", encoding="utf-8") as f:
        f.write(json.dumps(doc, ensure_ascii=False, indent=2) + "\n")
    total = sum(actual_count(c["id"], lv) for c in doc["categories"] for lv in LEVELS)
    print("\n  %d 件を更新しました。全段階の合計 %d 問 / %d 解答。" % (len(changed), total, total * 10))


if __name__ == "__main__":
    main()
