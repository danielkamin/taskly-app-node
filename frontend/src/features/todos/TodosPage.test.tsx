import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { useNotice } from '../../hooks/useNotice'
import { todoFixture } from '../../test/todoFixture'
import { useTodoFilters } from './hooks/useTodoFilters'
import { useTodosBusy } from './hooks/useTodosBusy'
import { useTodosQuery } from './hooks/useTodosQuery'
import { useUpdateTodoMutation } from './hooks/useUpdateTodoMutation'
import type { Todo } from './types'
import { TodosPage } from './TodosPage'

vi.mock('../../design-system', () => import('../../design-system/mocks'))
vi.mock('../../hooks/useNotice', () => ({ useNotice: vi.fn() }))
vi.mock('./hooks/useTodoFilters', () => ({ useTodoFilters: vi.fn() }))
vi.mock('./hooks/useTodosBusy', () => ({ useTodosBusy: vi.fn() }))
vi.mock('./hooks/useTodosQuery', () => ({ useTodosQuery: vi.fn() }))
vi.mock('./hooks/useUpdateTodoMutation', () => ({
  useUpdateTodoMutation: vi.fn(),
}))
vi.mock('./components/TodosHeader', () => ({
  TodosHeader: ({
    disabled,
    onCreate,
  }: {
    disabled: boolean
    onCreate: () => void
  }) => (
    <button disabled={disabled} onClick={onCreate}>
      Header create
    </button>
  ),
}))
vi.mock('./components/TodoFilters', () => ({
  TodoFilters: ({ search }: { search: string }) => <p>Search: {search}</p>,
}))
vi.mock('./components/TodoList', () => ({
  TodoList: (props: {
    todos: Todo[]
    hasTodos: boolean
    loading: boolean
    failed: boolean
    busy: boolean
    onCreate: () => void
    onToggle: (todo: Todo) => void
    onPin: (todo: Todo) => void
    onEdit: (todo: Todo) => void
    onDelete: (todo: Todo) => void
  }) => (
    <section aria-label="Task list">
      <p>
        {`visible:${props.todos.length} hasTodos:${props.hasTodos} loading:${props.loading} failed:${props.failed} busy:${props.busy}`}
      </p>
      <button onClick={props.onCreate}>List create</button>
      {props.todos.map((todo) => (
        <div key={todo.id}>
          <button onClick={() => props.onToggle(todo)}>Toggle {todo.title}</button>
          <button onClick={() => props.onPin(todo)}>Pin {todo.title}</button>
          <button onClick={() => props.onEdit(todo)}>Edit {todo.title}</button>
          <button onClick={() => props.onDelete(todo)}>Delete {todo.title}</button>
        </div>
      ))}
    </section>
  ),
}))
vi.mock('./components/TodoEditor', () => ({
  TodoEditor: ({
    todo,
    onClose,
    onSaved,
  }: {
    todo: Todo | 'new'
    onClose: () => void
    onSaved: (message: string) => void
  }) => (
    <div role="dialog" aria-label="Editor">
      Editing {todo === 'new' ? 'new task' : todo.title}
      <button onClick={onClose}>Close editor</button>
      <button onClick={() => onSaved('Changes saved.')}>Save editor</button>
    </div>
  ),
}))
vi.mock('./components/DeleteTodoDialog', () => ({
  DeleteTodoDialog: ({
    todo,
    onClose,
    onDeleted,
  }: {
    todo: Todo
    onClose: () => void
    onDeleted: () => void
  }) => (
    <div role="dialog" aria-label="Delete">
      Deleting {todo.title}
      <button onClick={onClose}>Close delete</button>
      <button onClick={onDeleted}>Confirm delete</button>
    </div>
  ),
}))
vi.mock('../../components/SuccessNotice', () => ({
  SuccessNotice: ({ message }: { message: string }) => <p>Notice: {message}</p>,
}))

beforeEach(() => vi.clearAllMocks())

