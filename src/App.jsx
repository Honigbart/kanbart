import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ImprintPage from './ImprintPage'
import './App.css'

const STORAGE_KEY = 'kanbart.board.v1'
const TRASH_KEY = 'kanbart.trash.v1'
const THEME_KEY = 'kanbart.theme.v1'
const HISTORY_LIMIT = 50
const IMPRESSUM_PATH = '/impressum'

const COLUMNS = [
  { id: 'backlog', label: 'Backlog' },
  { id: 'doing', label: 'In Progress' },
  { id: 'done', label: 'Done' },
]

const PRIORITIES = [
  { id: 'high', label: 'High' },
  { id: 'mid', label: 'Mid' },
  { id: 'low', label: 'Low' },
]

const PRIORITY_BY_KEY = {
  1: 'low',
  2: 'mid',
  3: 'high',
}

const PRIORITY_DOT_ORDER = ['low', 'mid', 'high']
const PRIORITY_DOT_HINT = {
  low: 'low prio',
  mid: 'mid pro',
  high: 'high prio',
}

const DONATION_URL = 'https://www.buymeacoffee.com/honigbartstudios'
const EXPAND_COLLAPSE_DELAY_MS = 240
const DEFAULT_EXPANDED_CARD_HEIGHT = 760
const MIN_EXPANDED_CARD_HEIGHT = 280

const HELP_SHORTCUTS = [
  { keys: ['N'], description: 'Create a new card in Backlog' },
  { keys: ['Enter'], description: 'Title: jump to description / Description: start todo / Todo: add next' },
  { keys: ['Shift', 'Enter'], description: 'Add new line in description' },
  { keys: ['Backspace'], description: 'Remove empty todo item' },
  { keys: ['1', '2', '3'], joiner: '/', description: 'Set priority: low / mid / high' },
  { keys: ['←', '→'], description: 'Move card between columns' },
  { keys: ['↑', '↓'], description: 'Reorder card in current column' },
  { keys: ['E'], description: 'Edit selected card (card focused)' },
  { keys: ['Delete'], description: 'Move selected card to trash' },
  { keys: ['Esc'], description: 'Leave card edit / close open dialogs' },
]

const ABOUT_FACTS = [
  {
    title: 'Free to use',
    detail: 'All features are available without subscriptions or paywalls.',
  },
  {
    title: 'Ad-free',
    detail: 'No ads. Just your board and your tasks.',
  },
  {
    title: 'Tracking-free',
    detail: 'No third-party analytics or marketing trackers.',
  },
  {
    title: 'Cloud-free',
    detail: 'Your board is saved in your browser (localStorage). No cloud sync.',
  },
]

function sortByOrder(cards) {
  return [...cards].sort((left, right) => left.order - right.order)
}

function nextOrder(cards, columnId) {
  const maxOrder = cards
    .filter((card) => card.column === columnId)
    .reduce((max, card) => Math.max(max, card.order), -1)
  return maxOrder + 1
}

