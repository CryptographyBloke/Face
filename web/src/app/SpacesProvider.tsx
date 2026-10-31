import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { readLocal, saveLocal } from "./Preferences";
import { validSpaceId } from "./config";
export interface SavedSpace {
  id: string;
  name: string;
  avatar: string | null;
}
const SAVED = "wallet-face:followed:v1",
  RECENT = "wallet-face:recent:v1";
function readSpaces(key: string, limit: number) {
  const items = readLocal<unknown>(key, []);
  if (!Array.isArray(items)) return [];
  const ids = new Set();
  return items
    .filter((item): item is SavedSpace => {
      if (
        !item ||
        typeof item.id !== "string" ||
        !validSpaceId(item.id) ||
        ids.has(item.id)
      )
        return false;
      ids.add(item.id);
      return (
        typeof item.name === "string" &&
        item.name.length <= 100 &&
        (item.avatar === null ||
          (typeof item.avatar === "string" && item.avatar.length <= 2048))
      );
    })
    .slice(0, limit);
}
const Context = createContext<{
  followed: SavedSpace[];
  recent: SavedSpace[];
  toggle: (space: SavedSpace) => void;
  visit: (space: SavedSpace) => void;
} | null>(null);
export function SpacesProvider({ children }: { children: ReactNode }) {
  const [followed, setFollowed] = useState(() => readSpaces(SAVED, 24));
  const [recent, setRecent] = useState(() => readSpaces(RECENT, 8));
  useEffect(() => {
    saveLocal(SAVED, followed);
  }, [followed]);
  useEffect(() => {
    saveLocal(RECENT, recent);
  }, [recent]);
  useEffect(() => {
    const sync = (e: StorageEvent) => {
      if (e.key === SAVED) setFollowed(readSpaces(SAVED, 24));
      if (e.key === RECENT) setRecent(readSpaces(RECENT, 8));
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  const toggle = useCallback((space: SavedSpace) => {
    if (!validSpaceId(space.id)) return;
    setFollowed((items) =>
      items.some((s) => s.id === space.id)
        ? items.filter((s) => s.id !== space.id)
        : [space, ...items].slice(0, 24),
    );
  }, []);
  const visit = useCallback((space: SavedSpace) => {
    if (!validSpaceId(space.id)) return;
    setRecent((items) =>
      [space, ...items.filter((s) => s.id !== space.id)].slice(0, 8),
    );
  }, []);
  return (
    <Context.Provider value={{ followed, recent, toggle, visit }}>
      {children}
    </Context.Provider>
  );
}
export function useSpaces() {
  const v = useContext(Context);
  if (!v) throw new Error("SpacesProvider is required");
  return v;
}
