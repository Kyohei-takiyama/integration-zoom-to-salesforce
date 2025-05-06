# ./local.Dockerfile

FROM oven/bun:1

WORKDIR /app

# 依存関係ファイルをコピー
COPY package.json bun.lock ./
# package-lock.json* は Bun では通常不要

# 依存関係をインストール (devDependencies も含むデフォルトの動作)
RUN bun install

# ソースコードはボリュームマウントされるため、ここではコピーしない

# アプリケーションがリッスンするポート (ドキュメント目的)
EXPOSE 3000

# デフォルトコマンド (docker-compose.yml で上書きされる)
# CMD ["bun", "run", "dev"]