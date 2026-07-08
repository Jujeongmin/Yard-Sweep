import { useState } from 'react';
import { useGameServer } from '@agent8/gameserver';

export default function StatsPanel() {
  const { connected, server } = useGameServer();
  const [level, setLevel] = useState(1);
  const [exp, setExp] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  const handleSubmit = async () => {
    if (!connected) return;

    setSubmitting(true);
    setMessage('');
    try {
      await server.remoteFunction('updatePlayerStats', [level, exp]);
      setMessage('Stats updated!');
    } catch (e: any) {
      setMessage(e.message || 'Failed to update stats.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-80 text-white">
      <h2 className="text-lg font-bold mb-4">Update Stats</h2>

      <div className="space-y-3">
        <div>
          <label className="block text-sm text-gray-400 mb-1">Level</label>
          <input
            type="number"
            value={level}
            onChange={(e) => setLevel(Math.max(1, parseInt(e.target.value) || 1))}
            min={1}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">Exp</label>
          <input
            type="number"
            value={exp}
            onChange={(e) => setExp(Math.max(0, parseInt(e.target.value) || 0))}
            min={0}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 rounded-lg font-bold transition-colors"
        >
          {submitting ? 'Updating...' : 'Update Stats'}
        </button>

        {message && (
          <p className={`text-sm text-center ${message.includes('Failed') ? 'text-red-400' : 'text-green-400'}`}>
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
