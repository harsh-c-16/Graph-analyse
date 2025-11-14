import React from 'react';
import UserRanking from '../components/UserRanking';
import TopPosts from '../components/TopPosts';
import PathExplorer from '../components/PathExplorer';
import SearchBar from '../components/SearchBar';
import Communities from '../components/Communities';

export default function AnalyticsPage() {
  return (
    <div className="space-y-8">
      <div className="mb-8">
        <h1 className="section-title text-4xl">📊 Analytics & Insights</h1>
        <p className="text-slate-400 mt-2">Explore user rankings, connections, and search posts</p>
      </div>

      <div className="grid-2">
        <div className="section">
          <h2 className="section-title">🔍 Search Posts</h2>
          <SearchBar />
        </div>

        <div className="section">
          <h2 className="section-title">🎯 Top Posts</h2>
          <TopPosts />
        </div>
      </div>

      <div className="section">
        <h2 className="section-title">👑 User Rankings</h2>
        <UserRanking />
      </div>

      <div className="section">
        <h2 className="section-title">🗺️ Path Finder</h2>
        <PathExplorer />
      </div>

      <div className="section">
        <h2 className="section-title">🏘️ Communities</h2>
        <Communities />
      </div>
    </div>
  );
}
