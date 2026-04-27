import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useStore } from '../store/useStore';
import SpaceCard from '../components/SpaceCard';
import WeeklyDigest from '../components/WeeklyDigest';

function SkeletonCard() {
  return (
    <div className="card p-5 sm:p-6 space-y-3">
      <div className="skeleton h-5 w-2/3 rounded" />
      <div className="skeleton h-3 w-full rounded" />
      <div className="skeleton h-1 w-full rounded" />
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center text-center py-24 px-6 animate-fade-in">
      <div className="text-5xl mb-6 select-none">◎</div>
      <h2 className="font-medium text-zinc-900 dark:text-zinc-100 text-xl mb-3">
        Your library is empty
      </h2>
      <p className="text-zinc-500 dark:text-zinc-500 text-sm max-w-xs leading-relaxed mb-8">
        Start by defining what you want to learn and why it matters.
      </p>
      <Link to="/spaces/new" className="btn-primary" id="home-create-first-space">
        Create your first Space
      </Link>
    </div>
  );
}

export default function Home() {
  const spaces         = useStore(s => s.spaces);
  const loading        = useStore(s => s.spacesLoading);
  const setSpaces      = useStore(s => s.setSpaces);
  const setLoading     = useStore(s => s.setSpacesLoading);
  const navigate       = useNavigate();
  const [recallCount, setRecallCount] = useState(0);
  const [showDigest, setShowDigest] = useState(false);

  useEffect(() => {
    // Show digest on Monday
    const today = new Date();
    const isMonday = today.getDay() === 1;
    const dateStr = today.toISOString().split('T')[0];
    const lastShown = localStorage.getItem('last_digest_date');
    if (isMonday && lastShown !== dateStr) {
      setShowDigest(true);
    }
  }, []);

  useEffect(() => {
    // Redirect to /welcome on first launch (spec v1.6: dedicated route, no skip)
    const done = localStorage.getItem('onboarding_complete');
    if (!done) { navigate('/welcome', { replace: true }); return; }

    setLoading(true);
    api.getSpaces()
      .then(data => setSpaces(data))
      .catch(console.error)
      .finally(() => setLoading(false));

    api.getRecallQueue()
      .then(data => setRecallCount(data.length))
      .catch(console.error);
  }, [setSpaces, setLoading, navigate]);

  const handleCloseDigest = () => {
    const dateStr = new Date().toISOString().split('T')[0];
    localStorage.setItem('last_digest_date', dateStr);
    setShowDigest(false);
  };

  return (
    <div className="min-h-dvh bg-zinc-50 dark:bg-zinc-950">
      {showDigest && <WeeklyDigest onClose={handleCloseDigest} />}
      {/* Top bar */}
      <header className="top-bar">
        <span className="font-medium text-zinc-900 dark:text-zinc-100 tracking-tight">Kernvault</span>
        <div className="flex-1" />
        <Link to="/search" className="btn-ghost btn-sm px-2" aria-label="Search" id="home-search-link" title="Search (/)">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </Link>
        <Link to="/settings" className="btn-ghost btn-sm px-2" aria-label="Settings" id="home-settings-link">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
          </svg>
        </Link>
        {spaces.length > 0 && (
          <Link to="/spaces/new" className="btn-primary btn-sm" id="home-new-space-btn">
            New Space
          </Link>
        )}
      </header>

      <main className="pt-14">
        {loading ? (
          <div className="max-w-2xl mx-auto px-4 py-8 grid gap-3">
            {[1,2,3].map(i => <SkeletonCard key={i} />)}
          </div>
        ) : spaces.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="max-w-2xl mx-auto px-4 py-8">
            {recallCount > 0 && (
              <div className="mb-8 animate-fade-in">
                <Link to="/recall" className="flex items-center gap-3 px-4 py-3 bg-zinc-100 dark:bg-zinc-800/50 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg transition-colors group">
                  <div className="w-2 h-2 rounded-full bg-zinc-900 dark:bg-zinc-100" />
                  <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{recallCount} item{recallCount !== 1 ? 's' : ''} ready for recall</span>
                  <span className="text-xs text-zinc-500 ml-auto group-hover:text-zinc-700 dark:group-hover:text-zinc-300">Start session →</span>
                </Link>
              </div>
            )}
            <h1 className="sr-only">Your Spaces</h1>
            <div className="grid gap-3">
              {spaces.map(space => (
                <SpaceCard key={space.id} space={space} />
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Mobile FAB for New Space */}
      {spaces.length > 0 && !loading && (
        <div className="fixed bottom-6 right-6 sm:hidden z-30">
          <Link to="/spaces/new" className="btn-primary rounded-full w-14 h-14 min-h-0 text-xl flex items-center justify-center"
            id="home-new-space-fab" aria-label="Create new Space">+</Link>
        </div>
      )}
    </div>
  );
}
