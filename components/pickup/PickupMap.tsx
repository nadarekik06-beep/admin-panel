'use client'

/**
 * Leaflet map for the pickup address: OpenFreeMap vector tiles (MapLibre
 * bridge), OSM raster tiles when WebGL is unavailable. Click places the pin,
 * the pin is draggable; read-only when no onChange is given.
 *
 * Load it with next/dynamic({ ssr: false }): Leaflet touches `window` on import.
 * Same component as the storefront (choosetounsi-frontend/components/pickup/PickupMap.tsx).
 */

import { useEffect, useRef, useState } from 'react'
import type * as Leaflet from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'maplibre-gl/dist/maplibre-gl.css'

const TUNISIA_CENTER: [number, number] = [34.0, 9.6]

export interface MapFocus {
  latitude: number
  longitude: number
  zoom: number
  /** changes each time the map must move (same point twice = recentre twice) */
  key: string
}

interface Props {
  latitude: number | null
  longitude: number | null
  onChange?: (lat: number, lng: number) => void
  focus?: MapFocus | null
  height?: number
  dark?: boolean
  labels: { loading: string; failed: string; attribution?: string }
}

const OPENFREEMAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty'
const RTL_TEXT_PLUGIN   = 'https://unpkg.com/@mapbox/mapbox-gl-rtl-text@0.3.0/dist/mapbox-gl-rtl-text.js'

function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}

const PIN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="46" viewBox="0 0 34 46" aria-hidden="true">
  <path d="M17 1C8.2 1 1 8 1 16.8 1 28.5 17 45 17 45s16-16.5 16-28.2C33 8 25.8 1 17 1z" fill="#db142e" stroke="#fff" stroke-width="2"/>
  <circle cx="17" cy="17" r="6" fill="#fff"/></svg>`

export default function PickupMap({ latitude, longitude, onChange, focus, height = 320, dark, labels }: Props) {
  const el        = useRef<HTMLDivElement>(null)
  const mapRef    = useRef<Leaflet.Map | null>(null)
  const markerRef = useRef<Leaflet.Marker | null>(null)
  const LRef      = useRef<typeof Leaflet | null>(null)
  const changeRef = useRef(onChange)
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading')

  changeRef.current = onChange
  const editable = !!onChange

  // ── Mount once ────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const L = (await import('leaflet')).default
        if (cancelled || !el.current) return
        LRef.current = L

        const start: [number, number] = latitude != null && longitude != null ? [latitude, longitude] : TUNISIA_CENTER
        const map = L.map(el.current, {
          center: start,
          zoom: latitude != null ? 16 : 6,
          zoomControl: true,
          attributionControl: true,
          scrollWheelZoom: editable ? 'center' : false,
        })
        mapRef.current = map

        let vector = false
        if (webglAvailable()) {
          try {
            const [{ maplibreGL }, maplibre] = await Promise.all([import('@maplibre/maplibre-gl-leaflet'), import('maplibre-gl')])
            if (cancelled) return
            // MapLibre 6 cannot find its worker once bundled: serve it from /public
            // (copied there by scripts/copy-maplibre-worker.js before dev / build).
            maplibre.setWorkerUrl('/maplibre-gl-worker.mjs')
            // Arabic street / place names need the RTL shaping plugin (loaded once, lazily)
            if (maplibre.getRTLTextPluginStatus() === 'unavailable') {
              maplibre.setRTLTextPlugin(RTL_TEXT_PLUGIN, true).catch(() => { /* Latin labels still render */ })
            }
            // The OpenFreeMap style carries its own attribution (OpenFreeMap, OpenMapTiles, OSM)
            maplibreGL({ style: OPENFREEMAP_STYLE }).addTo(map)
            vector = true
          } catch { /* fall back to raster below */ }
        }
        if (!vector) {
          L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
          }).addTo(map)
        }

        if (editable) {
          map.on('click', (e: Leaflet.LeafletMouseEvent) => changeRef.current?.(e.latlng.lat, e.latlng.lng))
        }
        setState('ready')
        // The container may have been laid out after the map (tabs, steps)
        setTimeout(() => map.invalidateSize(), 150)
      } catch {
        if (!cancelled) setState('failed')
      }
    })()

    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
      markerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Marker follows the value ──────────────────────────────────────────────
  useEffect(() => {
    const L = LRef.current
    const map = mapRef.current
    if (!L || !map || state !== 'ready') return
    if (latitude == null || longitude == null) {
      markerRef.current?.remove()
      markerRef.current = null
      return
    }
    const pos: [number, number] = [latitude, longitude]
    if (!markerRef.current) {
      const icon = L.divIcon({ html: PIN_SVG, className: 'ct-pickup-pin', iconSize: [34, 46], iconAnchor: [17, 45] })
      const marker = L.marker(pos, { icon, draggable: editable, keyboard: editable, autoPan: true })
      if (editable) {
        marker.on('dragend', () => {
          const p = marker.getLatLng()
          changeRef.current?.(p.lat, p.lng)
        })
      }
      marker.addTo(map)
      markerRef.current = marker
    } else {
      markerRef.current.setLatLng(pos)
    }
    if (!map.getBounds().pad(-0.1).contains(pos)) {
      map.setView(pos, Math.max(map.getZoom(), 15))
    }
  }, [latitude, longitude, state, editable])

  // ── Recentre on request (zone picked, "Ma Position") ──────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || state !== 'ready' || !focus) return
    map.flyTo([focus.latitude, focus.longitude], focus.zoom, { duration: 0.8 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.key, state])

  return (
    // Leaflet positions tiles with left/top: an RTL container breaks it, so the map stays LTR
    <div dir="ltr" style={{ position: 'relative', height, borderRadius: 12, overflow: 'hidden', border: `1px solid ${dark ? 'rgba(255,255,255,0.12)' : '#e5e7eb'}`, background: dark ? '#0D1117' : '#eef2f3' }}>
      <div ref={el} style={{ position: 'absolute', inset: 0, cursor: editable ? 'crosshair' : 'default' }} />
      {state !== 'ready' && (
        <div role="status" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, color: dark ? 'rgba(255,255,255,0.6)' : '#6b7280', pointerEvents: 'none' }}>
          {state === 'loading' ? labels.loading : labels.failed}
        </div>
      )}
      <style>{`
        .ct-pickup-pin { background: none; border: none; }
        .ct-pickup-pin svg { filter: drop-shadow(0 3px 4px rgba(0,0,0,0.35)); }
        .leaflet-container { font-family: inherit; }
        [dir="rtl"] .leaflet-control-attribution { direction: ltr; }
      `}</style>
    </div>
  )
}
