import { useState } from 'react';
import { api } from '../api/client';

const PROMPTS = {
  standard: [
    "What's the key idea in what you just read?",
    "How does this connect to something you already know?",
    "What surprised you most so far?",
    "Can you summarise this section in one sentence?",
    "What question does this raise for you?",
    "What's still unclear after reading this section?",
    "How might you apply this idea?",
  ],
  feynman: [
    "How would you explain the last few paragraphs to a beginner?",
    "What analogy could be used to describe this core concept?",
    "Identify any jargon used in this section and define it simply.",
    "If you were teaching this concept, what alternative example would you use?",
    "What is the absolute simplest way to summarize the argument just made?",
    "Where is the gap in your ability to teach this to someone right now?",
  ],
  socratic: [
    "What assumptions are being made in this argument?",
    "Is there an edge case where this reasoning breaks down?",
    "What is an opposing viewpoint or counter-argument to this idea?",
    "Why does the author believe this to be true, and are you entirely convinced?",
    "What evidence is missing or glossed over in this section?",
    "How might this concept be interpreted differently from another perspective?",
  ],
};

// Deterministically pick a prompt based on item ID + position
function pickPrompt(itemId, position, methodology) {
  const seed = (itemId || '').charCodeAt(0) + position;
  const list = PROMPTS[methodology] || PROMPTS.standard;
  return list[seed % list.length];
}

export default function PausePoint({ itemId, position, methodology, onNoteSaved }) {
  const prompt = pickPrompt(itemId, position, methodology);
  const [text, setText]       = useState('');
  const [saved, setSaved]     = useState(false);
  const [skipped, setSkipped] = useState(false);
  const [saving, setSaving]   = useState(false);

  if (skipped) return null;

  async function handleSave() {
    if (!text.trim()) return;
    setSaving(true);
    try {
      // Save both a pause point record and a note
      await api.createPausePoint(itemId, { position, prompt, response: text.trim() });
      const note = await api.createNote(itemId, { body: text.trim(), source: 'pause_point' });
      onNoteSaved?.(note);
      setSaved(true);
    } catch (err) {
      console.error('Failed to save pause point', err);
    } finally {
      setSaving(false);
    }
  }

  if (saved) {
    return (
      <div className="pause-block animate-fade-in">
        <p className="text-xs font-medium uppercase tracking-widest text-zinc-400 dark:text-zinc-600 mb-1">
          Pause point
        </p>
        <p className="text-sm text-zinc-500 dark:text-zinc-500 italic">Note saved ✓</p>
      </div>
    );
  }

  return (
    <div className="pause-block" role="region" aria-label="Pause point">
      <p className="text-xs font-medium uppercase tracking-widest text-zinc-400 dark:text-zinc-600 mb-2">
        Pause &amp; reflect
      </p>
      <p className="text-sm text-zinc-700 dark:text-zinc-300 mb-3">{prompt}</p>
      <textarea
        className="textarea text-sm mb-3"
        placeholder="Write your thoughts…"
        value={text}
        onChange={e => setText(e.target.value)}
        rows={3}
        aria-label="Pause point response"
      />
      <div className="flex gap-2">
        <button
          className="btn-secondary btn-sm"
          onClick={handleSave}
          disabled={saving || !text.trim()}
        >
          {saving ? 'Saving…' : 'Save note'}
        </button>
        <button
          className="btn-ghost btn-sm"
          onClick={() => setSkipped(true)}
        >
          Skip
        </button>
      </div>
    </div>
  );
}
