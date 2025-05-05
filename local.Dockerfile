FROM oven/bun:1

WORKDIR /app

# 依存関係ファイルをコピー
COPY package.json bun.lock* package-lock.json* ./

# 依存関係をインストール
RUN bun install

# ソースコードはボリュームマウントされるため、ここではコピーしない

# アプリケーションのポートを公開
EXPOSE 3000

# 開発モードで実行
CMD ["bun", "run", "dev"]