import bcrypt from "bcryptjs";

const ROUND = 12;

export function hashPassword(password: string) {
  return bcrypt.hash(password, ROUND);
}

export function verifyPassword(password: string, hashedPassword: string) {
  return bcrypt.compare(password, hashedPassword);
}

// Used when the email doesn't exist, so response time doesn't reveal valid emails.
export const DUMMY_HASH = bcrypt.hashSync("dummy-password-for-timing", ROUND);

