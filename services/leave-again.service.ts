import "server-only";
import { prisma } from "@/lib/prisma";

/** One of this employee's own rejected requests, used to fill the form for "Request Again". */
export function getMyRejectedRequest(employeeId: string, id: string) {
  return prisma.leaveRequest.findFirst({
    where: { id, employeeId, status: "REJECTED" },
    select: { leaveTypeId: true, startDate: true, endDate: true, reason: true },
  });
}
