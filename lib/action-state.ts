export type ActionState = { error?: string; ok?: boolean };

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
  return { error: "Something went worng. Please try again." };
}
