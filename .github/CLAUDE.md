# eikAIwa — 開発の決まりごと

> このファイルは **Claude Code / 他の AI エージェントが最初に読む前提**の入口です。
> 作業前に必読。
>
> `.github/` 配下は GitHub Pages が配信しないため、ここに置いています。
> （実測: `/.github/workflows/*.yml` は 404。一方 `/.nojekyll` や `/.gitignore` は 200 なので
> 「ドットで始まれば安全」ではありません。**安全なのは `.github/` 配下だけ**です。）
>
> 現在は §9 の公開許可リストで、そもそもアプリの実体しか配信していません。
> ここに置くのは、その許可リストを消してしまったときの二重の保険です。

## 0. 書き込み範囲【最優先】

**この作業で書き込んでよいのは `eng_std` リポジトリの中だけ。**
参照用にクローンしている社内の他リポジトリは
**読み取り専用**として扱うこと。

これは `.claude/hooks/guard-write-scope.py`（PreToolUse フック）で機械的に止めている。
`python3 .github/tools/guard_selftest.py` と `guard_selftest_extra.py` の
**26件**で検証できる（CI でも実行）。

保護対象は**列挙していない**。「`ALLOWED_ROOTS` 以外のホーム配下はすべて読み取り専用」
という規則で導いている。このリポジトリは public にするため、参照リポジトリの名前を
ソースに書くと、それ自体が非公開リポジトリ名の公開になるため。
同じ理由で `.claude/settings.json` の `permissions.deny` も外した
（`permissions` のパターンに「eng_std 以外のホーム配下」を表す否定形が無く、
ホーム全体を deny すると自分への書き込みまで止まるため）。

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

GitHub Pages のプロジェクトページ（`/eikAIwa/`）と独自ドメイン（`/`）とローカルの
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

`data/situations/<category>.json`（★）、`<category>-2.json`（★★）、
`<category>-3.json`（★★★）。1状況につき解答は**ちょうど10件**。
現在 ★ 300問 / ★★ 300問 / ★★★ 300問、合計900問・9000解答。

10件は言い換えの羅列にしてはならない。**丁寧さ（register）と型（style）の軸を散らす**こと。
`precheck.py` は「register が3種類以上に散っているか」を機械で検査する。
これが「10通りある意味」を測れる唯一の自動指標なので、通すためだけに
形式を合わせるのではなく、実際に使い分けの学べる10件にすること。

### 難易度は「期待される文数」で決まる

| | 文数 | `precheck.py` の検査 |
|---|---|---|
| ★ | 1文が基本 | どれも2文以内、かつ**半数以上が1文** |
| ★★ | ちょうど2文 | 10件**すべて**が2文 |
| ★★★ | 3〜5文 | どれも3文以上5文以下 |

★ で2文を許すのは、「問題を述べる → どうすればよいか尋ねる」のように
2文が自然な場面が実在するため。そこを不正にすると使える言い方を捨てることになる。

文数が増えるほど**組み立ての型**が問われる。★★ 以上は10枠の設計も変わる。

- ★★ … `basic`（最小の2文）/ `explain`（事情→依頼）/ `request`（依頼→理由）/
  `confirm`（確認→依頼）/ `formal` / `casual` / `negotiate`（または `propose`）/
  `apology` / `context` / `considerate`（または `reassure`）
- ★★★ … `explain`（事情→要望→期限）/ `context`（背景→問題→依頼）/
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
自然な少数の語（`ALLOWED_JA_LATIN`）は許す。
`note` は英語表現を引用して解説するため対象外。
`ja` の中でどうしても英語表現そのものを指したいときは `「churn」` のように
かぎ括弧で囲む（囲んだ中は検査されない）。

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

<https://funakoshi-takehiro.github.io/eikAIwa/> で公開している。

`main` または作業ブランチへの push で `.github/workflows/deploy-pages.yml` が動く。
`precheck.py` を通らなければデプロイしない。
third-party action は **SHA 固定 + `# vX.Y.Z` コメント**、Dependabot が weekly で更新する。

### Settings → Pages → Source は「GitHub Actions」にすること

**「Deploy from a branch」のままにしない。** そちらはブランチ直下をそのまま配信するため、

- `precheck.py` の検査を通らずに公開される（唯一の防波堤が効かない）
- 下の許可リストが無視され、`.claude/` 配下や `CLAUDE.md` まで配信される
- `deploy-pages.yml` は毎回失敗する（Pages 側が Actions からの配信を受け付けない）

実際に「Deploy from a branch」のまま公開していた間、`/.claude/settings.json` と
`/CLAUDE.md` が 200 で読めていた。

### 配信するものは許可リストで決める

`deploy-pages.yml` の「公開するものだけを集める」で `_site/` に**集めたものだけ**を上げる。

    index.html  sw.js  manifest.webmanifest  .nojekyll
    css/  js/  icons/  data/

除外側を並べる方式にしない。新しい開発用ファイルを足すたびに除外を書き足す必要があり、
書き忘れがそのまま公開事故になる。許可リストなら、**書き忘れは「公開されない」側に倒れる**。

同じステップで、`.claude` `CLAUDE.md` `README.md` `.github` `.gitignore` `.git` が
`_site/` に無いこと、起動に要るファイルが揃っていることを機械で確かめている。
アプリに新しいディレクトリを足したら、この `cp` に足すこと。忘れると本番で 404 になる。

### 隠せないもの

**コミット履歴は隠せない。** public にした時点で全履歴が読める。
消すには履歴の書き換え（force push）が要るが、それでも
GitHub 側に残る到達不能オブジェクトや、既存の clone / fork までは消えない。
**公開リポジトリには、履歴に入って困るものを最初から入れない。**

`precheck.py` の `check_public_safety()` が、社名・非公開リポジトリのパスが
ソースや問題データに紛れていないかを機械で見ている（リテラル一致のみ。
変数展開までは追えない）。

## 10. プレビュー

`python3 .github/tools/build_preview.py` で、CSS・JS・問題データを全部
埋め込んだ単一 HTML を作れる。Pages を有効化する前に中身を確認する用。

- 見た目と学習の流れは本番と同一（同じソースを束ねているだけ）
- Service Worker と manifest は外れるので、**インストールとオフラインは使えない**
- 問題データは `fetch` を差し替えて埋め込みから返す。アプリ側のコードは変更しない

`--artifact` を付けると `<html>`/`<head>`/`<body>` を持たない断片が出る。
