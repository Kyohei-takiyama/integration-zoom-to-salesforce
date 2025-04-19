// src/handlers/zoomWebhookHandler.ts
import { Context } from "hono";
import { env } from "../config/env";
import { handleZoomWebhookValidation } from "../lib/verifyZoomWebhook";
import { downloadTranscriptText } from "../services/zoomService";
import {
  findSalesforceEventByZoomUuid,
  updateSalesforceEvent,
} from "../services/salesforceService";
// 必要に応じてZoomの型定義をインポート
// import { ZoomRecordingCompletedPayload } from '../types/zoom';

export async function handleZoomWebhook(c: Context) {
  const payload = c.get("parsedBody"); // verifyZoomWebhookミドルウェアで設定されたパース済みボディ

  // 1. 初回URL検証リクエストの処理
  const validationResponse = handleZoomWebhookValidation(payload);
  if (validationResponse) {
    return c.json(validationResponse, 200);
  }

  // 2. イベントタイプが recording.completed または recording.transcript_completed かチェック
  const eventType = payload?.event;
  console.log(`Received Zoom Webhook event: ${eventType}`);

  if (
    eventType !== "recording.completed" &&
    eventType !== "recording.transcript_completed"
  ) {
    console.log(`Ignoring event type: ${eventType}`);
    return c.json({ message: "Event type not supported" }, 200); // Zoomは2xxレスポンスを期待
  }

  // 型ガードやバリデーションを追加するとより安全
  // const parsedPayload = ZoomRecordingPayloadSchema.safeParse(payload);
  // if (!parsedPayload.success) { ... }
  const meetingUuid = payload?.payload?.object?.uuid;
  const recordingFiles = payload?.payload?.object?.recording_files;
  const shareUrl = payload?.payload?.object?.share_url; // 録画共有URL
  const recordingPasscode = payload?.payload?.object?.recording_play_passcode; // パスコード

  if (!meetingUuid || !recordingFiles) {
    console.error(
      "Invalid payload: Missing meeting UUID or recording files.",
      payload
    );
    return c.json({ message: "Invalid payload structure" }, 400);
  }

  console.log(`Processing recording for Meeting UUID: ${meetingUuid}`);

  // 3. Salesforce Eventを検索
  const eventId = await findSalesforceEventByZoomUuid(meetingUuid);
  if (!eventId) {
    // 対応するイベントが見つからない場合の処理 (ログ記録、無視など)
    console.warn(
      `No matching Salesforce Event found for meeting ${meetingUuid}. Skipping update.`
    );
    // ここで処理を中断してもZoomには成功(200)を返すのが一般的
    return c.json({ message: "Salesforce event not found" }, 200);
  }

  // 4. 更新データの準備
  const updateData: { [key: string]: string | null } = {};

  // 4.1 録画URL (+パスコード)
  let recordingLink = shareUrl;
  if (shareUrl && recordingPasscode) {
    recordingLink = `${shareUrl}?pwd=${recordingPasscode}`; // パスコードを付与
  }
  if (recordingLink) {
    updateData[env.SALESFORCE_RECORDING_URL_FIELD] = recordingLink;
  }

  // 4.2 トランスクリプト処理 (ファイルがあれば)
  let transcriptText: string | null = null;
  const transcriptFile = recordingFiles.find(
    (file: any) =>
      file.file_type === "TRANSCRIPT" && file.status === "completed"
  );

  if (transcriptFile?.download_url && env.SALESFORCE_TRANSCRIPT_FIELD) {
    try {
      console.log("Transcript file found, attempting download...");
      transcriptText = await downloadTranscriptText(
        transcriptFile.download_url
      );
      updateData[env.SALESFORCE_TRANSCRIPT_FIELD] = transcriptText.substring(
        0,
        32000
      ); // Salesforceのロングテキストエリア上限考慮
      console.log("Transcript successfully processed.");
    } catch (error: any) {
      console.error(
        `Failed to download or process transcript for meeting ${meetingUuid}:`,
        error.message
      );
      // トランスクリプト取得失敗時の処理 (ログのみ、など)
      // エラーが発生しても他のデータは更新を試みる
    }
  } else if (
    eventType === "recording.completed" &&
    env.SALESFORCE_TRANSCRIPT_FIELD
  ) {
    console.log(
      "Transcript file not found in recording.completed payload. It might arrive later via recording.transcript_completed event."
    );
    // 必要であれば、ここで状態を保存しておき、transcript_completed イベントで更新するなどの処理を追加
  }

  // 5. Salesforce Eventの更新
  if (Object.keys(updateData).length > 0) {
    try {
      const updateResult = await updateSalesforceEvent(eventId, updateData);
      if (updateResult.success) {
        console.log(
          `Successfully updated Salesforce Event ${eventId} for meeting ${meetingUuid}.`
        );
        return c.json(
          { message: "Salesforce Event updated successfully" },
          200
        );
      } else {
        console.error(
          `Failed to update Salesforce Event ${eventId}. Errors:`,
          updateResult.errors
        );
        // 失敗した場合でもZoomには成功を返すか、エラーを返すか検討。
        // リトライ可能なエラーなら5xxを返してZoomに再送させることも考えられるが、無限ループに注意。
        return c.json({ message: "Failed to update Salesforce Event" }, 500); // 例: 内部エラー
      }
    } catch (error: any) {
      console.error(
        `Unhandled error during Salesforce update for event ${eventId}:`,
        error.message
      );
      return c.json(
        { message: "Internal server error during Salesforce update" },
        500
      );
    }
  } else {
    console.log(`No data to update for Salesforce Event ${eventId}.`);
    return c.json({ message: "No data needed update" }, 200);
  }
}
