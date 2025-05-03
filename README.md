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
