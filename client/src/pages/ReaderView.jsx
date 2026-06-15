import { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api/client';
import { useStore } from '../store/useStore';
import { useReadingProgress } from '../hooks/useReadingProgress';
import { getSelectionOffsets, renderHighlights, splitSentences, wrapSentencesInDOM } from '../utils/highlighting';
import PausePoint from '../components/PausePoint';
import CompletionGate from '../components/CompletionGate';
import NotesPanel from '../components/NotesPanel';
import Tour from '../components/Tour';

/* eslint-disable react/prop-types */
function InlineAnnotationPopover({ inlineAnnotation, highlights, onClose, onSave }) {
  const [text, setText] = useState(highlights.find(h => h.id === inlineAnnotation.highlightId)?.annotation || '');
  const [error, setError] = useState('');

  const handleSave = () => {
    if (!text.trim()) {
      setError('An annotation is required — what does this passage mean to you?');
      return;
    }
    setError('');
    onSave(inlineAnnotation.highlightId, text);
  };

  return (
    <div 
      className="highlight-toolbar fixed z-50 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xl rounded-lg p-3 w-80 animate-fade-in"
      style={{
        top: Math.min(inlineAnnotation.rect.bottom + 8, window.innerHeight - 180),
        left: Math.max(16, Math.min(
          inlineAnnotation.rect.left + (inlineAnnotation.rect.width / 2) - 160,
          window.innerWidth - 336
        ))
      }}
    >
      <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 mb-2">Why does this matter?</p>
      <textarea
        autoFocus
        className={`w-full bg-zinc-50 dark:bg-zinc-950 border rounded text-sm resize-none p-2 focus:outline-none focus:ring-2 placeholder-zinc-400 dark:placeholder-zinc-600 ${
          error
            ? 'border-red-400 dark:border-red-500 focus:ring-red-400/40'
            : 'border-zinc-200 dark:border-zinc-800 focus:ring-yellow-400/50'
        }`}
        rows="3"
        placeholder="Add your annotation…"
        value={text}
        onChange={(e) => { setText(e.target.value); if (error) setError(''); }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            handleSave();
          } else if (e.key === 'Escape') {
            onClose();
          }
        }}
      />
      {error && (
        <p className="text-[11px] text-red-500 dark:text-red-400 mt-1.5">{error}</p>
      )}
      <div className="flex justify-between items-center mt-2">
        <span className="text-[10px] text-zinc-400">⌘↵ to save · Esc to close</span>
        <div className="flex gap-2">
          <button className="btn-ghost btn-sm" onClick={onClose}>Cancel</button>
          <button
            className="btn-primary btn-sm"
            onClick={handleSave}
          >Save</button>
        </div>
      </div>
    </div>
  );
}

function MobileAnnotationSheet({ mobileAnnotation, highlights, onClose, onSave, onDelete }) {
  const [text, setText] = useState(highlights.find(h => h.id === mobileAnnotation.highlightId)?.annotation || '');
  const [error, setError] = useState('');

  const handleSave = () => {
    if (!text.trim()) {
      setError('An annotation is required — what does this passage mean to you?');
      return;
    }
    setError('');
    onSave(mobileAnnotation.highlightId, text);
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-50 animate-fade-in" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-zinc-900 z-50 rounded-t-xl shadow-2xl transition-transform duration-300 p-4 mobile-annotation-sheet transform translate-y-0">
        <div className="w-12 h-1.5 bg-zinc-300 dark:bg-zinc-700 rounded-full mx-auto mb-4" />
        <h3 className="text-sm font-medium mb-3">Annotation</h3>
        <textarea
          autoFocus
          className={`w-full bg-zinc-50 dark:bg-zinc-950 border rounded-lg p-3 text-base resize-none focus:outline-none focus:ring-2 ${
            error
              ? 'border-red-400 dark:border-red-500 focus:ring-red-400/40'
              : 'border-zinc-200 dark:border-zinc-800 focus:ring-blue-500/50'
          }`}
          rows="4"
          placeholder="Why does this passage matter?"
          value={text}
          onChange={(e) => { setText(e.target.value); if (error) setError(''); }}
        />
        {error && (
          <p className="text-[12px] text-red-500 dark:text-red-400 mt-1.5">{error}</p>
        )}
        <div className="flex justify-between items-center mt-4">
          <button className="text-red-500 font-medium text-sm px-4 py-2" onClick={onDelete}>Delete</button>
          <div className="flex gap-2">
            <button className="btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn-primary" onClick={handleSave}>Save</button>
          </div>
        </div>
      </div>
    </>
  );
}

