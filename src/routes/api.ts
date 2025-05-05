// src/routes/api.ts
import { Hono } from "hono";
import {
  getMeetingDetails,
  getMeetingSummary,
  getMeetingRecordings,
  getUserMeetings,
  getPastMeetingDetails,
  getPastMeetingInstances,
  getUsers,
  getUser,
} from "../services/zoomService";
import { getSalesforceToken } from "../lib/salesforceAuth";

const apiRouter = new Hono();

/**
 * ミーティングの詳細情報を取得するエンドポイント
 * GET /api/meetings/:meetingUuid
 */
apiRouter.get("/meetings/:meetingUuid", async (c) => {
  try {
    const meetingUuid = c.req.param("meetingUuid");
    if (!meetingUuid) {
      return c.json({ error: "Meeting UUID is required" }, 400);
    }

    // Meeting UUID を URL エンコードする
    const encodedMeetingUuid = encodeURIComponent(meetingUuid);
    console.log(`Fetching meeting details for UUID: ${meetingUuid}`);
    const meetingDetails = await getMeetingDetails(encodedMeetingUuid);
    return c.json(meetingDetails);
  } catch (error: any) {
    console.error("Error fetching meeting details:", error);
    return c.json(
      { error: error.message || "Failed to fetch meeting details" },
      500
    );
  }
});

/**
 * ミーティングのサマリー情報を取得するエンドポイント
 * GET /api/meetings/:meetingUuid/summary
 */
apiRouter.get("/meetings/:meetingUuid/summary", async (c) => {
  try {
    const meetingUuid = c.req.param("meetingUuid");
    if (!meetingUuid) {
      return c.json({ error: "Meeting UUID is required" }, 400);
    }

    // Meeting UUID を URL エンコードする
    const encodedMeetingUuid = encodeURIComponent(meetingUuid);
    console.log(`Encoded Meeting UUID: ${encodedMeetingUuid}`);
    const meetingSummary = await getMeetingSummary(encodedMeetingUuid);
    return c.json(meetingSummary);
  } catch (error: any) {
    console.error("Error fetching meeting summary:", error);
    return c.json(
      { error: error.message || "Failed to fetch meeting summary" },
      500
    );
  }
});

/**
 * ミーティングの録画情報を取得するエンドポイント
 * GET /api/meetings/:meetingUuid/recordings
 */
apiRouter.get("/meetings/:meetingUuid/recordings", async (c) => {
  try {
    const meetingUuid = c.req.param("meetingUuid");
    if (!meetingUuid) {
      return c.json({ error: "Meeting UUID is required" }, 400);
    }

    // Meeting UUID を URL エンコードする
    const encodedMeetingUuid = encodeURIComponent(meetingUuid);
    console.log(`Fetching meeting recordings for UUID: ${meetingUuid}`);
    const meetingRecordings = await getMeetingRecordings(encodedMeetingUuid);
    return c.json(meetingRecordings);
  } catch (error: any) {
    console.error("Error fetching meeting recordings:", error);
    return c.json(
      { error: error.message || "Failed to fetch meeting recordings" },
      500
    );
  }
});

/**
 * ユーザーのミーティング一覧を取得するエンドポイント
 * GET /api/users/:userId/meetings
 * クエリパラメータ:
 * - type: ミーティングタイプ（'scheduled'、'live'、'upcoming'など）
 * - pageSize: 1ページあたりの結果数
 * - pageNumber: ページ番号
 */
apiRouter.get("/users/:userId/meetings", async (c) => {
  try {
    const userId = c.req.param("userId") || "me";
    const type = c.req.query("type") || "scheduled";
    const pageSize = parseInt(c.req.query("pageSize") || "30", 10);
    const pageNumber = parseInt(c.req.query("pageNumber") || "1", 10);

    console.log(`Fetching meetings for user: ${userId}, type: ${type}`);
    const meetings = await getUserMeetings(userId, type, pageSize, pageNumber);
    return c.json(meetings);
  } catch (error: any) {
    console.error("Error fetching user meetings:", error);
    return c.json(
      { error: error.message || "Failed to fetch user meetings" },
      500
    );
  }
});

/**
 * 現在認証されているユーザーのミーティング一覧を取得するエンドポイント（簡易版）
 * GET /api/meetings
 * クエリパラメータ:
 * - type: ミーティングタイプ（'scheduled'、'live'、'upcoming'など）
 * - pageSize: 1ページあたりの結果数
 * - pageNumber: ページ番号
 */
