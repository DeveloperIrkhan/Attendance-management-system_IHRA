const styles: Record<string, string> = {
  PENDING: "bg-amber-200 text-amber-800",
  APPROVED: "bg-green-200 text-green-800",
  REJECTED: "bg-red-200 text-red-800",
  CANCELLED: "bg-pink-200 text-pink-700",
};

export default function LeaveStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`rounded px-2 py-0.5 text-xs ${styles[status] ?? "bg-zinc-100 text-zinc-700"}`}
    >
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}
