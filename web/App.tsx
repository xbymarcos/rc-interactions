
import React, { useState, useEffect } from 'react';
import NodeEditor from './components/NodeEditor';
import GameSimulator from './components/GameSimulator';
import Dashboard from './components/Dashboard';
import RuntimeDialogue from './components/RuntimeDialogue';
import { Project, ProjectData, NodeType } from './types';
import { useLanguage } from './contexts/LanguageContext';

import { fetchNui } from './utils/fetchNui';

// --- MOCK DATA GENERATOR ---
const generateMockProject = (id: string, name: string, group: string = 'General'): Project => ({
  id,
  name,
  group,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  data: {
    nodes: [
      {
        id: 'start',
        type: NodeType.START,
        position: { x: 100, y: 100 },
        data: {}
      }
    ],
    connections: []
  }
});

const INITIAL_PROJECTS: Project[] = [];

type ViewState = 'DASHBOARD' | 'EDITOR' | 'SIMULATION';

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

const App: React.FC = () => {
  const { t, language, setLanguage } = useLanguage();
  const [view, setView] = useState<ViewState>('DASHBOARD');
  const [projects, setProjects] = useState<Project[]>(INITIAL_PROJECTS);
  const [groups, setGroups] = useState<string[]>(['General']);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [editorVisible, setEditorVisible] = useState<boolean>(false);
  const [runtimeDialogue, setRuntimeDialogue] = useState<RuntimeDialogueData | null>(null);

  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [exportDataString, setExportDataString] = useState("");
  const [importInput, setImportInput] = useState("");
  const [copied, setCopied] = useState(false);

  // Derived state for the currently active project
  const currentProject = projects.find(p => p.id === currentProjectId);

  // --- NUI LISTENERS ---
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const { action, data } = event.data;
      if (action === 'setVisible') {
        const nextVisible = !!data;
        setEditorVisible(nextVisible);
        if (nextVisible) {
          document.body.style.display = 'block';
        } else {
          // Only hide the UI if we're not currently in a runtime dialogue
          if (!runtimeDialogue) {
            document.body.style.display = 'none';
          }
        }
      } else if (action === 'loadProjects') {
        setProjects(data);
        // Extract unique groups
        const loadedGroups = Array.from(new Set(data.map((p: Project) => p.group)));
        if (loadedGroups.length > 0) {
            setGroups(loadedGroups as string[]);
        } else {
            setGroups(['General']);
        }
      } else if (action === 'showDialogue') {
        document.body.style.display = 'block';
        setRuntimeDialogue(data as RuntimeDialogueData);
      } else if (action === 'closeDialogue') {
        setRuntimeDialogue(null);
        if (!editorVisible) {
          document.body.style.display = 'none';
        }
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
            handleClose();
        }
    };

    window.addEventListener('message', handleMessage);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
        window.removeEventListener('message', handleMessage);
        window.removeEventListener('keydown', handleKeyDown);
    };
  }, [editorVisible, runtimeDialogue]);

  const handleSelectRuntimeChoice = (choiceId: string) => {
    if (!runtimeDialogue) return;
    fetchNui('selectChoice', {
      projectId: runtimeDialogue.projectId,
      nodeId: runtimeDialogue.nodeId,
      choiceId,
    });
  };

  const handleCancelRuntime = () => {
    if (!runtimeDialogue) return;
    fetchNui('cancelInteraction', { projectId: runtimeDialogue.projectId });
    setRuntimeDialogue(null);
  };

  // --- CRUD OPERATIONS ---

  const handleCreateProject = (name: string, group: string = 'General') => {
    const newId = `proj_${crypto.randomUUID()}`;
    const newProject = generateMockProject(newId, name, group);
    setProjects(prev => [newProject, ...prev]); 
    setCurrentProjectId(newId);
    setView('EDITOR');
  };

  const handleDeleteProject = (id: string) => {
    fetchNui('deleteProject', { id });
    setProjects(prev => prev.filter(p => p.id !== id));
    if (currentProjectId === id) {
      setCurrentProjectId(null);
      setView('DASHBOARD');
    }
  };

  const handleSaveProject = () => {
      if (!currentProject) return;
      fetchNui('saveProject', currentProject).then(() => {
          // Optional: Show notification
      });
  };

  const handleOpenProject = (id: string) => {
    setCurrentProjectId(id);
    setView('EDITOR');
  };

  const handleMoveProject = (id: string, targetGroup: string) => {
    setProjects(prev => prev.map(p => p.id === id ? { ...p, group: targetGroup } : p));
  };

  const handleCreateGroup = (name: string) => {
    if (!groups.includes(name)) {
      setGroups(prev => [...prev, name]);
    }
  };

  const handleDeleteGroup = (name: string) => {
     if (name === 'General') {
       alert(t('dashboard.error_delete_general'));
       return;
     }
     
     setProjects(prev => prev.map(p => p.group === name ? { ...p, group: 'General' } : p));
     setGroups(prev => prev.filter(g => g !== name));
  };

  const handleUpdateCurrentProjectData = (newData: ProjectData | ((prev: ProjectData) => ProjectData)) => {
    if (!currentProjectId) return;

    setProjects(prev => prev.map(p => {
      if (p.id === currentProjectId) {
        const nextData = typeof newData === 'function' ? newData(p.data) : newData;
        return {
          ...p,
          data: nextData,
          updatedAt: new Date().toISOString()
        };
      }
      return p;
    }));
  };

  const handleRenameProject = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!currentProjectId) return;
    const newName = e.target.value;
    setProjects(prev => prev.map(p => 
      p.id === currentProjectId ? { ...p, name: newName, updatedAt: new Date().toISOString() } : p
    ));
  };

  // --- FILE EXPORT/IMPORT ---

  const handleExport = () => {
    if (!currentProject) return;
    const exportData = {
      meta: {
        generated: new Date().toISOString(),
        app: "RealCity Dialogue Architect v2.1",
        version: "1.0"
      },
      project: currentProject
    };

    const jsonString = JSON.stringify(exportData, null, 2);
    const fileName = `${currentProject.name.replace(/\s+/g, '_').toLowerCase()}.json`;

    // Try to force download
    try {
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }, 100);
    } catch (err) {
      console.error("Forced download failed, falling back to modal", err);
    }

    setExportDataString(jsonString);
    setExportModalOpen(true);
    setCopied(false);
  };

  const handleCopyExport = () => {
    try {
      const textArea = document.createElement("textarea");
      textArea.value = exportDataString;
      
      // Ensure it's not visible but part of DOM
      textArea.style.position = "fixed";
      textArea.style.left = "-9999px";
      textArea.style.top = "0";
      document.body.appendChild(textArea);
      
      textArea.focus();
      textArea.select();
      
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);

      if (successful) {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (err) {
      console.error("Fallback copy failed", err);
    }
  };

  const handleImportProject = () => {
    setImportInput("");
    setImportModalOpen(true);
  };

  const validateProjectSchema = (proj: any): proj is Project => {
    if (!proj || typeof proj !== 'object') return false;
    if (typeof proj.name !== 'string' || !proj.name.trim()) return false;
    if (!proj.data || typeof proj.data !== 'object') return false;
    if (!Array.isArray(proj.data.nodes) || !Array.isArray(proj.data.connections)) return false;

    // Validate each node has minimum required fields
    for (const node of proj.data.nodes) {
      if (!node.id || !node.type || !node.position) return false;
      if (typeof node.position.x !== 'number' || typeof node.position.y !== 'number') return false;
    }

    // Validate each connection has required fields
    for (const conn of proj.data.connections) {
      if (!conn.id || !conn.fromNodeId || !conn.toNodeId) return false;
    }

    return true;
  };

  const processImportedData = (data: any) => {
    // Determine if it's a raw project or an exported structure
    let projectToImport: any = null;
    
    if (data.project && data.meta) {
      projectToImport = data.project;
    } else if (data.id && data.data) {
       projectToImport = data;
    }

    if (!projectToImport || !validateProjectSchema(projectToImport)) {
      return false;
    }

    // Regenerate ID to avoid conflicts
    const newId = `proj_${crypto.randomUUID()}`;
    const newProject: Project = {
      ...projectToImport,
      id: newId,
      name: `${projectToImport.name} (Imported)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    setProjects(prev => [newProject, ...prev]);
    // Add group if it doesn't exist
    if (!groups.includes(newProject.group)) {
       setGroups(prev => [...prev, newProject.group]);
    }
    setImportModalOpen(false);
    return true;
  };

  const executeImport = () => {
    try {
      const json = JSON.parse(importInput);
      if (!processImportedData(json)) {
        alert(t('app.invalid_json'));
      }
    } catch (err) {
      console.error("Failed to parse project data", err);
      alert(t('app.invalid_json'));
    }
  };

  const handleFileImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const json = JSON.parse(event.target?.result as string);
          if (!processImportedData(json)) {
            alert(t('app.invalid_json'));
          }
        } catch (err) {
          alert(t('app.invalid_json'));
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };
  
  const handleClose = () => {
      fetchNui('hideFrame');
  };

  // --- RENDER HELPERS ---

  const nodeEditorSetterWrapper = (args: any) => handleUpdateCurrentProjectData(args);

  return (
    <div className={`h-screen w-screen flex flex-col text-zinc-200 selection:bg-zinc-200 selection:text-zinc-900 font-sans ${runtimeDialogue ? 'bg-transparent' : 'bg-[#09090b]'}`}>

      {runtimeDialogue ? (
        <RuntimeDialogue data={runtimeDialogue} onSelectChoice={handleSelectRuntimeChoice} onCancel={handleCancelRuntime} />
      ) : (
        <>
      {/* GLOBAL HEADER */}
      <header className="h-14 border-b border-zinc-900 bg-zinc-950 flex items-center justify-between px-6 z-50 shrink-0">
        <div className="flex items-center gap-6">
          <div 
            className="flex items-center gap-3 group cursor-pointer select-none"
            onClick={() => { setView('DASHBOARD'); setCurrentProjectId(null); }}
          >
            <div className="w-8 h-8 bg-zinc-100 rounded-sm flex items-center justify-center transition-transform group-hover:rotate-45 shadow-lg shadow-white/5">
              <div className="w-4 h-4 bg-zinc-900 rounded-full"></div>
            </div>
            <div>
              <h1 className="text-[11px] font-bold text-zinc-100 tracking-[0.2em] uppercase">{t('app.title')}</h1>
              <p className="text-[9px] text-zinc-500 font-medium tracking-wide">
                {view === 'DASHBOARD' ? t('app.lobby') : t('app.logic_active')}
              </p>
            </div>
          </div>
          
          {currentProjectId && (
            <nav className="flex items-center ml-8 border-l border-zinc-800 pl-8 gap-1 animate-in fade-in slide-in-from-left duration-300">
              <button 
                onClick={() => setView('EDITOR')}
                className={`px-4 py-1 text-[10px] font-bold tracking-widest uppercase transition-all rounded-sm ${view === 'EDITOR' ? 'text-zinc-950 bg-zinc-100' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900'}`}
              >
                {t('app.editor')}
              </button>
              <button 
                onClick={() => setView('SIMULATION')}
                className={`px-4 py-1 text-[10px] font-bold tracking-widest uppercase transition-all rounded-sm ${view === 'SIMULATION' ? 'text-zinc-950 bg-zinc-100' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900'}`}
              >
                {t('app.simulate')}
              </button>
            </nav>
          )}
        </div>

        <div className="flex items-center gap-4">
          <button 
            onClick={() => setLanguage(language === 'en' ? 'es' : 'en')}
            className="text-[10px] font-black text-zinc-500 hover:text-zinc-100 uppercase tracking-widest border border-zinc-800 hover:border-zinc-500 px-3 py-1 rounded-sm transition-all"
          >
            {language === 'en' ? 'ESPAÑOL' : 'ENGLISH'}
          </button>

          {view !== 'DASHBOARD' && currentProject && (
             <div className="flex items-center gap-4 animate-in fade-in slide-in-from-right duration-300">
                <input 
                  type="text" 
                  value={currentProject.name} 
                  onChange={handleRenameProject}
                  className="bg-transparent border-b border-zinc-800 text-[11px] font-bold text-zinc-400 focus:text-white focus:border-zinc-500 focus:outline-none w-48 text-right px-2 py-1 transition-colors"
                />
                <button onClick={handleExport} className="px-4 py-1.5 border border-zinc-800 rounded-sm text-[10px] font-black tracking-[0.2em] uppercase text-zinc-400 hover:text-zinc-100 hover:border-zinc-600 transition-colors">
                  {t('app.save_json')}
                </button>
                <button onClick={handleSaveProject} className="px-4 py-1.5 bg-zinc-100 text-zinc-950 rounded-sm text-[10px] font-black tracking-[0.2em] uppercase hover:bg-white transition-colors shadow-lg shadow-white/5">
                  {t('app.sync_db')}
                </button>
             </div>
          )}
        </div>
        
        <button onClick={handleClose} className="ml-4 text-zinc-500 hover:text-red-500">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </header>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 relative overflow-hidden flex">
        {view === 'DASHBOARD' && (
          <Dashboard 
            projects={projects}
            groups={groups}
            onCreate={handleCreateProject}
            onOpen={handleOpenProject}
            onDelete={handleDeleteProject}
            onMove={handleMoveProject}
            onCreateGroup={handleCreateGroup}
            onDeleteGroup={handleDeleteGroup}
            onImport={handleImportProject}
          />
        )}

        {view === 'EDITOR' && currentProject && (
          <div className="w-full h-full">
            <NodeEditor 
              project={currentProject.data} 
              setProject={nodeEditorSetterWrapper} 
            />
          </div>
        )}

        {view === 'SIMULATION' && currentProject && (
          <div className="w-full h-full">
            <GameSimulator project={currentProject.data} />
          </div>
        )}
      </main>

      {/* EXPORT MODAL */}
      {exportModalOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
           <div className="w-full max-w-2xl bg-zinc-950 border border-zinc-800 shadow-2xl p-8 animate-in zoom-in-95 duration-200 rounded-sm">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-xl font-black text-zinc-100 uppercase tracking-widest">{t('app.export_title')}</h2>
                  <p className="text-zinc-500 text-[10px] font-bold uppercase mt-1 tracking-widest">{t('app.export_desc')}</p>
                </div>
                <button onClick={() => setExportModalOpen(false)} className="text-zinc-500 hover:text-white">✕</button>
              </div>
              
              <div className="relative group">
                <textarea 
                  readOnly
                  value={exportDataString}
                  className="w-full h-64 bg-zinc-900/50 border border-zinc-800 p-4 text-[10px] font-mono text-zinc-400 focus:outline-none focus:border-zinc-700 resize-none rounded-sm custom-scrollbar"
                />
                <div className="absolute inset-0 bg-zinc-950/20 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity"></div>
              </div>

              <div className="flex items-center gap-3 pt-6">
                <button 
                  onClick={handleCopyExport}
                  className={`flex-1 py-3 ${copied ? 'bg-emerald-600' : 'bg-zinc-100'} ${copied ? 'text-white' : 'text-zinc-950'} hover:opacity-90 text-[10px] font-black uppercase tracking-[0.2em] transition-all rounded-sm`}
                >
                  {copied ? t('app.copied') : t('app.copy')}
                </button>
                <button 
                  onClick={() => setExportModalOpen(false)}
                  className="flex-1 py-3 border border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 text-[10px] font-black uppercase tracking-[0.2em] transition-all rounded-sm"
                >
                  {t('dashboard.modal.cancel')}
                </button>
              </div>
           </div>
        </div>
      )}

      {/* IMPORT MODAL */}
      {importModalOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
           <div className="w-full max-w-2xl bg-zinc-950 border border-zinc-800 shadow-2xl p-8 animate-in zoom-in-95 duration-200 rounded-sm">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-xl font-black text-zinc-100 uppercase tracking-widest">{t('app.import_title')}</h2>
                  <p className="text-zinc-500 text-[10px] font-bold uppercase mt-1 tracking-widest">{t('app.import_desc')}</p>
                </div>
                <button onClick={() => setImportModalOpen(false)} className="text-zinc-500 hover:text-white">✕</button>
              </div>
              
              <textarea 
                autoFocus
                value={importInput}
                onChange={(e) => setImportInput(e.target.value)}
                placeholder='{ "meta": ... , "project": ... }'
                className="w-full h-64 bg-zinc-900 border border-zinc-800 p-4 text-[10px] font-mono text-zinc-300 focus:outline-none focus:border-zinc-500 resize-none rounded-sm custom-scrollbar"
              />

              <div className="flex items-center gap-3 pt-6">
                <button 
                  onClick={executeImport}
                  disabled={!importInput.trim()}
                  className="flex-1 py-3 bg-zinc-100 text-zinc-950 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed text-[10px] font-black uppercase tracking-[0.2em] transition-all rounded-sm"
                >
                  {t('app.import_action')}
                </button>
                <button 
                  onClick={handleFileImport}
                  className="flex-1 py-3 border border-zinc-800 text-zinc-100 hover:bg-zinc-900 text-[10px] font-black uppercase tracking-[0.2em] transition-all rounded-sm"
                >
                  {t('dashboard.import_json')}
                </button>
                <button 
                  onClick={() => setImportModalOpen(false)}
                  className="flex-1 py-3 border border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 text-[10px] font-black uppercase tracking-[0.2em] transition-all rounded-sm"
                >
                  {t('dashboard.modal.cancel')}
                </button>
              </div>
           </div>
        </div>
      )}
      </>
      )}
    </div>
  );
};

export default App;
