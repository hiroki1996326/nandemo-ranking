# 本番セットアップ手順

ここに書かれた作業は自動化できない（外部サービスの認証情報が要る）ため、手動で行う。

## 1. Airtableベースを作る

1. 新しいベースを作成し、以下2テーブルを用意する（フィールド定義は [DESIGN.md](DESIGN.md) §3 の通り）。

   **Topics**
   - `id`（単一行テキスト）
   - `title`（単一行テキスト）
   - `category`（単一選択: keizai / jinko / chiri / sports）
   - `unit`（単一行テキスト）
   - `source`（単一行テキスト）
   - `source_url`（URL）
   - `update_frequency`（単一選択: static / yearly / monthly / irregular）
   - `updated_at`（日付）
   - `lead`（長文テキスト）
   - `commentary`（長文テキスト）
   - `analysis`（長文テキスト。段落は空行区切り）

   **Entries**
   - `topic`（Topicsへのリンク）
   - `period`（単一行テキスト。staticなお題は空欄）
   - `name`（単一行テキスト）
   - `value`（数値）

2. 現在 `public/data/ranking-data.js` にある12本のプロトタイプデータを、上記の形でAirtableに入力する（そのままコピーできる内容になっている）。

3. [airtable.com/create/tokens](https://airtable.com/create/tokens) でPersonal Access Tokenを発行する。スコープは対象ベースへの `data.records:read` を付与する。

4. ベースIDを控える（ベースを開いたときのURL `airtable.com/appXXXXXXXXXXXXXX/...` の `appXXXXXXXXXXXXXX` の部分）。

## 2. ローカルで同期を試す

```
cp .env.example .env
# .env に AIRTABLE_API_KEY と AIRTABLE_BASE_ID を書き込む
export $(cat .env | xargs)   # またはPowerShellなら手動でset
python scripts/sync_from_airtable.py
```

`public/data/ranking-data.js` が上書きされる。差分をgit diffで確認する。

## 3. Cloudflare Workersの初回デプロイ

```
npm install
npx wrangler login
npx wrangler deploy          # 本番（既定環境）
npx wrangler deploy --env preview   # プレビュー環境
```

初回は `nandemo-ranking.<アカウント名>.workers.dev` のようなURLが払い出される。独自ドメインを使う場合はCloudflareダッシュボードでカスタムドメインを設定する（DESIGN.md §9「未決事項」参照）。

## 4. GitHub Secretsの設定

リポジトリの Settings → Secrets and variables → Actions で以下を登録する。

| Secret名 | 値 |
|---|---|
| `AIRTABLE_API_KEY` | 手順1-3で発行したトークン |
| `AIRTABLE_BASE_ID` | 手順1-4で控えたベースID |
| `CLOUDFLARE_API_TOKEN` | Cloudflareダッシュボード → My Profile → API Tokens で発行（Workers編集権限） |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflareダッシュボード右側に表示されるAccount ID |
| `SITE_URL` | 本番ドメインが決まったら設定（例: `https://nandemo-ranking.com`）。sitemap.xmlの絶対URL生成に使う。未設定だとプレースホルダードメインで生成される |

設定後、`dev` ブランチへのpushでプレビュー環境に、`main` へのpushで本番にデプロイされる（[.github/workflows/deploy.yml](.github/workflows/deploy.yml)）。

## 5. リモートリポジトリ

GitHubでprivateリポジトリを作成し、`git remote add origin ...` して push する。ブランチ運用は `main`（本番）・`dev`（プレビュー）の2本を基本とする。
