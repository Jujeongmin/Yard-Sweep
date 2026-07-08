import { useState } from 'react';
import { useGameServer } from '@agent8/gameserver';
import Leaderboard from './Leaderboard';
import StatsPanel from './StatsPanel';

function App() {
  const { connected } = useGameServer();
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  if (!connected) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white">
        <p className="text-gray-400">Connecting to server...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-6">
      <StatsPanel />

      <button
        onClick={() => setShowLeaderboard(true)}
        className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg text-lg transition-colors"
      >
        Rankings
      </button>

      <Leaderboard
        isOpen={showLeaderboard}
        onClose={() => setShowLeaderboard(false)}
      />
    </div>
  );
}

export default App;
