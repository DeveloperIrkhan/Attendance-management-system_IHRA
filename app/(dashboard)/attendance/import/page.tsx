import { requirePermission } from "@/lib/auth/authorization";
import { PERMISSIONS } from "@/lib/auth/permissions";
import ImportForm from "@/components/ImportForm";

export default async function ImportPage() {
  await requirePermission(PERMISSIONS.ATTENDANCE_IMPORT);

  // Default to the previous month: sheets are usually uploaded after month end.
  const now = new Date();
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  return (
    <div className="w-full md:h-2/3 h-full flex justify-center items-center">
      <div className="">
        <h1 className="text-xl font-semibold text-green-800">Import attendance</h1>
        <p className="max-w-2xl text-sm text-green-600 mb-4">
          Upload the raw monthly sheet from the biometric machine. Each
          employee&apos;s Biometric ID (AC-No.) must match the Biometric ID
          saved under Employees.
        </p>
        <ImportForm
          defaultMonth={prev.getMonth() + 1}
          defaultYear={prev.getFullYear()}
        />
      </div>
    </div>
  );
}
