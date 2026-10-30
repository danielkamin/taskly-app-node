import { afterEach, beforeEach, it, expect, vi } from 'vitest';

vi.mock('../src/core/lifespan.ts', () => ({ start: vi.fn() }));
const { start } = await import('../src/core/lifespan.ts');

beforeEach(() => vi.resetModules());
afterEach(() => {
  vi.restoreAllMocks();
  process.exitCode = undefined;
});

it('starts the API on import', async () => {
  vi.mocked(start).mockResolvedValue({} as Awaited<ReturnType<typeof start>>);
  await import('../src/main.ts');
  expect(start).toHaveBeenCalled();
  await new Promise((resolve) => setImmediate(resolve));
  expect(process.exitCode).toBeUndefined();
});
it('logs and sets a failing exit code when startup fails', async () => {
  const error = vi.spyOn(console, 'error').mockImplementation(() => {});
  const failure = new Error('no database');
  vi.mocked(start).mockRejectedValue(failure);
  await import('../src/main.ts');
  await vi.waitFor(() => expect(error).toHaveBeenCalledWith('Cannot start Taskly App Node API:', failure));
  expect(process.exitCode).toBe(1);
});
