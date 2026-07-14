#!/usr/bin/env python3
"""Entities（実体）の画像を、Wikipedia（日本語版）の代表画像から自動取得する。

各実体の名前でWikipedia記事を引き、その代表画像（pageimage）をダウンロードして
public/images/entities/{id}.webp に保存する。画像は必ずWikimedia Commons由来のもの
だけを許可する（著作権方針。DESIGN.md §7）。CCライセンスの表示義務に備え、作者・
ライセンス情報を public/images/entities/_credits.json に保存する。

AI生成（generate_images.py）と違い、実写・国旗などをそのまま取得するので、
シャープで合法・無料。地理・自然・国・建造物などの「絵になる実体」向き。
抽象概念（宗教・言語・映画）は代表画像が的外れ・不適切になりがちなため
**デフォルトで対象外**（type未設定のものも多いため、名前が「〜語」で終わる
ものも名前パターンで弾く）。対象に含めたい場合は --include-abstract を指定。

実体は content/entities.json から読む（Airtable不要）。

使い方（課金はないが、節度のため既存ファイルはスキップする）:
  python scripts/fetch_wikipedia_images.py --dry-run              # 何を取得する予定か（記事名と画像URL）
  python scripts/fetch_wikipedia_images.py --ids niigata,fujisan  # 指定idだけ
  python scripts/fetch_wikipedia_images.py --types prefecture,country,mountain  # 対象typeを絞る
  python scripts/fetch_wikipedia_images.py --force niigata        # 既存があっても取り直す
  python scripts/fetch_wikipedia_images.py                        # 全対象（既存はスキップ）

追加パッケージ:
  pip install Pillow
"""
import argparse
import io
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

try:
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')
except Exception:
    pass

from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
from env_loader import load_dotenv  # noqa: E402
import common as c  # noqa: E402
from common import ALLOWED_IMAGE_HOSTS  # noqa: E402

load_dotenv()

PUBLIC_DIR = os.path.join(os.path.dirname(__file__), '..', 'public')
ENTITY_IMAGES_DIR = os.path.join(PUBLIC_DIR, 'images', 'entities')
CREDITS_PATH = os.path.join(ENTITY_IMAGES_DIR, '_credits.json')

WIKI_API = 'https://ja.wikipedia.org/w/api.php'
COMMONS_API = 'https://commons.wikimedia.org/w/api.php'
USER_AGENT = 'rankin-q-imagebot/1.0 (https://rankin-q.com; image attribution respected)'

IMG_SIZE = (600, 600)  # 正方形にクロップして保存
WEBP_QUALITY = 82
MAX_BYTES = 300 * 1024

# 抽象概念は代表画像が的外れ・不適切になりやすいため、デフォルトでは対象外にする
# （--types で明示的に指定した場合のみ対象にする。過去に言語typeへ誤って世界地図画像を
#  割り当ててしまった事故があったため、機械的にガードする）。
DEFAULT_EXCLUDED_TYPES = {'religion', 'language', 'movie'}
# typeが未設定の実体も多いため、名前パターンでもフォールバック的に弾く
DEFAULT_EXCLUDED_NAME_SUFFIXES = ('語',)  # 「スペイン語」等の言語名


def looks_like_excluded_concept(entity):
    if entity['type'] in DEFAULT_EXCLUDED_TYPES:
        return True
    name = entity['name'] or ''
    return any(name.endswith(suf) for suf in DEFAULT_EXCLUDED_NAME_SUFFIXES)


