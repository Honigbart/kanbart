import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ImprintPage from './ImprintPage'
import './App.css'

const STORAGE_KEY = 'kanbart.board.v1'
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

const HELP_SHORTCUTS = [
  { keys: ['N'], description: 'Create a new card in Backlog' },
  { keys: ['Enter'], description: 'Title: jump to description / Text: save edit' },
  { keys: ['Shift', 'Enter'], description: 'Add new line in card text' },
  { keys: ['1', '2', '3'], joiner: '/', description: 'Set priority: low / mid / high' },
  { keys: ['←', '→'], description: 'Move card between columns' },
  { keys: ['↑', '↓'], description: 'Reorder card in current column' },
  { keys: ['E'], description: 'Edit selected card (card focused)' },
  { keys: ['Delete'], description: 'Delete selected card' },
  { keys: ['Esc'], description: 'Close open dialogs' },
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

function normalizeCard(card) {
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

  return {
    id: Number(card.id),
    title: String(card.title ?? '').trim(),
    text: String(fallbackText),
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
  const [theme, setTheme] = useState(() => loadTheme())
  const [searchQuery, setSearchQuery] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [editingText, setEditingText] = useState('')
  const [editingFocus, setEditingFocus] = useState('title')
  const [draggingId, setDraggingId] = useState(null)

  const [undoStack, setUndoStack] = useState([])
  const [redoStack, setRedoStack] = useState([])

  const [isHelpOpen, setIsHelpOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isAboutOpen, setIsAboutOpen] = useState(false)

  const nextIdRef = useRef(
    cards.reduce((max, card) => Math.max(max, card.id), 0) + 1,
  )
  const importInputRef = useRef(null)
  const settingsButtonRef = useRef(null)
  const helpButtonRef = useRef(null)
  const aboutButtonRef = useRef(null)

  const isImprintRoute = pathname === IMPRESSUM_PATH

  const applyWithHistory = useCallback((updater) => {
    setCards((previous) => {
      const next = typeof updater === 'function' ? updater(previous) : updater
      if (next === previous) {
        return previous
      }

      setUndoStack((stack) => pushBounded(stack, previous))
      setRedoStack([])
      return next
    })
  }, [])

  const createEmptyCardInBacklog = useCallback(() => {
    const id = nextIdRef.current++
    applyWithHistory((previous) => [
      ...previous,
      {
        id,
        title: '',
        text: '',
        priority: 'mid',
        column: 'backlog',
        order: nextOrder(previous, 'backlog'),
      },
    ])

    setEditingId(id)
    setEditingTitle('')
    setEditingText('')
    setEditingFocus('title')

    return id
  }, [applyWithHistory])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cards))
  }, [cards])

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

      if (isHelpOpen || isSettingsOpen || isAboutOpen) {
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
  }, [isHelpOpen, isSettingsOpen, isAboutOpen, createEmptyCardInBacklog])

  const cardsByColumn = useMemo(() => {
    const grouped = {}
    for (const column of COLUMNS) {
      grouped[column.id] = sortByOrder(
        cards.filter((card) => card.column === column.id),
      )
    }
    return grouped
  }, [cards])

  const backlogCount = cardsByColumn.backlog.length

  function focusCardById(id) {
    window.requestAnimationFrame(() => {
      const target = document.querySelector(`[data-card-id="${id}"]`)
      if (target instanceof HTMLElement) {
        target.focus()
      }
    })
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

  function deleteCard(id) {
    applyWithHistory((previous) => {
      const next = previous.filter((card) => card.id !== id)
      return next.length === previous.length ? previous : next
    })

    if (editingId === id) {
      setEditingId(null)
      setEditingTitle('')
      setEditingText('')
      setEditingFocus('title')
    }
  }

  function startEdit(card, focusArea = 'title') {
    setEditingId(card.id)
    setEditingTitle(card.title)
    setEditingText(card.text ?? '')
    setEditingFocus(focusArea)
  }

  function saveEdit(id, options = {}) {
    const { focusCard = false } = options
    const title = editingTitle.trim()
    const text = editingText.trim()
    if (!title) {
      const existingCard = cards.find((card) => card.id === id)
      if (existingCard && existingCard.title.trim().length === 0) {
        deleteCard(id)
        return
      }
      setEditingId(null)
      setEditingTitle('')
      setEditingText('')
      setEditingFocus('title')
      if (focusCard) {
        focusCardById(id)
      }
      return
    }

    applyWithHistory((previous) => {
      let changed = false
      const next = previous.map((card) => {
        if (card.id !== id) {
          return card
        }
        if (card.title === title && (card.text ?? '') === text) {
          return card
        }
        changed = true
        return { ...card, title, text }
      })
      return changed ? next : previous
    })

    setEditingId(null)
    setEditingTitle('')
    setEditingText('')
    setEditingFocus('title')
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
    saveEdit(cardId, { focusCard: true })
  }

  function setCardPriority(id, priority) {
    applyWithHistory((previous) => {
      let changed = false
      const next = previous.map((card) => {
        if (card.id !== id || card.priority === priority) {
          return card
        }
        changed = true
        return { ...card, priority }
      })
      return changed ? next : previous
    })
  }

  function moveToColumn(id, targetColumn) {
    applyWithHistory((previous) => {
      const current = previous.find((card) => card.id === id)
      if (!current || current.column === targetColumn) {
        return previous
      }

      const toOrder = nextOrder(previous, targetColumn)
      return previous.map((card) =>
        card.id === id
          ? { ...card, column: targetColumn, order: toOrder }
          : card,
      )
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
      const current = previous.find((card) => card.id === id)
      if (!current) {
        return previous
      }

      const orderedColumnCards = sortByOrder(
        previous.filter((card) => card.column === current.column),
      )
      const currentIndex = orderedColumnCards.findIndex((card) => card.id === id)
      const nextIndex = currentIndex + offset
      if (nextIndex < 0 || nextIndex >= orderedColumnCards.length) {
        return previous
      }

      const swapWith = orderedColumnCards[nextIndex]
      return previous.map((card) => {
        if (card.id === id) {
          return { ...card, order: swapWith.order }
        }
        if (card.id === swapWith.id) {
          return { ...card, order: current.order }
        }
        return card
      })
    })
  }

  function handleDropOnColumn(columnId) {
    if (draggingId == null) {
      return
    }
    moveToColumn(draggingId, columnId)
    setDraggingId(null)
  }

  function handleCardKeyDown(event, card) {
    if (event.isComposing || isTypingElement(event.target)) {
      return
    }

    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      shiftColumn(card.id, -1)
      return
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault()
      shiftColumn(card.id, 1)
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      reorderInColumn(card.id, -1)
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      reorderInColumn(card.id, 1)
      return
    }

    if (event.key.toLowerCase() === 'e') {
      event.preventDefault()
      startEdit(card)
      return
    }

    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault()
      deleteCard(card.id)
      return
    }

    const maybePriority = PRIORITY_BY_KEY[event.key]
    if (maybePriority) {
      event.preventDefault()
      setCardPriority(card.id, maybePriority)
    }
  }

  function undo() {
    setUndoStack((history) => {
      if (history.length === 0) {
        return history
      }

      const previous = history[history.length - 1]
      setCards((current) => {
        setRedoStack((redo) => pushBounded(redo, current))
        return previous
      })
      setEditingId(null)
      setEditingTitle('')
      setEditingText('')
      setEditingFocus('title')
      return history.slice(0, -1)
    })
  }

  function redo() {
    setRedoStack((history) => {
      if (history.length === 0) {
        return history
      }

      const next = history[history.length - 1]
      setCards((current) => {
        setUndoStack((undoHistory) => pushBounded(undoHistory, current))
        return next
      })
      setEditingId(null)
      setEditingTitle('')
      setEditingText('')
      setEditingFocus('title')
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

      applyWithHistory(() => normalized)
      const maxId = normalized.reduce((max, card) => Math.max(max, card.id), 0)
      nextIdRef.current = maxId + 1
    } catch {
      window.alert('Import failed. Use a Kanbart JSON export file.')
    } finally {
      event.target.value = ''
    }
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
            const showBacklogStarter = isBacklog && backlogCount < 3
            const centerBacklogStarter = isBacklog && backlogCount < 3
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
                  {showBacklogStarter && (
                    <div
                      className={`backlog-entry${centerBacklogStarter ? ' backlog-entry-floating' : ''}`}
                    >
                      <div className="add-inline">
                        <button
                          type="button"
                          className="icon-button add-button"
                          aria-label="Create new card"
                          onClick={createEmptyCardInBacklog}
                        >
                          <SymbolIcon name="add_circle" />
                        </button>
                        <span className="hint-text">or press N</span>
                      </div>
                    </div>
                  )}
                  <div className="cards-stack">
                    {orderedCards.map((card) => {
                      const isEditingCard = editingId === card.id
                      const isEditingExpanded =
                        isEditingCard && isLongCardText(editingText)

                      return (
                        <article
                          key={card.id}
                          data-card-id={card.id}
                          className={`task-card priority-${card.priority}${draggingId === card.id ? ' is-dragging' : ''}${isEditingCard ? ' is-editing' : ''}${isEditingExpanded ? ' is-editing-expanded' : ''}`}
                          draggable
                          tabIndex={0}
                          onDragStart={(event) => {
                            event.dataTransfer.effectAllowed = 'move'
                            event.dataTransfer.setData('text/plain', String(card.id))
                            setDraggingId(card.id)
                          }}
                          onDragEnd={() => setDraggingId(null)}
                          onKeyDown={(event) => handleCardKeyDown(event, card)}
                        >
                          {isEditingCard ? (
                            <form
                              className="card-layout card-edit-form"
                              onSubmit={(event) => {
                                event.preventDefault()
                                saveEdit(card.id, { focusCard: true })
                              }}
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
                            </form>
                          ) : (
                            <div className="card-layout">
                              <div className="card-top-row">
                                <p className="card-title" onClick={() => startEdit(card, 'title')}>
                                  {card.title}
                                </p>
                                {renderPriorityDots(card)}
                              </div>
                              <div className="card-content-area" onClick={() => startEdit(card, 'text')}>
                                {card.text ? (
                                  <p className="card-text">{card.text}</p>
                                ) : (
                                  <p className="card-text ghost">Description</p>
                                )}
                              </div>
                            </div>
                          )}
                        </article>
                      )
                    })}
                  </div>
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
    </div>
  )
}

export default App
