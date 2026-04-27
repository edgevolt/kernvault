import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';

const COL_W = 280;
const ITEM_H = 64;
const GAP_Y = 16;
const HEADER_H = 48;
const PADDING = 24;

export default function LearningMap({ spaceId, readOnly = false }) {
  const navigate = useNavigate();
  const [data, setData] = useState({ stages: [], discovery_questions: [], item_connections: [] });
  const [loading, setLoading] = useState(true);
  
  const [selectedItem, setSelectedItem] = useState(null);
  const [popoverItem, setPopoverItem] = useState(null);
  const [selectedConn, setSelectedConn] = useState(null);
  
  const [connectingFromId, setConnectingFromId] = useState(null);
  const [connectPair, setConnectPair] = useState(null); // { src, tgt }
  const [connectStep, setConnectStep] = useState(null); // 'direction' | 'label'
  const [connectLabel, setConnectLabel] = useState('');
  const [saving, setSaving] = useState(false);
  
  const [zoom, setZoom] = useState(1);
  const [linkQuestionId, setLinkQuestionId] = useState(null); // Linking FROM question TO item
  const [linkingQuestionToItemId, setLinkingQuestionToItemId] = useState(null); // Linking FROM item TO question
  
  const containerRef = useRef(null);
  const dragRef = useRef({ isDown: false, startX: 0, startY: 0, scrollLeft: 0, scrollTop: 0, moved: false });

  const fetchMap = useCallback(async () => {
    if (!spaceId) return;
    try {
      const res = await api.getLearningMap(spaceId);
      setData(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [spaceId]);

  useEffect(() => {
    fetchMap();
  }, [fetchMap]);

  // Compute item positions for SVG lines
  const itemPositions = useMemo(() => {
    const pos = {};
    data.stages.forEach((stage, colIdx) => {
      stage.items.forEach((item, rowIdx) => {
        pos[item.id] = {
          x: PADDING + colIdx * COL_W + (COL_W - 40) / 2,
          y: PADDING + HEADER_H + rowIdx * (ITEM_H + GAP_Y) + (ITEM_H / 2)
        };
      });
    });
    return pos;
  }, [data.stages]);

  const allItems = useMemo(() => data.stages.flatMap(s => s.items), [data.stages]);
  const unansweredQuestions = data.discovery_questions.filter(q => !q.answered_by);

  const connectedNodeIds = useMemo(() => {
    if (!selectedItem) return new Set();
    const set = new Set();
    data.item_connections.forEach(conn => {
      if (conn.source_item_id === selectedItem) set.add(conn.target_item_id);
      if (conn.target_item_id === selectedItem) set.add(conn.source_item_id);
    });
    return set;
  }, [selectedItem, data.item_connections]);

  function handleItemClick(item) {
    if (dragRef.current.moved) return;
    if (readOnly) return;
    
    if (linkQuestionId) {
      setSaving(true);
      api.linkQuestion(linkQuestionId, { answered_by: item.id })
        .then(() => {
          setLinkQuestionId(null);
          fetchMap();
        })
        .finally(() => setSaving(false));
      return;
    }

    if (connectingFromId) {
      if (connectingFromId === item.id) {
        setConnectingFromId(null);
        return;
      }
      const src = allItems.find(i => i.id === connectingFromId);
      setConnectPair({ src, tgt: item });
      setConnectStep('direction');
      setConnectingFromId(null);
      return;
    }

    if (selectedItem === item.id) {
      setPopoverItem(popoverItem === item.id ? null : item.id);
    } else {
      setSelectedItem(item.id);
      setPopoverItem(null);
    }
    setSelectedConn(null);
  }

  async function handleConnect(srcId, tgtId, label) {
    setSaving(true);
    try {
      await api.createItemConnection({ space_id: spaceId, source_item_id: srcId, target_item_id: tgtId, label });
      await fetchMap();
    } catch (e) { console.error(e); }
    setConnectStep(null);
    setConnectPair(null);
    setConnectLabel('');
    setSaving(false);
  }

  async function handleDeleteConnection(connId) {
    setSaving(true);
    try {
      await api.deleteItemConnection(connId);
      await fetchMap();
      setSelectedConn(null);
    } catch (e) { console.error(e); }
    setSaving(false);
  }
  
  async function handleUnlinkQuestion(qId) {
    setSaving(true);
    try {
      await api.linkQuestion(qId, { answered_by: null });
      await fetchMap();
    } catch (e) { console.error(e); }
    setSaving(false);
  }

  function handleLinkItemToQuestion(qId) {
    if (!linkingQuestionToItemId) return;
    setSaving(true);
    api.linkQuestion(qId, { answered_by: linkingQuestionToItemId })
      .then(() => {
        setLinkingQuestionToItemId(null);
        fetchMap();
      })
      .finally(() => setSaving(false));
  }

  if (loading) return <div className="p-8 text-sm text-zinc-500">Loading map...</div>;

  const totalCols = data.stages.length;
  const maxRows = Math.max(0, ...data.stages.map(s => s.items.length));
  
  const canvasWidth = Math.max(800, PADDING * 2 + totalCols * COL_W);
  const canvasHeight = Math.max(600, PADDING * 2 + HEADER_H + maxRows * (ITEM_H + GAP_Y));

  function getNodeStyle(item) {
    if (item.status === 'done' || item.status === 'done_quick') {
      return 'bg-zinc-900 dark:bg-zinc-200 text-white dark:text-zinc-900 border-zinc-900 dark:border-zinc-200';
    }
    if (item.status === 'reading' || item.status === 'paused' || item.status === 'summarizing') {
      return 'bg-zinc-100 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 border-zinc-300 dark:border-zinc-500';
    }
    return 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-400 border-zinc-300 dark:border-zinc-700 border-dashed opacity-80';
  }

  return (
    <div className="relative border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 shadow-sm overflow-hidden flex flex-col h-[75vh]">
      
      {/* Top Toolbar / Questions (Hidden if empty) */}
      {data.discovery_questions.length > 0 && (
        <div className="shrink-0 bg-white dark:bg-zinc-950 px-4 pt-4 pb-2 z-20 relative">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Discovery Questions</h3>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 hide-scrollbar">
            {data.discovery_questions.map(q => {
              const answeredItem = q.answered_by ? allItems.find(i => i.id === q.answered_by) : null;
              const isLinking = linkQuestionId === q.id;
              
              return (
                <div key={q.id} className={`shrink-0 w-64 p-3 rounded-lg border transition-colors flex flex-col
                  ${answeredItem 
                    ? 'border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 opacity-75' 
                    : isLinking 
                      ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20 shadow-inner' 
                      : 'border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 shadow-sm hover:border-zinc-400'}`}>
                  <p className="line-clamp-2 text-zinc-800 dark:text-zinc-200 font-medium text-xs mb-2 leading-snug" title={q.body}>{q.body}</p>
                  
                  {answeredItem ? (
                    <div className="flex items-center justify-between mt-auto pt-2 border-t border-zinc-200 dark:border-zinc-800">
                      <span className="text-xs text-zinc-500 dark:text-zinc-400 truncate max-w-[150px]" title={answeredItem.title}>Ans: {answeredItem.title}</span>
                      <button onClick={() => handleUnlinkQuestion(q.id)} disabled={saving || readOnly}
                        className="text-xs text-zinc-500 hover:text-red-500 dark:text-zinc-400 dark:hover:text-red-400 uppercase font-medium">Unlink</button>
                    </div>
                  ) : (
                    <div className="mt-auto pt-2">
                      <button 
                        onClick={() => setLinkQuestionId(isLinking ? null : q.id)} 
                        disabled={saving || readOnly}
                        className={`text-[10px] uppercase tracking-widest font-bold ${isLinking ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'}`}>
                        {isLinking ? 'Select an item below' : 'Link to item →'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Map Area */}
      <div className="flex-1 relative overflow-hidden flex flex-col">
        {/* Right Fade Overlay for scroll cue */}
        <div className="absolute top-0 right-0 bottom-0 w-16 bg-gradient-to-l from-zinc-50 dark:from-zinc-950 to-transparent pointer-events-none z-20" />
        
        <div 
          ref={containerRef}
          className="flex-1 overflow-auto relative cursor-grab active:cursor-grabbing"
          onMouseDown={(e) => {
            dragRef.current = {
              isDown: true,
              startX: e.pageX - containerRef.current.offsetLeft,
              startY: e.pageY - containerRef.current.offsetTop,
              scrollLeft: containerRef.current.scrollLeft,
              scrollTop: containerRef.current.scrollTop,
              moved: false
            };
          }}
          onMouseLeave={() => dragRef.current.isDown = false}
          onMouseUp={() => dragRef.current.isDown = false}
          onMouseMove={(e) => {
            if (!dragRef.current.isDown || !containerRef.current) return;
            e.preventDefault();
            const x = e.pageX - containerRef.current.offsetLeft;
            const y = e.pageY - containerRef.current.offsetTop;
            const walkX = (x - dragRef.current.startX);
            const walkY = (y - dragRef.current.startY);
            if (Math.abs(walkX) > 5 || Math.abs(walkY) > 5) dragRef.current.moved = true;
            containerRef.current.scrollLeft = dragRef.current.scrollLeft - walkX;
            containerRef.current.scrollTop = dragRef.current.scrollTop - walkY;
          }}
        >
        <div 
          className="relative transform-origin-top-left transition-transform duration-200"
          style={{ 
            width: canvasWidth, 
            height: canvasHeight,
            transform: `scale(${zoom})`,
            transformOrigin: '0 0'
          }}
          onClick={(e) => {
            if (dragRef.current.moved) return;
            if (e.target === containerRef.current || e.target.closest('svg')) {
              setSelectedItem(null);
              setPopoverItem(null);
              setSelectedConn(null);
              setLinkQuestionId(null);
            }
          }}
        >
          {/* SVG Connection Layer */}
          <svg className="absolute inset-0 pointer-events-none z-0" style={{ width: canvasWidth, height: canvasHeight }}>
            <defs>
              <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
                <path d="M0,0 L0,8 L8,4 z" className="fill-zinc-400 dark:fill-zinc-500" />
              </marker>
              <marker id="arrow-selected" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
                <path d="M0,0 L0,8 L8,4 z" className="fill-zinc-600 dark:fill-zinc-300" />
              </marker>
              <marker id="arrow-faded" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
                <path d="M0,0 L0,8 L8,4 z" className="fill-zinc-200 dark:fill-zinc-800" />
              </marker>
            </defs>
            {data.item_connections.map(conn => {
              const src = itemPositions[conn.source_item_id];
              const tgt = itemPositions[conn.target_item_id];
              if (!src || !tgt) return null;
              
              const isSelectedConn = selectedConn === conn.id;
              const isConnActive = !selectedItem || conn.source_item_id === selectedItem || conn.target_item_id === selectedItem;
              
              const isSameCol = src.x === tgt.x;
              let startX, startY, endX, endY;
              
              if (isSameCol) {
                  startX = src.x;
                  startY = src.y + (tgt.y > src.y ? 36 : -36);
                  endX = tgt.x;
                  endY = tgt.y + (tgt.y > src.y ? -44 : 44);
              } else {
                  const isForward = tgt.x > src.x;
                  startX = src.x + (isForward ? 124 : -124);
                  startY = src.y;
                  endX = tgt.x + (isForward ? -132 : 132);
                  endY = tgt.y;
              }

              const dx = Math.abs(tgt.x - src.x);
              const isSkip = dx > COL_W + 50;

              let cp1y = startY;
              let cp2y = endY;
              let cp1x, cp2x;

              if (isSameCol) {
                  cp1x = startX;
                  cp2x = startX;
              } else if (isSkip) {
                  const arcHeight = 110;
                  cp1y += arcHeight;
                  cp2y += arcHeight;
                  cp1x = startX + (startX < endX ? 60 : -60);
                  cp2x = endX + (startX < endX ? -60 : 60);
              } else {
                  cp1x = startX + (endX - startX) * 0.5;
                  cp2x = startX + (endX - startX) * 0.5;
              }

              const pathD = `M ${startX},${startY} C ${cp1x},${cp1y} ${cp2x},${cp2y} ${endX},${endY}`;
              
              const mx = (startX + endX) / 2;
              const my = 0.125 * startY + 0.375 * cp1y + 0.375 * cp2y + 0.125 * endY;
              
              return (
                <g key={conn.id} className="pointer-events-auto cursor-pointer" onClick={() => setSelectedConn(isSelectedConn ? null : conn.id)}>
                  {/* Invisible wider path for easier clicking */}
                  <path d={pathD} fill="none" stroke="transparent" strokeWidth={24} />
                  <path 
                    d={pathD} fill="none"
                    stroke={isSelectedConn ? '#52525b' : isConnActive ? '#a1a1aa' : '#e4e4e7'} 
                    className={`transition-all ${isSelectedConn ? "dark:stroke-zinc-300" : isConnActive ? "dark:stroke-zinc-400" : "dark:stroke-zinc-800 opacity-30"}`}
                    strokeWidth={isSelectedConn ? 3 : isConnActive ? 2 : 1.5} 
                    markerEnd={isSelectedConn ? "url(#arrow-selected)" : isConnActive ? "url(#arrow)" : "url(#arrow-faded)"}
                  />
                  {conn.label && (
                    <g>
                      <rect x={mx - conn.label.length * 3.5} y={my - 10} width={conn.label.length * 7} height={20} rx={4}
                        className={`fill-white dark:fill-zinc-900 border ${isSelected ? 'border-zinc-400 dark:border-zinc-500' : 'border-zinc-200 dark:border-zinc-800'}`} />
                      <text x={mx} y={my + 4} textAnchor="middle" fontSize={10} className={`font-medium ${isSelected ? 'fill-zinc-700 dark:fill-zinc-200' : 'fill-zinc-400 dark:fill-zinc-500'}`}>{conn.label}</text>
                    </g>
                  )}
                </g>
              );
            })}
          </svg>

          {/* Columns */}
          <div className="absolute inset-0 p-6 flex gap-10 pointer-events-none">
            {data.stages.map((stage, i) => (
              <div key={stage.id} className="w-[240px] shrink-0 pointer-events-auto">
                <h2 className="h-12 text-[15px] font-bold uppercase tracking-[0.15em] text-zinc-500 dark:text-zinc-400 flex items-center border-b border-zinc-200 dark:border-zinc-800 mb-4">
                  {stage.name}
                </h2>
                
                <div className="space-y-4">
                  {stage.items.length === 0 ? (
                    <div className="h-[64px] border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-lg flex items-center justify-center opacity-50">
                      <span className="text-xs text-zinc-400">Empty</span>
                    </div>
                  ) : (
                    stage.items.map(item => {
                      const isSelected = selectedItem === item.id;
                      const isConnected = connectedNodeIds.has(item.id);
                      const isUnrelated = selectedItem && !isSelected && !isConnected;

                      const isTargetLink = linkQuestionId !== null;
                      const isConnectTarget = connectingFromId !== null && connectingFromId !== item.id;
                      
                      const styleClass = getNodeStyle(item);
                      
                      return (
                        <div key={item.id} className="relative">
                          <div 
                            className={`h-[64px] px-4 rounded-lg border transition-all cursor-pointer shadow-sm flex items-center gap-3
                              ${styleClass}
                              ${isSelected ? 'ring-2 ring-zinc-500 dark:ring-zinc-400 scale-105 z-20' : isConnected ? 'ring-2 ring-zinc-300 dark:ring-zinc-600 scale-105 z-20 shadow-md' : 'hover:scale-[1.02] z-10'}
                              ${isTargetLink || isConnectTarget ? 'animate-pulse ring-2 ring-blue-400 border-blue-400 bg-blue-50 dark:bg-blue-900/30' : ''}
                              ${isUnrelated ? 'opacity-40 grayscale-[50%]' : ''}
                            `}
                            onClick={() => handleItemClick(item)}
                          >
                            <span className="text-sm shrink-0 opacity-80 text-zinc-500 dark:text-zinc-400">
                              {item.type === 'video' || item.type === 'youtube' ? '▶' : '📄'}
                            </span>
                            <span className="text-[14px] font-medium w-full line-clamp-3 leading-tight">
                              {item.title}
                            </span>
                          </div>

                          {/* Action Popover */}
                          {popoverItem === item.id && !connectingFromId && !linkQuestionId && (
                            <div className="absolute top-[72px] left-1/2 -translate-x-1/2 w-48 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-xl z-50 animate-fade-in py-1">
                              {/* Anchor arrow */}
                              <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white dark:bg-zinc-900 border-t border-l border-zinc-200 dark:border-zinc-700 rotate-45" />
                              
                              <div className="relative bg-white dark:bg-zinc-900 z-10 rounded-lg overflow-hidden">
                                <button className="w-full text-left px-4 py-2.5 text-xs text-zinc-900 dark:text-white hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors font-semibold"
                                  onClick={(e) => { e.stopPropagation(); navigate(`/spaces/${spaceId}/items/${item.id}`); }}>
                                  Open Item
                                </button>
                                <div className="border-t border-zinc-100 dark:border-zinc-800" />
                                <button className="w-full text-left px-4 py-2 text-xs text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                                  onClick={(e) => { e.stopPropagation(); setConnectingFromId(item.id); setSelectedItem(null); setPopoverItem(null); }}>
                                  Connect to...
                                </button>
                                <button className="w-full text-left px-4 py-2 text-xs text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                                  onClick={(e) => { e.stopPropagation(); setLinkingQuestionToItemId(item.id); setSelectedItem(null); setPopoverItem(null); }}>
                                  Link Question
                                </button>
                                {(item.status === 'done' || item.status === 'done_quick') && (
                                  <button className="w-full text-left px-4 py-2 text-xs text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                                    onClick={(e) => { e.stopPropagation(); navigate(`/spaces/${spaceId}/items/${item.id}?tab=notes`); }}>
                                    View Notes
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            ))}
          </div>
          </div>
        </div>
      </div>

      {/* Floating Zoom Controls */}
      <div className="absolute bottom-6 right-6 flex items-center bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-full shadow-sm z-30 overflow-hidden">
        <button className="px-3 py-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors" onClick={() => setZoom(z => Math.max(0.5, z - 0.25))}>-</button>
        <span className="text-[10px] font-medium text-zinc-500 w-10 text-center select-none">{Math.round(zoom * 100)}%</span>
        <button className="px-3 py-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors" onClick={() => setZoom(z => Math.min(1.5, z + 0.25))}>+</button>
      </div>

      {/* Persistent Connection Bar */}
      {connectingFromId && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-blue-500 text-white rounded-full px-5 py-2.5 shadow-lg flex items-center gap-4 animate-fade-in z-30">
          <span className="text-xs font-medium">Select another item to connect to</span>
          <div className="w-px h-4 bg-blue-400" />
          <button className="text-xs text-blue-100 hover:text-white" onClick={() => setConnectingFromId(null)}>Cancel</button>
        </div>
      )}

      {/* Link Question to Item Modal */}
      {linkingQuestionToItemId && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-zinc-900/20 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 w-full max-w-sm shadow-xl">
            <h4 className="text-sm font-medium mb-4">Link to Discovery Question</h4>
            {unansweredQuestions.length === 0 ? (
              <p className="text-xs text-zinc-500 mb-4">No unanswered questions available.</p>
            ) : (
              <div className="space-y-2 mb-4 max-h-64 overflow-y-auto">
                {unansweredQuestions.map(q => (
                  <button key={q.id} onClick={() => handleLinkItemToQuestion(q.id)} disabled={saving}
                    className="w-full text-left p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 text-xs">
                    {q.body}
                  </button>
                ))}
              </div>
            )}
            <button className="text-xs text-zinc-500 w-full hover:text-zinc-800 dark:hover:text-zinc-200" onClick={() => setLinkingQuestionToItemId(null)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Connection Direction / Label Modals */}
      {connectStep === 'direction' && connectPair && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-zinc-900/20 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5 w-full max-w-xs shadow-xl flex flex-col items-center">
            <h4 className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-4">Direction</h4>
            <div className="space-y-3 mb-5 w-full">
              <button className="w-full text-center p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600 bg-zinc-50 dark:bg-zinc-900 transition-colors text-xs flex flex-col items-center gap-1.5"
                onClick={() => setConnectStep('label')}>
                <span className="font-medium text-zinc-800 dark:text-zinc-200 line-clamp-1">{connectPair.src.title}</span>
                <span className="text-zinc-400 text-[10px]">↓ leads to ↓</span>
                <span className="font-medium text-zinc-800 dark:text-zinc-200 line-clamp-1">{connectPair.tgt.title}</span>
              </button>
              <button className="w-full text-center p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600 bg-zinc-50 dark:bg-zinc-900 transition-colors text-xs flex flex-col items-center gap-1.5"
                onClick={() => { setConnectPair(p => ({ src: p.tgt, tgt: p.src })); setConnectStep('label'); }}>
                <span className="font-medium text-zinc-800 dark:text-zinc-200 line-clamp-1">{connectPair.tgt.title}</span>
                <span className="text-zinc-400 text-[10px]">↓ leads to ↓</span>
                <span className="font-medium text-zinc-800 dark:text-zinc-200 line-clamp-1">{connectPair.src.title}</span>
              </button>
            </div>
            <button className="text-[10px] uppercase font-bold text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors" onClick={() => { setConnectStep(null); setConnectPair(null); }}>Cancel</button>
          </div>
        </div>
      )}

      {connectStep === 'label' && connectPair && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-zinc-900/20 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 w-full max-w-sm shadow-xl">
            <h4 className="text-sm font-medium mb-3">Label this connection (optional)</h4>
            <input className="input text-sm w-full mb-3" placeholder="e.g. requires, leads to, contradicts..." value={connectLabel} onChange={e => setConnectLabel(e.target.value)} autoFocus />
            <div className="flex flex-wrap gap-1.5 mb-5">
              {['requires', 'leads to', 'is a type of', 'contradicts', 'supports'].map(l => (
                <button key={l} onClick={() => setConnectLabel(l)}
                  className={`text-[10px] px-2 py-1 rounded border ${connectLabel === l ? 'border-zinc-800 bg-zinc-100 dark:bg-zinc-800 dark:border-zinc-200' : 'border-zinc-200 dark:border-zinc-700'}`}>
                  {l}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button className="btn-ghost flex-1 text-xs" onClick={() => handleConnect(connectPair.src.id, connectPair.tgt.id, null)} disabled={saving}>Skip Label</button>
              <button className="btn-primary flex-1 text-xs" onClick={() => handleConnect(connectPair.src.id, connectPair.tgt.id, connectLabel)} disabled={saving}>Connect</button>
            </div>
          </div>
        </div>
      )}

      {/* Selected Connection Actions */}
      {!readOnly && selectedConn && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-full px-5 py-2.5 shadow-lg flex items-center gap-4 animate-fade-in z-30">
          <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Connection selected</span>
          <div className="w-px h-4 bg-zinc-200 dark:bg-zinc-800" />
          <button className="text-xs text-red-500 hover:text-red-600 font-medium" onClick={() => handleDeleteConnection(selectedConn)}>Delete</button>
          <button className="text-xs text-zinc-400 hover:text-zinc-600" onClick={() => setSelectedConn(null)}>Cancel</button>
        </div>
      )}
    </div>
  );
}
