import type { APIRoute } from 'astro'
import { getMonthlyChartData, type ChartRange } from '@/lib/dashboard'
import { json } from '@/lib/api/responses'

export const GET: APIRoute = async ({ url }) => {
  const rangeParam = url.searchParams.get('range') ?? '6m'

  // Validate range parameter
  const validRanges: ChartRange[] = ['6m', '12m', 'year']
  const range: ChartRange = validRanges.includes(rangeParam as ChartRange)
    ? (rangeParam as ChartRange)
    : '6m'

  const chartData = await getMonthlyChartData(range)

  return json({ data: chartData })
}
