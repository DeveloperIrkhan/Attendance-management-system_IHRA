import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/authorization";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { getEmployee } from "@/services/employee.service";
import { listDepartments } from "@/services/department.service";
import { listDesignations } from "@/services/designation.service";
import EmployeeForm from "@/components/EmployeeForm";
import { updateEmployeeAction } from "../../actions";

export default async function EditEmployeePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission(PERMISSIONS.EMPLOYEES_MANAGE);
  const { id } = await params;

  const [employee, departments, designations] = await Promise.all([
    getEmployee(id),
    listDepartments(),
    listDesignations(),
  ]);
  if (!employee) notFound();

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Edit employee</h1>
      <EmployeeForm
        isEdit
        action={updateEmployeeAction}
        departments={departments.map((d) => ({ id: d.id, label: d.name }))}
        designations={designations.map((d) => ({ id: d.id, label: d.title }))}
        initial={{
          id: employee.id,
          employeeCode: employee.employeeCode,
          biometricId: employee.biometricId ?? "",
          name: employee.name,
          email: employee.email,
          phoneNumber: employee.phoneNumber ?? "",
          joiningDate: employee.joiningDate
            ? employee.joiningDate.toISOString().slice(0, 10)
            : "",
          departmentId: employee.departmentId,
          designationId: employee.designationId ?? "",
          isActive: employee.isActive,
        }}
      />
    </div>
  );
}