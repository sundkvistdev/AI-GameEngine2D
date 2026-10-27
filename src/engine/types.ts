/**
 * Vortex2D Game Engine - Core Type Definitions
 */

import type { ImTextureRef } from '@mori2003/jsimgui';

export type TransformOpType = 'TRANSLATE' | 'ROTATE' | 'SCALE';
export type TranslateSpace = 'world' | 'local';
export type RotatePreset = '0DEG' | 'RIGHT' | 'DOWN' | 'LEFT' | 'CUSTOM';

export interface BaseTransform {
  x: number;
  y: number;
  rotationDeg: number;
  scaleX: number;
  scaleY: number;
}

export interface TransformOperation {
  id: string;
  type: TransformOpType;
  enabled: boolean;
  // Translate params
  translateX: number;
  translateY: number;
  space: TranslateSpace;
  // Rotate params
  rotateDeg: number;
  rotatePreset: RotatePreset;
  // Scale params
  scaleX: number;
  scaleY: number;
  uniformScale: boolean;
}

export type SpriteId = string;

export type ComponentType =
  | 'Transform'
  | 'SpriteRenderer'
  | 'Script'
  | 'UIComponent'
  | 'OpacityModifier'
  | 'RotatorBehavior'
  | 'OscillatorBehavior'
  | 'Mover2DBehavior'
  | 'BoxCollider2D'
  | 'ParticleEmitter2D';

export interface BaseComponent {
  id: string;
  type: ComponentType;
  enabled: boolean;
}

/**
 * Transform Component:
 * Removable first-class component with position, rotation, scale, and reverse-order operations stack.
 */
export interface TransformComponent extends BaseComponent {
  type: 'Transform';
  x: number;
  y: number;
  rotationDeg: number;
  scaleX: number;
  scaleY: number;
  uniformScale?: boolean;
  operations: TransformOperation[];
}

export interface SpriteRendererComponent extends BaseComponent {
  type: 'SpriteRenderer';
  spriteId: SpriteId;
  color: [number, number, number, number]; // RGBA 0..1
  width: number;
  height: number;
  pivotX: number; // 0..1 (0.5 is center)
  pivotY: number;
  flipX: boolean;
  flipY: boolean;
  sortOrder: number;
}

/**
 * Script Component:
 * Executes custom user JavaScript on update, with sandboxed execution context.
 */
export interface ScriptComponent extends BaseComponent {
  type: 'Script';
  name: string;
  sourceCode: string;
  lastError: string | null;
  compiledFn?: (node: SceneNode, dt: number, time: number, context: ScriptContext) => void;
}

/**
 * JSON UI Component:
 * Embeds a declarative JSON UI markup layout into the entity.
 */
export interface UIComponent extends BaseComponent {
  type: 'UIComponent';
  name: string;
  markupJson: string;
  parsedNode?: any;
}

export interface ScriptContext {
  time: number;
  dt: number;
  keys: Set<string>;
  mouse: { worldX: number; worldY: number; isDown: boolean };
  getNode: (id: string) => SceneNode | undefined;
  spawnEntity: (name: string, spriteId?: string) => SceneNode;
  destroyEntity: (id: string) => void;
  log: (msg: string) => void;
}

export interface OpacityModifierComponent extends BaseComponent {
  type: 'OpacityModifier';
  opacity: number; // 0..1
  pulse: boolean;
  pulseMin: number;
  pulseMax: number;
  pulseSpeed: number; // Hz
}

export interface RotatorBehaviorComponent extends BaseComponent {
  type: 'RotatorBehavior';
  speedDegPerSec: number;
  target: 'base' | 'last_rotate_op';
}

export interface OscillatorBehaviorComponent extends BaseComponent {
  type: 'OscillatorBehavior';
  amplitude: number;
  frequency: number; // Hz
  axis: 'X' | 'Y' | 'BOTH';
}

