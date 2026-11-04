const maxSourceBytes = 15 * 1024 * 1024
const maxOutputBytes = 1024 * 1024
const sourceTypes = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'])

export type SourceImageError = 'invalid-type' | 'too-large' | 'unreadable'

export class SourceImageProblem extends Error {
  constructor(readonly kind: SourceImageError) {
    super(kind)
  }
}

export async function loadSourceImage(file: File) {
  if (!sourceTypes.has(file.type)) throw new SourceImageProblem('invalid-type')
  if (file.size > maxSourceBytes) throw new SourceImageProblem('too-large')
  try {
    return await createImageBitmap(file)
  } catch {
    throw new SourceImageProblem('unreadable')
  }
}

/** Draw the centred square crop of `image`, scaled by `zoom` (≥ 1), onto `canvas`. */
export function drawSquare(canvas: HTMLCanvasElement, image: ImageBitmap, zoom: number, size = canvas.width) {
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')!
  const side = Math.min(image.width, image.height) / Math.max(1, zoom)
  const sx = (image.width - side) / 2
  const sy = (image.height - side) / 2
  context.imageSmoothingQuality = 'high'
  context.clearRect(0, 0, size, size)
  context.drawImage(image, sx, sy, side, side, 0, 0, size, size)
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality?: number) {
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not encode image.'))), type, quality),
  )
}

/**
 * Produce a 512×512 avatar under 1 MB. PNG keeps transparency when it fits;
 * otherwise JPEG quality is stepped down until it does.
 */
export async function renderAvatarFile(image: ImageBitmap, zoom: number, preferPng: boolean) {
  const canvas = document.createElement('canvas')
  drawSquare(canvas, image, zoom, 512)

  if (preferPng) {
    const png = await toBlob(canvas, 'image/png')
    if (png.size <= maxOutputBytes) return new File([png], 'avatar.png', { type: 'image/png' })
  }

  // JPEG has no alpha; paint a white background under transparent pixels.
  const flat = document.createElement('canvas')
  flat.width = flat.height = 512
  const context = flat.getContext('2d')!
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, 512, 512)
  context.drawImage(canvas, 0, 0)

  for (const quality of [0.92, 0.85, 0.75, 0.6]) {
    const jpeg = await toBlob(flat, 'image/jpeg', quality)
    if (jpeg.size <= maxOutputBytes) return new File([jpeg], 'avatar.jpg', { type: 'image/jpeg' })
  }
  throw new Error('Could not compress the image below 1 MB.')
}
