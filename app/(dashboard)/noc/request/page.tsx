import Link from "next/link";
import { requireUser } from "@/lib/auth/authorization";
import NocRequestForm from "@/components/NocRequestForm";
import { createNocAction } from "../actions";

export default async function NocRequestPage() {
  const user = await requireUser();

  if (!user.employeeId) {
    return (
      <div className="space-y-2">
        <h1 className="text-xl font-semibold">Apply for NOC</h1>
        <p className="rounded bg-amber-50 p-3 text-sm text-amber-800">
          Your login is not linked to an employee record. Please contact HR.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Apply for NOC</h1>
        <Link href="/noc/my" className="text-sm text-green-800 underline">
          My NOC requests
        </Link>
      </div>
      <div className="rounded-md bg-white p-4 shadow-md">
        <NocRequestForm action={createNocAction} />
      </div>
    </div>
  );
}