const FONT_SIZES = { sm: 'reading-sm', md: 'reading-md', lg: 'reading-lg' };
const FONT_FAMILIES = { sans: 'font-sans', serif: 'font-serif', mono: 'font-mono' };

const TYPE_LABELS = {
  article: 'Article', video: 'Video', book: 'Book',
  paper: 'Paper', tutorial: 'Tutorial', project: 'Project', other: 'Other',
};

/**
 * Inject pause points into HTML content by splitting on <p> tags.
 * Returns an array of {type: 'html'|'pause', content?, position?}.
 */
function buildContentSegments(contentHtml, itemId) {
  if (!contentHtml) return [];

  // Split on paragraph boundaries
  const paragraphs = contentHtml.split(/(?=<p[\s>])/i).filter(Boolean);
  const PAUSE_EVERY = 4; // every 4 paragraphs
  const segments = [];
  let paraCount = 0;
  let htmlBuffer = '';
  let pauseIndex = 0;

  paragraphs.forEach((block) => {
    htmlBuffer += block;
    if (block.trim().startsWith('<p')) paraCount++;

    if (paraCount > 0 && paraCount % PAUSE_EVERY === 0) {
      segments.push({ type: 'html', content: htmlBuffer });
      segments.push({ type: 'pause', position: pauseIndex, itemId });
      htmlBuffer = '';
      pauseIndex++;
    }
  });

  if (htmlBuffer) {
    segments.push({ type: 'html', content: htmlBuffer });
  }

  return segments;
}

function SkeletonReader() {
  return (
    <div className="reading-column py-10 space-y-4">
      <div className="skeleton h-8 w-3/4 rounded" />
      <div className="skeleton h-4 w-1/3 rounded" />
      {[1,2,3,4,5,6].map(i => (
        <div key={i} className="skeleton h-4 rounded" style={{ width: `${70 + (i % 3) * 10}%` }} />
      ))}
    </div>
  );
}

