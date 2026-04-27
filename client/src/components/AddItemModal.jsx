import { useState, useRef } from 'react';
import { api } from '../api/client';

const ITEM_TYPES = ['article', 'video', 'book', 'paper', 'tutorial', 'project', 'other'];
const TABS = ['url', 'pdf', 'youtube', 'paste'];

export default function AddItemModal({ stageId, onClose, onAdded }) {
  const [activeTab, setActiveTab] = useState('url');
  
  // URL Tab
  const [url, setUrl] = useState('');
  
  // PDF Tab
  const [pdfFile, setPdfFile] = useState(null);
  
  // YouTube Tab
  const [ytUrl, setYtUrl] = useState('');
  
  // Paste Tab
  const [pasteHtml, setPasteHtml] = useState('');
  const [pasteTitle, setPasteTitle] = useState('');
  
  // Common
  const [type, setType] = useState('article');
  const [titleOverride, setTitle] = useState('');
  const [intent, setIntent] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const fileInputRef = useRef(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (!intent.trim()) {
        setError('Please declare why you are adding this item.');
        setLoading(false);
        return;
      }
      
      let item;
      
      if (activeTab === 'paste') {
        if (!pasteTitle.trim()) {
          setError('Please enter a title for the pasted content.');
          setLoading(false);
          return;
        }
        item = await api.createItem(stageId, {
          type,
          title: pasteTitle.trim(),
          content_html: `<div>${pasteHtml}</div>`,
          content_text: pasteHtml,
          intent: intent.trim(),
        });
      } else if (activeTab === 'pdf') {
        if (!pdfFile) {
          setError('Please select a PDF file.');
          setLoading(false);
          return;
        }
        const formData = new FormData();
        formData.append('pdf', pdfFile);
        formData.append('type', type);
        formData.append('intent', intent.trim());
        if (titleOverride.trim()) formData.append('title', titleOverride.trim());
        
        item = await api.createItem(stageId, formData);
      } else if (activeTab === 'youtube') {
        if (!ytUrl.trim()) {
          setError('Please enter a YouTube URL.');
          setLoading(false);
          return;
        }
        item = await api.createItem(stageId, {
          source_url: ytUrl.trim(),
          type: 'video',
          title: titleOverride.trim() || undefined,
          intent: intent.trim(),
        });
      } else {
        // URL
        if (!url.trim()) {
          setError('Please enter a URL.');
          setLoading(false);
          return;
        }
        item = await api.createItem(stageId, {
          source_url: url.trim(),
          type,
          title: titleOverride.trim() || undefined,
          intent: intent.trim(),
        });
      }
      
      onAdded?.(item);
      onClose();
    } catch (err) {
      setError(err.message || 'Something went wrong.');
      if (err.code === 'NOT_FOUND' || err.code === 'ACCESS_DENIED' ||
          err.code === 'TIMEOUT' || err.code === 'FETCH_FAILED' || err.code === 'NOT_HTML') {
        if (activeTab === 'url') setActiveTab('paste');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Add item">
      <div className="modal-box animate-fade-in" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-medium text-zinc-900 dark:text-zinc-100">Add item</h2>
          <button onClick={onClose} className="btn-ghost btn-sm rounded-full w-8 h-8 min-h-0 p-0
            flex items-center justify-center text-lg" aria-label="Close">
            ×
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 mb-6 border-b border-zinc-200 dark:border-zinc-800 pb-px">
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => { setActiveTab(t); setError(null); }}
              className={`pb-2 px-2 text-xs font-medium uppercase tracking-wider transition-colors relative
                ${activeTab === t ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'}`}
            >
              {t === 'url' ? 'Link' : t === 'youtube' ? 'YouTube' : t}
              {activeTab === t && <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-zinc-900 dark:bg-zinc-100" />}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          
          {activeTab === 'url' && (
            <div>
              <label className="label" htmlFor="item-url">Article URL <span className="text-zinc-400">*</span></label>
              <input
                id="item-url"
                type="url"
                className="input"
                placeholder="https://example.com/article"
                value={url}
                onChange={e => setUrl(e.target.value)}
                autoFocus
                disabled={loading}
              />
            </div>
          )}

          {activeTab === 'pdf' && (
            <div>
              <label className="label" htmlFor="item-pdf">PDF File <span className="text-zinc-400">*</span></label>
              <input
                id="item-pdf"
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                className="input cursor-pointer"
                onChange={e => setPdfFile(e.target.files[0])}
                disabled={loading}
              />
              <p className="text-[10px] text-zinc-400 mt-1">Kernvault extracts text only. Images and formatting are ignored.</p>
            </div>
          )}

          {activeTab === 'youtube' && (
            <div>
              <label className="label" htmlFor="item-yt">YouTube Video URL <span className="text-zinc-400">*</span></label>
              <input
                id="item-yt"
                type="url"
                className="input"
                placeholder="https://youtube.com/watch?v=..."
                value={ytUrl}
                onChange={e => setYtUrl(e.target.value)}
                autoFocus
                disabled={loading}
              />
              <p className="text-[10px] text-zinc-400 mt-1">Transcript will be imported. Video must have captions enabled.</p>
            </div>
          )}

          {activeTab === 'paste' && (
            <>
              <div>
                <label className="label" htmlFor="paste-title">Title <span className="text-zinc-400">*</span></label>
                <input
                  id="paste-title"
                  type="text"
                  className="input"
                  placeholder="Article title"
                  value={pasteTitle}
                  onChange={e => setPasteTitle(e.target.value)}
                  autoFocus
                  disabled={loading}
                />
              </div>
              <div>
                <label className="label" htmlFor="paste-content">Content <span className="text-zinc-400 font-normal">(paste article text)</span></label>
                <textarea
                  id="paste-content"
                  className="textarea"
                  style={{ minHeight: 160 }}
                  placeholder="Paste the article content here..."
                  value={pasteHtml}
                  onChange={e => setPasteHtml(e.target.value)}
                  disabled={loading}
                />
              </div>
            </>
          )}

          {activeTab !== 'paste' && (
            <div>
              <label className="label" htmlFor="item-title-override">Title override <span className="text-zinc-400 font-normal">(optional)</span></label>
              <input
                id="item-title-override"
                type="text"
                className="input"
                placeholder={activeTab === 'pdf' ? 'Leave blank to use filename' : 'Leave blank to use page title'}
                value={titleOverride}
                onChange={e => setTitle(e.target.value)}
                disabled={loading}
              />
            </div>
          )}

          <div>
            <label className="label" htmlFor="item-intent">
              Why are you adding this? <span className="text-red-400 text-xs">*</span>
            </label>
            <textarea
              id="item-intent"
              className="textarea"
              style={{ minHeight: 64 }}
              placeholder="e.g., I need to understand how the attention mechanism works to finish my project."
              value={intent}
              onChange={e => setIntent(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          {activeTab !== 'youtube' && (
            <div>
              <label className="label" htmlFor="item-type">Type</label>
              <select id="item-type" className="select" value={type} onChange={e => setType(e.target.value)} disabled={loading}>
                {ITEM_TYPES.map(t => (
                  <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                ))}
              </select>
            </div>
          )}

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 rounded p-2.5">
              {error}
            </p>
          )}

          {loading && (
            <div className="space-y-2">
              <div className="skeleton h-4 w-3/4" />
              <div className="skeleton h-4 w-1/2" />
              <p className="text-xs text-zinc-400 dark:text-zinc-600">Fetching and parsing content…</p>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="submit" className="btn-primary flex-1" disabled={loading}>
              {loading ? 'Fetching…' : 'Add item'}
            </button>
            <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
