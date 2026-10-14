import { ClassValue, clsx, twMerge } from "cn";

export function cn(...input: ClassValue[]) {
  return twMerge(clsx(input));
}



