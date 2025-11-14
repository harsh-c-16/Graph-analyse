import React from 'react';
import axios from 'axios';

export default function UserList() {
  const [users, setUsers] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => { fetchUsers(); }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const r = await axios.get('/users-list?page=1&limit=50');
      setUsers(r.data || []);
    } catch (err) { 
      setUsers([]); 
    }
    setLoading(false);
  };

  return (
    <div className="card">
      <div className="flex justify-between items-center mb-4">
        <h2 className="card-title">👥 All Users ({users.length})</h2>
        <button onClick={fetchUsers} className="btn btn-secondary" disabled={loading}>
          {loading ? '⏳ Loading...' : '🔄 Refresh'}
        </button>
      </div>

      {loading ? (
        <p className="loading text-center py-8">⏳ Loading users...</p>
      ) : users.length === 0 ? (
        <p className="muted text-center py-8">📭 No users yet. Create one to get started!</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>👤 User ID</th>
                <th>📛 Username</th>
                <th className="text-right">⚙️</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.user_id} className="hover:bg-blue-500/5 transition-colors">
                  <td>
                    <span className="badge badge-success">{u.user_id}</span>
                  </td>
                    <td className="font-medium text-slate-100">{u.username}</td>
                    <td className="text-right">
                      <button
                        className="btn btn-ghost btn-sm text-red-400"
                        onClick={async () => {
                          if (!confirm(`Remove user ${u.user_id} (${u.username})? This will delete their posts and interactions.`)) return;
                          try {
                            await axios.post('/user/delete', `user_id=${encodeURIComponent(String(u.user_id))}`, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
                            // refresh list and notify graph viewers
                            fetchUsers();
                            try { window.dispatchEvent(new Event('graph-updated')); } catch(_) {}
                          } catch (err) {
                            alert('Error removing user');
                          }
                        }}
                      >
                        Remove
                      </button>
                    </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
