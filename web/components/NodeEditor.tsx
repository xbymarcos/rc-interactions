
import React, { useState, useRef, useCallback } from 'react';
import { ProjectData, DialogueNode, Connection, NodeType, WorldCoords } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { fetchNui } from '../utils/fetchNui';

interface NodeEditorProps {
  project: ProjectData;
  setProject: React.Dispatch<React.SetStateAction<ProjectData>>;
}

interface ActiveConnection {
  fromNodeId: string;
  fromPort: string;
  mouseX: number;
  mouseY: number;
}

const NodeEditor: React.FC<NodeEditorProps> = ({ project, setProject }) => {
  const { t } = useLanguage();
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [dragNodeId, setDragNodeId] = useState<string | null>(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const [activeConn, setActiveConn] = useState<ActiveConnection | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number } | null>(null);
  
  // History State
  const [history, setHistory] = useState<ProjectData[]>([]);
  const [future, setFuture] = useState<ProjectData[]>([]);
  const dragStartProjectState = useRef<ProjectData | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // --- History Helpers ---
  const saveToHistory = () => {
    setHistory(prev => [...prev, project]);
    setFuture([]);
  };

  const undo = () => {
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    setFuture(prev => [project, ...prev]);
    setHistory(prev => prev.slice(0, -1));
    setProject(previous);
  };

  const redo = () => {
    if (future.length === 0) return;
    const next = future[0];
    setHistory(prev => [...prev, project]);
    setFuture(prev => prev.slice(1));
    setProject(next);
  };

  // --- Coordinate Helpers ---

  const toCanvasCoords = useCallback((clientX: number, clientY: number) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    return {
      x: (clientX - rect.left - transform.x) / transform.scale,
      y: (clientY - rect.top - transform.y) / transform.scale
    };
  }, [transform]);

  // --- Port Logic ---
  const getNodePortPosition = (nodeId: string, portId: string, type: 'input' | 'output') => {
    const node = project.nodes.find(n => n.id === nodeId);
    if (!node) return { x: 0, y: 0 };

    const width = 280; 
    
    // Input Port is always at the top-left header area (vertically centered in the 40px header)
    if (type === 'input') {
       return { x: node.position.x, y: node.position.y + 20 };
    }

    // Output logic per node type
    
    // START / SET_VAR / EVENT / END: Output is top-right header area
    if (node.type === NodeType.START || node.type === NodeType.SET_VARIABLE || node.type === NodeType.EVENT || node.type === NodeType.END) {
      return { x: node.position.x + width, y: node.position.y + 20 };
    }

    // CONDITION NODE: Two fixed positions based on the CSS structure
    if (node.type === NodeType.CONDITION) {
        if (portId === 'true') return { x: node.position.x + width, y: node.position.y + 120 };
        if (portId === 'false') return { x: node.position.x + width, y: node.position.y + 164 };
        return { x: node.position.x + width, y: node.position.y + 20 };
    }

    // DIALOGUE NODE: Dynamic choices list
    if (node.type === NodeType.DIALOGUE) {
       const choiceIndex = node.data.choices?.findIndex(c => c.id === portId) ?? -1;
       if (choiceIndex >= 0) {
         const yOffset = 136 + (choiceIndex * 44) + 18; 
         return { x: node.position.x + width, y: node.position.y + yOffset };
       }
       return { x: node.position.x + width, y: node.position.y + 20 };
    }

    return { x: node.position.x + width, y: node.position.y + 20 };
  };

  // --- Handlers (Mouse, Drag, Connect) ---

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && e.altKey) || e.button === 0) {
      setIsPanning(true);
      if (selectedNodeId) setSelectedNodeId(null);
      if (contextMenu) setContextMenu(null);
      return;
    }
  };

  const handleNodeMouseDown = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (e.button === 0) {
      setSelectedNodeId(id);
      setDragNodeId(id);
      dragStartProjectState.current = project;
    }
  };

  const handlePortMouseDown = (id: string, port: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const pos = toCanvasCoords(e.clientX, e.clientY);
    setActiveConn({ fromNodeId: id, fromPort: port, mouseX: pos.x, mouseY: pos.y });
  };

  const handlePortMouseUp = (targetNodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!activeConn) return;
    if (activeConn.fromNodeId === targetNodeId) {
      setActiveConn(null);
      return;
    }

    const filteredConnections = project.connections.filter(
      c => !(c.fromNodeId === activeConn.fromNodeId && c.fromPort === activeConn.fromPort)
    );

    const newConn: Connection = {
      id: `conn-${Date.now()}`,
      fromNodeId: activeConn.fromNodeId,
      fromPort: activeConn.fromPort,
      toNodeId: targetNodeId
    };

    const updatedNodes = project.nodes.map(node => {
      if (node.id === activeConn.fromNodeId && node.type === NodeType.DIALOGUE) {
        const updatedChoices = node.data.choices?.map(choice => {
          if (choice.id === activeConn.fromPort) {
            return { ...choice, nextNodeId: targetNodeId };
          }
          return choice;
        });
        return { ...node, data: { ...node.data, choices: updatedChoices } };
      }
      return node;
    });

    saveToHistory();
    setProject({
      nodes: updatedNodes,
      connections: [...filteredConnections, newConn]
    });
    
    setActiveConn(null);
  };

  const handleMouseUp = () => {
    if (dragNodeId && dragStartProjectState.current) {
        // Check if actually moved
        const startNode = dragStartProjectState.current.nodes.find(n => n.id === dragNodeId);
        const currentNode = project.nodes.find(n => n.id === dragNodeId);
        if (startNode && currentNode && (startNode.position.x !== currentNode.position.x || startNode.position.y !== currentNode.position.y)) {
             setHistory(prev => [...prev, dragStartProjectState.current!]);
             setFuture([]);
        }
    }
    setIsPanning(false);
    setDragNodeId(null);
    setActiveConn(null);
    dragStartProjectState.current = null;
  };

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning) {
      setTransform(prev => ({ ...prev, x: prev.x + e.movementX, y: prev.y + e.movementY }));
      return;
    }

    if (dragNodeId) {
      setProject(prev => ({
        ...prev,
        nodes: prev.nodes.map(node => 
          node.id === dragNodeId 
            ? { ...node, position: { x: node.position.x + e.movementX / transform.scale, y: node.position.y + e.movementY / transform.scale } }
            : node
        )
      }));
    }

    if (activeConn) {
      const pos = toCanvasCoords(e.clientX, e.clientY);
      setActiveConn(prev => prev ? { ...prev, mouseX: pos.x, mouseY: pos.y } : null);
    }
  }, [dragNodeId, isPanning, activeConn, transform.scale, toCanvasCoords, setProject]);

  const handleWheel = (e: React.WheelEvent) => {
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setTransform(prev => ({ ...prev, scale: Math.min(Math.max(prev.scale * delta, 0.2), 2) }));
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  // --- Helpers for Node Visuals ---
  const getNodeColor = (type: NodeType) => {
    switch (type) {
        case NodeType.START: return 'text-emerald-400 border-emerald-500/20 bg-emerald-900/10';
        case NodeType.END: return 'text-rose-400 border-rose-500/20 bg-rose-900/10';
        case NodeType.CONDITION: return 'text-amber-400 border-amber-500/20 bg-amber-900/10';
        case NodeType.SET_VARIABLE: return 'text-sky-400 border-sky-500/20 bg-sky-900/10';
        case NodeType.EVENT: return 'text-purple-400 border-purple-500/20 bg-purple-900/10';
        default: return 'text-zinc-500 border-zinc-800 bg-zinc-900/50';
    }
  };

  const addNode = (type: NodeType) => {
    let pos;
    if (contextMenu) {
      pos = toCanvasCoords(contextMenu.x, contextMenu.y);
    } else {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const center = toCanvasCoords(rect.left + rect.width / 2, rect.top + rect.height / 2);
      pos = { x: center.x - 140, y: center.y - 100 };
    }

    const newNode: DialogueNode = {
      id: `${type.toLowerCase()}-${Date.now()}`,
      type,
      position: pos,
      data: {
        model: type === NodeType.START ? 'a_m_y_business_01' : undefined,
        npcName: "Entity",
        text: type === NodeType.DIALOGUE ? t('editor.type_text') : undefined,
        choices: type === NodeType.DIALOGUE ? [{ id: `c-${Date.now()}`, text: t('editor.type_next'), nextNodeId: null }] : [],
        variableName: "var",
        conditionOperator: '==',
        variableValue: "true"
      }
    };
    saveToHistory();
    setProject(prev => ({ ...prev, nodes: [...prev.nodes, newNode] }));
    setContextMenu(null);
  };

  const resetView = () => {
    setTransform({ x: 0, y: 0, scale: 1 });
  };
  const deleteNode = (id: string) => {
    saveToHistory();
    setProject(prev => ({
      nodes: prev.nodes.filter(n => n.id !== id),
      connections: prev.connections.filter(c => c.fromNodeId !== id && c.toNodeId !== id)
    }));
    setSelectedNodeId(null);
  };
  const deleteConnection = (connId: string) => {
    const conn = project.connections.find(c => c.id === connId);
    if (!conn) return;
    saveToHistory();
    const remaining = project.connections.filter(c => c.id !== connId);
    const updatedNodes = project.nodes.map(node => {
      if (node.id === conn.fromNodeId && node.type === NodeType.DIALOGUE) {
        return { ...node, data: { ...node.data, choices: node.data.choices?.map(c => c.id === conn.fromPort ? { ...c, nextNodeId: null } : c) } };
      }
      return node;
    });
    setProject({ nodes: updatedNodes, connections: remaining });
  };
  const addChoice = (nodeId: string) => {
    saveToHistory();
    setProject(prev => ({
      ...prev,
      nodes: prev.nodes.map(node => {
        if (node.id === nodeId) {
          const newChoice = { id: `c-${Date.now()}`, text: t('editor.type_option'), nextNodeId: null };
          return { ...node, data: { ...node.data, choices: [...(node.data.choices || []), newChoice] } };
        }
        return node;
      })
    }));
  };
  const removeChoice = (nodeId: string, choiceId: string) => {
    saveToHistory();
    setProject(prev => {
       const newConnections = prev.connections.filter(c => !(c.fromNodeId === nodeId && c.fromPort === choiceId));
       const newNodes = prev.nodes.map(node => {
         if (node.id === nodeId) {
           return { ...node, data: { ...node.data, choices: node.data.choices?.filter(c => c.id !== choiceId) } };
         }
         return node;
       });
       return { nodes: newNodes, connections: newConnections };
    });
  };

  return (
    <div 
      ref={containerRef}
      className="w-full h-full relative overflow-hidden node-canvas bg-[#09090b] select-none cursor-grab active:cursor-grabbing"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
      onContextMenu={handleContextMenu}
    >
      {/* Toolbar */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-zinc-900/90 border border-zinc-800 p-1.5 rounded-full shadow-2xl flex items-center gap-1 z-50 backdrop-blur-md" onMouseDown={e => e.stopPropagation()}>
        {Object.values(NodeType).map(type => (
          <div key={type} className="relative group">
            <button 
                onClick={() => addNode(type)}
                className="w-9 h-9 flex items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 transition-all"
            >
                {type === NodeType.START && (
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                )}
                {type === NodeType.DIALOGUE && (
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                )}
                {type === NodeType.CONDITION && (
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><path d="M9 9l6 6"></path><path d="M15 9l-6 6"></path></svg>
                )}
                {type === NodeType.SET_VARIABLE && (
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-sky-500"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>
                )}
                {type === NodeType.EVENT && (
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-500"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
                )}
                {type === NodeType.END && (
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-rose-500"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg>
                )}
            </button>
            {/* Tooltip */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-zinc-950 border border-zinc-800 rounded text-[9px] font-bold text-zinc-300 uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-[60]">
                {type}
            </div>
          </div>
        ))}
        <div className="w-px h-5 bg-zinc-800 mx-1"></div>
        
        {/* Undo */}
        <div className="relative group">
            <button 
                onClick={undo}
                disabled={history.length === 0}
                className={`w-9 h-9 flex items-center justify-center rounded-full transition-all ${history.length === 0 ? 'text-zinc-700 cursor-not-allowed' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'}`}
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v6h6"></path><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"></path></svg>
            </button>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-zinc-950 border border-zinc-800 rounded text-[9px] font-bold text-zinc-300 uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-[60]">
                UNDO
            </div>
        </div>

        {/* Redo */}
        <div className="relative group">
            <button 
                onClick={redo}
                disabled={future.length === 0}
                className={`w-9 h-9 flex items-center justify-center rounded-full transition-all ${future.length === 0 ? 'text-zinc-700 cursor-not-allowed' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'}`}
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 7v6h-6"></path><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 3.7"></path></svg>
            </button>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-zinc-950 border border-zinc-800 rounded text-[9px] font-bold text-zinc-300 uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-[60]">
                REDO
            </div>
        </div>

        <div className="w-px h-5 bg-zinc-800 mx-1"></div>
        
        {/* Reset View */}
        <div className="relative group">
            <button 
                onClick={resetView}
                className="w-9 h-9 flex items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-800 hover:text-zinc-100 transition-all"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="3"></circle></svg>
            </button>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-zinc-950 border border-zinc-800 rounded text-[9px] font-bold text-zinc-300 uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-[60]">
                RESET VIEW
            </div>
        </div>
      </div>

      <div 
        className="absolute inset-0 origin-top-left will-change-transform"
        style={{ transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})` }}
      >
        {/* Connections */}
        <svg className="absolute inset-0 w-[10000px] h-[10000px] pointer-events-none overflow-visible">
          {project.connections.map(conn => {
            const start = getNodePortPosition(conn.fromNodeId, conn.fromPort, 'output');
            const nodeTo = project.nodes.find(n => n.id === conn.toNodeId);
            const end = nodeTo ? { x: nodeTo.position.x, y: nodeTo.position.y + 20 } : { x: 0, y: 0 };
            
            // Bezier Calculation
            const dist = Math.abs(end.x - start.x);
            const cpDist = Math.max(dist * 0.5, 80); 
            const cp1 = { x: start.x + cpDist, y: start.y };
            const cp2 = { x: end.x - cpDist, y: end.y };

            let strokeColor = "#52525b";
            if (conn.fromPort === 'true') strokeColor = "#10b981"; 
            if (conn.fromPort === 'false') strokeColor = "#f43f5e"; 

            return (
              <g key={conn.id} className="cursor-pointer group pointer-events-auto" onClick={(e) => { e.stopPropagation(); deleteConnection(conn.id); }}>
                <path d={`M ${start.x} ${start.y} C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${end.x} ${end.y}`} stroke="transparent" strokeWidth="20" fill="none" />
                <path d={`M ${start.x} ${start.y} C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${end.x} ${end.y}`} stroke={strokeColor} strokeWidth="2" fill="none" className="group-hover:stroke-white transition-colors" />
                <circle cx={end.x} cy={end.y} r="3" fill={strokeColor} className="group-hover:fill-white transition-colors"/>
              </g>
            );
          })}
          {activeConn && (
             <path d={`M ${getNodePortPosition(activeConn.fromNodeId, activeConn.fromPort, 'output').x} ${getNodePortPosition(activeConn.fromNodeId, activeConn.fromPort, 'output').y} C ${activeConn.mouseX} ${getNodePortPosition(activeConn.fromNodeId, activeConn.fromPort, 'output').y}, ${activeConn.mouseX - 50} ${activeConn.mouseY}, ${activeConn.mouseX} ${activeConn.mouseY}`} stroke="#e4e4e7" strokeWidth="2" fill="none" strokeDasharray="5,5" />
          )}
        </svg>

        {/* Nodes */}
        {project.nodes.map(node => (
          <div
            key={node.id}
            onMouseDown={(e) => handleNodeMouseDown(node.id, e)}
            className={`
              absolute w-[280px] rounded-sm pointer-events-auto flex flex-col transition-all border
              ${selectedNodeId === node.id ? 'ring-1 ring-zinc-100 shadow-2xl z-20 border-zinc-600' : 'shadow-xl z-10 border-zinc-800'}
            `}
            style={{ 
                left: node.position.x, 
                top: node.position.y,
                backgroundColor: '#09090b',
            }}
          >
            {/* Node Header */}
            <div className={`h-10 px-4 flex items-center justify-between border-b ${getNodeColor(node.type)}`}>
              <span className="text-[9px] font-black uppercase tracking-[0.2em]">{node.type}</span>
              
              {node.type !== NodeType.START && (
                 <div onMouseUp={(e) => handlePortMouseUp(node.id, e)} className="w-3 h-3 absolute -left-1.5 top-[14px] bg-zinc-950 border border-zinc-600 hover:border-zinc-100 hover:scale-125 transition-all rotate-45 cursor-crosshair z-30"></div>
              )}
              
              {(node.type === NodeType.START || node.type === NodeType.SET_VARIABLE || node.type === NodeType.EVENT) && (
                  <div onMouseDown={(e) => handlePortMouseDown(node.id, 'main', e)} className="w-3 h-3 absolute -right-1.5 top-[14px] bg-zinc-100 border border-zinc-100 hover:scale-125 transition-all rotate-45 cursor-crosshair z-30"></div>
              )}
            </div>

            {/* Node Content */}
            <div className="p-4 space-y-4">
              
              {/* DIALOGUE */}
              {node.type === NodeType.DIALOGUE && (
                 <>
                   <div className="bg-zinc-900/50 p-3 rounded-sm border border-zinc-800/50 h-[64px] overflow-hidden">
                      <p className="text-[10px] text-zinc-400 font-mono leading-relaxed line-clamp-3 pointer-events-none select-none">
                        "{node.data.text || "..."}"
                      </p>
                   </div>
                   <div className="space-y-2">
                     {node.data.choices?.map((choice, i) => (
                       <div key={choice.id} className="relative flex items-center h-[36px] bg-zinc-900 border border-zinc-800 px-3 rounded-sm group">
                         <span className="text-[9px] text-zinc-500 font-bold mr-2">0{i+1}</span>
                         <span className="text-[10px] text-zinc-300 truncate font-medium">{choice.text}</span>
                         <div onMouseDown={(e) => handlePortMouseDown(node.id, choice.id, e)} className="absolute -right-1.5 w-2.5 h-2.5 bg-zinc-800 border border-zinc-500 hover:bg-zinc-100 hover:border-zinc-100 hover:scale-125 transition-all rotate-45 cursor-crosshair z-30"></div>
                       </div>
                     ))}
                   </div>
                 </>
              )}

              {/* CONDITION */}
              {node.type === NodeType.CONDITION && (
                  <div className="space-y-3">
                      <div className="bg-amber-900/10 border border-amber-900/30 p-2 rounded-sm text-center h-[36px] flex items-center justify-center">
                          <p className="text-[10px] font-mono text-amber-500 truncate px-2">
                              {t('editor.node.if')} {node.data.variableName} {node.data.conditionOperator} {node.data.variableValue}
                          </p>
                      </div>
                      <div className="relative h-8 flex items-center justify-end">
                          <span className="text-[9px] font-bold text-emerald-500 mr-4">{t('editor.node.true')}</span>
                          <div onMouseDown={(e) => handlePortMouseDown(node.id, 'true', e)} className="absolute -right-1.5 top-2.5 w-2.5 h-2.5 bg-emerald-900 border border-emerald-500 hover:bg-emerald-400 transition-all rotate-45 cursor-crosshair z-30"></div>
                      </div>
                      <div className="relative h-8 flex items-center justify-end border-t border-zinc-800/50 pt-3">
                          <span className="text-[9px] font-bold text-rose-500 mr-4">{t('editor.node.false')}</span>
                          <div onMouseDown={(e) => handlePortMouseDown(node.id, 'false', e)} className="absolute -right-1.5 top-[14px] w-2.5 h-2.5 bg-rose-900 border border-rose-500 hover:bg-rose-400 transition-all rotate-45 cursor-crosshair z-30"></div>
                      </div>
                  </div>
              )}

              {/* SET VARIABLE */}
              {node.type === NodeType.SET_VARIABLE && (
                  <div className="bg-sky-900/10 border border-sky-900/30 p-2 rounded-sm">
                      <p className="text-[10px] font-mono text-sky-500">
                          {t('editor.node.set_variable')} <span className="text-zinc-200">{node.data.variableName}</span> = <span className="text-zinc-200">{node.data.variableValue}</span>
                      </p>
                  </div>
              )}

              {/* EVENT */}
              {node.type === NodeType.EVENT && (
                  <div className="bg-purple-900/10 border border-purple-900/30 p-2 rounded-sm">
                      <p className="text-[10px] font-mono text-purple-500">
                          {t('editor.node.trigger')} <span className="text-zinc-200">{node.data.eventName || "EVENT"}</span>
                      </p>
                  </div>
              )}

              {/* END */}
              {node.type === NodeType.END && (
                  <div className="text-center py-2">
                      <p className="text-[10px] font-bold text-rose-500 uppercase tracking-widest">{t('editor.node.end')}</p>
                  </div>
              )}

              {/* START */}
              {node.type === NodeType.START && (
                  <div className="text-center py-2">
                      <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">{t('editor.node.start')}</p>
                  </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Property Sidebar */}
      {selectedNodeId && (
        <div className="absolute right-0 top-0 bottom-0 w-[340px] bg-zinc-950 border-l border-zinc-900 shadow-2xl z-[60] flex flex-col animate-in slide-in-from-right duration-300" onMouseDown={e => e.stopPropagation()}>
          <div className="p-8 border-b border-zinc-900 flex items-center justify-between">
            <div>
              <h3 className="text-[11px] font-black tracking-[0.3em] text-zinc-100 uppercase">{t('editor.properties')}</h3>
              <p className="text-[9px] text-zinc-500 font-medium uppercase mt-1">{project.nodes.find(n => n.id === selectedNodeId)?.type}</p>
            </div>
            <button onClick={() => setSelectedNodeId(null)} className="w-8 h-8 flex items-center justify-center hover:bg-zinc-900 transition-colors rounded-sm text-zinc-500 hover:text-white">✕</button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-8">
            {(() => {
                const node = project.nodes.find(n => n.id === selectedNodeId);
                if (!node) return null;
                const updateData = (key: string, value: any) => {
                    setProject(prev => ({
                        ...prev,
                        nodes: prev.nodes.map(n => n.id === selectedNodeId ? { ...n, data: { ...n.data, [key]: value } } : n)
                    }));
                };

                const updateCoords = (partial: Partial<WorldCoords>) => {
                  const current = (node.data.coords || {}) as WorldCoords;
                  updateData('coords', { ...current, ...partial });
                };

                const useMyPosition = async () => {
                  const resp = await fetchNui('getPlayerCoords');
                  if (resp && resp.coords) {
                    updateData('coords', resp.coords);
                  }
                };
                if (node.type === NodeType.DIALOGUE) return (
                    <>
                        <div className="space-y-3">
                            <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">{t('editor.npc_id')}</label>
                            <input type="text" value={node.data.npcName || ''} onChange={(e) => updateData('npcName', e.target.value)} className="w-full bg-zinc-900 border-b border-zinc-800 py-2 text-[11px] font-mono text-zinc-300 focus:outline-none focus:border-zinc-400 transition-colors" />
                        </div>
                        <div className="space-y-3">
                            <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">{t('editor.text_buffer')}</label>
                            <textarea rows={5} value={node.data.text || ''} onChange={(e) => updateData('text', e.target.value)} className="w-full bg-zinc-900/50 border border-zinc-900 p-4 text-[11px] font-medium text-zinc-300 focus:outline-none focus:border-zinc-700 resize-none rounded-sm" />
                        </div>
                        <div className="space-y-4 pt-4 border-t border-zinc-900">
                             <div className="flex justify-between"><label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">{t('editor.responses')}</label><button onClick={() => addChoice(selectedNodeId)} className="text-[9px] font-bold text-zinc-400 hover:text-white">{t('editor.add')}</button></div>
                             {node.data.choices?.map((c, i) => (
                                 <div key={c.id} className="flex gap-2">
                                     <input type="text" value={c.text} onChange={(e) => {
                                         const newChoices = node.data.choices?.map(choice => choice.id === c.id ? { ...choice, text: e.target.value } : choice);
                                         updateData('choices', newChoices);
                                     }} className="flex-1 bg-zinc-900 border-b border-zinc-800 text-[10px] py-1 text-zinc-300 focus:outline-none" />
                                     <button onClick={() => removeChoice(selectedNodeId, c.id)} className="text-zinc-600 hover:text-rose-500">×</button>
                                 </div>
                             ))}
                        </div>
                    </>
                );
                if (node.type === NodeType.CONDITION || node.type === NodeType.SET_VARIABLE) return (
                    <>
                        <div className="space-y-3">
                            <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">{t('editor.variable_key')}</label>
                            <input type="text" value={node.data.variableName || ''} onChange={(e) => updateData('variableName', e.target.value)} className="w-full bg-zinc-900 border-b border-zinc-800 py-2 text-[11px] font-mono text-zinc-300 focus:outline-none focus:border-zinc-400" />
                        </div>
                        {node.type === NodeType.CONDITION && (
                             <div className="space-y-3">
                                <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">{t('editor.operator')}</label>
                                <select value={node.data.conditionOperator} onChange={(e) => updateData('conditionOperator', e.target.value)} className="w-full bg-zinc-900 border-b border-zinc-800 py-2 text-[11px] font-mono text-zinc-300 focus:outline-none">
                                    <option value="==">== Equals</option>
                                    <option value="!=">!= Not Equals</option>
                                    <option value=">">&gt; Greater Than</option>
                                    <option value="<">&lt; Less Than</option>
                                    <option value=">=">&gt;= Greater/Eq</option>
                                    <option value="<=">&lt;= Less/Eq</option>
                                </select>
                             </div>
                        )}
                        <div className="space-y-3">
                            <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">{node.type === NodeType.SET_VARIABLE ? t('editor.value_set') : t('editor.value_check')}</label>
                            <input type="text" value={node.data.variableValue || ''} onChange={(e) => updateData('variableValue', e.target.value)} className="w-full bg-zinc-900 border-b border-zinc-800 py-2 text-[11px] font-mono text-zinc-300 focus:outline-none focus:border-zinc-400" />
                        </div>
                    </>
                );
                if (node.type === NodeType.EVENT) return (
                  <div className="space-y-3">
                      <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">{t('editor.event_name')}</label>
                      <input type="text" value={node.data.eventName || ''} onChange={(e) => updateData('eventName', e.target.value)} className="w-full bg-zinc-900 border-b border-zinc-800 py-2 text-[11px] font-mono text-zinc-300 focus:outline-none focus:border-zinc-400" />
                  </div>
                );

                if (node.type === NodeType.START) return (
                  <>
                    <div className="space-y-3">
                      <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">NPC MODEL</label>
                      <input
                        type="text"
                        value={node.data.model || ''}
                        onChange={(e) => updateData('model', e.target.value)}
                        className="w-full bg-zinc-900 border-b border-zinc-800 py-2 text-[11px] font-mono text-zinc-300 focus:outline-none focus:border-zinc-400"
                        placeholder="a_m_y_business_01"
                      />
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">COORDS (X Y Z W)</label>
                        <button
                          onClick={useMyPosition}
                          className="text-[9px] font-bold text-zinc-400 hover:text-white"
                        >
                          USAR MI POSICIÓN
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <input
                          type="number"
                          value={node.data.coords?.x ?? ''}
                          onChange={(e) => updateCoords({ x: Number(e.target.value) })}
                          className="w-full bg-zinc-900 border-b border-zinc-800 py-2 text-[11px] font-mono text-zinc-300 focus:outline-none focus:border-zinc-400"
                          placeholder="X"
                        />
                        <input
                          type="number"
                          value={node.data.coords?.y ?? ''}
                          onChange={(e) => updateCoords({ y: Number(e.target.value) })}
                          className="w-full bg-zinc-900 border-b border-zinc-800 py-2 text-[11px] font-mono text-zinc-300 focus:outline-none focus:border-zinc-400"
                          placeholder="Y"
                        />
                        <input
                          type="number"
                          value={node.data.coords?.z ?? ''}
                          onChange={(e) => updateCoords({ z: Number(e.target.value) })}
                          className="w-full bg-zinc-900 border-b border-zinc-800 py-2 text-[11px] font-mono text-zinc-300 focus:outline-none focus:border-zinc-400"
                          placeholder="Z"
                        />
                        <input
                          type="number"
                          value={node.data.coords?.w ?? ''}
                          onChange={(e) => updateCoords({ w: Number(e.target.value) })}
                          className="w-full bg-zinc-900 border-b border-zinc-800 py-2 text-[11px] font-mono text-zinc-300 focus:outline-none focus:border-zinc-400"
                          placeholder="W (heading)"
                        />
                      </div>
                    </div>
                  </>
                );
                return <div className="text-[10px] text-zinc-600 italic">{t('editor.no_props')}</div>;
            })()}

            <div className="pt-8 mt-4 border-t border-zinc-900">
              <button onClick={() => deleteNode(selectedNodeId)} className="w-full py-3 border border-zinc-800 text-zinc-600 hover:text-rose-500 hover:border-rose-500 hover:bg-rose-500/5 text-[10px] font-black uppercase tracking-[0.2em] transition-all rounded-sm">{t('editor.destroy_node')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <div className="fixed bg-zinc-900 border border-zinc-800 p-1 w-48 shadow-2xl z-[100] animate-in fade-in zoom-in-95 duration-150" style={{ left: contextMenu.x, top: contextMenu.y }} onMouseDown={(e) => e.stopPropagation()}>
          <div className="px-3 py-2 text-[8px] font-black text-zinc-600 uppercase tracking-widest border-b border-zinc-800 mb-1">{t('editor.add_logic_block')}</div>
          {Object.values(NodeType).map(type => (
            <button key={type} onClick={() => addNode(type)} className="w-full text-left px-3 py-2 text-[10px] font-bold text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 uppercase tracking-widest transition-colors rounded-sm flex items-center justify-between group">
                {type}
                <div className={`w-1.5 h-1.5 rounded-full opacity-0 group-hover:opacity-100 ${type === NodeType.END ? 'bg-rose-500' : type === NodeType.CONDITION ? 'bg-amber-500' : 'bg-zinc-500'}`}></div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default NodeEditor;
