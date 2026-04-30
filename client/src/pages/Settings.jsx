import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { api } from '../api/client';

function Section({ title, children }) {
  return (
    <section className="mb-8">
      <h2 className="text-xs font-medium uppercase tracking-widest text-zinc-400 dark:text-zinc-600 mb-4 px-0">
        {title}
      </h2>
      <div className="card overflow-hidden divide-y divide-zinc-100 dark:divide-zinc-900">
        {children}
      </div>
    </section>
  );
}

function SettingRow({ label, description, children }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-4 min-h-[60px]">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{label}</p>
        {description && (
          <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-0.5">{description}</p>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Toggle({ checked, onChange, id }) {
  return (
    <button
      id={id}
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 rounded-full border transition-colors duration-200 focus:outline-none
        ${checked
          ? 'bg-zinc-900 dark:bg-zinc-100 border-zinc-900 dark:border-zinc-100'
          : 'bg-transparent border-zinc-300 dark:border-zinc-700'}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full transition-transform duration-200
          ${checked
            ? 'translate-x-5 bg-zinc-50 dark:bg-zinc-900'
            : 'translate-x-0 bg-zinc-300 dark:bg-zinc-700'}`}
      />
    </button>
  );
}

function RadioGroup({ value, options, onChange, name }) {
  return (
    <div className="flex gap-1">
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          aria-pressed={value === opt.value}
          className={`px-3 py-1.5 text-sm rounded border transition-colors duration-150
            ${value === opt.value
              ? 'border-zinc-700 dark:border-zinc-300 bg-zinc-900 dark:bg-zinc-100 text-zinc-50 dark:text-zinc-900'
              : 'border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-600'}`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export default function Settings() {
  const settings        = useStore(s => s.settings);
  const updateSettings  = useStore(s => s.updateSettings);
  const markAllToursSeen = useStore(s => s.markAllToursSeen);

  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    setExporting(true);
    try {
      const blob = await api.exportData();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `kernvault-export-${new Date().toISOString().slice(0,10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed', err);
    } finally {
      setExporting(false);
    }
  }

  async function handleDeleteAll() {
    setDeleting(true);
    try {
      await api.deleteAllData();
      window.location.href = '/';
    } catch (err) {
      console.error('Delete failed', err);
      setDeleting(false);
    }
  }

  function handleResetTutorials() {
    updateSettings({
      toursDisabled: false,
      onboarding: {
        welcomeSeen: false,
        spaceTourSeen: false,
        readerTourSeen: false,
        recallTourSeen: false,
      }
    });
  }

  return (
    <div className="min-h-dvh bg-zinc-50 dark:bg-zinc-950">
      <header className="top-bar">
        <Link to="/" className="btn-ghost btn-sm px-2">← Home</Link>
        <span className="font-medium text-sm text-zinc-900 dark:text-zinc-100 mx-auto">Settings</span>
        <div className="w-16" />
      </header>

      <main className="pt-14">
        <div className="max-w-lg mx-auto px-4 py-8">
          <h1 className="sr-only">Settings</h1>

          {/* Reading */}
          <Section title="Reading">
            <SettingRow label="Default font size" description="Applies to reader view text">
              <RadioGroup
                value={settings.fontSize}
                onChange={v => updateSettings({ fontSize: v })}
                options={[
                  { value: 'sm', label: 'Small' },
                  { value: 'md', label: 'Medium' },
                  { value: 'lg', label: 'Large' },
                ]}
              />
            </SettingRow>

            <SettingRow label="Font style" description="Typeface used for rendering reading materials">
              <RadioGroup
                value={settings.fontFamily || 'sans'}
                onChange={v => updateSettings({ fontFamily: v })}
                options={[
                  { value: 'sans',  label: 'Sans' },
                  { value: 'serif', label: 'Serif' },
                  { value: 'mono',  label: 'Mono' },
                ]}
              />
            </SettingRow>
          </Section>

          {/* Appearance */}
          <Section title="Appearance">
            <SettingRow label="Color scheme" description="Follows system preference by default">
              <RadioGroup
                value={settings.darkMode}
                onChange={v => updateSettings({ darkMode: v })}
                options={[
                  { value: 'system', label: 'System' },
                  { value: 'light',  label: 'Light'  },
                  { value: 'dark',   label: 'Dark'   },
                ]}
              />
            </SettingRow>
          </Section>



          {/* Tutorials */}
          <Section title="Tutorials">
            <SettingRow
              label="Disable all tutorials"
              description="Hides the blue hint beacons and in-app tour guides everywhere"
            >
              <Toggle
                id="settings-tours-toggle"
                checked={!!settings.toursDisabled}
                onChange={v => {
                  if (v) {
                    markAllToursSeen();
                  } else {
                    updateSettings({ toursDisabled: false });
                  }
                }}
              />
            </SettingRow>
            <SettingRow
              label="Reset tutorials"
              description="Re-enables tutorials and replays the onboarding hints from scratch"
            >
              <button
                className="btn-secondary btn-sm"
                onClick={handleResetTutorials}
                id="settings-reset-tutorials-btn"
              >
                Reset
              </button>
            </SettingRow>
          </Section>

          {/* Data */}
          <Section title="Data">
            <SettingRow label="Export all data" description="Download everything as JSON">
              <button
                className="btn-secondary btn-sm"
                onClick={handleExport}
                disabled={exporting}
                id="settings-export-btn"
              >
                {exporting ? 'Exporting…' : 'Export JSON'}
              </button>
            </SettingRow>

            <SettingRow label="Delete all data" description="Permanently erases all spaces, items, and notes">
              {!deleteConfirm ? (
                <button
                  className="btn-danger btn-sm"
                  onClick={() => setDeleteConfirm(true)}
                  id="settings-delete-btn"
                >
                  Delete all
                </button>
              ) : (
                <div className="flex gap-2 items-center">
                  <span className="text-xs text-zinc-500">Are you sure?</span>
                  <button
                    className="btn-danger btn-sm"
                    onClick={handleDeleteAll}
                    disabled={deleting}
                    id="settings-delete-confirm-btn"
                  >
                    {deleting ? 'Deleting…' : 'Confirm'}
                  </button>
                  <button
                    className="btn-ghost btn-sm"
                    onClick={() => setDeleteConfirm(false)}
                  >
                    Cancel
                  </button>
                </div>
              )}
            </SettingRow>
          </Section>

          <p className="text-xs text-center text-zinc-400 dark:text-zinc-600 mt-4">
            Kernvault v2.0 — local-first, no cloud required
          </p>
        </div>
      </main>
    </div>
  );
}
