import React from 'react';
import axios from 'axios';

export default function PathExplorer() {
  const [u1, setU1] = React.useState('');
  const [u2, setU2] = React.useState('');
  const [path, setPath] = React.useState([]);
  const [error, setError] = React.useState('');
  const [recUser, setRecUser] = React.useState('');
  const [recs, setRecs] = React.useState([]);
  const [vizPaths, setVizPaths] = React.useState({});
  const [usersList, setUsersList] = React.useState([]);
  const [postsList, setPostsList] = React.useState([]);
  const [followEdges, setFollowEdges] = React.useState([]);
  const [likeEdges, setLikeEdges] = React.useState([]);
  const [posterEdges, setPosterEdges] = React.useState([]);
  const [postsCount, setPostsCount] = React.useState({});
  const [loading, setLoading] = React.useState(false);

  const findPath = async (e) => {
    e.preventDefault();
    setError('');
    if (!u1.trim() || !u2.trim()) return;
    setLoading(true);
    try {
      // resolve inputs: allow numeric IDs or usernames
      const resolve = (val) => {
        const t = val.trim();
        if (/^\d+$/.test(t)) return parseInt(t, 10);
        // try to find matching username (case-insensitive) from loaded usersList
        const found = usersList.find(u => u.username && u.username.toLowerCase() === t.toLowerCase());
        return found ? found.user_id : null;
      };
      const id1 = resolve(u1);
      const id2 = resolve(u2);
      if (id1 == null || id2 == null) {
        setPath([]);
        setError('One or both users not found. Use numeric IDs or exact usernames.');
        setLoading(false);
        return;
      }
      const r = await axios.get(`/path?u1=${encodeURIComponent(id1)}&u2=${encodeURIComponent(id2)}`);
      setPath(r.data.path || []);
    } catch (e) {
      setPath([]);
      setError('Error fetching path');
    }
    setLoading(false);
  };

  const fetchGraph = async () => {
    try {
      const ru = await axios.get('/users-list?page=1&limit=1000');
      setUsersList(ru.data || []);
    } catch (err) { setUsersList([]); }
    try {
      const rp = await axios.get('/posts/all');
      const allPosts = rp.data || [];
      setPostsList(allPosts);
      // build post counts per author
      const pc = {};
      for (const p of allPosts) { pc[p.user_id] = (pc[p.user_id] || 0) + 1; }
      setPostsCount(pc);
    } catch (err) { setPostsList([]); setPostsCount({}); }

    // fetch followings and liked posts to build edges
    try {
      const ulist = (await axios.get('/users-list?page=1&limit=1000')).data || [];
      const tasks = ulist.map(async (u) => {
        const uid = u.user_id;
        const followings = (await axios.get(`/user/followings/${uid}`)).data || [];
        const liked = (await axios.get(`/user/likedposts/${uid}`)).data || [];
        return { uid, followings, liked };
      });
      const results = await Promise.all(tasks);
      const fEdges = [];
      const lEdges = [];
      // map posts to authors for liked->post mapping
      const postAuthor = {};
      for (const p of postsList) postAuthor[p.post_id] = p.user_id;
      for (const r of results) {
        for (const to of r.followings) fEdges.push({ from: r.uid, to });
        for (const pid of r.liked) {
          lEdges.push({ from: r.uid, to: pid });
        }
      }
      setFollowEdges(fEdges);
      setLikeEdges(lEdges);
      // build poster edges
      const pEdges = [];
      for (const p of postsList) pEdges.push({ from: p.user_id, to: p.post_id });
      setPosterEdges(pEdges);
    } catch (err) {
      setFollowEdges([]); setLikeEdges([]);
    }
  };

  // refresh graph on mount and when other components signal an update
  React.useEffect(() => {
    fetchGraph();
    const h = () => fetchGraph();
    window.addEventListener('graph-updated', h);
    return () => window.removeEventListener('graph-updated', h);
  }, []);

  const getRecs = async (e) => {
    e.preventDefault();
    if (!recUser.trim()) return;
    setLoading(true);
    try {
      // resolve recUser to numeric id if a username was entered
      const resolveId = (val) => {
        const t = val.trim();
        if (/^\d+$/.test(t)) return parseInt(t, 10);
        const found = usersList.find(u => u.username && u.username.toLowerCase() === t.toLowerCase());
        return found ? found.user_id : null;
      };
      const recId = resolveId(recUser);
      if (recId == null) {
        setRecs([]);
        setVizPaths({});
        setError('User for recommendations not found (use ID or exact username)');
        setLoading(false);
        return;
      }
      const r = await axios.get(`/recommendations?u=${encodeURIComponent(recId)}`);
      const recList = r.data || [];
      // convert to objects with username if available for nicer UI
      const recObjs = recList.map(id => {
        const u = usersList.find(x => x.user_id === id);
        return { id, username: u ? u.username : String(id) };
      });
      setRecs(recObjs);
      // fetch shortest path for each recommended user so we can visualize connection
      const map = {};
      await Promise.all(recList.map(async (rec) => {
        try {
          const pr = await axios.get(`/path?u1=${encodeURIComponent(recId)}&u2=${encodeURIComponent(rec)}`);
          map[rec] = pr.data.path || [];
        } catch (err) {
          map[rec] = [];
        }
      }));
      setVizPaths(map);
    } catch (e) {
      setRecs([]);
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      {/* Path Finder */}
      <div className="card">
        <h3 className="card-title mb-4">🗺️ Degrees of Separation</h3>
        <form onSubmit={findPath} className="col space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input
              placeholder="Start User ID or username"
              value={u1}
              onChange={e => setU1(e.target.value)}
              disabled={loading}
            />
            <input
              placeholder="End User ID or username"
              value={u2}
              onChange={e => setU2(e.target.value)}
              disabled={loading}
            />
          </div>
          <button
            type="submit"
            className="btn btn-success w-full"
            disabled={loading || !u1.trim() || !u2.trim()}
          >
            {loading ? '⏳ Finding path...' : '🔗 Find Path'}
          </button>
        </form>

        {path.length > 0 && (
          <div className="mt-4 p-4 bg-slate-800/40 border border-slate-700/50 rounded-lg">
            <p className="text-sm text-slate-400 mb-3">Connection found!</p>
            <div className="flex items-center gap-2 flex-wrap">
              {path.map((user, idx) => (
                <React.Fragment key={idx}>
                  <span className="badge badge-success px-3 py-1">{user}</span>
                  {idx < path.length - 1 && <span className="text-blue-400">→</span>}
                </React.Fragment>
              ))}
            </div>
            {/* Simple SVG visualization of the path */}
            <div className="mt-4">
              <svg width="100%" height="80" viewBox={`0 0 ${Math.max(300, path.length * 120)} 80`}>
                {path.map((node, i) => {
                  const x = 60 + i * 120;
                  return (
                    <g key={i}>
                      <circle cx={x} cy={40} r={24} fill="#7c3aed" />
                      <text x={x} y={44} fontSize="12" textAnchor="middle" fill="#fff">{node}</text>
                      {i < path.length - 1 && (
                        <line x1={x + 26} y1={40} x2={x + 120 - 26} y2={40} stroke="#60a5fa" strokeWidth="3" markerEnd="url(#arrow)" />
                      )}
                    </g>
                  );
                })}
                <defs>
                  <marker id="arrow" markerWidth="10" markerHeight="10" refX="6" refY="5" orient="auto">
                    <path d="M0,0 L10,5 L0,10 z" fill="#60a5fa" />
                  </marker>
                </defs>
              </svg>
            </div>
            <p className="text-xs text-slate-400 mt-3">
              🎯 <strong>{path.length - 1} degrees of separation</strong>
            </p>
          </div>
        )}

        {!loading && u1 && u2 && path.length === 0 && (
          <div className="mt-4 text-center text-slate-400">
            <p>❌ No connection found between these users</p>
          </div>
        )}

        {error && (
          <div className="mt-4 text-center text-rose-400">
            <p>{error}</p>
          </div>
        )}
      </div>

      {/* Improved user graph visualization */}
      <div className="card">
        <div className="flex justify-between items-center mb-4">
          <h3 className="card-title">� User Graph (follow / like)</h3>
          <div className="flex items-center gap-2">
            <button className="btn btn-secondary" onClick={fetchGraph}>🔄 Refresh</button>
            <button className="btn btn-ghost" onClick={() => { setPath([]); setVizPaths({}); }}>🧹 Reset Highlights</button>
          </div>
        </div>
        <div className="overflow-auto">
          <svg width="100%" height={600} viewBox={`0 0 1000 600`} preserveAspectRatio="xMidYMid meet">
            <defs>
              <marker id="arrow-follow" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
                <path d="M0,0 L10,5 L0,10 z" fill="#2563eb" />
              </marker>
              <marker id="arrow-like" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
                <path d="M0,0 L8,4 L0,8 z" fill="#fb923c" />
              </marker>
              <marker id="arrow-poster" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
                <path d="M0,0 L8,4 L0,8 z" fill="#6b7280" />
              </marker>
            </defs>
            {(() => {
              const nodes = usersList.map((u, i) => ({ id: u.user_id, name: u.username, idx: i }));
              const n = nodes.length || 1;
              const cx = 500, cy = 200, radius = Math.min(260, 50 + n * 8);
              const positions = {};
              nodes.forEach((nd, i) => {
                const angle = (2 * Math.PI * i) / n - Math.PI / 2;
                positions[nd.id] = { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) };
              });
              const postNodes = postsList.map((p, i) => ({ id: p.post_id, content: p.content, idx: i }));
              const cols = 10;
              const postPositions = {};
              postNodes.forEach((nd, i) => {
                const row = Math.floor(i / cols);
                const col = i % cols;
                postPositions[nd.id] = { x: 50 + col * 80, y: 300 + row * 50 };
              });
              const pathSet = new Set(path);
              // render follow edges (blue solid)
              const followEls = followEdges.map((e, i) => {
                if (!positions[e.from] || !positions[e.to]) return null;
                const from = positions[e.from];
                const to = positions[e.to];
                const highlight = pathSet.has(e.from) && pathSet.has(e.to);
                return (
                  <line key={`f-${i}`} x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                    stroke={highlight ? '#f97316' : '#2563eb'} strokeWidth={highlight ? 3 : 1.8}
                    markerEnd="url(#arrow-follow)" opacity={highlight ? 1 : 0.9} />
                );
              });
              // render poster edges (gray solid)
              const posterEls = posterEdges.map((e, i) => {
                if (!positions[e.from] || !postPositions[e.to]) return null;
                const from = positions[e.from];
                const to = postPositions[e.to];
                return (
                  <line key={`p-${i}`} x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                    stroke="#6b7280" strokeWidth="1.5" markerEnd="url(#arrow-poster)" opacity="0.8" />
                );
              });
              // render like edges (orange dashed)
              const likeEls = likeEdges.map((e, i) => {
                if (!positions[e.from] || !postPositions[e.to]) return null;
                const from = positions[e.from];
                const to = postPositions[e.to];
                return (
                  <line key={`l-${i}`} x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                    stroke="#fb923c" strokeWidth="1.4" strokeDasharray="4 3" markerEnd="url(#arrow-like)" opacity="0.85" />
                );
              });

              // node elements
              const nodeEls = nodes.map((nd) => {
                const pos = positions[nd.id];
                const isHighlighted = pathSet.has(nd.id);
                return (
                  <g key={`n-${nd.id}`}>
                    <circle cx={pos.x} cy={pos.y} r={isHighlighted ? 18 : 14} fill={isHighlighted ? '#f97316' : '#7c3aed'} stroke="#0f172a" strokeWidth={isHighlighted ? 3 : 1} />
                    <text x={pos.x} y={pos.y - 22} fontSize="11" textAnchor="middle" fill="#e2e8f0">{nd.name}</text>
                    <text x={pos.x} y={pos.y + 28} fontSize="11" textAnchor="middle" fill="#94a3b8">#{nd.id}</text>
                    {/* post count badge */}
                    {postsCount[nd.id] ? (
                      <g>
                        <circle cx={pos.x + 18} cy={pos.y - 18} r={10} fill="#06b6d4" />
                        <text x={pos.x + 18} y={pos.y - 14} fontSize="10" textAnchor="middle" fill="#001217">{postsCount[nd.id]}</text>
                      </g>
                    ) : null}
                  </g>
                );
              });

              // post elements
              const postEls = postNodes.map((nd) => {
                const pos = postPositions[nd.id];
                return (
                  <g key={`post-${nd.id}`}>
                    <rect x={pos.x - 10} y={pos.y - 10} width="20" height="20" fill="#10b981" stroke="#0f172a" strokeWidth="1" />
                    <text x={pos.x} y={pos.y + 25} fontSize="10" textAnchor="middle" fill="#e2e8f0">{nd.id}</text>
                  </g>
                );
              });

              return (
                <g>
                  {followEls}
                  {posterEls}
                  {likeEls}
                  {nodeEls}
                  {postEls}
                </g>
              );
            })()}
          </svg>
        </div>
        <p className="text-xs text-slate-400 mt-3">Blue = follow (directed). Gray = poster (to post). Orange dashed = like (to post). Small teal badge = #posts. Green squares = posts. Path nodes are highlighted in orange.</p>
      </div>

      {/* Recommendations */}
      <div className="card">
        <h3 className="card-title mb-4">👥 People You May Know</h3>
        <form onSubmit={getRecs} className="col space-y-3">
          <input
            placeholder="Your User ID"
            value={recUser}
            onChange={e => setRecUser(e.target.value)}
            disabled={loading}
          />
          <button
            type="submit"
            className="btn btn-success w-full"
            disabled={loading || !recUser.trim()}
          >
            {loading ? '⏳ Finding recommendations...' : '🎯 Get Recommendations'}
          </button>
        </form>

        {recs.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-sm text-slate-400">Found {recs.length} recommendation{recs.length !== 1 ? 's' : ''}:</p>
            {recs.map((user, idx) => (
              <div
                key={idx}
                className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-3 hover:border-purple-500/50 transition-all"
              >
                <p className="text-slate-100 font-medium">👤 {user.username} <span className="text-xs text-slate-400">#{user.id}</span></p>
                {/* visualize connection to recommended user */}
                {vizPaths[user] && vizPaths[user].length > 0 ? (
                  <div className="mt-3">
                    <p className="text-xs text-slate-400 mb-2">Connection path:</p>
                    <div className="overflow-auto">
                      <svg width="100%" height="60" viewBox={`0 0 ${Math.max(240, vizPaths[user].length * 100)} 60`}>
                        {vizPaths[user].map((n, i) => {
                          const x = 40 + i * 100;
                          return (
                            <g key={i}>
                              <rect x={x-28} y={10} width={56} height={36} rx={8} fill={i === 0 ? '#06b6d4' : i === vizPaths[user].length - 1 ? '#f97316' : '#6b7280'} />
                              <text x={x} y={34} fontSize="12" textAnchor="middle" fill="#fff">{n}</text>
                              {i < vizPaths[user].length - 1 && (
                                <line x1={x + 28} y1={28} x2={x + 100 - 28} y2={28} stroke="#94a3b8" strokeWidth="2" />
                              )}
                            </g>
                          );
                        })}
                      </svg>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 mt-2">No visible path (might be disconnected)</p>
                )}
              </div>
            ))}
          </div>
        )}

        {!loading && recUser && recs.length === 0 && (
          <div className="mt-4 text-center text-slate-400">
            <p>💭 No recommendations available at this time</p>
          </div>
        )}

        {!recUser && (
          <div className="mt-4 text-center text-slate-400">
            <p>💡 Enter your User ID to get personalized recommendations</p>
          </div>
        )}
      </div>
    </div>
  );
}
 
