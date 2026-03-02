# Up Hellas Merchants Map

Interactive map that visualises all partner merchants from the Up Hellas merchants API on top of a Mapbox-powered map, styled to match the look & feel of [uphellas.gr](https://uphellas.gr/).

## Tech stack

- Next.js (App Router, TypeScript)
- Tailwind CSS
- Simple shadcn-style UI primitives (`button`, `card`)
- Mapbox GL via `react-map-gl`

## Getting started

1. Install dependencies:

```bash
npm install
```

2. Create an `.env.local` file in the project root and add your Mapbox access token:

```bash
NEXT_PUBLIC_MAPBOX_TOKEN=your_mapbox_public_token_here
```

3. Run the dev server:

```bash
npm run dev
```

Then open `http://localhost:3000` in your browser.

## Merchants API

The app uses the public merchants GeoJSON endpoint documented at  
`https://merchants-map.uphellas.gr/docs#/GeoJSON%20Merchants/search_geojson_geojson_search_post`

There is a Next.js API route at `/api/merchants-geojson` which proxies requests to:

```text
POST https://merchants-map.uphellas.gr/geojson/search
```

with a bounding box that roughly covers Greece. You can adjust this bounding box in `src/app/api/merchants-geojson/route.ts` if needed.

## Notes

- If you see a placeholder instead of the map, make sure `NEXT_PUBLIC_MAPBOX_TOKEN` is configured.
- Styling and layout aim to be close to the branding on [uphellas.gr](https://uphellas.gr/), but you can freely tweak colours, spacing and typography in `tailwind.config.ts` and the layout components.

