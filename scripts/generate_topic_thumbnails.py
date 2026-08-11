#!/usr/bin/env python3
"""記事(Topics)のサムネイル画像を自動生成する。

背景はFlux(fal.ai)で生成し、タイトル文字はPillowで別途合成する
（AIには一切文字を描かせない。日本語の固有名詞をプロンプトに含めると
和風・アニメ調に偏る問題が過去にあったため、背景生成プロンプトは
英語のカテゴリ説明のみで構成し、日本語のタイトル文字列は一切渡さない）。

環境変数:
  FAL_KEY                 fal.aiのAPIキー
記事メタは content/articles/*.json から読む（Airtable不要）。

使い方（安全のため、--ids か --limit のどちらかを指定しないと最大5件までしか生成しない）:
  python scripts/generate_topic_thumbnails.py --dry-run
  python scripts/generate_topic_thumbnails.py --ids kome-shukakuryo-todofuken
  python scripts/generate_topic_thumbnails.py --limit 10
  python scripts/generate_topic_thumbnails.py --force kome-shukakuryo-todofuken --ids kome-shukakuryo-todofuken

追加パッケージ:
  pip install Pillow
"""
import argparse
import io
import json
import os
import sys
import time
import urllib.request

try:
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')
except Exception:
    pass

from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, os.path.dirname(__file__))
from env_loader import load_dotenv  # noqa: E402
import common as c  # noqa: E402

load_dotenv()

FAL_KEY = os.environ.get('FAL_KEY')
FLUX_MODEL = os.environ.get('FLUX_MODEL', 'fal-ai/flux/dev')

PUBLIC_DIR = os.path.join(os.path.dirname(__file__), '..', 'public')
TOPIC_IMAGES_DIR = os.path.join(PUBLIC_DIR, 'images', 'topics')
FONT_PATH = os.path.join(os.path.dirname(__file__), 'assets', 'NotoSansJP-Bold.ttf')

# 英語のみで構成する。日本語のタイトル・固有名詞は絶対に混ぜない
# （日本語テキストを含めるとモデルが和風/アニメ調の絵柄に偏る問題が確認されている）。
STYLE_SUFFIX = (
    'photorealistic photograph, professional editorial photography, natural lighting, '
    'shallow depth of field, vibrant rich colors, high detail, dynamic composition, '
    'no text, no letters, no characters, no watermark, no logo'
)

