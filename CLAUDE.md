# eikAIwa

開発の決まりごとは `.github/CLAUDE.md` にあります。作業前に必ず読んでください。

@.github/CLAUDE.md

## 最優先の制約

**書き込んでよいのは `eng_std` リポジトリの中だけです。**
参照用にクローンしている他リポジトリ（コーポレートHP、ceoprofile、hAIchi、PyHiroba）は
**読み取り専用**です。

`.claude/hooks/guard-write-scope.py` と `.claude/settings.json` で機械的に止めています。
`python3 .github/tools/guard_selftest.py` で検証できます。
