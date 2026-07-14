# CLAUDE.md — ランキンQ 開発ガイド

このファイルはAI（Claude Code等）がこのリポジトリで作業する際に最初に読む前提のガイド。
プロダクトの仕様そのものは [DESIGN.md](DESIGN.md) を参照。ここには**コードから読み取れない
運用上の知見・過去のハマりどころ・作業時のルール**をまとめる。

## プロジェクト概要

- サイト名: ランキンQ（旧称「ランキン！」。表記変更済み、コード内`SITE_NAME`で管理）
- 本番: https://rankin-q.com （Cloudflare Workers、Git連携で`main`push→自動デプロイ）
- 技術構成: 素のHTML/CSS/JS（フレームワークなし）。データは`content/`配下のファイルを源泉に
  `scripts/build.py`で`public/data/*.js`に書き出す静的サイト

## 【重要】データの源泉は content/（Airtableから移行済み）

- **記事・実体データの源泉は `content/` 配下のファイル**。編集はここを直接（AI経由で）行う。
  - `content/entities.json` … 実体の登録簿（id → name/type）
  - `content/articles/<id>.json` … 記事1本ずつ（実体は**IDで参照**、文章はテキスト）
  - `content/datasets/<name>.csv` … 大量の時系列数値（1列目=実体ID、ヘッダ=期間）
- **サイト生成は `python scripts/build.py`**（`content/` を読んで`public/data/*.js`等を出力。ID存在チェックあり）
- **`public/data/*.js` を直接編集しない**（build.pyの生成物。手で書いても次のビルドで消える）
- Airtableは完全に切り離し済み（同期スクリプトも削除済み）。もう存在しないものとして扱ってよい

## リポジトリ構成（重要ファイルのみ）

```
content/                源泉データ（ここを編集する）
  entities.json          実体の登録簿: id -> {name, type}
  articles/<id>.json     記事1本ずつ（実体はIDで参照、文章はテキスト）
  datasets/<name>.csv    大量の時系列数値（1列目=実体ID、ヘッダ=期間）
public/
  index.html          静的シェル。<head>のmeta/OGP/favicon、<body>のヘッダー/フッター
  app.js              SPAルーター＋全HTML生成ロジック（実質ここが本体）
  styles.css          全スタイル
  data/
    ranking-data.js    build.pyが生成する記事データ（自動生成、直接編集しない）
    entities.js        同上、実体（都道府県・国など）マスタ
  images/
    entities/          実体画像（Wikipedia/flagcdn由来）
    topics/            記事サムネイル（AI生成）
    icons/              王冠アイコン等のフリー素材
scripts/
  build.py                    content/ → public/data/*.js を生成。全ての起点（ID存在チェックあり）
  common.py                   共通処理（パス・出力書式・content読み込み等）
  fetch_wikipedia_images.py   実体画像をWikipedia代表画像から自動取得
  fetch_country_flags.py      国(type=country)の画像をflagcdn.comから取得
  generate_topic_thumbnails.py 記事サムネをFlux(fal.ai)で生成
  env_loader.py                .envファイルの読み込み（全スクリプト共通）
DESIGN.md              プロダクト仕様書（コンセプト・データモデル・方針）
.env                    fal.ai等のAPIキー（**gitignore対象、必ず自分で作る**）
.env.example            .envのひな形
```

## 環境セットアップ

`.env.example`をコピーして`.env`を作る。`build.py`はネット接続すら不要（`content/`を読むだけ）なので、
記事の追加・更新だけなら`.env`もほぼ不要。画像・サムネのスクリプトを使う場合のみ:
```
pip install Pillow
SITE_URL=https://rankin-q.com
FAL_KEY=（fal.aiのAPIキー。generate_topic_thumbnails.py を使う場合のみ）
```

> データはAirtableから`content/`ファイル方式に完全移行済み（Airtableはもう使わない）。

## 作業フロー（記事・データを変更した後は必ず）

```
python scripts/build.py
```
これで`content/`から`public/data/*.js`・`sitemap.xml`・`robots.txt`が再生成される。**`content/`の
ファイルを編集しただけではサイトに反映されない**。build後、`git status`で差分確認してからコミット。
存在しない実体IDを参照しているとbuildが止まる（表記ゆれ・タイポ防止）。

