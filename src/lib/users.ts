import { db } from '@/db/database'

export interface UserBasic {
  id: string
  name: string
  email: string
}

/**
 * Get all users (basic info only for mapping UI)
 */
export async function getAllUsers(): Promise<UserBasic[]> {
  const users = await db.query.user.findMany({
    columns: {
      id: true,
      name: true,
      email: true,
    },
    orderBy: (user, { asc }) => [asc(user.name)],
  })

  return users
}
