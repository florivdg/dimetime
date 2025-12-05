import { db } from '@/db/database'
import { category } from '@/db/schema/plans'
import { desc, eq, like } from 'drizzle-orm'

// Infer type from Drizzle schema
export type Category = typeof category.$inferSelect

export interface CreateCategoryInput {
  name: string
  slug: string
  color?: string | null
}

export interface UpdateCategoryInput {
  name?: string
  slug?: string
  color?: string | null
}

/**
 * Generate a URL-friendly slug from a name
 */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics (ä -> a, ü -> u, etc.)
    .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric with hyphens
    .replace(/^-+|-+$/g, '') // Trim leading/trailing hyphens
}

/**
 * Get all categories ordered by creation date (newest first)
 */
export async function getAllCategories(): Promise<Category[]> {
  return db.select().from(category).orderBy(desc(category.createdAt))
}

/**
 * Search categories by name (case-insensitive partial match)
 */
export async function searchCategories(query: string): Promise<Category[]> {
  return db
    .select()
    .from(category)
    .where(like(category.name, `%${query}%`))
    .orderBy(desc(category.createdAt))
}

/**
 * Get a single category by ID
 */
export async function getCategoryById(
  id: string,
): Promise<Category | undefined> {
  const result = await db
    .select()
    .from(category)
    .where(eq(category.id, id))
    .limit(1)
  return result[0]
}

/**
 * Get a single category by slug
 */
export async function getCategoryBySlug(
  slug: string,
): Promise<Category | undefined> {
  const result = await db
    .select()
    .from(category)
    .where(eq(category.slug, slug))
    .limit(1)
  return result[0]
}

/**
 * Check if a slug is unique (optionally excluding a specific category ID for updates)
 */
export async function isSlugUnique(
  slug: string,
  excludeId?: string,
): Promise<boolean> {
  const existing = await getCategoryBySlug(slug)
  if (!existing) return true
  return excludeId ? existing.id === excludeId : false
}

/**
 * Create a new category
 */
export async function createCategory(
  input: CreateCategoryInput,
): Promise<Category> {
  const now = new Date()
  const result = await db
    .insert(category)
    .values({
      name: input.name,
      slug: input.slug,
      color: input.color ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .returning()
  return result[0]
}

/**
 * Update an existing category
 */
export async function updateCategory(
  id: string,
  input: UpdateCategoryInput,
): Promise<Category | undefined> {
  const result = await db
    .update(category)
    .set({
      ...(input.name !== undefined && { name: input.name }),
      ...(input.slug !== undefined && { slug: input.slug }),
      ...(input.color !== undefined && { color: input.color }),
    })
    .where(eq(category.id, id))
    .returning()
  return result[0]
}

/**
 * Delete a category by ID
 */
export async function deleteCategory(id: string): Promise<boolean> {
  const result = await db
    .delete(category)
    .where(eq(category.id, id))
    .returning({ id: category.id })
  return result.length > 0
}
