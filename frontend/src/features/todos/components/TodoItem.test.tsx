import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { todoFixture } from '../../../test/todoFixture'
import type { Todo } from '../types'
import { TodoItem } from './TodoItem'

vi.mock('../../../design-system', () => import('../../../design-system/mocks'))

it('shows an active task and forwards edit requests', async () => {
  const user = userEvent.setup()
  const onEdit = vi.fn()
  const onToggle = vi.fn()
  const onDelete = vi.fn()
  render(
    <TodoItem
      todo={todoFixture}
      busy={false}
      onEdit={onEdit}
      onToggle={onToggle}
      onPin={vi.fn()}
      onDelete={onDelete}
    />,
  )
  expect(screen.getByRole('heading', { name: todoFixture.title })).toBeVisible()
  expect(screen.getByText('To do')).toBeVisible()
  expect(screen.getByText('Medium')).toBeVisible()
  expect(screen.getByRole('checkbox')).not.toBeChecked()
  await user.click(
    screen.getByRole('button', { name: `Edit: ${todoFixture.title}` }),
  )
  expect(onEdit).toHaveBeenCalledTimes(1)
  expect(onToggle).not.toHaveBeenCalled()
  expect(onDelete).not.toHaveBeenCalled()
})

function setup(todo: Todo, busy = false) {
  const callbacks = {
    onEdit: vi.fn(),
    onToggle: vi.fn(),
    onPin: vi.fn(),
    onDelete: vi.fn(),
  }
  render(<TodoItem todo={todo} busy={busy} {...callbacks} />)
  return { ...callbacks, user: userEvent.setup() }
}

it('shows a completed task with description and forwards toggle and delete', async () => {
  const todo = { ...todoFixture, completed: true, description: 'Line one', priority: 'high' as const }
  const { onToggle, onDelete, user } = setup(todo)
  expect(screen.getByText('Completed')).toBeVisible()
  expect(screen.getByText('Line one')).toBeVisible()
  expect(screen.getByText('High')).toBeVisible()
  expect(screen.getByText(`#${todo.id}`)).toBeVisible()
  const checkbox = screen.getByRole('checkbox', { name: `Mark as active: ${todo.title}` })
  expect(checkbox).toBeChecked()
  await user.click(checkbox)
  expect(onToggle).toHaveBeenCalledTimes(1)
  await user.click(screen.getByRole('button', { name: `Delete: ${todo.title}` }))
  expect(onDelete).toHaveBeenCalledTimes(1)
})

it('labels the checkbox for completing an active task', () => {
  setup(todoFixture)
  expect(
    screen.getByRole('checkbox', { name: `Complete: ${todoFixture.title}` }),
  ).not.toBeChecked()
})

it('marks past due dates of active tasks as overdue', () => {
  setup({ ...todoFixture, due_date: '2000-01-15' })
  expect(screen.getByText(/15 Jan 2000/)).toHaveTextContent('15 Jan 2000 · overdue')
})

it.each([
  ['a future due date', { due_date: '2999-01-15' }],
  ['a completed task', { due_date: '2000-01-15', completed: true }],
])('does not mark %s as overdue', (_, override) => {
  setup({ ...todoFixture, ...override })
  expect(screen.getByText(/15 Jan/)).not.toHaveTextContent('overdue')
})

it('omits the due date badge and description when absent', () => {
  setup(todoFixture)
  expect(screen.queryByText(/overdue/)).not.toBeInTheDocument()
  expect(screen.queryByText(/\d{4}$/)).not.toBeInTheDocument()
})

it('offers to pin an unpinned task and forwards the request', async () => {
  const { onPin, user } = setup(todoFixture)
  const button = screen.getByRole('button', { name: `Pin: ${todoFixture.title}` })
  expect(button).toHaveAttribute('aria-pressed', 'false')
  await user.click(button)
  expect(onPin).toHaveBeenCalledTimes(1)
})

it('offers to unpin a pinned task', async () => {
  const { onPin, user } = setup({ ...todoFixture, pinned: true })
  const button = screen.getByRole('button', { name: `Unpin: ${todoFixture.title}` })
  expect(button).toHaveAttribute('aria-pressed', 'true')
  await user.click(button)
  expect(onPin).toHaveBeenCalledTimes(1)
})

it('disables all actions while busy', () => {
  setup(todoFixture, true)
  expect(screen.getByRole('button', { name: `Pin: ${todoFixture.title}` })).toBeDisabled()
  expect(screen.getByRole('checkbox')).toBeDisabled()
  expect(screen.getByRole('button', { name: `Edit: ${todoFixture.title}` })).toBeDisabled()
  expect(screen.getByRole('button', { name: `Delete: ${todoFixture.title}` })).toBeDisabled()
})
