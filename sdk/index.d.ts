export declare const DEFAULT_BASE_URL: string

export interface AvatarRecord {
  address: `0x${string}`
  ens: string | null
  avatar: {
    uri: string
    url: string
    gateways: string[]
    source: 'snapshot' | 'ens'
  } | null
}

export interface ImageOptions {
  /** Pixel size hint for generated identicons (16–1024). */
  size?: number
  /** `identicon` (default) or `404` when no avatar is published. */
  fallback?: 'identicon' | '404'
  baseUrl?: string
}

export interface ClientOptions {
  apiKey?: string
  baseUrl?: string
  fetch?: typeof fetch
}

export declare class WalletFaceError extends Error {
  readonly status: number
  readonly code: string
}

export declare function avatarImageUrl(id: string, options?: ImageOptions): string

export declare function createClient(options?: ClientOptions): {
  getAvatar(id: string): Promise<AvatarRecord>
  getAvatars(ids: string[]): Promise<AvatarRecord[]>
  imageUrl(id: string, options?: Omit<ImageOptions, 'baseUrl'>): string
}
