"""リポジトリルートの .env ファイルを読み、os.environ に反映する（追加パッケージ不要の簡易実装）。
.env は .gitignore 済み。既に環境変数として設定されている値は上書きしない。
"""
import os

ENV_PATH = os.path.join(os.path.dirname(__file__), '..', '.env')


def load_dotenv(path=ENV_PATH):
    if not os.path.exists(path):
        return
    with open(path, encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#') or '=' not in line:
                continue
            key, _, value = line.partition('=')
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if key and key not in os.environ:
                os.environ[key] = value
