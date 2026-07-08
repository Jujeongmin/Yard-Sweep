import { useState, useEffect } from 'react';
import { useGameServer } from '@agent8/gameserver';

interface RankEntry {
  __id: string;
  account: string;
  nickname: string;
  level: number;
  exp: number;
}

interface MyRank {
  entry: RankEntry | null;
  rank: number;
}

interface LeaderboardProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Leaderboard({ isOpen, onClose }: LeaderboardProps) {
  const { connected, server } = useGameServer();
  const [topRanks, setTopRanks] = useState<RankEntry[]>([]);
  const [myRank, setMyRank] = useState<MyRank | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen || !connected) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        const [top, mine] = await Promise.all([
          server.remoteFunction('getTopRankings'),
          server.remoteFunction('getMyRank'),
        ]);
        setTopRanks(top as RankEntry[]);
        setMyRank(mine as MyRank);
      } catch (err) {
        console.error('Failed to load rankings:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isOpen, connected, server]);

  if (!isOpen) return null;

  const myAccount = server?.account;
  const isMe = (entry: RankEntry) => entry.account === myAccount;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 rounded-xl p-6 max-w-lg w-full mx-4 text-white border border-gray-700"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-xl font-bold">Rankings</h1>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-lg leading-none px-2"
          >
            x
          </button>
        </div>

        {loading ? (
          <div className="text-center py-8 text-gray-400">Loading...</div>
        ) : (
          <>
            <div className="grid grid-cols-12 text-xs text-gray-400 uppercase tracking-wider pb-2 border-b border-gray-700 mb-1 px-2">
              <span className="col-span-2">Rank</span>
              <span className="col-span-5">Name</span>
              <span className="col-span-2 text-right">Lv</span>
              <span className="col-span-3 text-right">Exp</span>
            </div>

            <div className="space-y-0.5 max-h-80 overflow-y-auto">
              {topRanks.map((entry, index) => (
                <div
                  key={entry.__id}
                  className={`grid grid-cols-12 items-center py-2 px-2 rounded ${
                    isMe(entry) ? 'bg-blue-600/30 ring-1 ring-blue-500' : 'hover:bg-gray-800'
                  }`}
                >
                  <span className="col-span-2 font-mono text-sm">
                    {index + 1}
                  </span>
                  <span className="col-span-5 text-sm truncate">
                    {entry.nickname}
                  </span>
                  <span className="col-span-2 text-right text-sm font-mono">
                    {entry.level}
                  </span>
                  <span className="col-span-3 text-right text-sm font-mono">
                    {entry.exp.toLocaleString()}
                  </span>
                </div>
              ))}

              {topRanks.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No rankings yet. Be the first!
                </div>
              )}
            </div>

            {myRank?.entry && myRank.rank > 20 && (
              <div className="border-t border-gray-700 mt-4 pt-3">
                <div className="grid grid-cols-12 items-center py-2 px-2 rounded bg-blue-600/20">
                  <span className="col-span-2 font-mono text-sm">{myRank.rank}</span>
                  <span className="col-span-5 text-sm truncate">{myRank.entry.nickname}</span>
                  <span className="col-span-2 text-right text-sm font-mono">{myRank.entry.level}</span>
                  <span className="col-span-3 text-right text-sm font-mono">
                    {myRank.entry.exp.toLocaleString()}
                  </span>
                </div>
              </div>
            )}
          </>
        )}

        <button
          onClick={onClose}
          className="w-full mt-4 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm"
        >
          Close
        </button>
      </div>
    </div>
  );
}
