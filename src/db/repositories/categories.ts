import * as Crypto from 'expo-crypto';

import type { Category } from '../../domain/types';
import { openMainDatabase } from '../client';

const COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

type CategoryRow = {
  id: string;
  name: string;
  color: string | null;
  sort_index: number;
  created_at: number;
  updated_at: number;
};

function mapRow(r: CategoryRow): Category {
  return {
    id: r.id,
    name: r.name,
    color: r.color,
    sort_index: r.sort_index,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

export function normalizeCategoryName(raw: string): string {
  return raw.trim();
}

export function validateCategoryColor(color: string | null | undefined): string | null {
  if (color == null || color === '') {
    return null;
  }
  if (!COLOR_PATTERN.test(color)) {
    throw new Error('Color must be a hex code like #RRGGBB.');
  }
  return color;
}

export async function listCategories(): Promise<Category[]> {
  const db = await openMainDatabase();
  const rows = await db.getAllAsync<CategoryRow>(
    `SELECT id, name, color, sort_index, created_at, updated_at FROM categories
     ORDER BY sort_index ASC, name COLLATE NOCASE ASC`
  );
  return rows.map(mapRow);
}

export async function createCategory(params: {
  name: string;
  color?: string | null;
}): Promise<Category> {
  const name = normalizeCategoryName(params.name);
  if (!name) {
    throw new Error('Name is required.');
  }
  const color = validateCategoryColor(params.color);
  const db = await openMainDatabase();
  const dup = await db.getFirstAsync<{ id: string }>(
    `SELECT id FROM categories WHERE name = ? COLLATE NOCASE`,
    [name]
  );
  if (dup) {
    throw new Error('That category name already exists.');
  }
  const id = Crypto.randomUUID();
  const now = Date.now();
  const row = await db.getFirstAsync<{ si: number }>(
    `SELECT COALESCE(MAX(sort_index), -1) + 1 AS si FROM categories`
  );
  const sort_index = row?.si ?? 0;
  await db.runAsync(
    `INSERT INTO categories (id, name, color, sort_index, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, name, color, sort_index, now, now]
  );
  const created = await db.getFirstAsync<CategoryRow>(
    `SELECT id, name, color, sort_index, created_at, updated_at FROM categories WHERE id = ?`,
    [id]
  );
  if (!created) {
    throw new Error('Failed to read new category.');
  }
  return mapRow(created);
}

export async function updateCategory(
  id: string,
  patch: { name?: string; color?: string | null }
): Promise<void> {
  const db = await openMainDatabase();
  const existing = await db.getFirstAsync<CategoryRow>(
    `SELECT id, name, color, sort_index, created_at, updated_at FROM categories WHERE id = ?`,
    [id]
  );
  if (!existing) {
    throw new Error('Category not found.');
  }
  const name = patch.name !== undefined ? normalizeCategoryName(patch.name) : existing.name;
  if (!name) {
    throw new Error('Name is required.');
  }
  const color = patch.color !== undefined ? validateCategoryColor(patch.color) : existing.color;
  const dup = await db.getFirstAsync<{ id: string }>(
    `SELECT id FROM categories WHERE name = ? COLLATE NOCASE AND id != ?`,
    [name, id]
  );
  if (dup) {
    throw new Error('That category name already exists.');
  }
  const now = Date.now();
  await db.runAsync(`UPDATE categories SET name = ?, color = ?, updated_at = ? WHERE id = ?`, [
    name,
    color,
    now,
    id,
  ]);
}

export async function deleteCategory(id: string): Promise<void> {
  const db = await openMainDatabase();
  const res = await db.runAsync(`DELETE FROM categories WHERE id = ?`, [id]);
  if (res.changes === 0) {
    throw new Error('Category not found.');
  }
}
