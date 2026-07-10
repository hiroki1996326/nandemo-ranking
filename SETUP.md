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

## 3. GitHubリポジトリ

GitHubでprivateリポジトリを作成し、`git remote add origin ...` して push する。

## 4. Cloudflare WorkersをGitHub連携でデプロイ（Internet memeと同じ方式）

ローカルにNode.js/wranglerを入れる必要はない。Cloudflareのダッシュボード上でGitHubリポジトリを直接つなぐと、push するだけで自動デプロイされる。

1. [dash.cloudflare.com](https://dash.cloudflare.com) → 「Workers & Pages」→「Create」
2. 「Import a repository」（Git連携）を選び、GitHubアカウントと連携してこのリポジトリ（nandemo-ranking）を選択
3. ビルド設定はデフォルトのままでよい（`wrangler.jsonc` を自動で読む）。ビルドコマンドが必要な場合は空欄でよい（静的ファイルをそのまま配信するだけなので）
4. デプロイを実行すると `nandemo-ranking.<アカウント名>.workers.dev` のようなURLが払い出される
5. 以降は `git push` するたびに自動でデプロイされる
6. 独自ドメインを使う場合はCloudflareダッシュボードでカスタムドメインを設定する（DESIGN.md §9「未決事項」参照）
