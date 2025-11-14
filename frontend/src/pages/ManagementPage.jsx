import React from 'react';
import GraphManager from '../components/GraphManager';
import UserList from '../components/UserList';
import PostList from '../components/PostList';

export default function ManagementPage() {
  return (
    <div className="space-y-8">
      <div className="mb-8">
        <h1 className="section-title text-4xl">🏢 Graph Management</h1>
        <p className="text-slate-400 mt-2">Create users, posts, and manage interactions in your social network</p>
      </div>

      <div className="grid-2">
        <div className="section">
          <h2 className="section-title">📊 Create & Manage</h2>
          <GraphManager />
        </div>

        <div className="section">
          <h2 className="section-title">👥 User Directory</h2>
          <UserList />

          <h2 className="section-title mt-6">📝 Post Directory</h2>
          <PostList />
        </div>
      </div>
    </div>
  );
}
