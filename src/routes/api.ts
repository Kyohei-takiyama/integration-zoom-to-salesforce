// src/routes/api.ts
import { Hono } from "hono";
import { getMeetingDetails, getMeetingSummary } from "../services/zoomService";

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

    console.log(`Fetching meeting details for UUID: ${meetingUuid}`);
    const meetingDetails = await getMeetingDetails(meetingUuid);
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

    console.log(`Fetching meeting summary for UUID: ${meetingUuid}`);
    const meetingSummary = await getMeetingSummary(meetingUuid);
    return c.json(meetingSummary);
  } catch (error: any) {
    console.error("Error fetching meeting summary:", error);
    return c.json(
      { error: error.message || "Failed to fetch meeting summary" },
      500
    );
  }
});

export default apiRouter;
