# integration-zoom-to-salesforce

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run dist/index.js

# local development
bun run src/index.js
ngrok http http://localhost:3000
```

This project was created using `bun init` in bun v1.2.2. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.

## Zoom API 機能

このプロジェクトは、Zoom の API を使用して以下の機能を提供します：

- ユーザーのミーティング一覧取得
- 過去のミーティング詳細取得
- ミーティングサマリー取得

### ミーティングサマリー取得の流れ

ミーティングサマリーを取得するには、以下の 3 ステップで行います：

1. **ユーザーのミーティング一覧を取得**

   ```
   GET /api/users/:userId/meetings
   ```

   または現在認証されているユーザーの場合：

   ```
   GET /api/meetings
   ```

   クエリパラメータ：

   - `type`: ミーティングタイプ（'scheduled'、'live'、'upcoming'など）
   - `pageSize`: 1 ページあたりの結果数
   - `pageNumber`: ページ番号

   レスポンス例：

   ```json
   {
     "page_count": 1,
     "page_number": 1,
     "page_size": 30,
     "total_records": 2,
     "meetings": [
       {
         "id": 123456789,
         "topic": "テストミーティング",
         "uuid": "abcd1234==",
         "start_time": "2025-05-01T10:00:00Z",
         ...
       },
       ...
     ]
   }
   ```

2. **過去のミーティング詳細を取得**

   ```
   GET /api/past_meetings/:meetingId
   ```

   注意：

   - ミーティングが終了している必要があります
   - 1 年以上前のミーティングにはアクセスできません
   - `/`で始まるか`//`を含む UUID の場合は自動的に二重エンコードされます

   レスポンス例：

   ```json
   {
     "uuid": "abcd1234==",
     "id": 123456789,
     "host_id": "user123",
     "topic": "テストミーティング",
     ...
   }
   ```

3. **ミーティングサマリーを取得**

   ```
   GET /api/meetings/:meetingUuid/summary
   ```

   注意：

   - ミーティング UUID は自動的にエンコードされます

   レスポンス例：

   ```json
   {
     "uuid": "abcd1234==",
     "id": 123456789,
     "topic": "テストミーティング",
     "summary": {
       "total_minutes": 60,
       "participant_count": 5,
       "chapters": [...],
       "summary_text": "ミーティングの要約テキスト..."
     }
   }
   ```

### 使用例

```bash
# 1. 現在認証されているユーザーのミーティング一覧を取得
curl -X GET "http://localhost:3000/api/meetings?type=previous_meetings"

# 2. 過去のミーティング詳細を取得（ステップ1で取得したミーティングIDを使用）
curl -X GET "http://localhost:3000/api/past_meetings/123456789"

# 3. ミーティングサマリーを取得（ステップ2で取得したUUIDを使用）
curl -X GET "http://localhost:3000/api/meetings/abcd1234==/summary"
```

## Docker Compose を使用したローカル開発

Docker Compose を使用してローカル開発環境を起動するには、以下のコマンドを実行します：

```bash
# Docker Composeでアプリケーションを起動
docker-compose up

# バックグラウンドで起動する場合
docker-compose up -d

# ログを表示
docker-compose logs -f

# アプリケーションを停止
docker-compose down
```

アプリケーションは http://localhost:3000 でアクセスできます。

## AWS へのデプロイ

このプロジェクトは Terraform と Docker を使用して AWS にデプロイできます。デプロイには以下のリソースが使用されます：

- API Gateway: HTTP リクエストを受け付けるエンドポイント
- Lambda: アプリケーションコードを実行する環境
- Parameter Store: 環境変数を安全に保存するためのサービス
- ECR: Docker イメージを保存するリポジトリ

### デプロイ手順

1. **AWS の認証情報を設定**

   ```bash
   aws configure
   ```

2. **Terraform の初期化**

   ```bash
   cd terraform
   terraform init
   ```

3. **Terraform の実行計画を確認**

   ```bash
   terraform plan -var-file=dev.tfvars
   ```

   注意: `dev.tfvars`ファイルを作成して、必要な変数を設定する必要があります。

4. **Terraform を適用してインフラを作成**

   ```bash
   terraform apply -var-file="dev.tfvars"
   ```

5. **Docker イメージをビルドしてプッシュ**

   ```bash
   # change dirctry to terraform
   # ECRにログイン
   aws ecr get-login-password --region ap-northeast-1 | docker login --username AWS --password-stdin $(terraform output -raw ecr_repository_url)

   # Dockerイメージをビルド
   docker build --platform=linux/amd64 -t zoom-salesforce-integration:latest -f ../docker/Dockerfile .

   # イメージにタグを付ける
   docker tag zoom-salesforce-integration:latest $(terraform output -raw ecr_repository_url):latest

   # イメージをプッシュ
   docker push $(terraform output -raw ecr_repository_url):latest
   ```

6. **Lambda を更新**

   ```bash
   aws lambda update-function-code \
     --function-name $(terraform output -raw lambda_function_name) \
     --image-uri $(terraform output -raw ecr_repository_url):latest
   ```

7. **デプロイされた API の URL を確認**

   ```bash
   terraform output api_gateway_url
   terraform output webhook_url
   ```

### リソースの削除

プロジェクトのリソースを削除するには、以下のコマンドを実行します：

```bash
terraform destroy -var-file="dev.tfvars"
```

## 注意事項

- Parameter Store に保存される機密情報は、適切な IAM ポリシーで保護されています。
- Lambda の実行ロールには、Parameter Store からの読み取り権限のみが付与されています。
- 本番環境では、より厳格なセキュリティ設定を行うことをお勧めします。
