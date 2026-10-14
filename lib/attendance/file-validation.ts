import { ServiceError } from "@/lib/action-state";

export const MAX_FILE_SIZE = 10 * 1024 * 1024;

/** Step 1 of the pipeline: is this plausibly an Excel file? */
export function validateExcelFile(
  fileName: string,
  size: number,
  buffer: Buffer,
) {
  if (size === 0) throw new ServiceError("The uploaded file is empty.");
  if (size > MAX_FILE_SIZE) {
    throw new ServiceError("The file is too large. Maximum size is 5 MB.");
  }

  const lower = fileName.toLowerCase();
  if (!lower.endsWith(".xlsx") && !lower.endsWith(".xls")) {
    throw new ServiceError("Only Excel files (.xlsx or .xls) are accepted.");
  }

  // Content check: don't trust the extension alone.
  const isZip = // .xlsx
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    buffer[2] === 0x03 &&
    buffer[3] === 0x04;
  const isOle = // .xls inside an OLE2 container
    buffer[0] === 0xd0 &&
    buffer[1] === 0xcf &&
    buffer[2] === 0x11 &&
    buffer[3] === 0xe0;
  const isRawBiff = // .xls as a raw BIFF stream (what your biometric software writes)
    buffer[0] === 0x09 && [0x00, 0x02, 0x04, 0x08].includes(buffer[1]);
  if (!isZip && !isOle && !isRawBiff) {
    throw new ServiceError("The file content is not a valid Excel workbook.");
  }
}
