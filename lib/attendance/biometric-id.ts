
export function normalizeBiometricId(
  value: string | number | null | undefined,
): string {
  let text = String(value ?? "")
    .trim()
    .toUpperCase();
  if (/^\d+\.0+$/.test(text)) text = text.replace(/\.0+$/, "");
  if (/^\d+$/.test(text)) text = text.replace(/^0+(?=\d)/, "");
  return text;
}
