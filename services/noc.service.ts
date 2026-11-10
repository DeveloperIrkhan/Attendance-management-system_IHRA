import "server-only";
import { prisma } from "@/lib/prisma";
import { ServiceError } from "@/lib/action-state";
import type { Prisma } from "@/lib/generated/prisma/client";
import { getApproverIdentity, type AuthUser } from "@/lib/auth/authorization";
import { canIssueNoc } from "@/lib/auth/permissions";
import {
  APPROVER_LABEL,
  canDecideRequest,
  levelsAbove,
  type ApproverIdentity,
  type ApproverLevel,
} from "@/lib/leave/approval-routing";
import {
  checkNocDecision,
  parseNocCategory,
  startNocRoute,
  type NocApproverLevel,
  type NocDecision,
  type NocStatus,
} from "@/lib/noc/flow";
import { inspectNocFile } from "@/lib/noc/file";

/** A person may have this many open requests (waiting or approved but not issued) at a time. */
const MAX_OPEN_REQUESTS = 5;

const userCanIssue = (user: AuthUser) => canIssueNoc(user.role.permissions);

/** An active DD with a login in this department, or one who holds additional charge of it. */
async function findDepartmentDd(requesterId: string, departmentId: string) {
  return prisma.employee.findFirst({
    where: {
      id: { not: requesterId },
      isActive: true,
      designation: { approvalLevel: "DD" },
      user: { is: { isActive: true } },
      OR: [
        { departmentId },
        { additionalCharges: { some: { departmentId } } },
      ],
    },
    select: { id: true },
  });
}

/** Is there an active CEO / Chairman (or acting CEO) login who could answer? */
async function hasFinalApprover(level: NocApproverLevel, excludeId: string) {
  const levels = [level, ...levelsAbove(level as ApproverLevel)];
  const found = await prisma.employee.findFirst({
    where: {
      id: { not: excludeId },
      isActive: true,
      user: { is: { isActive: true } },
      OR: [
        { designation: { approvalLevel: { in: levels } } },
        { actingApprovals: { some: { level: { in: levels } } } },
      ],
    },
    select: { id: true },
  });
  return Boolean(found);
}

export async function createNocRequest(
  user: AuthUser,
  input: {
    category: string;
    purpose: string;
    addressedTo: string | null;
    neededBy: Date | null;
  },
) {
  if (!user.employeeId) {
    throw new ServiceError("Your login is not linked to an employee record. Please contact HR.");
  }
  const employee = await prisma.employee.findUnique({
    where: { id: user.employeeId },
    select: { id: true, departmentId: true, isActive: true },
  });
  if (!employee || !employee.isActive) {
    throw new ServiceError("Your employee record is not active.");
  }

  const open = await prisma.nocRequest.count({
    where: {
      employeeId: employee.id,
      status: { in: ["PENDING_DD", "PENDING_FINAL", "APPROVED"] },
    },
  });
  if (open >= MAX_OPEN_REQUESTS) {
    throw new ServiceError(
      `You already have ${open} open NOC requests. Wait for them to be finished or cancel one first.`,
    );
  }

  const level = getApproverIdentity(user)?.level ?? "STAFF";
  const departmentDd =
    level === "STAFF" ? await findDepartmentDd(employee.id, employee.departmentId) : null;
  const route = startNocRoute({ requesterLevel: level, hasDepartmentDd: Boolean(departmentDd) });

  if (route.status === "PENDING_FINAL" && route.approverLevel && route.approverLevel !== "DD") {
    if (!(await hasFinalApprover(route.approverLevel, employee.id))) {
      throw new ServiceError(
        `No active ${APPROVER_LABEL[route.approverLevel]} login exists to answer this request. Ask HR to set the approval level on the designation, or to assign an acting CEO on the Departments page.`,
      );
    }
  }

  return prisma.nocRequest.create({
    data: {
      employeeId: employee.id,
      category: parseNocCategory(input.category),
      purpose: input.purpose,
      addressedTo: input.addressedTo,
      neededBy: input.neededBy,
      status: route.status,
      approverLevel: route.approverLevel,
      approverDepartmentId:
        route.status === "PENDING_DD" ? employee.departmentId : null,
    },
  });
}

