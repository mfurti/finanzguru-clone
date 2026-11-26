/** Size limit for uploaded and local logo files (008 FR-007, 009 FR-005). */
export const MAX_LOGO_BYTES = 256 * 1024

export type RasterType = 'png' | 'jpg' | 'webp'

export const CONTENT_TYPES: Record<RasterType, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  webp: 'image/webp',
}

/** Image type by content (magic bytes), not by name or declared type; SVG is never accepted. */
export function imageType(file: Buffer): RasterType | null {
  if (file.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'png'
  }
  if (file[0] === 0xff && file[1] === 0xd8 && file[2] === 0xff) return 'jpg'
  if (
    file.subarray(0, 4).toString('latin1') === 'RIFF' &&
    file.subarray(8, 12).toString('latin1') === 'WEBP'
  ) {
    return 'webp'
  }
  return null
}
