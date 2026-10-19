export type ImportSummary = {
  batchId: string;
  status: "COMPLETED" | "COMPLETED_WITH_ERRORS" | "FAILED";
  totalRows: number;
  successfulRows: number;
  failedRows: number;
  unmatched: { biometricId: string; name: string | null; rows: number }[];
  processing?: ProcessingInfo | null;
  processingError?: string;
};

export type ProcessingInfo = {
  processed: number;
  byStatus: Record<string, number>;
};