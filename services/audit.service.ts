import "server-only";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/authorization";
import type { Prisma } from "@/lib/generated/prisma/client";

export type AuditActor = { id: string | null; name: string };

export type AuditInput = {
  /** machine name, e.g. "settings.update" */
  action: string;
  /** what was changed, e.g. "AttendanceSettings" */
  entity: string;
  entityId?: string | null;
  /** one readable sentence for the log list */
  summary: string;
  before?: unknown;
  after?: unknown;
  /** defaults to the signed-in user; pass it when the caller already has it */
  actor?: AuditActor;
};

/** The signed-in person, or "System" when there is no request (a background script). */
async function currentActor(): Promise<AuditActor> {
  try {
    const user = await getCurrentUser();
    if (user) return { id: user.id, name: user.fullName };
  } catch {
    // no request context: getSession() cannot read cookies
  }
  return { id: null, name: "System" };
}

/** JSON-safe copy, so Dates and Prisma rows can be stored. */
function jsonValue(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

/**
 * Writes one audit entry. Best-effort: a failed log must never break the change the
 * person asked for, so the error is logged and swallowed.
 */
export async function recordAudit(input: AuditInput): Promise<void> {
  try {
    const actor = input.actor ?? (await currentActor());
    await prisma.auditLog.create({
      data: {
        actorId: actor.id,
        actorName: actor.name,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId ?? null,
        summary: input.summary,
        before: jsonValue(input.before),
        after: jsonValue(input.after),
      },
    });
  } catch (error) {
    console.error("Could not write the audit log entry:", error);
  }
}

export const AUDIT_PAGE_SIZE = 50;

export type AuditFilters = {
  text?: string;
  entity?: string;
  action?: string;
  actorId?: string;
  page?: number;
};

export async function listAuditLogs(filters: AuditFilters) {
  const page = Math.max(1, filters.page ?? 1);
  const where: Prisma.AuditLogWhereInput = {};
  if (filters.text) {
    where.OR = [
      { summary: { contains: filters.text, mode: "insensitive" } },
      { actorName: { contains: filters.text, mode: "insensitive" } },
      { entityId: { contains: filters.text, mode: "insensitive" } },
    ];
  }
  if (filters.entity) where.entity = filters.entity;
  if (filters.action) where.action = filters.action;
  if (filters.actorId) where.actorId = filters.actorId;

  const [items, total] = await prisma.$transaction([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * AUDIT_PAGE_SIZE,
      take: AUDIT_PAGE_SIZE,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    items,
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE)),
  };
}

/** The distinct entities and actions, for the filter dropdowns. */
export async function listAuditFacets() {
  const [entities, actions] = await Promise.all([
    prisma.auditLog.findMany({
      distinct: ["entity"],
      select: { entity: true },
      orderBy: { entity: "asc" },
    }),
    prisma.auditLog.findMany({
      distinct: ["action"],
      select: { action: true },
      orderBy: { action: "asc" },
    }),
  ]);
  return {
    entities: entities.map((e) => e.entity),
    actions: actions.map((a) => a.action),
  };
}
