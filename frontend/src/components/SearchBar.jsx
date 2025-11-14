import React from 'react';
import axios from 'axios';

export default function SearchBar() {
  const [q, setQ] = React.useState('');
  const [res, setRes] = React.useState([]);
  const [prefix, setPrefix] = React.useState('');
  const [ac, setAc] = React.useState([]);
  const [searching, setSearching] = React.useState(false);

  const doSearch = async (e) => {
    e.preventDefault();
    if (!q.trim()) return;
    setSearching(true);
    try {
      const r = await axios.get(`/search?q=${encodeURIComponent(q)}`);
      setRes(r.data || []);
    } catch (e) {
      setRes([]);
    }
    setSearching(false);
  };

  const doAc = async (val) => {
    setPrefix(val);
    if (val.length < 1) {
      setAc([]);
      return;
    }
    try {
      const r = await axios.get(`/autocomplete/user?prefix=${encodeURIComponent(val)}`);
      setAc(r.data || []);
    } catch (e) {
      setAc([]);
    }
  };

  return (
    <div className="space-y-6">
      {/* Full Text Search */}
      <div className="card">
        <h3 className="card-title mb-4">🔍 Search Posts</h3>
        <form onSubmit={doSearch} className="space-y-3">
          <input
            placeholder="Search for keywords in posts..."
            value={q}
            onChange={e => setQ(e.target.value)}
            className="w-full"
          />
          <button type="submit" className="btn btn-success w-full" disabled={searching || !q.trim()}>
            {searching ? '⏳ Searching...' : '🔎 Search Posts'}
          </button>
        </form>

        {res.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-sm text-slate-400">Found {res.length} result{res.length !== 1 ? 's' : ''}:</p>
            {res.map((r, idx) => (
              <div
                key={idx}
                className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-3 hover:border-blue-500/50 transition-all"
              >
                <p className="text-slate-100">{r}</p>
              </div>
            ))}
          </div>
        )}

        {!searching && q && res.length === 0 && (
          <div className="mt-4 text-center text-slate-400">
            <p>No posts found matching "{q}"</p>
          </div>
        )}
      </div>

      {/* Username Autocomplete */}
      <div className="card">
        <h3 className="card-title mb-4">👤 User Autocomplete</h3>
        <input
          placeholder="Start typing a username..."
          value={prefix}
          onChange={e => doAc(e.target.value)}
          className="w-full"
        />

        {ac.length > 0 && (
          <div className="mt-4">
            <p className="text-sm text-slate-400 mb-3">
              Matching users ({ac.length}):
            </p>
            <div className="space-y-2">
              {ac.map((user, idx) => (
                <div
                  key={idx}
                  className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-3 hover:border-purple-500/50 transition-all cursor-pointer"
                  onClick={() => setPrefix(user)}
                >
                  <p className="text-slate-100 font-medium">👤 {user}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {prefix && ac.length === 0 && (
          <div className="mt-4 text-center text-slate-400">
            <p>No users matching "{prefix}"</p>
          </div>
        )}

        {!prefix && (
          <div className="mt-4 text-center text-slate-400">
            <p>💡 Start typing to see matching usernames</p>
          </div>
        )}
      </div>
    </div>
  );
}
