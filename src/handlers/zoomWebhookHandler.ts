// src/handlers/zoomWebhookHandler.ts
import { Context } from "hono";
import { env } from "../config/env";
import { handleZoomWebhookValidation } from "../lib/verifyZoomWebhook";
import { getSalesforceConnection } from "../lib/salesforceAuth";
import {
  downloadTranscriptText,
  getMeetingSummary,
} from "../services/zoomService";
import {
  findOpportunityById,
  createSalesforceEvent,
  findEventByZoomUuid,
  EventData,
} from "../services/salesforceService";
import { formatISO, addMinutes } from "date-fns"; // 日付操作ライブラリの例

/**
 * Zoomのトピック名からSalesforce商談IDを抽出する
 * @param topic Zoomミーティングのトピック
 * @returns 抽出された商談ID、見つからなければnull
 */
function extractOpportunityIdFromTopic(
  topic: string | undefined | null
): string | null {
  if (!topic) return null;

  try {
    const regex = new RegExp(env.SALESFORCE_OPPORTUNITY_ID_REGEX);
    const match = topic.match(regex);
    if (match && match[1]) {
      // match[1] にキャプチャされたIDが入る想定
      console.log(
        `Extracted Opportunity ID: ${match[1]} from topic: "${topic}"`
      );
      return match[1];
    }
    // console.log(`Opportunity ID pattern not found in topic: "${topic}" with regex: ${env.SALESFORCE_OPPORTUNITY_ID_REGEX}`);
    return null;
  } catch (e) {
    console.error(`Error applying regex to topic "${topic}":`, e);
    return null;
  }
}

/**
 * Zoomの日時と期間から終了日時を計算する
 * @param startTimeIso Zoomの開始日時 (ISO形式)
 * @param durationMinutes Zoomの期間 (分)
 * @returns 終了日時 (ISO形式)
 */
function calculateEndDateTime(
  startTimeIso: string | undefined | null,
  durationMinutes: number | undefined | null
): string | null {
  if (!startTimeIso) return null;
  try {
    const startDate = new Date(startTimeIso);
    const duration = durationMinutes ?? env.SALESFORCE_EVENT_DURATION_MINUTES; // デフォルト期間を使用
    const endDate = addMinutes(startDate, duration);
    return formatISO(endDate); // Salesforceが受け付けるISO 8601形式 (例: 2023-10-27T10:00:00.000Z)
  } catch (e) {
    console.error(
      `Error calculating end date from start: ${startTimeIso}, duration: ${durationMinutes}:`,
      e
    );
    return null;
  }
}

