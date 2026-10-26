/**
 * Vortex2D Game Engine - Scene Presets
 * Scene starts 100% blank with only <root> node.
 */

import type { SceneNode } from './types.ts';
import { createDefaultTransformComponent } from './math.ts';

export function createEmptyScene(): Map<string, SceneNode> {
  const nodes = new Map<string, SceneNode>();

  const root: SceneNode = {
    id: '<root>',
    name: '<root>',
    enabled: true,
    parentId: null,
    children: [],
    baseTransform: { x: 0, y: 0, rotationDeg: 0, scaleX: 1, scaleY: 1 },
    operations: [],
    components: [
      createDefaultTransformComponent(0, 0, 0, 1, 1),
    ],
  };

  nodes.set('<root>', root);
  return nodes;
}
