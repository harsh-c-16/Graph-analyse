import React from 'react';
import axios from 'axios';

const SURFACE_LINE = '#494454';
const PRIMARY = '#d0bcff';
const SECONDARY = '#5de6ff';
const MUTED = '#958ea0';

const panelClassName =
  'bg-surface-container-low border border-outline-variant rounded-xl p-3 flex flex-col gap-2';

const inputClassName =
  'w-full bg-surface-container border border-outline-variant focus:border-secondary focus:ring-1 focus:ring-secondary rounded px-3 py-1 text-label-mono font-label-mono text-on-surface placeholder:text-on-surface-variant outline-none transition-all disabled:cursor-not-allowed disabled:opacity-50';

const formatNumber = (value) =>
  new Intl.NumberFormat('en-US').format(Number(value ?? 0));

const formatScore = (value, digits = 4) => Number(value ?? 0).toFixed(digits);

const hasAdjacentPathEdge = (path, from, to) =>
  path.some((node, index) => index < path.length - 1 && node === from && path[index + 1] === to);

export default function AnalyticsPage() {
  const [rankingPage, setRankingPage] = React.useState(1);
  const [rankedUsers, setRankedUsers] = React.useState([]);
  const [rankingLoading, setRankingLoading] = React.useState(false);
  const [topPosts, setTopPosts] = React.useState([]);
  const [topPostsLoading, setTopPostsLoading] = React.useState(true);
  const [q, setQ] = React.useState('');
  const [res, setRes] = React.useState([]);
  const [prefix, setPrefix] = React.useState('');
  const [ac, setAc] = React.useState([]);
  const [searching, setSearching] = React.useState(false);
  const [hasSearched, setHasSearched] = React.useState(false);
  const [communities, setCommunities] = React.useState([]);
  const [communitiesLoading, setCommunitiesLoading] = React.useState(true);
  const [communitiesError, setCommunitiesError] = React.useState(null);
  const [expandedCommunity, setExpandedCommunity] = React.useState(null);
  const [u1, setU1] = React.useState('');
  const [u2, setU2] = React.useState('');
  const [path, setPath] = React.useState([]);
  const [pathError, setPathError] = React.useState('');
  const [recUser, setRecUser] = React.useState('');
  const [recs, setRecs] = React.useState([]);
  const [vizPaths, setVizPaths] = React.useState({});
  const [usersList, setUsersList] = React.useState([]);
  const [postsList, setPostsList] = React.useState([]);
  const [followEdges, setFollowEdges] = React.useState([]);
  const [likeEdges, setLikeEdges] = React.useState([]);
  const [posterEdges, setPosterEdges] = React.useState([]);
  const [postsCount, setPostsCount] = React.useState({});
  const [pathLoading, setPathLoading] = React.useState(false);
  const [recsLoading, setRecsLoading] = React.useState(false);
  const [recError, setRecError] = React.useState('');
  const [hasSearchedPath, setHasSearchedPath] = React.useState(false);
  const [hasRequestedRecs, setHasRequestedRecs] = React.useState(false);
  const [graphZoom, setGraphZoom] = React.useState(1);
  const [leaderboardExpanded, setLeaderboardExpanded] = React.useState(false);

  const fetchRankings = React.useCallback(async (page = 1) => {
    setRankingLoading(true);
    try {
      const r = await axios.get(`/users/ranked?page=${page}&limit=10`);
      setRankedUsers(r.data || []);
    } catch (e) {
      setRankedUsers([]);
    }
    setRankingLoading(false);
  }, []);

  React.useEffect(() => {
    fetchRankings(rankingPage);
    const handleGraphUpdated = () => fetchRankings(rankingPage);
    window.addEventListener('graph-updated', handleGraphUpdated);
    return () => window.removeEventListener('graph-updated', handleGraphUpdated);
  }, [fetchRankings, rankingPage]);

  const fetchTopPosts = React.useCallback(async () => {
    setTopPostsLoading(true);
    try {
      const r = await axios.get('/posts/top10');
      setTopPosts(r.data || []);
    } catch (e) {
      setTopPosts([]);
    }
    setTopPostsLoading(false);
  }, []);

  React.useEffect(() => {
    fetchTopPosts();
    const handleGraphUpdated = () => fetchTopPosts();
    window.addEventListener('graph-updated', handleGraphUpdated);
    return () => window.removeEventListener('graph-updated', handleGraphUpdated);
  }, [fetchTopPosts]);

  const fetchCommunities = React.useCallback(async () => {
    try {
      setCommunitiesLoading(true);
      const r = await axios.get('/communities');
      setCommunities(r.data || []);
      setCommunitiesError(null);
    } catch (err) {
      setCommunitiesError('Unable to load communities. Is the backend running?');
      console.error('Error fetching communities:', err);
    } finally {
      setCommunitiesLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchCommunities();
    const handleGraphUpdated = () => fetchCommunities();
    window.addEventListener('graph-updated', handleGraphUpdated);
    return () => window.removeEventListener('graph-updated', handleGraphUpdated);
  }, [fetchCommunities]);

  const fetchGraph = React.useCallback(async () => {
    let fetchedUsers = [];
    let fetchedPosts = [];
    try {
      const ru = await axios.get('/users-list?page=1&limit=1000');
      fetchedUsers = ru.data || [];
      setUsersList(fetchedUsers);
    } catch (err) {
      setUsersList([]);
    }
    try {
      const rp = await axios.get('/posts/all');
      fetchedPosts = rp.data || [];
      setPostsList(fetchedPosts);
      const pc = {};
      for (const p of fetchedPosts) {
        pc[p.user_id] = (pc[p.user_id] || 0) + 1;
      }
      setPostsCount(pc);
    } catch (err) {
      setPostsList([]);
      setPostsCount({});
    }

    try {
      const tasks = fetchedUsers.map(async (u) => {
        const uid = u.user_id;
        const followings = (await axios.get(`/user/followings/${uid}`)).data || [];
        const liked = (await axios.get(`/user/likedposts/${uid}`)).data || [];
        return { uid, followings, liked };
      });
      const results = await Promise.all(tasks);
      const fEdges = [];
      const lEdges = [];
      for (const result of results) {
        for (const to of result.followings) fEdges.push({ from: result.uid, to });
        for (const pid of result.liked) lEdges.push({ from: result.uid, to: pid });
      }
      const pEdges = [];
      for (const p of fetchedPosts) pEdges.push({ from: p.user_id, to: p.post_id });
      setFollowEdges(fEdges);
      setLikeEdges(lEdges);
      setPosterEdges(pEdges);
    } catch (err) {
      setFollowEdges([]);
      setLikeEdges([]);
      setPosterEdges([]);
    }
  }, []);

  React.useEffect(() => {
    fetchGraph();
    const h = () => fetchGraph();
    window.addEventListener('graph-updated', h);
    return () => window.removeEventListener('graph-updated', h);
  }, [fetchGraph]);

  const doSearch = async (e) => {
    e.preventDefault();
    if (!q.trim()) return;
    setSearching(true);
    setHasSearched(true);
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
      const r = await axios.get(`/autocomplete/users?prefix=${encodeURIComponent(val)}`);
      setAc(r.data || []);
    } catch (e) {
      setAc([]);
    }
  };

  const resolveUser = React.useCallback(
    (val) => {
      const trimmed = val.trim();
      if (/^\d+$/.test(trimmed)) return parseInt(trimmed, 10);
      const found = usersList.find(
        (u) => u.username && u.username.toLowerCase() === trimmed.toLowerCase(),
      );
      return found ? found.user_id : null;
    },
    [usersList],
  );

  const findPath = async (e) => {
    e.preventDefault();
    setPathError('');
    if (!u1.trim() || !u2.trim()) return;
    setHasSearchedPath(true);
    setPathLoading(true);
    try {
      const id1 = resolveUser(u1);
      const id2 = resolveUser(u2);
      if (id1 == null || id2 == null) {
        setPath([]);
        setPathError('One or both users not found. Use numeric IDs or exact usernames.');
        setPathLoading(false);
        return;
      }
      const r = await axios.get(`/path?u1=${encodeURIComponent(id1)}&u2=${encodeURIComponent(id2)}`);
      setPath(r.data.path || []);
    } catch (e) {
      setPath([]);
      setPathError('Error fetching path');
    }
    setPathLoading(false);
  };

  const getRecs = async (e) => {
    e.preventDefault();
    if (!recUser.trim()) return;
    setRecError('');
    setHasRequestedRecs(true);
    setRecsLoading(true);
    try {
      const recId = resolveUser(recUser);
      if (recId == null) {
        setRecs([]);
        setVizPaths({});
        setRecError('User for recommendations not found (use ID or exact username)');
        setRecsLoading(false);
        return;
      }
      const r = await axios.get(`/recommendations?u=${encodeURIComponent(recId)}`);
      const recList = r.data || [];
      const recObjs = recList.map((id) => {
        const u = usersList.find((x) => x.user_id === id);
        return { id, username: u ? u.username : String(id) };
      });
      setRecs(recObjs);

      const map = {};
      await Promise.all(
        recList.map(async (rec) => {
          try {
            const pr = await axios.get(
              `/path?u1=${encodeURIComponent(recId)}&u2=${encodeURIComponent(rec)}`,
            );
            map[rec] = pr.data.path || [];
          } catch (err) {
            map[rec] = [];
          }
        }),
      );
      setVizPaths(map);
    } catch (e) {
      setRecs([]);
      setRecError('Error fetching recommendations');
    }
    setRecsLoading(false);
  };

  const toggleCommunity = (communityId) => {
    setExpandedCommunity(expandedCommunity === communityId ? null : communityId);
  };

  const refreshAll = () => {
    fetchRankings(rankingPage);
    fetchTopPosts();
    fetchCommunities();
    fetchGraph();
  };

  const topRankById = React.useMemo(() => {
    const map = {};
    rankedUsers.forEach((user, index) => {
      map[user.user_id] = { ...user, rank: (rankingPage - 1) * 10 + index + 1 };
    });
    return map;
  }, [rankedUsers, rankingPage]);

  const graphLayout = React.useMemo(() => {
    const pinnedUserIds = new Set(path);
    const pinnedUsers = usersList.filter((user) => pinnedUserIds.has(user.user_id));
    const visibleUserMap = new Map();
    [...pinnedUsers, ...usersList].forEach((user) => {
      if (visibleUserMap.size < 24 || pinnedUserIds.has(user.user_id)) {
        visibleUserMap.set(user.user_id, user);
      }
    });
    const visibleUsers = Array.from(visibleUserMap.values()).slice(0, 24);
    const visiblePosts = postsList.slice(0, 28);
    const primaryId = rankedUsers[0]?.user_id ?? visibleUsers[0]?.user_id ?? null;
    const userPositions = {};
    const postPositions = {};

    if (primaryId != null) {
      userPositions[primaryId] = { x: 50, y: 45, primary: true };
    }

    const secondaryUsers = visibleUsers.filter((user) => user.user_id !== primaryId);
    const count = Math.max(secondaryUsers.length, 1);
    secondaryUsers.forEach((user, index) => {
      const angle = (2 * Math.PI * index) / count - Math.PI / 2;
      userPositions[user.user_id] = {
        x: 50 + 32 * Math.cos(angle),
        y: 45 + 26 * Math.sin(angle),
        primary: false,
      };
    });

    visiblePosts.forEach((post, index) => {
      const columns = Math.min(7, Math.max(1, visiblePosts.length));
      const row = Math.floor(index / columns);
      const col = index % columns;
      postPositions[post.post_id] = {
        x: 16 + col * (68 / Math.max(columns - 1, 1)),
        y: 72 + row * 9,
      };
    });

    return { visibleUsers, visiblePosts, userPositions, postPositions, primaryId };
  }, [path, postsList, rankedUsers, usersList]);

  const edgeCount = followEdges.length + likeEdges.length + posterEdges.length;
  const graphNodeCount = usersList.length + postsList.length;
  const displayedRankedUsers = leaderboardExpanded ? rankedUsers : rankedUsers.slice(0, 3);
  const highlightedPathNodes = new Set(path);

  return (
    <div className="min-h-screen w-full bg-background text-on-surface font-body-md">
      <main className="p-3 flex flex-col xl:grid xl:grid-cols-[minmax(0,1fr)_560px] gap-3 bg-background">
        <div className="bg-surface-dim border border-outline-variant rounded-xl overflow-hidden relative flex flex-col shadow-inner h-[560px] xl:sticky xl:top-3">
          <div className="absolute top-panel-padding left-panel-padding z-30 flex flex-wrap gap-2">
            <div className="bg-surface/90 backdrop-blur border border-outline-variant rounded p-1 flex shadow-lg">
              <button
                className="w-8 h-8 flex items-center justify-center rounded hover:bg-surface-container-high text-on-surface-variant hover:text-primary transition-colors"
                title="Zoom In"
                type="button"
                onClick={() => setGraphZoom((zoom) => Math.min(1.5, Number((zoom + 0.1).toFixed(2))))}
              >
                <span className="material-symbols-outlined text-[18px]">zoom_in</span>
              </button>
              <button
                className="w-8 h-8 flex items-center justify-center rounded hover:bg-surface-container-high text-on-surface-variant hover:text-primary transition-colors"
                title="Zoom Out"
                type="button"
                onClick={() => setGraphZoom((zoom) => Math.max(0.7, Number((zoom - 0.1).toFixed(2))))}
              >
                <span className="material-symbols-outlined text-[18px]">zoom_out</span>
              </button>
              <div className="w-[1px] h-4 bg-outline-variant my-auto mx-1" />
              <button
                className="w-8 h-8 flex items-center justify-center rounded hover:bg-surface-container-high text-on-surface-variant hover:text-primary transition-colors"
                title="Center Topology"
                type="button"
                onClick={() => setGraphZoom(1)}
              >
                <span className="material-symbols-outlined text-[18px]">center_focus_strong</span>
              </button>
            </div>
            <div className="bg-surface/90 backdrop-blur border border-outline-variant rounded px-3 py-1 flex items-center shadow-lg font-label-mono text-code-sm text-on-surface-variant">
              <span className="text-primary mr-2">Nodes: {formatNumber(graphNodeCount)}</span>
              <span className="text-secondary">Edges: {formatNumber(edgeCount)}</span>
            </div>
            <button
              className="bg-surface/90 backdrop-blur border border-outline-variant rounded px-3 py-1 flex items-center gap-2 shadow-lg font-label-mono text-code-sm text-on-surface-variant hover:text-secondary hover:border-secondary transition-colors"
              type="button"
              onClick={refreshAll}
            >
              <span className="material-symbols-outlined text-[16px]">sync</span>
              Sync
            </button>
          </div>

          <form
            className="absolute top-panel-padding right-panel-padding z-30 hidden xl:block w-80"
            onSubmit={doSearch}
          >
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px] pointer-events-none">
              search
            </span>
            <input
              className="w-full bg-surface-container border border-outline-variant focus:border-secondary focus:ring-1 focus:ring-secondary focus:shadow-[0_0_8px_theme('colors.secondary-container')] rounded px-10 py-1.5 text-body-sm font-body-sm text-on-surface placeholder:text-on-surface-variant outline-none transition-all"
              placeholder="Search post content..."
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <button className="sr-only" type="submit" disabled={searching || !q.trim()}>
              Search
            </button>
          </form>

          <div className="absolute inset-0 grid-bg opacity-40" />
          <div
            className="absolute inset-0 transition-transform duration-200"
            style={{ transform: `scale(${graphZoom})`, transformOrigin: 'center' }}
          >
            <svg className="absolute inset-0 w-full h-full pointer-events-none">
              <defs>
                <marker id="analytics-arrow-follow" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
                  <path d="M0,0 L10,5 L0,10 z" fill={PRIMARY} />
                </marker>
                <marker id="analytics-arrow-post" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
                  <path d="M0,0 L8,4 L0,8 z" fill={MUTED} />
                </marker>
                <marker id="analytics-arrow-like" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
                  <path d="M0,0 L8,4 L0,8 z" fill={SECONDARY} />
                </marker>
              </defs>
              {followEdges.map((edge, index) => {
                const from = graphLayout.userPositions[edge.from];
                const to = graphLayout.userPositions[edge.to];
                if (!from || !to) return null;
                const highlighted = hasAdjacentPathEdge(path, edge.from, edge.to);
                return (
                  <line
                    key={`follow-${edge.from}-${edge.to}-${index}`}
                    markerEnd="url(#analytics-arrow-follow)"
                    opacity={highlighted ? 1 : 0.55}
                    stroke={highlighted ? SECONDARY : SURFACE_LINE}
                    strokeDasharray={highlighted ? '4 4' : undefined}
                    strokeWidth={highlighted ? 2.5 : 1.5}
                    x1={`${from.x}%`}
                    x2={`${to.x}%`}
                    y1={`${from.y}%`}
                    y2={`${to.y}%`}
                  />
                );
              })}
              {posterEdges.map((edge, index) => {
                const from = graphLayout.userPositions[edge.from];
                const to = graphLayout.postPositions[edge.to];
                if (!from || !to) return null;
                return (
                  <line
                    key={`poster-${edge.from}-${edge.to}-${index}`}
                    markerEnd="url(#analytics-arrow-post)"
                    opacity="0.38"
                    stroke={SURFACE_LINE}
                    strokeWidth="1.2"
                    x1={`${from.x}%`}
                    x2={`${to.x}%`}
                    y1={`${from.y}%`}
                    y2={`${to.y}%`}
                  />
                );
              })}
              {likeEdges.map((edge, index) => {
                const from = graphLayout.userPositions[edge.from];
                const to = graphLayout.postPositions[edge.to];
                if (!from || !to) return null;
                return (
                  <line
                    key={`like-${edge.from}-${edge.to}-${index}`}
                    markerEnd="url(#analytics-arrow-like)"
                    opacity="0.72"
                    stroke={SECONDARY}
                    strokeDasharray="4 3"
                    strokeWidth="1.4"
                    x1={`${from.x}%`}
                    x2={`${to.x}%`}
                    y1={`${from.y}%`}
                    y2={`${to.y}%`}
                  />
                );
              })}
            </svg>

            <div className="absolute inset-0">
              {graphLayout.visibleUsers.map((user) => {
                const pos = graphLayout.userPositions[user.user_id];
                if (!pos) return null;
                const ranked = topRankById[user.user_id];
                const isHighlighted = highlightedPathNodes.has(user.user_id);
                if (pos.primary) {
                  return (
                    <div
                      className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1.5 cursor-pointer group z-20"
                      key={user.user_id}
                      style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                    >
                      <div className="w-14 h-14 rounded-full bg-primary-container border-2 border-primary flex items-center justify-center shadow-[0_0_24px_theme('colors.primary')_inset] group-hover:scale-110 transition-transform relative">
                        <span
                          className="material-symbols-outlined text-on-primary-container text-[28px] z-10"
                          style={{ fontVariationSettings: "'FILL' 1" }}
                        >
                          person
                        </span>
                        <div className="absolute inset-0 rounded-full bg-primary opacity-30 blur-md -z-10 group-hover:opacity-50 transition-opacity" />
                      </div>
                      <div className="bg-surface border border-primary px-2 py-1 rounded shadow-lg flex flex-col items-center max-w-[150px]">
                        <span className="font-label-mono text-code-sm text-primary font-bold truncate">
                          U-{user.user_id}
                        </span>
                        <span className="font-label-mono text-[10px] text-on-surface-variant truncate">
                          {user.username}
                          {ranked ? ` / PR: ${formatScore(ranked.score, 3)}` : ''}
                        </span>
                      </div>
                    </div>
                  );
                }
                return (
                  <div
                    className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1 cursor-pointer group z-10"
                    key={user.user_id}
                    style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                  >
                    <div
                      className={`w-10 h-10 rounded-full border flex items-center justify-center group-hover:bg-primary/20 transition-colors ${
                        isHighlighted
                          ? 'bg-secondary/10 border-2 border-secondary text-secondary shadow-[0_0_12px_theme("colors.secondary")_inset]'
                          : 'bg-surface-container border-primary text-primary shadow-[0_0_8px_theme("colors.primary")_inset]'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[20px]">person</span>
                    </div>
                    <span className="font-label-mono text-[11px] text-on-surface-variant bg-surface/80 px-1.5 py-0.5 rounded border border-outline-variant max-w-[120px] truncate">
                      {user.username || `U-${user.user_id}`}
                    </span>
                  </div>
                );
              })}

              {graphLayout.visiblePosts.map((post) => {
                const pos = graphLayout.postPositions[post.post_id];
                if (!pos) return null;
                return (
                  <div
                    className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1 cursor-pointer group z-10"
                    key={post.post_id}
                    style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                  >
                    <div className="w-9 h-9 rounded bg-surface-container border border-secondary text-secondary flex items-center justify-center group-hover:bg-secondary/20 group-hover:shadow-[0_0_12px_theme('colors.secondary')] transition-all">
                      <span className="material-symbols-outlined text-[18px]">description</span>
                    </div>
                    <span className="font-label-mono text-[11px] text-secondary bg-surface/80 px-1.5 py-0.5 rounded border border-outline-variant">
                      P-{post.post_id}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {graphNodeCount === 0 && (
            <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
              <div className="bg-surface/90 border border-outline-variant rounded-xl p-4 text-center">
                <p className="font-label-mono text-label-mono text-on-surface-variant">
                  Graph topology is empty or backend data is unavailable.
                </p>
              </div>
            </div>
          )}
        </div>

        <aside className="w-full flex flex-col gap-3">
          <div className="bg-surface-container-low border border-outline-variant rounded-xl p-3 flex flex-col gap-2 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-secondary opacity-5 blur-[50px] pointer-events-none" />
            <div className="flex items-center gap-2 border-b border-outline-variant pb-2">
              <span className="material-symbols-outlined text-secondary text-[20px]">route</span>
              <h2 className="font-headline-md text-body-md font-semibold text-on-surface">
                Pathfinder (BFS)
              </h2>
            </div>
            <form className="flex flex-col gap-2" onSubmit={findPath}>
              <div className="flex items-center gap-2">
                <label className="w-8 font-label-mono text-code-sm text-on-surface-variant text-right" htmlFor="path-src">
                  SRC
                </label>
                <div className="flex-1 relative">
                  <span className="material-symbols-outlined absolute left-2 top-1/2 -translate-y-1/2 text-primary text-[16px]">
                    person
                  </span>
                  <input
                    className="w-full bg-surface-container border border-outline-variant focus:border-primary focus:ring-1 focus:ring-primary rounded pl-8 pr-2 py-1 text-label-mono font-label-mono text-on-surface outline-none transition-all disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={pathLoading}
                    id="path-src"
                    placeholder="User ID or username"
                    type="text"
                    value={u1}
                    onChange={(e) => setU1(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <label className="w-8 font-label-mono text-code-sm text-on-surface-variant text-right" htmlFor="path-tgt">
                  TGT
                </label>
                <div className="flex-1 relative">
                  <span className="material-symbols-outlined absolute left-2 top-1/2 -translate-y-1/2 text-secondary text-[16px]">
                    person_search
                  </span>
                  <input
                    className="w-full bg-surface-container border border-outline-variant focus:border-secondary focus:ring-1 focus:ring-secondary rounded pl-8 pr-2 py-1 text-label-mono font-label-mono text-on-surface outline-none transition-all disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={pathLoading}
                    id="path-tgt"
                    placeholder="User ID or username"
                    type="text"
                    value={u2}
                    onChange={(e) => setU2(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  className="flex-1 bg-surface-container-high border border-outline-variant hover:border-secondary hover:text-secondary text-on-surface font-label-mono text-label-mono py-1.5 rounded transition-colors flex items-center justify-center gap-2"
                  type="button"
                  onClick={() => {
                    setPath([]);
                    setVizPaths({});
                    setPathError('');
                  }}
                >
                  <span className="material-symbols-outlined text-[16px]">restart_alt</span>
                  Reset
                </button>
                <button
                  className="flex-1 bg-primary hover:bg-primary-fixed text-on-primary font-label-mono text-label-mono py-1.5 rounded transition-all shadow-[0_0_12px_theme('colors.primary')_inset] font-bold disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={pathLoading || !u1.trim() || !u2.trim()}
                  type="submit"
                >
                  {pathLoading ? 'Running' : 'Execute Path'}
                </button>
              </div>
              <div className="bg-surface border border-outline-variant rounded p-2 flex items-center justify-between">
                <span className="font-label-mono text-code-sm text-on-surface-variant">
                  Hops: <strong className="text-secondary">{path.length ? path.length - 1 : 0}</strong>
                </span>
                <span className="font-label-mono text-code-sm text-on-surface-variant">
                  Path: <strong className="text-secondary">{path.length ? path.length : 0}</strong>
                </span>
                <span className="font-label-mono text-code-sm text-on-surface-variant">
                  Users: <strong className="text-on-surface">{formatNumber(usersList.length)}</strong>
                </span>
              </div>
            </form>
            {path.length > 0 && (
              <div className="bg-surface border border-outline-variant rounded p-2">
                <p className="font-label-mono text-code-sm text-on-surface-variant mb-2">Resolved path</p>
                <div className="flex items-center gap-1 flex-wrap">
                  {path.map((user, index) => (
                    <React.Fragment key={`${user}-${index}`}>
                      <span className="font-label-mono text-code-sm bg-secondary-container/10 text-secondary border border-secondary/20 rounded px-2 py-0.5">
                        {user}
                      </span>
                      {index < path.length - 1 && (
                        <span className="material-symbols-outlined text-secondary text-[14px]">
                          arrow_forward
                        </span>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            )}
            {!pathLoading && hasSearchedPath && !pathError && u1 && u2 && path.length === 0 && (
              <p className="font-label-mono text-code-sm text-on-surface-variant">
                No connection found between these users.
              </p>
            )}
            {pathError && <p className="font-label-mono text-code-sm text-error">{pathError}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className={panelClassName}>
            <div className="flex items-center gap-2 border-b border-outline-variant pb-2">
              <span className="material-symbols-outlined text-secondary text-[20px]">terminal</span>
              <h2 className="font-headline-md text-body-md font-semibold text-on-surface">
                Query Console
              </h2>
            </div>
            <form className="flex flex-col gap-2" onSubmit={doSearch}>
              <input
                className={inputClassName}
                placeholder="Search keywords in posts"
                type="text"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <button
                className="bg-primary hover:bg-primary-fixed text-on-primary font-label-mono text-label-mono py-2 rounded transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                disabled={searching || !q.trim()}
                type="submit"
              >
                {searching ? 'Searching' : 'Search Posts'}
              </button>
            </form>
            {res.length > 0 && (
              <div className="flex flex-col gap-2 max-h-60 overflow-y-auto pr-0.5">
                <p className="font-label-mono text-code-sm text-on-surface-variant">
                  Results: {res.length}
                </p>
                {res.slice(0, 2).map((post) => (
                  <div
                    className="bg-surface-container border border-outline-variant rounded p-2 hover:border-secondary transition-colors"
                    key={post.post_id}
                  >
                    <p className="font-body-sm text-body-sm text-on-surface line-clamp-2">{post.content}</p>
                    <p className="font-label-mono text-[10px] text-on-surface-variant mt-1">
                      Post {post.post_id} by user {post.user_id}
                    </p>
                  </div>
                ))}
              </div>
            )}
            {!searching && hasSearched && q && res.length === 0 && (
              <p className="font-label-mono text-code-sm text-on-surface-variant">
                No posts found matching "{q}".
              </p>
            )}
            <div className="border-t border-outline-variant pt-3">
              <input
                className={inputClassName}
                placeholder="Autocomplete username"
                type="text"
                value={prefix}
                onChange={(e) => doAc(e.target.value)}
              />
              {ac.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2 max-h-40 overflow-y-auto pr-0.5">
                  {ac.map((user, index) => (
                    <button
                      className="px-2.5 py-1.5 bg-surface-container border border-outline-variant rounded flex items-center gap-2 hover:border-primary cursor-pointer transition-colors shadow-sm"
                      key={`${user}-${index}`}
                      type="button"
                      onClick={() => setPrefix(user)}
                    >
                      <span className="w-2.5 h-2.5 rounded-full bg-primary shadow-[0_0_4px_theme('colors.primary')]" />
                      <span className="font-label-mono text-[11px] text-on-surface leading-none">{user}</span>
                    </button>
                  ))}
                </div>
              )}
              {prefix && ac.length === 0 && (
                <p className="font-label-mono text-code-sm text-on-surface-variant mt-2">
                  No users matching "{prefix}".
                </p>
              )}
            </div>
          </div>

          <div className={panelClassName}>
            <div className="flex items-center justify-between border-b border-outline-variant pb-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">
                  social_leaderboard
                </span>
                <h2 className="font-headline-md text-body-md font-semibold text-on-surface">
                  PageRank Authority
                </h2>
              </div>
              <span className="font-label-mono text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded border border-primary/20">
                {rankingLoading ? 'SYNC' : 'LIVE'}
              </span>
            </div>
            <div className="flex flex-col gap-1 max-h-80 overflow-y-auto pr-0.5">
              {rankingLoading || displayedRankedUsers.length === 0 ? (
                <p className="font-label-mono text-code-sm text-on-surface-variant p-2">
                  {rankingLoading ? 'Loading rankings...' : 'No rankings available.'}
                </p>
              ) : (
                displayedRankedUsers.map((user, index) => {
                  const rank = (rankingPage - 1) * 10 + index + 1;
                  const isFirst = rankingPage === 1 && index === 0;
                  return (
                    <div
                      className={`flex items-center justify-between p-2 rounded relative overflow-hidden group ${
                        isFirst
                          ? 'bg-surface-container border border-outline-variant'
                          : 'hover:bg-surface-container transition-colors cursor-pointer'
                      }`}
                      key={user.user_id}
                    >
                      {isFirst && <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />}
                      <div className={`flex items-center gap-3 ${isFirst ? 'pl-2' : 'pl-3 border-l-2 border-transparent group-hover:border-outline-variant'}`}>
                        <div className={`font-label-mono text-label-mono font-bold w-4 text-center ${isFirst ? 'text-primary' : 'text-on-surface-variant'}`}>
                          {rank}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-body-sm font-body-sm text-on-surface truncate">
                            {user.username}
                          </span>
                          <span className="font-label-mono text-[10px] text-on-surface-variant">
                            Followers: {formatNumber(user.followers ?? 0)} / Posts: {formatNumber(user.posts ?? 0)}
                          </span>
                        </div>
                      </div>
                      <span className={`font-label-mono text-code-sm px-2 py-1 rounded ${isFirst ? 'text-primary bg-primary/10' : 'text-on-surface-variant'}`}>
                        {formatScore(user.score)}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
            <div className="flex items-center justify-between gap-2 mt-1">
              <button
                className="text-primary font-label-mono text-code-sm hover:underline text-left disabled:opacity-40 disabled:no-underline"
                disabled={rankingPage === 1 || rankingLoading}
                type="button"
                onClick={() => setRankingPage((page) => Math.max(1, page - 1))}
              >
                Previous
              </button>
              <button
                className="text-on-surface-variant font-label-mono text-code-sm hover:text-primary transition-colors"
                type="button"
                onClick={() => setLeaderboardExpanded((value) => !value)}
              >
                Page {rankingPage} / {leaderboardExpanded ? 'Compact' : 'Expand'}
              </button>
              <button
                className="text-primary font-label-mono text-code-sm hover:underline text-right disabled:opacity-40 disabled:no-underline"
                disabled={rankingLoading || rankedUsers.length < 10}
                type="button"
                onClick={() => setRankingPage((page) => page + 1)}
              >
                Next
              </button>
            </div>
          </div>

          <div className={panelClassName}>
            <div className="flex items-center gap-2 border-b border-outline-variant pb-2">
              <span className="material-symbols-outlined text-tertiary text-[20px]">bubble_chart</span>
              <h2 className="font-headline-md text-body-md font-semibold text-on-surface">
                Detected Clusters
              </h2>
            </div>
            {communitiesLoading ? (
              <p className="font-label-mono text-code-sm text-on-surface-variant">Loading clusters...</p>
            ) : communitiesError ? (
              <div className="font-label-mono text-code-sm text-error">
                <p>Error loading communities: {communitiesError}</p>
                <button className="text-secondary hover:underline mt-2" type="button" onClick={fetchCommunities}>
                  Try again
                </button>
              </div>
            ) : communities.length === 0 ? (
              <p className="font-label-mono text-code-sm text-on-surface-variant">
                No communities found. Add follows to form clusters.
              </p>
            ) : (
              <>
                <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto pr-0.5">
                  {communities.map((community, index) => {
                    const accent = index % 3 === 0 ? 'primary' : index % 3 === 1 ? 'secondary' : 'tertiary';
                    const dotClassName =
                      accent === 'primary'
                        ? "w-2.5 h-2.5 rounded-full bg-primary shadow-[0_0_4px_theme('colors.primary')]"
                        : accent === 'secondary'
                          ? "w-2.5 h-2.5 rounded-full bg-secondary shadow-[0_0_4px_theme('colors.secondary')]"
                          : "w-2.5 h-2.5 rounded-full bg-tertiary shadow-[0_0_4px_theme('colors.tertiary')]";
                    const hoverClassName =
                      accent === 'primary'
                        ? 'hover:border-primary'
                        : accent === 'secondary'
                          ? 'hover:border-secondary'
                          : 'hover:border-tertiary';
                    return (
                      <button
                        className={`px-2.5 py-1.5 bg-surface-container border border-outline-variant rounded flex items-center gap-2 ${hoverClassName} cursor-pointer transition-colors shadow-sm`}
                        key={community.community_id}
                        type="button"
                        onClick={() => toggleCommunity(community.community_id)}
                      >
                        <span className={dotClassName} />
                        <span className="flex flex-col text-left">
                          <span className="font-label-mono text-[11px] text-on-surface leading-none">
                            C-{community.community_id}
                          </span>
                          <span className="font-label-mono text-[9px] text-on-surface-variant">
                            {formatNumber(community.members.length)} nodes
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
                {expandedCommunity != null && (
                  <div className="bg-surface border border-outline-variant rounded p-2">
                    <p className="font-label-mono text-code-sm text-on-surface-variant mb-2">
                      Members of C-{expandedCommunity}
                    </p>
                    <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto pr-0.5">
                      {(communities.find((community) => community.community_id === expandedCommunity)?.members || []).map(
                        (userId) => (
                          <span
                            className="font-label-mono text-code-sm bg-surface-container-high border border-outline-variant text-on-surface rounded px-2 py-1"
                            key={userId}
                          >
                            {userId}
                          </span>
                        ),
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <div className={panelClassName}>
            <div className="flex items-center gap-2 border-b border-outline-variant pb-2">
              <span className="material-symbols-outlined text-secondary text-[20px]">trending_up</span>
              <h2 className="font-headline-md text-body-md font-semibold text-on-surface">
                High-Velocity Assets
              </h2>
            </div>
            <div className="flex flex-col gap-2 max-h-60 overflow-y-auto pr-0.5">
              {topPostsLoading || topPosts.length === 0 ? (
                <p className="font-label-mono text-code-sm text-on-surface-variant">
                  {topPostsLoading ? 'Loading top posts...' : 'No posts available.'}
                </p>
              ) : (
                topPosts.map((post, index) => (
                  <div className="flex items-center justify-between group cursor-pointer gap-3" key={post.post_id}>
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-4 h-4 rounded-sm bg-secondary/20 border border-secondary flex items-center justify-center text-secondary shrink-0">
                        <span className="material-symbols-outlined text-[10px]">description</span>
                      </div>
                      <span className="font-label-mono text-code-sm text-on-surface group-hover:text-secondary transition-colors truncate">
                        P-{post.post_id}
                      </span>
                    </div>
                    <span className="font-label-mono text-[10px] text-error flex items-center gap-0.5 shrink-0">
                      <span className="material-symbols-outlined text-[10px]">arrow_upward</span>
                      {formatScore(post.score, 3)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          </div>{/* end 2-col grid */}

          <div className={panelClassName}>
            <div className="flex items-center gap-2 border-b border-outline-variant pb-2">
              <span className="material-symbols-outlined text-primary text-[20px]">person_search</span>
              <h2 className="font-headline-md text-body-md font-semibold text-on-surface">
                Recommendations
              </h2>
            </div>
            <form className="flex flex-col gap-2" onSubmit={getRecs}>
              <input
                className={inputClassName}
                disabled={recsLoading}
                placeholder="User ID or username"
                type="text"
                value={recUser}
                onChange={(e) => setRecUser(e.target.value)}
              />
              <button
                className="border border-secondary text-secondary hover:bg-secondary/10 font-label-mono text-label-mono py-2 rounded transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                disabled={recsLoading || !recUser.trim()}
                type="submit"
              >
                {recsLoading ? 'Resolving' : 'Get Recommendations'}
              </button>
            </form>
            {recs.length > 0 && (
              <div className="flex flex-col gap-2 max-h-60 overflow-y-auto pr-0.5">
                {recs.map((user) => (
                  <div
                    className="bg-surface-container border border-outline-variant rounded p-2 hover:border-primary transition-colors"
                    key={user.id}
                  >
                    <p className="font-label-mono text-code-sm text-on-surface">
                      {user.username} <span className="text-on-surface-variant">#{user.id}</span>
                    </p>
                    {vizPaths[user.id] && vizPaths[user.id].length > 0 ? (
                      <p className="font-label-mono text-[10px] text-on-surface-variant mt-1">
                        Path: {vizPaths[user.id].join(' -> ')}
                      </p>
                    ) : (
                      <p className="font-label-mono text-[10px] text-on-surface-variant mt-1">
                        No visible path returned.
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
            {recError && <p className="font-label-mono text-code-sm text-error">{recError}</p>}
            {!recsLoading && hasRequestedRecs && !recError && recUser && recs.length === 0 && (
              <p className="font-label-mono text-code-sm text-on-surface-variant">
                No recommendations available at this time.
              </p>
            )}
            {!recUser && (
              <p className="font-label-mono text-code-sm text-on-surface-variant">
                Enter a user to compute friend recommendations.
              </p>
            )}
          </div>
        </aside>
      </main>
    </div>
  );
}
