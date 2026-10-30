import { afterEach, beforeEach, it, expect, vi } from 'vitest';

vi.mock('dotenv', () => ({ default: { config: vi.fn() } }));

const { resolveDatabaseUrl } = await import('../src/core/config.ts');
const parts = { POSTGRES_USER: 'user', POSTGRES_PASSWORD: 'p@ss word', POSTGRES_HOST: 'db', DB_PORT: '5433', POSTGRES_DB: 'my db' };

beforeEach(() => {
  vi.stubEnv('DATABASE_URL', '');
  for (const name of Object.keys(parts)) vi.stubEnv(name, '');
});
afterEach(() => vi.unstubAllEnvs());

it('loads the repository .env file quietly on import', async () => {
  const dotenv = (await import('dotenv')).default;
  expect(dotenv.config).toHaveBeenCalledWith({ path: expect.stringMatching(/\.env$/), quiet: true });
});
it('prefers an explicit override over DATABASE_URL', () => {
  vi.stubEnv('DATABASE_URL', 'postgresql://env/db');
  expect(resolveDatabaseUrl('postgresql://override/db')).toBe('postgresql://override/db');
});
it.each([
  ['postgresql+psycopg://u:p@h:5432/d', 'postgresql://u:p@h:5432/d'],
  ['postgresql://u:p@h:5432/d', 'postgresql://u:p@h:5432/d'],
])('uses DATABASE_URL and normalises the SQLAlchemy driver prefix: %s', (input, expected) => {
  vi.stubEnv('DATABASE_URL', input);
  expect(resolveDatabaseUrl()).toBe(expected);
});
it('normalises the driver prefix of an override', () => {
  expect(resolveDatabaseUrl('postgresql+psycopg://h/d')).toBe('postgresql://h/d');
});
it('builds an encoded URL from the POSTGRES_* variables', () => {
  for (const [name, value] of Object.entries(parts)) vi.stubEnv(name, value);
  expect(resolveDatabaseUrl()).toBe('postgresql://user:p%40ss%20word@db:5433/my%20db');
});
it.each(Object.keys(parts))('throws when %s is missing', (missing) => {
  for (const [name, value] of Object.entries(parts)) vi.stubEnv(name, name === missing ? '' : value);
  expect(() => resolveDatabaseUrl()).toThrow(`Missing environment variable: ${missing}`);
});
