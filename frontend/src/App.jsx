import React from 'react';
import ManagementPage from './pages/ManagementPage';
import AnalyticsPage from './pages/AnalyticsPage';

export default function App() {
  const [route, setRoute] = React.useState('management');
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-50 border-b border-outline-variant bg-surface/80 backdrop-blur-xl shrink-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold font-headline-md text-primary">
                GraphAnalyse
              </h1>
            </div>

            <nav className="flex gap-2">
              <button
                onClick={() => setRoute('management')}
                className={`px-5 py-1.5 rounded font-label-mono text-label-mono transition-all duration-200 ${
                  route === 'management'
                    ? 'bg-primary/10 text-primary border border-primary/30'
                    : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
                }`}
              >
                Management
              </button>
              <button
                onClick={() => setRoute('analytics')}
                className={`px-5 py-1.5 rounded font-label-mono text-label-mono transition-all duration-200 ${
                  route === 'analytics'
                    ? 'bg-secondary/10 text-secondary border border-secondary/30'
                    : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
                }`}
              >
                Analytics
              </button>
            </nav>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {route === 'management' ? <ManagementPage /> : <AnalyticsPage />}
      </main>
    </div>
  );
}
