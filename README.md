# ランキンQ

事実にもとづくランキングを届けるメディアサイト。ユーザー投票・投稿は扱わず、統計・記録など
出典のあるデータのみをランキング形式で紹介する。

本番: https://rankin-q.com

## ドキュメント

- **[CLAUDE.md](CLAUDE.md)** — 開発ガイド。AIと作業するならまずこれを読ませる（過去のハマりどころ・運用ルール）
- **[DESIGN.md](DESIGN.md)** — プロダクト仕様（コンセプト・データモデル・方針）

## 技術構成

素のHTML/CSS/JS（フレームワークなし）。`content/`配下のファイルを源泉に、`scripts/build.py`で
`public/data/*.js`を生成する静的サイト。Cloudflare Workersにデプロイ（`main`にpushすると自動反映）。

---

## 【最重要】データの源泉は content/ フォルダ

記事や実体のデータは**すべて `content/` 配下のファイル**にある。ここを編集して `build.py` を回すのが
唯一の正しい更新方法。

```
content/
  entities.json                 実体（都道府県・国・惑星…）の登録簿: id -> {name, type}
  articles/
    <記事id>.json                記事1本ずつ（実体はIDで参照、文章はテキスト）
  datasets/
    <データセット名>.csv          大量の時系列数値（1列目=実体ID、ヘッダ=年など）
```

### やってはいけないこと（重要）

- **`public/data/*.js` を直接編集しない**。これは `build.py` が生成する成果物。手で書いても次のビルドで消える
  （記事を追加したいときは `content/articles/` にファイルを作って `build.py` を回す）

> データはAirtableから `content/` ファイル方式に完全移行済み。Airtableはもう使わない
> （同期スクリプトも削除済み）。

---

## 記事を追加する手順

### 1. 記事ファイルを作る

`content/articles/<記事id>.json` を新規作成する。記事idはURLになる英数字スラッグ（例: `sekai-jinko-kuni`）。

```json
{
  "id": "sekai-jinko-kuni",
  "title": "世界の人口ランキング（国別）",
  "category": "jinko",
  "unit": "人",
  "source": "国連 世界人口推計",
  "sourceUrl": "https://population.un.org/wpp/",
  "updateFrequency": "yearly",
  "updatedAt": "2026-07-15",
  "lead": "1〜2文の要約。",
  "commentary": "表の前に置く短い解説（任意）。",
  "analysisHeading": "考察の見出し。『考察』という一言でなく内容を要約した見出しにする",
  "analysis": [
    "考察の段落1。事実・数値・順位差のみ。主観語（〜だろう等）は使わない。",
    "考察の段落2。"
  ],
  "data": [
    { "period": null, "entries": [
      { "entity": "india", "value": 1463900000 },
      { "entity": "china", "value": 1416100000 },
      { "entity": "usa",   "value": 347300000 }
    ]}
  ],
  "notes": {
    "india": "トップ3のカードに出る短い解説（任意）。実体IDで紐づける。",
    "china": "…"
  }
}
```

- `category` は `keizai`（経済・産業）/ `jinko`（人口・社会）/ `chiri`（地理・自然）/ `sports`（スポーツ・興行）の4つから選ぶ
- `entries` の `entity` には**必ず実体のID**を書く（名前ではない）。これで表記ゆれが起きない
- 時間軸のないお題（例: 世界一高い山）は `period` を `null` にして1セットだけ持つ
- 年次で複数年ある場合は `data` に複数の `{period, entries}` を並べる（後述のdatasetの方が大量データ向き）

### 2. 実体（entity）がまだ無ければ登録簿に追加

`content/entities.json` を**必ず先に検索**し、その実体が既にあるか確認する。

- **あれば、そのIDを使う**（新規作成しない）。例: `新潟県` は既に `niigata` がある
- **なければ**、`content/entities.json` に1件だけ追加してからIDを使う:
  ```json
  "new-entity-id": { "name": "表示名", "type": "種別" }
  ```
- 表記ゆれ厳禁。「アメリカ」と「アメリカ合衆国」を別レコードにしない。迷ったら既存の似た名前を探す
- `type` の例: `prefecture` `country` `mountain` `lake` `river` `building` `food` `ocean` `continent` `planet` `desert` `waterfall` など。新種別が必要なら追加してよい

### 3. ビルドして反映

```
python scripts/build.py
```

- `content/` を読んで `public/data/*.js` ・ `sitemap.xml` ・ `robots.txt` を再生成する
- **存在しない実体IDを参照しているとビルドが止まる**（タイポ・表記ゆれを機械的に検出）

### 4. 確認してコミット・push

```
git status          # 差分を確認
git add -A
git commit -m "…記事を追加"
git push origin main   # Cloudflareが自動デプロイ
```

`app.js` / `styles.css` / `index.html` を変更した場合は、キャッシュ対策として `public/index.html` 内の
`?v=N` を+1すること。

---

## 大量の時系列データ（推移グラフ用）

「都道府県×何十年」のような大量の数値は、記事ファイルに直接書かず **CSV** にする。

`content/datasets/<名前>.csv`（1列目=実体ID、ヘッダ行=期間、空セルは可）:

```
entity,2020,2021,2022,2023,2024
niigata,666800,620000,631000,591700,622800
hokkaido,594400,573700,553200,540200,562400
```

記事ファイルでは `data` の代わりに `dataset` でCSV名を指す:

```json
{ "id": "kome-shukakuryo-todofuken", "…": "…", "dataset": "kome-shukakuryo", "notes": { … } }
```

複数期間があると、記事詳細に自動で**折れ線グラフ**（上位5件の推移）が表示される。

---

## ライティングのルール

- タイトルは必ず「ランキング」を含める
- 絵文字は一切使わない（タイトル・タグ・本文すべて）
- 考察は主観語を避け、数値・順位差のみで構成する
- 出典のあるデータのみ。画像の著作権不明なものは使わない

---

## セットアップ

```bash
git clone <このリポジトリ>
cd nandemo-ranking
cp .env.example .env
# .env に SITE_URL=https://rankin-q.com を設定（Airtableキーは新方式では不要）
pip install Pillow   # 画像取得・生成スクリプトを使う場合のみ
```

## ローカルで確認する

```bash
cd public
python -m http.server 8000
```
`http://localhost:8000` を開き、トップからリンクをたどって確認（SPAのためルート以外に直接アクセスすると404）。

## 画像まわりのスクリプト（任意）

```bash
python scripts/fetch_country_flags.py      # 国旗（flagcdn.com）
python scripts/fetch_wikipedia_images.py   # 実体画像（Wikipedia代表画像。宗教・言語等はデフォルト除外）
python scripts/generate_topic_thumbnails.py --ids <記事id>   # 記事サムネをAI生成（要 FAL_KEY）
```
取得後は `python scripts/build.py` で反映する。詳細は [CLAUDE.md](CLAUDE.md) を参照。
