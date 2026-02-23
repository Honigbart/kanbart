# Kanbart

A minimal Kanban board that lives in your browser.  
Offline. No accounts. No tracking.

**https://kanbart.app**

---

## Why?

Most boards are heavy.

Accounts. Sync. Metrics. Notifications.  
Kanbart is the opposite.

It does one thing well:  
Organize tasks visually. That’s it.

---

## Principles

- As little design as possible  
- Keyboard-first workflow  
- No data collection  
- No ads  
- No analytics  
- No server database  
- Your data stays on your device  

Inspired by Dieter Rams’ principles of good design.

---

## Features

- Backlog, Doing, Done
- Priority: High / Normal / Low
- Drag & drop
- Reorder within columns
- Offline-first (PWA)
- Local persistence (IndexedDB)
- Snapshot fallback
- JSON export / import
- Undo actions
- Zero setup

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `N` | New card (Backlog) |
| `Enter` | Save card |
| `1 / 2 / 3` | Set priority (High / Normal / Low) |
| `← / →` | Move card between columns |
| `↑ / ↓` | Reorder within column |
| `E` | Edit |
| `Delete` | Delete (Undo available) |

---

# Storage & Data Philosophy

Kanbart is intentionally offline-first and cloud-free.

Your board data is:

- Stored locally in your browser using IndexedDB
- Never sent to a server
- Never synced to a backend
- Never analyzed or tracked

There is no account system and no hidden sync layer.

Everything runs client-side.

---

## How Persistence Works

### Primary Storage: IndexedDB

Kanbart uses IndexedDB as its main data store.

IndexedDB is a transactional, structured database built into modern browsers.
It is:

- More robust than localStorage
- Asynchronous and non-blocking
- Designed for offline web applications
- Stored per origin (kanbart.app)

Reloading the page does NOT delete your data.

---

### Persistent Storage Protection

Modern browsers may clear site data under extreme storage pressure.

Kanbart can request persistent storage via:

    navigator.storage.persist()

If granted, the browser is far less likely to evict your data automatically.

This does NOT override manual deletion by the user.

---

### Snapshot Fallback

In addition to IndexedDB, Kanbart stores a compact snapshot of the board state.

If the database fails to load (rare), the app can recover from this snapshot.

---

## When Data Can Be Lost

Kanbart will never delete your data.

However, data can be lost if:

- You manually clear browser site data
- You use private/incognito mode
- You reset your browser profile
- An enterprise policy wipes local storage
- You switch devices (no cloud sync)

There is no hidden cloud backup.

---

## Backup & Restore

You can export your board as a JSON file.

Import restores everything instantly.

No cloud sync.  
No account.  
No lock-in.

For maximum safety:

1. Enable persistent storage (if available)
2. Export backups occasionally

Your data remains yours.

---

## PWA & Offline Behavior

Kanbart can be installed as a Progressive Web App.

Benefits:

- Runs offline
- Separate app-like experience
- Reduced risk of accidental cache clearing
- Faster startup

All application assets are cached locally via a Service Worker.

---

## Technology

- React
- Vite
- IndexedDB
- Optional persistent storage API
- Service Worker (offline support)
- No external APIs
- No third-party trackers
- No CDN dependencies

Everything runs client-side.

---

## Roadmap

Kanbart is intentionally small.

Possible future additions:

- Command palette
- Search
- Optional encryption (passphrase-based, client-side only)
- Custom columns (carefully considered)

No dashboards.  
No gamification.  
No artificial productivity metrics.

---

## Contributing

Pull requests are welcome.

Keep it minimal.  
Keep it honest.  
Remove before adding.

---

## Support

If you find Kanbart useful:

☕ https://buymeacoffee.com/kanbart

No subscriptions. No premium tier.

---

## License

MIT License
