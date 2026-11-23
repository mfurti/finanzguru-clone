/** Serializes a single-file multipart body for Fastify inject(). */
export async function multipartBody(
  file: Buffer,
  fileName: string,
): Promise<{ payload: Buffer; headers: Record<string, string> }> {
  const form = new FormData()
  form.append('file', new Blob([new Uint8Array(file)]), fileName)
  const response = new Response(form)
  return {
    payload: Buffer.from(await response.arrayBuffer()),
    headers: { 'content-type': response.headers.get('content-type')! },
  }
}
