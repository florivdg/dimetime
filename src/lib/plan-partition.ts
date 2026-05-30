export function partitionByPlan<
  T extends { id: string; planId: string | null },
>(
  items: T[],
  planId: string | null,
): { idsToClearBudget: string[]; idsToKeepBudget: string[] } {
  const idsToClearBudget: string[] = []
  const idsToKeepBudget: string[] = []
  for (const item of items) {
    if (planId !== null && item.planId === planId) {
      idsToKeepBudget.push(item.id)
    } else {
      idsToClearBudget.push(item.id)
    }
  }
  return { idsToClearBudget, idsToKeepBudget }
}
