# Factory Dashboard refresh and last-updated stamp

ARGUS #257: the dashboard's four feeds cache for 20-30 seconds but never
refreshed themselves. A factory screen left open could show hours-old KPIs,
alerts, low-stock rows and production history, with no Refresh button and no
indication of how old the data was.

## Behaviour

- **Automatic refresh** every 60 seconds (`FACTORY_REFRESH_INTERVAL_MS`),
  aligned with the 20-30s query caches. A 15-second tick only checks whether a
  refresh is due and ages the timestamp.
- **Manual Refresh** in the page header. It uses the same guarded refresh path,
  so a click during an automatic refresh is ignored instead of stacking a
  second round of requests.
- **Last updated** is shown next to the button (`just now`, `N min ago`,
  `N h ago`, `N d ago`; full local time on hover). It reflects the newest of
  the stats/low-stock loads and the last completed refresh.
- **No overlap**: one in-flight flag guards both the button and the timer.
- **Page stays usable**: React Query refetches keep the current data visible;
  only the Refresh button is disabled and spins during a refresh. Panels do not
  unmount or show skeletons.
- **Hidden tabs are skipped** (`document.visibilityState`). The next visible
  tick refreshes once the interval has elapsed.

One refresh refetches every active dashboard key together:

| Query key | Surface |
| --- | --- |
| `raw-material-stats` | KPI cards |
| `raw-materials` | low-stock list |
| `raw-material-alerts` | raw-material alerts panel |
| `production-logs` | production history panel |

The key list is shared with the dashboard's query module
(`src/lib/factory/factoryQueries.ts`) and the helpers live in
`src/lib/factory/factoryRefresh.ts`.

## Verification

`src/lib/factory/__tests__/factoryRefresh.test.ts` covers the timestamp picker,
the relative-age formatter, due/skip decisions (interval, hidden tab,
in-flight, first run) and that a refresh targets exactly the four active keys.