const requestInclude = {
  employee: {
    select: {
      name: true,
      employeeCode: true,
      department: { select: { name: true } },
      designation: { select: { title: true } },
    },
  },
  document: {
    select: { id: true, fileName: true, size: true, uploadedAt: true },
  },
} satisfies Prisma.NocRequestInclude;

/** Names of the people who decided, looked up once for a list of requests. */
async function decisionNames<
  T extends {
    ddDecidedById: string | null;
    finalDecidedById: string | null;
    issuedById: string | null;
  },
>(requests: T[]) {
  const ids = new Set<string>();
  for (const r of requests) {
    for (const id of [r.ddDecidedById, r.finalDecidedById, r.issuedById]) {
      if (id) ids.add(id);
    }
  }
  const users = ids.size
    ? await prisma.user.findMany({
        where: { id: { in: [...ids] } },
        select: { id: true, fullName: true },
      })
    : [];
  const names = new Map(users.map((u) => [u.id, u.fullName]));
  return requests.map((r) => ({
    ...r,
    ddName: r.ddDecidedById ? (names.get(r.ddDecidedById) ?? null) : null,
    finalName: r.finalDecidedById ? (names.get(r.finalDecidedById) ?? null) : null,
    issuedName: r.issuedById ? (names.get(r.issuedById) ?? null) : null,
  }));
}

export async function listMyNocRequests(employeeId: string) {
  const rows = await prisma.nocRequest.findMany({
    where: { employeeId },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: requestInclude,
  });
  return decisionNames(rows);
}

/** Requests waiting for this person's yes / no, by level (parent rights included). */
function pendingWhere(me: ApproverIdentity): Prisma.NocRequestWhereInput {
  const or: Prisma.NocRequestWhereInput[] = [];
  if (me.level === "DD") {
    or.push({
      status: "PENDING_DD",
      approverDepartmentId: {
        in: [me.departmentId, ...(me.chargeDepartmentIds ?? [])],
      },
    });
  }
  if (me.level === "CEO" || me.level === "CHAIRMAN") {
    or.push({ status: "PENDING_DD" }); // the CEO can answer at the DD step too
  }
  if (me.level === "CEO") {
    or.push({ status: "PENDING_FINAL", approverLevel: "CEO" });
  }
  if (me.level === "CHAIRMAN") {
    or.push({ status: "PENDING_FINAL", approverLevel: { in: ["CEO", "CHAIRMAN"] } });
  }
  return { OR: or.length ? or : [{ id: "none" }], employeeId: { not: me.employeeId } };
}

export async function listPendingNocForApprover(user: AuthUser) {
  const me = getApproverIdentity(user);
  if (!me || me.level === "STAFF") return [];
  const rows = await prisma.nocRequest.findMany({
    where: pendingWhere(me),
    orderBy: { createdAt: "asc" },
    take: 200,
    include: requestInclude,
  });
  return decisionNames(rows);
}

export async function countPendingNocForApprover(user: AuthUser) {
  const me = getApproverIdentity(user);
  if (!me || me.level === "STAFF") return 0;
  return prisma.nocRequest.count({ where: pendingWhere(me) });
}

export function countNocAwaitingIssue() {
  return prisma.nocRequest.count({ where: { status: "APPROVED" } });
}

/** HR / Admin: every request, newest first, optionally one status. */
export async function listNocForIssuers(user: AuthUser, status?: NocStatus) {
  if (!userCanIssue(user)) throw new ServiceError("You cannot view all NOC requests.");
  const rows = await prisma.nocRequest.findMany({
    where: status ? { status } : {},
    orderBy: [{ createdAt: "desc" }],
    take: 300,
    include: requestInclude,
  });
  return decisionNames(rows);
}