apiRouter.get("/meetings", async (c) => {
  try {
    const type = c.req.query("type") || "scheduled";
    const pageSize = parseInt(c.req.query("pageSize") || "30", 10);
    const pageNumber = parseInt(c.req.query("pageNumber") || "1", 10);

    console.log(`Fetching meetings for current user, type: ${type}`);
    const meetings = await getUserMeetings("me", type, pageSize, pageNumber);
    return c.json(meetings);
  } catch (error: any) {
    console.error("Error fetching user meetings:", error);
    return c.json(
      { error: error.message || "Failed to fetch user meetings" },
      500
    );
  }
});

/**
 * 過去のミーティングの詳細情報を取得するエンドポイント
 * GET /api/past_meetings/:meetingId
 *
 * 注意：
 * - ミーティングが終了している必要がある
 * - 1年以上前のミーティングにはアクセスできない
 */
apiRouter.get("/past_meetings/:meetingId", async (c) => {
  try {
    const meetingId = c.req.param("meetingId");
    if (!meetingId) {
      return c.json({ error: "Meeting UUID is required" }, 400);
    }

    const pastMeetingDetails = await getPastMeetingDetails(meetingId);
    return c.json(pastMeetingDetails);
  } catch (error: any) {
    console.error("Error fetching past meeting details:", error);
    return c.json(
      { error: error.message || "Failed to fetch past meeting details" },
      500
    );
  }
});

/**
 * 過去のミーティングのインスタンス一覧を取得するエンドポイント
 * GET /api/past_meetings/:meetingId/instances
 *
 * 注意：
 * - ミーティングが終了している必要がある
 * - 1年以上前のミーティングにはアクセスできない
 */
apiRouter.get("/past_meetings/:meetingId/instances", async (c) => {
  try {
    const meetingId = c.req.param("meetingId");
    if (!meetingId) {
      return c.json({ error: "Meeting ID is required" }, 400);
    }

    console.log(`Fetching past meeting instances for ID: ${meetingId}`);
    const pastMeetingInstances = await getPastMeetingInstances(meetingId);
    return c.json(pastMeetingInstances);
  } catch (error: any) {
    console.error("Error fetching past meeting instances:", error);
    return c.json(
      { error: error.message || "Failed to fetch past meeting instances" },
      500
    );
  }
});

/**
 * Salesforceのアクセストークンを取得するエンドポイント
 * GET /api/salesforce/token
 *
 * クライアントクレデンシャルフローを使用してSalesforceのアクセストークンを取得します
 * 返却値には以下の情報が含まれます：
 * - access_token: アクセストークン
 * - instance_url: SalesforceインスタンスのURL
 * - token_type: トークンタイプ（通常は"Bearer"）
 * - expires_in: トークンの有効期限（秒）
 * - expires_at: トークンの有効期限（UNIXタイムスタンプ、ミリ秒）
 */
apiRouter.get("/salesforce/token", async (c) => {
  try {
    console.log("Fetching Salesforce access token");
    const tokenInfo = await getSalesforceToken();
    return c.json(tokenInfo);
  } catch (error: any) {
    console.error("Error fetching Salesforce token:", error);
    return c.json(
      { error: error.message || "Failed to fetch Salesforce token" },
      500
    );
  }
});

/**
 * ユーザー一覧を取得するエンドポイント
 * GET /api/users
 * クエリパラメータ:
 * - status: ユーザーのステータス（'active'、'inactive'、'pending'）
 * - pageSize: 1ページあたりの結果数
 * - pageNumber: ページ番号
 * - nextPageToken: 次ページのトークン（ページネーション用）
 */
apiRouter.get("/users", async (c) => {
  try {
    const status = c.req.query("status") || "active";
    const pageSize = parseInt(c.req.query("pageSize") || "30", 10);
    const pageNumber = parseInt(c.req.query("pageNumber") || "1", 10);
    const nextPageToken = c.req.query("nextPageToken");

    console.log(`Fetching users with status: ${status}`);
    const users = await getUsers(status, pageSize, pageNumber, nextPageToken);
    return c.json(users);
  } catch (error: any) {
    console.error("Error fetching users:", error);
    return c.json({ error: error.message || "Failed to fetch users" }, 500);
  }
});

/**
 * 特定のユーザー情報を取得するエンドポイント
 * GET /api/users/:userId
 */
apiRouter.get("/users/:userId", async (c) => {
  try {
    const userId = c.req.param("userId");
    if (!userId) {
      return c.json({ error: "User ID is required" }, 400);
    }

    console.log(`Fetching user details for ID: ${userId}`);
    const userDetails = await getUser(userId);
    return c.json(userDetails);
  } catch (error: any) {
    console.error("Error fetching user details:", error);
    return c.json(
      { error: error.message || "Failed to fetch user details" },
      500
    );
  }
});

export default apiRouter;
