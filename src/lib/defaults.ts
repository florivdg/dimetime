export const orNull = <T>(value: T | null | undefined): T | null =>
  value ?? null

export const orDefault = <T>(value: T | null | undefined, fallback: T): T =>
  value ?? fallback
