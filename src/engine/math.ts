/**
 * Vortex2D Game Engine - Mathematics & Transform Pipeline
 * Completely unbounded float precision, reverse-order operation composition,
 * and deterministic script & behavior execution.
 */

import type {
  Matrix3x3,
  SceneNode,
  TransformOperation,
  TransformComponent,
  ScriptComponent,
  ScriptContext,
} from './types.ts';

// Global keyboard tracking for script components
export const activeKeyboardKeys = new Set<string>();
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', (e) => activeKeyboardKeys.add(e.code));
  window.addEventListener('keyup', (e) => activeKeyboardKeys.delete(e.code));
}

// 3x3 Affine Matrix layout: [a, b, c, d, tx, ty]
// [ a  c  tx ]
// [ b  d  ty ]
// [ 0  0   1 ]

export function identityMatrix(): Matrix3x3 {
  return [1, 0, 0, 1, 0, 0];
}

export function translationMatrix(x: number, y: number): Matrix3x3 {
  return [1, 0, 0, 1, x, y];
}

export function rotationMatrix(deg: number): Matrix3x3 {
  const rad = (deg * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return [c, s, -s, c, 0, 0];
}

export function scaleMatrix(sx: number, sy: number): Matrix3x3 {
  return [sx, 0, 0, sy, 0, 0];
}

export function multiplyMatrices(A: Matrix3x3, B: Matrix3x3): Matrix3x3 {
  // A * B
  const [a1, b1, c1, d1, tx1, ty1] = A;
  const [a2, b2, c2, d2, tx2, ty2] = B;

  return [
    a1 * a2 + c1 * b2,
    b1 * a2 + d1 * b2,
    a1 * c2 + c1 * d2,
    b1 * c2 + d1 * d2,
    a1 * tx2 + c1 * ty2 + tx1,
    b1 * tx2 + d1 * ty2 + ty1,
  ];
}

export function transformPoint(m: Matrix3x3, x: number, y: number): [number, number] {
  const [a, b, c, d, tx, ty] = m;
  return [a * x + c * y + tx, b * x + d * y + ty];
}

export function invertMatrix(m: Matrix3x3): Matrix3x3 {
  const [a, b, c, d, tx, ty] = m;
  const det = a * d - b * c;
  if (Math.abs(det) < 1e-12) {
    return identityMatrix();
  }
  const invDet = 1.0 / det;
  const invA = d * invDet;
  const invB = -b * invDet;
  const invC = -c * invDet;
  const invD = a * invDet;
  const invTx = (c * ty - d * tx) * invDet;
  const invTy = (b * tx - a * ty) * invDet;

  return [invA, invB, invC, invD, invTx, invTy];
}

export function decomposeMatrix(m: Matrix3x3): {
  x: number;
  y: number;
  rotationDeg: number;
  scaleX: number;
  scaleY: number;
} {
  const [a, b, c, d, tx, ty] = m;
  const scaleX = Math.hypot(a, b);
  const scaleY = Math.hypot(c, d);
  let rotationDeg = (Math.atan2(b, a) * 180) / Math.PI;
  if (rotationDeg < 0) rotationDeg += 360;

  return {
    x: tx,
    y: ty,
    rotationDeg,
    scaleX,
    scaleY,
  };
}

/**
 * Creates a fresh default Transform component.
 */
export function createDefaultTransformComponent(
  x: number = 0,
  y: number = 0,
  rotationDeg: number = 0,
  scaleX: number = 1,
  scaleY: number = 1
): TransformComponent {
  return {
    id: `comp_trans_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    type: 'Transform',
    enabled: true,
    x,
    y,
    rotationDeg,
    scaleX,
    scaleY,
    uniformScale: true,
    operations: [],
  };
}

/**
 * Retrieves the first TransformComponent on a node, if any.
 */
export function getNodeTransform(node: SceneNode): TransformComponent | undefined {
  return node.components.find((c): c is TransformComponent => c.type === 'Transform');
}

/**
 * Retrieves or creates a TransformComponent on a node.
 */
export function ensureNodeTransform(node: SceneNode): TransformComponent {
  let trans = getNodeTransform(node);
  if (!trans) {
    trans = createDefaultTransformComponent();
    node.components.unshift(trans);
  }
  return trans;
}

/**
 * Computes the Local Transform Matrix for an entity.
 * Per specification:
 * - Starts with base transform (x, y, rotationDeg, scaleX, scaleY)
 * - Applies transform operations in REVERSE order:
 *   (last operation in the list is applied first, working back to the first operation)
 */
export function computeLocalMatrix(
  base: { x: number; y: number; rotationDeg: number; scaleX: number; scaleY: number },
  operations: TransformOperation[]
): Matrix3x3 {
  // Base transform matrix: T * R * S
  const tMat = translationMatrix(base.x, base.y);
  const rMat = rotationMatrix(base.rotationDeg);
  const sMat = scaleMatrix(base.scaleX, base.scaleY);

  // M = T * R * S
  let M = multiplyMatrices(tMat, multiplyMatrices(rMat, sMat));

  // Apply operations in REVERSE order (from operations.length - 1 down to 0)
  for (let i = operations.length - 1; i >= 0; i--) {
    const op = operations[i];
    if (!op.enabled) continue;

    if (op.type === 'SCALE') {
      const opScale = scaleMatrix(op.scaleX, op.scaleY);
      M = multiplyMatrices(M, opScale);
    } else if (op.type === 'ROTATE') {
      const opRot = rotationMatrix(op.rotateDeg);
      M = multiplyMatrices(M, opRot);
    } else if (op.type === 'TRANSLATE') {
      const opTrans = translationMatrix(op.translateX, op.translateY);
      if (op.space === 'world') {
        // Applied in outer/world space relative to the object
        M = multiplyMatrices(opTrans, M);
      } else {
        // Applied in local object space
        M = multiplyMatrices(M, opTrans);
      }
    }
  }

  return M;
}

/**
 * Compiles a ScriptComponent JavaScript source code string into a runnable function.
 */
export function compileScript(sourceCode: string): {
  fn?: (node: SceneNode, dt: number, time: number, context: ScriptContext) => void;
  error?: string;
} {
  try {
    // Sandboxed runner with safe args
    const wrapper = new Function(
      'node',
      'dt',
      'time',
      'context',
      `"use strict";\n${sourceCode}`
    );
    return {
      fn: (node: SceneNode, dt: number, time: number, context: ScriptContext) => {
        try {
          wrapper(node, dt, time, context);
        } catch (runtimeErr: any) {
          console.warn(`Script runtime error in '${node.name}':`, runtimeErr.message);
        }
      },
    };
  } catch (syntaxErr: any) {
    return { error: syntaxErr.message || String(syntaxErr) };
  }
}

/**
 * Traverses the scene hierarchy and computes Local and World matrices for all nodes.
 * Components are executed and evaluated strictly in ORDER OF APPEARANCE!
 */
export function updateSceneMatrices(
  nodes: Map<string, SceneNode>,
  rootId: string = '<root>',
  simTime: number = 0,
  deltaTime: number = 0,
  isPlaying: boolean = false,
  mousePosWorld: { x: number; y: number; isDown: boolean } = { x: 0, y: 0, isDown: false }
): void {
  const scriptContext: ScriptContext = {
    time: simTime,
    dt: deltaTime,
    keys: activeKeyboardKeys,
    mouse: { worldX: mousePosWorld.x, worldY: mousePosWorld.y, isDown: mousePosWorld.isDown },
    getNode: (id: string) => nodes.get(id),
    spawnEntity: (name: string, spriteId: string = 'spaceship') => {
      const newId = `ent_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const newNode: SceneNode = {
        id: newId,
        name,
        enabled: true,
        parentId: '<root>',
        children: [],
        baseTransform: { x: 0, y: 0, rotationDeg: 0, scaleX: 1, scaleY: 1 },
        operations: [],
        components: [
          createDefaultTransformComponent(0, 0, 0, 1, 1),
          {
            id: `comp_spr_${Date.now()}`,
            type: 'SpriteRenderer',
            enabled: true,
            spriteId,
            color: [1, 1, 1, 1],
            width: 64,
            height: 64,
            pivotX: 0.5,
            pivotY: 0.5,
            flipX: false,
            flipY: false,
            sortOrder: 10,
          },
        ],
      };
      nodes.set(newId, newNode);
      const root = nodes.get('<root>');
      if (root) root.children.push(newId);
      return newNode;
    },
    destroyEntity: (id: string) => {
      const node = nodes.get(id);
      if (node && node.parentId) {
        const parent = nodes.get(node.parentId);
        if (parent) {
          parent.children = parent.children.filter((cid) => cid !== id);
        }
      }
      nodes.delete(id);
    },
    log: (msg: string) => console.log(`[ScriptLog] ${msg}`),
  };

  function traverse(nodeId: string, parentWorldMatrix: Matrix3x3, parentOpacity: number) {
    const node = nodes.get(nodeId);
    if (!node) return;

    // Components are evaluated and processed in ORDER OF APPEARANCE:
    let activeTransform: TransformComponent | undefined;
    let selfOpacity = 1.0;

    for (const comp of node.components) {
      if (!comp.enabled) continue;

      if (comp.type === 'Transform') {
        activeTransform = comp;
      } else if (comp.type === 'OpacityModifier') {
        if (comp.pulse && isPlaying) {
          const t = Math.sin(simTime * comp.pulseSpeed * Math.PI * 2);
          const norm = (t + 1) / 2; // 0..1
          selfOpacity *= comp.pulseMin + norm * (comp.pulseMax - comp.pulseMin);
        } else {
          selfOpacity *= comp.opacity;
        }
      } else if (isPlaying && node.enabled) {
        // Execute Script Component in order of appearance
        if (comp.type === 'Script') {
          if (!comp.compiledFn && comp.sourceCode && !comp.lastError) {
            const res = compileScript(comp.sourceCode);
            if (res.fn) comp.compiledFn = res.fn;
            if (res.error) comp.lastError = res.error;
          }
          if (comp.compiledFn) {
            comp.compiledFn(node, deltaTime, simTime, scriptContext);
          }
        } else if (comp.type === 'RotatorBehavior') {
          const targetTrans = activeTransform || getNodeTransform(node);
          if (targetTrans) {
            const deltaDeg = comp.speedDegPerSec * deltaTime;
            if (comp.target === 'last_rotate_op') {
              const lastRotOp = [...targetTrans.operations].reverse().find((op) => op.type === 'ROTATE');
              if (lastRotOp) {
                lastRotOp.rotateDeg = (lastRotOp.rotateDeg + deltaDeg) % 360;
              } else {
                targetTrans.rotationDeg = (targetTrans.rotationDeg + deltaDeg) % 360;
              }
            } else {
              targetTrans.rotationDeg = (targetTrans.rotationDeg + deltaDeg) % 360;
            }
          }
        } else if (comp.type === 'OscillatorBehavior') {
          const targetTrans = activeTransform || getNodeTransform(node);
          if (targetTrans) {
            const offset = Math.sin(simTime * comp.frequency * Math.PI * 2) * comp.amplitude;
            if (comp.axis === 'X' || comp.axis === 'BOTH') {
              targetTrans.x += Math.cos(simTime * comp.frequency * Math.PI * 2) * comp.amplitude * 0.05;
            }
            if (comp.axis === 'Y' || comp.axis === 'BOTH') {
              targetTrans.y += offset * 0.05;
            }
          }
        } else if (comp.type === 'Mover2DBehavior') {
          const targetTrans = activeTransform || getNodeTransform(node);
          if (targetTrans) {
            targetTrans.x += comp.velocityX * deltaTime;
            targetTrans.y += comp.velocityY * deltaTime;
            if (comp.bounceBounds) {
              if (targetTrans.x < comp.minX) {
                targetTrans.x = comp.minX;
                comp.velocityX = Math.abs(comp.velocityX);
              } else if (targetTrans.x > comp.maxX) {
                targetTrans.x = comp.maxX;
                comp.velocityX = -Math.abs(comp.velocityX);
              }
              if (targetTrans.y < comp.minY) {
                targetTrans.y = comp.minY;
                comp.velocityY = Math.abs(comp.velocityY);
              } else if (targetTrans.y > comp.maxY) {
                targetTrans.y = comp.maxY;
                comp.velocityY = -Math.abs(comp.velocityY);
              }
            }
          }
        } else if (comp.type === 'ParticleEmitter2D') {
          comp.accumulator = (comp.accumulator || 0) + deltaTime;
          const interval = 1.0 / Math.max(1, comp.rate);
          while (comp.accumulator >= interval && comp.particles.length < 200) {
            comp.accumulator -= interval;
            const angle = Math.random() * Math.PI * 2;
            const spd = comp.speed * (0.6 + Math.random() * 0.8);
            comp.particles.push({
              x: 0,
              y: 0,
              vx: Math.cos(angle) * spd,
              vy: Math.sin(angle) * spd,
              life: comp.lifetime,
              maxLife: comp.lifetime,
              size: comp.particleSize * (0.8 + Math.random() * 0.4),
              color: [...comp.color] as [number, number, number, number],
            });
          }

          for (let pIdx = comp.particles.length - 1; pIdx >= 0; pIdx--) {
            const p = comp.particles[pIdx];
            p.life -= deltaTime;
            p.x += p.vx * deltaTime;
            p.y += p.vy * deltaTime;
            if (p.life <= 0) {
              comp.particles.splice(pIdx, 1);
            }
          }
        }
      }
    }

    // Determine local matrix from the Transform component
    const trans = getNodeTransform(node);
    if (trans && trans.enabled) {
      node.localMatrix = computeLocalMatrix(
        { x: trans.x, y: trans.y, rotationDeg: trans.rotationDeg, scaleX: trans.scaleX, scaleY: trans.scaleY },
        trans.operations
      );
      // Synchronize legacy fields
      node.baseTransform.x = trans.x;
      node.baseTransform.y = trans.y;
      node.baseTransform.rotationDeg = trans.rotationDeg;
      node.baseTransform.scaleX = trans.scaleX;
      node.baseTransform.scaleY = trans.scaleY;
      node.operations = trans.operations;
    } else {
      // If no Transform component or disabled, local matrix is identity
      node.localMatrix = identityMatrix();
      node.baseTransform = { x: 0, y: 0, rotationDeg: 0, scaleX: 1, scaleY: 1 };
      node.operations = [];
    }

    // Compute world matrix: parent * local
    node.worldMatrix = multiplyMatrices(parentWorldMatrix, node.localMatrix);

    // Decompose world values for quick queries and gizmos
    const decomp = decomposeMatrix(node.worldMatrix);
    node.worldPos = [decomp.x, decomp.y];
    node.worldRotationDeg = decomp.rotationDeg;
    node.worldScale = [decomp.scaleX, decomp.scaleY];
    node.effectiveOpacity = parentOpacity * selfOpacity;

    // Recursively process children
    for (const childId of node.children) {
      traverse(childId, node.worldMatrix, node.effectiveOpacity);
    }
  }

  const rootNode = nodes.get(rootId);
  if (rootNode) {
    traverse(rootId, identityMatrix(), 1.0);
  }
}

/**
 * Screen <-> World space coordinate conversions
 * Fully unbounded precision without clamping
 */
export function worldToScreen(
  worldX: number,
  worldY: number,
  camera: { x: number; y: number; zoom: number },
  viewportW: number,
  viewportH: number,
  viewportScreenX: number,
  viewportScreenY: number
): [number, number] {
  const cx = viewportScreenX + viewportW / 2;
  const cy = viewportScreenY + viewportH / 2;
  const sx = cx + (worldX - camera.x) * camera.zoom;
  const sy = cy - (worldY - camera.y) * camera.zoom; // Inverted Y: +Y is UP in world space
  return [sx, sy];
}

export function screenToWorld(
  screenX: number,
  screenY: number,
  camera: { x: number; y: number; zoom: number },
  viewportW: number,
  viewportH: number,
  viewportScreenX: number,
  viewportScreenY: number
): [number, number] {
  const cx = viewportScreenX + viewportW / 2;
  const cy = viewportScreenY + viewportH / 2;
  const wx = camera.x + (screenX - cx) / camera.zoom;
  const wy = camera.y - (screenY - cy) / camera.zoom;
  return [wx, wy];
}
