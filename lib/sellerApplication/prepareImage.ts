/**
 * Photos picked by sellers, made ready for upload in the browser:
 *   - iPhone HEIC/HEIF → JPEG (heic2any, loaded only when needed)
 *   - longest side ≤ 1600 px, JPEG quality 0.8
 *   - always under the backend's 4 MB limit (jpg/png/webp)
 * Small JPG/PNG/WebP photos are sent untouched.
 * Copy of choosetounsi-frontend/lib/sellerApplication/prepareImage.ts: keep both in sync.
 */

export const MAX_SIDE = 1600
export const QUALITY = 0.8
/** Backend limit (max:4096 KB). */
export const MAX_BYTES = 4096 * 1024
/** Above this, a photo is re-encoded even when its size in pixels is fine. */
const REENCODE_ABOVE = 1.5 * 1024 * 1024
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp']

export interface PreparedImage {
  file: File
  /** The photo was heavy and has been made lighter. */
  reduced: boolean
  /** An iPhone HEIC photo converted to JPEG. */
  converted: boolean
}

/** The photo can't be opened (corrupt, or a format the browser can't read). */
export class UnreadableImageError extends Error {}

export function isHeic(file: File): boolean {
  return /image\/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name)
}

export async function prepareImage(file: File): Promise<PreparedImage> {
  let source: Blob = file
  let converted = false

  if (isHeic(file)) {
    try {
      const { default: heic2any } = await import('heic2any')
      const out = await heic2any({ blob: file, toType: 'image/jpeg', quality: QUALITY })
      source = Array.isArray(out) ? out[0] : out
      converted = true
    } catch {
      // Safari reads HEIC itself: let the decoder below try
    }
  }

  const img = await decode(source)
  try {
    const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height))
    const needsWork = converted || scale < 1 || source.size > REENCODE_ABOVE || !ACCEPTED.includes(source.type)
    if (!needsWork) return { file, reduced: false, converted: false }

    const w = Math.max(1, Math.round(img.width * scale))
    const h = Math.max(1, Math.round(img.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new UnreadableImageError('canvas')
    ctx.fillStyle = '#ffffff' // transparent PNG → white, not black
    ctx.fillRect(0, 0, w, h)
    ctx.drawImage(img.source, 0, 0, w, h)

    let blob = await toJpeg(canvas, QUALITY)
    if (blob.size > MAX_BYTES) blob = await toJpeg(canvas, 0.6)

    const name = (file.name.replace(/\.[^.]+$/, '') || 'photo') + '.jpg'
    return {
      file: new File([blob], name, { type: 'image/jpeg', lastModified: Date.now() }),
      reduced: file.size > REENCODE_ABOVE && blob.size < file.size,
      converted,
    }
  } finally {
    img.close()
  }
}

interface Decoded { source: CanvasImageSource; width: number; height: number; close: () => void }

async function decode(blob: Blob): Promise<Decoded> {
  if (typeof createImageBitmap === 'function') {
    try {
      // Honors the EXIF rotation of phone photos
      const bmp = await createImageBitmap(blob, { imageOrientation: 'from-image' })
      return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() }
    } catch { /* fall back to <img> */ }
  }
  const url = URL.createObjectURL(blob)
  try {
    const el = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = () => reject(new UnreadableImageError('decode'))
      i.src = url
    })
    return { source: el, width: el.naturalWidth, height: el.naturalHeight, close: () => URL.revokeObjectURL(url) }
  } catch (e) {
    URL.revokeObjectURL(url)
    throw e instanceof UnreadableImageError ? e : new UnreadableImageError('decode')
  }
}

function toJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new UnreadableImageError('encode'))), 'image/jpeg', quality))
}
