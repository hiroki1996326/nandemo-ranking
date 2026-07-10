// このファイルは scripts/sync_from_airtable.py が自動生成します。
// 直接編集しないでください（Airtableで編集し、再同期してください）。
// 追記: sekai-jinko-kuni / sekai-gdp-kuni の2本は、Airtable未反映のまま手動追加（あとでAirtableにも入力し同期すること）
window.RANKING_DATA = {
  categories: [
    {
      id: 'keizai',
      name: '経済・産業',
    },
    {
      id: 'jinko',
      name: '人口・社会',
    },
    {
      id: 'chiri',
      name: '地理・自然',
    },
    {
      id: 'sports',
      name: 'スポーツ・興行',
    },
  ],
  topics: [
    {
      id: 'sekai-jinko-kuni',
      title: '世界の人口ランキング（国別）',
      category: 'jinko',
      unit: '人',
      source: '国連 World Population Prospects ほか（仮データ）',
      sourceUrl: 'https://population.un.org/wpp/',
      updateFrequency: 'yearly',
      updatedAt: '2026-07-10',
      lead: '世界で最も人口が多い国はインドで、約14億6,390万人。2位中国（約14億1,610万人）をわずかに上回り世界最多となっている。',
      commentary: 'インド・中国の2カ国だけで世界人口の3分の1近くを占め、3位アメリカとは10億人以上の差がある。',
      analysis: [
        'インドの人口は14億6,390万人で、2位中国（14億1,610万人）との差は4,780万人。3位アメリカ（3億4,730万人）とは10億人以上の開きがあり、上位2カ国が突出している。',
        '上位10カ国のうちアジアが5カ国（インド・中国・インドネシア・パキスタン・バングラデシュ）、アフリカが2カ国（ナイジェリア・エチオピア）を占める。7位ブラジル（2億1,280万人）以下は2億人前後で並ぶ。',
      ],
      periods: [
        { period: '2025', entries: [
          { name: 'インド', value: 1463900000 },
          { name: '中国', value: 1416100000 },
          { name: 'アメリカ', value: 347300000 },
          { name: 'インドネシア', value: 285700000 },
          { name: 'パキスタン', value: 255200000 },
          { name: 'ナイジェリア', value: 237500000 },
          { name: 'ブラジル', value: 212800000 },
          { name: 'バングラデシュ', value: 175700000 },
          { name: 'ロシア', value: 144000000 },
          { name: 'エチオピア', value: 135500000 },
        ]},
      ],
    },
    {
      id: 'sekai-gdp-kuni',
      title: '世界のGDPランキング（国別）',
      category: 'keizai',
      unit: '億ドル',
      source: 'IMF World Economic Outlook（仮データ）',
      sourceUrl: 'https://www.imf.org/',
      updateFrequency: 'yearly',
      updatedAt: '2026-07-10',
      lead: '世界最大の経済大国はアメリカで、名目GDPは約323,839億ドル。2位中国（約208,516億ドル）に10兆ドル以上の差をつけている。',
      commentary: 'GDPの規模では米国・中国の2カ国が突出しており、3位ドイツ以下とは大きな差がある。',
      analysis: [
        'アメリカの名目GDPは323,839億ドルで、2位中国（208,516億ドル）との差は115,323億ドル。3位ドイツ（54,529億ドル）は中国の4分の1程度の規模になる。',
        '上位10カ国のうちヨーロッパはドイツ・イギリス・フランス・イタリア・ロシアの5カ国、アジアは中国・日本・インドの3カ国、南北アメリカはアメリカ・ブラジルの2カ国。4位日本（43,793億ドル）と6位インド（41,532億ドル）の差は2,261億ドルと小さい。',
      ],
      periods: [
        { period: '2026', entries: [
          { name: 'アメリカ', value: 323839 },
          { name: '中国', value: 208516 },
          { name: 'ドイツ', value: 54529 },
          { name: '日本', value: 43793 },
          { name: 'イギリス', value: 42648 },
          { name: 'インド', value: 41532 },
          { name: 'フランス', value: 35961 },
          { name: 'イタリア', value: 27382 },
          { name: 'ロシア', value: 26565 },
          { name: 'ブラジル', value: 26359 },
        ]},
      ],
    },
    {
      id: 'sekai-kuni-menseki',
      title: '世界の国土面積ランキング',
      category: 'chiri',
      unit: 'km²',
      source: '外務省（仮データ）',
      sourceUrl: 'https://www.mofa.go.jp/',
      updateFrequency: 'static',
      updatedAt: '2026-07-10',
      lead: '世界で最も国土面積が広いのはロシアで、約1,710万km²と2位カナダの1.7倍以上。上位50カ国・地域を掲載しており、50位タイでも51万km²を超える。',
      commentary: 'ロシア1か国で2位カナダとの差が700万km²を超え、上位10カ国の中で突出している。',
      analysis: [
        'ロシアの国土面積は17,098,242km²で、2位カナダ（9,984,670km²）の約1.7倍。1位と2位の差は7,113,572km²で、これは3位アメリカの国土面積（9,833,517km²）に近い大きさになる。',
        '上位10カ国のうち、南北アメリカ大陸の国はカナダ・アメリカ・ブラジル・アルゼンチンの4カ国、アジアは中国・インド・カザフスタンの3カ国。7位インド（3,287,263km²）と8位アルゼンチン（2,780,400km²）の間で面積の差が大きくなり、8位以下は300万km²を下回る。11位から50位までの40カ国のうち、アフリカの国が22カ国と半数以上を占める。',
      ],
      periods: [
        {
          period: null,
          entries: [
            {
              name: 'ロシア',
              value: 17098242,
            },
            {
              name: 'カナダ',
              value: 9984670,
            },
            {
              name: 'アメリカ',
              value: 9833517,
            },
            {
              name: '中国',
              value: 9596961,
            },
            {
              name: 'ブラジル',
              value: 8515767,
            },
            {
              name: 'オーストラリア',
              value: 7692024,
            },
            {
              name: 'インド',
              value: 3287263,
            },
            {
              name: 'アルゼンチン',
              value: 2780400,
            },
            {
              name: 'カザフスタン',
              value: 2724900,
            },
            {
              name: 'コンゴ民主共和国',
              value: 2389986,
            },
            {
              name: 'アルジェリア',
              value: 2381741,
            },
            {
              name: 'サウジアラビア',
              value: 2149690,
            },
            {
              name: 'メキシコ',
              value: 1964375,
            },
            {
              name: 'インドネシア',
              value: 1904569,
            },
            {
              name: 'スーダン',
              value: 1861484,
            },
            {
              name: 'リビア',
              value: 1759540,
            },
            {
              name: 'イラン',
              value: 1628750,
            },
            {
              name: 'モンゴル',
              value: 1564116,
            },
            {
              name: 'ペルー',
              value: 1285216,
            },
            {
              name: 'チャド',
              value: 1284000,
            },
            {
              name: 'ニジェール',
              value: 1267000,
            },
            {
              name: 'アンゴラ',
              value: 1246700,
            },
            {
              name: 'マリ',
              value: 1240192,
            },
            {
              name: '南アフリカ共和国',
              value: 1221037,
            },
            {
              name: 'コロンビア',
              value: 1141748,
            },
            {
              name: 'エチオピア',
              value: 1104300,
            },
            {
              name: 'ボリビア',
              value: 1098581,
            },
            {
              name: 'モーリタニア',
              value: 1030700,
            },
            {
              name: 'エジプト',
              value: 1001450,
            },
            {
              name: 'タンザニア',
              value: 945087,
            },
            {
              name: 'ナイジェリア',
              value: 923768,
            },
            {
              name: 'ベネズエラ',
              value: 916445,
            },
            {
              name: 'パキスタン',
              value: 881913,
            },
            {
              name: 'ナミビア',
              value: 824268,
            },
            {
              name: 'モザンビーク',
              value: 801590,
            },
            {
              name: 'トルコ',
              value: 783562,
            },
            {
              name: 'チリ',
              value: 756102,
            },
            {
              name: 'ザンビア',
              value: 752612,
            },
            {
              name: 'ミャンマー',
              value: 676886,
            },
            {
              name: 'アフガニスタン',
              value: 652864,
            },
            {
              name: '南スーダン',
              value: 644329,
            },
            {
              name: 'ソマリア',
              value: 637657,
            },
            {
              name: '中央アフリカ共和国',
              value: 622984,
            },
            {
              name: 'ウクライナ',
              value: 603500,
            },
            {
              name: 'マダガスカル',
              value: 587295,
            },
            {
              name: 'ボツワナ',
              value: 582000,
            },
            {
              name: 'ケニア',
              value: 581313,
            },
            {
              name: 'フランス',
              value: 551500,
            },
            {
              name: 'イエメン',
              value: 527968,
            },
            {
              name: 'タイ',
              value: 513120,
            },
          ],
        },
      ],
    },
    {
      id: 'kogyo-shunyu-eiga',
      title: '年間興行収入ランキング（映画）',
      category: 'sports',
      unit: '億円',
      source: '一般社団法人 日本映画製作者連盟（仮データ）',
      sourceUrl: 'https://www.eiren.org/',
      updateFrequency: 'yearly',
      updatedAt: '2026-01-05',
      lead: '2025年の年間興行収入は新作アニメ「劇場版アニメD」が首位を獲得。定番シリーズの名探偵コナン最新作を抑えての首位は近年珍しい。',
      commentary: '2025年は新作アニメが首位となり、定番シリーズだった前年首位作を上回った。',
      analysis: [
        '2024年の首位は「名探偵コナン最新作」（140億円）。2025年の首位は新作アニメ「劇場版アニメD」（155億円）で、「名探偵コナン最新作」は130億円で2位となった。',
        '3位は「劇場版アニメE」（95億円）で2025年に新規ランクインした。2024年に2位だった「ハリー・ポッターシリーズ再上映」（90億円）は、2025年は65億円で5位に下がった。',
      ],
      periods: [
        {
          period: '2024',
          entries: [
            {
              name: '名探偵コナン最新作',
              value: 140,
            },
            {
              name: 'ハリー・ポッターシリーズ再上映',
              value: 90,
            },
            {
              name: '劇場版アニメA',
              value: 85,
            },
            {
              name: 'ゴジラ最新作',
              value: 80,
            },
            {
              name: '実写邦画A',
              value: 60,
            },
            {
              name: 'ディズニーアニメ最新作',
              value: 55,
            },
            {
              name: '劇場版アニメB',
              value: 50,
            },
            {
              name: 'マーベル最新作',
              value: 48,
            },
            {
              name: '実写邦画B',
              value: 40,
            },
            {
              name: '劇場版アニメC',
              value: 35,
            },
          ],
        },
        {
          period: '2025',
          entries: [
            {
              name: '劇場版アニメD',
              value: 155,
            },
            {
              name: '名探偵コナン最新作',
              value: 130,
            },
            {
              name: '劇場版アニメE',
              value: 95,
            },
            {
              name: 'ゴジラ最新作',
              value: 70,
            },
            {
              name: 'ハリー・ポッターシリーズ再上映',
              value: 65,
            },
            {
              name: 'ディズニーアニメ最新作',
              value: 58,
            },
            {
              name: '実写邦画C',
              value: 50,
            },
            {
              name: 'マーベル最新作',
              value: 45,
            },
            {
              name: '劇場版アニメF',
              value: 42,
            },
            {
              name: '実写邦画D',
              value: 38,
            },
          ],
        },
      ],
    },
    {
      id: 'sekai-koso-biru',
      title: '世界の高い建造物ランキング',
      category: 'chiri',
      unit: 'm',
      source: '国土交通省 ほか（仮データ）',
      sourceUrl: 'https://www.mlit.go.jp/',
      updateFrequency: 'static',
      updatedAt: '2026-07-10',
      lead: '世界一高い建造物はブルジュ・ハリファ（アラブ首長国連邦・ドバイ、高さ828m）。2位メルデカ118（マレーシア、679m）に149mの差をつけている。',
      commentary: '上位10棟のうち7棟が中国・マレーシア・韓国など東アジア・東南アジアに集中している。',
      analysis: [
        'ブルジュ・ハリファの高さは828mで、2位メルデカ118（679m）との差は149m。3位上海中心大厦（632m）から10位天津周大福金融中心（530m）までは、隣接する順位間の差が最大42m（6位597m→7位555m）で、それ以外はおおむね30m以内に収まっている。',
        '9位広州周大福金融中心と10位天津周大福金融中心はともに530mで並ぶ。上位10棟のうち中国国内の建造物が上海・深圳・天津・広州の5棟を占め、韓国からはロッテワールドタワー（7位、555m）、マレーシアからはメルデカ118（2位）がランクインしている。',
      ],
      periods: [
        {
          period: null,
          entries: [
            {
              name: 'ブルジュ・ハリファ',
              value: 828,
            },
            {
              name: 'メルデカ118',
              value: 679,
            },
            {
              name: '上海中心大厦',
              value: 632,
            },
            {
              name: 'アブラージュ・アル・バイト時計塔',
              value: 601,
            },
            {
              name: '平安国際金融中心',
              value: 599,
            },
            {
              name: '高銀金融117',
              value: 597,
            },
            {
              name: 'ロッテワールドタワー',
              value: 555,
            },
            {
              name: 'ワン・ワールドトレードセンター',
              value: 541,
            },
            {
              name: '広州周大福金融中心',
              value: 530,
            },
            {
              name: '天津周大福金融中心',
              value: 530,
            },
          ],
        },
      ],
    },
    {
      id: 'todofuken-menseki',
      title: '都道府県別 面積ランキング',
      category: 'chiri',
      unit: 'km²',
      source: '国土地理院 全国都道府県市区町村別面積調（仮データ）',
      sourceUrl: 'https://www.gsi.go.jp/',
      updateFrequency: 'static',
      updatedAt: '2026-07-10',
      lead: '都道府県別の面積で最も広いのは北海道（約83,424km²）。2位岩手県の約5.5倍にあたり、上位10県は東北・中部地方が中心となっている。',
      commentary: '上位10県のうち東北地方が5県を占め、北海道が全体で突出して広い。',
      analysis: [
        '北海道の面積は83,424km²で、2位岩手県（15,275km²）の約5.5倍、10位鹿児島県（9,186km²）の約9倍にあたる。上位10県のうち、岩手県・福島県・秋田県・青森県・山形県の5県を東北地方が占める。',
        '3位福島県（13,784km²）・4位長野県（13,562km²）・5位新潟県（12,584km²）は差が1,000km²前後で並ぶ。最も面積が狭い都道府県は香川県（1,877km²）で、1位北海道との差は約81,500km²になる。',
      ],
      periods: [
        {
          period: null,
          entries: [
            {
              name: '北海道',
              value: 83424,
            },
            {
              name: '岩手県',
              value: 15275,
            },
            {
              name: '福島県',
              value: 13784,
            },
            {
              name: '長野県',
              value: 13562,
            },
            {
              name: '新潟県',
              value: 12584,
            },
            {
              name: '秋田県',
              value: 11638,
            },
            {
              name: '岐阜県',
              value: 10621,
            },
            {
              name: '青森県',
              value: 9646,
            },
            {
              name: '山形県',
              value: 9323,
            },
            {
              name: '鹿児島県',
              value: 9186,
            },
            {
              name: '広島県',
              value: 8478,
            },
            {
              name: '兵庫県',
              value: 8401,
            },
            {
              name: '静岡県',
              value: 7777,
            },
            {
              name: '宮崎県',
              value: 7734,
            },
            {
              name: '熊本県',
              value: 7409,
            },
            {
              name: '宮城県',
              value: 7282,
            },
            {
              name: '岡山県',
              value: 7114,
            },
            {
              name: '高知県',
              value: 7102,
            },
            {
              name: '島根県',
              value: 6708,
            },
            {
              name: '栃木県',
              value: 6408,
            },
            {
              name: '群馬県',
              value: 6362,
            },
            {
              name: '大分県',
              value: 6341,
            },
            {
              name: '山口県',
              value: 6113,
            },
            {
              name: '茨城県',
              value: 6098,
            },
            {
              name: '三重県',
              value: 5774,
            },
            {
              name: '愛媛県',
              value: 5676,
            },
            {
              name: '愛知県',
              value: 5173,
            },
            {
              name: '千葉県',
              value: 5156,
            },
            {
              name: '福岡県',
              value: 4988,
            },
            {
              name: '和歌山県',
              value: 4725,
            },
            {
              name: '京都府',
              value: 4612,
            },
            {
              name: '山梨県',
              value: 4465,
            },
            {
              name: '富山県',
              value: 4248,
            },
            {
              name: '福井県',
              value: 4191,
            },
            {
              name: '石川県',
              value: 4191,
            },
            {
              name: '徳島県',
              value: 4147,
            },
            {
              name: '長崎県',
              value: 4131,
            },
            {
              name: '滋賀県',
              value: 4017,
            },
            {
              name: '埼玉県',
              value: 3798,
            },
            {
              name: '奈良県',
              value: 3691,
            },
            {
              name: '鳥取県',
              value: 3507,
            },
            {
              name: '佐賀県',
              value: 2441,
            },
            {
              name: '神奈川県',
              value: 2417,
            },
            {
              name: '沖縄県',
              value: 2282,
            },
            {
              name: '東京都',
              value: 2200,
            },
            {
              name: '大阪府',
              value: 1905,
            },
            {
              name: '香川県',
              value: 1877,
            },
          ],
        },
      ],
    },
    {
      id: 'sekai-mizuumi-menseki',
      title: '世界の湖の面積ランキング',
      category: 'chiri',
      unit: 'km²',
      source: '国土地理院 ほか（仮データ）',
      sourceUrl: 'https://www.gsi.go.jp/',
      updateFrequency: 'static',
      updatedAt: '2026-07-10',
      lead: '世界最大の湖はカスピ海で、面積は約374,000km²と日本の国土面積とほぼ同じ大きさ。2位スペリオル湖の4.5倍以上あり、単独で突出している。',
      commentary: 'カスピ海は塩湖で、上位10湖のうち淡水湖は9湖。北米の五大湖からはスペリオル湖・ヒューロン湖・ミシガン湖の3湖がランクインしている。',
      analysis: [
        'カスピ海の面積は374,000km²で、2位スペリオル湖（82,400km²）の4.5倍以上。カスピ海は塩湖で、2位以下の9湖はいずれも淡水湖にあたる。',
        'アフリカからはビクトリア湖（3位、68,800km²）・タンガニーカ湖（6位、32,900km²）・マラウイ湖（9位、29,600km²）の3湖が、北米からはスペリオル湖（2位）・ヒューロン湖（4位、59,600km²）・ミシガン湖（5位、57,800km²）・グレートベア湖（8位、31,000km²）・グレートスレーブ湖（10位、27,200km²）の5湖がランクインしている。',
      ],
      periods: [
        {
          period: null,
          entries: [
            {
              name: 'カスピ海',
              value: 374000,
            },
            {
              name: 'スペリオル湖',
              value: 82400,
            },
            {
              name: 'ビクトリア湖',
              value: 68800,
            },
            {
              name: 'ヒューロン湖',
              value: 59600,
            },
            {
              name: 'ミシガン湖',
              value: 57800,
            },
            {
              name: 'タンガニーカ湖',
              value: 32900,
            },
            {
              name: 'バイカル湖',
              value: 31500,
            },
            {
              name: 'グレートベア湖',
              value: 31000,
            },
            {
              name: 'マラウイ湖',
              value: 29600,
            },
            {
              name: 'グレートスレーブ湖',
              value: 27200,
            },
          ],
        },
      ],
    },
    {
      id: 'yushutsugaku-kuni',
      title: '国・地域別 輸出額ランキング',
      category: 'keizai',
      unit: '億円',
      source: '財務省 貿易統計（仮データ）',
      sourceUrl: 'https://www.customs.go.jp/toukei/',
      updateFrequency: 'yearly',
      updatedAt: '2026-05-20',
      lead: '2025年の輸出額で米国が中国を逆転し首位に浮上。長年続いた中国トップの構図が崩れた。',
      commentary: '長年首位だった中国を米国が上回り、2025年は輸出額トップが入れ替わった。',
      analysis: [
        '米国は190,000億円で前年比+8.6%、中国は170,000億円で前年比-5.6%。2024年は中国180,000億円・米国175,000億円だったが、2025年は米国が中国を上回った。',
        '台湾は63,000億円（前年比+8.6%）で、韓国の60,000億円（前年比-3.2%）を上回り3位に入った。上位10カ国・地域の顔ぶれは2年とも変わらず、香港・タイ・ベトナム・ドイツ・シンガポール・オーストラリアが4位以下に並んだ。',
      ],
      periods: [
        {
          period: '2024',
          entries: [
            {
              name: '中国',
              value: 180000,
            },
            {
              name: '米国',
              value: 175000,
            },
            {
              name: '韓国',
              value: 62000,
            },
            {
              name: '台湾',
              value: 58000,
            },
            {
              name: '香港',
              value: 42000,
            },
            {
              name: 'タイ',
              value: 38000,
            },
            {
              name: 'ドイツ',
              value: 25000,
            },
            {
              name: 'シンガポール',
              value: 24000,
            },
            {
              name: 'ベトナム',
              value: 22000,
            },
            {
              name: 'オーストラリア',
              value: 20000,
            },
          ],
        },
        {
          period: '2025',
          entries: [
            {
              name: '米国',
              value: 190000,
            },
            {
              name: '中国',
              value: 170000,
            },
            {
              name: '台湾',
              value: 63000,
            },
            {
              name: '韓国',
              value: 60000,
            },
            {
              name: '香港',
              value: 44000,
            },
            {
              name: 'タイ',
              value: 40000,
            },
            {
              name: 'ベトナム',
              value: 26000,
            },
            {
              name: 'ドイツ',
              value: 24000,
            },
            {
              name: 'シンガポール',
              value: 23000,
            },
            {
              name: 'オーストラリア',
              value: 21000,
            },
          ],
        },
      ],
    },
    {
      id: 'sekai-shima-menseki',
      title: '世界の島の面積ランキング',
      category: 'chiri',
      unit: 'km²',
      source: '国土地理院 ほか（仮データ）',
      sourceUrl: 'https://www.gsi.go.jp/',
      updateFrequency: 'static',
      updatedAt: '2026-07-10',
      lead: '世界最大の島はグリーンランドで、面積は約2,166,000km²。2位ニューギニア島の2.8倍近くあり、日本の国土面積の5.7倍にあたる。上位30島を掲載しており、日本からは本州（7位）と北海道（21位）がランクインしている。',
      commentary: '上位10島のうち7位に日本の本州（227,970km²）がランクインしている。',
      analysis: [
        'グリーンランドの面積は2,166,000km²で、2位ニューギニア島（785,753km²）の約2.8倍。ニューギニア島と3位ボルネオ島（743,330km²）の差は42,423km²で、隣接する順位間の差としては小さい部類に入る。',
        '本州は227,970km²で世界の島の中で7位。6位スマトラ島（473,481km²）との差は245,511km²ある一方、8位ヴィクトリア島（217,291km²）との差は10,679km²と僅差になっている。日本の島では北海道（78,073km²）も21位に入り、日本から2島がランクインしている。',
      ],
      periods: [
        {
          period: null,
          entries: [
            {
              name: 'グリーンランド',
              value: 2166000,
            },
            {
              name: 'ニューギニア島',
              value: 785753,
            },
            {
              name: 'ボルネオ島',
              value: 743330,
            },
            {
              name: 'マダガスカル島',
              value: 587041,
            },
            {
              name: 'バフィン島',
              value: 507451,
            },
            {
              name: 'スマトラ島',
              value: 473481,
            },
            {
              name: '本州（日本）',
              value: 227970,
            },
            {
              name: 'ヴィクトリア島',
              value: 217291,
            },
            {
              name: 'グレートブリテン島',
              value: 209331,
            },
            {
              name: 'エルズミーア島',
              value: 196236,
            },
            {
              name: 'スラウェシ島',
              value: 174600,
            },
            {
              name: '南島（ニュージーランド）',
              value: 151215,
            },
            {
              name: 'ジャワ島',
              value: 126700,
            },
            {
              name: '北島（ニュージーランド）',
              value: 113729,
            },
            {
              name: 'ニューファンドランド島',
              value: 111390,
            },
            {
              name: 'キューバ島',
              value: 105007,
            },
            {
              name: 'ルソン島',
              value: 104688,
            },
            {
              name: 'アイスランド島',
              value: 102828,
            },
            {
              name: 'ミンダナオ島',
              value: 94630,
            },
            {
              name: 'アイルランド島',
              value: 84406,
            },
            {
              name: '北海道',
              value: 78073,
            },
            {
              name: '樺太',
              value: 76400,
            },
            {
              name: 'イスパニョーラ島',
              value: 74700,
            },
            {
              name: 'バンクス島',
              value: 70028,
            },
            {
              name: 'セイロン島',
              value: 65268,
            },
            {
              name: 'タスマニア島',
              value: 60637,
            },
            {
              name: 'デヴォン島',
              value: 55247,
            },
            {
              name: 'セヴェルヌィ島',
              value: 48904,
            },
            {
              name: 'フエゴ島',
              value: 47992,
            },
            {
              name: 'バークナー島',
              value: 43873,
            },
          ],
        },
      ],
    },
    {
      id: 'jinko-todofuken',
      title: '都道府県別 人口ランキング',
      category: 'jinko',
      unit: '万人',
      source: '総務省 人口推計（仮データ）',
      sourceUrl: 'https://www.stat.go.jp/',
      updateFrequency: 'yearly',
      updatedAt: '2026-04-10',
      lead: '2025年、福岡県が北海道を上回り人口ランキング8位に浮上。上位の顔ぶれは変わらないが、下位で静かな入れ替わりが起きている。',
      commentary: '上位は東京・神奈川・大阪が固定的だが、8位・9位では福岡県が北海道を上回り順位が入れ替わった。',
      analysis: [
        '上位7都府県（東京・神奈川・大阪・愛知・埼玉・千葉・兵庫）は2年連続で顔ぶれ・順位ともに変わらず、増減率はいずれも±1%未満だった。',
        '8位・9位では、2024年に北海道・福岡県がともに512万人で並んでいたのに対し、2025年は福岡県511万人・北海道505万人となり、福岡県が北海道を上回って8位に入った。',
      ],
      periods: [
        {
          period: '2024',
          entries: [
            {
              name: '東京都',
              value: 1400,
            },
            {
              name: '神奈川県',
              value: 923,
            },
            {
              name: '大阪府',
              value: 880,
            },
            {
              name: '愛知県',
              value: 750,
            },
            {
              name: '埼玉県',
              value: 734,
            },
            {
              name: '千葉県',
              value: 628,
            },
            {
              name: '兵庫県',
              value: 546,
            },
            {
              name: '北海道',
              value: 512,
            },
            {
              name: '福岡県',
              value: 512,
            },
            {
              name: '静岡県',
              value: 360,
            },
          ],
        },
        {
          period: '2025',
          entries: [
            {
              name: '東京都',
              value: 1408,
            },
            {
              name: '神奈川県',
              value: 920,
            },
            {
              name: '大阪府',
              value: 875,
            },
            {
              name: '愛知県',
              value: 748,
            },
            {
              name: '埼玉県',
              value: 736,
            },
            {
              name: '千葉県',
              value: 627,
            },
            {
              name: '兵庫県',
              value: 542,
            },
            {
              name: '福岡県',
              value: 511,
            },
            {
              name: '北海道',
              value: 505,
            },
            {
              name: '静岡県',
              value: 357,
            },
          ],
        },
      ],
    },
    {
      id: 'sekai-takai-yama',
      title: '世界の山の高さランキング',
      category: 'chiri',
      unit: 'm',
      source: '国土地理院 ほか（仮データ）',
      sourceUrl: 'https://www.gsi.go.jp/',
      updateFrequency: 'static',
      updatedAt: '2026-01-15',
      lead: '世界最高峰エベレストを筆頭に、上位10座はすべてヒマラヤ・カラコルム山系が独占。標高8,000mを超える山は世界に14座しかなく、その全座を掲載している。',
      commentary: '上位10座はすべてヒマラヤ・カラコルム山系。世界の8,000m峰は全部で14座のみ。',
      analysis: [
        '標高8,000mを超える山（8000m峰）は世界に14座しかなく、いずれもヒマラヤ・カラコルム山系に位置する。このランキングは、その14座すべてを収録している。',
        '1位エベレスト（8,849m）と2位K2（8,611m）の差は238m。3位カンチェンジュンガ（8,586m）から10位アンナプルナI峰（8,091m）までは、5位マカルー（8,485m）と6位チョー・オユー（8,188m）の間の297m差を除き、隣接する順位間の差はおおむね100m未満で並ぶ。14座中もっとも標高が低いのは14位シシャパンマ（8,027m）で、1位エベレストとの差は822mになる。',
      ],
      periods: [
        {
          period: null,
          entries: [
            {
              name: 'エベレスト',
              value: 8849,
            },
            {
              name: 'K2',
              value: 8611,
            },
            {
              name: 'カンチェンジュンガ',
              value: 8586,
            },
            {
              name: 'ローツェ',
              value: 8516,
            },
            {
              name: 'マカルー',
              value: 8485,
            },
            {
              name: 'チョー・オユー',
              value: 8188,
            },
            {
              name: 'ダウラギリI峰',
              value: 8167,
            },
            {
              name: 'マナスル',
              value: 8163,
            },
            {
              name: 'ナンガ・パルバット',
              value: 8126,
            },
            {
              name: 'アンナプルナI峰',
              value: 8091,
            },
            {
              name: 'ガッシャーブルムI峰',
              value: 8080,
            },
            {
              name: 'ブロード・ピーク',
              value: 8051,
            },
            {
              name: 'ガッシャーブルムII峰',
              value: 8035,
            },
            {
              name: 'シシャパンマ',
              value: 8027,
            },
          ],
        },
      ],
    },
    {
      id: 'gyokakuryo-todofuken',
      title: '都道府県別 漁獲量ランキング',
      category: 'keizai',
      unit: 'トン',
      source: '農林水産省 漁業・養殖業生産統計（仮データ）',
      sourceUrl: 'https://www.maff.go.jp/',
      updateFrequency: 'yearly',
      updatedAt: '2026-06-01',
      lead: '2025年、都道府県別の漁獲量で3位の茨城県を三重県が猛追。北海道の一強は変わらないが、中位の顔ぶれに動きが出ている。',
      commentary: '北海道が全体の3割前後を占め例年首位。近年は長崎県が三重県・宮城県を抜いて2位に浮上する動きが見える。',
      analysis: [
        '北海道・長崎県・茨城県のTOP3は2年連続で同じ顔ぶれ。北海道は810,000トンで前年の850,000トンから4.7%減少、長崎県は340,000トンで前年比+6.3%、茨城県は275,000トンで前年比-1.8%だった。',
        '三重県は190,000トンで前年比+15.2%となり、6位から5位に順位を上げた。宮城県は175,000トンで前年比-2.8%となり5位から6位に下がった。10位には鹿児島県（125,000トン）が新たに入り、前年10位だった福岡県（120,000トン）はTOP10から外れた。',
      ],
      periods: [
        {
          period: '2024',
          entries: [
            {
              name: '北海道',
              value: 850000,
            },
            {
              name: '長崎県',
              value: 320000,
            },
            {
              name: '茨城県',
              value: 280000,
            },
            {
              name: '静岡県',
              value: 210000,
            },
            {
              name: '宮城県',
              value: 180000,
            },
            {
              name: '三重県',
              value: 165000,
            },
            {
              name: '千葉県',
              value: 150000,
            },
            {
              name: '愛媛県',
              value: 140000,
            },
            {
              name: '島根県',
              value: 130000,
            },
            {
              name: '福岡県',
              value: 120000,
            },
          ],
        },
        {
          period: '2025',
          entries: [
            {
              name: '北海道',
              value: 810000,
            },
            {
              name: '長崎県',
              value: 340000,
            },
            {
              name: '茨城県',
              value: 275000,
            },
            {
              name: '静岡県',
              value: 205000,
            },
            {
              name: '三重県',
              value: 190000,
            },
            {
              name: '宮城県',
              value: 175000,
            },
            {
              name: '千葉県',
              value: 155000,
            },
            {
              name: '島根県',
              value: 138000,
            },
            {
              name: '愛媛県',
              value: 132000,
            },
            {
              name: '鹿児島県',
              value: 125000,
            },
          ],
        },
      ],
    },
    {
      id: 'nihon-nagai-kawa',
      title: '日本の川の長さランキング',
      category: 'chiri',
      unit: 'km',
      source: '国土交通省（仮データ）',
      sourceUrl: 'https://www.mlit.go.jp/',
      updateFrequency: 'static',
      updatedAt: '2026-01-15',
      lead: '日本最長の川は信濃川。長野県では「千曲川」と呼ばれ、新潟県に入って名前を変える。流域面積で国内最大なのは2位の利根川。',
      commentary: '信濃川が長野・新潟をまたいで日本最長。2位の利根川は流域面積では国内最大を誇る。',
      analysis: [
        '1位の信濃川は367km、2位の利根川は322kmで、差は45km。利根川の流域面積は日本最大だが、河川の長さでは信濃川が上回る。',
        '上位10河川は北海道（石狩川・天塩川）、東北（北上川・阿武隈川・最上川）、中部（木曽川・天竜川）などに分布する。3位以降は3位石狩川（268km）から10位阿賀野川（210km）までの範囲に収まる。',
      ],
      periods: [
        {
          period: null,
          entries: [
            {
              name: '信濃川',
              value: 367,
            },
            {
              name: '利根川',
              value: 322,
            },
            {
              name: '石狩川',
              value: 268,
            },
            {
              name: '天塩川',
              value: 256,
            },
            {
              name: '北上川',
              value: 249,
            },
            {
              name: '阿武隈川',
              value: 239,
            },
            {
              name: '最上川',
              value: 229,
            },
            {
              name: '木曽川',
              value: 227,
            },
            {
              name: '天竜川',
              value: 213,
            },
            {
              name: '阿賀野川',
              value: 210,
            },
          ],
        },
      ],
    },
    {
      id: 'nihon-yama-takasa',
      title: '日本の山の高さランキング',
      category: 'chiri',
      unit: 'm',
      source: '国土地理院（仮データ）',
      sourceUrl: 'https://www.gsi.go.jp/',
      updateFrequency: 'static',
      updatedAt: '2026-07-10',
      lead: '日本一高い山は富士山（3,776m）で、2位北岳との差は583m。上位20座を掲載しており、富士山を除く19座はすべて南アルプス・北アルプスに集中している。',
      commentary: '富士山だけが単独峰で突出しており、2位以下はすべて南・北アルプスに位置する。',
      analysis: [
        '富士山の標高は3,776mで、2位北岳（3,193m）との差は583m。2位以下は標高3,000mを超える山が19座続き、南アルプス（北岳・間ノ岳・悪沢岳・赤石岳など）と北アルプス（奥穂高岳・槍ヶ岳・穂高連峰など）が上位を占める。',
        '3位奥穂高岳と4位間ノ岳はいずれも標高3,190mで並ぶ。上位20座のうち富士山を除く19座は、2位北岳（3,193m）から20位立山（3,015m）まで標高差が178mの範囲に収まっている。',
      ],
      periods: [
        {
          period: null,
          entries: [
            {
              name: '富士山',
              value: 3776,
            },
            {
              name: '北岳',
              value: 3193,
            },
            {
              name: '奥穂高岳',
              value: 3190,
            },
            {
              name: '間ノ岳',
              value: 3190,
            },
            {
              name: '槍ヶ岳',
              value: 3180,
            },
            {
              name: '悪沢岳',
              value: 3141,
            },
            {
              name: '赤石岳',
              value: 3121,
            },
            {
              name: '涸沢岳',
              value: 3110,
            },
            {
              name: '北穂高岳',
              value: 3106,
            },
            {
              name: '大喰岳',
              value: 3101,
            },
            {
              name: '前穂高岳',
              value: 3090,
            },
            {
              name: '中岳（北アルプス）',
              value: 3084,
            },
            {
              name: '中岳（荒川中岳）',
              value: 3084,
            },
            {
              name: '御嶽山',
              value: 3067,
            },
            {
              name: '農鳥岳',
              value: 3051,
            },
            {
              name: '塩見岳',
              value: 3047,
            },
            {
              name: '南岳',
              value: 3033,
            },
            {
              name: '仙丈ヶ岳',
              value: 3033,
            },
            {
              name: '乗鞍岳',
              value: 3026,
            },
            {
              name: '立山',
              value: 3015,
            },
          ],
        },
      ],
    },
  ],
};
