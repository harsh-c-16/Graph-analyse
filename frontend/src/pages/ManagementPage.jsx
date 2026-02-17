import React from 'react';
import axios from 'axios';

const fieldClassName =
  "w-full bg-surface-container-low border border-outline-variant rounded p-2 text-on-surface font-code-sm focus:border-secondary focus:ring-1 focus:ring-secondary focus:shadow-[0_0_8px_theme('colors.secondary')] outline-none transition-all placeholder:text-on-surface-variant/50 disabled:cursor-not-allowed disabled:opacity-50";

const secondaryFieldClassName =
  "w-full bg-surface-container-low border border-outline-variant rounded p-2 text-secondary font-code-sm focus:border-secondary focus:ring-1 focus:ring-secondary outline-none transition-all placeholder:text-on-surface-variant/50 disabled:cursor-not-allowed disabled:opacity-50";

const panelClassName =
  'bg-surface border border-outline-variant rounded-lg p-panel-padding shadow-sm';

const formatNumber = (value) =>
  new Intl.NumberFormat('en-US').format(Number(value ?? 0));

const formatScore = (value) => Number(value ?? 0).toFixed(6);

const scoreBadgeClassName = (value) => {
  const score = Number(value ?? 0);
  if (score >= 0.8) {
    return "inline-flex items-center px-2 py-0.5 rounded text-[11px] font-code-sm bg-primary-container/20 text-primary border border-primary/30 shadow-[0_0_8px_theme('colors.primary')_inset]";
  }
  if (score >= 0.4) {
    return 'inline-flex items-center px-2 py-0.5 rounded text-[11px] font-code-sm bg-secondary-container/20 text-secondary border border-secondary/30';
  }
  return 'inline-flex items-center px-2 py-0.5 rounded text-[11px] font-code-sm bg-surface-variant text-on-surface border border-outline-variant';
};

