/**
 * Phase 1 演示数据 seed（幂等：清掉旧 tasks 重写；项目和成员若已存在不重复创建）
 *
 * 运行：npx tsx prisma/seed-tasks.ts
 *
 * 注：使用本地 DB 中真实用户（40 名同事），按职位/专业自动分配项目角色
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { ProjectPhase, ProjectStatus } from "../src/generated/prisma/enums.js";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg(process.env.DATABASE_URL!);
const prisma = new PrismaClient({ adapter });

function addDays(base: Date, days: number, hour = 9): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  d.setHours(hour, 0, 0, 0);
  return d;
}

async function main() {
  console.log("🧹 清理旧的 Task / TaskStatusLog...");
  await prisma.taskStatusLog.deleteMany({});
  await prisma.task.deleteMany({});

  // ========= 用户检索 =========
  const users = await prisma.user.findMany();
  const u = (uname: string) => {
    const found = users.find((x) => x.username === uname);
    if (!found) throw new Error(`用户 ${uname} 不存在`);
    return found;
  };

  // 真实人员（按本地 DB 现状）
  const guo = u("guogaoliang"); // 郭高亮 ADMIN
  // 建筑 PM
  const wangyanjun = u("wangyanjun"); // 王艳俊（建筑高级）
  const yangyi = u("yangyi"); // 杨毅
  const liujingshan = u("liujingshan"); // 刘静珊
  const caoqiang = u("caoqiang"); // 曹强
  // 各专业 PM
  const leijian = u("leijian"); // 雷健（结构正高）
  const zhaobo = u("zhaobo"); // 赵博（给排水正高）
  const jiangzhong = u("jiangzhong"); // 蒋忠（暖通正高）
  const huangle = u("huangle"); // 黄乐（电气）
  // 建筑 MEMBER
  const wutong = u("wutong");
  const dengqianze = u("dengqianze");
  const zhangchunsheng = u("zhangchunsheng");
  const zhaoxi = u("zhaoxi");
  const chensu = u("chensu");
  const xingjunzhe = u("xingjunzhe");
  // 结构 MEMBER
  const zhanghui = u("zhanghui");
  const yanglei = u("yanglei");
  const jiangzhilin = u("jiangzhilin");
  // 给排水
  const wujingtao = u("wujingtao");
  // 暖通 MEMBER
  const zhangshitao = u("zhangshitao");
  const fengye = u("fengye");
  // 电气 MEMBER
  const wangrong = u("wangrong");

  // ========= 项目（若不存在则创建）=========
  const projectDefs = [
    {
      contractNo: "ZGDEMO-001",
      name: "西安市中心医院门急诊综合楼",
      lead: wangyanjun,
      phase: ProjectPhase.CONSTRUCTION,
      contractAmount: 680,
      buildingArea: 45000,
      address: "西安市碑林区",
      clientName: "西安市卫健委",
      members: [
        { user: zhanghui, role: "结构设计" },
        { user: wujingtao, role: "给排水设计" },
        { user: fengye, role: "暖通设计" },
        { user: wutong, role: "建筑助理" },
      ],
    },
    {
      contractNo: "ZGDEMO-002",
      name: "咸阳市第一人民医院住院楼改造",
      lead: yangyi,
      phase: ProjectPhase.PRELIMINARY,
      contractAmount: 320,
      buildingArea: 18000,
      address: "咸阳市秦都区",
      clientName: "咸阳市第一人民医院",
      members: [
        { user: dengqianze, role: "建筑设计" },
        { user: yanglei, role: "结构加固" },
        { user: zhangshitao, role: "暖通设计" },
      ],
    },
    {
      contractNo: "ZGDEMO-003",
      name: "宝鸡市妇幼保健院新建工程",
      lead: liujingshan,
      phase: ProjectPhase.SCHEME,
      contractAmount: 520,
      buildingArea: 35000,
      address: "宝鸡市金台区",
      clientName: "宝鸡市卫健委",
      members: [
        { user: zhangchunsheng, role: "建筑设计" },
        { user: zhaoxi, role: "建筑设计" },
        { user: jiangzhilin, role: "结构设计" },
      ],
    },
    {
      contractNo: "ZGDEMO-004",
      name: "延安大学附属医院科研楼",
      lead: guo,
      phase: ProjectPhase.CONSTRUCTION,
      contractAmount: 890,
      buildingArea: 28000,
      address: "延安市宝塔区",
      clientName: "延安大学",
      members: [
        { user: caoqiang, role: "建筑设计" },
        { user: leijian, role: "结构总顾问" },
        { user: wujingtao, role: "给排水设计" },
        { user: jiangzhong, role: "暖通设计" },
      ],
    },
    {
      contractNo: "ZGDEMO-005",
      name: "榆林市人民医院传染病区",
      lead: zhaobo,
      phase: ProjectPhase.PRELIMINARY,
      contractAmount: 450,
      buildingArea: 15000,
      address: "榆林市榆阳区",
      clientName: "榆林市人民医院",
      members: [
        { user: yangyi, role: "建筑专业" },
        { user: chensu, role: "建筑助理" },
        { user: jiangzhong, role: "暖通负责" },
        { user: huangle, role: "电气负责" },
      ],
    },
    {
      contractNo: "ZGDEMO-006",
      name: "铜川市中医医院门诊楼",
      lead: caoqiang,
      phase: ProjectPhase.COMPLETION,
      contractAmount: 210,
      buildingArea: 12000,
      address: "铜川市耀州区",
      clientName: "铜川市卫健委",
      members: [
        { user: xingjunzhe, role: "建筑设计" },
        { user: zhanghui, role: "结构设计" },
        { user: wangrong, role: "电气设计" },
      ],
    },
  ];

  console.log(`📂 检查/创建 ${projectDefs.length} 个项目 + 成员关系...`);
  const projectIdByContract = new Map<string, string>();

  for (const pd of projectDefs) {
    const existing = await prisma.project.findUnique({
      where: { contractNo: pd.contractNo },
    });
    let projectId: string;
    if (existing) {
      projectId = existing.id;
    } else {
      const created = await prisma.project.create({
        data: {
          contractNo: pd.contractNo,
          name: pd.name,
          leadId: pd.lead.id,
          phase: pd.phase,
          status: ProjectStatus.ACTIVE,
          contractAmount: pd.contractAmount,
          buildingArea: pd.buildingArea,
          clientName: pd.clientName,
          address: pd.address,
          projectType: "医疗",
        },
      });
      projectId = created.id;
    }
    projectIdByContract.set(pd.contractNo, projectId);

    // 同步成员（缺失则补，已有不重复）
    for (const m of pd.members) {
      const existed = await prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId, userId: m.user.id } },
      });
      if (!existed) {
        await prisma.projectMember.create({
          data: { projectId, userId: m.user.id, role: m.role },
        });
      }
    }
  }

  const pid = (contractNo: string) => {
    const id = projectIdByContract.get(contractNo);
    if (!id) throw new Error(`项目 ${contractNo} 未创建`);
    return { id };
  };

  const today = new Date();

  type TaskSeed = {
    name: string;
    description?: string;
    project: { id: string };
    specialty: string;
    assignee: { id: string };
    creator: { id: string };
    estimatedHours: number;
    priority?: "normal" | "urgent";
    isInsertion?: boolean;
    insertionReason?: string;
    startOffset: number;
    endOffset: number;
    finalStatus: "pending" | "in_progress" | "done" | "overdue";
    pmConfirmed?: boolean;
    overdueReason?: string;
  };

  const xianCenter = pid("ZGDEMO-001");
  const xianyangHosp = pid("ZGDEMO-002");
  const baojiMaternal = pid("ZGDEMO-003");
  const yanan = pid("ZGDEMO-004");
  const yulin = pid("ZGDEMO-005");

  const seedData: TaskSeed[] = [
    // ===== 西安中心医院（王艳俊 PM）=====
    {
      name: "施工图建筑专业 · 三至五层平面图",
      project: xianCenter,
      specialty: "建筑",
      assignee: wangyanjun,
      creator: wangyanjun,
      estimatedHours: 24,
      startOffset: -3,
      endOffset: 4,
      finalStatus: "in_progress",
    },
    {
      name: "施工图建筑专业 · 一二层平面与立面",
      project: xianCenter,
      specialty: "建筑",
      assignee: wutong,
      creator: wangyanjun,
      estimatedHours: 32,
      startOffset: -7,
      endOffset: -1,
      finalStatus: "done",
      pmConfirmed: true,
    },
    {
      name: "结构施工图 · 地下室底板配筋图",
      project: xianCenter,
      specialty: "结构",
      assignee: zhanghui,
      creator: wangyanjun,
      estimatedHours: 20,
      startOffset: -2,
      endOffset: 5,
      finalStatus: "in_progress",
    },
    {
      name: "给排水施工图 · 消防系统计算书",
      project: xianCenter,
      specialty: "给排水",
      assignee: wujingtao,
      creator: wangyanjun,
      estimatedHours: 16,
      startOffset: 2,
      endOffset: 7,
      finalStatus: "pending",
    },
    {
      name: "暖通施工图 · 手术室净化系统",
      project: xianCenter,
      specialty: "暖通",
      assignee: fengye,
      creator: wangyanjun,
      estimatedHours: 28,
      startOffset: 0,
      endOffset: 8,
      finalStatus: "in_progress",
    },
    {
      name: "【插队】门诊大厅自助挂号区方案调整",
      description: "甲方要求新增 200㎡ 自助挂号区，需调整首层平面",
      project: xianCenter,
      specialty: "建筑",
      assignee: wangyanjun,
      creator: wangyanjun,
      estimatedHours: 12,
      priority: "urgent",
      isInsertion: true,
      insertionReason: "甲方临时要求优先推进，影响后续平面图所有版本",
      startOffset: -1,
      endOffset: 2,
      finalStatus: "in_progress",
    },

    // ===== 咸阳住院楼（杨毅 PM）=====
    {
      name: "初设建筑专业 · 改造方案图纸",
      project: xianyangHosp,
      specialty: "建筑",
      assignee: yangyi,
      creator: yangyi,
      estimatedHours: 30,
      startOffset: -10,
      endOffset: -2,
      finalStatus: "done",
      pmConfirmed: true,
    },
    {
      name: "结构加固方案 · 既有楼板补强",
      project: xianyangHosp,
      specialty: "结构",
      assignee: yanglei,
      creator: yangyi,
      estimatedHours: 18,
      startOffset: -5,
      endOffset: 3,
      finalStatus: "in_progress",
    },
    {
      name: "现场补充测绘",
      description: "原结构图纸与现状有出入，需重新核对",
      project: xianyangHosp,
      specialty: "建筑",
      assignee: dengqianze,
      creator: yangyi,
      estimatedHours: 14,
      startOffset: -8,
      endOffset: -3,
      finalStatus: "overdue",
      overdueReason: "现场协调时间延迟，甲方未按时安排陪同",
    },
    {
      name: "初设文件整理与提交",
      project: xianyangHosp,
      specialty: "建筑",
      assignee: yangyi,
      creator: yangyi,
      estimatedHours: 16,
      startOffset: 5,
      endOffset: 12,
      finalStatus: "pending",
    },

    // ===== 宝鸡妇幼（刘静珊 PM，已逾期）=====
    {
      name: "概念方案文本编制",
      project: baojiMaternal,
      specialty: "建筑",
      assignee: liujingshan,
      creator: liujingshan,
      estimatedHours: 40,
      startOffset: -14,
      endOffset: -3,
      finalStatus: "overdue",
      overdueReason: "甲方反复变更床位数和功能要求，方案推倒重做两次",
    },
    {
      name: "方案深化 · 功能分区调整",
      project: baojiMaternal,
      specialty: "建筑",
      assignee: zhangchunsheng,
      creator: liujingshan,
      estimatedHours: 24,
      startOffset: 1,
      endOffset: 8,
      finalStatus: "pending",
    },
    {
      name: "结构方案配合",
      project: baojiMaternal,
      specialty: "结构",
      assignee: jiangzhilin,
      creator: liujingshan,
      estimatedHours: 8,
      startOffset: 3,
      endOffset: 7,
      finalStatus: "pending",
    },

    // ===== 延安科研楼（郭高亮 ADMIN 自任 PM）=====
    {
      name: "施工图终版校审",
      project: yanan,
      specialty: "建筑",
      assignee: caoqiang,
      creator: guo,
      estimatedHours: 16,
      priority: "urgent",
      startOffset: -1,
      endOffset: 3,
      finalStatus: "in_progress",
    },
    {
      name: "P2+ 实验室气密性专项",
      description: "等级调整为 P2+，需补充气密性和排风设计",
      project: yanan,
      specialty: "暖通",
      assignee: jiangzhong,
      creator: guo,
      estimatedHours: 20,
      priority: "urgent",
      isInsertion: true,
      insertionReason: "实验室生物安全等级提升导致设计调整",
      startOffset: 0,
      endOffset: 6,
      finalStatus: "pending",
    },
    {
      name: "实验室给排水深化",
      project: yanan,
      specialty: "给排水",
      assignee: wujingtao,
      creator: guo,
      estimatedHours: 14,
      startOffset: 4,
      endOffset: 10,
      finalStatus: "pending",
    },

    // ===== 榆林传染病区（赵博 PM）=====
    {
      name: "负压病房给排水系统方案",
      project: yulin,
      specialty: "给排水",
      assignee: zhaobo,
      creator: zhaobo,
      estimatedHours: 22,
      startOffset: -6,
      endOffset: 1,
      finalStatus: "in_progress",
    },
    {
      name: "院感流线方案审核",
      project: yulin,
      specialty: "建筑",
      assignee: yangyi,
      creator: zhaobo,
      estimatedHours: 12,
      startOffset: 6,
      endOffset: 11,
      finalStatus: "pending",
    },
    {
      name: "PCR 实验室专项设计",
      project: yulin,
      specialty: "暖通",
      assignee: jiangzhong,
      creator: zhaobo,
      estimatedHours: 18,
      startOffset: 8,
      endOffset: 15,
      finalStatus: "pending",
    },
    {
      name: "PCR 实验室电气专项",
      project: yulin,
      specialty: "电气",
      assignee: huangle,
      creator: zhaobo,
      estimatedHours: 12,
      startOffset: 10,
      endOffset: 16,
      finalStatus: "pending",
    },

    // ===== 跨项目高负荷场景：让 caoqiang 下下周饱和过载 =====
    {
      name: "宝鸡妇幼 · 方案汇报材料",
      project: baojiMaternal,
      specialty: "建筑",
      assignee: caoqiang,
      creator: liujingshan,
      estimatedHours: 18,
      priority: "urgent",
      startOffset: 9,
      endOffset: 13,
      finalStatus: "pending",
    },
    {
      name: "咸阳住院楼 · 立面优化",
      project: xianyangHosp,
      specialty: "建筑",
      assignee: caoqiang,
      creator: yangyi,
      estimatedHours: 14,
      startOffset: 11,
      endOffset: 16,
      finalStatus: "pending",
    },

    // ===== 让 jiangzhong 也饱和：暖通专业三个项目都要他 =====
    {
      name: "西安中心医院 · 空调水管路图深化",
      project: xianCenter,
      specialty: "暖通",
      assignee: jiangzhong,
      creator: wangyanjun,
      estimatedHours: 20,
      startOffset: 6,
      endOffset: 13,
      finalStatus: "pending",
    },

    // ===== 让 wangyanjun 第 3 周也饱和 =====
    {
      name: "施工图审查反馈整改",
      project: xianCenter,
      specialty: "建筑",
      assignee: wangyanjun,
      creator: wangyanjun,
      estimatedHours: 24,
      startOffset: 14,
      endOffset: 21,
      finalStatus: "pending",
    },
  ];

  console.log(`📝 写入 ${seedData.length} 条任务...`);

  for (const td of seedData) {
    const plannedStart = addDays(today, td.startOffset);
    const plannedEnd = addDays(today, td.endOffset, 18);

    let completedAt: Date | null = null;
    let pmConfirmedAt: Date | null = null;
    if (td.finalStatus === "done") {
      completedAt = addDays(today, td.endOffset - 1, 17);
      if (td.pmConfirmed) {
        pmConfirmedAt = addDays(today, td.endOffset, 10);
      }
    }

    const task = await prisma.task.create({
      data: {
        name: td.name,
        description: td.description ?? null,
        projectId: td.project.id,
        specialty: td.specialty,
        assigneeId: td.assignee.id,
        createdById: td.creator.id,
        estimatedHours: td.estimatedHours,
        priority: td.priority ?? "normal",
        isInsertion: td.isInsertion ?? false,
        insertionReason: td.insertionReason ?? null,
        plannedStart,
        plannedEnd,
        status: td.finalStatus,
        completedAt,
        pmConfirmedAt,
      },
    });

    const createdAt = new Date(plannedStart);
    createdAt.setDate(createdAt.getDate() - 1);

    await prisma.taskStatusLog.create({
      data: {
        taskId: task.id,
        fromStatus: null,
        toStatus: "pending",
        reason: td.isInsertion
          ? `插队创建：${td.insertionReason}`
          : "新建任务",
        changedById: td.creator.id,
        changedAt: createdAt,
      },
    });

    if (
      td.finalStatus === "in_progress" ||
      td.finalStatus === "done" ||
      td.finalStatus === "overdue"
    ) {
      await prisma.taskStatusLog.create({
        data: {
          taskId: task.id,
          fromStatus: "pending",
          toStatus: "in_progress",
          reason: "开始任务",
          changedById: td.assignee.id,
          changedAt: new Date(plannedStart),
        },
      });
    }

    if (td.finalStatus === "done") {
      await prisma.taskStatusLog.create({
        data: {
          taskId: task.id,
          fromStatus: "in_progress",
          toStatus: "done",
          reason: "员工标记完成",
          changedById: td.assignee.id,
          changedAt: completedAt ?? new Date(),
        },
      });
      if (td.pmConfirmed && pmConfirmedAt) {
        await prisma.taskStatusLog.create({
          data: {
            taskId: task.id,
            fromStatus: "done",
            toStatus: "done",
            reason: "PM 确认完成",
            changedById: td.creator.id,
            changedAt: pmConfirmedAt,
          },
        });
      }
    }

    if (td.finalStatus === "overdue" && td.overdueReason) {
      const overdueAt = new Date(plannedEnd);
      overdueAt.setHours(overdueAt.getHours() + 6);
      await prisma.taskStatusLog.create({
        data: {
          taskId: task.id,
          fromStatus: "in_progress",
          toStatus: "overdue",
          reason: td.overdueReason,
          changedById: td.assignee.id,
          changedAt: overdueAt,
        },
      });
    }
  }

  // ===== 关联部分实际工时（让"预估 vs 实际"有数据）=====
  console.log("⏱  关联部分工时到任务...");
  const completedTask = await prisma.task.findFirst({
    where: { status: "done", name: { contains: "一二层平面" } },
  });
  if (completedTask) {
    const startDate = addDays(today, -7);
    for (let i = 0; i < 6; i++) {
      const d = addDays(startDate, i, 9);
      await prisma.workLog.create({
        data: {
          userId: completedTask.assigneeId,
          projectId: completedTask.projectId,
          taskId: completedTask.id,
          date: d,
          hours: 6,
          content: `${completedTask.name} - 第${i + 1}天`,
          category: "施工图出图",
        },
      });
    }
  }

  const counts = seedData.reduce<Record<string, number>>((acc, t) => {
    acc[t.finalStatus] = (acc[t.finalStatus] ?? 0) + 1;
    return acc;
  }, {});

  console.log("\n✅ 演示数据 seed 完成");
  console.log(`   项目：${projectDefs.length}`);
  console.log(`   任务：${seedData.length}（${JSON.stringify(counts)})`);
  console.log(`   插队：${seedData.filter((t) => t.isInsertion).length}`);
  console.log(`   紧急：${seedData.filter((t) => t.priority === "urgent").length}`);
  console.log("");
  console.log("登录验收：");
  console.log("  管理员 guogaoliang / admin123");
  console.log("  PM 王艳俊 wangyanjun / 王艳俊123（密码看 import 时设置）");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
