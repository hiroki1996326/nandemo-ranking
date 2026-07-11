#!/usr/bin/env python3
"""Entities（実体）とTopics（記事）の画像をAIで自動生成し、public/images/配下に保存する。

- Entities: image_url（Wikimedia Commons）が未設定のものだけ、AIイラストを生成する
  （実写のWikimedia画像がある場合はそちらを優先し、AI画像では上書きしない）
- Topics: サムネイル画像が未生成のものについて、文字なしの背景をAIで生成し、
  その上にタイトル文字をPillowで合成する（日本語テキストはAIに描かせない。
  精度が低く崩れるため）

画像はFlux（fal.ai経由）で生成する。1枚あたり数円程度。

環境変数:
  FAL_KEY                fal.aiのAPIキー（必須。 https://fal.ai で取得）
  AIRTABLE_API_KEY        Airtable Personal Access Token（必須。sync_from_airtable.pyと共通）
  AIRTABLE_BASE_ID        対象ベースのID（必須）
  AIRTABLE_TOPICS_TABLE   省略時 'Topics'
  AIRTABLE_ENTITIES_TABLE 省略時 'Entities'
  FLUX_MODEL              省略時 'fal-ai/flux/schnell'（安価・高速）

使い方:
  FAL_KEY=xxx AIRTABLE_API_KEY=xxx AIRTABLE_BASE_ID=appXXXX python scripts/generate_images.py
  python scripts/generate_images.py --only entities   # entitiesだけ
  python scripts/generate_images.py --only topics     # topicsだけ
  python scripts/generate_images.py --force id1,id2   # 既存があっても再生成するid
  python scripts/generate_images.py --dry-run          # 何を生成する予定かだけ表示

追加パッケージ:
  pip install Pillow
"""
import argparse
import io
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, os.path.dirname(__file__))
from sync_from_airtable import fetch_all_records, ALLOWED_IMAGE_HOSTS  # noqa: E402

FAL_KEY = os.environ.get('FAL_KEY')
FLUX_MODEL = os.environ.get('FLUX_MODEL', 'fal-ai/flux/schnell')

TOPICS_TABLE = os.environ.get('AIRTABLE_TOPICS_TABLE', 'Topics')
ENTITIES_TABLE = os.environ.get('AIRTABLE_ENTITIES_TABLE', 'Entities')

PUBLIC_DIR = os.path.join(os.path.dirname(__file__), '..', 'public')
ENTITY_IMAGES_DIR = os.path.join(PUBLIC_DIR, 'images', 'entities')
TOPIC_IMAGES_DIR = os.path.join(PUBLIC_DIR, 'images', 'topics')
FONT_PATH = os.path.join(os.path.dirname(__file__), 'assets', 'NotoSansJP-Bold.ttf')

# 全画像共通のスタイル指定（統一感を出すため毎回付与する）
STYLE_SUFFIX = (
    'flat vector illustration, minimalist design, soft muted color palette, '
    'simple clean background, no text, no watermark, no logo'
)

CATEGORY_HINT = {
    'keizai': 'economy and industry theme, charts and trade',
    'jinko': 'population and society theme, people and city',
    'chiri': 'geography and nature theme, landscape',
    'sports': 'sports and entertainment theme, stadium',
}

TYPE_HINT = {
    'prefecture': 'Japanese prefecture landscape',
    'country': 'country landmark landscape',
    'mountain': 'mountain landscape',
    'lake': 'lake landscape',
    'river': 'river landscape',
    'building': 'landmark building',
    'movie': 'cinema and film theme',
    'religion': 'religious symbol, respectful and neutral depiction',
    'language': 'books and letters theme',
    'food': 'food photography style illustration',
    'ocean': 'ocean landscape',
    'continent': 'world map continent theme',
    'other': 'abstract minimal icon',
}

# サムネの最終サイズ・容量上限（1200x630はOGP/Twitterカードの推奨サイズ）
THUMB_SIZE = (1200, 630)
ENTITY_SIZE = (600, 600)
WEBP_QUALITY = 80
MAX_BYTES = 300 * 1024


def fal_generate(prompt, width, height):
    if not FAL_KEY:
        print('環境変数 FAL_KEY を設定してください。', file=sys.stderr)
        sys.exit(1)
    url = 'https://fal.run/' + FLUX_MODEL
    body = json.dumps({
        'prompt': prompt,
        'image_size': {'width': width, 'height': height},
        'num_images': 1,
    }).encode('utf-8')
    req = urllib.request.Request(url, data=body, headers={
        'Authorization': 'Key ' + FAL_KEY,
        'Content-Type': 'application/json',
    })
    with urllib.request.urlopen(req, timeout=60) as resp:
        data = json.load(resp)
    image_url = data['images'][0]['url']
    img_req = urllib.request.Request(image_url, headers={'User-Agent': 'nandemo-ranking-imagegen/1.0'})
    with urllib.request.urlopen(img_req, timeout=60) as resp:
        return Image.open(io.BytesIO(resp.read())).convert('RGB')


def save_webp(img, path, size, quality=WEBP_QUALITY):
    img = img.resize(size, Image.LANCZOS)
    q = quality
    while True:
        buf = io.BytesIO()
        img.save(buf, 'WEBP', quality=q)
        if buf.tell() <= MAX_BYTES or q <= 40:
            break
        q -= 10
    with open(path, 'wb') as f:
        f.write(buf.getvalue())
    return buf.tell()


