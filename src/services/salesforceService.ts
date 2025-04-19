import { SaveResult, SaveError } from "jsforce";
import { getSalesforceConnection } from "../lib/salesforceAuth";
import { env } from "../config/env";

// Opportunity インターフェース (変更なし)
interface Opportunity {
  Id: string;
  Name: string;
  [key: string]: any;
}

interface EventData {
  Subject: string;
  StartDateTime: string;
  EndDateTime: string;
  Description?: string;
  WhatId?: string;
  OwnerId?: string;
  [key: string]: any;
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
    console.warn(`Invalid Opportunity ID format provided: ${opportunityId}`);
    return null;
  }
  const conn = await getSalesforceConnection();
  try {
    console.log(`Finding Opportunity by ID: ${opportunityId}`);
    const result = await conn
      .sobject("Opportunity")
      .findOne<Opportunity>({ Id: opportunityId }, ["Id", "Name"]);

    if (result) {
      console.log(
        `Found Salesforce Opportunity: ${result.Name} (ID: ${result.Id})`
      );
      return result;
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
    return null;
  }

  try {
    const escapedZoomUuid = zoomMeetingUuid.replace(/'/g, "\\'");
    interface EventQueryResult {
      Id: string;
    }
    const query = `SELECT Id FROM Event WHERE ${zoomUuidField} = '${escapedZoomUuid}' LIMIT 1`;
    console.log(`Executing Deduplication SOQL: ${query}`);
    const result = await conn.query<EventQueryResult>(query);

    if (result.totalSize > 0 && result.records.length > 0) {
      const eventId = result.records[0].Id;
      console.log(
        `Existing Salesforce Event found with Zoom UUID ${zoomMeetingUuid}: ${eventId}`
      );
      return eventId;
    } else {
      return null;
    }
  } catch (err: any) {
    console.error(
      `Error finding Salesforce Event by Zoom UUID ${zoomMeetingUuid} for deduplication:`,
      err.message
    );
    return null;
  }
}

/**
 * Salesforce に新しい Event レコードを作成する
 * @param eventData 作成するイベントデータ
 * @returns 作成結果 (SaveResult)
 */
export async function createSalesforceEvent(
  eventData: EventData
): Promise<SaveResult> {
  const conn = await getSalesforceConnection();

  if (
    !eventData.Subject ||
    !eventData.StartDateTime ||
    !eventData.EndDateTime
  ) {
    const errorMessage =
      "Missing required fields for Event creation (Subject, StartDateTime, EndDateTime).";
    console.error(errorMessage, eventData);
    // SaveError 型のエラーオブジェクトを返す
    return {
      success: false,
      errors: [
        {
          message: errorMessage,
          errorCode: "REQUIRED_FIELD_MISSING",
          fields: ["Subject", "StartDateTime", "EndDateTime"],
        } as SaveError,
      ],
      id: undefined,
    };
  }

  if (
    env.SALESFORCE_EVENT_ZOOM_UUID_FIELD &&
    !eventData[env.SALESFORCE_EVENT_ZOOM_UUID_FIELD]
  ) {
    console.warn(
      `Zoom Meeting UUID field '${env.SALESFORCE_EVENT_ZOOM_UUID_FIELD}' is configured but no value provided in eventData.`
    );
  }

  console.log(
    `Creating new Salesforce Event: Subject='${eventData.Subject}', WhatId='${eventData.WhatId}'`
  );
  try {
    // create メソッドの戻り値の型を any または SaveResult として扱う
    const result: SaveResult = await conn.sobject("Event").create(eventData);
    if (result.success) {
      console.log(`Successfully created Salesforce Event ID: ${result.id}`);
    } else {
      // errors が配列であることを保証する (jsforce のバージョンによる差異吸収)
      const errors = Array.isArray(result.errors)
        ? result.errors
        : [result.errors];
      const errorMessages = errors
        .map((e) => e?.message || JSON.stringify(e))
        .join(", ");
      console.error("Failed to create Salesforce Event:", errorMessages);
      // 必要なら result.errors を整形して返す
      return { ...result, errors: errors };
    }
    // jsforce の結果オブジェクトが SaveResult と互換性があればそのまま返す
    return result;
  } catch (err: any) {
    console.error("Error creating Salesforce Event:", err.message);
    return {
      success: false,
      errors: [
        {
          message: err.message,
          errorCode: "UNKNOWN_ERROR",
          fields: [],
        } as SaveError,
      ],
      id: undefined,
    };
  }
}