export async function handleZoomWebhook(c: Context) {
  const payload = c.get("parsedBody");
  console.log("Parsed Zoom Webhook payload:", payload);

  if (!payload) {
    return c.json({ message: "Missing parsed body" }, 500);
  }

  // 1. 初回URL検証
  const validationResponse = handleZoomWebhookValidation(payload);
  if (validationResponse) {
    return c.json(validationResponse, 200);
  }

  // 2. イベントタイプと必須情報の確認
  const eventType = payload?.event;
  console.log(`Received Zoom Webhook event: ${eventType}`);
  if (
    eventType !== "recording.completed" &&
    eventType !== "meeting.summary_completed"
  ) {
    console.log(`Ignoring event type: ${eventType}`);
    return c.json(
      { message: "Event type not relevant for Opportunity linking" },
      200
    );
  }

  const meetingUuid = payload?.payload?.object?.uuid;
  const meetingTopic = payload?.payload?.object?.topic;
  const startTime = payload?.payload?.object?.start_time; // ISO 8601形式 (UTC)
  const duration = payload?.payload?.object?.duration; // 分単位

  if (!meetingUuid || !meetingTopic) {
    console.error("Invalid payload: Missing meeting UUID or topic.", payload);
    return c.json(
      { message: "Invalid payload structure (UUID or Topic missing)" },
      400
    );
  }

  // 3. 重複チェック (同じZoom UUIDのEventが既に作成されていないか)
  let existingEventId = null;
  if (env.SALESFORCE_EVENT_ZOOM_UUID_FIELD) {
    existingEventId = await findEventByZoomUuid(meetingUuid);
    if (existingEventId && eventType === "recording.completed") {
      console.log(
        `Event for Zoom meeting ${meetingUuid} already exists (ID: ${existingEventId}). Skipping creation.`
      );
      // すでに処理済みなので成功として返す
      return c.json(
        { message: "Event already created for this meeting." },
        200
      );
    }
  }

  // 4. トピックから商談IDを抽出
  const opportunityId = extractOpportunityIdFromTopic(meetingTopic);
  if (!opportunityId) {
    console.warn(
      `Could not extract Opportunity ID from topic "${meetingTopic}". Cannot link event.`
    );
    return c.json({ message: "Opportunity ID not found in topic" }, 200); // IDがない場合は処理終了
  }

  // 5. Salesforceで商談が存在するか確認
  const opportunity = await findOpportunityById(opportunityId);
  if (!opportunity) {
    console.warn(
      `Salesforce Opportunity with ID ${opportunityId} not found. Cannot link event.`
    );
    return c.json({ message: "Salesforce Opportunity not found" }, 200); // 商談がない場合は処理終了
  }

  // イベントタイプに応じた処理
  if (eventType === "recording.completed") {
    // 録画完了イベントの処理
    console.log(
      `Processing recording for Meeting UUID: ${meetingUuid}, Topic: "${meetingTopic}"`
    );

    const recordingFiles = payload?.payload?.object?.recording_files;
    const shareUrl = payload?.payload?.object?.share_url;
    const recordingPasscode = payload?.payload?.object?.recording_play_passcode;

    // 6. 録画URLとトランスクリプトの準備
    let recordingLink = shareUrl;
    if (shareUrl && recordingPasscode) {
      recordingLink = `${shareUrl}?pwd=${recordingPasscode}`;
    }

    let transcriptText: string | null = "文字起こしは利用できません。"; // デフォルト値
    const transcriptFile = recordingFiles?.find(
      (file: any) =>
        file.file_type === "TRANSCRIPT" && file.status === "completed"
    );

    if (transcriptFile?.download_url) {
      try {
        console.log("Transcript file found, attempting download...");
        const fullTranscript = await downloadTranscriptText(
          transcriptFile.download_url
        );
        // 必要に応じて要約や文字数制限を行う
        transcriptText = fullTranscript.substring(0, 32000); // Salesforceのロングテキストエリア上限考慮
        console.log("Transcript successfully processed.");
      } catch (error: any) {
        console.error(
          `Failed to download or process transcript for meeting ${meetingUuid}:`,
          error.message
        );
        transcriptText = "文字起こしの取得中にエラーが発生しました。";
      }
    } else {
      console.log("Transcript file not available in this payload.");
    }

    // 7. Event作成用データの準備
    const startDateTimeIso = startTime ? formatISO(new Date(startTime)) : null; // ISO形式に
    const endDateTimeIso = calculateEndDateTime(startTime, duration);

    if (!startDateTimeIso || !endDateTimeIso) {
      console.error(
        `Could not determine valid Start/End DateTime for meeting ${meetingUuid}. Start='${startTime}', Duration='${duration}'. Skipping Event creation.`
      );
      return c.json({ message: "Invalid start or end time for event" }, 400); // 日時が不正なら作成不可
    }

    const description = env.SALESFORCE_EVENT_DESCRIPTION_TEMPLATE.replace(
      "{{recordingUrl}}",
      recordingLink || "N/A"
    )
      .replace("{{transcript}}", transcriptText || "")
      .replace(
        "{{meetingSummary}}",
        "ミーティングサマリーはまだ生成されていません。"
      );

    const eventData: EventData = {
      Subject: `${env.SALESFORCE_EVENT_SUBJECT_PREFIX}${meetingTopic}`,
      StartDateTime: startDateTimeIso,
      EndDateTime: endDateTimeIso,
      Description: description,
      WhatId: opportunity.Id, // 商談IDを関連先に設定
      // OwnerId: ownerId, // TODO: ZoomホストからSalesforceユーザーIDを特定できれば設定
    };

    // Zoom UUIDをカスタム項目に設定 (重複防止用)
    if (env.SALESFORCE_EVENT_ZOOM_UUID_FIELD) {
      eventData[env.SALESFORCE_EVENT_ZOOM_UUID_FIELD] = meetingUuid;
    }

    // 8. Salesforce Eventの作成
    try {
      const createResult = await createSalesforceEvent(eventData);
      if (createResult.success) {
        console.log(
          `Successfully created Salesforce Event for Opportunity ${opportunityId} (Event ID: ${createResult.id}).`
        );
        return c.json(
          { message: "Salesforce Event created successfully" },
          200
        );
      } else {
        console.error(
          `Failed to create Salesforce Event for Opportunity ${opportunityId}. Errors:`,
          createResult.errors
        );
        // リトライさせないように 500 ではなく 200 を返す方が安全な場合もある
        return c.json({ message: "Failed to create Salesforce Event" }, 500); // 内部エラーとして返す例
      }
    } catch (error: any) {
      console.error(
        `Unhandled error during Salesforce event creation for Opportunity ${opportunityId}:`,
        error.message
      );
      return c.json(
        { message: "Internal server error during Salesforce event creation" },
        500
      );
    }
  } else if (eventType === "meeting.summary_completed") {
    // ミーティングサマリー完了イベントの処理
    console.log(
      `Processing meeting summary for Meeting UUID: ${meetingUuid}, Topic: "${meetingTopic}"`
    );

    // 既存のイベントが見つからない場合は処理を終了
    if (!existingEventId) {
      console.warn(
        `No existing Event found for Zoom meeting ${meetingUuid}. Cannot update with summary.`
      );
      return c.json(
        { message: "No existing Event found for this meeting" },
        200
      );
    }

    try {
      // ミーティングサマリーを取得
      const encodedMeetingUuid = encodeURIComponent(meetingUuid);
      const meetingSummaryData = await getMeetingSummary(encodedMeetingUuid);
      const summaryText =
        meetingSummaryData?.summary?.summary_text ||
        "ミーティングサマリーを取得できませんでした。";

      // Salesforceのイベントを更新
      const conn = await getSalesforceConnection();

      // 説明文を更新
      const event = await conn.sobject("Event").retrieve(existingEventId);
      let description = event.Description || "";

      // 既存の説明文からミーティングサマリーの部分を更新
      description = description.replace(
        "ミーティングサマリーはまだ生成されていません。",
        summaryText.substring(0, 32000) // Salesforceのロングテキストエリア上限考慮
      );

      const updateData: any = {
        Id: existingEventId,
        Description: description,
      };

      // ミーティングサマリー用のカスタム項目がある場合は設定
      if (env.SALESFORCE_EVENT_MEETING_SUMMARY_FIELD) {
        updateData[env.SALESFORCE_EVENT_MEETING_SUMMARY_FIELD] =
          summaryText.substring(0, 32000);
      }

      const updateResult = await conn.sobject("Event").update(updateData);

      // updateResultは配列または単一のオブジェクトの場合があるため、適切に処理
      const result = Array.isArray(updateResult)
        ? updateResult[0]
        : updateResult;

      if (result && result.success) {
        console.log(
          `Successfully updated Salesforce Event with meeting summary (Event ID: ${existingEventId}).`
        );
        return c.json(
          { message: "Salesforce Event updated with meeting summary" },
          200
        );
      } else {
        const errors =
          result && result.errors ? result.errors : "Unknown error";
        console.error(
          `Failed to update Salesforce Event with meeting summary. Errors:`,
          errors
        );
        return c.json(
          { message: "Failed to update Salesforce Event with meeting summary" },
          500
        );
      }
    } catch (error: any) {
      console.error(
        `Unhandled error during Salesforce event update with meeting summary:`,
        error.message
      );
      return c.json(
        {
          message:
            "Internal server error during Salesforce event update with meeting summary",
        },
        500
      );
    }
  }
}
