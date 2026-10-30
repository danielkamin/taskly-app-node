import { afterEach, expect, it, vi } from 'vitest'
import { request } from './http'

function respond(body: unknown, status = 200) {
  const fetch = vi
    .fn()
    .mockResolvedValue(
      new Response(body === undefined ? null : JSON.stringify(body), { status }),
    )
  vi.stubGlobal('fetch', fetch)
  return fetch
}

afterEach(() => vi.unstubAllGlobals())

it('prefixes the API path, sends JSON headers and parses the response', async () => {
  const fetch = respond({ id: 1 })
  await expect(
    request('/todos', {
      method: 'POST',
      body: '{}',
      headers: { 'X-Trace': 'abc' },
    }),
  ).resolves.toEqual({ id: 1 })
  expect(fetch).toHaveBeenCalledWith('/api/todos', {
    method: 'POST',
    body: '{}',
    headers: { 'Content-Type': 'application/json', 'X-Trace': 'abc' },
  })
})

it('works without request options', async () => {
  const fetch = respond([])
  await expect(request('/todos')).resolves.toEqual([])
  expect(fetch).toHaveBeenCalledWith('/api/todos', {
    headers: { 'Content-Type': 'application/json' },
  })
})

it('returns undefined for 204 responses', async () => {
  respond(undefined, 204)
  await expect(request('/todos/1', { method: 'DELETE' })).resolves.toBeUndefined()
})

it('reports a friendly message on network errors', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
  await expect(request('/todos')).rejects.toThrow(
    'Cannot connect to the server. Please try again.',
  )
})

it('rethrows the original error when the request was aborted', async () => {
  const controller = new AbortController()
  controller.abort()
  const abort = new DOMException('Aborted', 'AbortError')
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(abort))
  await expect(request('/todos', { signal: controller.signal })).rejects.toBe(
    abort,
  )
})

it('explains validation limits on 422 responses', async () => {
  respond({ detail: [{ message: 'Too long' }] }, 422)
  await expect(request('/todos')).rejects.toThrow(
    'Check the task details: title up to 120 characters, description up to 2000 characters, and a valid due date.',
  )
})

it('uses a string detail from the error body', async () => {
  respond({ detail: 'Task not found.' }, 404)
  await expect(request('/todos/9')).rejects.toThrow('Task not found.')
})

it.each([
  ['a non-string detail', { detail: { code: 1 } }],
  ['no detail', {}],
  ['a non-JSON body', undefined],
])('falls back to a generic message for %s', async (_, body) => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValue(
        new Response(body === undefined ? 'oops' : JSON.stringify(body), {
          status: 500,
        }),
      ),
  )
  await expect(request('/todos')).rejects.toThrow(
    'The operation failed. Please try again.',
  )
})