# 記事ごとの具体的なモチーフ（英語のみ）。カテゴリだけの汎用背景だと
# 「その記事らしさ」が出ないため、topic idごとに具体的な被写体を指定する。
TOPIC_HINT = {
    'yushutsugaku-kuni': 'cargo ships, shipping containers, global trade routes, world map',
    'kome-shukakuryo-todofuken': 'golden rice paddy fields, rice stalks, harvest season, countryside',
    'sekai-kuni-menseki': 'world map, vast landscapes, continents',
    'sekai-gengo-washa': 'speech bubbles in many colors, world map, diverse people talking',
    'sekai-takai-yama': 'snow-capped mountain peaks, dramatic alpine scenery, clouds',
    'kogyo-shunyu-eiga': 'cinema film reel, movie theater, popcorn, red curtain',
    'sekai-shima-menseki': 'tropical islands, ocean, aerial view of coastline',
    'sekai-koki-eiga': 'cinema film reel, movie theater, popcorn, red curtain, spotlight',
    'jinko-todofuken': 'crowd of diverse people, city skyline, silhouettes',
    'sekai-kawa-nagasa': 'winding river, lush green valley, aerial view',
    'nihon-nagai-kawa': 'winding river, Japanese countryside, mountains',
    'nanadairiku-saikoho': 'snow-capped mountain peaks, dramatic alpine scenery, world map',
    'sekai-jinko-kuni': 'crowd of diverse people from many countries, world map, city skyline',
    'sekai-koso-biru': 'skyscrapers, city skyline, urban architecture',
    'gyokakuryo-todofuken': 'fishing boats, ocean waves, fresh fish, harbor',
    'nihon-yama-takasa': 'snow-capped mountain peak, Japanese alpine scenery',
    'nihon-mizuumi-menseki': 'calm lake, mountains reflected in water, nature',
    'sekai-mizuumi-menseki': 'vast lake, mountains reflected in water, nature',
    'sekai-gdp-kuni': 'stock market chart, coins and banknotes, growth graph, world map',
    'wcup-yusho-kaisu': 'soccer stadium, trophy, football pitch, cheering crowd, confetti',
    'sekai-tosiken-jinko': 'dense city skyline at night, lights, urban skyscrapers',
    'todofuken-menseki': 'aerial view of landscape, mountains and coastline, map',
    'sekai-shukyo-jinko': 'diverse crowd of people from many cultures, world map, globe',
    'sekai-kaiyo-menseki': 'vast ocean, waves, aerial view from above',
    'nihon-koso-biru': 'modern skyscrapers, Tokyo city skyline, urban architecture',
    'sekai-coffee-seisanryo-kuni': 'coffee beans, coffee farm plantation, roasted coffee, warm tones',
    'natsuki-olympic-kin-medal-kuni': 'olympic stadium, gold medal, cheering crowd, confetti',
    'nihon-taki-rakusa': 'tall waterfall, lush green forest, mist, dramatic nature',
    'sekai-heikinjumyo-kuni': 'elderly and young people together, healthy lifestyle, warm sunlight',
    'sekai-jidousha-seisan-kuni': 'car factory assembly line, automobiles, industrial',
    'sekai-sabaku-menseki': 'vast desert dunes, sand, arid landscape',
    'sekai-kaiko-fukasa': 'deep ocean trench, dark blue abyss, underwater sonar depth, bathymetric',
    'sekai-komugi-seisanryo-kuni': 'golden wheat field, wheat stalks, harvest season, farmland',
    'taiyokei-wakusei-chokkei': 'planets in space, solar system, stars, cosmic nebula',
    'todofuken-shinrinritsu': 'dense green forest canopy, aerial view of mountains covered in trees, misty woodland',
    'todofuken-rinsetsu-kensu': 'aerial view of mountain valleys and winding borders, patchwork landscape from above, topographic',
    'todofuken-heikin-nenshu': 'modern city skyline financial district, office towers, briefcase and coins, business district at dusk',
    'todofuken-heikin-jumyo': 'elderly and young people walking together in a peaceful Japanese park, warm sunlight, healthy longevity',
    'todofuken-shusshoritsu': 'parent and small child holding hands, soft warm sunlight, gentle family moment, Japanese neighborhood',
    'todofuken-saitei-chingin': 'pay envelope and coins on a desk, calculator, wallet, work and wages theme, clean office lighting',
    'todofuken-shima-no-kazu': 'aerial view of scattered small islands in turquoise sea, archipelago from above, coastal islets',
    'todofuken-kaigansen-nagasa': 'aerial view of a rugged rocky coastline with winding bays and inlets, waves meeting cliffs, dramatic shoreline from above',
    'todofuken-heikin-shinchou': 'a simple measuring height ruler on a clean wall, tape measure and wooden stadiometer, soft studio light, minimal composition',
    'sekai-heikin-shinchou-kuni': 'diverse silhouettes of people of different heights standing in a row against a soft gradient sky, world diversity, clean minimal',
    'nihon-mizuumi-fukasa': 'deep still crater lake surrounded by steep forested caldera walls, dark blue water, calm mountain lake seen from above, serene',
    'sekai-mizuumi-fukasa': 'vast deep blue rift lake between steep mountain ridges, dramatic long narrow lake, dark abyssal water, wide landscape',
    'nihon-shima-menseki': 'aerial satellite-like view of a large green island surrounded by blue ocean, Japanese archipelago from high above, coastline and sea',
    'sekai-co2-haishutsu-kuni': 'industrial factory smokestacks emitting smoke against a hazy sky, power plant chimneys, heavy industry, muted grey atmosphere',
    'sekai-kawa-ryuiki-menseki': 'aerial view of a vast winding river with many branching tributaries through green rainforest, river delta from above, wide basin',
    'sekai-sekiyu-seisan-kuni': 'oil pumpjacks and drilling rigs in a desert oil field at sunset, petroleum extraction, silhouettes of oil derricks, warm sky',
    'sekai-kome-seisan-kuni': 'terraced green rice paddy fields on hillsides in asia, rice stalks with grains, water reflections, harvest season',
    'sekai-cha-seisan-kuni': 'terraced green tea plantation on rolling hills, rows of fresh tea bushes, misty mountains, lush vivid green',
    'sekai-daizu-seisan-kuni': 'vast soybean field at harvest, close-up of soybean pods and beans, golden farmland under wide sky',
    'sekai-cacao-seisan-kuni': 'ripe cacao pods on a tree and open pod with cocoa beans, tropical plantation, chocolate, warm brown tones',
    'sekai-wine-seisan-kuni': 'vineyard rows on rolling hills at golden sunset, bunches of grapes, a glass and bottle of red wine, warm mediterranean light',
    'sekai-tekko-seisan-kuni': 'steel mill interior with glowing molten metal pouring, blast furnace sparks, heavy industry, dramatic orange glow',
    'sekai-gunjihi-kuni': 'silhouettes of a fighter jet and a naval warship against a dramatic dusk sky, defense and military budget concept, editorial',
    'sekai-kokusai-kankokyaku-kuni': 'travelers with suitcases sightseeing near famous world landmarks, airport departures, tourism, world map motif',
    'sekai-sekaiisan-kuni': 'majestic ancient monuments and historic world heritage architecture, temples ruins and cathedrals, golden light',
    'sekai-tairiku-menseki': 'satellite view of planet earth from space showing the continents, world map, blue oceans and green landmasses',
    'todofuken-jinko-mitsudo': 'dense crowd of people packed on a busy city street seen from above, urban density, many pedestrians',
    'sekai-best-selling-album': 'stacks of vinyl records and album covers, a turntable, glowing stage lights, music theme, warm tones',
    'sekai-themepark-nyujosha': 'amusement theme park with a big roller coaster and a fairytale castle, ferris wheel, crowds of happy visitors, festive colorful, bright sunny sky',
    'sekai-best-selling-game': 'video game controllers, glowing arcade and neon game screens, pixel blocks, colorful gaming setup, dynamic',
    'sekai-sekitan-seisan-kuni': 'open pit coal mine with heavy excavators, black coal seams, mining trucks, industrial, dramatic overcast sky',
    'sekai-denryoku-shohi-kuni': 'high voltage electricity transmission towers and power lines at dusk, glowing city grid, electrical substation, energy, dramatic sky',
}

