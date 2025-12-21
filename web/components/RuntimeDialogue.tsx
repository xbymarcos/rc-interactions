import React, { useState, useEffect } from 'react';

type RuntimeChoice = {
  id: string;
  text: string;
};

type RuntimeDialogueData = {
  projectId: string;
  nodeId: string;
  name?: string;
  text?: string;
  choices?: RuntimeChoice[];
};

type Props = {
  data: RuntimeDialogueData;
  onSelectChoice: (choiceId: string) => void;
  onCancel: () => void;
};

const RuntimeDialogue: React.FC<Props> = ({ data, onSelectChoice, onCancel }) => {
  const choices = data.choices ?? [];
  const [displayText, setDisplayText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Typing effect
  useEffect(() => {
    if (data.text) {
      setIsTyping(true);
      setDisplayText('');
      let i = 0;
      const fullText = data.text;
      
      const interval = setInterval(() => {
        setDisplayText(prev => fullText.substring(0, i + 1));
        i++;
        if (i >= fullText.length) {
          clearInterval(interval);
          setIsTyping(false);
        }
      }, 30);

      return () => clearInterval(interval);
    }
  }, [data.text, data.nodeId]); // Reset when node changes

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isTyping) {
          return;
      }
      
      const choicesCount = choices.length;
      if (choicesCount === 0) return;

      if (e.key === 'ArrowDown') {
        setSelectedIndex(prev => (prev + 1) % choicesCount);
      } else if (e.key === 'ArrowUp') {
        setSelectedIndex(prev => (prev - 1 + choicesCount) % choicesCount);
      } else if (e.key === 'Enter') {
        const selectedChoice = choices[selectedIndex];
        if (selectedChoice) onSelectChoice(selectedChoice.id);
      } else if (['1', '2', '3', '4'].includes(e.key)) {
        const idx = parseInt(e.key) - 1;
        if (idx < choicesCount) {
          const choice = choices[idx];
          if (choice) onSelectChoice(choice.id);
        }
      } else if (e.key === 'Escape') {
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isTyping, choices, selectedIndex, onSelectChoice, onCancel]);

  return (
    <div className="fixed inset-0 z-[999] flex flex-col justify-end pointer-events-none">
      
      <div className="relative z-20 w-full max-w-xl mx-auto px-6 pb-8 space-y-4 pointer-events-auto">
        
        {/* NPC Identifier Header */}
        <div className="flex items-center gap-3 animate-in fade-in slide-in-from-left duration-700">
            <div className="flex flex-col gap-0.5">
            <div className="w-5 h-[2px] bg-zinc-100"></div>
            <div className="w-2 h-[2px] bg-zinc-800"></div>
            </div>
            <div>
            <h2 className="text-zinc-500 text-[8px] font-black tracking-[0.3em] uppercase mb-0.5">INTERACTION</h2>
            <h3 className="text-lg font-black text-zinc-100 tracking-tight uppercase shadow-black drop-shadow-md">{data.name || 'NPC'}</h3>
            </div>
        </div>

        {/* Content Box */}
        <div className="space-y-4">
            <div className="min-h-[50px]">
            <p className="text-base font-medium text-zinc-200 leading-snug tracking-tight drop-shadow-md shadow-black">
                {displayText}
                {isTyping && <span className="w-1 h-4 bg-zinc-100 ml-1 inline-block animate-pulse"></span>}
            </p>
            </div>

            {/* Choices List */}
            <div className={`space-y-1.5 transition-all duration-700 ${isTyping ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'}`}>
            {choices.map((choice, idx) => (
                <button
                key={choice.id}
                onClick={() => onSelectChoice(choice.id)}
                onMouseEnter={() => setSelectedIndex(idx)}
                className={`
                    group w-full relative flex items-center justify-between px-4 py-2.5 transition-all duration-300 rounded-sm
                    ${selectedIndex === idx 
                    ? 'bg-zinc-100 text-zinc-950 translate-x-2 shadow-xl' 
                    : 'bg-zinc-950/80 text-zinc-400 border border-zinc-800/50 hover:text-zinc-200'
                    }
                `}
                >
                <div className="flex items-center gap-3">
                    <span className={`text-[9px] font-black font-mono transition-colors ${selectedIndex === idx ? 'text-zinc-950/50' : 'text-zinc-600'}`}>
                    0{idx + 1}
                    </span>
                    <span className="text-xs font-bold tracking-wide uppercase">{choice.text}</span>
                </div>
                
                {selectedIndex === idx && (
                    <div className="animate-in slide-in-from-left-2 duration-300">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="square" strokeLinejoin="miter" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                    </div>
                )}
                </button>
            ))}
            
            {choices.length === 0 && !isTyping && (
                 <div className="text-[10px] text-zinc-500 font-mono animate-pulse">Waiting for event...</div>
            )}
            </div>
        </div>

        {/* Hints Footer */}
        <div className="flex items-center justify-center gap-6 pt-4 opacity-50 animate-in fade-in duration-1000 delay-500">
            <div className="flex items-center gap-2">
                <div className="flex gap-0.5">
                    <div className="w-4 h-4 border border-zinc-600 rounded-[2px] flex items-center justify-center text-[8px] font-bold text-zinc-400">↑</div>
                    <div className="w-4 h-4 border border-zinc-600 rounded-[2px] flex items-center justify-center text-[8px] font-bold text-zinc-400">↓</div>
                </div>
                <span className="text-[9px] font-bold tracking-wider text-zinc-500 uppercase">NAVIGATE</span>
            </div>
            <div className="w-[1px] h-3 bg-zinc-800"></div>
            <div className="flex items-center gap-2">
                <div className="h-4 px-1.5 border border-zinc-600 rounded-[2px] flex items-center justify-center text-[8px] font-bold text-zinc-400">ENTER</div>
                <span className="text-[9px] font-bold tracking-wider text-zinc-500 uppercase">SELECT</span>
            </div>
            <div className="w-[1px] h-3 bg-zinc-800"></div>
            <div className="flex items-center gap-2">
                <div className="h-4 px-1.5 border border-zinc-600 rounded-[2px] flex items-center justify-center text-[8px] font-bold text-zinc-400">ESC</div>
                <span className="text-[9px] font-bold tracking-wider text-zinc-500 uppercase">LEAVE</span>
            </div>
        </div>

      </div>
    </div>
  );
};

export default RuntimeDialogue;
