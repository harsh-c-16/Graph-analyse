import React from 'react';
import axios from 'axios';

export default function UserRanking() {
  const [page, setPage] = React.useState(1);
  const [users, setUsers] = React.useState([]);
  const [loading, setLoading] = React.useState(false);

  const fetch = async (p=1) => {
    setLoading(true);
    try {
      const r = await axios.get(`/users/ranked?page=${p}&limit=10`);
      setUsers(r.data || []);
    } catch (e) { setUsers([]); }
    setLoading(false);
  };

  React.useEffect(() => { fetch(page); }, [page]);

  return (
    <div className="card">
      <h2 className="card-title mb-4">👑 User Rankings by Influence</h2>
      
      {loading ? (
        <p className="loading text-center py-8">⏳ Loading rankings...</p>
      ) : users.length === 0 ? (
        <p className="muted text-center py-8">📭 No rankings available yet</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>#</th>
                <th>👤 Username</th>
                <th>⭐ Influence Score</th>
                <th>👥 Followers</th>
                <th>→ Following</th>
                <th>❤️ Total Likes</th>
                <th>📝 Posts</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u, idx) => (
                <tr key={u.user_id} className="hover:bg-purple-500/5 transition-colors">
                  <td className="font-bold text-lg">
                    {page === 1 && idx === 0 ? '🥇' : page === 1 && idx === 1 ? '🥈' : page === 1 && idx === 2 ? '🥉' : idx + 1}
                  </td>
                  <td>
                    <span className="font-medium text-slate-100">{u.username}</span>
                    <span className="badge badge-warning ml-2 text-xs">#{u.user_id}</span>
                  </td>
                  <td>
                    <span className="badge badge-success font-bold">
                      {u.score?.toFixed ? u.score.toFixed(2) : u.score}
                    </span>
                  </td>
                  <td className="text-center">{u.followers ?? '0'}</td>
                  <td className="text-center">{u.followings ?? '0'}</td>
                  <td className="text-center">{u.total_likes ?? '0'}</td>
                  <td className="text-center">{u.posts ?? '0'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-6 flex justify-between items-center">
        <button 
          onClick={() => setPage(p => Math.max(1, p - 1))}
          disabled={page === 1 || loading}
          className="btn btn-secondary"
        >
          ← Previous
        </button>
        <span className="px-4 py-2 bg-slate-800 rounded-lg text-slate-300 font-medium">
          Page <span className="text-blue-400 font-bold">{page}</span>
        </span>
        <button 
          onClick={() => setPage(p => p + 1)}
          disabled={loading || users.length < 10}
          className="btn btn-secondary"
        >
          Next →
        </button>
      </div>
    </div>
  );
}
