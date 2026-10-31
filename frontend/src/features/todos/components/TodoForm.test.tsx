import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { todoFixture } from '../../../test/todoFixture'
import { TodoForm } from './TodoForm'

vi.mock('../../../design-system', () => import('../../../design-system/mocks'))

describe('TodoForm', () => {
  it('rejects a whitespace-only title without submitting', async () => {
    const onSubmit = vi.fn()
    const user = userEvent.setup()
    render(
      <TodoForm
        onSubmit={onSubmit}
        onCancel={vi.fn()}
        busy={false}
        error={null}
      />,
    )
    await user.type(screen.getByLabelText(/Task title/), '   ')
    await user.click(screen.getByRole('button', { name: 'Save task' }))
    expect(screen.getByText('Enter a task title.')).toBeVisible()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('submits trimmed values and the selected priority', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(
      <TodoForm
        onSubmit={onSubmit}
        onCancel={vi.fn()}
        busy={false}
        error={null}
      />,
    )
    await user.type(screen.getByLabelText(/Task title/), '  Prepare a demo  ')
    await user.selectOptions(screen.getByLabelText('Priority'), 'high')
    await user.click(screen.getByRole('button', { name: 'Save task' }))
    expect(onSubmit).toHaveBeenCalledWith({
      title: 'Prepare a demo',
      description: '',
      priority: 'high',
      due_date: null,
      completed: false,
      pinned: false,
    })
  })

  it('prefills an existing task and submits edited description and due date', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    const initial = { ...todoFixture, description: 'Old', due_date: '2026-10-15' }
    render(
      <TodoForm
        initial={initial}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
        busy={false}
        error={null}
      />,
    )
    expect(screen.getByLabelText(/Task title/)).toHaveValue(todoFixture.title)
    expect(screen.getByLabelText('Due date (optional)')).toHaveValue('2026-10-15')
    const description = screen.getByLabelText('Description (optional)')
    await user.clear(description)
    await user.type(description, '  New details  ')
    await user.clear(screen.getByLabelText('Due date (optional)'))
    await user.click(screen.getByRole('button', { name: 'Save task' }))
    expect(onSubmit).toHaveBeenCalledWith({
      ...initial,
      description: 'New details',
      due_date: null,
    })
  })

  it('shows every validation error at once', async () => {
    const onSubmit = vi.fn()
    render(
      <TodoForm
        initial={{
          ...todoFixture,
          title: 'x'.repeat(121),
          description: 'x'.repeat(2001),
          due_date: '2025-02-29',
        }}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
        busy={false}
        error={null}
      />,
    )
    await userEvent.setup().click(screen.getByRole('button', { name: 'Save task' }))
    expect(
      screen.getByText('The title must be at most 120 characters.'),
    ).toBeVisible()
    expect(
      screen.getByText('The description must be at most 2000 characters.'),
    ).toBeVisible()
    expect(screen.getByText('Enter a valid date.')).toBeVisible()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('sets a due date', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(
      <TodoForm
        initial={todoFixture}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
        busy={false}
        error={null}
      />,
    )
    await user.type(screen.getByLabelText('Due date (optional)'), '2026-12-24')
    await user.click(screen.getByRole('button', { name: 'Save task' }))
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ due_date: '2026-12-24' }),
    )
  })

  it('shows a server error and cancels', async () => {
    const onCancel = vi.fn()
    render(
      <TodoForm
        onSubmit={vi.fn()}
        onCancel={onCancel}
        busy={false}
        error="Server rejected the task."
      />,
    )
    expect(screen.getByTestId('alert')).toHaveTextContent(
      'Server rejected the task.',
    )
    await userEvent.setup().click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('locks the form while busy', () => {
    render(
      <TodoForm onSubmit={vi.fn()} onCancel={vi.fn()} busy error={null} />,
    )
    expect(screen.queryByTestId('alert')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
    expect(screen.getByLabelText(/Task title/)).toBeDisabled()
  })
})
