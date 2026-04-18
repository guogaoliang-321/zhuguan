import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, unauthorized, badRequest, forbidden } from "@/lib/api-utils";
import {
  canCreateProject,
  projectVisibilityFilter,
} from "@/lib/permissions";
import { z } from "zod";

const createProjectSchema = z.object({
  name: z.string().min(1, "项目名称不能为空"),
  contractNo: z.string().optional().nullable(),
  contractAmount: z.number().optional().nullable(),
  clientName: z.string().min(1, "甲方名称不能为空"),
  clientContact: z.string().optional().nullable(),
  projectType: z.string().optional().nullable(),
  phase: z.enum(["SCHEME", "PRELIMINARY", "CONSTRUCTION", "COMPLETION"]).default("SCHEME"),
  status: z.enum(["ACTIVE", "PAUSED", "COMPLETED", "ARCHIVED"]).default("ACTIVE"),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  leadId: z.string().min(1, "项目负责人不能为空"),
  description: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  buildingArea: z.number().optional().nullable(),
});

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { searchParams } = new URL(request.url);
  const phase = searchParams.get("phase");
  const status = searchParams.get("status");
  const leadId = searchParams.get("leadId");
  const search = searchParams.get("search");

  const visibility = projectVisibilityFilter(session.user);
  const filters: Record<string, unknown> = {};
  if (phase) filters.phase = phase;
  if (status) filters.status = status;
  if (leadId) filters.leadId = leadId;
  if (search) {
    filters.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { clientName: { contains: search, mode: "insensitive" } },
      { contractNo: { contains: search, mode: "insensitive" } },
    ];
  }

  const where = { AND: [visibility, filters] };

  const projects = await prisma.project.findMany({
    where,
    include: {
      lead: { select: { id: true, name: true } },
      _count: { select: { milestones: true, members: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json(projects);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!canCreateProject(session.user)) return forbidden();

  const body = await request.json();
  const parsed = createProjectSchema.safeParse(body);

  if (!parsed.success) {
    return badRequest(parsed.error.issues[0].message);
  }

  const data = parsed.data;

  const project = await prisma.project.create({
    data: {
      name: data.name,
      contractNo: data.contractNo ?? null,
      contractAmount: data.contractAmount ?? null,
      clientName: data.clientName,
      clientContact: data.clientContact ?? null,
      projectType: data.projectType ?? null,
      phase: data.phase,
      status: data.status,
      startDate: data.startDate ? new Date(data.startDate) : null,
      endDate: data.endDate ? new Date(data.endDate) : null,
      leadId: data.leadId,
      description: data.description ?? null,
      address: data.address ?? null,
      buildingArea: data.buildingArea ?? null,
    },
    include: {
      lead: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(project, { status: 201 });
}
