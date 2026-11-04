import { useEffect, useState } from 'react'

export type Route =
  | { page: 'home' }
  | { page: 'profile'; id: string }
  | { page: 'developers' }
  | { page: 'pricing' }
  | { page: 'dashboard' }

export interface Location {
  route: Route
  query: URLSearchParams
}

export function parseHash(hash: string): Location {
  const [path = '', search = ''] = hash.replace(/^#/, '').split('?')
  const parts = path.split('/').filter(Boolean)
  const query = new URLSearchParams(search)

  let route: Route = { page: 'home' }
  if (parts[0] === 'u' && parts[1]) route = { page: 'profile', id: decodeURIComponent(parts[1]) }
  else if (parts[0] === 'developers') route = { page: 'developers' }
  else if (parts[0] === 'pricing') route = { page: 'pricing' }
  else if (parts[0] === 'dashboard') route = { page: 'dashboard' }

  return { route, query }
}

export function href(route: Route, query?: Record<string, string>) {
  const path =
    route.page === 'home' ? '/' : route.page === 'profile' ? `/u/${encodeURIComponent(route.id)}` : `/${route.page}`
  const search = query ? `?${new URLSearchParams(query)}` : ''
  return `#${path}${search}`
}

export function navigate(route: Route, query?: Record<string, string>) {
  window.location.hash = href(route, query)
}

export function useLocation() {
  const [location, setLocation] = useState(() => parseHash(window.location.hash))
  useEffect(() => {
    const update = () => {
      setLocation(parseHash(window.location.hash))
      window.scrollTo({ top: 0 })
    }
    window.addEventListener('hashchange', update)
    return () => window.removeEventListener('hashchange', update)
  }, [])
  return location
}
