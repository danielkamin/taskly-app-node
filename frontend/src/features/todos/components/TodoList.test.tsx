import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { todoFixture } from '../../../test/todoFixture'
import type { Todo } from '../types'
import { TodoList } from './TodoList'

vi.mock('../../../design-system', () => import('../../../design-system/mocks'))
vi.mock('./TodoEmptyState', () => ({
  TodoEmptyState: ({
    hasTodos,
    disabled,
    onCreate,
  }: {
    hasTodos: boolean
    disabled: boolean
    onCreate: () => void
  }) => (
    <p>
      Empty task list {hasTodos ? '(filtered)' : '(none)'}
      <button disabled={disabled} onClick={onCreate}>
        Create from empty state
      </button>
    </p>
  ),
}))
vi.mock('./TodoItem', () => ({
  TodoItem: ({
    todo,
    busy,
    onToggle,
    onPin,
    onEdit,
    onDelete,
  }: {
    todo: Todo
    busy: boolean
    onToggle: () => void
    onPin: () => void
    onEdit: () => void
    onDelete: () => void
  }) => (
    <li>
      {todo.title}
      <button disabled={busy} onClick={onToggle}>
        Toggle {todo.title}
      </button>
      <button onClick={onPin}>Pin {todo.title}</button>
      <button onClick={onEdit}>Edit {todo.title}</button>
      <button onClick={onDelete}>Delete {todo.title}</button>
    </li>
  ),
}))

function setup(overrides: Partial<Parameters<typeof TodoList>[0]> = {}) {
  const props = {
    todos: [] as Todo[],
    hasTodos: false,
    loading: false,
    failed: false,
    busy: false,
    onCreate: vi.fn(),
    onToggle: vi.fn(),
    onPin: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    ...overrides,
  }
  return { props, ...render(<TodoList {...props} />) }
}

it('shows loading feedback before showing an empty list', () => {
  const props = {
    todos: [],
    hasTodos: false,
    failed: false,
    busy: false,
    onCreate: vi.fn(),
    onToggle: vi.fn(),
    onPin: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
  }
  const { rerender } = render(<TodoList {...props} loading />)
  expect(screen.getByRole('status')).toHaveTextContent('Loading your tasks…')
  expect(screen.queryByText(/Empty task list/)).not.toBeInTheDocument()
  rerender(<TodoList {...props} loading={false} />)
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
  expect(screen.getByText(/Empty task list/)).toBeVisible()
})

it('shows an unavailable message when loading failed and no tasks are cached', () => {
  setup({ failed: true })
  expect(
    screen.getByRole('heading', {
      name: 'The task list is temporarily unavailable',
    }),
  ).toBeVisible()
  expect(screen.getByText('Try again to load your tasks.')).toBeVisible()
  expect(screen.queryByText(/Empty task list/)).not.toBeInTheDocument()
})

it('keeps showing cached tasks after a failed refetch', () => {
  setup({ failed: true, hasTodos: true, todos: [todoFixture] })
  expect(screen.getByRole('listitem')).toHaveTextContent(todoFixture.title)
  expect(
    screen.queryByText('The task list is temporarily unavailable'),
  ).not.toBeInTheDocument()
})

it('renders each task and forwards actions with the task', async () => {
  const user = userEvent.setup()
  const second: Todo = { ...todoFixture, id: 8, title: 'Second' }
  const { props } = setup({ todos: [todoFixture, second], hasTodos: true })
  expect(screen.getAllByRole('listitem')).toHaveLength(2)
  await user.click(screen.getByRole('button', { name: 'Toggle Second' }))
  expect(props.onToggle).toHaveBeenCalledWith(second)
  await user.click(screen.getByRole('button', { name: 'Pin Second' }))
  expect(props.onPin).toHaveBeenCalledWith(second)
  await user.click(
    screen.getByRole('button', { name: `Edit ${todoFixture.title}` }),
  )
  expect(props.onEdit).toHaveBeenCalledWith(todoFixture)
  await user.click(screen.getByRole('button', { name: 'Delete Second' }))
  expect(props.onDelete).toHaveBeenCalledWith(second)
})

it('passes busy state to the tasks', () => {
  setup({ todos: [todoFixture], hasTodos: true, busy: true })
  expect(
    screen.getByRole('button', { name: `Toggle ${todoFixture.title}` }),
  ).toBeDisabled()
})

it('passes filter and busy state to the empty state', async () => {
  const user = userEvent.setup()
  const { props, rerender } = setup()
  expect(screen.getByText(/Empty task list/)).toHaveTextContent('(none)')
  await user.click(screen.getByRole('button', { name: 'Create from empty state' }))
  expect(props.onCreate).toHaveBeenCalledTimes(1)
  rerender(<TodoList {...props} hasTodos busy />)
  expect(screen.getByText(/Empty task list/)).toHaveTextContent('(filtered)')
  expect(
    screen.getByRole('button', { name: 'Create from empty state' }),
  ).toBeDisabled()
})