export interface Mover2DBehaviorComponent extends BaseComponent {
  type: 'Mover2DBehavior';
  velocityX: number;
  velocityY: number;
  bounceBounds: boolean;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface BoxCollider2DComponent extends BaseComponent {
  type: 'BoxCollider2D';
  width: number;
  height: number;
  isTrigger: boolean;
  showBounds: boolean;
  colliding?: boolean;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: [number, number, number, number];
}

export interface ParticleEmitter2DComponent extends BaseComponent {
  type: 'ParticleEmitter2D';
  rate: number; // particles/sec
  speed: number;
  lifetime: number;
  particleSize: number;
  color: [number, number, number, number];
  particles: Particle[];
  accumulator: number;
}

export type SceneComponent =
  | TransformComponent
  | SpriteRendererComponent
  | ScriptComponent
  | UIComponent
  | OpacityModifierComponent
  | RotatorBehaviorComponent
  | OscillatorBehaviorComponent
  | Mover2DBehaviorComponent
  | BoxCollider2DComponent
  | ParticleEmitter2DComponent;

export interface SceneNode {
  id: string;
  name: string;
  enabled: boolean;
  parentId: string | null;
  children: string[];
  baseTransform: BaseTransform;
  operations: TransformOperation[];
  components: SceneComponent[];
  // Transient computed runtime values
  localMatrix?: Matrix3x3;
  worldMatrix?: Matrix3x3;
  worldPos?: [number, number];
  worldRotationDeg?: number;
  worldScale?: [number, number];
  effectiveOpacity?: number;
}

// 3x3 affine matrix: [a, b, c, d, tx, ty]
export type Matrix3x3 = [number, number, number, number, number, number];

export interface TextureAsset {
  id: SpriteId;
  name: string;
  width: number;
  height: number;
  gpuTexture?: GPUTexture;
  glTexture?: WebGLTexture;
  texRef: ImTextureRef;
}

/**
 * Dynamic Project Asset definition
 */
export type AssetKind = 'image' | 'audio' | 'script' | 'ui' | 'json' | 'prefab';

export interface ProjectAsset {
  id: string;
  name: string;
  kind: AssetKind;
  extension: string;
  sizeBytes: number;
  dateAdded: number;
  textureAsset?: TextureAsset;
  audioBuffer?: AudioBuffer;
  textContent?: string;
  jsonData?: any;
}

export type GizmoMode = 'TRANSLATE' | 'ROTATE' | 'SCALE' | 'NONE';

export interface EditorCamera {
  x: number;
  y: number;
  zoom: number;
}

export interface EditorDockLayout {
  leftWidth: number;
  rightWidth: number;
  bottomHeight: number;
  showLeft: boolean;
  showRight: boolean;
  showBottom: boolean;
}

export interface EditorState {
  backendName: string;
  selectedNodeId: string | null;
  isPlaying: boolean;
  simulationTime: number;
  gizmoMode: GizmoMode;
  gridSnap: boolean;
  snapSize: number;
  camera: EditorCamera;
  dockLayout: EditorDockLayout;
  activePresetName: string;
  showDemoWindow: boolean;
  showTransformGuide: boolean;
  showProfiler: boolean;
  showAssetPalette: boolean;
  showImportDialog: boolean;
  showComponentGallery: boolean;
  showUIDesigner: boolean;
  galleryTargetNodeId: string | null;
  galleryFilterText: string;
  activeAssetId: string | null;
  activeAssetTab: 'all' | 'images' | 'audio' | 'scripts' | 'prefabs' | 'ui';
  activeBottomTab: 'assets' | 'console' | 'uidesigner' | 'log';
  logs: string[];
  fps: number;
  frameTimeMs: number;
}

export interface ComponentGalleryItem {
  type: ComponentType;
  title: string;
  category: 'Core' | 'Rendering' | 'Scripting' | 'UI' | 'Motion' | 'Physics' | 'VFX' | 'Visual';
  description: string;
  createDefault: () => SceneComponent;
}
