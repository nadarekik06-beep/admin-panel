// MapLibre 6 runs its tiles in an ES-module worker that Next 14's webpack cannot bundle
// (the minifier parses it as a classic script). Serve it as a static file instead:
// runs before `npm run dev` / `npm run build`, see components/pickup/PickupMap.tsx.
const fs = require('fs')
const path = require('path')

const src = require.resolve('maplibre-gl/dist/maplibre-gl-worker.mjs')
const dest = path.join(__dirname, '..', 'public', 'maplibre-gl-worker.mjs')

fs.copyFileSync(src, dest)
