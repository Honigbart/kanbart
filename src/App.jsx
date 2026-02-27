import { useEffect, useRef, useState } from 'react'
import ImprintPage from './ImprintPage'
import './App.css'

const THEME_KEY = 'kanbart.theme.v1'
const IMPRESSUM_PATH = '/impressum'

const COLUMNS = [
  { id: 'backlog', label: 'Backlog' },
  { id: 'doing', label: 'In Progress' },
  { id: 'done', label: 'Done' },
]

const DONATION_URL = 'https://www.buymeacoffee.com/honigbartstudios'

const ABOUT_FACTS = [
  {
    title: 'Free to use',
    detail: 'All core features remain available without subscriptions or paywalls.',
  },
  {
    title: 'Ad-free',
    detail: 'No ad placements in the interface.',
  },
  {
    title: 'Tracking-free',
    detail: 'No third-party analytics or marketing trackers.',
  },
  {
    title: 'Privacy-first',
    detail: 'Theme preference is the only setting persisted in localStorage.',
  },
]

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

function normalizePathname(pathname) {
  if (!pathname || pathname === '/') {
    return '/'
  }

  const normalized = pathname.replace(/\/+$/, '')
  return normalized || '/'
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
  const [theme, setTheme] = useState(() => loadTheme())
  const [searchQuery, setSearchQuery] = useState('')
  const [isHelpOpen, setIsHelpOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isAboutOpen, setIsAboutOpen] = useState(false)

  const settingsButtonRef = useRef(null)
  const helpButtonRef = useRef(null)
  const aboutButtonRef = useRef(null)

  const isImprintRoute = pathname === IMPRESSUM_PATH

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
      if (event.key !== 'Escape') {
        return
      }

      if (isAboutOpen) {
        event.preventDefault()
        setIsAboutOpen(false)
        aboutButtonRef.current?.focus()
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
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isAboutOpen, isHelpOpen, isSettingsOpen])

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
            <label className="visually-hidden" htmlFor="workspace-search">
              Search
            </label>
            <div className="search-shell">
              <input
                id="workspace-search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search"
                aria-label="Search workspace"
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

        <main className="board-grid" aria-label="Workspace columns">
          {COLUMNS.map((column) => (
            <section key={column.id} className="column panel">
              <header className="column-header">
                <h2>{column.label}</h2>
                <span className="count-pill">0</span>
              </header>
              <div className="column-body" aria-hidden="true" />
            </section>
          ))}
        </main>

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
                  <div className="hero-done-items">
                    <article className="hero-done-item">
                      <SymbolIcon name="check_circle" className="hero-done-icon" />
                      <span>Keep It Ad-Free</span>
                    </article>
                    <article className="hero-done-item">
                      <SymbolIcon name="check_circle" className="hero-done-icon" />
                      <span>Kick Tracking Out</span>
                    </article>
                    <article className="hero-done-item">
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
                Kanbart is being rebuilt from a clean baseline to keep the workflow
                minimal, private, and fast.
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
              The board UI is currently reset. You see the three workflow columns as a
              structural baseline while the next workflow model is rebuilt from scratch.
            </p>

            <section className="help-section">
              <p className="modal-label">Current behavior</p>
              <ul className="help-list">
                <li>Search bar is visual only right now.</li>
                <li>Columns are intentionally empty.</li>
                <li>Use <kbd>Esc</kbd> to close dialogs.</li>
              </ul>
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
          </section>
        </div>
      )}
    </div>
  )
}

export default App
