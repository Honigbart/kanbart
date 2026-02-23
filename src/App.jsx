import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

const STORAGE_KEY = 'kanbart.board.v1'
const THEME_KEY = 'kanbart.theme.v1'
const HISTORY_LIMIT = 50

const COLUMNS = [
  { id: 'backlog', label: 'Backlog' },
  { id: 'doing', label: 'Doing' },
  { id: 'done', label: 'Done' },
]

const PRIORITIES = [
  { id: 'high', label: 'High' },
  { id: 'normal', label: 'Normal' },
  { id: 'low', label: 'Low' },
]

const PRIORITY_BY_KEY = {
  1: 'high',
  2: 'normal',
  3: 'low',
}

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
  const fallbackPriority = PRIORITIES.some((item) => item.id === card.priority)
    ? card.priority
    : 'normal'
  const fallbackColumn = COLUMNS.some((item) => item.id === card.column)
    ? card.column
    : 'backlog'

  return {
    id: Number(card.id),
    title: String(card.title ?? '').trim(),
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

function IconCheck() {
  return (
    <Icon>
      <path d="M5 13l4 4 10-10" />
    </Icon>
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
  const [cards, setCards] = useState(() => loadCards())
  const [theme, setTheme] = useState(() => loadTheme())
  const [searchQuery, setSearchQuery] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [draggingId, setDraggingId] = useState(null)

  const [undoStack, setUndoStack] = useState([])
  const [redoStack, setRedoStack] = useState([])

  const [isComposerOpen, setIsComposerOpen] = useState(false)
  const [composerTitle, setComposerTitle] = useState('')

  const [isHelpOpen, setIsHelpOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  const nextIdRef = useRef(
    cards.reduce((max, card) => Math.max(max, card.id), 0) + 1,
  )
  const composerInputRef = useRef(null)
  const importInputRef = useRef(null)
  const settingsButtonRef = useRef(null)
  const helpButtonRef = useRef(null)

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
    if (isComposerOpen) {
      composerInputRef.current?.focus()
    }
  }, [isComposerOpen])

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

        if (isComposerOpen) {
          event.preventDefault()
          setIsComposerOpen(false)
          setComposerTitle('')
          return
        }
      }

      if (event.key.toLowerCase() !== 'n') {
        return
      }

      if (isHelpOpen || isSettingsOpen) {
        return
      }

      if (isTypingElement(event.target)) {
        return
      }

      event.preventDefault()
      setIsComposerOpen(true)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isComposerOpen, isHelpOpen, isSettingsOpen])

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

  function applyWithHistory(updater) {
    setCards((previous) => {
      const next = typeof updater === 'function' ? updater(previous) : updater
      if (next === previous) {
        return previous
      }

      setUndoStack((stack) => pushBounded(stack, previous))
      setRedoStack([])
      return next
    })
  }

  function createCardInBacklog(rawTitle) {
    const title = rawTitle.trim()
    if (!title) {
      return false
    }

    applyWithHistory((previous) => [
      ...previous,
      {
        id: nextIdRef.current++,
        title,
        priority: 'normal',
        column: 'backlog',
        order: nextOrder(previous, 'backlog'),
      },
    ])

    return true
  }

  function deleteCard(id) {
    applyWithHistory((previous) => {
      const next = previous.filter((card) => card.id !== id)
      return next.length === previous.length ? previous : next
    })

    if (editingId === id) {
      setEditingId(null)
      setEditingTitle('')
    }
  }

  function startEdit(card) {
    setEditingId(card.id)
    setEditingTitle(card.title)
  }

  function saveEdit(id) {
    const title = editingTitle.trim()
    if (!title) {
      setEditingId(null)
      setEditingTitle('')
      return
    }

    applyWithHistory((previous) => {
      let changed = false
      const next = previous.map((card) => {
        if (card.id !== id || card.title === title) {
          return card
        }
        changed = true
        return { ...card, title }
      })
      return changed ? next : previous
    })

    setEditingId(null)
    setEditingTitle('')
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
      setIsComposerOpen(false)
      setComposerTitle('')
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
      setIsComposerOpen(false)
      setComposerTitle('')
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

  function openComposer() {
    setIsComposerOpen(true)
  }

  function closeComposer() {
    setIsComposerOpen(false)
    setComposerTitle('')
  }

  function submitComposer(event) {
    event.preventDefault()
    if (createCardInBacklog(composerTitle)) {
      closeComposer()
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
          </div>
        </header>

        <main className="board-grid">
          {COLUMNS.map((column, columnIndex) => {
            const orderedCards = cardsByColumn[column.id]
            const isBacklog = column.id === 'backlog'
            const showBacklogStarter = isBacklog && (isComposerOpen || backlogCount < 3)
            const centerBacklogStarter =
              isBacklog && backlogCount < 3 && !isComposerOpen
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
                      {isComposerOpen ? (
                        <form className="composer" onSubmit={submitComposer}>
                          <input
                            ref={composerInputRef}
                            value={composerTitle}
                            onChange={(event) => setComposerTitle(event.target.value)}
                            placeholder="New card"
                            aria-label="New card title"
                          />
                          <button
                            type="submit"
                            className="icon-button tiny"
                            aria-label="Create card"
                          >
                            <IconCheck />
                          </button>
                          <button
                            type="button"
                            className="icon-button tiny"
                            aria-label="Cancel new card"
                            onClick={closeComposer}
                          >
                            <IconClose />
                          </button>
                        </form>
                      ) : (
                        <div className="add-inline">
                          <button
                            type="button"
                            className="icon-button add-button"
                            aria-label="Create new card"
                            onClick={openComposer}
                          >
                            <SymbolIcon name="add_circle" />
                          </button>
                          <span className="hint-text">or press N</span>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="cards-stack">
                    {orderedCards.map((card, cardIndex) => (
                      <article
                        key={card.id}
                        className={`task-card priority-${card.priority}${draggingId === card.id ? ' is-dragging' : ''}`}
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
                        <div className="card-top-row">
                          <span className={`priority-pill priority-${card.priority}`}>
                            {card.priority}
                          </span>
                          <select
                            value={card.priority}
                            className="priority-select"
                            aria-label={`Set priority for ${card.title}`}
                            onChange={(event) =>
                              setCardPriority(card.id, event.target.value)
                            }
                          >
                            {PRIORITIES.map((priority) => (
                              <option key={priority.id} value={priority.id}>
                                {priority.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        {editingId === card.id ? (
                          <form
                            onSubmit={(event) => {
                              event.preventDefault()
                              saveEdit(card.id)
                            }}
                          >
                            <input
                              value={editingTitle}
                              onChange={(event) => setEditingTitle(event.target.value)}
                              onBlur={() => saveEdit(card.id)}
                              autoFocus
                            />
                          </form>
                        ) : (
                          <p className="card-title">{card.title}</p>
                        )}

                        <div className="card-actions">
                          <button
                            type="button"
                            onClick={() => shiftColumn(card.id, -1)}
                            disabled={columnIndex === 0}
                            aria-label={`Move ${card.title} to previous column`}
                          >
                            {'<'}
                          </button>
                          <button
                            type="button"
                            onClick={() => shiftColumn(card.id, 1)}
                            disabled={columnIndex === COLUMNS.length - 1}
                            aria-label={`Move ${card.title} to next column`}
                          >
                            {'>'}
                          </button>
                          <button
                            type="button"
                            onClick={() => reorderInColumn(card.id, -1)}
                            disabled={cardIndex === 0}
                            aria-label={`Move ${card.title} up`}
                          >
                            ^
                          </button>
                          <button
                            type="button"
                            onClick={() => reorderInColumn(card.id, 1)}
                            disabled={cardIndex === orderedCards.length - 1}
                            aria-label={`Move ${card.title} down`}
                          >
                            v
                          </button>
                          <button type="button" onClick={() => startEdit(card)} aria-label={`Edit ${card.title}`}>
                            E
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteCard(card.id)}
                            aria-label={`Delete ${card.title}`}
                          >
                            X
                          </button>
                        </div>
                      </article>
                    ))}
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
      </div>

      {isHelpOpen && (
        <div className="modal-backdrop" onMouseDown={closeHelpModal}>
          <section
            className="modal panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="help-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="modal-head">
              <h2 id="help-title">Help</h2>
              <button
                type="button"
                className="icon-button tiny"
                aria-label="Close help"
                onClick={closeHelpModal}
              >
                <SymbolIcon name="close" />
              </button>
            </header>
            <ul className="shortcut-list">
              <li>
                <kbd>N</kbd>
                <span>new card</span>
              </li>
              <li>
                <kbd>1/2/3</kbd>
                <span>priority</span>
              </li>
              <li>
                <kbd>Arrows</kbd>
                <span>move/reorder</span>
              </li>
              <li>
                <kbd>E</kbd>
                <span>edit</span>
              </li>
              <li>
                <kbd>Delete</kbd>
                <span>remove</span>
              </li>
            </ul>
          </section>
        </div>
      )}

      {isSettingsOpen && (
        <div className="modal-backdrop" onMouseDown={closeSettingsModal}>
          <section
            className="modal panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="modal-head">
              <h2 id="settings-title">Settings</h2>
              <button
                type="button"
                className="icon-button tiny"
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
