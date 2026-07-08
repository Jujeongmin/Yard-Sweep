import { useState } from 'react';
import { useGameServer } from '@agent8/gameserver';
import Settings from './Settings';
import Leaderboard from './Leaderboard';
import StatsPanel from './StatsPanel';

function App() {
  const { connected } = useGameServer();
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

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

      <button
        onClick={() => setShowSettings(true)}
        className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-lg text-sm transition-colors"
      >
        Settings
      </button>

      <Leaderboard
        isOpen={showLeaderboard}
        onClose={() => setShowLeaderboard(false)}
      />

      <Settings
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />
    </div>
  );
}

export default App;
