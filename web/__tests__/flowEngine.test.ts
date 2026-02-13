/**
 * RC-Interactions — Flow Engine Tests
 *
 * Unit tests for the pure logic functions used by both the web simulator
 * and (conceptually) the Lua runtime.
 */

import { describe, it, expect } from 'vitest';
import {
  findNextNode,
  evaluateCondition,
  traverseLogic,
  FlowGraph,
  GameMemory,
} from '../utils/flowEngine';
import { DialogueNode, Connection, NodeType } from '../types';

// ---------------------------------------------------------------------------
// Helpers — build test fixtures quickly
// ---------------------------------------------------------------------------

let _idCounter = 0;
function uid(): string {
  return `node_${++_idCounter}`;
}

function makeNode(
  id: string,
  type: NodeType,
  data: Partial<DialogueNode['data']> = {},
): DialogueNode {
  return {
    id,
    type,
    position: { x: 0, y: 0 },
    data: {
      ...data,
    },
  };
}

function conn(
  fromNodeId: string,
  toNodeId: string,
  fromPort: string = 'main',
): Connection {
  return { id: uid(), fromNodeId, fromPort, toNodeId };
}

// ---------------------------------------------------------------------------
// findNextNode
// ---------------------------------------------------------------------------

describe('findNextNode', () => {
  it('returns the connected node for a given port', () => {
    const a = makeNode('a', NodeType.START);
    const b = makeNode('b', NodeType.DIALOGUE, { text: 'Hi' });
    const graph: FlowGraph = {
      nodes: [a, b],
      connections: [conn('a', 'b', 'main')],
    };

    const result = findNextNode(graph, 'a', 'main');
    expect(result).not.toBeNull();
    expect(result!.id).toBe('b');
  });

  it('returns null when no connection exists', () => {
    const a = makeNode('a', NodeType.START);
    const graph: FlowGraph = { nodes: [a], connections: [] };

    expect(findNextNode(graph, 'a', 'main')).toBeNull();
  });

  it('returns null when the target node is missing', () => {
    const a = makeNode('a', NodeType.START);
    const graph: FlowGraph = {
      nodes: [a],
      connections: [conn('a', 'ghost', 'main')],
    };

    expect(findNextNode(graph, 'a', 'main')).toBeNull();
  });

  it('matches the correct port on condition nodes', () => {
    const cond = makeNode('c', NodeType.CONDITION);
    const yes = makeNode('y', NodeType.DIALOGUE, { text: 'yes' });
    const no = makeNode('n', NodeType.DIALOGUE, { text: 'no' });
    const graph: FlowGraph = {
      nodes: [cond, yes, no],
      connections: [conn('c', 'y', 'true'), conn('c', 'n', 'false')],
    };

    expect(findNextNode(graph, 'c', 'true')!.id).toBe('y');
    expect(findNextNode(graph, 'c', 'false')!.id).toBe('n');
  });
});

// ---------------------------------------------------------------------------
// evaluateCondition
// ---------------------------------------------------------------------------

