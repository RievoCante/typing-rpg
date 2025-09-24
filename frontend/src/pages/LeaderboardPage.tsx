// Leaderboard page with two tabs: All-time Level and Today WPM (Daily)
import { useEffect, useMemo, useState } from 'react';
import Header from '../components/Header';
import { useThemeContext } from '../hooks/useThemeContext';
import { useApi } from '../hooks/useApi';
import LeftSidebar from '../components/LeftSidebar';
import SiteLogo from '../components/SiteLogo';

type LevelRow = {
  rank: number;
  userId: string;
  username: string;
  level: number;
  xp: number;
};
type TodayWpmRow = {
  rank: number;
  userId: string;
  username: string;
  wpm: number;
};

export default function LeaderboardPage() {
  const { theme } = useThemeContext();
  const { getLeaderboardLevels, getLeaderboardTodayWpm } = useApi();
  const [tab, setTab] = useState<'levels' | 'todayWpm'>('levels');
  const [levels, setLevels] = useState<LevelRow[]>([]);
  const [wpm, setWpm] = useState<TodayWpmRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const pageSize = 50;

  const bgClass = useMemo(
    () =>
      theme === 'dark'
        ? 'bg-[#303446] text-white'
        : 'bg-gradient-to-br from-blue-50 via-white to-indigo-50 text-gray-900',
    [theme]
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const fetchData = async () => {
      try {
        if (tab === 'levels') {
          const res = await getLeaderboardLevels(pageSize, page * pageSize);
          const data = await res.json();
          if (!cancelled)
            setLevels(Array.isArray(data.items) ? data.items : []);
        } else {
          const res = await getLeaderboardTodayWpm(pageSize, page * pageSize);
          const data = await res.json();
          if (!cancelled) setWpm(Array.isArray(data.items) ? data.items : []);
        }
      } catch (e) {
        if (!cancelled) setError('Failed to load leaderboard');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchData();
    return () => {
      cancelled = true;
    };
  }, [tab, page, getLeaderboardLevels, getLeaderboardTodayWpm]);

  const table = (
    <div
      className={`max-w-4xl mx-auto w-full ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
    >
      <div
        className={`${theme === 'dark' ? 'bg-[#2A2C3C] border-gray-700' : 'bg-white border-gray-200'} border rounded-xl shadow`}
      >
        <div className="flex p-2 gap-2">
          <button
            type="button"
            onClick={() => {
              setTab('levels');
              setPage(0);
            }}
            className={`px-3 py-1 rounded ${tab === 'levels' ? 'bg-emerald-600 text-white' : theme === 'dark' ? 'bg-gray-700 text-white' : 'bg-gray-100'}`}
          >
            All-time Level
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('todayWpm');
              setPage(0);
            }}
            className={`px-3 py-1 rounded ${tab === 'todayWpm' ? 'bg-emerald-600 text-white' : theme === 'dark' ? 'bg-gray-700 text-white' : 'bg-gray-100'}`}
          >
            Today WPM (Daily)
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className={theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'}>
              <tr>
                <th className="text-left px-4 py-2 w-16">#</th>
                <th className="text-left px-4 py-2">Player</th>
                {tab === 'levels' ? (
                  <>
                    <th className="text-left px-4 py-2">Level</th>
                    <th className="text-left px-4 py-2">XP</th>
                  </>
                ) : (
                  <>
                    <th className="text-left px-4 py-2">Best Avg WPM</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 opacity-80">
                    Loading…
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-red-400">
                    {error}
                  </td>
                </tr>
              ) : tab === 'levels' ? (
                levels.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 opacity-80">
                      No data
                    </td>
                  </tr>
                ) : (
                  levels.map(r => (
                    <tr
                      key={r.userId}
                      className={
                        theme === 'dark'
                          ? 'border-t border-gray-700'
                          : 'border-t border-gray-200'
                      }
                    >
                      <td className="px-4 py-2">{r.rank}</td>
                      <td className="px-4 py-2">{r.username}</td>
                      <td className="px-4 py-2">{r.level}</td>
                      <td className="px-4 py-2">{r.xp}</td>
                    </tr>
                  ))
                )
              ) : wpm.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 opacity-80">
                    No data
                  </td>
                </tr>
              ) : (
                wpm.map(r => (
                  <tr
                    key={r.userId}
                    className={
                      theme === 'dark'
                        ? 'border-t border-gray-700'
                        : 'border-t border-gray-200'
                    }
                  >
                    <td className="px-4 py-2">{r.rank}</td>
                    <td className="px-4 py-2">{r.username}</td>
                    <td className="px-4 py-2">{r.wpm}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between p-3">
          <button
            type="button"
            onClick={() => setPage(p => Math.max(0, p - 1))}
            className={`px-3 py-1 rounded ${page === 0 ? 'opacity-50 pointer-events-none' : theme === 'dark' ? 'bg-gray-700 text-white' : 'bg-gray-100'}`}
          >
            Prev
          </button>
          <div className="opacity-80 text-xs">Page {page + 1}</div>
          <button
            type="button"
            onClick={() => setPage(p => p + 1)}
            className={`${theme === 'dark' ? 'bg-gray-700 text-white' : 'bg-gray-100'} px-3 py-1 rounded`}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className={`min-h-screen ${bgClass}`}>
      <SiteLogo />
      <LeftSidebar />
      <Header />
      <div className="pt-4 pb-12">
        <h1 className="text-center text-2xl font-bold mb-4">Leaderboard</h1>
        {table}
      </div>
    </div>
  );
}
