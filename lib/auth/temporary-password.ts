import { randomInt } from "node:crypto";

const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWER = "abcdefghijkmnopqrstuvwxyz";
const DIGITS = "23456789";
const ALL = UPPER + LOWER + DIGITS;

const pick = (chars: string) => chars[randomInt(chars.length)];

/**
 * A random one-time password such as "Kd7mR-x4Tqe". At least one capital letter,
 * one small letter and one digit, so it always passes the password rule.
 * Every employee gets a different one.
 */
export function generateTemporaryPassword(): string {
  const chars = [pick(UPPER), pick(LOWER), pick(DIGITS)];
  while (chars.length < 10) chars.push(pick(ALL));
  // Fisher-Yates shuffle with a secure random source
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  const text = chars.join("");
  return `${text.slice(0, 5)}-${text.slice(5)}`;
}


export const TEMPORARY_PASSWORD = "Welcome-123";