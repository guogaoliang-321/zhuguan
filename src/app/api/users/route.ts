import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, unauthorized, forbidden, badRequest } from "@/lib/api-utils";
import { isAdmin, canManageUsers } from "@/lib/permissions";
import { z } from "zod";
import bcrypt from "bcryptjs";

const createUserSchema = z.object({
  username: z.string().min(2, "用户名至少2位").max(50),
  password: z.string().min(6, "密码至少6位"),
  name: z.string().min(1, "姓名不能为空"),
  role: z.enum(["ADMIN", "PROJECT_LEAD", "MEMBER"]).default("MEMBER"),
  phone: z.string().optional(),
  idNumber: z.string().optional(),
  specialty: z.string().optional(),
  department: z.string().optional(),
  position: z.string().optional(),
  weeklyCapacity: z.number().min(1).max(80).default(40),
});

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();

  const adminView = isAdmin(session.user);

  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      username: true,
      role: true,
      department: true,
      position: true,
      specialty: true,
      phone: adminView,
      idNumber: adminView,
      weeklyCapacity: true,
      createdAt: true,
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(users);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!canManageUsers(session.user)) return forbidden();

  const body = await request.json();
  const parsed = createUserSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.issues[0].message);

  const existing = await prisma.user.findUnique({
    where: { username: parsed.data.username },
  });
  if (existing) return badRequest("用户名已存在");

  const hashed = await bcrypt.hash(parsed.data.password, 10);

  const user = await prisma.user.create({
    data: {
      ...parsed.data,
      password: hashed,
      weeklyCapacity: parsed.data.weeklyCapacity,
    },
    select: { id: true, name: true, username: true, role: true, specialty: true },
  });

  return NextResponse.json(user, { status: 201 });
}
