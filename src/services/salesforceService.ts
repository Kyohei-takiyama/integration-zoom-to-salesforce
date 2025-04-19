// src/services/salesforceService.ts
import { getSalesforceConnection } from "../lib/salesforceAuth";
import { env } from "../config/env";

interface EventUpdateData {
  [key: string]: string | null; // [カスタム項目API名]: 値
}

/**
 * Zoom Meeting UUID をもとに Salesforce Event レコードを検索する
 * @param zoomMeetingUuid ZoomのミーティングUUID
 * @returns 見つかったEventのID、見つからなければnull
 */
export async function findSalesforceEventByZoomUuid(
  zoomMeetingUuid: string
): Promise<string | null> {
  const conn = await getSalesforceConnection();
  const zoomUuidField = env.SALESFORCE_ZOOM_UUID_FIELD;

  try {
    const query = `SELECT Id FROM Event WHERE ${zoomUuidField} = '${zoomMeetingUuid}' LIMIT 1`;
    console.log(`Executing SOQL: ${query}`);
    const result = await conn.query<{ Id: string }>(query);

    if (result.totalSize > 0 && result.records.length > 0) {
      const eventId = result.records[0].Id;
      console.log(
        `Found Salesforce Event ID: ${eventId} for Zoom UUID: ${zoomMeetingUuid}`
      );
      return eventId;
    } else {
      console.warn(
        `No Salesforce Event found for Zoom UUID: ${zoomMeetingUuid}`
      );
      return null;
    }
  } catch (err: any) {
    console.error(
      `Error finding Salesforce Event by Zoom UUID ${zoomMeetingUuid}:`,
      err.message
    );
    // アクセストークン切れなどで失敗した場合、再接続を試みることも検討
    // if (err.name === 'invalid_grant' || err.name === 'Session expired or invalid') {
    //     console.log('Salesforce session might be invalid, attempting reconnect...');
    //     sfConnection = null; // キャッシュクリア
    //     // 再度実行 or エラーを投げて上位でリトライ
    // }
    return null; // エラー時はnullを返す
  }
}

/**
 * Salesforce Event レコードを更新する
 * @param eventId 更新対象のEvent ID
 * @param updateData 更新するデータ (フィールドAPI名: 値 のオブジェクト)
 * @returns 更新結果
 */
export async function updateSalesforceEvent(
  eventId: string,
  updateData: EventUpdateData
): Promise<jsforce.SuccessResult | jsforce.ErrorResult> {
  const conn = await getSalesforceConnection();

  // updateDataからnullやundefinedの値を持つキーを除外する
  const cleanUpdateData: { [key: string]: string } = {};
  for (const key in updateData) {
    if (updateData[key] !== null && updateData[key] !== undefined) {
      cleanUpdateData[key] = updateData[key] as string;
    }
  }

  if (Object.keys(cleanUpdateData).length === 0) {
    console.log(
      `No valid data to update for Event ID: ${eventId}. Skipping update.`
    );
    // 成功したかのように扱うか、特定のステータスを返すか決める
    return { id: eventId, success: true, errors: [] };
  }

  console.log(
    `Updating Salesforce Event ID: ${eventId} with data:`,
    cleanUpdateData
  );
  try {
    const result = await conn.sobject("Event").update({
      Id: eventId,
      ...cleanUpdateData,
    });
    console.log(`Salesforce Event ${eventId} update result:`, result);
    if (!result.success) {
      console.error(
        `Failed to update Salesforce Event ${eventId}:`,
        result.errors
      );
    }
    return result;
  } catch (err: any) {
    console.error(`Error updating Salesforce Event ${eventId}:`, err.message);
    // エラーオブジェクトを返すか、エラーをスローするか選択
    return { id: eventId, success: false, errors: [err] };
  }
}