CATEGORY_HINT = {
    'keizai': 'economy and industry theme, abstract bar charts and global trade motif',
    'jinko': 'population and society theme, abstract silhouettes of people and a city skyline',
    'chiri': 'geography and nature theme, generic landscape scenery',
    'sports': 'sports and entertainment theme, a generic stadium',
}

# タイトル帯の色（カテゴリごと。単調なグレーではなく元気な色にする）。(R,G,B,A)
CATEGORY_BAND_COLOR = {
    'keizai': (180, 60, 20, 175),    # 深いオレンジ
    'jinko': (20, 90, 130, 175),     # 深いブルー
    'chiri': (30, 100, 60, 175),     # 深いグリーン
    'sports': (170, 20, 50, 175),    # 深いレッド
}
DEFAULT_BAND_COLOR = (30, 30, 30, 170)

THUMB_SIZE = (1200, 630)  # OGP/Twitterカード推奨サイズ
WEBP_QUALITY = 80
MAX_BYTES = 300 * 1024
MAX_WITHOUT_LIMIT = 5


def fal_generate(prompt, width, height):
    if not FAL_KEY:
        print('環境変数 FAL_KEY を設定してください。', file=sys.stderr)
        sys.exit(1)
    url = 'https://fal.run/' + FLUX_MODEL
    body = json.dumps({
        'prompt': prompt,
        'image_size': {'width': width, 'height': height},
        'num_images': 1,
        'num_inference_steps': 40,
        'guidance_scale': 4.5,
    }).encode('utf-8')
    req = urllib.request.Request(url, data=body, headers={
        'Authorization': 'Key ' + FAL_KEY,
        'Content-Type': 'application/json',
    })
    with urllib.request.urlopen(req, timeout=90) as resp:
        data = json.load(resp)
    image_url = data['images'][0]['url']
    img_req = urllib.request.Request(image_url, headers={'User-Agent': 'nandemo-ranking-thumbgen/1.0'})
    with urllib.request.urlopen(img_req, timeout=60) as resp:
        return Image.open(io.BytesIO(resp.read())).convert('RGB')


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


