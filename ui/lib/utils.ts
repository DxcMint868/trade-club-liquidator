export type ClassValue = string | number | boolean | null | undefined;

export function cn(...inputs: ClassValue[]): string {
  return inputs
    .flatMap((value) => {
      if (!value) {
        return [];
      }

      if (typeof value === "string" || typeof value === "number") {
        return [String(value)];
      }

      if (typeof value === "boolean") {
        return []; // booleans act as toggles
      }

      return [];
    })
    .join(" ");
}
