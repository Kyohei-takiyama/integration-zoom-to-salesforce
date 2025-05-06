# Stage 1: ビルドステージ (Bunを使用)
FROM oven/bun:1 as builder

WORKDIR /app

COPY package.json bun.lock ./
# ロックファイルに基づいて依存関係をインストール (CI/CD向け)
# ローカル開発でロックファイルがない場合は `bun install` でも可
RUN bun install --frozen-lockfile

# ソースコードと設定ファイルをコピー
COPY src ./src
COPY tsconfig.json ./

# TypeScriptをNode.jsランタイム用のJavaScriptにビルド
# --target=node を指定し、依存関係もバンドルする (デフォルト)
RUN bun build ./src/index.ts --outdir ./dist --target=node

# ---

FROM public.ecr.aws/lambda/nodejs:20

# Lambda関数コードの配置場所 (Lambda環境変数)
WORKDIR ${LAMBDA_TASK_ROOT}

# ビルドステージから生成されたJavaScriptコードのみをコピー
# dist ディレクトリに必要なものがすべてバンドルされている想定
COPY --from=builder /app/dist ./dist

# Lambda関数ハンドラを指定
CMD [ "dist/index.handler" ]