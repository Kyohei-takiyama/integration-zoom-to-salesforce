# ビルドステージ
FROM oven/bun:1 as builder

WORKDIR /app

# 依存関係ファイルをコピー
COPY package.json bun.lock* package-lock.json* ./

# 依存関係をインストール
RUN bun install

# ソースコードをコピー
COPY . .

# TypeScriptをビルド
RUN bun run build

# 実行ステージ
FROM public.ecr.aws/lambda/nodejs:18

# 必要なパッケージをインストール
RUN yum install -y unzip

# Bunをインストール
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:${PATH}"

WORKDIR ${LAMBDA_TASK_ROOT}

# ビルドステージから必要なファイルをコピー
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# Lambda用のエントリーポイントを作成（ESモジュール形式）
COPY docker/lambda.mjs ./

# AWS SDKをインストール（Parameter Storeからの環境変数取得用）
RUN npm install aws-sdk

# Lambda関数ハンドラーを設定（.mjsファイルを使用）
CMD [ "lambda.mjs.handler" ]