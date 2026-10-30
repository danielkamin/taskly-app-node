import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { todoFixture } from '../../../test/todoFixture'
import { useDeleteTodoMutation } from '../hooks/useDeleteTodoMutation'
import { DeleteTodoDialog } from './DeleteTodoDialog'

vi.mock('../../../design-system', () => import('../../../design-system/mocks'))
vi.mock('../hooks/useDeleteTodoMutation', () => ({
  useDeleteTodoMutation: vi.fn(),
}))

it('shows a deletion error and allows cancelling without deleting', async () => {
  const user = userEvent.setup()
  const mutateAsync = vi.fn()
  vi.mocked(useDeleteTodoMutation).mockReturnValue({
    isPending: false,
    error: new Error('Could not delete.'),
    mutateAsync,
  } as unknown as ReturnType<typeof useDeleteTodoMutation>)
  const onClose = vi.fn()
  const onDeleted = vi.fn()
  render(
    <DeleteTodoDialog
      todo={todoFixture}
      busy={false}
      onClose={onClose}
      onDeleted={onDeleted}
    />,
  )
  expect(screen.getByRole('dialog', { name: 'Delete task?' })).toBeVisible()
  expect(
    screen.getByText(
      `The task “${todoFixture.title}” will be permanently deleted.`,
    ),
  ).toBeVisible()
  expect(screen.getByTestId('alert')).toHaveTextContent('Could not delete.')
  await user.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(onClose).toHaveBeenCalledTimes(1)
  expect(mutateAsync).not.toHaveBeenCalled()
  expect(onDeleted).not.toHaveBeenCalled()
})

function mockMutation(overrides: { isPending?: boolean; mutateAsync?: unknown } = {}) {
  const mutateAsync = vi.fn().mockResolvedValue(undefined)
  vi.mocked(useDeleteTodoMutation).mockReturnValue({
    isPending: false,
    error: null,
    mutateAsync,
    ...overrides,
  } as unknown as ReturnType<typeof useDeleteTodoMutation>)
  return mutateAsync
}

it('deletes the task and reports success', async () => {
  const user = userEvent.setup()
  const mutateAsync = mockMutation()
  const onDeleted = vi.fn()
  render(
    <DeleteTodoDialog
      todo={todoFixture}
      busy={false}
      onClose={vi.fn()}
      onDeleted={onDeleted}
    />,
  )
  expect(screen.queryByTestId('alert')).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Delete task' }))
  expect(mutateAsync).toHaveBeenCalledWith(todoFixture.id)
  await waitFor(() => expect(onDeleted).toHaveBeenCalledTimes(1))
})

it('stays open when deletion fails', async () => {
  const user = userEvent.setup()
  mockMutation({ mutateAsync: vi.fn().mockRejectedValue(new Error('Nope')) })
  const onDeleted = vi.fn()
  const onClose = vi.fn()
  render(
    <DeleteTodoDialog
      todo={todoFixture}
      busy={false}
      onClose={onClose}
      onDeleted={onDeleted}
    />,
  )
  await user.click(screen.getByRole('button', { name: 'Delete task' }))
  expect(onDeleted).not.toHaveBeenCalled()
  expect(onClose).not.toHaveBeenCalled()
  expect(screen.getByRole('dialog', { name: 'Delete task?' })).toBeVisible()
})

it.each([
  { busy: true, isPending: false },
  { busy: false, isPending: true },
])(
  'disables all actions while pending (busy: $busy, isPending: $isPending)',
  ({ busy, isPending }) => {
    const mutateAsync = mockMutation({ isPending })
    render(
      <DeleteTodoDialog
        todo={todoFixture}
        busy={busy}
        onClose={vi.fn()}
        onDeleted={vi.fn()}
      />,
    )
    const deleteButton = screen.getByRole('button', { name: 'Deleting…' })
    expect(deleteButton).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Close' })).toBeDisabled()
    fireEvent.click(deleteButton)
    expect(mutateAsync).not.toHaveBeenCalled()
  },
)
