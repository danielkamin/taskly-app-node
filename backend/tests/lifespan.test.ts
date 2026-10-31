import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, it, expect, vi } from 'vitest';

const database = vi.hoisted(() => ({ $connect: vi.fn(), $disconnect: vi.fn(), todo: {} }));
vi.mock('../src/core/database.ts', () => ({ createDatabase: vi.fn(() => database), initialize: vi.fn() }));
vi.mock('../src/core/config.ts', () => ({ resolveDatabaseUrl: vi.fn(() => 'postgresql://test/test') }));
vi.mock('../src/factory.ts', async () => {
  const express = (await import('express')).default;
  return { createApp: vi.fn(() => express()) };
});

const { start } = await import('../src/core/lifespan.ts');
const { createDatabase, initialize } = await import('../src/core/database.ts');
const { createApp } = await import('../src/factory.ts');

let servers: Server[] = [];
beforeEach(() => {
  vi.stubEnv('API_PORT', '0');
  database.$connect.mockResolvedValue(undefined);
  database.$disconnect.mockResolvedValue(undefined);
  vi.mocked(initialize).mockResolvedValue(undefined);
});
afterEach(async () => {
  await Promise.all(servers.filter((server) => server.listening).map((server) => new Promise((resolve) => server.close(resolve))));
  servers = [];
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.clearAllMocks();
  process.exitCode = undefined;
});

function setup() {
  const log = vi.spyOn(console, 'log').mockImplementation(() => {});
  const handlers: Record<string, () => void> = {};
  vi.spyOn(process, 'once').mockImplementation(((event: string, handler: () => void) => {
    handlers[event] = handler;
    return process;
  }) as typeof process.once);
  return { log, handlers };
}

it('connects, initializes, listens and registers shutdown handlers', async () => {
  const { log, handlers } = setup();
  const result = await start();
  servers.push(result.server);
  expect(createDatabase).toHaveBeenCalledWith('postgresql://test/test');
  expect(database.$connect).toHaveBeenCalledOnce();
  expect(initialize).toHaveBeenCalledWith(database);
  expect(createApp).toHaveBeenCalledWith(database);
  expect(result.database).toBe(database);
  const { port } = result.server.address() as AddressInfo;
  expect(port).toBeGreaterThan(0);
  expect(log).toHaveBeenCalledWith(`Taskly App Node API listening on port ${port}`);
  expect(Object.keys(handlers).sort()).toEqual(['SIGINT', 'SIGTERM']);
  expect(handlers.SIGINT).toBe(handlers.SIGTERM);
});
it('closes the server and disconnects on shutdown', async () => {
  const { handlers } = setup();
  const { server } = await start();
  const closed = new Promise((resolve) => server.once('close', resolve));
  handlers.SIGTERM();
  await closed;
  await vi.waitFor(() => expect(database.$disconnect).toHaveBeenCalledOnce());
  expect(server.listening).toBe(false);
  expect(process.exitCode).toBeUndefined();
});
it('sets a failing exit code when disconnecting fails during shutdown', async () => {
  const { handlers } = setup();
  const error = vi.spyOn(console, 'error').mockImplementation(() => {});
  database.$disconnect.mockRejectedValue(new Error('disconnect failed'));
  const { server } = await start();
  handlers.SIGINT();
  await vi.waitFor(() => expect(error).toHaveBeenCalledWith(new Error('disconnect failed')));
  expect(process.exitCode).toBe(1);
  expect(server.listening).toBe(false);
});
it('forces exit when shutdown takes longer than 10 seconds', async () => {
  const { handlers } = setup();
  const { server } = await start();
  servers.push(server);
  vi.useFakeTimers();
  const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
  const close = vi.spyOn(server, 'close').mockImplementation((() => server) as never);
  try {
    handlers.SIGTERM();
    expect(close).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(9999);
    expect(exit).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(exit).toHaveBeenCalledWith(1);
  } finally {
    vi.useRealTimers();
    close.mockRestore();
  }
});
it.each([
  ['connecting', () => database.$connect.mockRejectedValue(new Error('connecting'))],
  ['initializing', () => vi.mocked(initialize).mockRejectedValue(new Error('initializing'))],
])('disconnects and rethrows when %s fails', async (message, fail) => {
  setup();
  fail();
  await expect(start()).rejects.toThrow(message);
  expect(database.$disconnect).toHaveBeenCalledOnce();
  expect(createApp).not.toHaveBeenCalled();
});
it('disconnects and rethrows when the port cannot be bound', async () => {
  setup();
  const first = await start();
  servers.push(first.server);
  vi.stubEnv('API_PORT', String((first.server.address() as AddressInfo).port));
  database.$disconnect.mockClear();
  await expect(start()).rejects.toMatchObject({ code: 'EADDRINUSE' });
  expect(database.$disconnect).toHaveBeenCalledOnce();
});