export async function decideNocRequest(
  id: string,
  decision: NocDecision,
  user: AuthUser,
  note?: string,
) {
  const request = await prisma.nocRequest.findUnique({ where: { id } });
  if (!request) throw new ServiceError("This NOC request was not found.");

  const me = getApproverIdentity(user);
  const isDesignatedApprover = canDecideRequest(
    me,
    request.status === "PENDING_DD"
      ? {
          employeeId: request.employeeId,
          approverLevel: "DD",
          approverDepartmentId: request.approverDepartmentId,
        }
      : {
          employeeId: request.employeeId,
          approverLevel: request.approverLevel as ApproverLevel | null,
          approverDepartmentId: null,
        },
  );

  const check = checkNocDecision({
    status: request.status,
    decision,
    isDesignatedApprover,
    isOwnRequest: user.employeeId === request.employeeId,
    deciderLevel: me?.level ?? "STAFF",
  });
  if (!check.ok) throw new ServiceError(check.error);

  const cleanNote = note?.trim() || null;
  const now = new Date();
  const { next } = check;

  // updateMany with the old status: if two people decide at once, only the first one wins
  const result = await prisma.nocRequest.updateMany({
    where: { id, status: request.status },
    data: {
      status: next.status,
      approverLevel: next.approverLevel,
      approverDepartmentId: next.status === "PENDING_DD" ? request.approverDepartmentId : null,
      rejectedStage: next.rejectedStage,
      ...(next.recordsDd
        ? { ddDecidedById: user.id, ddDecidedAt: now, ddNote: cleanNote }
        : {}),
      ...(next.recordsFinal
        ? { finalDecidedById: user.id, finalDecidedAt: now, finalNote: cleanNote }
        : {}),
    },
  });
  if (result.count !== 1) {
    throw new ServiceError("This request was just decided by someone else. Please refresh.");
  }
}

/** HR / Admin upload the NOC document. Uploading again replaces the file. */
export async function issueNoc(user: AuthUser, id: string, file: File) {
  if (!userCanIssue(user)) throw new ServiceError("You cannot issue NOC documents.");
  const request = await prisma.nocRequest.findUnique({
    where: { id },
    select: { id: true, status: true, employeeId: true },
  });
  if (!request) throw new ServiceError("This NOC request was not found.");
  if (request.status !== "APPROVED" && request.status !== "ISSUED") {
    throw new ServiceError("A NOC can be uploaded only after the CEO has approved the request.");
  }
  if (request.employeeId === user.employeeId) {
    throw new ServiceError("You cannot issue your own NOC. Ask another HR or Admin user.");
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const check = inspectNocFile(file.name, bytes);
  if (!check.ok) throw new ServiceError(check.error);

  await prisma.$transaction([
    prisma.nocDocument.upsert({
      where: { nocRequestId: id },
      create: {
        nocRequestId: id,
        fileName: check.fileName,
        mimeType: check.mimeType,
        size: check.size,
        data: bytes,
        uploadedById: user.id,
      },
      update: {
        fileName: check.fileName,
        mimeType: check.mimeType,
        size: check.size,
        data: bytes,
        uploadedById: user.id,
        uploadedAt: new Date(),
      },
    }),
    prisma.nocRequest.update({
      where: { id },
      data: { status: "ISSUED", issuedById: user.id, issuedAt: new Date() },
    }),
  ]);
}

/**
 * The document, for the person it was issued to, or for HR / Admin. Anyone else gets null.
 * The employee can download only once the NOC is issued.
 */
export async function getNocDocumentFor(user: AuthUser, id: string) {
  const request = await prisma.nocRequest.findUnique({
    where: { id },
    select: {
      employeeId: true,
      status: true,
      document: { select: { fileName: true, mimeType: true, data: true } },
    },
  });
  if (!request?.document) return null;
  const isOwner = user.employeeId === request.employeeId && request.status === "ISSUED";
  if (!isOwner && !userCanIssue(user)) return null;
  return request.document;
}

