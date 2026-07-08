import { useState, useEffect } from 'react';
import { useGameServer } from '@agent8/gameserver';

export default function NicknameSetting() {
  const { connected, server } = useGameServer();
  const [nickname, setNickname] = useState('');
  const [currentNick, setCurrentNick] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!connected) return;
    loadNickname();
  }, [connected]);

  const loadNickname = async () => {
    try {
      const nick = await server.remoteFunction('getMyNickname');
      setCurrentNick(nick as string | null);
      if (nick) setNickname(nick as string);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!connected) return;
    if (!nickname.trim()) {
      setMessage('Please enter a nickname.');
      return;
    }
    setSaving(true);
    setMessage('');
    try {
      await server.remoteFunction('setNickname', [nickname.trim()]);
      setCurrentNick(nickname.trim());
      setEditing(false);
      setMessage('Nickname saved!');
    } catch (e: any) {
      setMessage(e.message || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return null;

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-80 text-white">
      <h2 className="text-lg font-bold mb-4">Nickname</h2>

      {currentNick && !editing ? (
        <div>
          <div className="flex items-center justify-between">
            <span className="text-lg font-mono">{currentNick}</span>
            <button
              onClick={() => setEditing(true)}
              className="text-sm text-blue-400 hover:text-blue-300"
            >
              Change
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="Enter nickname"
            maxLength={15}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg font-bold text-sm transition-colors"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
            {currentNick && (
              <button
                onClick={() => {
                  setEditing(false);
                  setNickname(currentNick);
                  setMessage('');
                }}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      )}

      {message && (
        <p className={`text-sm text-center mt-3 ${message.includes('Failed') || message.includes('Please') ? 'text-red-400' : 'text-green-400'}`}>
          {message}
        </p>
      )}
    </div>
  );
}
