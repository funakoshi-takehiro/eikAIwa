# eikAIwa — 開発の決まりごと

> **作業前に必読。** Claude Code / 他の AI エージェントが最初に読む前提の入口です。
> 人向けの説明（何をするアプリか・使い方）は [`README.md`](README.md) にあります。

過去に実際にやらかした事故から導いた規則だけを書いています。
「一般論として良い」だけの項目は載せていません。

## 目次

| | 節 | ひとことで |
|---|---|---|
| 0 | [書き込み範囲](#0-書き込み範囲最優先) | `eikAIwa` の外には書かない |
| 1 | [ビルド工程は無い](#1-ビルド工程は無い) | 読み込み順が依存順 |
| 2 | [キャッシュ版数](#2-キャッシュ版数の規律) | CSS/JS を触ったら必ず `bump-version.sh` |
| 3 | [パス](#3-パスをハードコードしない) | サブパス配信でも動かす |
| 4 | [日本語 UI](#4-日本語-ui-の作法) | ボタンのラベルは `nowrap` |
| 5 | [インライン SVG](#5-インライン-svg-には必ず寸法を与える) | 寸法を書かないと 300×150 |
| 6 | [`hidden` 属性](#6-hidden-属性を潰さない) | CSS に負ける |
| 7 | [問題データ](#7-問題データの品質) | 10件は言い換えの羅列にしない |
| 8 | [検証](#8-検証) | 3本のコマンド |
| 9 | [公開](#9-公開) | 許可リストで集めたものだけ配信 |
| 10 | [プレビュー](#10-プレビュー) | 単一 HTML を作れる |

---

## 0. 書き込み範囲【最優先】

**書き込んでよいのは、このリポジトリの中だけ。**
参照用にクローンしている社内の他リポジトリは **読み取り専用**として扱う。

`.claude/hooks/guard-write-scope.py`（PreToolUse フック）で機械的に止めている。

```sh
python3 tools/guard_selftest.py        # 20 件
python3 tools/guard_selftest_extra.py  #  6 件
```

保護対象は**列挙していない**。「`ALLOWED_ROOTS` 以外のホーム配下はすべて読み取り専用」
という規則で導いている。このリポジトリは public なので、参照リポジトリの名前を
ソースに書くと、それ自体が非公開リポジトリ名の公開になるため。
同じ理由で `.claude/settings.json` の `permissions.deny` も置いていない
（`permissions` に「このリポジトリ以外のホーム配下」を表す否定形が無く、
ホーム全体を deny すると自分への書き込みまで止まる）。

限界も正しく理解しておくこと。

- Write / Edit は `file_path` で確実に判定する。
- Bash は「書き込み動詞 + 保護パス」のパターン検出で、**ベストエフォート**。
  変数展開や eval を経由すればすり抜けうる。
  逆に、保護パスを**文字列として書いただけ**のコマンド（ヒアドキュメントで
  この種の文書を生成する等）も巻き添えで拒否される。その場合は Write ツールを使う。
- root で動いているため `chmod` は防御にならず、フック自体を書き換える能力も残る。
  **これは事故防止であってサンドボックスではない。**
- 唯一の硬い境界は「参照リポジトリに push 認証情報が無い」こと。

## 1. ビルド工程は無い

HTML / CSS / 素の JavaScript のみ。`package.json` は置かない。
`js/*.js` はすべて同一グローバルスコープで、`index.html` の**読み込み順に依存する**。

読み込み順は **`js/base.js` が最初、`js/main.js` が最後**。

新しい JS を足したら `index.html` の `<script>` と `sw.js` の `SHELL` の**両方**に足す。
片方を忘れると、それぞれ「白画面」「オフラインで動かない」になる。`precheck.py` が検出する。

### 2つ以上の画面が使うものは、views の外に置く

| 置き場所 | 何を | 例 |
|---|---|---|
| `js/base.js` | 画面に依存しない道具 | `EIK.escapeHtml` / `EIK.num` / `EIK.icon` |
| `js/ui.js` | 画面をまたぐ HTML 部品と配線 | `EIK.UI.levelPicker` / `sitRow` / `answerItem` / `speakButton` |
| `js/views/*.js` | **その画面だけ**のもの | 練習の出題キュー、設定の行 |

`views/*.js` どうしは互いを参照しない。以前、難易度スイッチが `views/home.js` にあり、
`views/categories.js` が「home.js が先に読まれていること」に暗黙に依存していた。
同一グローバルスコープ + 読み込み順依存の構成では、この依存がいちばん追いにくい。

**アイコンは `EIK.icon(name)` を使う。`<svg>` をベタ書きしない。**
以前は4つの画面がそれぞれ同じ `<svg>` ラッパーを書いていて、
`icPin` と `map`、`icStar` と保存画面の星は**パスまで完全に同じもの**が二重にあった。
新しい絵が要るときは `EIK.ICONS` に1行足す。
（`index.html` のアプリバーとタブバーだけは例外。JS が動く前に出す必要があるため
ベタ書きのままにしてある。ここを JS 描画にすると、起動のたびに枠が空で点滅する。）

## 2. キャッシュ版数の規律

CSS / JS を変更したら、**必ず**これを実行する。

```sh
sh tools/bump-version.sh
```

`index.html` の全 `?v=`、`sw.js` の `VERSION`、`js/base.js` の `EIK.VERSION` を揃える。
更新を忘れると、ブラウザと Service Worker が古い資産を握り続ける。
実際に、直したはずの JS がキャッシュから返され続けて調査が空転した。

## 3. パスをハードコードしない

GitHub Pages のプロジェクトページ（`/eikAIwa/`）と独自ドメイン（`/`）とローカルの
どれでも同じコードで動かす。`EIK.siteBase` / `EIK.url()` を使い、
`sw.js` では `new URL('./', self.location).pathname` からベースを導く。

なお `.claude/` と `tools/` に出てくる `/home/...` は**ローカルの作業ディレクトリ**の
パスであって、配信されるサイトのパスではない。混同して書き換えないこと。

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

```
data/situations/<category>.json     ★
data/situations/<category>-2.json   ★★
data/situations/<category>-3.json   ★★★
```

1状況につき解答は**ちょうど10件**。現在 ★ 300問 / ★★ 300問 / ★★★ 300問、
合計 **900問・9,000解答**。

10件は言い換えの羅列にしてはならない。**丁寧さ（`register`）と型（`style`）の軸を
散らす**こと。`precheck.py` は「`register` が3種類以上に散っているか」を機械で検査する。
これが「10通りある意味」を測れる唯一の自動指標なので、通すためだけに形式を合わせず、
実際に使い分けの学べる10件にすること。

### 難易度は「期待される文数」で決まる

| | 文数 | `precheck.py` の検査 |
|---|---|---|
| ★ | 1文が基本 | どれも2文以内、かつ**半数以上が1文** |
| ★★ | ちょうど2文 | 10件**すべて**が2文 |
| ★★★ | 3〜5文 | どれも3文以上5文以下 |

★ で2文を許すのは、「問題を述べる → どうすればよいか尋ねる」のように
2文が自然な場面が実在するため。そこを不正にすると使える言い方を捨てることになる。

文数が増えるほど**組み立ての型**が問われる。★★ 以上は10枠の設計も変わる。

- **★★** … `basic`（最小の2文）/ `explain`（事情→依頼）/ `request`（依頼→理由）/
  `confirm`（確認→依頼）/ `formal` / `casual` / `negotiate`（または `propose`）/
  `apology` / `context` / `considerate`（または `reassure`）
- **★★★** … `explain`（事情→要望→期限）/ `context`（背景→問題→依頼）/
  `considerate`（理解→懸念→提案）/ `request` / `formal` / `casual` /
  `negotiate`（現状→制約→代案）/ `decline`（感謝→理由→代案）/
  `complain`（事実→影響→要望）/ `propose`（締めの具体案）

★★★ の**状況そのもの**も難しくすること。文数だけ増やして場面が
「駅でトイレを探す」のままでは、難易度が上がったことにならない。
交渉、上申、悪い知らせ、対立の仲裁、断り、異議申し立てのように、
組み立てなしには言えない場面を選ぶ。

### 日本語欄に英単語を残さない

`situationJa` と `ja` は日本語で書く。訳し忘れて英文を貼ったままの事故が実際に
起きたので `precheck.py` が機械で止める。全て大文字の略語と、日本語文に現れて
自然な少数の語（`ALLOWED_JA_LATIN`）は許す。`note` は英語表現を引用して解説するため対象外。
`ja` の中でどうしても英語表現そのものを指したいときは `「churn」` のように
かぎ括弧で囲む（囲んだ中は検査されない）。

各解答の `note` は**日本語で、いつ使うか**を一言で書く。
「丁寧な言い方」ではなく「初対面の相手に最も無難」のように、選択の助けになる粒度で。

`want` は必ず `You want to …` の形でピリオドで終える。
`place` は場面（`At a train station`）、`listener` は相手（`a station attendant`）。

## 8. 検証

```sh
python3 tools/precheck.py                                  # 静的チェック（CI と同じ）
python3 tools/guard_selftest.py                            # 書き込み範囲ガード
NODE_PATH="$(npm root -g)" node tools/browser_smoke.js     # ブラウザ通し確認
NODE_PATH="$(npm root -g)" node tools/offline_test.js      # オフライン動作
```

ブラウザ通し確認は、構文は通るが実行時に壊れる類（白画面・レイアウト崩れ・
横スクロール発生）を捕まえる。実際にこれで次の3件を検出した。

- インライン SVG の寸法未指定でラベルが3行に折り返された
- `[hidden]` が CSS に負けて更新バーが出っぱなしになった
- Service Worker の初回インストールで不要なリロードが起き、直前の学習記録が消えた

## 9. 公開

<https://funakoshi-takehiro.github.io/eikAIwa/>

push で `.github/workflows/deploy-pages.yml` が動く。
`precheck.py` を通らなければデプロイしない。
third-party action は **SHA 固定 + `# vX.Y.Z` コメント**、Dependabot が weekly で更新する。

### 経路はひとつだけにする

**Settings → Pages → Source は「GitHub Actions」**（設定済み）。
「Deploy from a branch」に戻すと、

- `precheck.py` を通らずに公開される（唯一の防波堤が効かない）
- 下の許可リストが無視され、`.claude/` や `CLAUDE.md` まで配信される
- 2つの経路が同じ URL に対して同時にデプロイし、**後に終わったほうが勝つ**

実際に「Deploy from a branch」のままだった間、`/.claude/settings.json` と
`/CLAUDE.md` が 200 で読めていた。切り替えたあとは同じパスがすべて 404。

**Pages 画面のブランチ選択は、既定ブランチの設定ではない。** 別物が2つある。

| 何を変えたいか | どこ |
|---|---|
| 配信の経路（Actions かブランチか） | Settings → **Pages** → Source |
| リポジトリの既定ブランチ | Settings → **General** → Default branch |

一度、Pages 画面で「Deploy from a branch」のブランチを切り替えたことがあり、
Source がブランチ配信に戻って `/CLAUDE.md` がまた 200 になった。
Actions 側の成果物は 64 ファイルで正しかったが、**ブランチ配信が勝っていた**。

**見分け方**: Actions に `pages build and deployment`（`dynamic/pages/...`）の
実行が現れていたら、それがブランチ配信。Source が「GitHub Actions」なら出ない。

### 配信されるのは既定ブランチだけ

`github-pages` 環境は**既定ブランチからのデプロイしか受け付けない**。
同じコミットで実測した結果:

| 押したブランチ | 結果 |
|---|---|
| 既定ブランチ | 成功 |
| それ以外 | runner に載る前に失敗（ログすら残らない） |

そのため `deploy-pages.yml` は `push` を全ブランチで拾い、
job 側の `if: github.ref_name == github.event.repository.default_branch` で絞っている。
ブランチ名をワークフローに書かないので、既定ブランチを変えても編集が要らず、
対象外のブランチは赤い × ではなく「スキップ」になる。

### 配信するものは許可リストで決める

`deploy-pages.yml` の「公開するものだけを集める」で、`_site/` に集めたものだけを上げる。

```
index.html  sw.js  manifest.webmanifest  .nojekyll
css/  js/  icons/  data/
```

**除外側を並べる方式にしない。** 除外方式は開発用ファイルを足すたびに書き足しが要り、
書き忘れがそのまま公開事故になる。許可リストなら、書き忘れは「公開されない」側に倒れる。

同じステップで、開発用のものが `_site/` に混ざっていないこと・起動に要るファイルが
揃っていることを機械で確かめている。**アプリに新しいディレクトリを足したら、
この `cp` に足すこと。**忘れると本番で 404 になる。

### 隠せないもの

**コミット履歴は隠せない。** public にした時点で全履歴が読める。
消すには履歴の書き換え（force push）が要るが、それでも GitHub 側に残る
到達不能オブジェクトや、既存の clone / fork までは消えない。
**公開リポジトリには、履歴に入って困るものを最初から入れない。**

`precheck.py` の `check_public_safety()` が、社名や非公開リポジトリのパスが
ソースや問題データに紛れていないかを機械で見ている（リテラル一致のみで、
変数展開までは追えない）。

## 10. プレビュー

```sh
python3 tools/build_preview.py
```

CSS・JS・問題データを全部埋め込んだ単一 HTML を作る。中身を人に見せる用。

- 見た目と学習の流れは本番と同一（同じソースを束ねているだけ）
- Service Worker と manifest は外れるので、**インストールとオフラインは使えない**
- 問題データは `fetch` を差し替えて埋め込みから返す。アプリ側のコードは変更しない

`--artifact` を付けると `<html>`/`<head>`/`<body>` を持たない断片が出る。
