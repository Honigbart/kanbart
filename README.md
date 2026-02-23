# Kanbart

A minimal Kanban board that lives in your browser.\
Offline. No accounts. No tracking.

**https://kanbart.app**

------------------------------------------------------------------------

## Why?

Most boards are heavy.

Accounts. Sync. Metrics. Notifications.\
Kanbart is the opposite.

It does one thing well:\
Organize tasks visually. That's it.

------------------------------------------------------------------------

## Principles

-   As little design as possible\
-   Keyboard-first workflow\
-   No data collection\
-   No ads\
-   No analytics\
-   No server database\
-   Your data stays in your browser

Inspired by Dieter Rams' principles of good design.

------------------------------------------------------------------------

## Features

-   Backlog, Doing, Done
-   Priority: High / Normal / Low
-   Drag & drop
-   Reorder within columns
-   Offline-first (PWA)
-   Local persistence (IndexedDB + snapshot)
-   JSON export / import
-   Undo actions
-   Zero setup

------------------------------------------------------------------------

## Keyboard Shortcuts

  Key           Action
  ------------- ------------------------------------
  `N`           New card (Backlog)
  `Enter`       Save card
  `1 / 2 / 3`   Set priority (High / Normal / Low)
  `← / →`       Move card between columns
  `↑ / ↓`       Reorder within column
  `E`           Edit
  `Delete`      Delete (Undo available)

------------------------------------------------------------------------

## Privacy

Kanbart does not:

-   Track users\
-   Use analytics\
-   Send data to a server\
-   Store cookies for marketing\
-   Collect usage metrics

All data is stored locally in your browser.

If you clear your browser storage, your board is gone.\
Use Export to create backups.

------------------------------------------------------------------------

## Technology

-   React
-   Vite
-   IndexedDB (local persistence)
-   Service Worker (offline support)
-   No external APIs
-   No third-party trackers
-   No CDN dependencies

Everything runs client-side.

------------------------------------------------------------------------

## Backup & Restore

You can export your board as a JSON file.\
Import restores everything instantly.

No cloud sync. No account. No lock-in.

------------------------------------------------------------------------

## Roadmap

Kanbart is intentionally small.

Possible future additions:

-   Command palette
-   Search
-   Optional encryption (passphrase-based)
-   Custom columns (carefully considered)

No dashboards. No gamification. No artificial productivity metrics.

------------------------------------------------------------------------

## Contributing

Pull requests are welcome.

Keep it minimal.\
Keep it honest.\
Remove before adding.

------------------------------------------------------------------------

## Support

If you find Kanbart useful:

☕ https://buymeacoffee.com/kanbart

No subscriptions. No premium tier.

------------------------------------------------------------------------

## License

MIT License
