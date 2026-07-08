import { useState, useEffect } from 'react';
import { useGameServer } from '@agent8/gameserver';

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Settings({ isOpen, onClose }: SettingsProps) {
  const { connected, server } = useGameServer();

  const [nickname, setNickname] = useState('');
  const [currentNick, setCurrentNick] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [message, setMessage] = useState('');
  const [editingNick, setEditingNick] = useState(false);

  useEffect(() => {
    if (!isOpen || !connected) return;
    loadSettings();
  }, [isOpen, connected]);

  const loadSettings = async () => {
    setLoading(true);
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

  const handleSaveNickname = async () => {
    if (!nickname.trim()) {
      setMessage('Please enter a nickname.');
      return;
    }
    setSaving(true);
    setMessage('');
    try {
      await server.remoteFunction('setNickname', [nickname.trim()]);
      setCurrentNick(nickname.trim());
      setEditingNick(false);
      setMessage('Nickname saved!');
    } catch (e: any) {
      setMessage(e.message || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setResetting(true);
    setMessage('');
    try {
      await server.remoteFunction('resetAllData');
      setCurrentNick(null);
      setNickname('');
      setEditingNick(true);
      setMessage('All data cleared.');
    } catch (e: any) {
      setMessage(e.message || 'Reset failed.');
    } finally {
      setResetting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 rounded-xl p-6 max-w-sm w-full mx-4 text-white border border-gray-700"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-xl font-bold">Settings</h1>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-lg leading-none px-2"
          >
            x
          </button>
        </div>

        {loading ? (
          <div className="text-center py-4 text-gray-400">Loading...</div>
        ) : (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-medium text-gray-400 mb-3">Nickname</h3>
              {currentNick && !editingNick ? (
                <div className="flex items-center justify-between">
                  <span className="text-lg font-mono">{currentNick}</span>
                  <button
                    onClick={() => setEditingNick(true)}
                    className="text-sm text-blue-400 hover:text-blue-300"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
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
                      onClick={handleSaveNickname}
                      disabled={saving}
                      className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg font-bold text-sm transition-colors"
                    >
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                    {currentNick && (
                      <button
                        onClick={() => {
                          setEditingNick(false);
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
            </div>

            <hr className="border-gray-700" />

            <div>
              <h3 className="text-sm font-medium text-gray-400 mb-3">Data</h3>
              <button
                onClick={handleReset}
                disabled={resetting}
                className="w-full py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 rounded-lg font-bold text-sm transition-colors"
              >
                {resetting ? 'Resetting...' : 'Reset All Data'}
              </button>
            </div>

            {message && (
              <p className={`text-sm text-center ${message.includes('Failed') || message.includes('Please') ? 'text-red-400' : 'text-green-400'}`}>
                {message}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
