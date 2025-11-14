import React from 'react';
import axios from 'axios';

export default function PostList() {
  const [posts, setPosts] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => { fetchPosts(); }, []);

  const fetchPosts = async () => {
    setLoading(true);
    try {
      const r = await axios.get('/posts/all');
      setPosts(r.data || []);
    } catch (err) { setPosts([]); }
    setLoading(false);
  };

  return (
    <div className="card">
      <div className="flex justify-between items-center mb-4">
        <h2 className="card-title">📝 All Posts ({posts.length})</h2>
        <button onClick={fetchPosts} className="btn btn-secondary" disabled={loading}>
          {loading ? '⏳ Loading...' : '🔄 Refresh'}
        </button>
      </div>

      {loading ? (
        <p className="loading text-center py-8">⏳ Loading posts...</p>
      ) : posts.length === 0 ? (
        <p className="muted text-center py-8">📭 No posts yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>🆔 Post ID</th>
                <th>👤 Author ID</th>
                <th>✏️ Content</th>
                <th className="text-right">⚙️</th>
              </tr>
            </thead>
            <tbody>
              {posts.map(p => (
                <tr key={p.post_id} className="hover:bg-blue-500/5 transition-colors">
                  <td><span className="badge badge-success">{p.post_id}</span></td>
                  <td><span className="badge badge-ghost">{p.user_id}</span></td>
                  <td className="font-medium text-slate-100 max-w-[40ch] truncate">{p.content}</td>
                  <td className="text-right">
                    <button
                      className="btn btn-ghost btn-sm text-red-400"
                      onClick={async () => {
                        if (!confirm(`Remove post ${p.post_id} by user ${p.user_id}?`)) return;
                        try {
                          await axios.post('/post/delete', `post_id=${encodeURIComponent(String(p.post_id))}`, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
                          fetchPosts();
                          try { window.dispatchEvent(new Event('graph-updated')); } catch(_) {}
                        } catch (err) {
                          alert('Error removing post');
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
