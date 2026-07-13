# ランキンQ

事実にもとづくランキングを届けるメディアサイト。ユーザー投票・投稿は扱わず、統計・記録など
出典のあるデータのみをランキング形式で紹介する。

本番: https://rankin-q.com

## ドキュメント

- **[DESIGN.md](DESIGN.md)** — プロダクト仕様書（コンセプト・データモデル・カテゴリ・方針）
- **[CLAUDE.md](CLAUDE.md)** — 開発ガイド（環境構築・作業フロー・過去のハマりどころ）。
  AIと一緒に作業するならまずこれを読ませる

## 技術構成

素のHTML/CSS/JS（フレームワークなし）。Airtableをヘッドレスモード運用し、Pythonスクリプトで
`public/data/*.js`に書き出す静的サイト。Cloudflare Workersにデプロイ（`main`にpushすると自動反映）。

## セットアップ

```bash
git clone <このリポジトリ>
cd nandemo-ranking
cp .env.example .env
# .env に AIRTABLE_API_KEY / AIRTABLE_BASE_ID を設定
pip install Pillow   # 画像生成スクリプトを使う場合のみ
```

## よく使うコマンド

```bash
# Airtableの内容をサイトのデータに反映
python scripts/sync_from_airtable.py

# 実体（都道府県・国など）の画像を取得
python scripts/fetch_country_flags.py      # 国旗
python scripts/fetch_wikipedia_images.py   # それ以外の実体（Wikipedia代表画像）

# 記事サムネイルをAI生成（要 FAL_KEY）
python scripts/generate_topic_thumbnails.py --ids <topic-id>
```

詳細は各スクリプトのdocstring、または[CLAUDE.md](CLAUDE.md)を参照。

## ローカルで確認する

```bash
cd public
python -m http.server 8000
```
`http://localhost:8000` で確認（SPAなのでルート以外に直接アクセスすると404になる。トップから
リンクをたどって遷移すること）。