describe('evaluateCondition', () => {
  const mem: GameMemory = { score: '100', name: 'marcus', flag: 'true' };

  // Equality
  it('== string match', () => {
    expect(evaluateCondition('name', '==', 'marcus', mem)).toBe(true);
  });
  it('== string mismatch', () => {
    expect(evaluateCondition('name', '==', 'john', mem)).toBe(false);
  });
  it('== numeric match', () => {
    expect(evaluateCondition('score', '==', '100', mem)).toBe(true);
  });

  // Inequality
  it('!= returns true on mismatch', () => {
    expect(evaluateCondition('name', '!=', 'john', mem)).toBe(true);
  });
  it('!= returns false on match', () => {
    expect(evaluateCondition('name', '!=', 'marcus', mem)).toBe(false);
  });

  // Numeric comparisons
  it('> works with numbers', () => {
    expect(evaluateCondition('score', '>', '50', mem)).toBe(true);
    expect(evaluateCondition('score', '>', '200', mem)).toBe(false);
  });
  it('< works with numbers', () => {
    expect(evaluateCondition('score', '<', '200', mem)).toBe(true);
    expect(evaluateCondition('score', '<', '50', mem)).toBe(false);
  });
  it('>= works with numbers', () => {
    expect(evaluateCondition('score', '>=', '100', mem)).toBe(true);
    expect(evaluateCondition('score', '>=', '101', mem)).toBe(false);
  });
  it('<= works with numbers', () => {
    expect(evaluateCondition('score', '<=', '100', mem)).toBe(true);
    expect(evaluateCondition('score', '<=', '99', mem)).toBe(false);
  });

  // Non-numeric > / < should return false
  it('> returns false for non-numeric strings', () => {
    expect(evaluateCondition('name', '>', 'aaa', mem)).toBe(false);
  });

  // Missing variable defaults to empty string
  it('missing variable uses empty string', () => {
    expect(evaluateCondition('nonexistent', '==', '', mem)).toBe(true);
    expect(evaluateCondition('nonexistent', '==', 'x', mem)).toBe(false);
  });

  // Undefined operator defaults to ==
  it('undefined operator defaults to ==', () => {
    expect(evaluateCondition('score', undefined, '100', mem)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// traverseLogic — full flow traversal
// ---------------------------------------------------------------------------

describe('traverseLogic', () => {
  it('traverses START → DIALOGUE', () => {
    const s = makeNode('s', NodeType.START);
    const d = makeNode('d', NodeType.DIALOGUE, { text: 'Hello' });
    const graph: FlowGraph = {
      nodes: [s, d],
      connections: [conn('s', 'd')],
    };

    const result = traverseLogic(graph, 's', {});
    expect(result).toBe('d');
  });

  it('traverses START → END', () => {
    const s = makeNode('s', NodeType.START);
    const e = makeNode('e', NodeType.END);
    const graph: FlowGraph = {
      nodes: [s, e],
      connections: [conn('s', 'e')],
    };

    expect(traverseLogic(graph, 's', {})).toBe('e');
  });

  it('traverses START → SET_VARIABLE → DIALOGUE and sets memory', () => {
    const s = makeNode('s', NodeType.START);
    const sv = makeNode('sv', NodeType.SET_VARIABLE, {
      variableName: 'quest',
      variableValue: 'started',
    });
    const d = makeNode('d', NodeType.DIALOGUE, { text: 'Quest started!' });
    const graph: FlowGraph = {
      nodes: [s, sv, d],
      connections: [conn('s', 'sv'), conn('sv', 'd')],
    };

    const memory: GameMemory = {};
    const result = traverseLogic(graph, 's', memory);
    expect(result).toBe('d');
    expect(memory.quest).toBe('started');
  });

  it('traverses CONDITION → true branch', () => {
    const s = makeNode('s', NodeType.START);
    const c = makeNode('c', NodeType.CONDITION, {
      variableName: 'level',
      conditionOperator: '>=',
      variableValue: '10',
    });
    const yes = makeNode('y', NodeType.DIALOGUE, { text: 'Welcome, veteran' });
    const no = makeNode('n', NodeType.DIALOGUE, { text: 'Too low level' });
    const graph: FlowGraph = {
      nodes: [s, c, yes, no],
      connections: [conn('s', 'c'), conn('c', 'y', 'true'), conn('c', 'n', 'false')],
    };

    const result = traverseLogic(graph, 's', { level: '15' });
    expect(result).toBe('y');
  });

  it('traverses CONDITION → false branch', () => {
    const s = makeNode('s', NodeType.START);
    const c = makeNode('c', NodeType.CONDITION, {
      variableName: 'level',
      conditionOperator: '>=',
      variableValue: '10',
    });
    const yes = makeNode('y', NodeType.DIALOGUE, { text: 'Welcome' });
    const no = makeNode('n', NodeType.DIALOGUE, { text: 'Denied' });
    const graph: FlowGraph = {
      nodes: [s, c, yes, no],
      connections: [conn('s', 'c'), conn('c', 'y', 'true'), conn('c', 'n', 'false')],
    };

    const result = traverseLogic(graph, 's', { level: '5' });
    expect(result).toBe('n');
  });

  it('traverses SET_VARIABLE → CONDITION chain (issue #1 regression)', () => {
    // This is the exact scenario from the GitHub issue:
    // DIALOGUE choice → SET_VARIABLE → DIALOGUE (should work, not get stuck)
    const d1 = makeNode('d1', NodeType.DIALOGUE, {
      text: 'Hello',
      choices: [{ id: 'ch1', text: 'Hello', nextNodeId: null }],
    });
    const sv = makeNode('sv', NodeType.SET_VARIABLE, {
      variableName: 'greeted',
      variableValue: 'yes',
    });
    const d2 = makeNode('d2', NodeType.DIALOGUE, { text: 'test' });
    const graph: FlowGraph = {
      nodes: [d1, sv, d2],
      connections: [conn('d1', 'sv', 'ch1'), conn('sv', 'd2')],
    };

    // Simulate: player clicks choice "ch1" on d1 → engine receives sv's id
    const memory: GameMemory = {};
    const result = traverseLogic(graph, 'sv', memory);
    expect(result).toBe('d2');
    expect(memory.greeted).toBe('yes');
  });

  it('traverses EVENT → DIALOGUE (events are pass-through)', () => {
    const s = makeNode('s', NodeType.START);
    const ev = makeNode('ev', NodeType.EVENT, { eventName: 'myEvent' });
    const d = makeNode('d', NodeType.DIALOGUE, { text: 'After event' });
    const graph: FlowGraph = {
      nodes: [s, ev, d],
      connections: [conn('s', 'ev'), conn('ev', 'd')],
    };

    expect(traverseLogic(graph, 's', {})).toBe('d');
  });

  it('returns null for disconnected nodes', () => {
    const s = makeNode('s', NodeType.START);
    const graph: FlowGraph = { nodes: [s], connections: [] };

    expect(traverseLogic(graph, 's', {})).toBeNull();
  });

  it('returns null for missing start node', () => {
    const graph: FlowGraph = { nodes: [], connections: [] };
    expect(traverseLogic(graph, 'ghost', {})).toBeNull();
  });

  it('handles infinite loop protection', () => {
    // Create a loop: A → B → A
    const a = makeNode('a', NodeType.EVENT, { eventName: 'loop' });
    const b = makeNode('b', NodeType.EVENT, { eventName: 'loop' });
    const graph: FlowGraph = {
      nodes: [a, b],
      connections: [conn('a', 'b'), conn('b', 'a')],
    };

    // Should return null after maxIterations, not hang
    expect(traverseLogic(graph, 'a', {}, 10)).toBeNull();
  });

  it('complex flow: START → SET_VAR → CONDITION → SET_VAR → DIALOGUE', () => {
    const s = makeNode('s', NodeType.START);
    const sv1 = makeNode('sv1', NodeType.SET_VARIABLE, {
      variableName: 'status',
      variableValue: 'vip',
    });
    const c = makeNode('c', NodeType.CONDITION, {
      variableName: 'status',
      conditionOperator: '==',
      variableValue: 'vip',
    });
    const sv2 = makeNode('sv2', NodeType.SET_VARIABLE, {
      variableName: 'discount',
      variableValue: '20',
    });
    const d = makeNode('d', NodeType.DIALOGUE, { text: 'VIP discount applied!' });
    const dNo = makeNode('dNo', NodeType.DIALOGUE, { text: 'No discount' });

    const graph: FlowGraph = {
      nodes: [s, sv1, c, sv2, d, dNo],
      connections: [
        conn('s', 'sv1'),
        conn('sv1', 'c'),
        conn('c', 'sv2', 'true'),
        conn('c', 'dNo', 'false'),
        conn('sv2', 'd'),
      ],
    };

    const memory: GameMemory = {};
    const result = traverseLogic(graph, 's', memory);
    expect(result).toBe('d');
    expect(memory.status).toBe('vip');
    expect(memory.discount).toBe('20');
  });

  it('multiple SET_VARIABLE in sequence', () => {
    const sv1 = makeNode('sv1', NodeType.SET_VARIABLE, {
      variableName: 'a',
      variableValue: '1',
    });
    const sv2 = makeNode('sv2', NodeType.SET_VARIABLE, {
      variableName: 'b',
      variableValue: '2',
    });
    const sv3 = makeNode('sv3', NodeType.SET_VARIABLE, {
      variableName: 'c',
      variableValue: '3',
    });
    const d = makeNode('d', NodeType.DIALOGUE, { text: 'Done' });

    const graph: FlowGraph = {
      nodes: [sv1, sv2, sv3, d],
      connections: [conn('sv1', 'sv2'), conn('sv2', 'sv3'), conn('sv3', 'd')],
    };

    const memory: GameMemory = {};
    const result = traverseLogic(graph, 'sv1', memory);
    expect(result).toBe('d');
    expect(memory).toEqual({ a: '1', b: '2', c: '3' });
  });

  it('SET_VARIABLE overwrites previous value', () => {
    const sv1 = makeNode('sv1', NodeType.SET_VARIABLE, {
      variableName: 'x',
      variableValue: 'old',
    });
    const sv2 = makeNode('sv2', NodeType.SET_VARIABLE, {
      variableName: 'x',
      variableValue: 'new',
    });
    const d = makeNode('d', NodeType.DIALOGUE, { text: 'Check' });

    const graph: FlowGraph = {
      nodes: [sv1, sv2, d],
      connections: [conn('sv1', 'sv2'), conn('sv2', 'd')],
    };

    const memory: GameMemory = {};
    traverseLogic(graph, 'sv1', memory);
    expect(memory.x).toBe('new');
  });

  it('CONDITION with missing variable evaluates against empty string', () => {
    const c = makeNode('c', NodeType.CONDITION, {
      variableName: 'unknown',
      conditionOperator: '==',
      variableValue: '',
    });
    const yes = makeNode('y', NodeType.DIALOGUE, { text: 'empty match' });
    const no = makeNode('n', NodeType.DIALOGUE, { text: 'no' });
    const graph: FlowGraph = {
      nodes: [c, yes, no],
      connections: [conn('c', 'y', 'true'), conn('c', 'n', 'false')],
    };

    expect(traverseLogic(graph, 'c', {})).toBe('y');
  });
});
