#!/bin/sh
# キャッシュ版数を一括で上げる。
#
# CSS / JS / データを変更したら必ず実行すること。
# index.html の全 ?v= と sw.js の VERSION、js/base.js の EIK.VERSION を揃える。
# 更新を忘れると、ブラウザと Service Worker が古い資産を握り続ける。
# （実際、main.js を直したのに版数を据え置いたため、ブラウザが古い JS を
#   キャッシュから返し、直したはずのバグが再現し続けた。）
#
# 使い方:  sh .github/tools/bump-version.sh [版数]
#          省略時は YYYYMMDD + 連番英字 を自動採番する。
set -e
cd "$(dirname "$0")/../.."

if [ -n "$1" ]; then
  STAMP="$1"
else
  TODAY=$(date +%Y%m%d)
  CUR=$(grep -o "EIK\.VERSION = '[A-Za-z0-9._-]*'" js/base.js | sed "s/.*'\(.*\)'/\1/")
  case "$CUR" in
    "$TODAY"*)
      SUF=$(printf '%s' "$CUR" | sed "s/^$TODAY//")
      NEXT=$(printf '%s' "$SUF" | tr 'a-y' 'b-z')
      [ -z "$NEXT" ] && NEXT=a
      STAMP="$TODAY$NEXT" ;;
    *) STAMP="${TODAY}a" ;;
  esac
fi

sed -i -E "s/\?v=[A-Za-z0-9._-]+/?v=$STAMP/g" index.html
sed -i -E "s/const VERSION = 'eikaiwa-[A-Za-z0-9._-]+'/const VERSION = 'eikaiwa-$STAMP'/" sw.js
sed -i -E "s/EIK\.VERSION = '[A-Za-z0-9._-]+'/EIK.VERSION = '$STAMP'/" js/base.js

echo "キャッシュ版数を $STAMP に更新しました"
python3 .github/tools/precheck.py >/dev/null && echo "precheck: 合格"
