import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/authorization";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { getEmployee } from "@/services/employee.service";
import { listDepartments } from "@/services/department.service";
import { listDesignations } from "@/services/designation.service";
import EmployeeForm from "@/components/EmployeeForm";
import { ResetLoginForm } from "@/components/TemporaryLogin";
import { resetEmployeeLoginAction, updateEmployeeAction } from "../../actions";
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
    <div className="w-full h-2/3 flex justify-center items-center">
      <div className=" bg-white p-3 rounded-md shadow-lg">
        <h1 className="text-xl font-semibold text-green-800">Edit employee</h1>
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
        <section className="mt-6 space-y-2 border-t pt-4">
          <h2 className="font-semibold text-green-800">Login account</h2>
          {employee.user ? (
            <p className="text-sm text-slate-600">
              Signs in with <span className="font-mono">{employee.email}</span>{" "}
              as {employee.user.role.name}.{" "}
              {employee.user.mustChangePassword
                ? "Has not changed the first password yet."
                : "Has set their own password."}{" "}
              {employee.user.lastLoginAt
                ? `Last sign-in: ${employee.user.lastLoginAt.toISOString().slice(0, 16).replace("T", " ")} UTC.`
                : "Has never signed in."}
            </p>
          ) : (
            <p className="text-sm text-amber-800">
              This employee has no login yet (added before logins were created
              automatically).
            </p>
          )}
          <ResetLoginForm
            action={resetEmployeeLoginAction}
            id={employee.id}
            label={employee.user ? "Reset password" : "Create login"}
          />
        </section>
      </div>
    </div>
  );
}
