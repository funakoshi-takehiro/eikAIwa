# eikAIwa — 開発の決まりごと

> このファイルは **Claude Code / 他の AI エージェントが最初に読む前提**の入口です。
> 作業前に必読。
>
> `.github/` 配下は GitHub Pages が配信しないため、ここに置いています。
> （実測: `/.github/workflows/*.yml` は 404。一方 `/.nojekyll` や `/.gitignore` は 200 なので
> 「ドットで始まれば安全」ではありません。**安全なのは `.github/` 配下だけ**です。）

## 0. 書き込み範囲【最優先】

**この作業で書き込んでよいのは `eng_std` リポジトリの中だけ。**
参照用にクローンしている他リポジトリ（コーポレートHP、ceoprofile、hAIchi、PyHiroba）は
**読み取り専用**として扱うこと。

これは `.claude/settings.json` の `permissions.deny` と
`.claude/hooks/guard-write-scope.py`（PreToolUse フック）で機械的に止めている。
`python3 .github/tools/guard_selftest.py` で16件の判定を検証できる（CI でも実行）。

限界も正しく理解しておくこと:

- ファイル編集ツール（Write / Edit）は `file_path` で確実に判定する。
- Bash は「書き込み動詞 + 保護パス」のパターン検出で、**ベストエフォート**。
  変数展開や eval を経由すればすり抜けうる。
  逆に、保護パスを**文字列として書いただけ**のコマンド（このファイルを
  ヒアドキュメントで生成する等）も巻き添えで拒否される。
  その場合は Bash ではなく Write ツールを使う。
- root で動いているため `chmod` は防御にならず、フック自体を書き換える能力も残る。
  **これは事故防止であってサンドボックスではない。**
- 唯一の硬い境界は「参照リポジトリに push 認証情報が無い」こと。

## 1. ビルド工程は無い

HTML / CSS / 素の JavaScript のみ。`package.json` は置かない。
`js/*.js` は `index.html` の**読み込み順に依存する**（すべて同一グローバルスコープ）。

新しい JS を足したら `index.html` の `<script>` と `sw.js` の `SHELL` の**両方**に足すこと。
片方を忘れると、それぞれ「白画面」「オフラインで動かない」になる。`precheck.py` が検出する。

読み込み順は **`js/base.js` が最初、`js/main.js` が最後**。

## 2. キャッシュ版数の規律

CSS / JS を変更したら、**必ず** `sh .github/tools/bump-version.sh` を実行する。
`index.html` の全 `?v=`、`sw.js` の `VERSION`、`js/base.js` の `EIK.VERSION` を揃える。

更新を忘れると、ブラウザと Service Worker が古い資産を握り続ける。
実際に、直したはずの JS がキャッシュから返され続けて調査が空転した。

## 3. パスをハードコードしない

GitHub Pages のプロジェクトページ（`/eng_std/`）と独自ドメイン（`/`）とローカルの
どれでも同じコードで動かす。`EIK.siteBase` / `EIK.url()` を使い、
`sw.js` では `new URL('./', self.location).pathname` からベースを導く。

## 4. 日本語 UI の作法

- **操作部品のラベルには `white-space: nowrap` を付ける**（本文には付けない）。
  日本語は1文字ずつ折り返せるため、忘れると狭い画面で「入」「力」と縦に割れる。
- `font-feature-settings: "palt"` を本文に効かせる。
- `line-break: strict` で行頭に長音符や小書き仮名が来ないようにする。
- 見出しは `text-wrap: balance`。

## 5. インライン SVG には必ず寸法を与える

指定を忘れると既定の 300×150 で描画され、隣のラベルを押し出す。
CSS 側に `svg { width: 1em; height: 1em; }` の保険を置いてあるが、
新しい部品を作るときは個別に寸法を当てること。

## 6. hidden 属性を潰さない

ブラウザ既定の `[hidden]{display:none}` は作者スタイルシートに負ける。
`.foo { display: flex }` のようなクラス指定があると `hidden` が無視されるため、
CSS の先頭に `[hidden] { display: none !important; }` を置いてある。消さないこと。

## 7. 問題データの品質

`data/situations/<category>.json`。1状況につき解答は**ちょうど10件**。

10件は言い換えの羅列にしてはならない。**丁寧さ（register）と型（style）の軸を散らす**こと。
`precheck.py` は「register が3種類以上に散っているか」を機械で検査する。
これが「10通りある意味」を測れる唯一の自動指標なので、通すためだけに
形式を合わせるのではなく、実際に使い分けの学べる10件にすること。

各解答の `note` は**日本語で、いつ使うか**を一言で書く。
「丁寧な言い方」ではなく「初対面の相手に最も無難」のように、選択の助けになる粒度で。

`want` は必ず `You want to …` の形で、ピリオドで終える。
`place` は場面（`At a train station`）、`listener` は相手（`a station attendant`）。

## 8. 検証

```sh
python3 .github/tools/precheck.py        # 静的チェック（CI と同じ）
python3 .github/tools/guard_selftest.py  # 書き込み範囲ガード
NODE_PATH="$(npm root -g)" node .github/tools/browser_smoke.js   # ブラウザ通し確認
```

ブラウザ通し確認は、構文は通るが実行時に壊れる類（白画面・レイアウト崩れ・
横スクロール発生）を捕まえる。実際にこれで次の3件を検出した。

- インライン SVG の寸法未指定でラベルが3行に折り返された
- `[hidden]` が CSS に負けて更新バーが出っぱなしになった
- Service Worker の初回インストールで不要なリロードが起き、直前の学習記録が消えた

## 9. 公開

`main` または作業ブランチへの push で `.github/workflows/deploy-pages.yml` が動く。
`precheck.py` を通らなければデプロイしない。
third-party action は **SHA 固定 + `# vX.Y.Z` コメント**、Dependabot が weekly で更新する。

**リポジトリを public にする必要がある。**無料プランでは Pages が
public リポジトリでしか使えない。`configure-pages` に `enablement: true` を
入れてあるので、public にすれば次の push で Pages 側の設定は自動で入る。

## 10. プレビュー

`python3 .github/tools/build_preview.py` で、CSS・JS・問題データを全部
埋め込んだ単一 HTML を作れる。Pages を有効化する前に中身を確認する用。

- 見た目と学習の流れは本番と同一（同じソースを束ねているだけ）
- Service Worker と manifest は外れるので、**インストールとオフラインは使えない**
- 問題データは `fetch` を差し替えて埋め込みから返す。アプリ側のコードは変更しない

`--artifact` を付けると `<html>`/`<head>`/`<body>` を持たない断片が出る。
