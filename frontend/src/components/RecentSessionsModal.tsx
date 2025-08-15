// Modal to display recent sessions in a clean, light/dark-friendly panel
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useApi } from '../hooks/useApi';

type Session = {
  id: number;
  mode: 'daily' | 'endless';
  wpm: number;
  incorrectWords: number;
  createdAt: number | string | Date;
};

interface RecentSessionsModalProps {
  open: boolean;
  onClose: () => void;
}

export default function RecentSessionsModal({ open, onClose }: RecentSessionsModalProps) {
  const { getRecentSessions } = useApi();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    (async () => {
      try {
        const res = await getRecentSessions(25);
        if (!res.ok) return;
        const data = await res.json();
        const list = (data.sessions ?? []) as Session[];
        const mapped: Session[] = list.map((s) => {
          let ms: number;
          const v = s.createdAt;
          if (typeof v === 'number') {
            ms = v < 1_000_000_000_000 ? v * 1000 : v;
          } else if (typeof v === 'string') {
            const parsed = Date.parse(v);
            ms = Number.isFinite(parsed) ? parsed : Date.now();
          } else {
            const d = new Date(v);
            ms = Number.isFinite(d.getTime()) ? d.getTime() : Date.now();
          }
          return { ...s, createdAt: ms };
        });
        setSessions(mapped);
      } finally {
        setLoading(false);
      }
    })();
  }, [open, getRecentSessions]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start md:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-3xl rounded-xl shadow-2xl overflow-hidden transition-colors duration-300 bg-white text-gray-900 dark:bg-[#303446] dark:text-gray-100">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-white/10">
          <h2 className="text-lg font-semibold">Recent sessions</h2>
          <button aria-label="Close" onClick={onClose} className="p-2 rounded hover:bg-gray-100 dark:hover:bg-white/10">
            <X size={18} />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-auto">
          {loading ? (
            <div className="p-6 text-sm opacity-70">Loading…</div>
          ) : sessions.length === 0 ? (
            <div className="p-6 text-sm opacity-70">No sessions yet.</div>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-white/10">
              {sessions.map((s) => (
                <li key={s.id} className="grid grid-cols-2 sm:grid-cols-3 gap-2 px-5 py-3">
                  <span className="opacity-80">{new Date(s.createdAt).toLocaleString()}</span>
                  <span className="capitalize opacity-80">{s.mode}</span>
                  <span className="text-right sm:text-left font-medium">{s.wpm} WPM · {s.incorrectWords} miss</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}


