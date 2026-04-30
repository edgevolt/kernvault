import { useEffect, useCallback, useRef, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactFlow, {
  ReactFlowProvider,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  useReactFlow,
  useViewport,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { api } from '../api/client';
import { useStore } from '../store/useStore';

import {
  SynthesisItemNode,
  SynthesisHighlightNode,
  SynthesisPauseNode,
  SynthesisFreetextNode,
} from './SynthesisNodes';
import { SynthesisEdge, SynthesisEdgeMarkers } from './SynthesisEdge';
import SynthesisSidebar from './SynthesisSidebar';
import { FirstUseOverlay, SynthesisToolbar } from './SynthesisUI';
import GhostLayer from './GhostLayer';

// ─── Constants ────────────────────────────────────────────────────────────────
const CANVAS_W = 4000;
const CANVAS_H = 3000;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 1.5;
const NODE_MIN_W = 180;
const NODE_MIN_H = 80;
const NODE_MAX_W = 360;
const NODE_MAX_H = 240;

// React Flow node type registry
const nodeTypes = {
  item:        SynthesisItemNode,
  highlight:   SynthesisHighlightNode,
  pause_point: SynthesisPauseNode,
  freetext:    SynthesisFreetextNode,
};

const edgeTypes = {
  synthesis: SynthesisEdge,
};

// ─── Build node data for React Flow from DB records ───────────────────────────
function buildRFNode(dbNode, handlers, space) {
  const { onColorChange, onDelete, onContentSave, onOpenSource } = handlers;
  const stageIndex = (space?.stages || []).findIndex(s =>
    (s.items || []).some(i => i.id === dbNode.source_id)
  );

  let nodeData = { color: dbNode.color, onColorChange: (c) => onColorChange(dbNode.id, c), onDelete: () => onDelete(dbNode.id) };

  if (dbNode.type === 'item') {
    const stage = space?.stages?.[stageIndex];
    const item  = stage?.items?.find(i => i.id === dbNode.source_id);
    nodeData = { ...nodeData, title: item?.title || dbNode.content, reflection: item?.reflection, stageName: stage?.name, stageIndex: Math.max(0, stageIndex), type: item?.type, onOpenSource: () => onOpenSource(dbNode.source_id) };
  } else if (dbNode.type === 'highlight') {
    const content = JSON.parse(dbNode.content || '{}');
    nodeData = { ...nodeData, selectedText: content.selectedText || dbNode.content, annotation: content.annotation, itemTitle: content.itemTitle, onOpenSource: () => onOpenSource(content.itemId) };
  } else if (dbNode.type === 'pause_point') {
    const content = JSON.parse(dbNode.content || '{}');
    nodeData = { ...nodeData, prompt: content.prompt, response: content.response || dbNode.content, itemTitle: content.itemTitle, onOpenSource: () => onOpenSource(content.itemId) };
  } else if (dbNode.type === 'freetext') {
    nodeData = { ...nodeData, content: dbNode.content, onContentSave: (text) => onContentSave(dbNode.id, text) };
  }

  return {
    id: dbNode.id,
    type: dbNode.type,
    position: { x: dbNode.x, y: dbNode.y },
    style: { width: dbNode.width, height: undefined },
    data: nodeData,
    draggable: true,
  };
}

function buildRFEdge(dbConn, handlers) {
  return {
    id: dbConn.id,
    source: dbConn.source_node_id,
    target: dbConn.target_node_id,
    sourceHandle: dbConn.source_handle,
    targetHandle: dbConn.target_handle,
    type: 'synthesis',
    data: {
      label: dbConn.label,
      hasArrow: dbConn.has_arrow === 1,
      onLabelSave: (label) => handlers.onLabelSave(dbConn.id, label),
      onDelete: () => handlers.onDeleteEdge(dbConn.id),
    },
  };
}

// ─── Inner canvas component (needs to be inside ReactFlowProvider) ────────────
function SynthesisCanvasInner({ spaceId, space, isMobile }) {
  const navigate = useNavigate();
  const rfInstance = useReactFlow();
  const { zoom } = useViewport();

  const { synthesisNodes: storeNodes, synthesisConnections: storeConns, synthesisFetched,
          setSynthesisData, addSynthesisNode, updateSynthesisNode, removeSynthesisNode,
          addSynthesisConnection, updateSynthesisConnection, removeSynthesisConnection } = useStore();

  const [rfNodes, setRfNodes, onNodesChange] = useNodesState([]);
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState([]);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [ghostVisible, setGhostVisible] = useState(() => {
    const v = localStorage.getItem(`synthesis_ghost_${spaceId}`);
    return v === null ? true : v === 'true';
  });
  const [showFirstUse, setShowFirstUse] = useState(false);
  const [newEdgePending, setNewEdgePending] = useState(null); // edge id awaiting label
  const reactFlowWrapper = useRef(null);

  // ── Handlers (stable refs to avoid stale closures in node data) ──────────────
  const handleColorChange = useCallback(async (nodeId, color) => {
    try {
      const updated = await api.updateSynthesisNode(nodeId, { color });
      updateSynthesisNode(spaceId, nodeId, { color: updated.color });
    } catch (e) { console.error(e); }
  }, [spaceId, updateSynthesisNode]);

  const handleDeleteNode = useCallback(async (nodeId) => {
    try {
      await api.deleteSynthesisNode(nodeId);
      removeSynthesisNode(spaceId, nodeId);
    } catch (e) { console.error(e); }
  }, [spaceId, removeSynthesisNode]);

  const handleContentSave = useCallback(async (nodeId, content) => {
    try {
      const updated = await api.updateSynthesisNode(nodeId, { content });
      updateSynthesisNode(spaceId, nodeId, { content: updated.content });
    } catch (e) { console.error(e); }
  }, [spaceId, updateSynthesisNode]);

  const handleOpenSource = useCallback((itemId) => {
    navigate(`/spaces/${spaceId}/items/${itemId}`);
  }, [navigate, spaceId]);

  const nodeHandlers = useMemo(() => ({
    onColorChange: handleColorChange,
    onDelete: handleDeleteNode,
    onContentSave: handleContentSave,
    onOpenSource: handleOpenSource,
  }), [handleColorChange, handleDeleteNode, handleContentSave, handleOpenSource]);

  // ── Sync store → React Flow ──────────────────────────────────────────────────
  useEffect(() => {
    const dbNodes = storeNodes[spaceId] || [];
    const dbConns = storeConns[spaceId] || [];
    setRfNodes(dbNodes.map(n => buildRFNode(n, nodeHandlers, space)));
    setRfEdges(dbConns.map(c => buildRFEdge(c, {
      onLabelSave: handleLabelSave,
      onDeleteEdge: handleDeleteEdge,
    })));
  }, [storeNodes[spaceId], storeConns[spaceId], nodeHandlers, space]);

  // ── Initial data fetch ───────────────────────────────────────────────────────
  useEffect(() => {
    if (synthesisFetched[spaceId]) return;
    api.getSynthesisData(spaceId).then(({ nodes, connections }) => {
      setSynthesisData(spaceId, nodes, connections);
    }).catch(console.error);
  }, [spaceId, synthesisFetched]);

  // ── First-use overlay ────────────────────────────────────────────────────────
  useEffect(() => {
    const key = `synthesis_first_use_${spaceId}`;
    if (!localStorage.getItem(key)) {
      setShowFirstUse(true);
    }
  }, [spaceId]);

  function handleFirstUseDismiss() {
    localStorage.setItem(`synthesis_first_use_${spaceId}`, 'true');
    setShowFirstUse(false);
    setSidebarOpen(true);
    if (isMobile) setMobileSidebarOpen(true);
  }

  // ── Ghost layer toggle ───────────────────────────────────────────────────────
  function toggleGhost() {
    const next = !ghostVisible;
    setGhostVisible(next);
    localStorage.setItem(`synthesis_ghost_${spaceId}`, String(next));
  }

  // ── Node drag end — save position ─────────────────────────────────────────────
  async function handleNodeDragStop(_, node) {
    // Clamp to canvas bounds
    const x = Math.max(0, Math.min(node.position.x, CANVAS_W - (node.style?.width || 220)));
    const y = Math.max(0, Math.min(node.position.y, CANVAS_H - 120));
    try {
      await api.updateSynthesisNode(node.id, { x, y });
      updateSynthesisNode(spaceId, node.id, { x, y });
    } catch (e) { console.error(e); }
  }

  // ── Edge connection complete ──────────────────────────────────────────────────
  async function handleConnect(params) {
    if (params.source === params.target) return;
    
    // Optimistic visual update so the line stays immediately
    setRfEdges((eds) => addEdge({ ...params, type: 'synthesis' }, eds));

    try {
      const newConn = await api.createSynthesisConnection({
        space_id: spaceId,
        source_node_id: params.source,
        target_node_id: params.target,
        source_handle: params.sourceHandle || null,
        target_handle: params.targetHandle || null,
        label: null,
      });
      addSynthesisConnection(spaceId, newConn);
      // Trigger label prompt on the new edge
      setNewEdgePending(newConn.id);
    } catch (e) {
      // 409 = duplicate connection, silently ignore
      if (e.status !== 409) console.error(e);
      // If the API fails, the next store sync will automatically clean up the optimistic edge
    }
  }

  async function handleLabelSave(connId, label) {
    try {
      const updated = await api.updateSynthesisConnection(connId, { label });
      updateSynthesisConnection(spaceId, connId, { label: updated.label });
    } catch (e) { console.error(e); }
    if (newEdgePending === connId) setNewEdgePending(null);
  }

  async function handleDeleteEdge(connId) {
    try {
      await api.deleteSynthesisConnection(connId);
      removeSynthesisConnection(spaceId, connId);
    } catch (e) { console.error(e); }
  }

  // ── Add node from sidebar ─────────────────────────────────────────────────────
  async function handleAddNode({ type, sourceData, atCenter, position }) {
    let x = 200, y = 200;

    if (atCenter) {
      const vp = rfInstance.getViewport();
      const rect = reactFlowWrapper.current?.getBoundingClientRect();
      if (rect) {
        x = (rect.width / 2 - vp.x) / vp.zoom;
        y = (rect.height / 2 - vp.y) / vp.zoom;
      }
    } else if (position) {
      x = position.x;
      y = position.y;
    }

    // Clamp
    x = Math.max(0, Math.min(x, CANVAS_W - 220));
    y = Math.max(0, Math.min(y, CANVAS_H - 120));

    let payload = { space_id: spaceId, type, x, y };

    if (type === 'freetext') {
      payload.content = '';
    } else if (type === 'item') {
      const { item, stage, stageIndex } = sourceData;
      payload.source_id = item.id;
      payload.content = item.title;
    } else if (type === 'highlight') {
      const { highlight, item } = sourceData;
      payload.source_id = highlight.id;
      payload.content = JSON.stringify({
        selectedText: highlight.selected_text,
        annotation: highlight.annotation,
        itemTitle: item?.title,
        itemId: item?.id,
      });
    } else if (type === 'pause_point') {
      const { pausePoint, item } = sourceData;
      payload.source_id = pausePoint.id;
      payload.content = JSON.stringify({
        prompt: pausePoint.prompt,
        response: pausePoint.response,
        itemTitle: item?.title,
        itemId: item?.id,
      });
    }

    try {
      const newNode = await api.createSynthesisNode(payload);
      addSynthesisNode(spaceId, newNode);
    } catch (e) {
      console.error('Failed to add node:', e);
    }
  }

  // ── Drop from sidebar onto canvas ─────────────────────────────────────────────
  function handleDrop(e) {
    e.preventDefault();
    const raw = e.dataTransfer.getData('application/synthesis-node');
    if (!raw) return;
    const { type, sourceData } = JSON.parse(raw);
    const rect = reactFlowWrapper.current?.getBoundingClientRect();
    const vp = rfInstance.getViewport();
    const position = {
      x: (e.clientX - rect.left - vp.x) / vp.zoom,
      y: (e.clientY - rect.top  - vp.y) / vp.zoom,
    };
    handleAddNode({ type, sourceData, position });
  }

  function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }

  return (
    <div className="synthesis-canvas-root" ref={reactFlowWrapper}>
      {/* SVG arrow marker */}
      <SynthesisEdgeMarkers />

      {/* Sidebar — desktop */}
      {!isMobile && sidebarOpen && (
        <SynthesisSidebar
          space={space}
          synthesisNodes={storeNodes[spaceId] || []}
          onAddNode={handleAddNode}
          isMobile={false}
        />
      )}

      {/* Collapse/expand toggle for desktop sidebar */}
      {!isMobile && (
        <button
          onClick={() => setSidebarOpen(v => !v)}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-30 w-5 h-10 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-r-lg flex items-center justify-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 shadow-sm transition-colors"
          style={{ left: sidebarOpen ? 260 : 0 }}
          title={sidebarOpen ? 'Collapse sidebar' : 'Open content sidebar'}
        >
          {sidebarOpen ? '‹' : '›'}
        </button>
      )}

      {/* Ghost layer — behind React Flow */}
      {ghostVisible && (
        <GhostLayer spaceId={spaceId} visible={ghostVisible} />
      )}

      {/* React Flow canvas */}
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={handleConnect}
        onNodeDragStop={handleNodeDragStop}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        minZoom={MIN_ZOOM}
        maxZoom={MAX_ZOOM}
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
        translateExtent={[[0, 0], [CANVAS_W, CANVAS_H]]}
        preventScrolling={true}
        fitView={false}
        proOptions={{ hideAttribution: true }}
        className="synthesis-reactflow"
      >
        <Background variant="dots" gap={24} size={1} className="synthesis-bg" />
      </ReactFlow>

      {/* Synthesis Toolbar (top-right) */}
      <SynthesisToolbar
        ghostVisible={ghostVisible}
        onGhostToggle={toggleGhost}
        zoom={zoom}
        onZoomReset={() => rfInstance.setViewport({ x: 0, y: 0, zoom: 1 }, { duration: 300 })}
      />

      {/* Mobile: floating "+" button */}
      {isMobile && (
        <button
          onClick={() => setMobileSidebarOpen(true)}
          className="absolute bottom-6 right-6 z-30 w-12 h-12 rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-lg flex items-center justify-center text-xl hover:scale-105 transition-transform"
        >
          +
        </button>
      )}

      {/* Mobile sidebar drawer */}
      {isMobile && (
        <SynthesisSidebar
          space={space}
          synthesisNodes={storeNodes[spaceId] || []}
          onAddNode={handleAddNode}
          isMobile={true}
          mobileOpen={mobileSidebarOpen}
          onMobileClose={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* First-use overlay */}
      {showFirstUse && <FirstUseOverlay onDismiss={handleFirstUseDismiss} />}
    </div>
  );
}

// ─── Public export — wraps with ReactFlowProvider ─────────────────────────────
export default function SynthesisCanvas({ spaceId, space }) {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  return (
    <ReactFlowProvider>
      <SynthesisCanvasInner spaceId={spaceId} space={space} isMobile={isMobile} />
    </ReactFlowProvider>
  );
}
