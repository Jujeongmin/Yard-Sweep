import { useState } from 'react';
import { useGameServer } from '@agent8/gameserver';
import NicknameSetting from './NicknameSetting';
import Leaderboard from './Leaderboard';
import StatsPanel from './StatsPanel';

function App() {
  const { connected, server } = useGameServer();
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetMsg, setResetMsg] = useState('');

  const handleReset = async () => {
    if (!connected) return;
    setResetting(true);
    setResetMsg('');
    try {
      await server.remoteFunction('resetAllData');
      setResetMsg('All data cleared.');
    } catch (e: any) {
      setResetMsg(e.message || 'Reset failed.');
    } finally {
      setResetting(false);
    }
  };

  if (!connected) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white">
        <p className="text-gray-400">Connecting to server...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-6">
      <NicknameSetting />
      <StatsPanel />

      <button
        onClick={() => setShowLeaderboard(true)}
        className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg text-lg transition-colors"
      >
        Rankings
      </button>

      <button
        onClick={handleReset}
        disabled={resetting}
        className="px-6 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold rounded-lg text-sm transition-colors"
      >
        {resetting ? 'Resetting...' : 'Reset All Data'}
      </button>

      {resetMsg && (
        <p className={`text-sm ${resetMsg.includes('Failed') ? 'text-red-400' : 'text-green-400'}`}>
          {resetMsg}
        </p>
      )}

      <Leaderboard
        isOpen={showLeaderboard}
        onClose={() => setShowLeaderboard(false)}
      />
    </div>
  );
}

export default App;
