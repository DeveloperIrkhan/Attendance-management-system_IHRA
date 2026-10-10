import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/authorization";
import { getHomePath } from "@/lib/auth/permissions";

export default async function HomePage() {
  const user = await requireUser();
  redirect(getHomePath(user.role.permissions));
}