// src/services/salesforceService.ts
import { Connection, SuccessResult, ErrorResult, Record } from "jsforce"; // 型を追加
import { getSalesforceConnection } from "../lib/salesforceAuth";
import { env } from "../config/env";

interface Opportunity extends Record<any> {
  // 必要に応じて型を定義
  Id: string;
  Name: string;
  // 他に必要なフィールド
}

interface EventData {
  Subject: string;
  StartDateTime: string; // ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ)
  EndDateTime: string; // ISO 8601 format
  Description?: string;
  WhatId?: string; // Related Opportunity ID
  OwnerId?: string; // Salesforce User ID (Optional but recommended)
  [key: string]: any; // Allow custom fields like ZoomMeetingUUID__c
}

/**
 * Salesforce Opportunity レコードを ID で検索する
 * @param opportunityId 検索対象の商談ID
 * @returns 見つかったOpportunity、見つからなければnull
 */
export async function findOpportunityById(
  opportunityId: string
): Promise<Opportunity | null> {
  if (!opportunityId || opportunityId.length < 15) {
    // 簡単なID形式チェック
    console.warn(`Invalid Opportunity ID format provided: ${opportunityId}`);
    return null;
  }
  const conn = await getSalesforceConnection();
  try {
    // SOQLインジェクション対策のため、findメソッドを使用する方がより安全
    // または、IDをエスケープする処理を入れる
    const escapedOpportunityId = opportunityId.replace(/'/g, "\\'"); // 簡単なエスケープ
    // SOQLインジェクションのリスクがあるため、通常は find() を推奨
    // const query = `SELECT Id, Name FROM Opportunity WHERE Id = '${escapedOpportunityId}' LIMIT 1`;
    // console.log(`Executing SOQL: ${query}`);
    // const result = await conn.query<Opportunity>(query);

    console.log(`Finding Opportunity by ID: ${opportunityId}`);
    const result = await conn.sobject("Opportunity").findOne<Opportunity>(
      { Id: opportunityId }, // conditions
      ["Id", "Name"] // fields to retrieve
    );

    if (result) {
      console.log(
        `Found Salesforce Opportunity: ${result.Name} (ID: ${result.Id})`
      );
      // @ts-ignore // jsforce の findOne の型が Record<any> | null なのでキャストする
      return result as Opportunity;
    } else {
      console.warn(`No Salesforce Opportunity found for ID: ${opportunityId}`);
      return null;
    }
  } catch (err: any) {
    console.error(
      `Error finding Salesforce Opportunity by ID ${opportunityId}:`,
      err.message
    );
    return null;
  }
}

/**
 * Zoom Meeting UUID をもとに Salesforce Event レコードを検索する (重複チェック用)
 * @param zoomMeetingUuid ZoomのミーティングUUID
 * @returns 見つかったEventのID、見つからなければnull
 */
export async function findEventByZoomUuid(
  zoomMeetingUuid: string
): Promise<string | null> {
  const conn = await getSalesforceConnection();
  const zoomUuidField = env.SALESFORCE_EVENT_ZOOM_UUID_FIELD;

  if (!zoomUuidField) {
    console.warn(
      "SALESFORCE_EVENT_ZOOM_UUID_FIELD is not defined. Cannot perform deduplication check."
    );
    return null; // 設定がない場合はチェック不可
  }

  try {
    // UUIDもインジェクション対策が必要
    const escapedZoomUuid = zoomMeetingUuid.replace(/'/g, "\\'");
    const query = `SELECT Id FROM Event WHERE ${zoomUuidField} = '${escapedZoomUuid}' LIMIT 1`;
    console.log(`Executing Deduplication SOQL: ${query}`);
    const result = await conn.query<{ Id: string }>(query);

    if (result.totalSize > 0 && result.records.length > 0) {
      const eventId = result.records[0].Id;
      console.log(
        `Existing Salesforce Event found with Zoom UUID ${zoomMeetingUuid}: ${eventId}`
      );
      return eventId;
    } else {
      // console.log(`No existing Salesforce Event found for Zoom UUID: ${zoomMeetingUuid}`);
      return null;
    }
  } catch (err: any) {
    console.error(
      `Error finding Salesforce Event by Zoom UUID ${zoomMeetingUuid} for deduplication:`,
      err.message
    );
    return null; // エラー時はnullを返し、重複作成を許容しないようにハンドラ側で考慮が必要かも
  }
}

/**
 * Salesforce に新しい Event レコードを作成する
 * @param eventData 作成するイベントデータ
 * @returns 作成結果 (SuccessResult or ErrorResult)
 */
export async function createSalesforceEvent(
  eventData: EventData
): Promise<SuccessResult | ErrorResult> {
  const conn = await getSalesforceConnection();

  // Eventオブジェクトの必須項目チェック (最低限)
  if (
    !eventData.Subject ||
    !eventData.StartDateTime ||
    !eventData.EndDateTime
  ) {
    const errorMessage =
      "Missing required fields for Event creation (Subject, StartDateTime, EndDateTime).";
    console.error(errorMessage, eventData);
    return { success: false, errors: [new Error(errorMessage)], id: null };
  }

  // Zoom UUIDフィールド名が設定されていれば、eventDataに追加
  if (
    env.SALESFORCE_EVENT_ZOOM_UUID_FIELD &&
    eventData[env.SALESFORCE_EVENT_ZOOM_UUID_FIELD]
  ) {
    // Do nothing, already set
  } else if (env.SALESFORCE_EVENT_ZOOM_UUID_FIELD) {
    console.warn(
      `Zoom Meeting UUID field '${env.SALESFORCE_EVENT_ZOOM_UUID_FIELD}' is configured but no value provided in eventData.`
    );
    // eventData[env.SALESFORCE_EVENT_ZOOM_UUID_FIELD] = 'UUID_NOT_PROVIDED'; // Or handle differently
  }

  console.log(
    `Creating new Salesforce Event: Subject='${eventData.Subject}', WhatId='${eventData.WhatId}'`
  );
  try {
    const result = await conn.sobject("Event").create(eventData);
    if (result.success) {
      console.log(`Successfully created Salesforce Event ID: ${result.id}`);
    } else {
      console.error("Failed to create Salesforce Event:", result.errors);
    }
    return result;
  } catch (err: any) {
    console.error("Error creating Salesforce Event:", err.message);
    return { success: false, errors: [err], id: null }; // jsforce v1.x style error
  }
}

// updateSalesforceEvent 関数は不要になったので削除
// export async function updateSalesforceEvent(...) { ... }
