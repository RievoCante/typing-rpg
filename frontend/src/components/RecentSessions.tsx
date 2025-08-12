// Shows a simple list of recent sessions for the signed-in user.
import { useEffect, useState } from 'react';
import { useApi } from '../hooks/useApi';

type Session = {
  id: number;
  mode: 'daily' | 'endless';
  wpm: number;
  incorrectWords: number;
  createdAt: number;
};

export default function RecentSessions() {
  const { getRecentSessions } = useApi();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await getRecentSessions(10);
        if (!res.ok) {
          setLoading(false);
          return;
        }
        const data = await res.json();
        const list = (data.sessions ?? []) as Session[];
        const mapped: Session[] = list.map((s) => ({
          id: s.id,
          mode: s.mode,
          wpm: s.wpm,
          incorrectWords: s.incorrectWords,
          createdAt: s.createdAt,
        }));
        setSessions(mapped);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  }, [getRecentSessions]);

  if (loading) return null;
  if (!sessions.length) return null;

  return (
    <div className="max-w-3xl mx-auto mt-4 p-4 rounded border border-gray-200 dark:border-gray-700">
      <h3 className="text-sm font-semibold mb-2">Recent Sessions</h3>
      <ul className="space-y-1 text-sm">
        {sessions.map((s) => (
          <li key={s.id} className="flex justify-between">
            <span>
              {new Date(s.createdAt * 1000).toLocaleString()} · {s.mode}
            </span>
            <span>
              {s.wpm} WPM · {s.incorrectWords} miss
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