def draw_title(img, title, category=None):
    """背景画像の中央に半透明の帯を敷き、白文字でタイトルを合成する（AIには一切描かせない）。
    帯の色はカテゴリごとの鮮やかな色にする（単調なグレーにしない）。
    """
    img = img.copy()
    draw = ImageDraw.Draw(img, 'RGBA')
    w, h = img.size
    band_h = int(h * 0.32)
    band_top = (h - band_h) // 2
    band_color = CATEGORY_BAND_COLOR.get(category, DEFAULT_BAND_COLOR)
    draw.rectangle([0, band_top, w, band_top + band_h], fill=band_color)

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
    y = band_top + (band_h - total_h) // 2
    for line in lines:
        bbox = draw.textbbox((0, 0), line, font=font)
        line_w = bbox[2] - bbox[0]
        x = (w - line_w) // 2
        draw.text((x, y), line, font=font, fill=(255, 255, 255, 255))
        y += line_height
    return img.convert('RGB')


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


def load_topics():
    # 記事メタは content/articles/*.json から読む。
    return c.load_topics_meta()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--ids', default='', help='カンマ区切りのid。対象を絞る（安全のため推奨）')
    parser.add_argument('--force', default='', help='カンマ区切りのid。既存があっても再生成する')
    parser.add_argument('--limit', type=int, default=None, help='生成する最大件数')
    parser.add_argument('--dry-run', action='store_true')
    args = parser.parse_args()
    only_ids = set(x for x in args.ids.split(',') if x) or None
    force_ids = set(x for x in args.force.split(',') if x)

    limit = args.limit
    if only_ids is None and limit is None and not args.dry_run:
        limit = MAX_WITHOUT_LIMIT
        print('警告: --ids も --limit も指定がないため、暴走防止で上限' + str(MAX_WITHOUT_LIMIT) + '件までに制限します。', file=sys.stderr)

    os.makedirs(TOPIC_IMAGES_DIR, exist_ok=True)
    topics = load_topics()

    created = 0
    for t in topics:
        if limit is not None and created >= limit:
            print('上限に達したため中断します。', file=sys.stderr)
            break
        if only_ids is not None and t['id'] not in only_ids:
            continue
        out_path = os.path.join(TOPIC_IMAGES_DIR, t['id'] + '.webp')
        if os.path.exists(out_path) and t['id'] not in force_ids:
            continue
        subject = TOPIC_HINT.get(t['id']) or CATEGORY_HINT.get(t['category'], 'abstract minimal background')
        prompt = STYLE_SUFFIX + ', ' + subject
        print(('[dry-run] ' if args.dry_run else '') + t['id'] + ' -> ' + prompt)
        if args.dry_run:
            continue
        img = fal_generate(prompt, *THUMB_SIZE)
        img = draw_title(img, t['title'], t['category'])
        size_bytes = save_webp(img, out_path, THUMB_SIZE)
        print('  保存: ' + out_path + ' (' + str(size_bytes // 1024) + 'KB)')
        created += 1
        time.sleep(1)

    print()
    print(str(created) + '件のサムネイルを生成しました。')
    if created and not args.dry_run:
        print('次に python scripts/build.py を実行してサイトに反映してください。')


if __name__ == '__main__':
    main()
