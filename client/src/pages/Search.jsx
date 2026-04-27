import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';

const TYPE_ICONS = {
  article:  '📄', video: '▶', book: '📖', paper: '📑',
  tutorial: '🎓', project: '🔧', other: '•',
};

const STATUS_DOT = {
  done:       'bg-zinc-700 dark:bg-zinc-300',
  reading:    'border-2 border-zinc-500',
  unread:     'border-2 border-zinc-300 dark:border-zinc-700',
  done_quick: 'bg-zinc-400',
};

function useDebounce(value, delay) {
  const [dv, setDv] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDv(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return dv;
}

/** Bold the matched substring inside a snippet string. */
function Highlight({ text, query }) {
  if (!query || !text) return <span>{text}</span>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <span>{text}</span>;
  return (
    <span>
      {text.slice(0, idx)}
      <mark className="bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 rounded px-0.5">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </span>
  );
}

function SectionHeader({ label, count }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <p className="text-[10px] font-medium uppercase tracking-widest text-zinc-400">{label}</p>
      <span className="text-[10px] text-zinc-300 dark:text-zinc-700">{count}</span>
    </div>
  );
}

export default function Search() {
  const navigate   = useNavigate();
  const inputRef   = useRef(null);
  const [query, setQuery]     = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);
  const debounced = useDebounce(query, 280);

  useEffect(() => { inputRef.current?.focus(); }, []);

  // Fetch from server whenever debounced query changes
  useEffect(() => {
    if (!debounced.trim()) { setResults(null); return; }
    setLoading(true);
    setError(null);
    api.search(debounced)
      .then(data => setResults(data))
      .catch(() => setError('Search failed. Is the server running?'))
      .finally(() => setLoading(false));
  }, [debounced]);

  const totalHits = results
    ? results.spaces.length + results.items.length + results.notes.length
    : 0;
  const hasResults = totalHits > 0;

  // Keyboard shortcut: Escape clears
  const handleKey = useCallback((e) => {
    if (e.key === 'Escape') { setQuery(''); inputRef.current?.focus(); }
  }, []);

  return (
    <div className="min-h-dvh bg-zinc-50 dark:bg-zinc-950" onKeyDown={handleKey}>
      {/* Search bar header */}
      <header className="fixed top-0 inset-x-0 z-30 bg-zinc-50/90 dark:bg-zinc-950/90 backdrop-blur-sm border-b border-zinc-200 dark:border-zinc-800">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors shrink-0"
            aria-label="Go back"
          >
            ←
          </button>

          <div className="flex-1 relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm pointer-events-none">
              ⌕
            </span>
            <input
              ref={inputRef}
              id="global-search-input"
              type="search"
              autoComplete="off"
              autoCorrect="off"
              spellCheck="false"
              className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg pl-9 pr-10 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-600 transition"
              placeholder="Search spaces, articles, notes…"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
            {query && (
              <button
                onClick={() => { setQuery(''); inputRef.current?.focus(); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors text-lg leading-none"
                aria-label="Clear search"
              >
                ×
              </button>
            )}
          </div>

          {/* Result count badge */}
          {results && query && (
            <span className="text-xs text-zinc-400 shrink-0 tabular-nums">
              {totalHits} result{totalHits !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </header>

      <main className="pt-20 pb-24 max-w-2xl mx-auto px-4">

        {/* Loading */}
        {loading && (
          <div className="space-y-3 pt-4 animate-pulse">
            {[80, 60, 70].map((w, i) => (
              <div key={i} className="h-14 bg-zinc-200 dark:bg-zinc-800 rounded-xl" style={{ width: `${w}%` }} />
            ))}
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <p className="text-sm text-red-500 text-center pt-12">{error}</p>
        )}

        {/* Empty state */}
        {!loading && !error && query && !hasResults && results && (
          <div className="text-center pt-16 space-y-2">
            <p className="text-2xl">⌕</p>
            <p className="text-sm text-zinc-500">No results for <strong className="text-zinc-700 dark:text-zinc-300">"{query}"</strong></p>
            <p className="text-xs text-zinc-400">Try a different word, or search by article title or note content.</p>
          </div>
        )}

        {/* Results */}
        {!loading && !error && hasResults && (
          <div className="pt-4 space-y-8 animate-fade-in">

            {/* Spaces */}
            {results.spaces.length > 0 && (
              <section>
                <SectionHeader label="Spaces" count={results.spaces.length} />
                <div className="space-y-1">
                  {results.spaces.map(s => (
                    <Link
                      key={s.id}
                      to={`/spaces/${s.id}`}
                      className="flex items-start gap-3 p-3 rounded-xl hover:bg-white dark:hover:bg-zinc-900 border border-transparent hover:border-zinc-200 dark:hover:border-zinc-800 transition-all group"
                    >
                      <div className="shrink-0 w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-sm mt-0.5">
                        ◎
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200 group-hover:text-zinc-900 dark:group-hover:text-zinc-100">
                          <Highlight text={s.name} query={debounced} />
                        </p>
                        {s.snippet && (
                          <p className="text-xs text-zinc-500 mt-0.5 line-clamp-1">
                            <Highlight text={s.snippet} query={debounced} />
                          </p>
                        )}
                      </div>
                      <span className="text-zinc-300 dark:text-zinc-700 group-hover:text-zinc-500 transition-colors shrink-0 self-center">›</span>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Items */}
            {results.items.length > 0 && (
              <section>
                <SectionHeader label="Articles & Items" count={results.items.length} />
                <div className="space-y-1">
                  {results.items.map(item => (
                    <Link
                      key={item.id}
                      to={`/spaces/${item.space_id}/items/${item.id}`}
                      className="flex items-start gap-3 p-3 rounded-xl hover:bg-white dark:hover:bg-zinc-900 border border-transparent hover:border-zinc-200 dark:hover:border-zinc-800 transition-all group"
                    >
                      {/* Status dot */}
                      <div className={`shrink-0 w-2 h-2 rounded-full mt-2 ${STATUS_DOT[item.status] || STATUS_DOT.unread}`} />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200 group-hover:text-zinc-900 dark:group-hover:text-zinc-100">
                            <Highlight text={item.title} query={debounced} />
                          </p>
                          <span className="text-[10px] text-zinc-400 uppercase tracking-wider shrink-0">
                            {item.type}
                          </span>
                        </div>
                        {/* Breadcrumb */}
                        <p className="text-[10px] text-zinc-400 mt-0.5 flex items-center gap-1">
                          <span>{item.space_name}</span>
                          <span>›</span>
                          <span>{item.stage_name}</span>
                        </p>
                        {/* Snippet */}
                        {item.snippet && (
                          <p className="text-xs text-zinc-500 mt-1 line-clamp-2 leading-relaxed">
                            <Highlight text={item.snippet} query={debounced} />
                          </p>
                        )}
                      </div>
                      <span className="text-zinc-300 dark:text-zinc-700 group-hover:text-zinc-500 transition-colors shrink-0 self-center">›</span>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Notes */}
            {results.notes.length > 0 && (
              <section>
                <SectionHeader label="Notes" count={results.notes.length} />
                <div className="space-y-1">
                  {results.notes.map(note => (
                    <Link
                      key={note.id}
                      to={`/spaces/${note.space_id}/items/${note.item_id}`}
                      className="flex items-start gap-3 p-3 rounded-xl hover:bg-white dark:hover:bg-zinc-900 border border-transparent hover:border-zinc-200 dark:hover:border-zinc-800 transition-all group"
                    >
                      <div className="shrink-0 w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-sm mt-0.5 text-zinc-500">
                        ✏
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-zinc-400 mb-0.5">
                          {note.space_name} · <span className="italic">{note.item_title}</span>
                        </p>
                        <p className="text-sm text-zinc-700 dark:text-zinc-300 line-clamp-2 leading-relaxed">
                          <Highlight text={note.snippet} query={debounced} />
                        </p>
                      </div>
                      <span className="text-zinc-300 dark:text-zinc-700 group-hover:text-zinc-500 transition-colors shrink-0 self-center">›</span>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {/* Default state — no query yet */}
        {!query && (
          <div className="text-center pt-16 space-y-3">
            <p className="text-3xl">⌕</p>
            <p className="text-sm text-zinc-400">Search across your spaces, articles, and notes.</p>
            <div className="flex flex-wrap justify-center gap-2 pt-2">
              {['machine learning', 'notes from last week', 'chapter 3'].map(s => (
                <button
                  key={s}
                  onClick={() => setQuery(s)}
                  className="text-xs px-3 py-1.5 rounded-full border border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
