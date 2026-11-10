import { nocStatusLabel, type NocApproverLevel, type NocStatus } from "@/lib/noc/flow";

const STYLE: Record<NocStatus, string> = {
  PENDING_DD: "bg-amber-100 text-amber-800",
  PENDING_FINAL: "bg-amber-100 text-amber-800",
  APPROVED: "bg-blue-100 text-blue-800",
  ISSUED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
  CANCELLED: "bg-zinc-100 text-zinc-600",
};

export default function NocStatusBadge({
  status,
  approverLevel,
}: {
  status: NocStatus;
  approverLevel: NocApproverLevel | null;
}) {
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${STYLE[status]}`}>
      {nocStatusLabel(status, approverLevel)}
    </span>
  );
}
