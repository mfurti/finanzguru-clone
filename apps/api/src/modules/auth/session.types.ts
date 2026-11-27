import '@fastify/secure-session'

declare module '@fastify/secure-session' {
  interface SessionData {
    owner: boolean
    /** Row id in the `session` table (014). */
    sid: string
  }
}
