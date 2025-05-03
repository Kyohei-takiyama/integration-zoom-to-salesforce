// src/services/zoomService.ts
import { getZoomAccessToken } from "../lib/zoomAuth";

const ZOOM_API_BASE_URL = "https://api.zoom.us/v2";

/**
 * 指定されたURLからデータをダウンロードする (認証付き)
 * @param downloadUrl ダウンロードURL
 * @param tokenType 'jwt' or 'oauth'
 */
async function downloadWithAuth(
  downloadUrl: string,
  tokenType: "oauth" = "oauth"
): Promise<Response> {
  const accessToken = await getZoomAccessToken(); // OAuthトークンを取得

  // download_urlにアクセストークンを付与してアクセス
  const urlWithToken = `${downloadUrl}${
    downloadUrl.includes("?") ? "&" : "?"
  }access_token=${accessToken}`;

  const response = await fetch(urlWithToken, {
    method: "GET",
    headers: {
      // OAuthトークンを使う場合、通常Authorizationヘッダーは不要だが念のため
      // 'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(
      `Failed to download from ${downloadUrl}:`,
      response.status,
      errorText
    );
    throw new Error(`Failed to download resource: ${response.status}`);
  }
  return response;
}

/**
 * ミーティングの詳細情報を取得する
 * @param meetingUuid ミーティングUUID
 * @returns ミーティングの詳細情報
 */
export async function getMeetingDetails(meetingUuid: string): Promise<any> {
  const accessToken = await getZoomAccessToken();
  const url = `${ZOOM_API_BASE_URL}/meetings/${meetingUuid}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(
      `Failed to get meeting details for ${meetingUuid}:`,
      response.status,
      errorText
    );
    throw new Error(`Failed to get meeting details: ${response.status}`);
  }
  return await response.json();
}

/**
 * ミーティングの録画詳細情報を取得する
 * @param meetingUuid ミーティングUUID
 */
export async function getMeetingRecordings(meetingUuid: string): Promise<any> {
  const accessToken = await getZoomAccessToken();
  const url = `${ZOOM_API_BASE_URL}/meetings/${meetingUuid}/recordings`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(
      `Failed to get recordings for meeting ${meetingUuid}:`,
      response.status,
      errorText
    );
    throw new Error(`Failed to get recordings: ${response.status}`);
  }
  return await response.json();
}

/**
 * ミーティングのサマリー情報を取得する
 * @param meetingUuid ミーティングUUID
 * @returns ミーティングのサマリー情報
 */
export async function getMeetingSummary(meetingUuid: string): Promise<any> {
  const accessToken = await getZoomAccessToken();
  const url = `${ZOOM_API_BASE_URL}/meetings/${meetingUuid}/meeting_summary`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(
      `Failed to get meeting summary for ${meetingUuid}:`,
      response.status,
      errorText
    );
    throw new Error(`Failed to get meeting summary: ${response.status}`);
  }
  return await response.json();
}

/**
 * トランスクリプトファイルをダウンロードしてテキストを取得する
 * @param transcriptDownloadUrl トランスクリプト(VTT)のダウンロードURL
 */
export async function downloadTranscriptText(
  transcriptDownloadUrl: string
): Promise<string> {
  console.log(`Downloading transcript from: ${transcriptDownloadUrl}`);
  const response = await downloadWithAuth(transcriptDownloadUrl);
  const vttContent = await response.text();

  // VTT形式からテキスト部分のみを抽出する簡単な処理
  const lines = vttContent.split("\n");
  let transcriptText = "";
  let isTextSection = false;
  for (const line of lines) {
    if (line.includes("-->")) {
      // タイムスタンプ行
      isTextSection = true;
    } else if (line.trim() === "" && isTextSection) {
      // テキスト後の空行
      isTextSection = false;
    } else if (isTextSection) {
      // テキスト行
      // WEBVTTヘッダーやNOTEなどを除外 (より厳密なパースが必要な場合あり)
      if (
        !line.startsWith("WEBVTT") &&
        !line.startsWith("NOTE") &&
        line.trim()
      ) {
        transcriptText += line.trim() + " ";
      }
    }
  }
  console.log("Transcript downloaded and parsed.");
  return transcriptText.trim();
}

/**
 * ユーザーのミーティング一覧を取得する
 * @param userId ユーザーID（'me'を指定すると現在認証されているユーザー）
 * @param type ミーティングタイプ（'scheduled'、'live'、'upcoming'など）
    scheduled - All valid previous (unexpired) meetings, live meetings, and upcoming scheduled meetings.
    live - All the ongoing meetings.
    upcoming - All upcoming meetings, including live meetings.
    upcoming_meetings - All upcoming meetings, including live meetings.
    previous_meetings - All the previous meetings.
 * @param pageSize 1ページあたりの結果数
 * @param pageNumber ページ番号
 * @returns ユーザーのミーティング一覧
 */
export async function getUserMeetings(
  userId: string = "me",
  type: string = "scheduled",
  pageSize: number = 30,
  pageNumber: number = 1
): Promise<any> {
  const accessToken = await getZoomAccessToken();
  const url = `${ZOOM_API_BASE_URL}/users/${userId}/meetings?type=${type}&page_size=${pageSize}&page_number=${pageNumber}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(
      `Failed to get meetings for user ${userId}:`,
      response.status,
      errorText
    );
    throw new Error(`Failed to get user meetings: ${response.status}`);
  }
  return await response.json();
}

/**
 * 過去のミーティングの詳細情報を取得する
 * 注意：
 * - ミーティングが終了している必要がある
 * - 1年以上前のミーティングにはアクセスできない
 * - `/`で始まるか`//`を含むミーティングUUIDの場合は、呼び出し前に二重エンコードが必要
 *
 * @param meetingUuid ミーティングUUID
 * @returns 過去のミーティングの詳細情報
 */
export async function getPastMeetingDetails(meetingUuid: string): Promise<any> {
  const accessToken = await getZoomAccessToken();
  const url = `${ZOOM_API_BASE_URL}/past_meetings/${meetingUuid}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(
      `Failed to get past meeting details for ${meetingUuid}:`,
      response.status,
      errorText
    );
    throw new Error(`Failed to get past meeting details: ${response.status}`);
  }
  return await response.json();
}
