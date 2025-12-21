
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

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
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
    const newId = `proj_${Date.now()}`; // Temporary ID, server should ideally assign UUID
    // Better to use a UUID generator here if possible or let server handle it.
    // For now, we use this.
    const newProject = generateMockProject(newId, name, group);
    setProjects(prev => [newProject, ...prev]); 
    setCurrentProjectId(newId);
    setView('EDITOR');
  };

  const handleDeleteProject = (id: string) => {
    if (window.confirm(t('app.confirm_delete'))) {
      fetchNui('deleteProject', { id });
      setProjects(prev => prev.filter(p => p.id !== id));
      if (currentProjectId === id) {
        setCurrentProjectId(null);
        setView('DASHBOARD');
      }
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
     if (window.confirm(t('dashboard.confirm_delete_group', { name }))) {
       setProjects(prev => prev.map(p => p.group === name ? { ...p, group: 'General' } : p));
       setGroups(prev => prev.filter(g => g !== name));
     }
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

  // --- FILE EXPORT ---

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

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentProject.name.replace(/\s+/g, '_').toLowerCase()}.json`;
    a.click();
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
      </>
      )}
    </div>
  );
};

export default App;