function setup({
  query = {},
  mutation = {},
  busy = false,
  message = '',
}: {
  query?: Record<string, unknown>
  mutation?: Record<string, unknown>
  busy?: boolean
  message?: string
} = {}) {
  const notify = vi.fn()
  const mutateAsync = vi.fn()
  const refetch = vi.fn().mockResolvedValue(undefined)
  const reset = vi.fn()
  vi.mocked(useTodosQuery).mockReturnValue({
    data: [todoFixture],
    isPending: false,
    isFetching: false,
    isError: false,
    error: null,
    refetch,
    ...query,
  } as unknown as ReturnType<typeof useTodosQuery>)
  vi.mocked(useUpdateTodoMutation).mockReturnValue({
    error: null,
    reset,
    mutateAsync,
    ...mutation,
  } as unknown as ReturnType<typeof useUpdateTodoMutation>)
  vi.mocked(useTodosBusy).mockReturnValue(busy)
  vi.mocked(useNotice).mockReturnValue({ message, notify })
  vi.mocked(useTodoFilters).mockImplementation((todos) => ({
    filter: 'all',
    search: 'demo',
    sort: 'newest',
    visible: todos,
    setFilter: vi.fn(),
    setSearch: vi.fn(),
    setSort: vi.fn(),
  }))
  render(<TodosPage />)
  return { notify, mutateAsync, refetch, reset, user: userEvent.setup() }
}

it('displays a query failure and resets mutation errors before retrying', async () => {
  const user = userEvent.setup()
  const refetch = vi.fn().mockResolvedValue(undefined)
  const reset = vi.fn()
  vi.mocked(useTodosQuery).mockReturnValue({
    data: [],
    isPending: false,
    isFetching: false,
    isError: true,
    error: new Error('The server is unavailable.'),
    refetch,
  } as unknown as ReturnType<typeof useTodosQuery>)
  vi.mocked(useUpdateTodoMutation).mockReturnValue({
    error: null,
    reset,
    mutateAsync: vi.fn(),
  } as unknown as ReturnType<typeof useUpdateTodoMutation>)
  vi.mocked(useTodosBusy).mockReturnValue(false)
  vi.mocked(useNotice).mockReturnValue({ message: '', notify: vi.fn() })
  vi.mocked(useTodoFilters).mockReturnValue({
    filter: 'all',
    search: '',
    sort: 'newest',
    visible: [],
    setFilter: vi.fn(),
    setSearch: vi.fn(),
    setSort: vi.fn(),
  })
  render(<TodosPage />)
  expect(screen.getByTestId('alert')).toHaveTextContent(
    'The server is unavailable.',
  )
  await user.click(screen.getByRole('button', { name: 'Try again' }))
  await waitFor(() => expect(refetch).toHaveBeenCalledTimes(1))
  expect(reset).toHaveBeenCalledTimes(1)
  expect(reset.mock.invocationCallOrder[0]).toBeLessThan(
    refetch.mock.invocationCallOrder[0],
  )
})

