import { describe, expect, it, vi } from 'vitest'
import {
  formatDate,
  isOverdue,
  priorityLabels,
  selectTodos,
  validateTodo,
} from './todos'
import type { Todo, TodoInput } from '../types'

const base: Todo = {
  id: 1,
  title: 'Sprint plan',
  description: '',
  priority: 'medium',
  completed: false,
  due_date: null,
  created_at: '2026-10-01T12:00:00Z',
  updated_at: '2026-10-01T12:00:00Z',
}

describe('selectTodos', () => {
  it('combines status with a case-insensitive search in the description', () => {
    const matching = { ...base, description: 'Discuss the API' }
    const todos = [
      matching,
      { ...matching, id: 2, completed: true },
      { ...base, id: 3 },
    ]
    expect(selectTodos(todos, 'active', ' api ', 'newest')).toEqual([matching])
  })

  it('sorts by priority without changing the source array', () => {
    const high: Todo = { ...base, id: 2, priority: 'high' }
    const todos = [base, high]
    expect(selectTodos(todos, 'all', '', 'priority')).toEqual([high, base])
    expect(todos).toEqual([base, high])
  })

  it('filters completed tasks and searches the title', () => {
    const done = { ...base, id: 2, completed: true, title: 'Release notes' }
    const todos = [base, done]
    expect(selectTodos(todos, 'completed', '', 'newest')).toEqual([done])
    expect(selectTodos(todos, 'all', 'SPRINT', 'newest')).toEqual([base])
  })

  it('sorts newest first, breaking ties by id', () => {
    const older = { ...base, id: 5, created_at: '2026-09-01T12:00:00Z' }
    const tie = { ...base, id: 2 }
    expect(selectTodos([older, base, tie], 'all', '', 'newest')).toEqual([
      tie,
      base,
      older,
    ])
  })

  it('sorts by priority and breaks ties by id', () => {
    const low = { ...base, id: 3, priority: 'low' as const }
    const medium = { ...base, id: 4 }
    expect(selectTodos([low, base, medium], 'all', '', 'priority')).toEqual([
      medium,
      base,
      low,
    ])
  })

  it('sorts by due date with undated tasks last', () => {
    const soon = { ...base, id: 2, due_date: '2026-10-02' }
    const later = { ...base, id: 3, due_date: '2026-12-01' }
    const sameDay = { ...base, id: 4, due_date: '2026-10-02' }
    expect(
      selectTodos([base, later, soon, sameDay], 'all', '', 'due'),
    ).toEqual([sameDay, soon, later, base])
  })
})

const input: TodoInput = {
  title: 'Task',
  description: '',
  priority: 'medium',
  due_date: null,
  completed: false,
}

describe('validateTodo', () => {
  it('accepts valid input at the length limits', () => {
    expect(
      validateTodo({
        ...input,
        title: ` ${'x'.repeat(120)} `,
        description: 'x'.repeat(2000),
        due_date: '2024-02-29',
      }),
    ).toEqual({})
  })

  it.each([
    [{ title: '  ' }, { title: 'Enter a task title.' }],
    [
      { title: 'x'.repeat(121) },
      { title: 'The title must be at most 120 characters.' },
    ],
    [
      { description: 'x'.repeat(2001) },
      { description: 'The description must be at most 2000 characters.' },
    ],
    [{ due_date: '2025-02-29' }, { due_date: 'Enter a valid date.' }],
    [{ due_date: '2026-13-01' }, { due_date: 'Enter a valid date.' }],
    [{ due_date: '15.10.2026' }, { due_date: 'Enter a valid date.' }],
    [{ due_date: '2026-1-5' }, { due_date: 'Enter a valid date.' }],
    [
      { title: '', description: 'x'.repeat(2001), due_date: 'nope' },
      {
        title: 'Enter a task title.',
        description: 'The description must be at most 2000 characters.',
        due_date: 'Enter a valid date.',
      },
    ],
  ])('reports errors for %j', (override, errors) => {
    expect(validateTodo({ ...input, ...override })).toEqual(errors)
  })
})

describe('isOverdue', () => {
  it.each([
    [{ due_date: '2000-01-01' }, true],
    [{ due_date: '2000-01-01', completed: true }, false],
    [{ due_date: '2999-01-01' }, false],
    [{ due_date: null }, false],
  ])('%j -> %s', (override, expected) => {
    expect(isOverdue({ ...base, ...override })).toBe(expected)
  })

  it('compares against the local calendar day', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    try {
      vi.setSystemTime(new Date(2026, 9, 15, 0, 30))
      expect(isOverdue({ ...base, due_date: '2026-10-14' })).toBe(true)
      expect(isOverdue({ ...base, due_date: '2026-10-15' })).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('formatting', () => {
  it('formats calendar dates in British style', () => {
    expect(formatDate('2026-10-15')).toBe('15 Oct 2026')
  })

  it('labels every priority', () => {
    expect(priorityLabels).toEqual({ low: 'Low', medium: 'Medium', high: 'High' })
  })
})
