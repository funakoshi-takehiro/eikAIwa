#!/bin/sh
# キャッシュ版数を一括で上げる。
#
# CSS / JS / データを変更したら必ず実行すること。
# index.html の全 ?v= と sw.js の VERSION、js/base.js の EIK.VERSION を揃える。
# 更新を忘れると、ブラウザと Service Worker が古い資産を握り続ける。
# （実際、main.js を直したのに版数を据え置いたため、ブラウザが古い JS を
#   キャッシュから返し、直したはずのバグが再現し続けた。）
#
# 採番は YYYYMMDD + 2桁の連番。以前は英字1文字を tr 'a-y' 'b-z' で送っていたが、
# tr は z を写像に持たないため同日26回目以降は版数が据え置きになり、
# それでも「更新しました」と成功表示が出ていた。キャッシュ優先の
# Service Worker がある以上、版数が前進しなければ修正は永久に届かない。
# 数字なら頭打ちが無く、末尾で前進を検証もする。
#
# 使い方:  sh .github/tools/bump-version.sh [版数]
#          省略時は YYYYMMDD + 連番 を自動採番する。
set -e
cd "$(dirname "$0")/../.."

PREV=$(grep -o "EIK\.VERSION = '[A-Za-z0-9._-]*'" js/base.js | sed "s/.*'\(.*\)'/\1/")

if [ -n "$1" ]; then
  STAMP="$1"
else
  TODAY=$(date +%Y%m%d)
  case "$PREV" in
    "$TODAY"*)
      SUF=$(printf '%s' "$PREV" | sed "s/^$TODAY//")
      # 旧形式（英字1文字）からの移行も受ける
      case "$SUF" in
        [0-9][0-9]) N=$(expr "$SUF" + 1) ;;
        *)          N=$(printf '%s' "$SUF" | wc -c | tr -d ' ') ;;
      esac
      STAMP=$(printf '%s%02d' "$TODAY" "$N") ;;
    *) STAMP="${TODAY}01" ;;
  esac
fi

if [ "$STAMP" = "$PREV" ]; then
  echo "版数が前進していません（$PREV のまま）。採番に失敗しています。" >&2
  exit 1
fi

sed -i -E "s/\?v=[A-Za-z0-9._-]+/?v=$STAMP/g" index.html
sed -i -E "s/const VERSION = 'eikaiwa-[A-Za-z0-9._-]+'/const VERSION = 'eikaiwa-$STAMP'/" sw.js
sed -i -E "s/EIK\.VERSION = '[A-Za-z0-9._-]+'/EIK.VERSION = '$STAMP'/" js/base.js

# 書き換えが本当に効いたかを確かめる。sed が空振りしても set -e では気づけない。
NOW=$(grep -o "EIK\.VERSION = '[A-Za-z0-9._-]*'" js/base.js | sed "s/.*'\(.*\)'/\1/")
if [ "$NOW" != "$STAMP" ]; then
  echo "書き換えに失敗しました（js/base.js は $NOW のまま）。" >&2
  exit 1
fi

echo "キャッシュ版数を $PREV から $STAMP に更新しました"
python3 .github/tools/precheck.py >/dev/null && echo "precheck: 合格"
