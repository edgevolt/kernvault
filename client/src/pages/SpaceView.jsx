import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { api } from '../api/client';
import { useStore } from '../store/useStore';
import ItemRow from '../components/ItemRow';
import AddItemModal from '../components/AddItemModal';
import ProgressBar from '../components/ProgressBar';
import SpaceSettingsModal from '../components/SpaceSettingsModal';
import LearningMap from '../components/LearningMap';
import SynthesisCanvas from '../components/SynthesisCanvas';
import ReflectionTrail from '../components/ReflectionTrail';
import JourneyTimeline from '../components/JourneyTimeline';
import Tour from '../components/Tour';

function SkeletonView() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-10 space-y-8">
      <div className="space-y-2">
        <div className="skeleton h-7 w-1/2 rounded" />
        <div className="skeleton h-4 w-3/4 rounded" />
        <div className="skeleton h-1 w-full rounded mt-4" />
      </div>
      {[1,2].map(i => (
        <div key={i} className="space-y-2">
          <div className="skeleton h-5 w-1/3 rounded" />
          <div className="skeleton h-12 w-full rounded" />
          <div className="skeleton h-12 w-full rounded" />
        </div>
      ))}
    </div>
  );
}

function StageSection({ stage, spaceId, allStages, onItemAdded, onStatusChange, onItemClick, onMoveItem, onDeleteItem, onRemoveStage, onRenameStage, bulkSelectMode, selectedItems, toggleSelection }) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState(stage.name);
  const items = stage.items || [];
  const doneCount = items.filter(i => i.status === 'done').length;

  // Prerequisite indicator
  const prereqStage = stage.prerequisite_stage_id
    ? allStages.find(s => s.id === stage.prerequisite_stage_id)
    : null;
  const prereqDone = prereqStage ? (prereqStage.items || []).filter(i => i.status === 'done').length : 0;
  const prereqTotal = prereqStage ? (prereqStage.items || []).length : 0;
  const prereqRatio = prereqTotal > 0 ? prereqDone / prereqTotal : 1;
  const showPrereqHint = prereqStage && prereqRatio < 0.8;

  function handleAdded(item) { onItemAdded?.(item, stage.id); }
  function handleItemStatusChange(itemId, status) { onStatusChange?.(itemId, status, stage.id); }
  function handleRenameSubmit() {
    const trimmed = editTitle.trim();
    if (trimmed !== stage.name && trimmed.length > 0) onRenameStage?.(stage.id, trimmed);
    else setEditTitle(stage.name);
    setIsEditingTitle(false);
  }

  return (
    <section className="mb-8" aria-labelledby={`stage-${stage.id}`}>
      <div className="flex items-center justify-between px-4 mb-2">
        <div className="flex-1 min-w-0">
          {isEditingTitle ? (
            <input className="text-xs font-medium uppercase tracking-widest text-zinc-900 dark:text-zinc-100 bg-transparent border-b border-zinc-400 dark:border-zinc-500 focus:outline-none w-1/2 min-w-0"
              value={editTitle} onChange={e => setEditTitle(e.target.value)}
              onBlur={handleRenameSubmit} onKeyDown={e => e.key === 'Enter' && handleRenameSubmit()} autoFocus />
          ) : (
            <h2 id={`stage-${stage.id}`}
              className="text-xs font-medium uppercase tracking-widest text-zinc-400 dark:text-zinc-600 cursor-pointer hover:text-zinc-600 dark:hover:text-zinc-400 transition-colors"
              onClick={() => { setIsEditingTitle(true); setEditTitle(stage.name); }} title="Click to rename">
              {stage.name}
            </h2>
          )}
          {showPrereqHint && (
            <p className="text-[10px] text-zinc-400 dark:text-zinc-600 mt-0.5 flex items-center gap-1">
              <span>○</span> Recommended: finish {prereqStage.name} first ({Math.round(prereqRatio * 100)}% done)
            </p>
          )}
        </div>
        <div className="flex gap-3 items-center">
          {items.length === 0 && allStages.length > 1 && (
            <button className="text-[10px] uppercase tracking-wider text-zinc-400 hover:text-zinc-600 dark:text-zinc-600 dark:hover:text-zinc-400 transition-colors"
              onClick={() => onRemoveStage?.(stage.id)} title="Remove empty section">Remove</button>
          )}
          <span className="text-xs text-zinc-400 dark:text-zinc-600">{doneCount}/{items.length}</span>
        </div>
      </div>

      {/* Items */}
      <div className="card overflow-hidden">
        <Droppable droppableId={stage.id} isDropDisabled={bulkSelectMode}>
          {(provided) => (
            <div 
              ref={provided.innerRef} 
              {...provided.droppableProps}
              className={`min-h-[60px] relative ${items.length > 0 ? 'divide-y divide-zinc-100 dark:divide-zinc-900' : ''}`}
            >
              {items.length === 0 && (
                <p className="px-4 py-5 text-sm text-zinc-400 dark:text-zinc-600 text-center absolute inset-0 flex items-center justify-center pointer-events-none">
                  No items yet.
                </p>
              )}
              {items.map((item, index) => (
                <Draggable key={item.id} draggableId={item.id} index={index} isDragDisabled={bulkSelectMode}>
                  {(dragProvided) => (
                    <ItemRow
                      item={item}
                      stages={allStages}
                      onStatusChange={handleItemStatusChange}
                      onClick={bulkSelectMode ? () => toggleSelection(item.id) : () => onItemClick?.(item, stage)}
                      onMove={(i, target) => onMoveItem?.(i, target, stage.id)}
                      onDelete={(i) => onDeleteItem?.(i, stage.id)}
                      selectable={bulkSelectMode}
                      selected={selectedItems.includes(item.id)}
                      onSelect={() => toggleSelection(item.id)}
                      dragProvided={dragProvided}
                    />
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>

        {/* Add item */}
        <button
          className="w-full px-4 py-3 text-sm text-zinc-400 dark:text-zinc-600
                     hover:bg-zinc-50 dark:hover:bg-zinc-900
                     hover:text-zinc-600 dark:hover:text-zinc-400
                     transition-colors text-left border-t border-zinc-100 dark:border-zinc-900"
          onClick={() => setShowAddModal(true)}
          id={`stage-${stage.id}-add-item`}
        >
          + Add item
        </button>
      </div>

      {showAddModal && (
        <AddItemModal
          stageId={stage.id}
          onClose={() => setShowAddModal(false)}
          onAdded={handleAdded}
        />
      )}
    </section>
  );
}

export default function SpaceView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [space, setSpace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [totalDone, setTotalDone]   = useState(0);
  const [totalItems, setTotalItems] = useState(0);
  const [bulkSelectMode, setBulkSelectMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState([]);
  const [bulkTargetStage, setBulkTargetStage] = useState('');
  const [movingBulk, setMovingBulk] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deletingSpace, setDeletingSpace] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [activeTab, setActiveTab] = useState('list');
  const [mapMode, setMapMode] = useState(() => {
    // Will be updated once we have the spaceId from params
    return 'overview';
  });
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [recallCount, setRecallCount] = useState(0);
  const moreMenuRef = useRef(null);

  const settings       = useStore(s => s.settings);
  const updateSettings = useStore(s => s.updateSettings);
  const markTourSeen   = useStore(s => s.markTourSeen);

  // Close 'More' dropdown when clicking outside it
  useEffect(() => {
    if (!showMoreMenu) return;
    function handleClickOutside(e) {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target)) {
        setShowMoreMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMoreMenu]);

  useEffect(() => {
    setLoading(true);
    api.getSpace(id)
      .then(data => {
        setSpace(data);
        setTotalDone(Number(data.done_items) || 0);
        setTotalItems(Number(data.total_items) || 0);
        if (data.stages?.length > 0) setBulkTargetStage(data.stages[0].id);
      })
      .catch(() => setError('Space not found.'))
      .finally(() => setLoading(false));

    api.getRecallQueue()
      .then(data => {
        setRecallCount(data.filter(i => i.space_id === id).length);
      })
      .catch(console.error);

    // Restore persisted map sub-mode for this space
    const savedMode = localStorage.getItem(`map_mode_${id}`);
    if (savedMode === 'synthesis' || savedMode === 'overview') setMapMode(savedMode);
  }, [id]);

  function handleStatusChange(itemId, status, stageId) {
    setSpace(s => ({
      ...s,
      stages: s.stages.map(st => st.id === stageId ? { ...st, items: st.items.map(i => i.id === itemId ? { ...i, status } : i) } : st)
    }));
    setTotalDone(prev => (status === 'done' ? prev + 1 : Math.max(0, prev - 1)));
  }

  function handleItemAdded(item, stageId) {
    setSpace(s => ({
      ...s,
      stages: s.stages.map(st => st.id === stageId ? { ...st, items: [...st.items, item] } : st)
    }));
    setTotalItems(t => t + 1);
  }

  function handleItemClick(item, stage) {
    navigate(`/spaces/${id}/items/${item.id}`);
  }

  async function handleMoveItem(item, targetStageId, sourceStageId) {
    if (targetStageId === sourceStageId) return;
    try {
      const updatedItem = await api.updateItem(item.id, { stage_id: targetStageId });
      setSpace(s => ({
        ...s,
        stages: s.stages.map(st => {
          if (st.id === sourceStageId) return { ...st, items: st.items.filter(i => i.id !== item.id) };
          if (st.id === targetStageId) return { ...st, items: [...st.items, updatedItem] };
          return st;
        })
      }));
    } catch (err) {
      console.error('Failed to move item', err);
    }
  }

  function toggleSelection(itemId) {
    setSelectedItems(prev => prev.includes(itemId) ? prev.filter(id => id !== itemId) : [...prev, itemId]);
  }

  const handleExport = () => {
    window.open(`/api/spaces/${space.id}/export/annotations`, '_blank');
    setShowMoreMenu(false);
  };

  const handleSaveTemplate = async () => {
    setShowMoreMenu(false);
    const name = window.prompt("Enter a name for this new template:");
    if (!name?.trim()) return;
    
    try {
      const templateData = {
        name: name.trim(),
        description: `Created from ${space.name}`,
        stages: space.stages.map(s => s.name)
      };
      await api.createTemplate(templateData);
      alert('Template saved successfully!');
    } catch (e) {
      alert('Failed to save template: ' + e.message);
    }
  };

  async function handleBulkMove() {
    if (selectedItems.length === 0 || !bulkTargetStage) return;
    setMovingBulk(true);
    try {
      const moves = selectedItems.map(itemId => api.updateItem(itemId, { stage_id: bulkTargetStage }));
      await Promise.all(moves);

      // Re-fetch space completely to cleanly synchronize states
      const data = await api.getSpace(id);
      setSpace(data);
      setSelectedItems([]);
      setBulkSelectMode(false);
    } catch (err) {
      alert('Failed to execute bulk move completely.');
    } finally {
      setMovingBulk(false);
    }
  }

  async function handleDragEnd(result) {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return; // No change

    setSpace(prev => {
      // Deep clone stages structure to modify cleanly
      const newSpace = { ...prev, stages: prev.stages.map(s => ({ ...s, items: [...(s.items || [])] })) };
      const srcStage = newSpace.stages.find(s => s.id === source.droppableId);
      const destStage = newSpace.stages.find(s => s.id === destination.droppableId);

      // Mutate sequence locally
      const [movedItem] = srcStage.items.splice(source.index, 1);
      movedItem.stage_id = destination.droppableId;
      destStage.items.splice(destination.index, 0, movedItem);

      // Reconcile and buffer backend tracking sequence requests
      let moves = [];
      newSpace.stages.forEach(s => {
        if (s.id === source.droppableId || s.id === destination.droppableId) {
          s.items.forEach((it, idx) => {
            const newOrder = idx + 1;
            if (it.order !== newOrder || (it.id === draggableId && s.id === destination.droppableId)) {
               it.order = newOrder;
               moves.push({ id: it.id, order: it.order, stage_id: s.id });
            }
          });
        }
      });
      
      // Async fire and forget the patch loop.
      if (moves.length > 0) {
        api.reorderItems({ items: moves }).catch(e => console.error("Item drag reorder failed:", e));
      }

      return newSpace;
    });
  }

  async function handleDeleteItem(item, stageId) {
    try {
      await api.deleteItem(item.id);
      setSpace(s => ({
        ...s,
        stages: s.stages.map(st => st.id === stageId ? { ...st, items: st.items.filter(i => i.id !== item.id) } : st)
      }));
      setTotalItems(t => Math.max(0, t - 1));
      if (item.status === 'done') setTotalDone(t => Math.max(0, t - 1));
    } catch (err) {
      console.error('Failed to delete item', err);
    }
  }

  async function handleRemoveStage(stageId) {
    if (!window.confirm("Remove this section?")) return;
    try {
      await api.deleteStage(stageId);
      setSpace(s => ({ ...s, stages: s.stages.filter(st => st.id !== stageId) }));
    } catch (err) {
      alert(err.message || 'Could not delete stage');
    }
  }

  async function handleRenameStage(stageId, newName) {
    try {
      await api.updateStage(stageId, { name: newName });
      setSpace(s => ({
        ...s,
        stages: s.stages.map(st => st.id === stageId ? { ...st, name: newName } : st)
      }));
    } catch (err) {
      console.error('Rename failed', err);
    }
  }

  async function handleAddStage() {
    const name = window.prompt("New section name:");
    if (!name?.trim()) return;
    try {
      const newStage = await api.createStage(id, { name: name.trim() });
      setSpace(s => ({ ...s, stages: [...s.stages, { ...newStage, items: [] }] }));
    } catch (err) {
      alert(err.message || 'Could not create stage');
    }
  }

  async function handleDeleteSpace() {
    setDeletingSpace(true);
    try {
      await api.deleteSpace(id);
      navigate('/');
    } catch (err) {
      console.error('Space deletion failed', err);
      alert('Failed to delete space: ' + err.message);
      setDeletingSpace(false);
      setDeleteConfirm(false);
    }
  }

  if (loading) return (
    <div className="min-h-dvh bg-zinc-50 dark:bg-zinc-950 pt-14">
      <div className="top-bar">
        <Link to="/" className="btn-ghost btn-sm px-2">← Home</Link>
      </div>
      <SkeletonView />
    </div>
  );

  if (error) return (
    <div className="min-h-dvh bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
      <div className="text-center">
        <p className="text-zinc-500 mb-4">{error}</p>
        <Link to="/" className="btn-secondary btn-sm">← Back home</Link>
      </div>
    </div>
  );

  const ratio = totalItems > 0 ? totalDone / totalItems : 0;

  // Pace Companion — uses pace_weeks (spec v1.6), falls back to target_duration_days / 7
  const paceWeeks = space.pace_weeks ?? (space.target_duration_days ? Math.round(space.target_duration_days / 7) : null);
  const createdAt = new Date(space.created_at).getTime();
  const daysElapsed = Math.max((Date.now() - createdAt) / (1000 * 60 * 60 * 24), 0);

  let paceMessage = null;
  if (paceWeeks) {
    if (totalDone === 0) {
      paceMessage = 'Start reading to see your pace.';
    } else if (daysElapsed > 2 && totalDone < totalItems) {
      const pacePerDay = totalDone / daysElapsed;
      const remaining = totalItems - totalDone;
      const projectedWeeks = Math.max(1, Math.ceil((remaining / pacePerDay) / 7));
      if (projectedWeeks <= paceWeeks) {
        paceMessage = 'You\'re on pace to finish within your plan.';
      } else {
        paceMessage = `At your current pace, you'll finish in about ${projectedWeeks} ${projectedWeeks === 1 ? 'week' : 'weeks'} — your plan is ${paceWeeks} ${paceWeeks === 1 ? 'week' : 'weeks'}.`;
      }
    }
  }

  // Dormancy nudge — threshold is 7 days per spec v1.6, only shown if pace_weeks was set
  const updatedAt = new Date(space.updated_at).getTime();
  const daysUnvisited = (Date.now() - updatedAt) / (1000 * 60 * 60 * 24);
  const showNudge = paceWeeks && daysUnvisited >= 7;

  const handleDismissNudge = () => {
    api.updateSpace(space.id, {}).catch(e => console.error('Silent touch error:', e));
    setSpace(s => ({ ...s, updated_at: new Date().toISOString() }));
  };

  return (
    <div className="min-h-dvh bg-zinc-50 dark:bg-zinc-950">
      {/* Top bar */}
      <header className="top-bar">
        <Link to="/" className="btn-ghost btn-sm px-2" aria-label="Back to home">
          ← Home
        </Link>
        <div className="flex-1" />
        <Link to="/search" className="btn-ghost btn-sm px-2" aria-label="Search" title="Search (/)">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </Link>
        <Link to="/settings" className="btn-ghost btn-sm px-2" aria-label="Settings">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
          </svg>
        </Link>
      </header>

      <main className="pt-14">
        {!settings.onboarding?.spaceTourSeen && !loading && !error && (
          <Tour 
            run={true}
            steps={[
              {
                target: '[id^="stage-"][id$="-add-item"]',
                title: 'Adding Items',
                content: 'Click here to add reading material. You can paste a web article URL, and Kernvault will automatically extract the clean text for you to study. You can also paste raw text manually.',
                disableBeacon: false,
                placement: 'top'
              },
              {
                target: '#space-add-section',
                title: 'Organize your Space',
                content: 'As your library grows, use Sections to organize items. You might sort them by topic (e.g., "Theory" vs "Practice") or by priority.',
                disableBeacon: false,
                placement: 'top'
              },
              {
                target: '#space-tabs-nav',
                title: 'Explore your progress',
                content: 'Switch views here! The Map tab shows your concept map. Use the More menu for Reflection Trail and Journey Timeline.',
                disableBeacon: false,
                placement: 'bottom'
              }
            ]}
            onFinish={() => markTourSeen('spaceTourSeen')}
          />
        )}
        <div className={`mx-auto px-4 py-8 transition-all duration-300 ${activeTab === 'map' ? 'w-full max-w-[95%] 2xl:max-w-[1600px]' : 'max-w-2xl'}`}>

          {/* Nudge Notification */}
          {showNudge && (
             <div className="mb-6 px-4 py-3 rounded-lg bg-zinc-100/50 dark:bg-zinc-800/30 border border-zinc-200/50 dark:border-zinc-700/30 flex justify-between items-center animate-fade-in shadow-sm">
               <span className="text-sm text-zinc-500 dark:text-zinc-400">
                 You haven't visited this Space in {Math.floor(daysUnvisited)} days.
               </span>
               <button onClick={handleDismissNudge} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 pb-0.5 text-lg" aria-label="Dismiss">
                 ×
               </button>
             </div>
          )}

          {/* Space header */}
          <div className="mb-8 animate-fade-in relative">
            {recallCount > 0 && (
              <div className="mb-4 text-[11px] font-medium uppercase tracking-widest text-zinc-500 bg-zinc-100 dark:bg-zinc-800/50 py-1.5 px-3 inline-flex items-center gap-2 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors cursor-pointer" onClick={() => navigate(`/recall?space_id=${id}`)}>
                <div className="w-1.5 h-1.5 rounded-full bg-zinc-900 dark:bg-zinc-100" />
                {recallCount} item{recallCount !== 1 ? 's' : ''} in this space ready for recall →
              </div>
            )}
            <div className="flex justify-between items-start gap-4">
              <div className="flex-1">
                <h1 className="font-medium text-2xl text-zinc-900 dark:text-zinc-100 mb-1 leading-snug">
                  {space.name}
                </h1>
                {space.intent && (
                  <p className="text-sm italic text-zinc-500 dark:text-zinc-500 mb-2">
                    {space.intent}
                  </p>
                )}
                <button 
                  onClick={() => setShowSettingsModal(true)} 
                  className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 underline block mt-2"
                >
                  Edit space settings
                </button>
              </div>
              
              {/* Enable Bulk Mode button */}
              {totalItems > 0 && !bulkSelectMode && (
                <button
                  className="btn-ghost btn-sm border border-zinc-200 dark:border-zinc-800 text-xs shrink-0 mt-1 h-8"
                  onClick={() => setBulkSelectMode(true)}
                >
                  Bulk select
                </button>
              )}
            </div>

            {/* Inline Bulk Action Bar */}
            {bulkSelectMode && (
              <div className="mt-2 mb-4 p-3 bg-zinc-100 dark:bg-zinc-800/50 rounded-lg flex items-center justify-between border border-zinc-200 dark:border-zinc-700 animate-fade-in sm:flex-row flex-col gap-3 sm:gap-0">
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300 shrink-0">
                    {selectedItems.length} selected
                  </span>
                  <div className="h-4 w-px bg-zinc-300 dark:bg-zinc-600 block shrink-0" />
                  <select
                    className="select bg-white dark:bg-zinc-900 text-sm py-1 px-2 min-h-[32px] w-full sm:w-[180px]"
                    value={bulkTargetStage}
                    onChange={e => setBulkTargetStage(e.target.value)}
                  >
                    {(space.stages || []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  <button
                    className="btn-primary btn-sm min-h-[32px] px-3 shrink-0"
                    disabled={movingBulk || selectedItems.length === 0}
                    onClick={handleBulkMove}
                  >
                    {movingBulk ? '...' : 'Move'}
                  </button>
                </div>
                <button 
                  className="btn-ghost btn-sm min-h-[32px] text-zinc-500 w-full sm:w-auto"
                  onClick={() => { setBulkSelectMode(false); setSelectedItems([]); }}
                >
                  Cancel
                </button>
              </div>
            )}

            <div className="flex items-center gap-3 mt-4">
              <ProgressBar value={ratio} size="sm" className="flex-1" />
              <span className="text-xs text-zinc-400 dark:text-zinc-600 shrink-0">
                {totalDone} of {totalItems} done
              </span>
            </div>
            {/* Pace companion */}
            {paceMessage && (
              <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-2">{paceMessage}</p>
            )}

            {/* Tabs: Journey | Map, with overflow for Trail/Timeline */}
            <div id="space-tabs-nav" className="flex items-center mt-8 border-b border-zinc-200 dark:border-zinc-800">
              {/* Scrollable primary tabs */}
              <div className="flex items-center gap-6 overflow-x-auto hide-scrollbar flex-1">
                {[
                  { id: 'list', label: 'Journey' },
                  { id: 'map', label: 'Map', badge: 'Early release' },
                ].map(tab => (
                  <button key={tab.id} id={`tab-${tab.id}`} onClick={() => setActiveTab(tab.id)}
                    className={`pb-3 text-xs font-medium uppercase tracking-wider transition-colors relative shrink-0 flex items-center gap-2 ${activeTab === tab.id ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300'}`}>
                    {tab.label}
                    {tab.badge && (
                      <span className="px-1.5 py-0.5 rounded-full bg-orange-100 dark:bg-orange-900/30 text-[9px] text-orange-600 dark:text-orange-400 font-bold tracking-widest normal-case">
                        {tab.badge}
                      </span>
                    )}
                    {activeTab === tab.id && <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-zinc-900 dark:bg-zinc-100" />}
                  </button>
                ))}
              </div>

              {/* More — outside the scrollable area so dropdown isn't clipped */}
              <div className="relative shrink-0 pb-px" ref={moreMenuRef}>
                <button
                  onClick={() => setShowMoreMenu(v => !v)}
                  className={`pb-3 pl-4 text-xs font-medium uppercase tracking-wider transition-colors relative
                    ${['trail','timeline'].includes(activeTab)
                      ? 'text-zinc-900 dark:text-zinc-100'
                      : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300'}`}
                >
                  More ▾
                  {['trail','timeline'].includes(activeTab) && (
                    <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-zinc-900 dark:bg-zinc-100" />
                  )}
                </button>
                {showMoreMenu && (
                  <div className="absolute right-0 top-full mt-1 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-lg py-1 z-50 w-44 animate-fade-in">
                    {[
                      { id: 'trail',    label: 'Reflection Trail' },
                      { id: 'timeline', label: 'Journey Timeline' },
                    ].map(tab => (
                      <button
                        key={tab.id}
                        onClick={() => { setActiveTab(tab.id); setShowMoreMenu(false); }}
                        className={`w-full text-left px-4 py-2.5 text-xs transition-colors
                          ${activeTab === tab.id
                            ? 'text-zinc-900 dark:text-zinc-100 font-medium bg-zinc-50 dark:bg-zinc-900'
                            : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-900'}`}
                      >
                        {tab.label}
                      </button>
                    ))}
                    <div className="my-1 border-t border-zinc-100 dark:border-zinc-800" />
                    <button
                      onClick={handleExport}
                      className="w-full text-left px-4 py-2.5 text-xs transition-colors text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                    >
                      Export Annotations
                    </button>
                    <button
                      onClick={handleSaveTemplate}
                      className="w-full text-left px-4 py-2.5 text-xs transition-colors text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                    >
                      Save as Template
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {activeTab === 'list' && (
            <div className="animate-fade-in">
              {/* Stages wrapped in Drag Context */}
          <DragDropContext onDragEnd={handleDragEnd}>
            {(space.stages || []).map(stage => (
              <StageSection
                key={stage.id}
                stage={stage}
                spaceId={id}
                allStages={space.stages}
                onItemAdded={handleItemAdded}
                onStatusChange={handleStatusChange}
                onItemClick={handleItemClick}
                onMoveItem={handleMoveItem}
                onDeleteItem={handleDeleteItem}
                onRemoveStage={handleRemoveStage}
                onRenameStage={handleRenameStage}
                bulkSelectMode={bulkSelectMode}
                selectedItems={selectedItems}
                toggleSelection={toggleSelection}
              />
            ))}
          </DragDropContext>

          {/* Add Section */}
          <div className="mt-8 mb-16">
            <button
              className="btn-ghost btn-sm w-full border border-dashed border-zinc-300 dark:border-zinc-700"
              onClick={handleAddStage}
              id="space-add-section"
            >
              + Add Section
            </button>
          </div>
          </div>
          )}

          {activeTab === 'map' && (
            <div className="animate-fade-in">
              {/* Map mode toggle */}
              <div className="map-mode-toggle mb-4">
                <button
                  className={mapMode === 'overview' ? 'active' : ''}
                  onClick={() => { setMapMode('overview'); localStorage.setItem(`map_mode_${id}`, 'overview'); }}
                >
                  Overview
                </button>
                <button
                  className={mapMode === 'synthesis' ? 'active' : ''}
                  onClick={() => { setMapMode('synthesis'); localStorage.setItem(`map_mode_${id}`, 'synthesis'); }}
                >
                  Synthesis
                </button>
              </div>

              {mapMode === 'overview' && <LearningMap spaceId={space.id} />}
              {mapMode === 'synthesis' && <SynthesisCanvas spaceId={space.id} space={space} />}
            </div>
          )}

          {activeTab === 'trail' && (
            <div className="animate-fade-in">
              <ReflectionTrail spaceId={space.id} />
            </div>
          )}

          {activeTab === 'timeline' && (
            <div className="animate-fade-in">
              <JourneyTimeline space={space} />
            </div>
          )}

          {/* Destructive Zone */}
          <div className="mt-24 mb-32 pt-8 border-t border-red-500/10 flex justify-center">
            {!deleteConfirm ? (
              <button 
                className="text-xs text-red-400 hover:text-red-500 transition-colors"
                onClick={() => setDeleteConfirm(true)}
              >
                Delete this entire Space
              </button>
            ) : (
              <div className="flex gap-4 items-center bg-red-50/50 dark:bg-red-950/20 px-5 py-3 rounded-xl border border-red-200/50 dark:border-red-900/30 animate-fade-in shadow-sm">
                <span className="text-xs text-red-600 dark:text-red-400 font-bold uppercase tracking-widest">Destroy Space forever?</span>
                <button 
                  className="btn-danger btn-sm text-xs py-1.5 min-h-[30px]"
                  onClick={handleDeleteSpace}
                  disabled={deletingSpace}
                >
                  {deletingSpace ? '...' : 'Yes, erase'}
                </button>
                <button 
                  className="text-xs font-medium text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                  onClick={() => setDeleteConfirm(false)}
                  disabled={deletingSpace}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
          
          {showSettingsModal && (
            <SpaceSettingsModal 
              space={space} 
              onClose={() => setShowSettingsModal(false)}
              onUpdated={(updated) => setSpace(prev => ({ ...prev, ...updated }))}
            />
          )}

        </div>
      </main>
    </div>
  );
}
