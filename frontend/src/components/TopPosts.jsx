import React from 'react';
import axios from 'axios';

export default function TopPosts() {
  const [posts, setPosts] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  const fetchPosts = React.useCallback(async () => {
      setLoading(true);
      try {
        const r = await axios.get('/posts/top10');
        setPosts(r.data || []);
      } catch (e) {
        setPosts([]);
      }
      setLoading(false);
  }, []);

  React.useEffect(() => {
    fetchPosts();
    const handleGraphUpdated = () => fetchPosts();
    window.addEventListener('graph-updated', handleGraphUpdated);
    return () => window.removeEventListener('graph-updated', handleGraphUpdated);
  }, [fetchPosts]);

  return (
    <div className="card">
      <h2 className="card-title mb-4">🔥 Top 10 Posts</h2>

      {loading ? (
        <p className="loading text-center py-8">⏳ Loading top posts...</p>
      ) : posts.length === 0 ? (
        <p className="muted text-center py-8">📭 No posts yet</p>
      ) : (
        <div className="space-y-3">
          {posts.map((p, idx) => (
            <div 
              key={p.post_id}
              className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-4 hover:border-purple-500/50 transition-all"
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <span className="badge badge-warning">#{idx + 1}</span>
                  <span className="badge ml-2">Post #{p.post_id}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="badge badge-success">❤️ {p.likes}</span>
                  <span className="badge">👁️ {p.unique_views ?? 0}</span>
                </div>
              </div>
              <p className="text-slate-100 mb-2">{p.content}</p>
              <p className="text-xs text-slate-400">
                by <span className="text-blue-300 font-medium">@{p.user_id}</span>
                <span className="ml-3">score {Number(p.score ?? 0).toFixed(6)}</span>
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
