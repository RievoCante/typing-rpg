import { useEffect } from 'react';

// Default title kept in sync with the static <title> in index.html.
export const DEFAULT_TITLE = 'Typing RPG — Free Typing Game to Battle Monsters';

/**
 * Sets document.title for the current route and restores the default on unmount.
 * Lightweight per-route metadata for an SPA (avoids duplicate <title> tags that
 * React 19's metadata hoisting would create alongside the static index.html title).
 */
export function useDocumentTitle(title?: string) {
  useEffect(() => {
    document.title = title ?? DEFAULT_TITLE;
    return () => {
      document.title = DEFAULT_TITLE;
    };
  }, [title]);
}