export default function ManagementPage() {
  const [username, setUsername] = React.useState('');
  const [postUser, setPostUser] = React.useState('');
  const [postContent, setPostContent] = React.useState('');
  const [intUser, setIntUser] = React.useState('');
  const [intTarget, setIntTarget] = React.useState('');
  const [intType, setIntType] = React.useState('like');
  const [message, setMessage] = React.useState('');
  const [running, setRunning] = React.useState(false);
  const [users, setUsers] = React.useState([]);
  const [usersLoading, setUsersLoading] = React.useState(true);
  const [posts, setPosts] = React.useState([]);
  const [postsLoading, setPostsLoading] = React.useState(true);
  const [directoryError, setDirectoryError] = React.useState('');

  const fetchUsers = React.useCallback(async () => {
    setUsersLoading(true);
    try {
      const r = await axios.get('/users-list?page=1&limit=50');
      setUsers(r.data || []);
      setDirectoryError('');
    } catch (err) {
      setUsers([]);
      setDirectoryError('Unable to sync user directory.');
    }
    setUsersLoading(false);
  }, []);

  const fetchPosts = React.useCallback(async () => {
    setPostsLoading(true);
    try {
      const r = await axios.get('/posts/all');
      setPosts(r.data || []);
      setDirectoryError('');
    } catch (err) {
      setPosts([]);
      setDirectoryError('Unable to sync post directory.');
    }
    setPostsLoading(false);
  }, []);

  React.useEffect(() => {
    fetchUsers();
    const handleGraphUpdated = () => fetchUsers();
    window.addEventListener('graph-updated', handleGraphUpdated);
    return () => window.removeEventListener('graph-updated', handleGraphUpdated);
  }, [fetchUsers]);

  React.useEffect(() => {
    fetchPosts();
    const handleGraphUpdated = () => fetchPosts();
    window.addEventListener('graph-updated', handleGraphUpdated);
    return () => window.removeEventListener('graph-updated', handleGraphUpdated);
  }, [fetchPosts]);

  const addUser = async (e) => {
    e.preventDefault();
    setRunning(true);
    try {
      await axios.post('/user', `username=${encodeURIComponent(username)}`, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      setMessage('User created successfully.');
      setUsername('');
      try {
        window.dispatchEvent(new Event('graph-updated'));
      } catch (_) {}
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage('Error creating user.');
    }
    setRunning(false);
  };

  const addPost = async (e) => {
    e.preventDefault();
    setRunning(true);
    try {
      const uid = Number(postUser);
      if (!Number.isInteger(uid) || uid <= 0) throw new Error('Invalid user id');
      const body = `user_id=${encodeURIComponent(String(uid))}&content=${encodeURIComponent(postContent)}`;
      await axios.post('/post', body, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      setMessage('Post created successfully.');
      setPostUser('');
      setPostContent('');
      try {
        window.dispatchEvent(new Event('graph-updated'));
      } catch (_) {}
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage('Error creating post.');
    }
    setRunning(false);
  };

  const addInteraction = async (e) => {
    e.preventDefault();
    setRunning(true);
    try {
      const uid = Number(intUser);
      const tid = Number(intTarget);
      if (!Number.isInteger(uid) || uid <= 0 || !Number.isInteger(tid) || tid <= 0) {
        throw new Error('Invalid user id');
      }
      const body = `user_id=${encodeURIComponent(String(uid))}&target_id=${encodeURIComponent(String(tid))}&type=${encodeURIComponent(intType)}`;
      await axios.post('/interaction', body, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      setMessage(`${intType.charAt(0).toUpperCase() + intType.slice(1)} added successfully.`);
      setIntUser('');
      setIntTarget('');
      try {
        window.dispatchEvent(new Event('graph-updated'));
      } catch (_) {}
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage('Error adding interaction.');
    }
    setRunning(false);
  };

  const deleteUser = async (user) => {
    if (
      !window.confirm(
        `Remove user ${user.user_id} (${user.username})? This will delete their posts and interactions.`,
      )
    ) {
      return;
    }
    try {
      await axios.post('/user/delete', `user_id=${encodeURIComponent(String(user.user_id))}`, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      fetchUsers();
      try {
        window.dispatchEvent(new Event('graph-updated'));
      } catch (_) {}
    } catch (err) {
      window.alert('Error removing user');
    }
  };

  const deletePost = async (post) => {
    if (!window.confirm(`Remove post ${post.post_id} by user ${post.user_id}?`)) return;
    try {
      await axios.post('/post/delete', `post_id=${encodeURIComponent(String(post.post_id))}`, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      fetchPosts();
      try {
        window.dispatchEvent(new Event('graph-updated'));
      } catch (_) {}
    } catch (err) {
      window.alert('Error removing post');
    }
  };

  const refreshDirectories = () => {
    fetchUsers();
    fetchPosts();
  };

  const postsByUser = React.useMemo(
    () =>
      posts.reduce((counts, post) => {
        counts[post.user_id] = (counts[post.user_id] || 0) + 1;
        return counts;
      }, {}),
    [posts],
  );

  const isMessageError = message.startsWith('Error');
  const syncing = usersLoading || postsLoading;

  return (
    <div className="min-h-screen w-full bg-background text-on-background font-body-md antialiased">
      <main className="p-gutter">
        <div className="max-w-[1600px] mx-auto">
          <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between shrink-0">
            <div>
              <h2 className="font-headline-md text-headline-md text-on-surface mb-1">
                Entity Management Control
              </h2>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Direct mutation access to underlying graph structures and telemetry.
              </p>
            </div>
            <button
              className="self-start border border-secondary text-secondary hover:bg-secondary/10 font-label-mono text-label-mono px-4 py-2 rounded transition-colors flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
              onClick={refreshDirectories}
              disabled={syncing}
            >
              <span className="material-symbols-outlined text-[18px]">sync</span>
              {syncing ? 'Syncing' : 'Refresh Index'}
            </button>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-gutter items-start">
            <div className="flex flex-col gap-3">
              <div className={panelClassName}>
                <h3 className="font-body-md text-body-md font-semibold text-primary border-b border-outline-variant pb-2 mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[20px]">person_add</span>
                  Create User
                </h3>
                <form className="flex flex-col gap-4" onSubmit={addUser}>
                  <div>
                    <label
                      className="block font-label-mono text-label-mono text-on-surface-variant mb-1"
                      htmlFor="management-username"
                    >
                      Username
                    </label>
                    <input
                      id="management-username"
                      className={fieldClassName}
                      placeholder="e.g. sys_admin_01"
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      disabled={running}
                      required
                    />
                  </div>
                  <button
                    className="mt-2 w-full bg-primary hover:bg-primary-fixed text-on-primary font-label-mono text-label-mono py-2 rounded transition-colors flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
                    type="submit"
                    disabled={running || !username}
                  >
                    <span className="material-symbols-outlined text-[18px]">add</span>
                    {running ? 'Creating' : 'Inject Node'}
                  </button>
                </form>
              </div>

              <div className={panelClassName}>
                <h3 className="font-body-md text-body-md font-semibold text-primary border-b border-outline-variant pb-2 mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[20px]">edit_document</span>
                  Write Post
                </h3>
                <form className="flex flex-col gap-4" onSubmit={addPost}>
                  <div>
                    <label
                      className="block font-label-mono text-label-mono text-on-surface-variant mb-1"
                      htmlFor="management-post-author"
                    >
                      Author ID
                    </label>
                    <input
                      id="management-post-author"
                      className={secondaryFieldClassName}
                      placeholder="Numeric user id"
                      type="text"
                      value={postUser}
                      onChange={(e) => setPostUser(e.target.value)}
                      disabled={running}
                      required
                    />
                  </div>
                  <div>
                    <label
                      className="block font-label-mono text-label-mono text-on-surface-variant mb-1"
                      htmlFor="management-post-content"
                    >
                      Payload / Content
                    </label>
                    <textarea
                      id="management-post-content"
                      className="w-full bg-surface-container-low border border-outline-variant rounded p-2 text-on-surface font-body-sm focus:border-secondary focus:ring-1 focus:ring-secondary outline-none transition-all resize-none placeholder:text-on-surface-variant/50 disabled:cursor-not-allowed disabled:opacity-50"
                      placeholder="Enter raw text data..."
                      rows="3"
                      value={postContent}
                      onChange={(e) => setPostContent(e.target.value)}
                      disabled={running}
                      required
                    />
                  </div>
                  <button
                    className="mt-2 w-full border border-secondary text-secondary hover:bg-secondary/10 font-label-mono text-label-mono py-2 rounded transition-colors flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
                    type="submit"
                    disabled={running || !postUser || !postContent}
                  >
                    <span className="material-symbols-outlined text-[18px]">publish</span>
                    {running ? 'Publishing' : 'Publish Content'}
                  </button>
                </form>
              </div>

              <div className={panelClassName}>
                <h3 className="font-body-md text-body-md font-semibold text-primary border-b border-outline-variant pb-2 mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[20px]">link</span>
                  Add Interaction
                </h3>
                <form className="flex flex-col gap-4" onSubmit={addInteraction}>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label
                        className="block font-label-mono text-label-mono text-on-surface-variant mb-1"
                        htmlFor="management-interaction-source"
                      >
                        Source ID
                      </label>
                      <input
                        id="management-interaction-source"
                        className={secondaryFieldClassName}
                        type="text"
                        value={intUser}
                        onChange={(e) => setIntUser(e.target.value)}
                        disabled={running}
                        required
                      />
                    </div>
                    <div>
                      <label
                        className="block font-label-mono text-label-mono text-on-surface-variant mb-1"
                        htmlFor="management-interaction-target"
                      >
                        Target ID
                      </label>
                      <input
                        id="management-interaction-target"
                        className={secondaryFieldClassName}
                        placeholder={intType === 'follow' ? 'User id' : 'Post id'}
                        type="text"
                        value={intTarget}
                        onChange={(e) => setIntTarget(e.target.value)}
                        disabled={running}
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label
                      className="block font-label-mono text-label-mono text-on-surface-variant mb-1"
                      htmlFor="management-interaction-type"
                    >
                      Edge Type
                    </label>
                    <select
                      id="management-interaction-type"
                      className="w-full bg-surface-container-low border border-outline-variant rounded p-2 text-on-surface font-code-sm focus:border-secondary focus:ring-1 focus:ring-secondary outline-none transition-all appearance-none disabled:cursor-not-allowed disabled:opacity-50"
                      value={intType}
                      onChange={(e) => setIntType(e.target.value)}
                      disabled={running}
                    >
                      <option value="like">LIKE_POST</option>
                      <option value="view">VIEW_POST</option>
                      <option value="follow">FOLLOW_USER</option>
                    </select>
                  </div>
                  <button
                    className="mt-2 w-full border border-secondary text-secondary hover:bg-secondary/10 font-label-mono text-label-mono py-2 rounded transition-colors flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
                    type="submit"
                    disabled={running || !intUser || !intTarget}
                  >
                    <span className="material-symbols-outlined text-[18px]">account_tree</span>
                    {running ? 'Creating' : 'Create Edge'}
                  </button>
                </form>
              </div>

              {(message || directoryError) && (
                <div
                  className={`${panelClassName} ${
                    isMessageError || directoryError
                      ? 'border-error/30 bg-error-container/10'
                      : 'border-secondary/30 bg-secondary-container/10'
                  }`}
                >
                  <p
                    className={`font-label-mono text-label-mono ${
                      isMessageError || directoryError ? 'text-error' : 'text-secondary'
                    }`}
                  >
                    {directoryError || message}
                  </p>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-gutter min-w-0">
              <div className="flex flex-col">
                <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <h3 className="font-headline-sm text-[18px] font-semibold text-on-surface flex items-center gap-2">
                    <span className="material-symbols-outlined text-on-surface-variant">group</span>
                    User Directory Index ({users.length})
                  </h3>
                  <button
                    className="self-start border border-secondary text-secondary hover:bg-secondary/10 font-label-mono text-label-mono px-3 py-1.5 rounded transition-colors flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
                    type="button"
                    onClick={fetchUsers}
                    disabled={usersLoading}
                  >
                    <span className="material-symbols-outlined text-[18px]">sync</span>
                    {usersLoading ? 'Loading' : 'Refresh'}
                  </button>
                </div>
                <div className="bg-surface border border-outline-variant rounded-lg overflow-auto shadow-sm max-h-96">
                  <table className="w-full text-left border-collapse min-w-[600px]">
                    <thead>
                      <tr className="bg-surface-container-high border-b border-outline-variant">
                        <th className="px-4 py-3 font-label-mono text-label-mono text-on-surface-variant font-medium">
                          User ID
                        </th>
                        <th className="px-4 py-3 font-label-mono text-label-mono text-on-surface-variant font-medium">
                          Username
                        </th>
                        <th className="px-4 py-3 font-label-mono text-label-mono text-on-surface-variant font-medium">
                          Posts
                        </th>
                        <th className="px-4 py-3 font-label-mono text-label-mono text-on-surface-variant font-medium text-right">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant font-body-sm">
                      {usersLoading || users.length === 0 ? (
                        <tr>
                          <td
                            className="px-4 py-8 text-center font-label-mono text-label-mono text-on-surface-variant"
                            colSpan={4}
                          >
                            {usersLoading ? 'Loading users...' : 'No users indexed yet.'}
                          </td>
                        </tr>
                      ) : (
                        users.map((user) => (
                          <tr
                            className="hover:bg-surface-container-highest/50 transition-colors"
                            key={user.user_id}
                          >
                            <td className="px-4 py-3 font-code-sm text-code-sm text-secondary">
                              {user.user_id}
                            </td>
                            <td className="px-4 py-3 text-on-surface">{user.username}</td>
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-label-mono bg-secondary-container/10 text-secondary border border-secondary/20 uppercase tracking-wider">
                                {formatNumber(postsByUser[user.user_id] || 0)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                className="text-error hover:text-error-container transition-colors p-1"
                                title="Purge Node"
                                type="button"
                                onClick={() => deleteUser(user)}
                              >
                                <span className="material-symbols-outlined text-[18px]">delete</span>
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex flex-col">
                <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <h3 className="font-headline-sm text-[18px] font-semibold text-on-surface flex items-center gap-2">
                    <span className="material-symbols-outlined text-on-surface-variant">article</span>
                    Content / Post Vectors ({posts.length})
                  </h3>
                  <button
                    className="self-start border border-secondary text-secondary hover:bg-secondary/10 font-label-mono text-label-mono px-3 py-1.5 rounded transition-colors flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
                    type="button"
                    onClick={fetchPosts}
                    disabled={postsLoading}
                  >
                    <span className="material-symbols-outlined text-[18px]">sync</span>
                    {postsLoading ? 'Loading' : 'Refresh'}
                  </button>
                </div>
                <div className="bg-surface border border-outline-variant rounded-lg overflow-auto shadow-sm max-h-96">
                  <table className="w-full text-left border-collapse min-w-[900px]">
                    <thead>
                      <tr className="bg-surface-container-high border-b border-outline-variant">
                        <th className="px-4 py-3 font-label-mono text-label-mono text-on-surface-variant font-medium">
                          Post ID
                        </th>
                        <th className="px-4 py-3 font-label-mono text-label-mono text-on-surface-variant font-medium">
                          Author ID
                        </th>
                        <th className="px-4 py-3 font-label-mono text-label-mono text-on-surface-variant font-medium text-right">
                          Likes
                        </th>
                        <th className="px-4 py-3 font-label-mono text-label-mono text-on-surface-variant font-medium text-right">
                          Views (HLL)
                        </th>
                        <th className="px-4 py-3 font-label-mono text-label-mono text-on-surface-variant font-medium text-center">
                          Score
                        </th>
                        <th className="px-4 py-3 font-label-mono text-label-mono text-on-surface-variant font-medium w-1/3">
                          Content Snippet
                        </th>
                        <th className="px-4 py-3 font-label-mono text-label-mono text-on-surface-variant font-medium text-right">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant font-body-sm">
                      {postsLoading || posts.length === 0 ? (
                        <tr>
                          <td
                            className="px-4 py-8 text-center font-label-mono text-label-mono text-on-surface-variant"
                            colSpan={7}
                          >
                            {postsLoading ? 'Loading posts...' : 'No posts indexed yet.'}
                          </td>
                        </tr>
                      ) : (
                        posts.map((post) => (
                          <tr
                            className="hover:bg-surface-container-highest/50 transition-colors"
                            key={post.post_id}
                          >
                            <td className="px-4 py-3 font-code-sm text-code-sm text-primary">
                              {post.post_id}
                            </td>
                            <td className="px-4 py-3 font-code-sm text-code-sm text-secondary">
                              {post.user_id}
                            </td>
                            <td className="px-4 py-3 text-right font-code-sm text-on-surface">
                              {formatNumber(post.likes)}
                            </td>
                            <td className="px-4 py-3 text-right font-code-sm text-on-surface">
                              {formatNumber(post.unique_views)}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={scoreBadgeClassName(post.score)}>
                                {formatScore(post.score)}
                              </span>
                            </td>
                            <td
                              className="px-4 py-3 text-on-surface-variant truncate max-w-[200px]"
                              title={post.content || ''}
                            >
                              {post.content}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                className="text-error hover:text-error-container transition-colors p-1"
                                title="Purge Post"
                                type="button"
                                onClick={() => deletePost(post)}
                              >
                                <span className="material-symbols-outlined text-[18px]">delete</span>
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
