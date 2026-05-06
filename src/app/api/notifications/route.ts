import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, unauthorized } from "@/lib/api-utils";
import { scanAnomalies } from "@/lib/anomaly-scanner";

/** GET /api/notifications?unread=1&limit=50 */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  // 访问消息中心时 lazy 扫描异常（节流 60s）
  await scanAnomalies();

  const sp = request.nextUrl.searchParams;
  const unreadOnly = sp.get("unread") === "1";
  const limit = Math.min(200, Math.max(1, Number(sp.get("limit") ?? 50)));

  const items = await prisma.notification.findMany({
    where: {
      userId: session.user.id,
      ...(unreadOnly ? { readAt: null } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  const unreadCount = await prisma.notification.count({
    where: { userId: session.user.id, readAt: null },
  });

  return NextResponse.json({ items, unreadCount });
}

/** POST /api/notifications/mark-all-read */
export async function POST(_request: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  const result = await prisma.notification.updateMany({
    where: { userId: session.user.id, readAt: null },
    data: { readAt: new Date() },
  });

  return NextResponse.json({ updated: result.count });
}