it('passes query state and filter values to the list and filters', () => {
  setup({ message: 'Task deleted.' })
  expect(useTodoFilters).toHaveBeenCalledWith([todoFixture])
  expect(
    screen.getByText(
      'visible:1 hasTodos:true loading:false failed:false busy:false',
    ),
  ).toBeVisible()
  expect(screen.getByText('Search: demo')).toBeVisible()
  expect(screen.getByText('Notice: Task deleted.')).toBeVisible()
  expect(screen.queryByTestId('alert')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Header create' })).toBeEnabled()
})

it('treats missing data as an empty list while loading', () => {
  setup({ query: { data: undefined, isPending: true } })
  expect(useTodoFilters).toHaveBeenCalledWith([])
  expect(
    screen.getByText('visible:0 hasTodos:false loading:true failed:false busy:false'),
  ).toBeVisible()
  expect(screen.getByRole('button', { name: 'Header create' })).toBeDisabled()
})

it('disables creating and retrying while busy', () => {
  setup({ busy: true, mutation: { error: new Error('Toggle failed.') } })
  expect(screen.getByRole('button', { name: 'Header create' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Try again' })).toBeDisabled()
})

it('disables retrying while the list is refetching', () => {
  setup({ query: { isFetching: true, error: new Error('Down') } })
  expect(screen.getByRole('button', { name: 'Try again' })).toBeDisabled()
})

it('prefers the toggle error over the query error', () => {
  setup({
    query: { error: new Error('Query failed.') },
    mutation: { error: new Error('Toggle failed.') },
  })
  expect(screen.getByTestId('alert')).toHaveTextContent('Toggle failed.')
  expect(screen.getByTestId('alert')).not.toHaveTextContent('Query failed.')
})

it.each([
  { completed: false, notice: 'Another task complete. Well done!' },
  { completed: true, notice: 'Task marked as active.' },
])(
  'toggles a task (completed: $completed) and notifies the result',
  async ({ completed, notice }) => {
    const { mutateAsync, notify, user } = setup({
      query: { data: [{ ...todoFixture, completed }] },
    })
    mutateAsync.mockResolvedValue({ ...todoFixture, completed: !completed })
    await user.click(
      screen.getByRole('button', { name: `Toggle ${todoFixture.title}` }),
    )
    expect(mutateAsync).toHaveBeenCalledWith({
      id: todoFixture.id,
      input: { completed: !completed },
    })
    await waitFor(() => expect(notify).toHaveBeenCalledWith(notice))
  },
)

it.each([
  { pinned: false, notice: 'Task pinned to the top.' },
  { pinned: true, notice: 'Task unpinned.' },
])(
  'pins a task (pinned: $pinned) and notifies the result',
  async ({ pinned, notice }) => {
    const { mutateAsync, notify, user } = setup({
      query: { data: [{ ...todoFixture, pinned }] },
    })
    mutateAsync.mockResolvedValue({ ...todoFixture, pinned: !pinned })
    await user.click(
      screen.getByRole('button', { name: `Pin ${todoFixture.title}` }),
    )
    expect(mutateAsync).toHaveBeenCalledWith({
      id: todoFixture.id,
      input: { pinned: !pinned },
    })
    await waitFor(() => expect(notify).toHaveBeenCalledWith(notice))
  },
)

it('does not notify when pinning fails', async () => {
  const { mutateAsync, notify, user } = setup()
  mutateAsync.mockRejectedValue(new Error('Pin failed.'))
  await user.click(
    screen.getByRole('button', { name: `Pin ${todoFixture.title}` }),
  )
  await waitFor(() => expect(mutateAsync).toHaveBeenCalled())
  expect(notify).not.toHaveBeenCalled()
})

it('ignores pin requests while another mutation is running', async () => {
  const { mutateAsync, user } = setup({ busy: true })
  await user.click(
    screen.getByRole('button', { name: `Pin ${todoFixture.title}` }),
  )
  expect(mutateAsync).not.toHaveBeenCalled()
})

it('does not notify when toggling fails', async () => {
  const { mutateAsync, notify, user } = setup()
  mutateAsync.mockRejectedValue(new Error('Toggle failed.'))
  await user.click(
    screen.getByRole('button', { name: `Toggle ${todoFixture.title}` }),
  )
  await waitFor(() => expect(mutateAsync).toHaveBeenCalled())
  expect(notify).not.toHaveBeenCalled()
})

it('ignores toggles while another mutation is running', async () => {
  const { mutateAsync, user } = setup({ busy: true })
  await user.click(
    screen.getByRole('button', { name: `Toggle ${todoFixture.title}` }),
  )
  expect(mutateAsync).not.toHaveBeenCalled()
})

it.each(['Header create', 'List create'])(
  'opens the editor for a new task from "%s" and closes it',
  async (name) => {
    const { user } = setup()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name }))
    expect(screen.getByRole('dialog', { name: 'Editor' })).toHaveTextContent(
      'Editing new task',
    )
    await user.click(screen.getByRole('button', { name: 'Close editor' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  },
)

it('edits an existing task and notifies after saving', async () => {
  const { notify, user } = setup()
  await user.click(
    screen.getByRole('button', { name: `Edit ${todoFixture.title}` }),
  )
  expect(screen.getByRole('dialog', { name: 'Editor' })).toHaveTextContent(
    `Editing ${todoFixture.title}`,
  )
  await user.click(screen.getByRole('button', { name: 'Save editor' }))
  expect(notify).toHaveBeenCalledWith('Changes saved.')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

it('confirms deletion, closes the dialog and notifies', async () => {
  const { notify, user } = setup()
  await user.click(
    screen.getByRole('button', { name: `Delete ${todoFixture.title}` }),
  )
  expect(screen.getByRole('dialog', { name: 'Delete' })).toHaveTextContent(
    `Deleting ${todoFixture.title}`,
  )
  await user.click(screen.getByRole('button', { name: 'Confirm delete' }))
  expect(notify).toHaveBeenCalledWith('Task deleted.')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

it('cancels deletion without notifying', async () => {
  const { notify, user } = setup()
  await user.click(
    screen.getByRole('button', { name: `Delete ${todoFixture.title}` }),
  )
  await user.click(screen.getByRole('button', { name: 'Close delete' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(notify).not.toHaveBeenCalled()
})
