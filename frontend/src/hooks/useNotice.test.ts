import { act, renderHook } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { useNotice } from './useNotice'

it('starts without a notice and exposes a notification callback', () => {
  const { result } = renderHook(() => useNotice())
  expect(result.current.message).toBe('')
  expect(result.current.notify).toEqual(expect.any(Function))
})

it('shows a notice and hides it after four seconds', () => {
  vi.useFakeTimers()
  try {
    const { result } = renderHook(() => useNotice())
    act(() => result.current.notify('Task created.'))
    expect(result.current.message).toBe('Task created.')
    act(() => vi.advanceTimersByTime(3999))
    expect(result.current.message).toBe('Task created.')
    act(() => vi.advanceTimersByTime(1))
    expect(result.current.message).toBe('')
  } finally {
    vi.useRealTimers()
  }
})

it('restarts the timer for a new notice and keeps the callback stable', () => {
  vi.useFakeTimers()
  try {
    const { result } = renderHook(() => useNotice())
    const notify = result.current.notify
    act(() => notify('First'))
    act(() => vi.advanceTimersByTime(3000))
    act(() => result.current.notify('Second'))
    expect(result.current.notify).toBe(notify)
    act(() => vi.advanceTimersByTime(3000))
    expect(result.current.message).toBe('Second')
    act(() => vi.advanceTimersByTime(1000))
    expect(result.current.message).toBe('')
  } finally {
    vi.useRealTimers()
  }
})

it('clears the pending timer on unmount', () => {
  vi.useFakeTimers()
  try {
    const { result, unmount } = renderHook(() => useNotice())
    act(() => result.current.notify('Bye'))
    expect(vi.getTimerCount()).toBe(1)
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  } finally {
    vi.useRealTimers()
  }
})
