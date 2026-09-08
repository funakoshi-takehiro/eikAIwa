# eikAIwa — 英語が口から出る練習

状況を英文で提示し、**自分の言葉を考えて口に出す**。そのあとで **10通りの言い方**と
突き合わせて身につける、英会話スピーキングのトレーニングアプリです。

```
At a train station. You want to find a restroom.   （相手: 駅員）
        ↓ 自分で考えて、声に出す
"Excuse me, could you tell me where the restroom is?"
        ↓
ひとこと 〜 フォーマルまで 10通りと、ニュアンスの違いを比較
```

**株式会社ペアマインド（pAIr Mind, Inc.）** のプロダクトです。

## 使う

<https://funakoshi-takehiro.github.io/eng_std/>

> **公開にはリポジトリを public にする必要があります。**
> 無料プランでは GitHub Pages が public リポジトリでしか使えません。
> Settings → General → Change visibility から public にすれば、
> 次の push で Pages が自動的に有効化されて公開されます
> （`deploy-pages.yml` に `enablement: true` を入れてあります）。

スマホのホーム画面に追加すると、**通信がなくても学習できます**。
追加方法はアプリ内の「設定 → ホーム画面への追加方法」にあります。

- iPhone / iPad: **Safari** で開く → 共有ボタン → ホーム画面に追加
- Android: **Chrome** で開く → ︙ → アプリをインストール

## 特徴

- **状況 300 パターン / 解答 3,000 通り**（13カテゴリ）
- 解答は「ひとこと・基本・ていねい・フォーマル・カジュアル」など
  **丁寧さの軸を固定**して並べ、各文に日本語のニュアンス注が付きます
- 状況の和訳は**既定で伏せてあり**、英語のまま考える訓練になります（設定で変更可）
- 忘れた頃に出し直す**復習アルゴリズム**（Leitner box、5段階 / 1・2・4・7・14日）
- 読み上げ（端末内蔵の音声を使うためオフラインで動作）
- ライト / ダーク、文字サイズ・行間の変更
- **外部通信ゼロ**。学習データは端末の中だけに保存され、どこにも送信されません

## 開発

ビルド工程はありません。HTML / CSS / 素の JavaScript のみで動きます。

```sh
# ローカルで開く（GitHub Pages と同じサブパス配信を再現する）
python3 -m http.server 8080 -d ..
# → http://localhost:8080/eng_std/

# 静的チェック（CI と同じもの）
python3 .github/tools/precheck.py

# ブラウザで一周させる
NODE_PATH="$(npm root -g)" node .github/tools/browser_smoke.js

# オフラインで学習できることを確認する
NODE_PATH="$(npm root -g)" node .github/tools/offline_test.js

# CSS / JS を変更したら必ずキャッシュ版数を上げる
sh .github/tools/bump-version.sh

# 単一 HTML のプレビューを作る（公開前に中身を見たいとき）
python3 .github/tools/build_preview.py
# → preview/eikaiwa-preview.html をブラウザで開くだけで動く
#   ただしインストールとオフラインは本番（Pages）でのみ使える
```

開発上の決まりごとは [`.github/CLAUDE.md`](.github/CLAUDE.md) にあります。

## 構成

```
index.html               SPA の入口（<script> の読み込み順が依存順）
css/style.css            デザイントークンと全スタイル
js/base.js               ベースパス解決・共通ユーティリティ
js/store.js              localStorage への保存
js/data.js               問題データの読み込み
js/srs.js                復習アルゴリズム（Leitner box）
js/tts.js                読み上げ（Web Speech API）
js/ui.js                 トースト / モーダル
js/views/*.js            画面ごとの描画
js/router.js             ハッシュルータ
js/main.js               起動・Service Worker 登録
sw.js                    オフライン用 Service Worker
data/categories.json     カテゴリ定義
data/situations/*.json   問題データ（カテゴリ別）
.github/tools/           検証スクリプト（依存なし）
```

## ライセンス / 権利

© pAIr Mind, Inc. 社内プロダクトです。
