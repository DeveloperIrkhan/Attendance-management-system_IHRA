import Link from "next/link";
import { requirePermission } from "@/lib/auth/authorization";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { listDepartments } from "@/services/department.service";
import { listDesignations } from "@/services/designation.service";
import EmployeeForm from "@/components/EmployeeForm";
import { createEmployeeAction } from "../actions";

export default async function NewEmployeePage() {
  await requirePermission(PERMISSIONS.EMPLOYEES_MANAGE);
  const [departments, designations] = await Promise.all([
    listDepartments(),
    listDesignations(),
  ]);

  if (departments.length === 0) {
    return (
      <div className="space-y-2">
        <h1 className="text-xl font-semibold">Add employee</h1>
        <p className="text-zinc-600">
          Create at least one department first.{" "}
          <Link href="/departments" className="underline">Go to Departments</Link>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Add employee</h1>
      <EmployeeForm
        action={createEmployeeAction}
        departments={departments.map((d) => ({ id: d.id, label: d.name }))}
        designations={designations.map((d) => ({ id: d.id, label: d.title }))}
      />
    </div>
  );
}