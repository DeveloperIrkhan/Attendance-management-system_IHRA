const styles: Record<string, string> = {
  COMPLETED: "bg-green-100 text-green-800",
  COMPLETED_WITH_ERRORS: "bg-amber-100 text-amber-800",
  FAILED: "bg-red-100 text-red-800",
  PROCESSING: "bg-blue-100 text-blue-800",
  UPLOADED: "bg-zinc-200 text-zinc-700",
};

export default function ImportStatusBadge({ status }: { status: string }) {
  return (
    <span className={`rounded px-2 py-0.5 text-xs ${styles[status] ?? styles.UPLOADED}`}>
      {status.replaceAll("_", " ")}
    </span>
  );
}