def api_get(endpoint, params):
    params = dict(params)
    params.update({'format': 'json', 'action': 'query'})
    url = endpoint + '?' + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={'User-Agent': USER_AGENT})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def strip_html(text):
    if not text:
        return ''
    text = re.sub(r'<[^>]+>', '', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text


def fetch_representative_image(title):
    """記事の代表画像のURL・ファイル名を返す。無ければ (None, None)。
    SVG（国旗など）はPillowで直接開けないため、Wikimediaがラスタ化した
    thumbnail（PNG）のURLを使う。thumbnailなら .svg も .png として取得できる。
    """
    r = api_get(WIKI_API, {
        'prop': 'pageimages',
        'piprop': 'thumbnail|name',
        'pithumbsize': 1000,
        'titles': title,
        'redirects': 1,
    })
    pages = r.get('query', {}).get('pages', {})
    for _, p in pages.items():
        if 'missing' in p:
            return None, None
        thumb = p.get('thumbnail', {}).get('source')
        name = p.get('pageimage')
        if thumb and name:
            return thumb, name
    return None, None


def fetch_license(filename):
    """Commonsのファイルの作者・ライセンス情報を返す。"""
    try:
        r = api_get(COMMONS_API, {
            'prop': 'imageinfo',
            'iiprop': 'extmetadata|url',
            'titles': 'File:' + filename,
        })
    except Exception:
        return {}
    pages = r.get('query', {}).get('pages', {})
    for _, p in pages.items():
        infos = p.get('imageinfo', [])
        if not infos:
            continue
        meta = infos[0].get('extmetadata', {})

        def m(key):
            return strip_html(meta.get(key, {}).get('value', ''))
        return {
            'artist': m('Artist'),
            'license': m('LicenseShortName'),
            'license_url': meta.get('LicenseUrl', {}).get('value', ''),
            'descriptionurl': infos[0].get('descriptionurl', ''),
        }
    return {}


def download_image(url):
    req = urllib.request.Request(url, headers={'User-Agent': USER_AGENT})
    with urllib.request.urlopen(req, timeout=60) as r:
        return Image.open(io.BytesIO(r.read())).convert('RGB')


def crop_square(img, size):
    """中央を正方形にクロップしてsizeにリサイズする。"""
    w, h = img.size
    side = min(w, h)
    left = (w - side) // 2
    top = (h - side) // 2
    img = img.crop((left, top, left + side, top + side))
    return img.resize(size, Image.LANCZOS)


def save_webp(img, path, size):
    img = crop_square(img, size)
    q = WEBP_QUALITY
    while True:
        buf = io.BytesIO()
        img.save(buf, 'WEBP', quality=q)
        if buf.tell() <= MAX_BYTES or q <= 40:
            break
        q -= 10
    with open(path, 'wb') as f:
        f.write(buf.getvalue())
    return buf.tell()


def load_credits():
    if os.path.exists(CREDITS_PATH):
        try:
            with open(CREDITS_PATH, encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            return {}
    return {}


def save_credits(credits):
    with open(CREDITS_PATH, 'w', encoding='utf-8') as f:
        json.dump(credits, f, ensure_ascii=False, indent=2, sort_keys=True)


def load_entities():
    # 実体は content/entities.json（登録簿）から読む。
    return c.load_entities_list()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--ids', default='', help='カンマ区切りのid。対象を絞る')
    parser.add_argument('--exclude-ids', default='', help='カンマ区切りのid。対象から除外する（宗教等、機械的な画像割り当てを避けたいもの向け）')
    parser.add_argument('--types', default='', help='カンマ区切りのtype。対象typeを絞る（例: prefecture,country,mountain）')
    parser.add_argument('--force', default='', help='カンマ区切りのid。既存があっても取り直す')
    parser.add_argument('--limit', type=int, default=None, help='取得する最大件数')
    parser.add_argument('--include-abstract', action='store_true',
                         help='宗教・言語・映画など抽象概念タイプ/名前(「〜語」等)も対象に含める（デフォルトは除外）')
    parser.add_argument('--dry-run', action='store_true')
    args = parser.parse_args()
    only_ids = set(x for x in args.ids.split(',') if x) or None
    exclude_ids = set(x for x in args.exclude_ids.split(',') if x)
    only_types = set(x for x in args.types.split(',') if x) or None
    force_ids = set(x for x in args.force.split(',') if x)

    os.makedirs(ENTITY_IMAGES_DIR, exist_ok=True)
    entities = load_entities()
    credits = load_credits()

    fetched = 0
    skipped_no_image = []
    skipped_non_commons = []
    for e in entities:
        if args.limit is not None and fetched >= args.limit:
            print('上限に達したため中断します。', file=sys.stderr)
            break
        if only_ids is not None and e['id'] not in only_ids:
            continue
        if e['id'] in exclude_ids:
            continue
        if not args.include_abstract and looks_like_excluded_concept(e):
            continue
        if only_types is not None and e['type'] not in only_types:
            continue
        # 実体に既にWikimedia画像URLが設定されている場合はビルド側が扱うのでスキップ
        if e['image_url']:
            host = urllib.parse.urlparse(e['image_url']).netloc
            if host in ALLOWED_IMAGE_HOSTS:
                continue
        out_path = os.path.join(ENTITY_IMAGES_DIR, e['id'] + '.webp')
        if os.path.exists(out_path) and e['id'] not in force_ids:
            continue

        image_url, filename = fetch_representative_image(e['name'])
        if not image_url:
            skipped_no_image.append(e['name'])
            continue
        host = urllib.parse.urlparse(image_url).netloc
        if host not in ALLOWED_IMAGE_HOSTS:
            skipped_non_commons.append(e['name'] + ' (' + host + ')')
            continue

        print(('[dry-run] ' if args.dry_run else '') + 'Wikipedia取得: ' + e['id'] +
              ' (' + e['name'] + ') -> ' + image_url)
        if args.dry_run:
            continue

        try:
            img = download_image(image_url)
        except Exception as ex:
            print('  警告: ダウンロード失敗 ' + e['id'] + ': ' + str(ex), file=sys.stderr)
            continue
        size_bytes = save_webp(img, out_path, IMG_SIZE)

        lic = fetch_license(filename)
        credits[e['id']] = {
            'source': 'wikipedia',
            'wikipedia_title': e['name'],
            'filename': filename,
            'artist': lic.get('artist', ''),
            'license': lic.get('license', ''),
            'license_url': lic.get('license_url', ''),
            'descriptionurl': lic.get('descriptionurl', ''),
        }
        save_credits(credits)
        print('  保存: ' + out_path + ' (' + str(size_bytes // 1024) + 'KB) ライセンス: ' +
              (lic.get('license') or '不明'))
        fetched += 1
        time.sleep(0.5)

    print()
    print(str(fetched) + '件の画像をWikipediaから取得しました。')
    if skipped_no_image:
        print('代表画像が無くスキップ（' + str(len(skipped_no_image)) + '件）: ' + ', '.join(skipped_no_image[:20]))
    if skipped_non_commons:
        print('Commons以外のためスキップ（' + str(len(skipped_non_commons)) + '件）: ' + ', '.join(skipped_non_commons[:20]))
    if fetched and not args.dry_run:
        print('次に python scripts/sync_from_airtable.py を実行してサイトに反映してください。')


if __name__ == '__main__':
    main()
