import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { vi } from 'vitest'
import type { D1Database, D1PreparedStatement, ExecutionContext } from '../src/env'
import { handleRequest, type Overrides, type WorkerEnv } from '../src/index'

/** D1-compatible wrapper around Node's built-in SQLite, running the real migrations. */
export function createTestDb(): D1Database & { raw: DatabaseSync } {
  const raw = new DatabaseSync(':memory:')
  raw.exec(readFileSync(new URL('../migrations/0001_init.sql', import.meta.url), 'utf8'))

  const statement = (sql: string, values: unknown[] = []): D1PreparedStatement => ({
    bind: (...next) => statement(sql, next),
    first: async <T>() => (raw.prepare(sql).get(...(values as never[])) as T) ?? null,
    run: async () => raw.prepare(sql).run(...(values as never[])),
    all: async <T>() => ({ results: raw.prepare(sql).all(...(values as never[])) as T[] }),
  })

  return {
    raw,
    prepare: (sql) => statement(sql),
    batch: async (statements) => {
      const results: unknown[] = []
      raw.exec('BEGIN')
      try {
        for (const item of statements) results.push(await item.run())
        raw.exec('COMMIT')
      } catch (error) {
        raw.exec('ROLLBACK')
        throw error
      }
      return results
    },
  }
}

export function createCtx() {
  const pending: Promise<unknown>[] = []
  const ctx: ExecutionContext & { flush(): Promise<void> } = {
    waitUntil: (promise) => void pending.push(promise),
    flush: async () => {
      await Promise.all(pending.splice(0))
    },
  }
  return ctx
}

export function createEnv(overrides: Partial<WorkerEnv> = {}): WorkerEnv & { DB: ReturnType<typeof createTestDb> } {
  return {
    DB: createTestDb(),
    APP_URL: 'https://app.example.com',
    SNAPSHOT_HUB_URL: 'https://hub.test/graphql',
    IPFS_GATEWAYS: 'https://gw1.test/ipfs/,https://gw2.test/ipfs/',
    SESSION_SECRET: 'test-session-secret-0123456789',
    ...overrides,
  } as WorkerEnv & { DB: ReturnType<typeof createTestDb> }
}

type Route = (request: Request) => Response | Promise<Response> | undefined

/** Replace global fetch with a router; unmatched requests fail loudly. */
export function mockFetch(...routes: Route[]) {
  const calls: Request[] = []
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init)
    calls.push(request.clone())
    for (const route of routes) {
      const response = await route(request)
      if (response) return response
    }
    throw new Error(`Unexpected fetch: ${request.method} ${request.url}`)
  })
  return calls
}

/** Fake Snapshot hub that serves avatars from a map keyed by lowercase address. */
export function snapshotHub(avatars: Record<string, string>): Route {
  return async (request) => {
    if (!request.url.startsWith('https://hub.test/graphql')) return undefined
    const { variables } = (await request.json()) as { variables: { id?: string; ids?: string[] } }
    if (variables.ids) {
      const users = variables.ids
        .filter((id) => avatars[id.toLowerCase()])
        .map((id) => ({ id, avatar: avatars[id.toLowerCase()] }))
      return Response.json({ data: { users } })
    }
    const avatar = avatars[variables.id!.toLowerCase()]
    return Response.json({ data: { user: avatar ? { avatar } : null } })
  }
}

export async function call(
  env: WorkerEnv,
  path: string,
  init: RequestInit = {},
  overrides: Overrides = { ens: null },
) {
  const ctx = createCtx()
  const response = await handleRequest(new Request(`https://api.test${path}`, init), env, ctx, overrides)
  await ctx.flush()
  return response
}

export const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])
