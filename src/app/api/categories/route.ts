import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, unauthorized, badRequest } from "@/lib/api-utils";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1, "类别名称不能为空").max(20, "类别名称最多20字"),
});

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();

  const categories = await prisma.nonProjectCategory.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, createdAt: true },
  });

  return NextResponse.json(categories);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.issues[0].message);

  const existing = await prisma.nonProjectCategory.findUnique({
    where: { name: parsed.data.name },
  });
  if (existing) return NextResponse.json(existing);

  const category = await prisma.nonProjectCategory.create({
    data: { name: parsed.data.name, createdById: session.user.id },
    select: { id: true, name: true, createdAt: true },
  });

  return NextResponse.json(category, { status: 201 });
}
