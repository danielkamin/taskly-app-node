import express from 'express';
import request from 'supertest';
import { afterEach, it, expect, vi } from 'vitest';
import { createApp } from '../src/factory.ts';
import type { Database } from '../src/features/todos/types.ts';
import { record, todo } from './fixture.ts';

afterEach(() => vi.restoreAllMocks());

function setup() {
  const database = {
    todo: { findFirst: vi.fn().mockResolvedValue({ id: 1 }), findMany: vi.fn().mockResolvedValue([record]), create: vi.fn() },
  };
  return { database, app: createApp(database as unknown as Database) };
}

it('reports health after querying the database', async () => {
  const { app, database } = setup();
  const response = await request(app).get('/api/health');
  expect(response.status).toBe(200);
  expect(response.body).toEqual({ status: 'ok' });
  expect(database.todo.findFirst).toHaveBeenCalledWith({ select: { id: true } });
});
it('returns 500 when the health check query fails', async () => {
  const { app, database } = setup();
  const error = vi.spyOn(console, 'error').mockImplementation(() => {});
  database.todo.findFirst.mockRejectedValue(new Error('Database unavailable'));
  const response = await request(app).get('/api/health');
  expect(response.status).toBe(500);
  expect(response.body).toEqual({ detail: 'Internal Server Error' });
  expect(error).toHaveBeenCalledWith(new Error('Database unavailable'));
});
it('mounts the todos router backed by the repository', async () => {
  const { app, database } = setup();
  const response = await request(app).get('/api/todos');
  expect(response.status).toBe(200);
  expect(response.body).toEqual([todo]);
  expect(database.todo.findMany).toHaveBeenCalledOnce();
});
it('serves the OpenAPI specification and docs', async () => {
  const { app } = setup();
  const spec = await request(app).get('/openapi.json');
  expect(spec.status).toBe(200);
  expect(spec.body.openapi).toBe('3.0.3');
  expect(spec.body.paths).toHaveProperty('/api/health');
  const docs = await request(app).get('/docs/');
  expect(docs.status).toBe(200);
  expect(docs.text).toContain('swagger');
});
it('returns JSON 404 for unknown routes and hides x-powered-by', async () => {
  const { app } = setup();
  const response = await request(app).get('/nope');
  expect(response.status).toBe(404);
  expect(response.body).toEqual({ detail: 'Not Found' });
  expect(response.headers['x-powered-by']).toBeUndefined();
});
it('returns 422 for malformed JSON without calling the database', async () => {
  const { app, database } = setup();
  const response = await request(app).post('/api/todos').set('Content-Type', 'application/json').send('{"title":');
  expect(response.status).toBe(422);
  expect(response.body).toEqual({ detail: 'Invalid JSON.' });
  expect(database.todo.create).not.toHaveBeenCalled();
});
it('returns 413 for oversized bodies', async () => {
  const { app, database } = setup();
  const response = await request(app).post('/api/todos').send({ title: 'x', description: 'x'.repeat(200_000) });
  expect(response.status).toBe(413);
  expect(response.body).toEqual({ detail: 'Request body too large.' });
  expect(database.todo.create).not.toHaveBeenCalled();
});
it('delegates to the default handler when headers were already sent', async () => {
  const { app } = setup();
  const error = vi.spyOn(console, 'error').mockImplementation(() => {});
  const outer = express();
  outer.get('/stream', (req, res, next) => { res.write('partial'); next(new Error('late')); });
  outer.use(app);
  // Express' default handler aborts a response that has already started.
  await expect(request(outer).get('/stream')).rejects.toThrow('aborted');
  expect(error).not.toHaveBeenCalled();
});
