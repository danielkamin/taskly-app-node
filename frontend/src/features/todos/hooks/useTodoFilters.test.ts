import { act, renderHook } from '@testing-library/react'
import { expect, it } from 'vitest'
import { todoFixture } from '../../../test/todoFixture'
import type { Todo } from '../types'
import { useTodoFilters } from './useTodoFilters'

const done: Todo = { ...todoFixture, id: 2, title: 'Ship it', completed: true, priority: 'high' }
const todos = [todoFixture, done]

it('starts with all tasks, no search and newest first', () => {
  const { result } = renderHook(() => useTodoFilters(todos))
  expect(result.current).toMatchObject({ filter: 'all', search: '', sort: 'newest' })
  // Same creation time: the higher id comes first.
  expect(result.current.visible).toEqual([todoFixture, done])
})

it('recomputes visible tasks when filter, search or sort change', () => {
  const { result } = renderHook(() => useTodoFilters(todos))
  act(() => result.current.setFilter('completed'))
  expect(result.current.filter).toBe('completed')
  expect(result.current.visible).toEqual([done])
  act(() => result.current.setFilter('all'))
  act(() => result.current.setSearch('demo'))
  expect(result.current.search).toBe('demo')
  expect(result.current.visible).toEqual([todoFixture])
  act(() => result.current.setSearch(''))
  act(() => result.current.setSort('priority'))
  expect(result.current.sort).toBe('priority')
  expect(result.current.visible).toEqual([done, todoFixture])
})

it('follows changes to the task list', () => {
  const { result, rerender } = renderHook(({ list }) => useTodoFilters(list), {
    initialProps: { list: [todoFixture] },
  })
  expect(result.current.visible).toEqual([todoFixture])
  rerender({ list: [] })
  expect(result.current.visible).toEqual([])
})
