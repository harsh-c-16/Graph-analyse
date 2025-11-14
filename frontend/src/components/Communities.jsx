import React, { useState, useEffect } from 'react';

export default function Communities() {
  const [communities, setCommunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedCommunity, setExpandedCommunity] = useState(null);

  useEffect(() => {
    fetchCommunities();
  }, []);

  const fetchCommunities = async () => {
    try {
      setLoading(true);
      const response = await fetch('/communities');
      if (!response.ok) throw new Error('Failed to fetch communities');
      const data = await response.json();
      setCommunities(data);
      setError(null);
    } catch (err) {
      setError(err.message);
      console.error('Error fetching communities:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleCommunity = (communityId) => {
    setExpandedCommunity(expandedCommunity === communityId ? null : communityId);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500 text-red-500 px-4 py-3 rounded-lg">
        <p className="font-semibold">Error loading communities</p>
        <p className="text-sm">{error}</p>
        <button 
          onClick={fetchCommunities}
          className="mt-2 text-sm underline hover:no-underline"
        >
          Try again
        </button>
      </div>
    );
  }

  if (communities.length === 0) {
    return (
      <div className="text-center py-8 text-slate-400">
        <p className="text-lg">🏘️ No communities found</p>
        <p className="text-sm mt-2">Add more users and follows to see community formations!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <div>
          <p className="text-slate-400 text-sm">
            Found {communities.length} {communities.length === 1 ? 'community' : 'communities'}
          </p>
        </div>
        <button
          onClick={fetchCommunities}
          className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg transition-all text-sm"
        >
          🔄 Refresh
        </button>
      </div>

      <div className="grid gap-4">
        {communities.map((community, index) => (
          <div
            key={community.community_id}
            className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-lg overflow-hidden hover:border-blue-500/50 transition-all"
          >
            <div
              className="p-4 cursor-pointer flex items-center justify-between"
              onClick={() => toggleCommunity(community.community_id)}
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg flex items-center justify-center text-white font-bold shadow-lg">
                  {index + 1}
                </div>
                <div>
                  <h3 className="font-semibold text-lg">
                    Community #{community.community_id}
                  </h3>
                  <p className="text-slate-400 text-sm">
                    {community.members.length} {community.members.length === 1 ? 'member' : 'members'}
                  </p>
                </div>
              </div>
              <div className="text-2xl text-slate-400">
                {expandedCommunity === community.community_id ? '▼' : '▶'}
              </div>
            </div>

            {expandedCommunity === community.community_id && (
              <div className="border-t border-slate-700 p-4 bg-slate-900/50">
                <h4 className="text-sm font-semibold text-slate-300 mb-3">Members:</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                  {community.members.map((userId) => (
                    <div
                      key={userId}
                      className="bg-slate-800 px-3 py-2 rounded-lg border border-slate-700 hover:border-blue-500/50 transition-all"
                    >
                      <p className="text-sm">
                        <span className="text-slate-400">User ID:</span>{' '}
                        <span className="text-blue-400 font-semibold">{userId}</span>
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
