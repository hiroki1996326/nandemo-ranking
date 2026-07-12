#!/usr/bin/env python3
"""Entities（type=country）の画像を、flagcdn.com（flag-iconsの国旗データをPNG配信する
無料サービス。 https://flagcdn.com ）から取得する。

Wikipediaの代表画像と違い、国コードで一意にファイルが決まるため記事マッチングの
曖昧さがなく、常にシャープな正式国旗が手に入る。データ自体はflag-icons（MIT License、
https://github.com/lipis/flag-icons ）に基づく。

環境変数:
  AIRTABLE_API_KEY / AIRTABLE_BASE_ID / AIRTABLE_ENTITIES_TABLE （sync_from_airtable.pyと共通）

使い方:
  python scripts/fetch_country_flags.py --dry-run
  python scripts/fetch_country_flags.py
  python scripts/fetch_country_flags.py --force usa,japan
"""
import argparse
import io
import os
import sys
import urllib.error
import urllib.request

try:
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')
except Exception:
    pass

from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
from env_loader import load_dotenv  # noqa: E402
from sync_from_airtable import fetch_all_records  # noqa: E402

load_dotenv()

ENTITIES_TABLE = os.environ.get('AIRTABLE_ENTITIES_TABLE', 'Entities')
PUBLIC_DIR = os.path.join(os.path.dirname(__file__), '..', 'public')
ENTITY_IMAGES_DIR = os.path.join(PUBLIC_DIR, 'images', 'entities')

# flagcdn.com: flag-icons(MIT License)のデータをPNGで直接配信する無料サービス。
FLAGCDN_BASE = 'https://flagcdn.com/w640/'
FLAG_SIZE = (600, 450)  # 4:3比率にクロップして保存

# 実体名(日本語) -> ISO 3166-1 alpha-2 国コード
COUNTRY_ISO = {
    'アメリカ': 'us', 'パキスタン': 'pk', 'ナイジェリア': 'ng', 'イギリス': 'gb',
    'エチオピア': 'et', '中国': 'cn', 'インド': 'in', 'オランダ': 'nl',
    'イタリア': 'it', 'ロシア': 'ru', 'オーストラリア': 'au', 'ブラジル': 'br',
    'フランス': 'fr', 'インドネシア': 'id', '香港': 'hk', 'カナダ': 'ca',
    'タイ': 'th', 'バングラデシュ': 'bd', '韓国': 'kr', 'スペイン': 'es',
    '日本': 'jp', 'メキシコ': 'mx', 'ドイツ': 'de',
}


def load_countries():
    records = fetch_all_records(ENTITIES_TABLE)
    out = []
    for rec in records:
        f = rec['fields']
        if f.get('type') != 'country':
            continue
        out.append({'id': f.get('id'), 'name': f.get('name')})
    return [c for c in out if c['id'] and c['name']]


def fetch_flag_png(iso_code):
    url = FLAGCDN_BASE + iso_code + '.png'
    req = urllib.request.Request(url, headers={'User-Agent': 'nandemo-ranking-flagfetch/1.0'})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return Image.open(io.BytesIO(resp.read())).convert('RGB')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--force', default='', help='カンマ区切りのid。既存があっても取り直す')
    parser.add_argument('--dry-run', action='store_true')
    args = parser.parse_args()
    force_ids = set(x for x in args.force.split(',') if x)

    if not os.environ.get('AIRTABLE_API_KEY') or not os.environ.get('AIRTABLE_BASE_ID'):
        print('環境変数 AIRTABLE_API_KEY / AIRTABLE_BASE_ID を設定してください。', file=sys.stderr)
        sys.exit(1)

    os.makedirs(ENTITY_IMAGES_DIR, exist_ok=True)
    countries = load_countries()

    fetched = 0
    no_code = []
    failed = []
    for c in countries:
        iso = COUNTRY_ISO.get(c['name'])
        if not iso:
            no_code.append(c['name'])
            continue
        out_path = os.path.join(ENTITY_IMAGES_DIR, c['id'] + '.webp')
        if os.path.exists(out_path) and c['id'] not in force_ids:
            continue
        print(('[dry-run] ' if args.dry_run else '') + c['id'] + ' (' + c['name'] + ') -> ' + iso + '.png')
        if args.dry_run:
            continue
        try:
            img = fetch_flag_png(iso)
        except Exception as e:
            print('  警告: 取得失敗 ' + c['id'] + ': ' + str(e), file=sys.stderr)
            failed.append(c['id'])
            continue
        img.save(out_path, 'WEBP', quality=90)
        print('  保存: ' + out_path)
        fetched += 1

    print()
    print(str(fetched) + '件の国旗を取得しました。')
    if no_code:
        print('国コード未対応（COUNTRY_ISOに追記してください）: ' + ', '.join(no_code))
    if failed:
        print('取得失敗: ' + ', '.join(failed))
    if fetched and not args.dry_run:
        print('次に python scripts/sync_from_airtable.py を実行してサイトに反映してください。')


if __name__ == '__main__':
    main()
