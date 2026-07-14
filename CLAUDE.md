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
- `scripts/sync_from_airtable.py` は**レガシー（移行前のバックアップ）**。実行すると`content/`由来の
  データ（米の推移CSV等）が失われるため`--force`なしでは動かないようガードしてある。基本使わない
- Airtableは畳まずバックアップとして残しているが、**もう源泉ではない**

## リポジトリ構成（重要ファイルのみ）

```
public/
  index.html          静的シェル。<head>のmeta/OGP/favicon、<body>のヘッダー/フッター
  app.js              SPAルーター＋全HTML生成ロジック（実質ここが本体）
  styles.css          全スタイル
  data/
    ranking-data.js    Airtableから同期される記事データ（Git管理・自動生成、直接編集しない）
    entities.js        同上、実体（都道府県・国など）マスタ
  images/
    entities/          実体画像（Wikipedia/flagcdn由来）
    topics/            記事サムネイル（AI生成）
    icons/              王冠アイコン等のフリー素材
scripts/
  sync_from_airtable.py       Airtable → public/data/*.js への同期。全ての起点
  fetch_wikipedia_images.py   実体画像をWikipedia代表画像から自動取得
  fetch_country_flags.py      国(type=country)の画像をflagcdn.comから取得
  generate_topic_thumbnails.py 記事サムネをFlux(fal.ai)で生成
  env_loader.py                .envファイルの読み込み（全スクリプト共通）
  build_entities_migration.py / provision_airtable_data.py
                                過去の一括移行用（通常は使わない）
DESIGN.md              プロダクト仕様書（コンセプト・データモデル・方針）
.env                    Airtable/fal.aiのAPIキー（**gitignore対象、必ず自分で作る**）
.env.example            .envのひな形
```

## 環境セットアップ

`.env.example`をコピーして`.env`を作り、以下を埋める:

```
AIRTABLE_API_KEY=
AIRTABLE_BASE_ID=
SITE_URL=https://rankin-q.com
```

Airtableのテーブル名は`entries_candidate` / `topics_candidate` / `entities_candidate`
（`AIRTABLE_ENTRIES_TABLE`等の環境変数で上書き可能。歴史的経緯でこの名前になっている。
正式名`Entries`/`Topics`/`Entities`へのリネームはまだしていない）。

画像生成スクリプト（`generate_topic_thumbnails.py`等）を使うには追加で:
```
pip install Pillow
FAL_KEY=（fal.aiのAPIキー）
```

## 作業フロー（記事・データを変更した後は必ず）

```
python scripts/build.py
```
これで`content/`から`public/data/*.js`・`sitemap.xml`・`robots.txt`が再生成される。**`content/`の
ファイルを編集しただけではサイトに反映されない**。build後、`git status`で差分確認してからコミット。
存在しない実体IDを参照しているとbuildが止まる（表記ゆれ・タイポ防止）。

キャッシュ対策として、`app.js`/`styles.css`等を変更したら`public/index.html`内の
`?v=N`をインクリメントすること（Cloudflareのキャッシュ・ブラウザキャッシュ対策）。

## Airtableスキーマの既知の罠

- **Airtableの主キー（1列目）は後から「Link to another record」型に変更できない**。
  CSVインポート時に列順を意識する（リンクにしたい列を先頭に置かない）
- **既存テーブルへのCSV追記は、既に定義済みのフィールドに値が入らず空になることがある**。
  空のテーブルに一括インポートする方が事故が少ない
- 空フィールドはAirtable APIのレスポンスに**キー自体が出てこない**（null/空文字ではなく
  キー省略）。存在確認は実際に値を書き込んでみるのが確実
- Single Select型フィールドへの新規値作成には、書き込みリクエストに`typecast: true`が必須。
  空文字を送るとエラーになるので`None`/キー省略にする
- 無料プランは1,000レコード/ベース（全テーブル合算）。現在Teamプランで運用中

## 実体（Entities）画像の調達方針（優先順位）

1. **国（type=country）**: `fetch_country_flags.py`でflagcdn.com（flag-icons由来、MIT）
   から国旗を機械的に取得。国コード対応表は同スクリプト内`COUNTRY_ISO`
2. **それ以外の地理的実体**（都道府県・山・湖・建造物等）: `fetch_wikipedia_images.py`で
   日本語Wikipediaの代表画像を自動取得。ライセンス情報は`public/images/entities/_credits.json`
   に記録され、`sync_from_airtable.py`が`imageCredit`として反映する
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

- `scripts/provision_airtable_data.py`は**全削除→再作成**をする破壊的スクリプト。
  実行前に必ずユーザーに確認する
- Airtableのテーブルを削除・全消去するような操作は、必ず事前に確認を取る
