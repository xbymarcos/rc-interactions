
import React, { createContext, useContext, useState, ReactNode } from 'react';

type Language = 'en' | 'es';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, params?: Record<string, string>) => string;
}

const translations = {
  en: {
    "app.title": "RealCity Architect",
    "app.lobby": "PROJECT_LOBBY",
    "app.logic_active": "LOGIC_CORE_ACTIVE",
    "app.editor": "Editor",
    "app.simulate": "Simulate",
    "app.save_json": "EXPORT JSON",
    "app.sync_db": "SYNC DB",
    "app.export_title": "EXPORT LOGIC",
    "app.export_desc": "Copy this code to share the flow with others.",
    "app.import_title": "IMPORT LOGIC",
    "app.import_desc": "Paste the logic code below to import the flow.",
    "app.copy": "COPY TO CLIPBOARD",
    "app.copied": "COPIED!",
    "app.import_action": "IMPORT DATA",
    "app.invalid_json": "The provided data is not a valid JSON.",
    "app.import_success": "Project imported successfully.",
    "app.confirm_delete": "WARNING: Confirm deletion of logic flow? This action is irreversible.",
    "app.ready_sync": "Ready for Database Sync",
    
    "dashboard.groups": "Groups",
    "dashboard.all_flows": "All Flows",
    "dashboard.new_group": "+ New Group",
    "dashboard.search_placeholder": "Filter by name...",
    "dashboard.new_flow": "+ New Flow",
    "dashboard.import_json": "IMPORT JSON",
    "dashboard.move_to": "Move To",
    "dashboard.nodes": "NODES",
    "dashboard.modified": "MODIFIED",
    "dashboard.empty_state": "No flows found in this sector",
    "dashboard.modal.title": "Initialize Sequence",
    "dashboard.modal.project_name": "Project Name",
    "dashboard.modal.target_group": "Target Group",
    "dashboard.modal.cancel": "Cancel",
    "dashboard.modal.create": "Create",
    "dashboard.modal.delete_flow.title": "Delete Flow?",
    "dashboard.modal.delete_flow.text": "Are you sure you want to delete this interaction flow? This action cannot be undone.",
    "dashboard.modal.delete_group.title": "Delete Group?",
    "dashboard.modal.delete_group.text": "Are you sure you want to delete the group \"{name}\"? All projects in this group will be moved to \"General\".",
    "dashboard.modal.delete": "Delete",
    "dashboard.confirm_delete_group": "Delete group \"{name}\"? Projects inside will be moved to General.",
    "dashboard.error_delete_general": "Cannot delete default 'General' group.",
    "dashboard.group_placeholder": "Group Name...",
    
    "editor.properties": "PROPERTIES",
    "editor.npc_id": "NPC ID",
    "editor.text_buffer": "Text Buffer",
    "editor.responses": "Responses",
    "editor.add": "+ ADD",
    "editor.variable_key": "Variable Key",
    "editor.operator": "Operator",
    "editor.value_check": "Check Value",
    "editor.value_set": "Set Value To",
    "editor.event_name": "Event Name",
    "editor.destroy_node": "DESTROY NODE",
    "editor.add_logic_block": "Add Logic Block",
    "editor.node.start": "BEGIN FLOW",
    "editor.node.end": "TERMINATE",
    "editor.node.set_variable": "SET",
    "editor.node.trigger": "TRIGGER",
    "editor.node.if": "IF",
    "editor.node.true": "TRUE",
    "editor.node.false": "FALSE",
    "editor.type_text": "Enter text...",
    "editor.type_next": "Next",
    "editor.type_option": "New Option",
    "editor.no_props": "No specific properties for this node type.",
    "editor.undo": "UNDO",
    "editor.redo": "REDO",
    "editor.reset_view": "RESET VIEW",
    "editor.npc_model": "NPC MODEL",
    "editor.coords": "COORDS (X Y Z W)",
    "editor.use_my_position": "USE MY POSITION",
    "editor.coord_w_heading": "W (heading)",
    "editor.op_equals": "== Equals",
    "editor.op_not_equals": "!= Not Equals",
    "editor.op_greater": "> Greater Than",
    "editor.op_less": "< Less Than",
    "editor.op_greater_eq": ">= Greater/Eq",
    "editor.op_less_eq": "<= Less/Eq",
    "dashboard.delete_group_btn": "Delete Group",
    "dashboard.delete_btn": "Delete",
    "runtime.header": "INTERACTION",
    "runtime.npc_fallback": "NPC",
    "runtime.waiting_event": "Waiting for event...",
    "runtime.navigate": "NAVIGATE",
    "runtime.select": "SELECT",
    "runtime.leave": "LEAVE",

    "simulator.start": "Start Simulation",
    "simulator.live_feed": "Live Feed",
    "simulator.system": "SYSTEM",
    "simulator.memory_debug": "MEMORY STATE (DEBUG)",
    "simulator.no_start_node": "No START node found in graph."
  },
  es: {
    "app.title": "Arquitecto RealCity",
    "app.lobby": "LOBBY_PROYECTO",
    "app.logic_active": "NUCLEO_LOGICO_ACTIVO",
    "app.editor": "Editor",
    "app.simulate": "Simular",
    "app.save_json": "EXPORTAR JSON",
    "app.sync_db": "SINC DB",
    "app.export_title": "EXPORTAR LÓGICA",
    "app.export_desc": "Copia este código para compartir el flujo con otros.",
    "app.import_title": "IMPORTAR LÓGICA",
    "app.import_desc": "Pega el código de lógica abajo para importar el flujo.",
    "app.copy": "COPIAR AL PORTAPAPELES",
    "app.copied": "¡COPIADO!",
    "app.import_action": "IMPORTAR DATOS",
    "app.invalid_json": "Los datos proporcionados no son un JSON válido.",
    "app.import_success": "Proyecto importado con éxito.",
    "app.confirm_delete": "ADVERTENCIA: ¿Confirmar eliminación del flujo lógico? Esta acción es irreversible.",
    "app.ready_sync": "Listo para Sincronización de Base de Datos",
    
    "dashboard.groups": "Grupos",
    "dashboard.all_flows": "Todos los Flujos",
    "dashboard.new_group": "+ Nuevo Grupo",
    "dashboard.search_placeholder": "Filtrar por nombre...",
    "dashboard.new_flow": "+ Nuevo Flujo",
    "dashboard.import_json": "IMPORTAR JSON",
    "dashboard.move_to": "Mover a",
    "dashboard.nodes": "NODOS",
    "dashboard.modified": "MODIFICADO",
    "dashboard.empty_state": "No se encontraron flujos en este sector",
    "dashboard.modal.title": "Inicializar Secuencia",
    "dashboard.modal.project_name": "Nombre del Proyecto",
    "dashboard.modal.target_group": "Grupo Destino",
    "dashboard.modal.cancel": "Cancelar",
    "dashboard.modal.create": "Crear",
    "dashboard.modal.delete_flow.title": "¿Eliminar Flujo?",
    "dashboard.modal.delete_flow.text": "¿Estás seguro de que quieres eliminar este flujo de interacción? Esta acción no se puede deshacer.",
    "dashboard.modal.delete_group.title": "¿Eliminar Grupo?",
    "dashboard.modal.delete_group.text": "¿Estás seguro de que quieres eliminar el grupo \"{name}\"? Todos los proyectos en este grupo se moverán a \"General\".",
    "dashboard.modal.delete": "Eliminar",
    "dashboard.confirm_delete_group": "¿Eliminar grupo \"{name}\"? Los proyectos dentro se moverán a General.",
    "dashboard.error_delete_general": "No se puede eliminar el grupo por defecto 'General'.",
    "dashboard.group_placeholder": "Nombre del Grupo...",

    "editor.properties": "PROPIEDADES",
    "editor.npc_id": "ID NPC",
    "editor.text_buffer": "Búfer de Texto",
    "editor.responses": "Respuestas",
    "editor.add": "+ AÑADIR",
    "editor.variable_key": "Clave Variable",
    "editor.operator": "Operador",
    "editor.value_check": "Verificar Valor",
    "editor.value_set": "Fijar Valor A",
    "editor.event_name": "Nombre Evento",
    "editor.destroy_node": "DESTRUIR NODO",
    "editor.add_logic_block": "Añadir Bloque Lógico",
    "editor.node.start": "INICIAR FLUJO",
    "editor.node.end": "TERMINAR",
    "editor.node.set_variable": "FIJAR",
    "editor.node.trigger": "DISPARAR",
    "editor.node.if": "SI",
    "editor.node.true": "VERDADERO",
    "editor.node.false": "FALSO",
    "editor.type_text": "Introducir texto...",
    "editor.type_next": "Siguiente",
    "editor.type_option": "Nueva Opción",
    "editor.no_props": "No hay propiedades específicas para este tipo de nodo.",
    "editor.undo": "DESHACER",
    "editor.redo": "REHACER",
    "editor.reset_view": "REINICIAR VISTA",
    "editor.npc_model": "MODELO NPC",
    "editor.coords": "COORDS (X Y Z W)",
    "editor.use_my_position": "USAR MI POSICIÓN",
    "editor.coord_w_heading": "W (rumbo)",
    "editor.op_equals": "== Igual",
    "editor.op_not_equals": "!= Diferente",
    "editor.op_greater": "> Mayor que",
    "editor.op_less": "< Menor que",
    "editor.op_greater_eq": ">= Mayor/Igual",
    "editor.op_less_eq": "<= Menor/Igual",
    "dashboard.delete_group_btn": "Eliminar Grupo",
    "dashboard.delete_btn": "Eliminar",
    "runtime.header": "INTERACCIÓN",
    "runtime.npc_fallback": "NPC",
    "runtime.waiting_event": "Esperando evento...",
    "runtime.navigate": "NAVEGAR",
    "runtime.select": "SELECCIONAR",
    "runtime.leave": "SALIR",

    "simulator.start": "Iniciar Simulación",
    "simulator.live_feed": "Señal en Vivo",
    "simulator.system": "SISTEMA",
    "simulator.memory_debug": "ESTADO DE MEMORIA (DEBUG)",
    "simulator.no_start_node": "No se encontró nodo START en el gráfico."
  }
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>('en');

  const t = (key: string, params?: Record<string, string>) => {
    let text = translations[language][key as keyof typeof translations['en']] || key;
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        text = text.replace(`{${k}}`, v);
      });
    }
    return text;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
