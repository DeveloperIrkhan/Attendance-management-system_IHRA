/** Login details of a new or reset account, shown once to HR / Admin. */
export type IssuedLogin = { name: string; email: string; password: string };

export type ActionState = {
  error?: string;
  ok?: boolean;
  /** only set right after an account is created or its password reset */
  login?: IssuedLogin;
};

export class ServiceError extends Error {}

export function toActionError(e: unknown): ActionState {
  if (e instanceof ServiceError) return { error: e.message };
  if (
    typeof e === "object" &&
    e !== null &&
    (e as { code?: string }).code === "P2002"
  ) {
    return { error: "A record with the same unique value already exists." };
  }
  console.error(e);
  return { error: "Something went wrong. Please try again." };
}



