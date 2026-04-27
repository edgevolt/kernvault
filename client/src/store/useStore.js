import { create } from 'zustand';

// ─── Settings helpers ─────────────────────────────────────────────────────────
function loadSettings() {
  try {
    const raw = localStorage.getItem('kernvault_settings');
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveSettings(settings) {
  try {
    localStorage.setItem('kernvault_settings', JSON.stringify(settings));
  } catch {}
}

const defaultSettings = {
  fontSize: 'md',        // sm | md | lg
  fontFamily: 'sans',    // sans | serif | mono
  darkMode: 'system',   // system | light | dark
  voiceEnabled: false,
  aiEnabled: false,
  aiProvider: 'openai', // openai | anthropic | ollama
  aiApiKey: '',
  aiOllamaUrl: 'http://localhost:11434',
  toursDisabled: false,
  onboarding: {
    welcomeSeen: false,
    spaceTourSeen: false,
    readerTourSeen: false,
    recallTourSeen: false,
  }
};

// ─── Theme application ────────────────────────────────────────────────────────
function applyDarkMode(mode) {
  const html = document.documentElement;
  html.classList.remove('dark');
  if (mode === 'dark') {
    html.classList.add('dark');
  } else if (mode === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (prefersDark) html.classList.add('dark');
  }
}

// ─── Store ────────────────────────────────────────────────────────────────────
export const useStore = create((set, get) => {
  const savedSettings = { ...defaultSettings, ...loadSettings() };

  return {
    // ── Settings ───────────────────────────────────────────────────────────
    settings: savedSettings,

    updateSettings: (patch) => {
      const next = { ...get().settings, ...patch };
      saveSettings(next);
      if (patch.darkMode) applyDarkMode(patch.darkMode);
      set({ settings: next });
    },

    markTourSeen: (tourName) => {
      const current = get().settings;
      const nextOnboarding = { ...(current.onboarding || {}), [tourName]: true };
      const nextSettings = { ...current, onboarding: nextOnboarding };
      saveSettings(nextSettings);
      set({ settings: nextSettings });
    },

    // Mark every tour as seen AND set toursDisabled — used by 'Don't show tutorials'
    markAllToursSeen: () => {
      const current = get().settings;
      const nextSettings = {
        ...current,
        toursDisabled: true,
        onboarding: {
          welcomeSeen: true,
          spaceTourSeen: true,
          readerTourSeen: true,
          recallTourSeen: true,
        },
      };
      saveSettings(nextSettings);
      set({ settings: nextSettings });
    },

    initDarkMode: () => {
      const { darkMode } = get().settings;
      applyDarkMode(darkMode);

      // Watch system preference
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (get().settings.darkMode === 'system') {
          document.documentElement.classList.toggle('dark', e.matches);
        }
      });
    },

    // ── Spaces (lightweight list for Home screen) ──────────────────────────
    spaces: [],
    spacesLoading: false,
    setSpaces: (spaces) => set({ spaces }),
    setSpacesLoading: (v) => set({ spacesLoading: v }),

    // ── Current space (full detail with stages + items) ────────────────────
    currentSpace: null,
    currentSpaceLoading: false,
    setCurrentSpace: (space) => set({ currentSpace: space }),
    setCurrentSpaceLoading: (v) => set({ currentSpaceLoading: v }),

    // ── Current item (reader view) ─────────────────────────────────────────
    currentItem: null,
    currentItemLoading: false,
    setCurrentItem: (item) => set({ currentItem: item }),
    setCurrentItemLoading: (v) => set({ currentItemLoading: v }),

    // ── Notes panel ────────────────────────────────────────────────────────
    notesPanelOpen: false,
    notes: [],
    notesLoading: false,
    toggleNotesPanel: () => set((s) => ({ notesPanelOpen: !s.notesPanelOpen })),
    closeNotesPanel: () => set({ notesPanelOpen: false }),
    setNotes: (notes) => set({ notes }),
    addNote: (note) => set((s) => ({ notes: [...s.notes, note] })),
    removeNote: (id) => set((s) => ({ notes: s.notes.filter(n => n.id !== id) })),

    // ── Highlights ─────────────────────────────────────────────────────────
    highlights: {}, // { [itemId]: Highlight[] }
    setHighlights: (itemId, hls) => set((s) => ({ highlights: { ...s.highlights, [itemId]: hls } })),
    addHighlight: (itemId, hl) => set((s) => ({
      highlights: { ...s.highlights, [itemId]: [...(s.highlights[itemId] || []), hl] }
    })),
    updateHighlight: (itemId, hl) => set((s) => ({
      highlights: {
        ...s.highlights,
        [itemId]: (s.highlights[itemId] || []).map(h => h.id === hl.id ? hl : h)
      }
    })),
    removeHighlight: (itemId, id) => set((s) => ({
      highlights: {
        ...s.highlights,
        [itemId]: (s.highlights[itemId] || []).filter(h => h.id !== id)
      }
    })),
  };
});
