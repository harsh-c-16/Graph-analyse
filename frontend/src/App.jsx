import React from 'react';
import ManagementPage from './pages/ManagementPage';
import AnalyticsPage from './pages/AnalyticsPage';

export default function App() {
  const [route, setRoute] = React.useState('management');
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <header className="sticky top-0 z-50 border-b border-slate-700 bg-slate-900/80 backdrop-blur-xl shadow-2xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">📊</span>
              </div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-600 bg-clip-text text-transparent">GraphAnalyse</h1>
            </div>
            
            <nav className="flex gap-2">
              <button
                onClick={() => setRoute('management')}
                className={`px-6 py-2 rounded-lg font-medium transition-all duration-300 ${
                  route === 'management'
                    ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/50'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                📝 Management
              </button>
              <button
                onClick={() => setRoute('analytics')}
                className={`px-6 py-2 rounded-lg font-medium transition-all duration-300 ${
                  route === 'analytics'
                    ? 'bg-gradient-to-r from-purple-500 to-pink-600 text-white shadow-lg shadow-purple-500/50'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                📈 Analytics
              </button>
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {route === 'management' ? <ManagementPage /> : <AnalyticsPage />}
      </main>
    </div>
  );
}