export default function ReaderView() {
  const { id: spaceId, itemId } = useParams();
  const progress  = useReadingProgress();
  const notesPanelOpen = useStore(s => s.notesPanelOpen);
  const toggleNotesPanel = useStore(s => s.toggleNotesPanel);
  const closeNotesPanel  = useStore(s => s.closeNotesPanel);
  const addNote          = useStore(s => s.addNote);
  const fontSize         = useStore(s => s.settings.fontSize);
  const fontFamily       = useStore(s => s.settings.fontFamily || 'sans');
  const updateSettings   = useStore(s => s.updateSettings);
  const highlightsMap    = useStore(s => s.highlights);
  const highlights       = useMemo(() => highlightsMap[itemId] || [], [highlightsMap, itemId]);
  const setHighlights    = useStore(s => s.setHighlights);
  const addHighlight     = useStore(s => s.addHighlight);
  const updateHighlight  = useStore(s => s.updateHighlight);
  const removeHighlight  = useStore(s => s.removeHighlight);
  const settings         = useStore(s => s.settings);
  const markTourSeen     = useStore(s => s.markTourSeen);

  const [isMobile, setIsMobile] = useState(false);
  const [item, setItem]     = useState(null);
  const [space, setSpace]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);
  const [showDisplayMenu, setShowDisplayMenu] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [exportMode, setExportMode] = useState('annotated');
  const [exportIncludeNotes, setExportIncludeNotes] = useState(true);
  const [exportIncludeHighlights, setExportIncludeHighlights] = useState(true);
  const [exportIncludePausePoints, setExportIncludePausePoints] = useState(true);

  // Session Timer state
  const [activeSeconds, setActiveSeconds] = useState(0);
  const [lastActivity, setLastActivity] = useState(Date.now());

  // Detect touch/pointer device once on mount
  useEffect(() => { setIsMobile(window.matchMedia('(pointer: coarse)').matches); }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.getItem(itemId),
      api.getSpace(spaceId),
      api.getItemHighlights(itemId),
    ])
      .then(([item, space, hls]) => {
        setItem(item);
        setSpace(space);
        setHighlights(itemId, hls);
        // Auto-set status to "reading" if unread
        if (item.status === 'unread') {
          api.updateItem(item.id, { status: 'reading' })
            .then(updated => setItem(updated))
            .catch(console.error);
        }
      })
      .catch(() => setError('Could not load this item.'))
      .finally(() => setLoading(false));
  }, [itemId, spaceId, setHighlights]);

  // Close notes panel on unmount
  useEffect(() => () => closeNotesPanel(), [closeNotesPanel]);

  // Scroll to top on mount
  useEffect(() => { window.scrollTo(0, 0); }, [itemId]);

  // Track user activity for session timer
  useEffect(() => {
    const handleActivity = () => setLastActivity(Date.now());
    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('scroll', handleActivity);
    window.addEventListener('touchstart', handleActivity);
    
    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('scroll', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
    };
  }, []);

  // Tick the session timer
  useEffect(() => {
    if (!settings.sessionTimerEnabled) return;
    const interval = setInterval(() => {
      // 60 second idle timeout
      if (Date.now() - lastActivity < 60000) {
        setActiveSeconds(s => s + 1);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [settings.sessionTimerEnabled, lastActivity]);

  const segments = useMemo(
    () => buildContentSegments(item?.content_html, itemId),
    [item?.content_html, itemId]
  );

  const articleRef = useRef(null);

  // Desktop selection state
  const [selection, setSelection] = useState(null);
  const [inlineAnnotation, setInlineAnnotation] = useState(null);

  // Mobile selection state
  const [mobileSelection, setMobileSelection] = useState(null);
  const [mobileAnnotation, setMobileAnnotation] = useState(null);
  const [mobileSentences, setMobileSentences] = useState([]);

  // Compute sentences for mobile once item is loaded
  useEffect(() => {
    if (isMobile && item?.content_text) {
      setMobileSentences(splitSentences(item.content_text));
    }
  }, [isMobile, item?.content_text]);

  // Wrap sentences and render highlights whenever content or font size changes
  useEffect(() => {
    if (!articleRef.current || !item) return;
    
    const tid = setTimeout(() => {
      if (isMobile && mobileSentences.length > 0) {
        wrapSentencesInDOM(articleRef.current, mobileSentences);
      }
      renderHighlights(
        articleRef.current,
        highlights,
        (hlId, e) => {
          // On click
          if (isMobile) {
            setMobileAnnotation({ highlightId: hlId });
          } else {
            // For desktop, position annotation below the mark
            const rect = e.target.getBoundingClientRect();
            setInlineAnnotation({ highlightId: hlId, rect });
          }
        },
        (hlId, e) => {
          // On context menu
          if (!isMobile) {
            e.preventDefault();
            if (confirm('Delete this highlight?')) {
              api.deleteHighlight(hlId).then(() => removeHighlight(itemId, hlId)).catch(console.error);
            }
          }
        }
      );
    }, 100); // Wait for React to flush DOM
    return () => clearTimeout(tid);
  }, [item, segments, highlights, fontSize, isMobile, mobileSentences, itemId, removeHighlight]);

  // Native selection handling (Mouse/Trackpad)
  useEffect(() => {
    const handleSelectionChange = () => {
      if (!articleRef.current) return;
      
      const sel = window.getSelection();
      if (!sel.isCollapsed && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        const rect = range.getBoundingClientRect();
      
        const offsets = getSelectionOffsets(articleRef.current, sel);
        if (offsets && offsets.start_offset !== offsets.end_offset) {
          setSelection({
            text: sel.toString().trim(),
            start_offset: offsets.start_offset,
            end_offset: offsets.end_offset,
            rect,
          });
          return;
        }
      }
      setSelection(null);
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, []);

  // Mobile tap handling
  useEffect(() => {
    if (!isMobile || !articleRef.current) return;
    
    const handleClick = (e) => {
      if (!articleRef.current) return;
      
      const span = e.target.closest('span[data-sentence-index]');
      if (span) {
        const idx = parseInt(span.getAttribute('data-sentence-index'), 10);
        let newStart = idx;
        let newEnd = idx;
        
        setMobileSelection(prev => {
          if (!prev) {
            return { startIndex: idx, endIndex: idx };
          } else {
            newStart = Math.min(prev.startIndex, idx);
            newEnd = Math.max(prev.startIndex, idx);
            return { startIndex: newStart, endIndex: newEnd };
          }
        });
        
        // Add selecting classes
        setTimeout(() => {
          if (!articleRef.current) return;
          const allSpans = articleRef.current.querySelectorAll('span[data-sentence-index]');
          allSpans.forEach(s => s.classList.remove('highlight-selecting'));
          for (let i = newStart; i <= newEnd; i++) {
            const s = articleRef.current.querySelector(`span[data-sentence-index="${i}"]`);
            if (s) s.classList.add('highlight-selecting');
          }
        }, 0);
      } else if (!e.target.closest('.mobile-annotation-sheet') && !e.target.closest('.highlight-toolbar')) {
        setMobileSelection(null);
        const allSpans = articleRef.current.querySelectorAll('span[data-sentence-index]');
        allSpans.forEach(s => s.classList.remove('highlight-selecting'));
      }
    };
    
    const node = articleRef.current;
    node.addEventListener('click', handleClick);
    return () => node.removeEventListener('click', handleClick);
  }, [isMobile, item]);

  const handleCreateHighlight = async (start_offset, end_offset, text) => {
    try {
      const hl = await api.createHighlight({
        item_id: itemId,
        selected_text: text,
        start_offset,
        end_offset,
      });
      addHighlight(itemId, hl);
      
      if (!isMobile) {
        window.getSelection().removeAllRanges();
        setSelection(null);
        // Open annotation popover — wait for renderHighlights to paint the mark first
        setTimeout(() => {
          const mark = document.querySelector(`mark[data-highlight-id="${hl.id}"]`);
          const rect = mark ? mark.getBoundingClientRect() : { bottom: 200, left: 200, width: 100 };
          setInlineAnnotation({ highlightId: hl.id, rect, isNew: true });
        }, 150);
      } else {
        setMobileSelection(null);
        if (articleRef.current) {
          const allSpans = articleRef.current.querySelectorAll('span[data-sentence-index]');
          allSpans.forEach(s => s.classList.remove('highlight-selecting'));
        }
        setMobileAnnotation({ highlightId: hl.id, isNew: true });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveAnnotation = async (hlId, text) => {
    try {
      if (!text.trim()) {
        // Disregard (delete) the highlight entirely if saved with empty text
        await api.deleteHighlight(hlId);
        removeHighlight(itemId, hlId);
        setInlineAnnotation(null);
        setMobileAnnotation(null);
        return;
      }

      const updated = await api.updateHighlight(hlId, { annotation: text, annotation_state: 'annotated' });
      updateHighlight(itemId, updated);
      setInlineAnnotation(null);
      setMobileAnnotation(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCloseInline = () => {
    if (inlineAnnotation?.isNew) {
      api.deleteHighlight(inlineAnnotation.highlightId).catch(console.error);
      removeHighlight(itemId, inlineAnnotation.highlightId);
    }
    setInlineAnnotation(null);
  };

  const handleCloseMobile = () => {
    if (mobileAnnotation?.isNew) {
      api.deleteHighlight(mobileAnnotation.highlightId).catch(console.error);
      removeHighlight(itemId, mobileAnnotation.highlightId);
    }
    setMobileAnnotation(null);
  };

  function handleExportEpub() {
    const params = new URLSearchParams({ mode: exportMode });
    if (exportMode === 'annotated') {
      params.set('includeNotes', exportIncludeNotes);
      params.set('includeHighlights', exportIncludeHighlights);
      params.set('includePausePoints', exportIncludePausePoints);
    }
    const a = document.createElement('a');
    a.href = `/api/items/${item.id}/export/epub?${params}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setShowExportMenu(false);
  }

  // Find current stage for breadcrumb
  const currentStage = space?.stages?.find(st =>
    (st.items || []).some(i => i.id === itemId)
  );

  if (loading) return (
    <div className="min-h-dvh bg-zinc-50 dark:bg-zinc-950 pt-14">
      <div className="top-bar">
        <Link to={`/spaces/${spaceId}`} className="btn-ghost btn-sm px-2">← Back</Link>
      </div>
      <SkeletonReader />
    </div>
  );

  if (error || !item) return (
    <div className="min-h-dvh bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center pt-14">
      <div className="text-center">
        <p className="text-zinc-500 mb-4">{error || 'Item not found.'}</p>
        <Link to={`/spaces/${spaceId}`} className="btn-secondary btn-sm">← Back to Space</Link>
      </div>
    </div>
  );

  let readabilityLabel = null;
  if (item?.readability_score != null && item?.content_type !== 'youtube') {
    if (item.readability_score >= 70) readabilityLabel = 'Accessible';
    else if (item.readability_score >= 40) readabilityLabel = 'Moderate';
    else readabilityLabel = 'Dense';
  }
  const wordCount = item?.content_text ? item.content_text.trim().split(/\s+/).length : 0;
  const estimatedTimeMin = Math.max(1, Math.ceil(wordCount / 238));

  return (
    <div className="min-h-dvh bg-zinc-50 dark:bg-zinc-950">
      {!settings.onboarding?.readerTourSeen && (
        <Tour
          run={true}
          steps={[
            {
              target: '#reader-notes-toggle',
              title: 'Capture your thoughts',
              content: 'As you read, click here to open the Notes panel. Don\'t just highlight—write down what it means in your own words.',
              disableBeacon: false,
              placement: 'left'
            },
            {
              target: '#reader-completion-gate',
              title: 'Prove your understanding',
              content: 'When you reach the bottom, Kernvault requires a short reflection before marking it "Done". This locks the knowledge in.',
              disableBeacon: false,
              placement: 'top'
            }
          ]}
          onFinish={() => markTourSeen('readerTourSeen')}
        />
      )}

      {/* Reading progress bar (2px, fixed at very top) */}
      <div
        className="fixed top-0 left-0 right-0 z-50 h-0.5 bg-zinc-200 dark:bg-zinc-800"
        role="progressbar"
        aria-valuenow={Math.round(progress * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Reading progress"
      >
        <div
          className="h-full bg-zinc-600 dark:bg-zinc-400 transition-all duration-100"
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      {/* Top bar */}
      <header className="top-bar">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1 text-xs text-zinc-400 dark:text-zinc-600 min-w-0 flex-1 overflow-hidden" aria-label="Breadcrumb">
          <Link to={`/spaces/${spaceId}`} className="hover:text-zinc-600 dark:hover:text-zinc-400 transition-colors truncate max-w-[100px] shrink-0">
            {space?.name || 'Space'}
          </Link>
          {currentStage && (
            <>
              <span className="shrink-0">›</span>
              <span className="truncate text-zinc-400 dark:text-zinc-600 shrink-0 max-w-[80px]">
                {currentStage.name}
              </span>
            </>
          )}
          <span className="shrink-0">›</span>
          <span className="truncate text-zinc-600 dark:text-zinc-400 font-medium">
            {item.title}
          </span>
        </nav>

        {/* Controls */}
        <div className="flex items-center gap-2 shrink-0 relative">
          
          {/* Metrics */}
          <div className="hidden sm:flex items-center gap-2 mr-2 text-[10px] uppercase tracking-widest font-medium opacity-60">
            {settings.sessionTimerEnabled && (
              <span className={`transition-colors ${activeSeconds >= 25 * 60 ? 'text-orange-500 dark:text-orange-400' : 'text-zinc-500'}`} title="Active reading session time">
                {Math.floor(activeSeconds / 60)}m
              </span>
            )}
            {readabilityLabel && (
              <>
                <span className="text-zinc-300 dark:text-zinc-700">•</span>
                <span className="text-zinc-500">{readabilityLabel}</span>
              </>
            )}
            {item?.content_type !== 'youtube' && wordCount > 0 && (
              <>
                <span className="text-zinc-300 dark:text-zinc-700">•</span>
                <span className="text-zinc-500">~{estimatedTimeMin} min read</span>
              </>
            )}
          </div>

          <Link to="/search" className="btn-ghost btn-sm px-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300" aria-label="Search" title="Search (/)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </Link>
          <button
            className="btn-ghost btn-sm px-2 font-medium"
            onClick={() => setShowDisplayMenu(!showDisplayMenu)}
            aria-label="Display settings"
            title="Display settings"
            id="reader-font-toggle"
          >
            Aa
          </button>

          {showDisplayMenu && (
            <div className="absolute right-0 top-full mt-2 w-56 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xl rounded-lg p-4 z-50 animate-fade-in outline-none shadow-zinc-200/50 dark:shadow-black/50">
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mb-3 block">Appearance</p>
              <div className="space-y-4">
                <div>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400 block mb-1.5">Text size</span>
                  <div className="flex bg-zinc-200/50 dark:bg-zinc-950 p-1 rounded-md gap-1">
                    {['sm', 'md', 'lg'].map(sz => (
                      <button key={sz} onClick={() => updateSettings({ fontSize: sz })}
                        className={`flex-1 text-center py-1 rounded text-sm transition-all focus:outline-none ${fontSize === sz ? 'bg-white dark:bg-zinc-800 shadow-sm text-zinc-900 dark:text-zinc-100 font-medium' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'}`}>
                        {sz === 'sm' ? 'A-' : sz === 'md' ? 'A' : 'A+'}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400 block mb-1.5">Font style</span>
                  <select
                    className="select w-full text-xs py-1.5 min-h-[36px]"
                    value={fontFamily}
                    onChange={(e) => updateSettings({ fontFamily: e.target.value })}
                  >
                    <option value="sans">System Sans</option>
                    <option value="serif">Classic Serif</option>
                    <option value="mono">Monospace</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* EPUB export */}
          <div className="relative">
            <button
              className="btn-ghost btn-sm px-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
              onClick={() => { setShowExportMenu(!showExportMenu); setShowDisplayMenu(false); }}
              aria-label="Export to EPUB"
              title="Export to EPUB"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </button>
            {showExportMenu && (
              <div className="absolute right-0 top-full mt-2 w-64 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xl rounded-lg p-4 z-50 animate-fade-in outline-none shadow-zinc-200/50 dark:shadow-black/50">
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mb-3">Export to EPUB</p>
                <div className="space-y-4">
                  <div>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400 block mb-1.5">Mode</span>
                    <div className="flex bg-zinc-200/50 dark:bg-zinc-950 p-1 rounded-md gap-1">
                      {[['annotated', 'With my notes'], ['clean', 'Clean copy']].map(([val, label]) => (
                        <button
                          key={val}
                          onClick={() => setExportMode(val)}
                          className={`flex-1 text-center py-1 rounded text-xs transition-all focus:outline-none ${exportMode === val ? 'bg-white dark:bg-zinc-800 shadow-sm text-zinc-900 dark:text-zinc-100 font-medium' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'}`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {exportMode === 'annotated' && (
                    <div className="space-y-2">
                      <span className="text-xs text-zinc-500 dark:text-zinc-400 block">Include</span>
                      {[
                        [exportIncludePausePoints, setExportIncludePausePoints, 'Pause point responses'],
                        [exportIncludeNotes, setExportIncludeNotes, 'Notes'],
                        [exportIncludeHighlights, setExportIncludeHighlights, 'Highlights'],
                      ].map(([val, setter, label]) => (
                        <label key={label} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={val}
                            onChange={e => setter(e.target.checked)}
                            className="rounded"
                          />
                          <span className="text-xs text-zinc-600 dark:text-zinc-400">{label}</span>
                        </label>
                      ))}
                    </div>
                  )}
                  <button onClick={handleExportEpub} className="btn-primary btn-sm w-full text-xs">
                    Download EPUB
                  </button>
                </div>
              </div>
            )}
          </div>

          <button
            className={`btn-sm px-3 ${notesPanelOpen ? 'btn-primary' : 'btn-secondary'}`}
            onClick={toggleNotesPanel}
            aria-label={notesPanelOpen ? 'Close notes' : 'Open notes'}
            id="reader-notes-toggle"
          >
            Notes
          </button>
        </div>
      </header>

      {/* Content area */}
      <main className={`pt-14 pb-24 ${FONT_FAMILIES[fontFamily] || 'font-sans'} ${FONT_SIZES[fontSize] || 'reading-md'}`} onClick={() => { setShowDisplayMenu(false); setShowExportMenu(false); }}>
        <div className="reading-column py-8">
          {/* Meta */}
          <div className="mb-6">
            {(item.source_url || item.type) && (
              <p className="text-xs text-zinc-400 dark:text-zinc-600 mb-2">
                {TYPE_LABELS[item.type] || item.type}
                {item.source_url && (
                  <>
                    {' · '}
                    <a
                      href={item.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-zinc-600 dark:hover:text-zinc-400 transition-colors"
                    >
                      Source ↗
                    </a>
                  </>
                )}
              </p>
            )}
            <h1 className="font-medium leading-snug text-zinc-900 dark:text-zinc-100"
                style={{ fontSize: '1.45em' }}>
              {item.title}
            </h1>
          </div>

          {/* Special content banners */}
          {item?.content_type === 'pdf' && (
            <div className="mb-8 p-4 bg-zinc-100 dark:bg-zinc-800/50 rounded-lg text-sm text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700/50">
              <p><strong>Rendered from PDF</strong> — Images have been stripped and formatting may vary from the original document.</p>
            </div>
          )}
          
          {item?.content_type === 'youtube' && (
            <div className="mb-8 p-4 bg-zinc-100 dark:bg-zinc-800/50 rounded-lg text-sm text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700/50">
              <p><strong>YouTube Transcript</strong> — This is an automated transcript. Line breaks are approximate timestamps.</p>
            </div>
          )}

          {/* Article content with pause points interspersed */}
          <div ref={articleRef} className="article-body-container relative selection:bg-blue-200 dark:selection:bg-blue-900/40">
            {segments.length > 0 ? (
              segments.map((seg, i) =>
                seg.type === 'html' ? (
                  <div
                    key={i}
                    className="article-content"
                    dangerouslySetInnerHTML={{ __html: seg.content }}
                  />
                ) : (
                  <PausePoint
                    key={i}
                    itemId={itemId}
                    position={seg.position}
                    methodology={space?.methodology || 'standard'}
                    onNoteSaved={addNote}
                  />
                )
              )
            ) : (
              <div className="article-content">
                <p className="text-zinc-400 dark:text-zinc-600 italic">
                  No content available. The article may not have been fetched, or content was cleared.
                </p>
              </div>
            )}
          </div>

          {/* Completion gate */}
          <div className="mt-12">
            <CompletionGate item={item} onDone={() => setItem(i => ({ ...i, status: 'done' }))} />
          </div>
        </div>
      </main>

      {/* Desktop Highlight Toolbar */}
      {selection && (
        <div 
          className="highlight-toolbar fixed z-50 transform -translate-x-1/2 -translate-y-full pb-2 animate-fade-in"
          style={{ top: selection.rect.top, left: selection.rect.left + selection.rect.width / 2 }}
          onMouseDown={(e) => e.preventDefault()}  /* prevent focus-steal which collapses selection */
        >
          <div className="bg-zinc-900 text-white rounded-lg shadow-xl flex items-center px-2 py-1 gap-1">
            <button 
              className="p-1.5 hover:bg-zinc-800 rounded transition-colors text-yellow-400"
              title="Highlight this passage"
              onMouseDown={(e) => e.preventDefault()}  /* belt-and-suspenders for Firefox */
              onClick={() => handleCreateHighlight(selection.start_offset, selection.end_offset, selection.text)}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M20.71 7.04c.39-.39.39-1.04 0-1.41l-2.34-2.34c-.37-.39-1.02-.39-1.41 0l-1.84 1.83 3.75 3.75M3 17.25V21h3.75L17.81 9.93l-3.75-3.75L3 17.25z"/></svg>
            </button>
          </div>
        </div>
      )}


      {/* Mobile Highlight Action Button */}
      {isMobile && mobileSelection && !mobileAnnotation && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-fade-in">
          <button
            className="bg-blue-600 hover:bg-blue-700 text-white shadow-xl rounded-full px-6 py-3 font-medium flex items-center gap-2"
            onClick={(e) => {
              e.preventDefault();
              const text = Array.from(articleRef.current.querySelectorAll('.highlight-selecting'))
                .map(s => s.textContent)
                .join('');
              
              let minOffset = Infinity;
              let maxOffset = -Infinity;
              for (let i = mobileSelection.startIndex; i <= mobileSelection.endIndex; i++) {
                const s = mobileSentences[i];
                if (s) {
                  minOffset = Math.min(minOffset, s.startOffset);
                  maxOffset = Math.max(maxOffset, s.endOffset);
                }
              }
              if (minOffset !== Infinity) {
                handleCreateHighlight(minOffset, maxOffset, text);
              }
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M20.71 7.04c.39-.39.39-1.04 0-1.41l-2.34-2.34c-.37-.39-1.02-.39-1.41 0l-1.84 1.83 3.75 3.75M3 17.25V21h3.75L17.81 9.93l-3.75-3.75L3 17.25z"/></svg>
            Highlight
          </button>
        </div>
      )}

      {/* Desktop Inline Annotation Popover */}
      {inlineAnnotation && (
        <InlineAnnotationPopover 
          inlineAnnotation={inlineAnnotation}
          highlights={highlights}
          onClose={handleCloseInline}
          onSave={handleSaveAnnotation}
        />
      )}

      {/* Mobile Annotation Bottom Sheet */}
      {isMobile && mobileAnnotation && (
        <MobileAnnotationSheet
          mobileAnnotation={mobileAnnotation}
          highlights={highlights}
          onClose={handleCloseMobile}
          onSave={handleSaveAnnotation}
          onDelete={() => {
            if (confirm('Delete highlight?')) {
              api.deleteHighlight(mobileAnnotation.highlightId).then(() => {
                removeHighlight(itemId, mobileAnnotation.highlightId);
                setMobileAnnotation(null);
              });
            }
          }}
        />
      )}

      {/* Notes panel */}
      {notesPanelOpen && (
        <NotesPanel itemId={itemId} onClose={closeNotesPanel} />
      )}
    </div>
  );
}
