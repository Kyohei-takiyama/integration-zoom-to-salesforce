// src/services/zoomService.ts
import { getZoomAccessToken } from "../lib/zoomAuth";
import axios from "axios";

const ZOOM_API_BASE_URL = "https://api.zoom.us/v2";

/**
 * 指定されたURLからデータをダウンロードする (認証付き)
 * @param downloadUrl ダウンロードURL
 * @param tokenType 'jwt' or 'oauth'
 */
async function downloadWithAuth(
  downloadUrl: string,
  tokenType: "oauth" = "oauth"
): Promise<any> {
  const accessToken = await getZoomAccessToken(); // OAuthトークンを取得

  // download_urlにアクセストークンを付与してアクセス
  const urlWithToken = `${downloadUrl}${
    downloadUrl.includes("?") ? "&" : "?"
  }access_token=${accessToken}`;

  try {
    const response = await axios.get(urlWithToken, {
      responseType: "text",
      headers: {
        // OAuthトークンを使う場合、通常Authorizationヘッダーは不要だが念のため
        // 'Authorization': `Bearer ${accessToken}`,
      },
    });

    return response;
  } catch (error: any) {
    console.error(
      `Failed to download from ${downloadUrl}:`,
      error.response?.status,
      error.response?.data
    );
    throw new Error(
      `Failed to download resource: ${error.response?.status || error.message}`
    );
  }
}

/**
 * ミーティングの詳細情報を取得する
 * @param meetingUuid ミーティングUUID
 * @returns ミーティングの詳細情報
 */
export async function getMeetingDetails(meetingUuid: string): Promise<any> {
  const accessToken = await getZoomAccessToken();
  const url = `${ZOOM_API_BASE_URL}/meetings/${meetingUuid}`;

  try {
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    return response.data;
  } catch (error: any) {
    console.error(
      `Failed to get meeting details for ${meetingUuid}:`,
      error.response?.status,
      error.response?.data
    );
    throw new Error(
      `Failed to get meeting details: ${
        error.response?.status || error.message
      }`
    );
  }
}

/**
 * ミーティングの録画詳細情報を取得する
 * @param meetingUuid ミーティングUUID
 */
export async function getMeetingRecordings(meetingUuid: string): Promise<any> {
  const accessToken = await getZoomAccessToken();
  const url = `${ZOOM_API_BASE_URL}/meetings/${meetingUuid}/recordings`;

  try {
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    return response.data;
  } catch (error: any) {
    console.error(
      `Failed to get recordings for meeting ${meetingUuid}:`,
      error.response?.status,
      error.response?.data
    );
    throw new Error(
      `Failed to get recordings: ${error.response?.status || error.message}`
    );
  }
}

/**
 * ミーティングのサマリー情報を取得する
 * @param meetingUuid ミーティングUUID
 * @returns ミーティングのサマリー情報
 */
export async function getMeetingSummary(meetingUuid: string): Promise<any> {
  const accessToken = await getZoomAccessToken();
  const url = `${ZOOM_API_BASE_URL}/meetings/${meetingUuid}/meeting_summary`;

  try {
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    return response.data;
  } catch (error: any) {
    console.error(
      `Failed to get meeting summary for ${meetingUuid}:`,
      error.response?.status,
      error.response?.data
    );
    throw new Error(
      `Failed to get meeting summary: ${
        error.response?.status || error.message
      }`
    );
  }
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
  const vttContent = response.data;

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

  try {
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    return response.data;
  } catch (error: any) {
    console.error(
      `Failed to get meetings for user ${userId}:`,
      error.response?.status,
      error.response?.data
    );
    throw new Error(
      `Failed to get user meetings: ${error.response?.status || error.message}`
    );
  }
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

  try {
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    return response.data;
  } catch (error: any) {
    console.error(
      `Failed to get past meeting details for ${meetingUuid}:`,
      error.response?.status,
      error.response?.data
    );
    throw new Error(
      `Failed to get past meeting details: ${
        error.response?.status || error.message
      }`
    );
  }
}

/**
 * ユーザー一覧を取得する
 * @param status ユーザーのステータス（'active'、'inactive'、'pending'）
 * @param pageSize 1ページあたりの結果数
 * @param pageNumber ページ番号
 * @param nextPageToken 次ページのトークン（ページネーション用）
 * @returns ユーザー一覧
 */
export async function getUsers(
  status: string = "active",
  pageSize: number = 30,
  pageNumber: number = 1,
  nextPageToken?: string
): Promise<any> {
  const accessToken = await getZoomAccessToken();
  let url = `${ZOOM_API_BASE_URL}/users?status=${status}&page_size=${pageSize}&page_number=${pageNumber}`;

  if (nextPageToken) {
    url += `&next_page_token=${nextPageToken}`;
  }

  try {
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    return response.data;
  } catch (error: any) {
    console.error(
      `Failed to get users:`,
      error.response?.status,
      error.response?.data
    );
    throw new Error(
      `Failed to get users: ${error.response?.status || error.message}`
    );
  }
}

/**
 * 特定のユーザー情報を取得する
 * @param userId ユーザーID
 * @returns ユーザー情報
 */
export async function getUser(userId: string): Promise<any> {
  const accessToken = await getZoomAccessToken();
  const url = `${ZOOM_API_BASE_URL}/users/${userId}`;

  try {
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    return response.data;
  } catch (error: any) {
    console.error(
      `Failed to get user ${userId}:`,
      error.response?.status,
      error.response?.data
    );
    throw new Error(
      `Failed to get user: ${error.response?.status || error.message}`
    );
  }
}

/**
 * 過去のミーティングのインスタンス一覧を取得する
 * 注意：
 * - ミーティングが終了している必要がある
 * - 1年以上前のミーティングにはアクセスできない
 *
 * @param meetingId ミーティングID
 * @returns 過去のミーティングのインスタンス一覧
 */
export async function getPastMeetingInstances(meetingId: string): Promise<any> {
  const accessToken = await getZoomAccessToken();
  const url = `${ZOOM_API_BASE_URL}/past_meetings/${meetingId}/instances`;

  try {
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    return response.data;
  } catch (error: any) {
    console.error(
      `Failed to get past meeting instances for ${meetingId}:`,
      error.response?.status,
      error.response?.data
    );
    throw new Error(
      `Failed to get past meeting instances: ${
        error.response?.status || error.message
      }`
    );
  }
}
