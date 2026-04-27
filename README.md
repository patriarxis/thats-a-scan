## Up Hellas Store Locator

Dark, premium store locator experience for Up Hellas, showing partner merchants on a clustered Mapbox GL map with a searchable, localized list.

### What this app does

- **Viewport-based store loading**: Merchants are fetched through the existing `/api/merchants-geojson` proxy only for the current map bounding box (no backend changes).
- **Modern map experience**: Dark Mapbox / CARTO basemap locked to Greece, with **purple pins and clusters**, smooth zoom, and drill‑in clustering.
- **Search-first UX**: Centered autocomplete search bar that works with:
  - **Merchant data** already loaded on the client, and
  - **Mapbox geocoding** for free‑text places.
- **Map + list layout**:
  - Desktop: map on the left, virtualized store list and detail panel on the right.
  - Mobile: fullscreen map with a Map/List toggle and bottom sheet details.
- **Localization**: Full Greek/English UI via `LocaleProvider` plus locale‑aware merchant name/address helpers.

### Tech stack

- **Next.js** (App Router, TypeScript)
- **Tailwind CSS** with custom Up‑style dark theme (black/dark‑grey background, purple accents)
- **Mapbox GL JS** directly (no `react-map-gl`)
- **react-window** for list virtualization

### Running locally

1. Install dependencies:

```bash
npm install
```

2. Add your Mapbox token in `.env.local`:

```bash
NEXT_PUBLIC_MAPBOX_TOKEN=your_mapbox_public_token_here
```

For the scheduled heatmap precompute flow in production, also configure:

```bash
BLOB_READ_WRITE_TOKEN=your_vercel_blob_read_write_token
CRON_SECRET=your_private_cron_secret
```

3. Start the dev server:

```bash
npm run dev
```

Open `http://localhost:3000` in the browser.

### Merchants API

The frontend talks only to a Next.js proxy:

- **Route**: `/api/merchants-geojson`
- **Upstream**:

```text
POST https://merchants-map.uphellas.gr/geojson/search
```

The request body contains a bounding box (`north_west` / `south_east`), so the backend only returns stores inside the current viewport.

### Heatmap precompute

The public `/api/heatmap` route serves a precomputed GeoJSON heatmap from Vercel Blob when available. Vercel Cron calls `/api/cron/heatmap` monthly, protected by `CRON_SECRET`, to regenerate the aggregated heatmap and upload `heatmap.geojson` to Blob. If Blob is not configured or empty, `/api/heatmap` can still generate the heatmap on demand as a fallback.

### Customization

- **Colours / theme**: Edit `tailwind.config.ts` (see `background`, `foreground`, `primary`, `secondary`) and high‑level layout styles in `LocatorExperience.tsx`.
- **Map behaviour**: Edit `MapView.tsx` and the hooks in `src/components/map/hooks.ts` (zoom limits, clustering, viewport query rules).

