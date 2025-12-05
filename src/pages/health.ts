import type { APIRoute } from 'astro'
import { db } from '@/db/database'
import { sql } from 'drizzle-orm'

type HealthStatus = {
  status: 'ok' | 'unhealthy'
  checks: {
    database: { status: 'ok' | 'error'; message?: string }
  }
}

export const GET: APIRoute = async () => {
  const isDev = import.meta.env.DEV

  const health: HealthStatus = {
    status: 'ok',
    checks: {
      database: { status: 'ok' },
    },
  }

  // Check database connectivity
  try {
    db.run(sql`SELECT 1`)
  } catch (error) {
    health.checks.database = {
      status: 'error',
      ...(isDev && {
        message:
          error instanceof Error ? error.message : 'Database check failed',
      }),
    }
    health.status = 'unhealthy'
  }

  const httpStatus = health.status === 'unhealthy' ? 503 : 200

  return new Response(JSON.stringify(health), {
    status: httpStatus,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  })
}
