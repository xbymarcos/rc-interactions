
export enum NodeType {
  START = 'START',
  DIALOGUE = 'DIALOGUE',
  CONDITION = 'CONDITION',
  SET_VARIABLE = 'SET_VARIABLE',
  EVENT = 'EVENT',
  END = 'END'
}

export interface Choice {
  id: string;
  text: string;
  nextNodeId: string | null;
}

export interface NodePosition {
  x: number;
  y: number;
}

export interface WorldCoords {
  x: number;
  y: number;
  z: number;
  w?: number;
}

export interface DialogueNode {
  id: string;
  type: NodeType;
  position: NodePosition;
  data: {
    // World Spawn Data (for START)
    coords?: WorldCoords;
    model?: string;

    // Dialogue Data
    npcName?: string;
    text?: string;
    choices?: Choice[];
    
    // Logic Data
    variableName?: string;
    conditionOperator?: '==' | '!=' | '>' | '<' | '>=' | '<=';
    variableValue?: string; // stored as string, parsed at runtime
    
    // Event Data
    eventName?: string;
    eventPayload?: string;
  };
}

export interface Connection {
  id: string;
  fromNodeId: string;
  fromPort: string; // 'main', 'true', 'false', or choiceId
  toNodeId: string;
}

export interface ProjectData {
  nodes: DialogueNode[];
  connections: Connection[];
}

export interface Project {
  id: string;
  name: string;
  group: string; // Added group for categorization
  createdAt: string;
  updatedAt: string;
  data: ProjectData;
}
