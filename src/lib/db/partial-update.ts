export type FieldMappers<TFields, TRow> = {
  [K in keyof TFields]?: (
    value: NonNullable<TFields[K]> | null,
    set: Partial<TRow>,
  ) => void
}

export function buildSetValues<TFields extends object, TRow>(
  fields: TFields,
  mappers: FieldMappers<TFields, TRow>,
): Partial<TRow> & { updatedAt: Date } {
  const set = { updatedAt: new Date() } as Partial<TRow> & { updatedAt: Date }
  for (const key of Object.keys(fields) as (keyof TFields)[]) {
    const value = (fields as Record<string, unknown>)[key as string]
    if (value === undefined) continue
    const mapper = mappers[key]
    if (mapper) mapper(value as never, set)
  }
  return set
}
