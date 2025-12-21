
import React, { useState, useMemo } from 'react';
import { Project } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

interface DashboardProps {
  projects: Project[];
  groups: string[];
  onCreate: (name: string, group: string) => void;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, targetGroup: string) => void;
  onCreateGroup: (name: string) => void;
  onDeleteGroup: (name: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ 
  projects, 
  groups, 
  onCreate, 
  onOpen, 
  onDelete,
  onMove,
  onCreateGroup,
  onDeleteGroup
}) => {
  const { t } = useLanguage();
  const [selectedGroup, setSelectedGroup] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      const matchesGroup = selectedGroup === 'All' ? true : p.group === selectedGroup;
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesGroup && matchesSearch;
    });
  }, [projects, selectedGroup, searchQuery]);

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    const targetGroup = selectedGroup === 'All' ? 'General' : selectedGroup;
    onCreate(newProjectName, targetGroup);
    setIsCreatingProject(false);
    setNewProjectName('');
  };

  const handleCreateGroupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    onCreateGroup(newGroupName);
    setIsCreatingGroup(false);
    setNewGroupName('');
  };

  const handleDeleteClick = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    onDelete(id);
  };

  const handleMoveClick = (e: React.MouseEvent, id: string, group: string) => {
    e.preventDefault();
    e.stopPropagation();
    onMove(id, group);
    setOpenDropdownId(null);
  };

  return (
    <div className="w-full h-full bg-[#09090b] flex overflow-hidden">
      
      {/* SIDEBAR: GROUPS */}
      <aside className="w-64 flex-shrink-0 bg-zinc-950/50 border-r border-zinc-800 flex flex-col z-20">
        <div className="p-6 border-b border-zinc-800/50">
           <h2 className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.2em] mb-4">{t('dashboard.groups')}</h2>
           <button 
             onClick={() => setSelectedGroup('All')}
             className={`w-full text-left px-3 py-2 text-[11px] font-bold uppercase tracking-wide rounded-sm transition-all flex items-center justify-between group ${selectedGroup === 'All' ? 'bg-zinc-100 text-zinc-950' : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'}`}
           >
             <span>{t('dashboard.all_flows')}</span>
             <span className={`text-[9px] ${selectedGroup === 'All' ? 'text-zinc-400' : 'text-zinc-600'}`}>{projects.length}</span>
           </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-1">
          {groups.map(group => (
            <div key={group} className="group/item relative">
               <button 
                 onClick={() => setSelectedGroup(group)}
                 className={`w-full text-left px-3 py-2 text-[11px] font-medium uppercase tracking-wide rounded-sm transition-all flex items-center justify-between ${selectedGroup === group ? 'bg-zinc-800 text-zinc-100 border border-zinc-700' : 'text-zinc-500 hover:bg-zinc-900/50 hover:text-zinc-300 border border-transparent'}`}
               >
                 <span className="truncate pr-4">{group}</span>
                 <span className={`text-[9px] font-mono ${selectedGroup === group ? 'text-zinc-400' : 'text-zinc-700'}`}>
                    {projects.filter(p => p.group === group).length}
                 </span>
               </button>
               {group !== 'General' && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); onDeleteGroup(group); }}
                    className="absolute right-10 top-2 text-rose-800 opacity-0 group-hover/item:opacity-100 hover:text-rose-500 transition-all text-[10px]"
                    title="Delete Group"
                  >✕</button>
               )}
            </div>
          ))}

          {isCreatingGroup ? (
            <form onSubmit={handleCreateGroupSubmit} className="px-1 mt-4">
              <input 
                autoFocus
                className="w-full bg-zinc-900 border border-zinc-700 p-2 text-[10px] text-white focus:outline-none rounded-sm"
                placeholder={t('dashboard.group_placeholder')}
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                onBlur={() => !newGroupName && setIsCreatingGroup(false)}
              />
            </form>
          ) : (
            <button 
              onClick={() => setIsCreatingGroup(true)}
              className="w-full text-left px-4 py-3 text-[10px] font-black uppercase tracking-[0.1em] text-emerald-600 hover:text-emerald-400 transition-colors mt-2"
            >
              {t('dashboard.new_group')}
            </button>
          )}
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col relative bg-[#09090b]">
        {/* Background Decor */}
        <div className="absolute inset-0 pointer-events-none opacity-20" 
             style={{ backgroundImage: 'radial-gradient(#27272a 1px, transparent 1px)', backgroundSize: '32px 32px' }}>
        </div>

        {/* Toolbar */}
        <div className="h-20 flex-shrink-0 border-b border-zinc-800 px-8 flex items-center justify-between relative z-10 bg-[#09090b]/80 backdrop-blur-sm">
           <div className="flex items-center gap-6 flex-1">
              <h2 className="text-2xl font-black text-zinc-100 uppercase tracking-tight">{selectedGroup === 'All' ? t('dashboard.all_flows') : selectedGroup}</h2>
              <div className="h-6 w-[1px] bg-zinc-800"></div>
              
              {/* Search Bar */}
              <div className="relative group w-96">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 group-focus-within:text-zinc-300 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input 
                   type="text" 
                   value={searchQuery}
                   onChange={(e) => setSearchQuery(e.target.value)}
                   placeholder={t('dashboard.search_placeholder')}
                   className="w-full bg-zinc-900/50 border border-zinc-800 rounded-sm py-2 pl-10 pr-4 text-xs text-zinc-200 focus:bg-zinc-900 focus:border-zinc-600 focus:outline-none transition-all placeholder-zinc-700"
                />
              </div>
           </div>

           <button 
             onClick={() => setIsCreatingProject(true)}
             className="px-6 py-2.5 bg-zinc-100 text-zinc-950 text-[10px] font-black tracking-[0.2em] uppercase hover:bg-white transition-all shadow-lg hover:shadow-emerald-500/20"
           >
             {t('dashboard.new_flow')}
           </button>
        </div>

        {/* Grid Area */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-8 relative z-0" onClick={() => setOpenDropdownId(null)}>
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
              
              {/* Dynamic Project Cards */}
              {filteredProjects.map(project => (
                <div 
                  key={project.id}
                  onClick={() => onOpen(project.id)}
                  className="group relative h-64 bg-zinc-900/40 border border-zinc-800 hover:border-zinc-600 hover:bg-zinc-900/80 transition-all cursor-pointer flex flex-col justify-between p-6 overflow-visible rounded-sm"
                >
                  {/* Card Controls */}
                  <div className="absolute top-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity z-50 flex gap-2">
                     {/* Move Dropdown */}
                     <div className="relative">
                       <button 
                         onClick={(e) => { e.stopPropagation(); setOpenDropdownId(openDropdownId === project.id ? null : project.id); }}
                         className="w-7 h-7 flex items-center justify-center bg-zinc-950/80 text-zinc-500 hover:text-white border border-zinc-800 hover:border-zinc-600 rounded-sm"
                         title={t('dashboard.move_to')}
                       >
                         <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                         </svg>
                       </button>

                       {openDropdownId === project.id && (
                         <div className="absolute right-0 top-full mt-2 w-48 bg-zinc-950 border border-zinc-700 shadow-xl rounded-sm z-[100] animate-in fade-in zoom-in-95 duration-100">
                           <div className="px-3 py-2 text-[8px] font-black uppercase text-zinc-600 border-b border-zinc-800">{t('dashboard.move_to')}</div>
                           {groups.map(g => (
                             <button
                               key={g}
                               onClick={(e) => handleMoveClick(e, project.id, g)}
                               className={`w-full text-left px-3 py-2 text-[10px] hover:bg-zinc-900 transition-colors uppercase ${project.group === g ? 'text-emerald-500 font-bold' : 'text-zinc-400'}`}
                             >
                               {g}
                             </button>
                           ))}
                         </div>
                       )}
                     </div>

                     <button 
                       onClick={(e) => handleDeleteClick(e, project.id)}
                       className="w-7 h-7 flex items-center justify-center bg-zinc-950/80 text-zinc-500 hover:text-rose-500 hover:bg-rose-500/10 border border-zinc-800 hover:border-rose-500/50 rounded-sm"
                       title="Delete"
                     >
                       <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                       </svg>
                     </button>
                  </div>

                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
                      <span className="text-[9px] text-zinc-500 font-mono uppercase tracking-widest">{project.group}</span>
                    </div>
                    <h3 className="text-xl font-bold text-zinc-200 group-hover:text-white transition-colors line-clamp-2">{project.name}</h3>
                  </div>

                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 border-t border-zinc-800 pt-4">
                      <div>
                        <p className="text-[8px] text-zinc-600 uppercase tracking-widest mb-1">{t('dashboard.nodes')}</p>
                        <p className="text-sm font-mono text-zinc-300">{project.data.nodes.length}</p>
                      </div>
                      <div>
                        <p className="text-[8px] text-zinc-600 uppercase tracking-widest mb-1">{t('dashboard.modified')}</p>
                        <p className="text-sm font-mono text-zinc-300">{new Date(project.updatedAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                    
                    <div className="w-full h-0.5 bg-zinc-800 rounded-full overflow-hidden">
                       <div className="h-full bg-zinc-400 w-0 group-hover:w-full transition-all duration-700 ease-out"></div>
                    </div>
                  </div>
                </div>
              ))}

              {filteredProjects.length === 0 && (
                <div className="col-span-full flex flex-col items-center justify-center h-64 border border-zinc-800 border-dashed rounded-sm opacity-50">
                   <p className="text-zinc-500 text-xs font-mono uppercase tracking-widest">{t('dashboard.empty_state')}</p>
                </div>
              )}
           </div>
        </div>
      </div>

      {/* CREATE PROJECT MODAL */}
      {isCreatingProject && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
           <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 shadow-2xl p-8 animate-in zoom-in-95 duration-200 rounded-sm">
              <h2 className="text-xl font-black text-zinc-100 uppercase tracking-widest mb-6">{t('dashboard.modal.title')}</h2>
              
              <form onSubmit={handleCreateSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{t('dashboard.modal.project_name')}</label>
                  <input 
                    autoFocus
                    type="text" 
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    placeholder="e.g. Sheriff Interaction v2"
                    className="w-full bg-zinc-900 border border-zinc-800 p-4 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-500 focus:bg-zinc-900/80 transition-all font-medium"
                  />
                </div>
                
                <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{t('dashboard.modal.target_group')}</label>
                    <div className="p-3 bg-zinc-900 border border-zinc-800 text-zinc-400 text-xs font-mono uppercase">
                        {selectedGroup === 'All' ? 'General' : selectedGroup}
                    </div>
                </div>

                <div className="flex items-center gap-3 pt-4">
                  <button 
                    type="button"
                    onClick={() => setIsCreatingProject(false)}
                    className="flex-1 py-3 border border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 text-[10px] font-black uppercase tracking-[0.2em] transition-all"
                  >
                    {t('dashboard.modal.cancel')}
                  </button>
                  <button 
                    type="submit"
                    disabled={!newProjectName.trim()}
                    className="flex-1 py-3 bg-zinc-100 text-zinc-950 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed text-[10px] font-black uppercase tracking-[0.2em] transition-all"
                  >
                    {t('dashboard.modal.create')}
                  </button>
                </div>
              </form>
           </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
