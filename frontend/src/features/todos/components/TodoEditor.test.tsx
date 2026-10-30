import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { todoFixture } from '../../../test/todoFixture'
import { useCreateTodoMutation } from '../hooks/useCreateTodoMutation'
import { useUpdateTodoMutation } from '../hooks/useUpdateTodoMutation'
import type { TodoInput } from '../types'
import { TodoEditor } from './TodoEditor'

vi.mock('../../../design-system', () => import('../../../design-system/mocks'))
vi.mock('../hooks/useCreateTodoMutation', () => ({
  useCreateTodoMutation: vi.fn(),
}))
vi.mock('../hooks/useUpdateTodoMutation', () => ({
  useUpdateTodoMutation: vi.fn(),
}))
vi.mock('./TodoForm', () => ({
  TodoForm: ({
    initial,
    busy,
    error,
    onSubmit,
    onCancel,
  }: {
    initial?: TodoInput
    busy: boolean
    error: string | null
    onSubmit: (input: TodoInput) => Promise<void>
    onCancel: () => void
  }) => (
    <div>
      <p>{`initial:${initial?.title ?? 'none'} busy:${busy} error:${error ?? 'none'}`}</p>
      <button onClick={() => void onSubmit(todoFixture)}>Submit form</button>
      <button onClick={onCancel}>Cancel form</button>
    </div>
  ),
}))

beforeEach(() => vi.clearAllMocks())

function mockMutations(
  create: Record<string, unknown> = {},
  update: Record<string, unknown> = {},
) {
  const createAsync = vi.fn().mockResolvedValue(todoFixture)
  const updateAsync = vi.fn().mockResolvedValue(todoFixture)
  vi.mocked(useCreateTodoMutation).mockReturnValue({
    isPending: false,
    error: null,
    mutateAsync: createAsync,
    ...create,
  } as unknown as ReturnType<typeof useCreateTodoMutation>)
  vi.mocked(useUpdateTodoMutation).mockReturnValue({
    isPending: false,
    error: null,
    mutateAsync: updateAsync,
    ...update,
  } as unknown as ReturnType<typeof useUpdateTodoMutation>)
  return { createAsync, updateAsync }
}

it('creates a new task and reports a successful save', async () => {
  const user = userEvent.setup()
  const create = vi.fn().mockResolvedValue(todoFixture)
  const update = vi.fn()
  vi.mocked(useCreateTodoMutation).mockReturnValue({
    isPending: false,
    error: null,
    mutateAsync: create,
  } as unknown as ReturnType<typeof useCreateTodoMutation>)
  vi.mocked(useUpdateTodoMutation).mockReturnValue({
    isPending: false,
    error: null,
    mutateAsync: update,
  } as unknown as ReturnType<typeof useUpdateTodoMutation>)
  const onSaved = vi.fn()
  render(
    <TodoEditor todo="new" busy={false} onClose={vi.fn()} onSaved={onSaved} />,
  )
  expect(screen.getByRole('dialog', { name: 'New task' })).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Submit form' }))
  await waitFor(() => expect(onSaved).toHaveBeenCalledWith('New task added.'))
  expect(create).toHaveBeenCalledWith(todoFixture)
  expect(update).not.toHaveBeenCalled()
})

it('starts a new task with an empty form', () => {
  mockMutations()
  render(<TodoEditor todo="new" busy={false} onClose={vi.fn()} onSaved={vi.fn()} />)
  expect(screen.getByText('initial:none busy:false error:none')).toBeVisible()
})

it('updates an existing task and reports saved changes', async () => {
  const user = userEvent.setup()
  const { createAsync, updateAsync } = mockMutations()
  const onSaved = vi.fn()
  render(
    <TodoEditor todo={todoFixture} busy={false} onClose={vi.fn()} onSaved={onSaved} />,
  )
  expect(screen.getByRole('dialog', { name: 'Edit task' })).toBeVisible()
  expect(
    screen.getByText(`initial:${todoFixture.title} busy:false error:none`),
  ).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Submit form' }))
  await waitFor(() => expect(onSaved).toHaveBeenCalledWith('Changes saved.'))
  expect(updateAsync).toHaveBeenCalledWith({ id: todoFixture.id, input: todoFixture })
  expect(createAsync).not.toHaveBeenCalled()
})

it('keeps the editor open and shows the mutation error when saving fails', async () => {
  const user = userEvent.setup()
  const failure = new Error('Title is taken.')
  const updateAsync = vi.fn().mockRejectedValue(failure)
  mockMutations({}, { error: failure, mutateAsync: updateAsync })
  const onSaved = vi.fn()
  render(
    <TodoEditor todo={todoFixture} busy={false} onClose={vi.fn()} onSaved={onSaved} />,
  )
  expect(screen.getByText(/error:Title is taken\./)).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Submit form' }))
  await waitFor(() => expect(updateAsync).toHaveBeenCalled())
  expect(onSaved).not.toHaveBeenCalled()
})

it('uses only the error of the active mutation', () => {
  mockMutations({}, { error: new Error('Update error') })
  render(<TodoEditor todo="new" busy={false} onClose={vi.fn()} onSaved={vi.fn()} />)
  expect(screen.getByText(/error:none/)).toBeVisible()
})

it.each([
  { busy: true, isPending: false },
  { busy: false, isPending: true },
])(
  'does not save while pending (busy: $busy, isPending: $isPending)',
  async ({ busy, isPending }) => {
    const user = userEvent.setup()
    const { createAsync } = mockMutations({ isPending })
    const onSaved = vi.fn()
    render(<TodoEditor todo="new" busy={busy} onClose={vi.fn()} onSaved={onSaved} />)
    expect(screen.getByText(/busy:true/)).toBeVisible()
    expect(screen.getByRole('button', { name: 'Close' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Submit form' }))
    expect(createAsync).not.toHaveBeenCalled()
    expect(onSaved).not.toHaveBeenCalled()
  },
)

it('closes from the form and the drawer', async () => {
  const user = userEvent.setup()
  mockMutations()
  const onClose = vi.fn()
  render(<TodoEditor todo="new" busy={false} onClose={onClose} onSaved={vi.fn()} />)
  await user.click(screen.getByRole('button', { name: 'Cancel form' }))
  await user.click(screen.getByRole('button', { name: 'Close' }))
  expect(onClose).toHaveBeenCalledTimes(2)
})
