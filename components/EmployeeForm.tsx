"use client";

import Link from "next/link";
import { startTransition, useActionState } from "react";
import type { ActionState } from "@/lib/action-state";

type Option = { id: string; label: string };

export type EmployeeFormValues = {
  id?: string;
  employeeCode: string;
  biometricId: string;
  name: string;
  email: string;
  phoneNumber: string;
  joiningDate: string; // YYYY-MM-DD
  departmentId: string;
  designationId: string;
  isActive: boolean;
};

export const emptyEmployee: EmployeeFormValues = {
  employeeCode: "",
  biometricId: "",
  name: "",
  email: "",
  phoneNumber: "",
  joiningDate: "",
  departmentId: "",
  designationId: "",
  isActive: true,
};

type Props = {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  departments: Option[];
  designations: Option[];
  initial?: EmployeeFormValues;
  isEdit?: boolean;
};

const input = "w-full rounded border px-3 py-2";

export default function EmployeeForm({
  action,
  departments,
  designations,
  initial = emptyEmployee,
  isEdit,
}: Props) {
  const [state, formAction, pending] = useActionState(action, {} as ActionState);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => formAction(fd));
  }

  return (
    <form onSubmit={onSubmit} className="max-w-2xl space-y-4 rounded border bg-white p-6">
      {initial.id && <input type="hidden" name="id" value={initial.id} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-sm font-medium">Employee code *</label>
          <input name="employeeCode" required defaultValue={initial.employeeCode} className={input} />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Biometric ID (AC-No.) *</label>
          <input name="biometricId" required defaultValue={initial.biometricId} className={input} />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Full name *</label>
          <input name="name" required defaultValue={initial.name} className={input} />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Email *</label>
          <input name="email" type="email" required defaultValue={initial.email} className={input} />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Phone</label>
          <input name="phoneNumber" defaultValue={initial.phoneNumber} className={input} />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Joining date</label>
          <input name="joiningDate" type="date" defaultValue={initial.joiningDate} className={input} />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Department *</label>
          <select name="departmentId" required defaultValue={initial.departmentId} className={input}>
            <option value="">Select department</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.label}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Designation</label>
          <select name="designationId" defaultValue={initial.designationId} className={input}>
            <option value="">None</option>
            {designations.map((d) => (
              <option key={d.id} value={d.id}>{d.label}</option>
            ))}
          </select>
        </div>
      </div>

      {isEdit && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="isActive" defaultChecked={initial.isActive} />
          Active employee
        </label>
      )}

      {state.error && (
        <div className="rounded bg-red-50 p-2 text-sm text-red-700">{state.error}</div>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {pending ? "Saving..." : isEdit ? "Save changes" : "Add employee"}
        </button>
        <Link href="/employees" className="rounded border px-4 py-2 text-sm hover:bg-zinc-100">
          Cancel
        </Link>
      </div>
    </form>
  );
}