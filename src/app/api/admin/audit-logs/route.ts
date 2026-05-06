import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, unauthorized, forbidden } from "@/lib/api-utils";
import { isAdmin } from "@/lib/permissions";

/** GET /api/admin/audit-logs?action=&actorId=&limit= */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!isAdmin(session.user)) return forbidden();

  const sp = request.nextUrl.searchParams;
  const action = sp.get("action");
  const actorId = sp.get("actorId");
  const limit = Math.min(500, Math.max(1, Number(sp.get("limit") ?? 100)));

  const where: Record<string, unknown> = {};
  if (action) where.action = action;
  if (actorId) where.actorId = actorId;

  const items = await prisma.auditLog.findMany({
    where,
    include: { actor: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return NextResponse.json(items);
}