def draw_title(img, title):
    """背景画像の下部に半透明の帯を敷き、白文字でタイトルを合成する。"""
    img = img.copy()
    draw = ImageDraw.Draw(img, 'RGBA')
    w, h = img.size
    band_h = int(h * 0.32)
    draw.rectangle([0, h - band_h, w, h], fill=(20, 20, 20, 160))

    font_size = 58
    font = ImageFont.truetype(FONT_PATH, font_size)
    try:
        font.set_variation_by_axes([700])
    except Exception:
        pass

    max_width = w - 90
    lines = wrap_text(title, font, max_width)
    while len(lines) > 2 and font_size > 22:
        font_size -= 2
        font = ImageFont.truetype(FONT_PATH, font_size)
        try:
            font.set_variation_by_axes([700])
        except Exception:
            pass
        lines = wrap_text(title, font, max_width)
    lines = lines[:2]

    line_height = int(font_size * 1.35)
    total_h = line_height * len(lines)
    y = h - band_h + (band_h - total_h) // 2
    for line in lines:
        bbox = draw.textbbox((0, 0), line, font=font)
        line_w = bbox[2] - bbox[0]
        x = (w - line_w) // 2
        draw.text((x, y), line, font=font, fill=(255, 255, 255, 255))
        y += line_height
    return img.convert('RGB')


def wrap_text(text, font, max_width):
    lines = []
    current = ''
    for ch in text:
        trial = current + ch
        bbox = font.getbbox(trial)
        if bbox[2] - bbox[0] > max_width and current:
            lines.append(current)
            current = ch
        else:
            current = trial
    if current:
        lines.append(current)
    return lines


def load_entities():
    records = fetch_all_records(ENTITIES_TABLE)
    out = []
    for rec in records:
        f = rec['fields']
        out.append({
            'id': f.get('id'),
            'name': f.get('name'),
            'type': f.get('type'),
            'image_url': f.get('image_url') or '',
        })
    return [e for e in out if e['id'] and e['name']]


def load_topics():
    records = fetch_all_records(TOPICS_TABLE)
    out = []
    for rec in records:
        f = rec['fields']
        out.append({
            'id': f.get('id'),
            'title': f.get('title'),
            'category': f.get('category'),
        })
    return [t for t in out if t['id'] and t['title']]


def generate_entities(entities, force_ids, dry_run):
    os.makedirs(ENTITY_IMAGES_DIR, exist_ok=True)
    created = 0
    for e in entities:
        # Wikimediaの実写があるならAI画像は生成しない（既存の運用を優先）
        if e['image_url']:
            host = urllib.parse.urlparse(e['image_url']).netloc
            if host in ALLOWED_IMAGE_HOSTS:
                continue
        out_path = os.path.join(ENTITY_IMAGES_DIR, e['id'] + '.webp')
        if os.path.exists(out_path) and e['id'] not in force_ids:
            continue
        prompt = e['name'] + ', ' + TYPE_HINT.get(e['type'], 'abstract minimal icon') + ', ' + STYLE_SUFFIX
        print(('[dry-run] ' if dry_run else '') + 'entity生成: ' + e['id'] + ' -> ' + prompt)
        if dry_run:
            continue
        img = fal_generate(prompt, *ENTITY_SIZE)
        size_bytes = save_webp(img, out_path, ENTITY_SIZE)
        print('  保存: ' + out_path + ' (' + str(size_bytes // 1024) + 'KB)')
        created += 1
        time.sleep(1)
    return created


def generate_topics(topics, force_ids, dry_run):
    os.makedirs(TOPIC_IMAGES_DIR, exist_ok=True)
    created = 0
    for t in topics:
        out_path = os.path.join(TOPIC_IMAGES_DIR, t['id'] + '.webp')
        if os.path.exists(out_path) and t['id'] not in force_ids:
            continue
        prompt = t['title'] + ', ' + CATEGORY_HINT.get(t['category'], '') + ', ' + STYLE_SUFFIX
        print(('[dry-run] ' if dry_run else '') + 'topic生成: ' + t['id'] + ' -> ' + prompt)
        if dry_run:
            continue
        img = fal_generate(prompt, *THUMB_SIZE)
        img = draw_title(img, t['title'])
        size_bytes = save_webp(img, out_path, THUMB_SIZE)
        print('  保存: ' + out_path + ' (' + str(size_bytes // 1024) + 'KB)')
        created += 1
        time.sleep(1)
    return created


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--only', choices=['entities', 'topics'])
    parser.add_argument('--force', default='', help='カンマ区切りのid。既存があっても再生成する')
    parser.add_argument('--dry-run', action='store_true')
    args = parser.parse_args()
    force_ids = set(x for x in args.force.split(',') if x)

    if not os.environ.get('AIRTABLE_API_KEY') or not os.environ.get('AIRTABLE_BASE_ID'):
        print('環境変数 AIRTABLE_API_KEY / AIRTABLE_BASE_ID を設定してください。', file=sys.stderr)
        sys.exit(1)

    total = 0
    if args.only != 'topics':
        entities = load_entities()
        total += generate_entities(entities, force_ids, args.dry_run)
    if args.only != 'entities':
        topics = load_topics()
        total += generate_topics(topics, force_ids, args.dry_run)

    print(str(total) + '件の画像を生成しました。')
    if total and not args.dry_run:
        print('public/images/ 配下に保存されました。次に python scripts/sync_from_airtable.py を実行してサイトに反映してください。')


if __name__ == '__main__':
    main()
