import { it, expect, vi } from 'vitest';
import { createDatabase, initialize } from '../src/core/database.ts';
import type { Database } from '../src/features/todos/types.ts';

it('creates a Prisma client without connecting', () => {
  const database = createDatabase('postgresql://test:test@localhost:5432/test');
  expect(typeof database.todo.findMany).toBe('function');
  expect(typeof database.$connect).toBe('function');
});
it('creates the todos table if it does not exist', async () => {
  const $executeRaw = vi.fn().mockResolvedValue(0);
  await initialize({ $executeRaw } as unknown as Database);
  expect($executeRaw).toHaveBeenCalledTimes(2);
  const sql = ($executeRaw.mock.calls[0][0] as TemplateStringsArray).join('');
  expect(sql).toContain('pinned BOOLEAN NOT NULL DEFAULT FALSE');
  const migration = ($executeRaw.mock.calls[1][0] as TemplateStringsArray).join('');
  expect(migration).toContain('ALTER TABLE todos ADD COLUMN IF NOT EXISTS pinned');
  expect(sql).toContain('CREATE TABLE IF NOT EXISTS todos');
  expect(sql).toContain("priority IN ('low', 'medium', 'high')");
  expect(sql).toContain('title VARCHAR(120) NOT NULL');
});
it('propagates initialization errors', async () => {
  const $executeRaw = vi.fn().mockRejectedValue(new Error('permission denied'));
  await expect(initialize({ $executeRaw } as unknown as Database)).rejects.toThrow('permission denied');
});