function createTodoId(cardId) {
  return `todo-${cardId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function normalizeTodoItem(item, cardId) {
  const todoId =
    typeof item?.id === 'string' && item.id.length > 0
      ? item.id
      : createTodoId(cardId)

  return {
    id: todoId,
    text: typeof item?.text === 'string' ? item.text : '',
    done: Boolean(item?.done),
  }
}

function normalizeCard(card) {
  const fallbackId = Number(card.id)
  const mappedPriority = card.priority === 'normal' ? 'mid' : card.priority
  const fallbackPriority = PRIORITIES.some((item) => item.id === mappedPriority)
    ? mappedPriority
    : 'mid'
  const fallbackColumn = COLUMNS.some((item) => item.id === card.column)
    ? card.column
    : 'backlog'
  const fallbackText =
    typeof card.text === 'string'
      ? card.text
      : typeof card.body === 'string'
        ? card.body
      : typeof card.description === 'string'
          ? card.description
          : ''
  const fallbackTodos = Array.isArray(card.todos)
    ? card.todos
        .filter((todo) => todo && typeof todo === 'object')
        .map((todo) => normalizeTodoItem(todo, Number.isFinite(fallbackId) ? fallbackId : 'card'))
    : []

  return {
    id: fallbackId,
    title: String(card.title ?? '').trim(),
    text: String(fallbackText),
    todos: fallbackTodos,
    priority: fallbackPriority,
    column: fallbackColumn,
    order: Number.isFinite(card.order) ? Number(card.order) : 0,
  }
}

function loadCards() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return []
    }

    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed
      .filter((item) => item && typeof item === 'object')
      .map(normalizeCard)
      .filter((item) => Number.isFinite(item.id) && item.title.length > 0)
  } catch {
    return []
  }
}

function createTrashId(cardId, deletedAt) {
  return `${cardId}-${deletedAt}-${Math.random().toString(36).slice(2, 8)}`
}

function normalizeTrashItem(item) {
  const base = normalizeCard(item)
  const deletedAt = Number.isFinite(item.deletedAt) ? Number(item.deletedAt) : Date.now()
  const trashId =
    typeof item.trashId === 'string' && item.trashId.length > 0
      ? item.trashId
      : createTrashId(base.id, deletedAt)

  return {
    ...base,
    trashId,
    deletedAt,
  }
}

function loadTrashedCards() {
  try {
    const raw = localStorage.getItem(TRASH_KEY)
    if (!raw) {
      return []
    }

    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed
      .filter((item) => item && typeof item === 'object')
      .map(normalizeTrashItem)
      .filter((item) => Number.isFinite(item.id))
  } catch {
    return []
  }
}

function loadTheme() {
  try {
    const savedTheme = localStorage.getItem(THEME_KEY)
    if (savedTheme === 'light' || savedTheme === 'dark') {
      return savedTheme
    }
  } catch {
    return 'dark'
  }
  return 'dark'
}

function isTypingElement(target) {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  const tag = target.tagName
  return (
    target.isContentEditable ||
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT'
  )
}

function pushBounded(stack, value) {
  const next = [...stack, value]
  if (next.length <= HISTORY_LIMIT) {
    return next
  }
  return next.slice(next.length - HISTORY_LIMIT)
}

function isLongCardText(value) {
  const text = String(value ?? '').trim()
  if (!text) {
    return false
  }
  const lineCount = text.split(/\r?\n/).length
  return text.length > 120 || lineCount > 3
}

function isLongTodoContent(todos) {
  if (!Array.isArray(todos) || todos.length === 0) {
    return false
  }

  const nonEmptyTodos = todos
    .map((todo) => String(todo?.text ?? '').trim())
    .filter((value) => value.length > 0)

  if (nonEmptyTodos.length === 0) {
    return false
  }

  if (nonEmptyTodos.length >= 3) {
    return true
  }

  return nonEmptyTodos.some((value) => {
    const lineCount = value.split(/\r?\n/).length
    return value.length > 42 || lineCount > 1
  })
}

function hasExpandableCardContent(text, todos) {
  return isLongCardText(text) || isLongTodoContent(todos)
}

function normalizePathname(pathname) {
  if (!pathname || pathname === '/') {
    return '/'
  }

  const normalized = pathname.replace(/\/+$/, '')
  return normalized || '/'
}

function Icon({ children }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  )
}

function IconDownload() {
  return (
    <Icon>
      <path d="M12 4v10" />
      <path d="M8.5 10.5L12 14l3.5-3.5" />
      <path d="M5 18h14" />
    </Icon>
  )
}

function IconUpload() {
  return (
    <Icon>
      <path d="M12 20V10" />
      <path d="M8.5 13.5L12 10l3.5 3.5" />
      <path d="M5 6h14" />
    </Icon>
  )
}

function SymbolIcon({ name, className = '' }) {
  return (
    <span className={`material-symbol${className ? ` ${className}` : ''}`} aria-hidden="true">
      {name}
    </span>
  )
}

function App() {
  const [pathname, setPathname] = useState(() =>
    normalizePathname(window.location.pathname),
  )
  const [cards, setCards] = useState(() => loadCards())
  const [trashedCards, setTrashedCards] = useState(() => loadTrashedCards())
  const [theme, setTheme] = useState(() => loadTheme())
  const [searchQuery, setSearchQuery] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [editingText, setEditingText] = useState('')
  const [editingFocus, setEditingFocus] = useState('title')
  const [editingPinnedHeight, setEditingPinnedHeight] = useState(null)
  const [editingDescriptionHeight, setEditingDescriptionHeight] = useState(null)
  const [expandedCardId, setExpandedCardId] = useState(null)
  const [cardExpandedHeights, setCardExpandedHeights] = useState({})
  const [draggingId, setDraggingId] = useState(null)

  const [undoStack, setUndoStack] = useState([])
  const [redoStack, setRedoStack] = useState([])

  const [isHelpOpen, setIsHelpOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isAboutOpen, setIsAboutOpen] = useState(false)
  const [isTrashOpen, setIsTrashOpen] = useState(false)
  const [isTrashDragOver, setIsTrashDragOver] = useState(false)
  const [trashUndoItem, setTrashUndoItem] = useState(null)

  const nextIdRef = useRef(
    cards.reduce((max, card) => Math.max(max, card.id), 0) + 1,
  )
  const cardsRef = useRef(cards)
  const trashRef = useRef(trashedCards)
  const importInputRef = useRef(null)
  const settingsButtonRef = useRef(null)
  const helpButtonRef = useRef(null)
  const aboutButtonRef = useRef(null)
  const trashButtonRef = useRef(null)
  const trashUndoTimerRef = useRef(null)
  const expandCollapseTimerRef = useRef(null)
  const cardMeasureFrameRef = useRef(null)
  const columnResizeObserverRef = useRef(null)
  const todoInputRefs = useRef(new Map())

  const isImprintRoute = pathname === IMPRESSUM_PATH

  const applyWithHistory = useCallback((updater) => {
    const previousSnapshot = {
      cards: cardsRef.current,
      trash: trashRef.current,
    }
    const nextSnapshot =
      typeof updater === 'function' ? updater(previousSnapshot) : updater
    if (!nextSnapshot) {
      return
    }

    const nextCards = Array.isArray(nextSnapshot.cards)
      ? nextSnapshot.cards
      : previousSnapshot.cards
    const nextTrash = Array.isArray(nextSnapshot.trash)
      ? nextSnapshot.trash
      : previousSnapshot.trash

    if (nextCards === previousSnapshot.cards && nextTrash === previousSnapshot.trash) {
      return
    }

    setUndoStack((stack) => pushBounded(stack, previousSnapshot))
    setRedoStack([])
    cardsRef.current = nextCards
    trashRef.current = nextTrash
    setCards(nextCards)
    setTrashedCards(nextTrash)
  }, [])

  const cancelPendingCardCollapse = useCallback(() => {
    if (expandCollapseTimerRef.current != null) {
      window.clearTimeout(expandCollapseTimerRef.current)
      expandCollapseTimerRef.current = null
    }
  }, [])

  const openCardExpansion = useCallback((cardId) => {
    cancelPendingCardCollapse()
    setExpandedCardId(cardId)
  }, [cancelPendingCardCollapse])

  const scheduleCardExpansionCollapse = useCallback((cardId) => {
    cancelPendingCardCollapse()
    expandCollapseTimerRef.current = window.setTimeout(() => {
      setExpandedCardId((activeId) => (activeId === cardId ? null : activeId))
      expandCollapseTimerRef.current = null
    }, EXPAND_COLLAPSE_DELAY_MS)
  }, [cancelPendingCardCollapse])

  const measureCardExpandedHeights = useCallback(() => {
    const nextHeights = {}
    const cardNodes = document.querySelectorAll('[data-card-id]')
    for (const node of cardNodes) {
      if (!(node instanceof HTMLElement)) {
        continue
      }

      const cardId = Number(node.dataset.cardId)
      if (!Number.isFinite(cardId)) {
        continue
      }

      const columnBody = node.closest('.column-body')
      const columnHeight =
        columnBody instanceof HTMLElement ? columnBody.clientHeight : 0
      const expandedHeight = Math.max(
        MIN_EXPANDED_CARD_HEIGHT,
        columnHeight > 0 ? columnHeight - 8 : DEFAULT_EXPANDED_CARD_HEIGHT,
      )

      nextHeights[cardId] = Math.round(expandedHeight)
    }

    setCardExpandedHeights((previousHeights) => {
      const previousIds = Object.keys(previousHeights)
      const nextIds = Object.keys(nextHeights)
      if (previousIds.length !== nextIds.length) {
        return nextHeights
      }
      for (const id of nextIds) {
        if (previousHeights[id] !== nextHeights[id]) {
          return nextHeights
        }
      }
      return previousHeights
    })
  }, [])

  const scheduleCardHeightMeasure = useCallback(() => {
    if (cardMeasureFrameRef.current != null) {
      window.cancelAnimationFrame(cardMeasureFrameRef.current)
    }
    cardMeasureFrameRef.current = window.requestAnimationFrame(() => {
      cardMeasureFrameRef.current = null
      measureCardExpandedHeights()
    })
  }, [measureCardExpandedHeights])

  const createEmptyCardInBacklog = useCallback(() => {
    const id = nextIdRef.current++
    applyWithHistory((previous) => ({
      cards: [
        ...previous.cards,
        {
          id,
          title: '',
          text: '',
          todos: [],
          priority: 'mid',
          column: 'backlog',
          order: nextOrder(previous.cards, 'backlog'),
        },
      ],
      trash: previous.trash,
    }))

    setEditingId(id)
    setEditingTitle('')
    setEditingText('')
    setEditingFocus('title')
    setEditingPinnedHeight(null)
    setEditingDescriptionHeight(null)

    return id
  }, [applyWithHistory])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cards))
  }, [cards])

  useEffect(() => {
    cardsRef.current = cards
  }, [cards])

  useEffect(() => {
    localStorage.setItem(TRASH_KEY, JSON.stringify(trashedCards))
  }, [trashedCards])

  useEffect(() => {
    trashRef.current = trashedCards
  }, [trashedCards])

  useEffect(() => {
    return () => {
      if (trashUndoTimerRef.current != null) {
        window.clearTimeout(trashUndoTimerRef.current)
      }
      if (expandCollapseTimerRef.current != null) {
        window.clearTimeout(expandCollapseTimerRef.current)
      }
      if (cardMeasureFrameRef.current != null) {
        window.cancelAnimationFrame(cardMeasureFrameRef.current)
      }
      if (columnResizeObserverRef.current != null) {
        columnResizeObserverRef.current.disconnect()
        columnResizeObserverRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    scheduleCardHeightMeasure()
  }, [cards, scheduleCardHeightMeasure])

  useEffect(() => {
    const onResize = () => scheduleCardHeightMeasure()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [scheduleCardHeightMeasure])

  useEffect(() => {
    if (isImprintRoute) {
      return
    }
    if (typeof window === 'undefined' || typeof ResizeObserver === 'undefined') {
      return
    }

    const observer = new ResizeObserver(() => {
      scheduleCardHeightMeasure()
    })
    columnResizeObserverRef.current = observer

    const columnBodies = document.querySelectorAll('.column-body')
    for (const node of columnBodies) {
      if (node instanceof HTMLElement) {
        observer.observe(node)
      }
    }

    return () => {
      observer.disconnect()
      if (columnResizeObserverRef.current === observer) {
        columnResizeObserverRef.current = null
      }
    }
  }, [isImprintRoute, scheduleCardHeightMeasure])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem(THEME_KEY, theme)
    } catch {
      // Continue without persisting theme preference.
    }
  }, [theme])

  useEffect(() => {
    const onPopState = () => {
      setPathname(normalizePathname(window.location.pathname))
    }

    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        if (isTrashOpen) {
          event.preventDefault()
          setIsTrashOpen(false)
          trashButtonRef.current?.focus()
          return
        }

        if (isHelpOpen) {
          event.preventDefault()
          setIsHelpOpen(false)
          helpButtonRef.current?.focus()
          return
        }

        if (isSettingsOpen) {
          event.preventDefault()
          setIsSettingsOpen(false)
          settingsButtonRef.current?.focus()
          return
        }

        if (isAboutOpen) {
          event.preventDefault()
          setIsAboutOpen(false)
          aboutButtonRef.current?.focus()
          return
        }

      }

      if (event.key.toLowerCase() !== 'n') {
        return
      }

      if (isHelpOpen || isSettingsOpen || isAboutOpen || isTrashOpen) {
        return
      }

      if (isTypingElement(event.target)) {
        return
      }

      event.preventDefault()
      createEmptyCardInBacklog()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isHelpOpen, isSettingsOpen, isAboutOpen, isTrashOpen, createEmptyCardInBacklog])

  const cardsByColumn = useMemo(() => {
    const grouped = {}
    for (const column of COLUMNS) {
      grouped[column.id] = sortByOrder(
        cards.filter((card) => card.column === column.id),
      )
    }
    return grouped
  }, [cards])

  useEffect(() => {
    if (expandedCardId == null) {
      return
    }

    const expandedCard = cards.find((card) => card.id === expandedCardId)
    if (!expandedCard) {
      setExpandedCardId(null)
      return
    }

    const currentText =
      editingId === expandedCard.id ? editingText : expandedCard.text ?? ''
    if (!hasExpandableCardContent(currentText, expandedCard.todos)) {
      setExpandedCardId(null)
    }
  }, [cards, editingId, editingText, expandedCardId])

  const backlogCount = cardsByColumn.backlog.length

  function focusCardById(id) {
    window.requestAnimationFrame(() => {
      const target = document.querySelector(`[data-card-id="${id}"]`)
      if (target instanceof HTMLElement) {
        target.focus()
      }
    })
  }

  function setTodoInputRef(todoId, node) {
    if (node) {
      todoInputRefs.current.set(todoId, node)
      return
    }
    todoInputRefs.current.delete(todoId)
  }

  function focusTodoInput(todoId) {
    window.requestAnimationFrame(() => {
      const target = todoInputRefs.current.get(todoId)
      if (!(target instanceof HTMLInputElement)) {
        return
      }
      target.focus()
      const cursor = target.value.length
      target.setSelectionRange(cursor, cursor)
    })
  }

  function updateCardTodos(cardId, updater) {
    applyWithHistory((previous) => {
      let changed = false
      const nextCards = previous.cards.map((card) => {
        if (card.id !== cardId) {
          return card
        }
        const currentTodos = Array.isArray(card.todos) ? card.todos : []
        const nextTodos =
          typeof updater === 'function'
            ? updater(currentTodos, card)
            : currentTodos
        if (!Array.isArray(nextTodos) || nextTodos === currentTodos) {
          return card
        }
        changed = true
        return {
          ...card,
          todos: nextTodos,
        }
      })
      if (!changed) {
        return previous
      }
      return {
        cards: nextCards,
        trash: previous.trash,
      }
    })
  }

  function focusOrCreateFirstTodo(cardId) {
    const card = cardsRef.current.find((item) => item.id === cardId)
    if (!card) {
      return
    }
    const todos = Array.isArray(card.todos) ? card.todos : []
    if (todos.length > 0) {
      const preferred =
        todos.find((todo) => !todo.done && todo.text.trim().length === 0) ??
        todos.find((todo) => !todo.done) ??
        todos[0]
      if (preferred) {
        focusTodoInput(preferred.id)
      }
      return
    }

    const todoId = createTodoId(cardId)
    const nextTodos = [{ id: todoId, text: '', done: false }]
    updateCardTodos(cardId, () => nextTodos)
    focusTodoInput(todoId)
  }

  function addTodoAfter(cardId, todoId) {
    let createdTodoId = null
    updateCardTodos(cardId, (todos) => {
      const atIndex = todos.findIndex((todo) => todo.id === todoId)
      const insertIndex = atIndex >= 0 ? atIndex + 1 : todos.length
      createdTodoId = createTodoId(cardId)
      const next = [...todos]
      next.splice(insertIndex, 0, { id: createdTodoId, text: '', done: false })
      return next
    })
    if (createdTodoId) {
      focusTodoInput(createdTodoId)
    }
  }

  function updateTodoText(cardId, todoId, value) {
    updateCardTodos(cardId, (todos) => {
      let changed = false
      const next = todos.map((todo) => {
        if (todo.id !== todoId) {
          return todo
        }
        if (todo.text === value) {
          return todo
        }
        changed = true
        return { ...todo, text: value }
      })
      if (!changed) {
        return todos
      }
      return next
    })
  }

  function toggleTodoDone(cardId, todoId) {
    updateCardTodos(cardId, (todos) => {
      let changed = false
      const next = todos.map((todo) => {
        if (todo.id !== todoId) {
          return todo
        }
        changed = true
        return { ...todo, done: !todo.done }
      })
      if (!changed) {
        return todos
      }
      return next
    })
  }

  function removeTodo(cardId, todoId, options = {}) {
    const { focusPrevious = true } = options
    let nextFocusId = null
    updateCardTodos(cardId, (todos) => {
      const atIndex = todos.findIndex((todo) => todo.id === todoId)
      if (atIndex === -1) {
        return todos
      }
      const next = todos.filter((todo) => todo.id !== todoId)
      if (focusPrevious && next.length > 0) {
        const focusIndex = Math.max(0, atIndex - 1)
        nextFocusId = next[focusIndex]?.id ?? null
      }
      return next
    })
    if (nextFocusId) {
      focusTodoInput(nextFocusId)
    }
  }

  function handleEditFormBlur(event, cardId) {
    const nextFocused = event.relatedTarget
    if (nextFocused instanceof Node && event.currentTarget.contains(nextFocused)) {
      return
    }
    saveEdit(cardId)
  }

  function renderPriorityDots(card) {
    return (
      <div
        className="priority-dots"
        role="group"
        aria-label={`Set priority for ${card.title}`}
      >
        {PRIORITY_DOT_ORDER.map((priorityId) => (
          <button
            key={`${card.id}-${priorityId}`}
            type="button"
            className={`priority-dot priority-${priorityId}${card.priority === priorityId ? ' active' : ''}`}
            data-tooltip={PRIORITY_DOT_HINT[priorityId]}
            aria-label={`Set ${priorityId} priority for ${card.title}`}
            aria-pressed={card.priority === priorityId}
            onClick={() => setCardPriority(card.id, priorityId)}
          />
        ))}
      </div>
    )
  }

  function renderTodoSection(card) {
    const todos = Array.isArray(card.todos) ? card.todos : []

    return (
      <section className="todo-section" aria-label={`Todo list for ${card.title || 'card'}`}>
        <p className="todo-heading">Todo List</p>
        {todos.length === 0 ? (
          <button
            type="button"
            className="todo-create"
            onClick={() => focusOrCreateFirstTodo(card.id)}
          >
            Click to add first item
          </button>
        ) : (
          <div className="todo-list">
            {todos.map((todo) => (
              <div
                key={todo.id}
                className={`todo-item${todo.done ? ' is-done' : ''}`}
              >
                <button
                  type="button"
                  className={`todo-checkbox${todo.done ? ' is-done' : ''}`}
                  aria-label={todo.done ? 'Mark todo as open' : 'Mark todo as done'}
                  aria-pressed={todo.done}
                  onClick={() => toggleTodoDone(card.id, todo.id)}
                >
                  <span className="todo-checkmark" aria-hidden="true">
                    {todo.done ? '✓' : ''}
                  </span>
                </button>
                <input
                  data-todo-id={todo.id}
                  ref={(node) => setTodoInputRef(todo.id, node)}
                  className="todo-input"
                  value={todo.text}
                  onChange={(event) => updateTodoText(card.id, todo.id, event.target.value)}
                  onKeyDown={(event) => handleTodoInputKeyDown(event, card.id, todo.id)}
                  placeholder="Todo item"
                  aria-label={`Todo item for ${card.title || 'card'}`}
                />
              </div>
            ))}
          </div>
        )}
      </section>
    )
  }

  function clearEditState() {
    setEditingId(null)
    setEditingTitle('')
    setEditingText('')
    setEditingFocus('title')
    setEditingPinnedHeight(null)
    setEditingDescriptionHeight(null)
  }

  function dismissTrashUndoToast() {
    if (trashUndoTimerRef.current != null) {
      window.clearTimeout(trashUndoTimerRef.current)
      trashUndoTimerRef.current = null
    }
    setTrashUndoItem(null)
  }

  function removeCardFromBoard(id) {
    applyWithHistory((previous) => {
      const nextCards = previous.cards.filter((card) => card.id !== id)
      if (nextCards.length === previous.cards.length) {
        return previous
      }

      return {
        cards: nextCards,
        trash: previous.trash,
      }
    })

    if (editingId === id) {
      clearEditState()
    }
    if (expandedCardId === id) {
      setExpandedCardId(null)
    }
  }

  function moveCardToTrash(id) {
    applyWithHistory((previous) => {
      const card = previous.cards.find((item) => item.id === id)
      if (!card) {
        return previous
      }

      const deletedAt = Date.now()
      const trashItem = {
        ...card,
        trashId: createTrashId(card.id, deletedAt),
        deletedAt,
      }
      const nextCards = previous.cards.filter((item) => item.id !== id)

      return {
        cards: nextCards,
        trash: [trashItem, ...previous.trash],
      }
    })

    if (editingId === id) {
      clearEditState()
    }
    if (expandedCardId === id) {
      setExpandedCardId(null)
    }
  }

  function restoreCardFromTrash(trashId) {
    applyWithHistory((previous) => {
      const item = previous.trash.find((card) => card.trashId === trashId)
      if (!item) {
        return previous
      }

      const nextTrash = previous.trash.filter((card) => card.trashId !== trashId)
      const shiftedBacklog = previous.cards.map((card) =>
        card.column === 'backlog'
          ? { ...card, order: card.order + 1 }
          : card,
      )

      let restoreId = item.id
      if (shiftedBacklog.some((card) => card.id === restoreId)) {
        restoreId = nextIdRef.current++
      }
      if (restoreId >= nextIdRef.current) {
        nextIdRef.current = restoreId + 1
      }

      return {
        cards: [
          ...shiftedBacklog,
          {
            id: restoreId,
            title: item.title,
            text: item.text,
            todos: Array.isArray(item.todos)
              ? item.todos.map((todo) => normalizeTodoItem(todo, restoreId))
              : [],
            priority: item.priority,
            column: 'backlog',
            order: 0,
          },
        ],
        trash: nextTrash,
      }
    })
  }

  function deleteTrashCardPermanently(trashId) {
    let removedItem = null
    applyWithHistory((previous) => {
      const item = previous.trash.find((card) => card.trashId === trashId)
      if (!item) {
        return previous
      }

      removedItem = item
      return {
        cards: previous.cards,
        trash: previous.trash.filter((card) => card.trashId !== trashId),
      }
    })

    if (!removedItem) {
      return
    }

    dismissTrashUndoToast()
    setTrashUndoItem(removedItem)
    trashUndoTimerRef.current = window.setTimeout(() => {
      trashUndoTimerRef.current = null
      setTrashUndoItem(null)
    }, 8000)
  }

  function undoPermanentTrashDelete() {
    if (!trashUndoItem) {
      return
    }

    const item = trashUndoItem
    dismissTrashUndoToast()
    applyWithHistory((previous) => {
      if (previous.trash.some((card) => card.trashId === item.trashId)) {
        return previous
      }
      return {
        cards: previous.cards,
        trash: [item, ...previous.trash],
      }
    })
  }

  function emptyTrashPermanently() {
    if (trashedCards.length === 0) {
      return
    }

    const accepted = window.confirm('Permanently delete all cards in trash?')
    if (!accepted) {
      return
    }

    dismissTrashUndoToast()
    applyWithHistory((previous) => ({
      cards: previous.cards,
      trash: [],
    }))
  }

  function startEdit(card, focusArea = 'title') {
    const cardNode = document.querySelector(`[data-card-id="${card.id}"]`)
    if (cardNode instanceof HTMLElement) {
      setEditingPinnedHeight({
        id: card.id,
        height: cardNode.offsetHeight,
      })

      const descriptionNode = cardNode.querySelector('.card-content-area')
      if (descriptionNode instanceof HTMLElement) {
        setEditingDescriptionHeight({
          id: card.id,
          height: descriptionNode.offsetHeight,
        })
      } else {
        setEditingDescriptionHeight(null)
      }
    } else {
      setEditingPinnedHeight(null)
      setEditingDescriptionHeight(null)
    }

    setEditingId(card.id)
    setEditingTitle(card.title)
    setEditingText(card.text ?? '')
    setEditingFocus(focusArea)
    if (hasExpandableCardContent(card.text ?? '', card.todos)) {
      openCardExpansion(card.id)
    }
  }

  function saveEdit(id, options = {}) {
    const { focusCard = false } = options
    const title = editingTitle.trim()
    const text = editingText.trim()
    if (!title) {
      const existingCard = cards.find((card) => card.id === id)
      if (existingCard && existingCard.title.trim().length === 0) {
        removeCardFromBoard(id)
        return
      }
      clearEditState()
      if (focusCard) {
        focusCardById(id)
      }
      return
    }

    applyWithHistory((previous) => {
      let changed = false
      const nextCards = previous.cards.map((card) => {
        if (card.id !== id) {
          return card
        }
        if (
          card.title === title &&
          (card.text ?? '') === text
        ) {
          return card
        }
        changed = true
        return { ...card, title, text }
      })
      if (!changed) {
        return previous
      }
      return {
        cards: nextCards,
        trash: previous.trash,
      }
    })

    clearEditState()
    if (focusCard) {
      focusCardById(id)
    }
  }

  function handleTitleInputKeyDown(event) {
    if (event.isComposing) {
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      const form = event.currentTarget.form
      if (!(form instanceof HTMLFormElement)) {
        return
      }
      const textArea = form.querySelector('.card-text-input')
      if (textArea instanceof HTMLTextAreaElement) {
        textArea.focus()
        const cursor = textArea.value.length
        textArea.setSelectionRange(cursor, cursor)
      }
    }
  }

  function handleTextInputKeyDown(event, cardId) {
    if (event.isComposing) {
      return
    }
    if (event.key !== 'Enter') {
      return
    }
    if (event.shiftKey) {
      return
    }
    event.preventDefault()
    focusOrCreateFirstTodo(cardId)
  }

  function handleTodoInputKeyDown(event, cardId, todoId) {
    if (event.isComposing) {
      return
    }
    const isEmpty = event.currentTarget.value.trim().length === 0
    if (event.key === 'Enter') {
      event.preventDefault()
      if (isEmpty) {
        removeTodo(cardId, todoId, { focusPrevious: false })
        focusCardById(cardId)
        return
      }
      addTodoAfter(cardId, todoId)
      return
    }
    if (event.key === 'Backspace' && isEmpty) {
      event.preventDefault()
      removeTodo(cardId, todoId)
    }
  }

  function setCardPriority(id, priority) {
    applyWithHistory((previous) => {
      let changed = false
      const nextCards = previous.cards.map((card) => {
        if (card.id !== id || card.priority === priority) {
          return card
        }
        changed = true
        return { ...card, priority }
      })
      if (!changed) {
        return previous
      }
      return {
        cards: nextCards,
        trash: previous.trash,
      }
    })
  }

  function moveToColumn(id, targetColumn) {
    applyWithHistory((previous) => {
      const current = previous.cards.find((card) => card.id === id)
      if (!current || current.column === targetColumn) {
        return previous
      }

      const toOrder = nextOrder(previous.cards, targetColumn)
      return {
        cards: previous.cards.map((card) =>
          card.id === id
            ? { ...card, column: targetColumn, order: toOrder }
            : card,
        ),
        trash: previous.trash,
      }
    })
  }

  function shiftColumn(id, offset) {
    const current = cards.find((card) => card.id === id)
    if (!current) {
      return
    }

    const currentIndex = COLUMNS.findIndex((column) => column.id === current.column)
    const nextIndex = currentIndex + offset
    if (nextIndex < 0 || nextIndex >= COLUMNS.length) {
      return
    }

    moveToColumn(id, COLUMNS[nextIndex].id)
  }

  function reorderInColumn(id, offset) {
    applyWithHistory((previous) => {
      const current = previous.cards.find((card) => card.id === id)
      if (!current) {
        return previous
      }

      const orderedColumnCards = sortByOrder(
        previous.cards.filter((card) => card.column === current.column),
      )
      const currentIndex = orderedColumnCards.findIndex((card) => card.id === id)
      const nextIndex = currentIndex + offset
      if (nextIndex < 0 || nextIndex >= orderedColumnCards.length) {
        return previous
      }

      const swapWith = orderedColumnCards[nextIndex]
      return {
        cards: previous.cards.map((card) => {
          if (card.id === id) {
            return { ...card, order: swapWith.order }
          }
          if (card.id === swapWith.id) {
            return { ...card, order: current.order }
          }
          return card
        }),
        trash: previous.trash,
      }
    })
  }

  function handleDropOnColumn(columnId) {
    if (draggingId == null) {
      return
    }
    moveToColumn(draggingId, columnId)
    setDraggingId(null)
    setIsTrashDragOver(false)
  }

  function handleCardKeyDown(event, card) {
    if (event.isComposing || isTypingElement(event.target)) {
      return
    }

    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      shiftColumn(card.id, -1)
      focusCardById(card.id)
      return
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault()
      shiftColumn(card.id, 1)
      focusCardById(card.id)
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      reorderInColumn(card.id, -1)
      focusCardById(card.id)
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      reorderInColumn(card.id, 1)
      focusCardById(card.id)
      return
    }

    if (event.key.toLowerCase() === 'e') {
      event.preventDefault()
      startEdit(card)
      return
    }

    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault()
      moveCardToTrash(card.id)
      return
    }

    const maybePriority = PRIORITY_BY_KEY[event.key]
    if (maybePriority) {
      event.preventDefault()
      setCardPriority(card.id, maybePriority)
    }
  }

  function handleCardEditKeyDown(event, cardId) {
    if (event.isComposing) {
      return
    }
    if (event.key !== 'Escape') {
      return
    }
    event.preventDefault()
    event.stopPropagation()
    focusCardById(cardId)
  }

  function handleCardMouseEnter(cardId, canExpand) {
    if (!canExpand) {
      return
    }
    openCardExpansion(cardId)
  }

  function handleCardMouseLeave(event, cardId) {
    if (event.currentTarget.contains(document.activeElement)) {
      return
    }
    scheduleCardExpansionCollapse(cardId)
  }

  function handleCardFocus(cardId, canExpand) {
    if (!canExpand) {
      return
    }
    openCardExpansion(cardId)
  }

  function handleCardBlur(event, cardId) {
    const nextFocused = event.relatedTarget
    if (nextFocused instanceof Node && event.currentTarget.contains(nextFocused)) {
      return
    }
    if (event.currentTarget.matches(':hover')) {
      return
    }
    scheduleCardExpansionCollapse(cardId)
  }

  function handleCardClick(cardId, canExpand) {
    if (!canExpand) {
      return
    }
    openCardExpansion(cardId)
  }

  function undo() {
    setUndoStack((history) => {
      if (history.length === 0) {
        return history
      }

      const previous = history[history.length - 1]
      const currentSnapshot = {
        cards: cardsRef.current,
        trash: trashRef.current,
      }
      setRedoStack((redo) => pushBounded(redo, currentSnapshot))
      cardsRef.current = previous.cards
      trashRef.current = previous.trash
      setCards(previous.cards)
      setTrashedCards(previous.trash)
      clearEditState()
      setIsTrashDragOver(false)
      return history.slice(0, -1)
    })
  }

  function redo() {
    setRedoStack((history) => {
      if (history.length === 0) {
        return history
      }

      const next = history[history.length - 1]
      const currentSnapshot = {
        cards: cardsRef.current,
        trash: trashRef.current,
      }
      setUndoStack((undoHistory) => pushBounded(undoHistory, currentSnapshot))
      cardsRef.current = next.cards
      trashRef.current = next.trash
      setCards(next.cards)
      setTrashedCards(next.trash)
      clearEditState()
      setIsTrashDragOver(false)
      return history.slice(0, -1)
    })
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(cards, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `kanbart-${new Date().toISOString().slice(0, 10)}.json`
    document.body.append(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
  }

  async function importJson(event) {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    try {
      const text = await file.text()
      const parsed = JSON.parse(text)
      if (!Array.isArray(parsed)) {
        throw new Error('Invalid file')
      }

      const normalized = parsed
        .filter((item) => item && typeof item === 'object')
        .map(normalizeCard)
        .filter((item) => Number.isFinite(item.id) && item.title.length > 0)

      applyWithHistory((previous) => ({
        cards: normalized,
        trash: previous.trash,
      }))
      const maxId = normalized.reduce((max, card) => Math.max(max, card.id), 0)
      nextIdRef.current = maxId + 1
    } catch {
      window.alert('Import failed. Use a Kanbart JSON export file.')
    } finally {
      event.target.value = ''
    }
  }

  function closeTrashModal() {
    setIsTrashOpen(false)
    trashButtonRef.current?.focus()
  }

  function handleTrashDragEnter(event) {
    if (draggingId == null) {
      return
    }
    event.preventDefault()
    setIsTrashDragOver(true)
  }

  function handleTrashDragOver(event) {
    if (draggingId == null) {
      return
    }
    event.preventDefault()
    if (!isTrashDragOver) {
      setIsTrashDragOver(true)
    }
  }

  function handleTrashDragLeave(event) {
    const nextFocused = event.relatedTarget
    if (nextFocused instanceof Node && event.currentTarget.contains(nextFocused)) {
      return
    }
    setIsTrashDragOver(false)
  }

  function handleTrashDrop(event) {
    if (draggingId == null) {
      return
    }
    event.preventDefault()
    moveCardToTrash(draggingId)
    setDraggingId(null)
    setIsTrashDragOver(false)
  }

  function closeHelpModal() {
    setIsHelpOpen(false)
    helpButtonRef.current?.focus()
  }

  function closeSettingsModal() {
    setIsSettingsOpen(false)
    settingsButtonRef.current?.focus()
  }

  function closeAboutModal() {
    setIsAboutOpen(false)
    aboutButtonRef.current?.focus()
  }

  function handleNavigate(event, targetPath) {
    event.preventDefault()
    const normalized = normalizePathname(targetPath)
    if (normalized === pathname) {
      return
    }

    window.history.pushState({}, '', normalized)
    setPathname(normalized)
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }

  if (isImprintRoute) {
    return <ImprintPage onNavigateHome={(event) => handleNavigate(event, '/')} />
  }

  return (
    <div className="app-shell">
      <div className="app-frame">
        <header className="app-chrome">
          <h1 className="app-title">Kanbart</h1>
          <div className="chrome-search">
            <label className="visually-hidden" htmlFor="board-search">
              Search
            </label>
            <div className="search-shell">
              <input
                id="board-search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search"
                aria-label="Search cards"
              />
              <SymbolIcon name="search" className="search-symbol" />
            </div>
          </div>
          <div className="chrome-actions">
            <button
              ref={settingsButtonRef}
              type="button"
              className="icon-button"
              aria-label="Open settings"
              onClick={() => setIsSettingsOpen(true)}
            >
              <SymbolIcon name="settings" />
            </button>
            <button
              ref={helpButtonRef}
              type="button"
              className="icon-button"
              aria-label="Open help"
              onClick={() => setIsHelpOpen(true)}
            >
              <SymbolIcon name="help" />
            </button>
            <button
              ref={aboutButtonRef}
              type="button"
              className="icon-button"
              aria-label="Open about"
              onClick={() => setIsAboutOpen(true)}
            >
              <SymbolIcon name="info" />
            </button>
          </div>
        </header>

        <main className="board-grid">
          {COLUMNS.map((column) => {
            const orderedCards = cardsByColumn[column.id]
            const isBacklog = column.id === 'backlog'
            const backlogFillProgress = isBacklog ? Math.min(1, backlogCount / 3) : 1
            const backlogCtaRaise = isBacklog ? Math.round((1 - backlogFillProgress) * 18) : 0
            const backlogDockStateClass = isBacklog
              ? backlogFillProgress >= 1
                ? ' is-docked'
                : backlogFillProgress <= 0
                  ? ' is-empty'
                  : ' is-partial'
              : ''
            const showBacklogHint = isBacklog && backlogFillProgress < 1
            return (
              <section
                key={column.id}
                className="column panel"
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => handleDropOnColumn(column.id)}
              >
                <header className="column-header">
                  <h2>{column.label}</h2>
                  <span className="count-pill">{orderedCards.length}</span>
                </header>

                <div className="column-body">
                  <div className="cards-stack">
                    {orderedCards.map((card) => {
                      const isEditingCard = editingId === card.id
                      const cardText = isEditingCard ? editingText : card.text ?? ''
                      const isExpandableCard = hasExpandableCardContent(cardText, card.todos)
                      const isExpanded =
                        (isEditingCard && (isExpandableCard || expandedCardId === card.id)) ||
                        (expandedCardId === card.id && isExpandableCard)
                      const expandedHeight =
                        cardExpandedHeights[card.id] ?? DEFAULT_EXPANDED_CARD_HEIGHT
                      const editPinnedHeight =
                        editingPinnedHeight &&
                        editingPinnedHeight.id === card.id &&
                        Number.isFinite(editingPinnedHeight.height)
                          ? editingPinnedHeight.height
                          : null
                      const editDescriptionHeight =
                        editingDescriptionHeight &&
                        editingDescriptionHeight.id === card.id &&
                        Number.isFinite(editingDescriptionHeight.height)
                          ? editingDescriptionHeight.height
                          : null
                      const cardStyle =
                        {
                          '--card-expanded-max-height': `${expandedHeight}px`,
                          ...(editPinnedHeight
                            ? {
                                '--card-edit-min-height': `${editPinnedHeight}px`,
                              }
                            : {}),
                          ...(editDescriptionHeight
                            ? {
                                '--card-description-height': `${editDescriptionHeight}px`,
                              }
                            : {}),
                        }

                      return (
                        <article
                          key={card.id}
                          data-card-id={card.id}
                          className={`task-card priority-${card.priority}${draggingId === card.id ? ' is-dragging' : ''}${isEditingCard ? ' is-editing' : ''}${isExpanded ? ' is-expanded' : ''}`}
                          style={cardStyle}
                          draggable
                          tabIndex={0}
                          onMouseEnter={() => handleCardMouseEnter(card.id, isExpandableCard)}
                          onMouseLeave={(event) => handleCardMouseLeave(event, card.id)}
                          onFocus={() => handleCardFocus(card.id, isExpandableCard)}
                          onBlur={(event) => handleCardBlur(event, card.id)}
                          onClick={() => handleCardClick(card.id, isExpandableCard)}
                          onDragStart={(event) => {
                            event.dataTransfer.effectAllowed = 'move'
                            event.dataTransfer.setData('text/plain', String(card.id))
                            setDraggingId(card.id)
                          }}
                          onDragEnd={() => {
                            setDraggingId(null)
                            setIsTrashDragOver(false)
                          }}
                          onKeyDown={(event) => handleCardKeyDown(event, card)}
                        >
                          {isEditingCard ? (
                            <form
                              className="card-layout card-edit-form"
                              onSubmit={(event) => {
                                event.preventDefault()
                                saveEdit(card.id, { focusCard: true })
                              }}
                              onKeyDownCapture={(event) => handleCardEditKeyDown(event, card.id)}
                              onBlur={(event) => handleEditFormBlur(event, card.id)}
                            >
                              <div className="card-top-row">
                                <div className="card-title-form">
                                  <input
                                    className="card-title-input"
                                    value={editingTitle}
                                    onChange={(event) => setEditingTitle(event.target.value)}
                                    onKeyDown={handleTitleInputKeyDown}
                                    autoFocus={editingFocus === 'title'}
                                    placeholder="Title"
                                  />
                                </div>
                                {renderPriorityDots(card)}
                              </div>
                              <div className="card-main">
                                <div className="card-content-area">
                                  <textarea
                                    className="card-text-input"
                                    value={editingText}
                                    onChange={(event) => setEditingText(event.target.value)}
                                    onKeyDown={(event) => handleTextInputKeyDown(event, card.id)}
                                    autoFocus={editingFocus === 'text'}
                                    aria-label={`Edit text for ${card.title}`}
                                    placeholder="Description"
                                  />
                                </div>
                                {renderTodoSection(card)}
                              </div>
                            </form>
                          ) : (
                            <div className="card-layout">
                              <div className="card-top-row">
                                <p className="card-title" onClick={() => startEdit(card, 'title')}>
                                  {card.title}
                                </p>
                                {renderPriorityDots(card)}
                              </div>
                              <div className="card-main">
                                <div className="card-content-area" onClick={() => startEdit(card, 'text')}>
                                  <div className={`card-text-shell${card.text ? '' : ' is-ghost'}`}>
                                    {card.text ? (
                                      <p className="card-text">{card.text}</p>
                                    ) : (
                                      <p className="card-text ghost">Description</p>
                                    )}
                                  </div>
                                </div>
                                {renderTodoSection(card)}
                              </div>
                            </div>
                          )}
                        </article>
                      )
                    })}
                  </div>
                  {isBacklog && (
                    <div
                      className={`backlog-add-dock${backlogDockStateClass}`}
                      style={{ '--backlog-cta-raise': `${backlogCtaRaise}px` }}
                    >
                      <div className="backlog-entry">
                        <div className="add-inline">
                          <button
                            type="button"
                            className="icon-button add-button"
                            aria-label="Create new card"
                            onClick={createEmptyCardInBacklog}
                          >
                            <SymbolIcon name="add_circle" />
                          </button>
                          {showBacklogHint && <span className="hint-text">or press N</span>}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </section>
            )
          })}
        </main>

        <div className="history-row">
          <button
            type="button"
            className="icon-button"
            aria-label="Undo"
            onClick={undo}
            disabled={undoStack.length === 0}
          >
            <SymbolIcon name="undo" />
          </button>
          <button
            ref={trashButtonRef}
            type="button"
            className={`icon-button trash-button${isTrashDragOver ? ' is-drag-over' : ''}`}
            aria-label="Open trash"
            onClick={() => setIsTrashOpen(true)}
            onDragEnter={handleTrashDragEnter}
            onDragOver={handleTrashDragOver}
            onDragLeave={handleTrashDragLeave}
            onDrop={handleTrashDrop}
          >
            <SymbolIcon name="delete" />
            {trashedCards.length > 0 && (
              <span className="count-pill trash-count" aria-hidden="true">
                {trashedCards.length}
              </span>
            )}
          </button>
          <button
            type="button"
            className="icon-button"
            aria-label="Redo"
            onClick={redo}
            disabled={redoStack.length === 0}
          >
            <SymbolIcon name="redo" />
          </button>
        </div>

        <footer className="board-footer">
          <a
            href={IMPRESSUM_PATH}
            className="imprint-link"
            onClick={(event) => handleNavigate(event, IMPRESSUM_PATH)}
          >
            Impressum
          </a>
        </footer>
      </div>

      {isAboutOpen && (
        <div className="modal-backdrop" onMouseDown={closeAboutModal}>
          <section
            className="modal panel about-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="about-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <aside className="about-hero" aria-hidden="true">
              <div className="hero-board">
                <div className="hero-board-chrome">
                  <span className="hero-dot" />
                  <span className="hero-dot" />
                  <span className="hero-dot" />
                  <p className="hero-board-label">Kanbart</p>
                </div>
                <section className="hero-done-column">
                  <header className="hero-done-head">
                    <h3>Done</h3>
                    <span className="hero-done-count">3</span>
                  </header>
                  <div className="hero-done-cards">
                    <article className="hero-done-card">
                      <SymbolIcon name="check_circle" className="hero-done-icon" />
                      <span>Keep It Ad-Free</span>
                    </article>
                    <article className="hero-done-card">
                      <SymbolIcon name="check_circle" className="hero-done-icon" />
                      <span>Kick Tracking Out</span>
                    </article>
                    <article className="hero-done-card">
                      <SymbolIcon name="check_circle" className="hero-done-icon" />
                      <span>Keep Cloud Out</span>
                    </article>
                  </div>
                </section>
              </div>
              <p className="about-hero-caption">Small board. Clear finish.</p>
            </aside>

            <div className="about-content">
              <header className="modal-head about-head">
                <h2 id="about-title">About</h2>
                <button
                  type="button"
                  className="icon-button tiny modal-close"
                  aria-label="Close about"
                  onClick={closeAboutModal}
                >
                  <SymbolIcon name="close" />
                </button>
              </header>

              <p className="about-lead">
                Kanbart focuses on quick task flow without ads, tracking, or unnecessary
                friction.
              </p>

              <div className="about-facts">
                {ABOUT_FACTS.map((fact) => (
                  <article className="about-fact" key={fact.title}>
                    <h3>{fact.title}</h3>
                    <p>{fact.detail}</p>
                  </article>
                ))}
              </div>

              <section className="about-support">
                <p className="modal-label">Support development</p>
                <p className="help-copy">
                  If you want to support development and server costs, you can leave a
                  small donation.
                </p>
                <a
                  href={DONATION_URL}
                  className="support-cta"
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  Buy me a coffee
                </a>
              </section>
            </div>
          </section>
        </div>
      )}

      {isHelpOpen && (
        <div className="modal-backdrop" onMouseDown={closeHelpModal}>
          <section
            className="modal panel help-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="help-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="modal-head">
              <h2 id="help-title">Help</h2>
              <button
                type="button"
                className="icon-button tiny modal-close"
                aria-label="Close help"
                onClick={closeHelpModal}
              >
                <SymbolIcon name="close" />
              </button>
            </header>

            <p className="help-description">
              Kanbart is a minimal board for quickly organizing tasks into Backlog, Doing, and
              Done. Add cards, set priority, and move or reorder tasks as your work progresses.
              You can use drag and drop or the keybindings below for faster flow.
            </p>

            <section className="help-section">
              <p className="modal-label">Keybindings</p>
              <div className="shortcut-grid">
                {HELP_SHORTCUTS.map((shortcut) => (
                  <div className="shortcut-row" key={shortcut.description}>
                    <div className="shortcut-keys">
                      {shortcut.keys.map((key, index) => (
                        <span className="shortcut-key-fragment" key={`${shortcut.description}-${key}`}>
                          <kbd>{key}</kbd>
                          {index < shortcut.keys.length - 1 && (
                            <span className="shortcut-joiner">
                              {shortcut.joiner ?? '+'}
                            </span>
                          )}
                        </span>
                      ))}
                    </div>
                    <span className="shortcut-desc">{shortcut.description}</span>
                  </div>
                ))}
              </div>
            </section>
          </section>
        </div>
      )}

      {isSettingsOpen && (
        <div className="modal-backdrop" onMouseDown={closeSettingsModal}>
          <section
            className="modal panel settings-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="modal-head">
              <h2 id="settings-title">Settings</h2>
              <button
                type="button"
                className="icon-button tiny modal-close"
                aria-label="Close settings"
                onClick={closeSettingsModal}
              >
                <SymbolIcon name="close" />
              </button>
            </header>

            <div className="modal-section">
              <p className="modal-label">Theme</p>
              <div className="theme-switch">
                <button
                  type="button"
                  className={theme === 'dark' ? 'active' : ''}
                  onClick={() => setTheme('dark')}
                >
                  Dark
                </button>
                <button
                  type="button"
                  className={theme === 'light' ? 'active' : ''}
                  onClick={() => setTheme('light')}
                >
                  Light
                </button>
              </div>
            </div>

            <div className="modal-section">
              <p className="modal-label">Board</p>
              <div className="settings-actions">
                <button
                  type="button"
                  className="icon-button settings-action"
                  aria-label="Export board JSON"
                  onClick={exportJson}
                  disabled={cards.length === 0}
                >
                  <IconDownload />
                </button>
                <button
                  type="button"
                  className="icon-button settings-action"
                  aria-label="Import board JSON"
                  onClick={() => importInputRef.current?.click()}
                >
                  <IconUpload />
                </button>
              </div>
              <p className="modal-note">{cards.length} cards</p>
              <input
                ref={importInputRef}
                type="file"
                accept="application/json"
                className="visually-hidden"
                onChange={importJson}
              />
            </div>
          </section>
        </div>
      )}

      {isTrashOpen && (
        <div className="modal-backdrop" onMouseDown={closeTrashModal}>
          <section
            className="modal panel trash-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="trash-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="modal-head">
              <h2 id="trash-title">Trash</h2>
              <button
                type="button"
                className="icon-button tiny modal-close"
                aria-label="Close trash"
                onClick={closeTrashModal}
              >
                <SymbolIcon name="close" />
              </button>
            </header>

            <section className="trash-list-wrap">
              {trashedCards.length === 0 ? (
                <p className="trash-empty">Trash is empty.</p>
              ) : (
                <div className="trash-list">
                  {trashedCards.map((item) => (
                    <article key={item.trashId} className="trash-item">
                      <div className="trash-item-main">
                        <p className="trash-item-title">{item.title || 'Untitled'}</p>
                        <p className="trash-item-meta">
                          {item.priority} priority · {item.column}
                        </p>
                        {item.text && <p className="trash-item-text">{item.text}</p>}
                      </div>
                      <div className="trash-item-actions">
                        <button
                          type="button"
                          className="trash-action"
                          onClick={() => restoreCardFromTrash(item.trashId)}
                        >
                          Restore
                        </button>
                        <button
                          type="button"
                          className="trash-action danger"
                          onClick={() => deleteTrashCardPermanently(item.trashId)}
                        >
                          Delete permanently
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <div className="trash-footer">
              <button
                type="button"
                className="trash-empty-button"
                onClick={emptyTrashPermanently}
                disabled={trashedCards.length === 0}
              >
                Empty trash permanently
              </button>
            </div>
          </section>
        </div>
      )}

      {trashUndoItem && (
        <div className="trash-toast" role="status" aria-live="polite">
          <span>Card permanently deleted.</span>
          <button
            type="button"
            className="trash-toast-undo"
            onClick={undoPermanentTrashDelete}
          >
            Undo
          </button>
        </div>
      )}
    </div>
  )
}

export default App
