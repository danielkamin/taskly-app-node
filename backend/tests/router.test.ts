import express from 'express';
import request from 'supertest';
import { it, expect, vi } from 'vitest';
import { createTodosRouter } from '../src/features/todos/router.ts';
import { todo } from './fixture.ts';

function setup() {
  const repository = { list: vi.fn().mockResolvedValue([todo]), create: vi.fn().mockResolvedValue(todo), get: vi.fn(), update: vi.fn(), delete: vi.fn() };
  const app = express();
  app.use(express.json());
  app.use('/api/todos', createTodosRouter(repository));
  return { app, repository };
}
it('lists tasks from the repository', async () => {
  const { app, repository } = setup();
  const response = await request(app).get('/api/todos');
  expect(response.status).toBe(200);
  expect(response.body).toEqual([todo]);
  expect(repository.list).toHaveBeenCalledOnce();
});
it('creates tasks with trimmed input and defaults', async () => {
  const { app, repository } = setup();
  const response = await request(app).post('/api/todos').send({ title: '  Plan the sprint  ', priority: 'high' });
  expect(response.status).toBe(201);
  expect(response.body).toEqual(todo);
  expect(repository.create).toHaveBeenCalledWith({ title: 'Plan the sprint', description: '', priority: 'high', due_date: null, completed: false });
});
it.each([{ title: '  ' }, { title: 'x'.repeat(121) }, { title: 'Task', priority: 'urgent' }, { title: 'Task', due_date: '2026-02-30' }])(
  'rejects invalid create input without calling the repository: %j', async (payload) => {
    const { app, repository } = setup();
    expect((await request(app).post('/api/todos').send(payload)).status).toBe(422);
    expect(repository.create).not.toHaveBeenCalled();
  },
);
it('gets a task by ID and returns 404 when missing', async () => {
  const { app, repository } = setup();
  repository.get.mockResolvedValueOnce(todo).mockResolvedValueOnce(null);
  const found = await request(app).get('/api/todos/1');
  expect(found.status).toBe(200);
  expect(found.body).toEqual(todo);
  expect(repository.get).toHaveBeenCalledWith(1);
  const missing = await request(app).get('/api/todos/2');
  expect(missing.status).toBe(404);
  expect(missing.body).toEqual({ detail: 'Task not found.' });
});
it.each(['0', '-1', '1.5', 'abc'])('rejects invalid id %s without calling the repository', async (id) => {
  const { app, repository } = setup();
  const response = await request(app).get(`/api/todos/${id}`);
  expect(response.status).toBe(422);
  expect(Array.isArray(response.body.detail)).toBe(true);
  expect(repository.get).not.toHaveBeenCalled();
});
it('updates a task with trimmed input', async () => {
  const { app, repository } = setup();
  repository.update.mockResolvedValue({ ...todo, title: 'New' });
  const response = await request(app).patch('/api/todos/1').send({ title: '  New  ' });
  expect(response.status).toBe(200);
  expect(response.body).toEqual({ ...todo, title: 'New' });
  expect(repository.update).toHaveBeenCalledWith(1, { title: 'New' });
});
it('returns 404 when updating a missing task', async () => {
  const { app, repository } = setup();
  repository.update.mockResolvedValue(null);
  const response = await request(app).patch('/api/todos/9').send({ completed: true });
  expect(response.status).toBe(404);
  expect(response.body).toEqual({ detail: 'Task not found.' });
});
it.each([{}, { id: 2 }, { completed: 'yes' }, { title: null }])('rejects invalid patch input: %j', async (payload) => {
  const { app, repository } = setup();
  const response = await request(app).patch('/api/todos/1').send(payload);
  expect(response.status).toBe(422);
  expect(repository.update).not.toHaveBeenCalled();
});
it('rejects a patch to an invalid id', async () => {
  const { app, repository } = setup();
  expect((await request(app).patch('/api/todos/0').send({ completed: true })).status).toBe(422);
  expect(repository.update).not.toHaveBeenCalled();
});
it('deletes tasks and returns 404 when missing', async () => {
  const { app, repository } = setup();
  repository.delete.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
  const deleted = await request(app).delete('/api/todos/1');
  expect(deleted.status).toBe(204);
  expect(deleted.text).toBe('');
  expect(repository.delete).toHaveBeenCalledWith(1);
  const missing = await request(app).delete('/api/todos/1');
  expect(missing.status).toBe(404);
  expect(missing.body).toEqual({ detail: 'Task not found.' });
});
it('rejects deleting an invalid id', async () => {
  const { app, repository } = setup();
  expect((await request(app).delete('/api/todos/abc')).status).toBe(422);
  expect(repository.delete).not.toHaveBeenCalled();
});
it('propagates repository errors to the error handler', async () => {
  const { app, repository } = setup();
  repository.list.mockRejectedValue(new Error('boom'));
  const errors: unknown[] = [];
  const handler: express.ErrorRequestHandler = (error, req, res, next) => { errors.push(error); res.status(500).json({ detail: 'failed' }); };
  app.use(handler);
  expect((await request(app).get('/api/todos')).status).toBe(500);
  expect(errors).toEqual([new Error('boom')]);
});
