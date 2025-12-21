
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ProjectData, NodeType } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

interface GameSimulatorProps {
  project: ProjectData;
}

type GameMemory = Record<string, string | number | boolean>;

const GameSimulator: React.FC<GameSimulatorProps> = ({ project }) => {
  const { t } = useLanguage();
  const [currentNodeId, setCurrentNodeId] = useState<string | null>(null);
  const [displayText, setDisplayText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isInteractionActive, setIsInteractionActive] = useState(false);
  
  const [hasStarted, setHasStarted] = useState(false);
  const memoryRef = useRef<GameMemory>({ honor_level: 55 });

  const currentNode = project.nodes.find(n => n.id === currentNodeId);

  // --- Logic Engine ---
  
  const traverseLogic = useCallback((startNodeId: string): string | null => {
    let currentId = startNodeId;
    let safetyCounter = 0;

    while (safetyCounter < 100) {
        safetyCounter++;
        const node = project.nodes.find(n => n.id === currentId);
        if (!node) return null;

        if (node.type === NodeType.DIALOGUE || node.type === NodeType.END) {
            return node.id;
        }

        if (node.type === NodeType.SET_VARIABLE) {
            if (node.data.variableName) {
                memoryRef.current[node.data.variableName] = node.data.variableValue || "";
                console.log(`[SIM] Set ${node.data.variableName} = ${node.data.variableValue}`);
            }
            const conn = project.connections.find(c => c.fromNodeId === node.id);
            if (!conn) return null;
            currentId = conn.toNodeId;
            continue;
        }

        if (node.type === NodeType.CONDITION) {
            const valA = memoryRef.current[node.data.variableName || ""]?.toString() || "";
            const valB = node.data.variableValue || "";
            let result = false;

            const numA = parseFloat(valA);
            const numB = parseFloat(valB);
            const isNumeric = !isNaN(numA) && !isNaN(numB);

            switch(node.data.conditionOperator) {
                case '==': result = valA == valB; break;
                case '!=': result = valA != valB; break;
                case '>': result = isNumeric ? numA > numB : false; break;
                case '<': result = isNumeric ? numA < numB : false; break;
                case '>=': result = isNumeric ? numA >= numB : false; break;
                case '<=': result = isNumeric ? numA <= numB : false; break;
            }
            
            console.log(`[SIM] Condition: ${valA} ${node.data.conditionOperator} ${valB} = ${result}`);

            const conn = project.connections.find(c => c.fromNodeId === node.id && c.fromPort === (result ? 'true' : 'false'));
            if (!conn) return null;
            currentId = conn.toNodeId;
            continue;
        }

        if (node.type === NodeType.START || node.type === NodeType.EVENT) {
             const conn = project.connections.find(c => c.fromNodeId === node.id);
             if (!conn) return null;
             currentId = conn.toNodeId;
             continue;
        }

        return null;
    }
    return null;
  }, [project]);

  // --- Interaction Handlers ---

  const startSimulation = () => {
      const startNode = project.nodes.find(n => n.type === NodeType.START);
      if (!startNode) {
          alert(t('simulator.no_start_node'));
          return;
      }
      
      memoryRef.current = { honor_level: 55 };
      setHasStarted(true);
      setIsInteractionActive(true);

      const nextId = traverseLogic(startNode.id);
      if (nextId) setCurrentNodeId(nextId);
  };

  const handleChoice = useCallback((nextNodeId: string | null) => {
    if (isTyping || !nextNodeId) return;
    
    const actualNextId = traverseLogic(nextNodeId);
    
    if (actualNextId) {
        const nextNode = project.nodes.find(n => n.id === actualNextId);
        if (nextNode?.type === NodeType.END) {
            setIsInteractionActive(false);
            setHasStarted(false);
            return;
        }
        setCurrentNodeId(actualNextId);
        setSelectedIndex(0);
    } else {
        setIsInteractionActive(false);
        setHasStarted(false);
    }
  }, [isTyping, traverseLogic, project.nodes]);

  useEffect(() => {
    if (currentNode?.type === NodeType.DIALOGUE && currentNode?.data.text && isInteractionActive) {
      setIsTyping(true);
      setDisplayText('');
      let i = 0;
      const fullText = currentNode.data.text;
      
      const interval = setInterval(() => {
        setDisplayText(prev => fullText.substring(0, i + 1));
        i++;
        if (i >= fullText.length) {
          clearInterval(interval);
          setIsTyping(false);
        }
      }, 20);

      return () => clearInterval(interval);
    }
  }, [currentNodeId, isInteractionActive, currentNode]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isInteractionActive) {
        if (e.key.toLowerCase() === 'e') startSimulation();
        return;
      }
      if (isTyping) return;
      const choicesCount = currentNode?.data.choices?.length || 0;

      if (e.key === 'ArrowDown') {
        setSelectedIndex(prev => (prev + 1) % choicesCount);
      } else if (e.key === 'ArrowUp') {
        setSelectedIndex(prev => (prev - 1 + choicesCount) % choicesCount);
      } else if (e.key === 'Enter') {
        const selectedChoice = currentNode?.data.choices?.[selectedIndex];
        if (selectedChoice) handleChoice(selectedChoice.nextNodeId);
      } else if (['1', '2', '3', '4'].includes(e.key)) {
        const idx = parseInt(e.key) - 1;
        if (idx < choicesCount) {
          const choice = currentNode?.data.choices?.[idx];
          if (choice) handleChoice(choice.nextNodeId);
        }
      } else if (e.key === 'Escape') {
        setIsInteractionActive(false);
        setHasStarted(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isInteractionActive, isTyping, currentNode, selectedIndex, handleChoice]);

  if (!isInteractionActive) {
    return (
      <div className="w-full h-full relative bg-zinc-950 flex items-center justify-center group cursor-pointer" onClick={startSimulation}>
        <img 
          src="https://images.unsplash.com/photo-1626379616459-b2ce1d9decbb?q=80&w=1920&auto=format&fit=crop" 
          alt="Technical Scene" 
          className="absolute inset-0 w-full h-full object-cover opacity-20 contrast-125 saturate-0 transition-opacity group-hover:opacity-30"
        />
        <div className="z-10 text-center space-y-6">
          <div className="flex flex-col items-center gap-4">
             <div className="w-[1px] h-24 bg-zinc-800"></div>
             <div className="w-12 h-12 border-2 border-zinc-100 flex items-center justify-center animate-bounce bg-black">
                <span className="text-zinc-100 font-black text-sm">E</span>
             </div>
          </div>
          <p className="text-zinc-400 font-bold tracking-[0.5em] text-[10px] uppercase group-hover:text-zinc-100 transition-colors">{t('simulator.start')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative bg-zinc-950 overflow-hidden flex flex-col justify-end">
       <img 
          src="https://images.unsplash.com/photo-1626379616459-b2ce1d9decbb?q=80&w=1920&auto=format&fit=crop" 
          alt="Technical Scene" 
          className="absolute inset-0 w-full h-full object-cover opacity-10 saturate-0 scale-110"
        />

        {/* Cinematic Gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-transparent"></div>

        {/* Main Dialogue Interface */}
        <div className="relative z-20 w-full max-w-4xl mx-auto px-12 pb-24 space-y-12">
           
           {/* NPC Identifier Header */}
           <div className="flex items-center gap-6 animate-in fade-in slide-in-from-left duration-700">
             <div className="flex flex-col gap-1">
               <div className="w-8 h-[2px] bg-zinc-100"></div>
               <div className="w-4 h-[2px] bg-zinc-800"></div>
             </div>
             <div>
               <h2 className="text-zinc-500 text-[9px] font-black tracking-[0.4em] uppercase mb-1">{t('simulator.live_feed')}</h2>
               <h3 className="text-4xl font-black text-zinc-100 tracking-tight uppercase">{currentNode?.data.npcName || t('simulator.system')}</h3>
             </div>
           </div>

           {/* Content Box */}
           <div className="space-y-12">
             <div className="min-h-[80px]">
               <p className="text-2xl font-medium text-zinc-300 leading-snug tracking-tight">
                 {displayText}
                 {isTyping && <span className="w-1 h-6 bg-zinc-100 ml-2 inline-block animate-pulse"></span>}
               </p>
             </div>

             {/* Minimal Choices List */}
             <div className={`space-y-3 transition-all duration-700 ${isTyping ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'}`}>
               {currentNode?.data.choices?.map((choice, idx) => (
                 <button
                   key={choice.id}
                   onClick={() => handleChoice(choice.nextNodeId)}
                   onMouseEnter={() => setSelectedIndex(idx)}
                   className={`
                     group w-full relative flex items-center justify-between px-8 py-5 transition-all duration-300
                     ${selectedIndex === idx 
                       ? 'bg-zinc-100 text-zinc-950 translate-x-4 shadow-2xl' 
                       : 'bg-zinc-900/40 text-zinc-500 border border-zinc-900/50 hover:text-zinc-300'
                     }
                   `}
                 >
                   <div className="flex items-center gap-8">
                      <span className={`text-[10px] font-black font-mono transition-colors ${selectedIndex === idx ? 'text-zinc-950/50' : 'text-zinc-700'}`}>
                        0{idx + 1}
                      </span>
                      <span className="text-base font-bold tracking-wide uppercase">{choice.text}</span>
                   </div>
                   
                   {selectedIndex === idx && (
                      <div className="animate-in slide-in-from-left-2 duration-300">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="square" strokeLinejoin="miter" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                        </svg>
                      </div>
                   )}
                 </button>
               ))}
             </div>
           </div>
        </div>

        {/* Technical HUD Overlay - Debug Info */}
        <div className="absolute top-12 right-12 text-right">
             <div className="bg-zinc-900/80 p-4 border border-zinc-800 rounded-sm">
                 <p className="text-[9px] font-black tracking-widest text-zinc-500 uppercase mb-2">{t('simulator.memory_debug')}</p>
                 <pre className="text-[10px] text-zinc-400 font-mono">
                     {JSON.stringify(memoryRef.current, null, 2)}
                 </pre>
             </div>
        </div>
    </div>
  );
};

export default GameSimulator;
