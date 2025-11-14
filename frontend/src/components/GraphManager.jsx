import React from 'react';
import axios from 'axios';

export default function GraphManager() {
  const [username, setUsername] = React.useState('');
  const [postUser, setPostUser] = React.useState('');
  const [postContent, setPostContent] = React.useState('');
  const [intUser, setIntUser] = React.useState('');
  const [intTarget, setIntTarget] = React.useState('');
  const [intType, setIntType] = React.useState('like');
  const [message, setMessage] = React.useState('');
  const [running, setRunning] = React.useState(false);

  const addUser = async (e) => {
    e.preventDefault();
    setRunning(true);
    try {
  const r = await axios.post('/user', `username=${encodeURIComponent(username)}`, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
  setMessage('✅ User created successfully!');
  setUsername('');
  // notify other components that graph changed
  try { window.dispatchEvent(new Event('graph-updated')); } catch(_) {}
      setTimeout(() => setMessage(''), 3000);
    } catch (err) { 
      setMessage('❌ Error creating user'); 
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
  const r = await axios.post('/post', body, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
  setMessage('✅ Post created successfully!');
  setPostUser('');
  setPostContent('');
  try { window.dispatchEvent(new Event('graph-updated')); } catch(_) {}
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage('❌ Error creating post');
    }
    setRunning(false);
  };

  const addInteraction = async (e) => {
    e.preventDefault();
    setRunning(true);
    try {
  const uid = Number(intUser);
      const tid = Number(intTarget);
      if (!Number.isInteger(uid) || uid <= 0 || !Number.isInteger(tid) || tid <= 0) throw new Error('Invalid user id');
      const body = `user_id=${encodeURIComponent(String(uid))}&target_id=${encodeURIComponent(String(tid))}&type=${encodeURIComponent(intType)}`;
  const r = await axios.post('/interaction', body, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
  setMessage(`✅ ${intType.charAt(0).toUpperCase() + intType.slice(1)} added successfully!`);
  setIntUser('');
  setIntTarget('');
  try { window.dispatchEvent(new Event('graph-updated')); } catch(_) {}
      setTimeout(() => setMessage(''), 3000);
    } catch (err) { 
      setMessage('❌ Error adding interaction'); 
    }
    setRunning(false);
  };

  return (
    <div className="space-y-6">
      <div className="grid-3 gap-6">
        {/* Add User Form */}
        <div className="card">
          <h3 className="card-title">👤 Create User</h3>
          <form onSubmit={addUser} className="col">
            <input 
              placeholder="Enter username" 
              value={username} 
              onChange={e => setUsername(e.target.value)}
              disabled={running}
              required
            />
            <button className="btn btn-success" type="submit" disabled={running || !username}>
              {running ? '⏳ Creating...' : '✨ Create User'}
            </button>
          </form>
        </div>

        {/* Add Post Form */}
        <div className="card">
          <h3 className="card-title">📝 Write Post</h3>
          <form onSubmit={addPost} className="col">
            <input 
              placeholder="User ID" 
              value={postUser} 
              onChange={e => setPostUser(e.target.value)}
              disabled={running}
              required
            />
            <textarea 
              placeholder="What's on your mind?" 
              value={postContent} 
              onChange={e => setPostContent(e.target.value)}
              disabled={running}
              required
              rows="3"
              style={{ resize: 'none' }}
            />
            <button className="btn btn-success" type="submit" disabled={running || !postUser || !postContent}>
              {running ? '⏳ Posting...' : '📤 Post'}
            </button>
          </form>
        </div>

        {/* Add Interaction Form */}
        <div className="card">
          <h3 className="card-title">💬 Interaction</h3>
          <form onSubmit={addInteraction} className="col">
            <input 
              placeholder="Your User ID" 
              value={intUser} 
              onChange={e => setIntUser(e.target.value)}
              disabled={running}
              required
            />
            <input 
              placeholder="Target User ID" 
              value={intTarget} 
              onChange={e => setIntTarget(e.target.value)}
              disabled={running}
              required
            />
            <select 
              value={intType} 
              onChange={e => setIntType(e.target.value)}
              disabled={running}
            >
              <option value="like">❤️ Like</option>
              <option value="follow">👥 Follow</option>
            </select>
            <button className="btn btn-success" type="submit" disabled={running || !intUser || !intTarget}>
              {running ? '⏳ Adding...' : '✨ Add'}
            </button>
          </form>
        </div>
      </div>

      {/* Message Display */}
      {message && (
        <div className={`card ${message.startsWith('✅') ? 'border-green-500/30 bg-green-500/5' : 'border-red-500/30 bg-red-500/5'}`}>
          <p className={message.startsWith('✅') ? 'text-green-300' : 'text-red-300'}>
            {message}
          </p>
        </div>
      )}
    </div>
  );
}