キャッシュ対策として、`app.js`/`styles.css`等を変更したら`public/index.html`内の
`?v=N`をインクリメントすること（Cloudflareのキャッシュ・ブラウザキャッシュ対策）。

## 記事・実体データの編集（content/方式）

- 記事を追加/編集: `content/articles/<id>.json` を作る/直す。実体は**IDで参照**（名前を書かない）
- 実体を追加: まず`content/entities.json`を検索し、あれば既存IDを再利用。無ければ1件だけ追加
- 大量の時系列は`content/datasets/<name>.csv`（1列目=実体ID）に置き、記事から`dataset`で指す
- 反映は`python scripts/build.py`。存在しないID参照はビルドが止めて教えてくれる
- 詳しい手順とサンプルは [README.md](README.md) にある

## 実体（Entities）画像の調達方針（優先順位）

1. **国（type=country）**: `fetch_country_flags.py`でflagcdn.com（flag-icons由来、MIT）
   から国旗を機械的に取得。国コード対応表は同スクリプト内`COUNTRY_ISO`
2. **それ以外の地理的実体**（都道府県・山・湖・建造物等）: `fetch_wikipedia_images.py`で
   日本語Wikipediaの代表画像を自動取得。ライセンス情報は`public/images/entities/_credits.json`
   に記録され、`build.py`が`imageCredit`として反映する
3. **宗教のシンボル画像は意図的に非対応**。政治的・宗教的な解釈の余地があるため、
   特定のシンボル（卍・十字架等）を機械的に割り当てるのは避ける方針（要相談）
4. **AI画像生成は実体には使わない**。過去に試したが、日本語の固有名詞をプロンプトに
   含めると和風/アニメ調に偏る問題があり、指示追従性も不安定だった（`generate_images.py`
   は一度実装したが本番から削除済み。履歴はgit logに残る）

## 記事サムネイル（Topics画像）の生成方針

`generate_topic_thumbnails.py`でFlux（fal.ai、`fal-ai/flux/dev`推奨）を使う。

- **背景生成プロンプトは英語のみで構成し、日本語のタイトル文字列を絶対に含めない**
  （含めると和風/アニメ調に偏る。過去の実験で確認済み）
- タイトル文字はPillowで**別途合成**する（AIには文字を描かせない。指示を無視されがち）
- 記事ごとに具体的な英語モチーフ（`TOPIC_HINT`辞書）を用意しないと、カテゴリだけの
  汎用背景になり「その記事らしさ」が失われる
- タイトル帯の色はカテゴリごとに変える（経済=オレンジ、人口=ブルー、地理=グリーン、
  スポーツ=レッド）。単色グレーだと単調になる
- サイズはOGP/Twitterカード推奨の1200×630
- **安全装置として`--ids`か`--limit`のどちらも指定しないと最大5件までしか生成しない**。
  過去に誤って100件以上生成してしまい課金を無駄にした事故があったため

## AI画像生成全般の注意（fal.ai）

- `flux/schnell`は最安・最速だが指示追従性が低い（複雑な否定指示や日本語を無視しがち）。
  `flux/dev`の方が指示に従いやすい。コストは数倍だが1枚数円〜数十円程度
- `num_inference_steps`・`guidance_scale`を明示しないと、単色領域が多い画像でぼやける
  ことがある（`num_inference_steps=40, guidance_scale=4.5`が目安）
- APIキー・秘密情報は**絶対にコマンドやチャットに直書きしない**。`.env`経由で読む

## ライティングルール（記事コンテンツ）

- タイトルは必ず「ランキング」を含める
- 絵文字は一切使わない（タイトル・タグ・本文すべて）
- 考察（analysis）は主観語（「〜だろう」等）を避け、数値・順位差のみで構成する
- 画像の著作権不明なものは絶対に使わない（Google画像検索からの転載等は厳禁）

## デプロイ確認の作法

Cloudflareの自動デプロイは非同期（push後、反映まで数十秒〜数分かかることがある）。
本番確認前に`?v=N`のバージョン番号が実際に切り替わったか`curl`でポーリングしてから
ブラウザで検証すること（キャッシュが原因で「直したのに反映されない」ように見えることが
過去に何度もあった）。

## 破壊的操作について

- `content/` のファイルを大量に削除・上書きするような操作は、実行前に必ずユーザーに確認する
- `git checkout`/`reset`等でコミット前の変更を捨てる前に、必ず`git status`で確認する
