/**
 * Vortex2D Game Engine - Reusable Component List & Component Gallery
 * Renders components in order of appearance with collapsible sections,
 * move up/down, delete, and gallery addition dialog.
 * Supports Scripts and JSON UI Components. Absolutely ZERO emojis.
 */

import {
  ImGui,
  ImGuiTreeNodeFlags,
  ImVec2,
  ImVec4,
} from '@mori2003/jsimgui';
import type {
  SceneNode,
  EditorState,
  TextureAsset,
  SpriteId,
  TransformComponent,
  SpriteRendererComponent,
  ScriptComponent,
  UIComponent,
  OpacityModifierComponent,
  RotatorBehaviorComponent,
  OscillatorBehaviorComponent,
  Mover2DBehaviorComponent,
  BoxCollider2DComponent,
  ParticleEmitter2DComponent,
  ComponentGalleryItem,
} from '../engine/types.ts';
import { logInfo, logError } from '../engine/logger.ts';
import { compileScript } from '../engine/math.ts';
import { SAMPLE_UI_SCHEMAS, renderUIMarkup, type UIElementNode } from '../ui/UIMarkup.ts';

// Script Templates
export const SCRIPT_TEMPLATES: Record<string, string> = {
  'WASD Movement': `// WASD or Arrow Keys 2D Movement
const trans = node.components.find(c => c.type === 'Transform');
if (trans) {
  const speed = 200;
  if (context.keys.has('KeyW') || context.keys.has('ArrowUp')) trans.y += speed * dt;
  if (context.keys.has('KeyS') || context.keys.has('ArrowDown')) trans.y -= speed * dt;
  if (context.keys.has('KeyA') || context.keys.has('ArrowLeft')) trans.x -= speed * dt;
  if (context.keys.has('KeyD') || context.keys.has('ArrowRight')) trans.x += speed * dt;
}`,
  'Circular Orbit': `// Orbits around origin (0, 0)
const trans = node.components.find(c => c.type === 'Transform');
if (trans) {
  const radius = 120;
  const speed = 2.0;
  trans.x = Math.cos(time * speed) * radius;
  trans.y = Math.sin(time * speed) * radius;
  trans.rotationDeg = (time * speed * 180 / Math.PI) - 90;
}`,
  'Sine Hover': `// Smooth vertical floating sine hover
const trans = node.components.find(c => c.type === 'Transform');
if (trans) {
  trans.y += Math.sin(time * 3.0) * 40 * dt;
}`,
  'Mouse Follower': `// Drifts smoothly towards mouse cursor
const trans = node.components.find(c => c.type === 'Transform');
if (trans && context.mouse) {
  const dx = context.mouse.worldX - trans.x;
  const dy = context.mouse.worldY - trans.y;
  trans.x += dx * 4.0 * dt;
  trans.y += dy * 4.0 * dt;
  trans.rotationDeg = (Math.atan2(dy, dx) * 180 / Math.PI) - 90;
}`,
  'Pulsing Scale': `// Pulses object scale smoothly
const trans = node.components.find(c => c.type === 'Transform');
if (trans) {
  const s = 1.0 + Math.sin(time * 4.0) * 0.25;
  trans.scaleX = s;
  trans.scaleY = s;
}`,
};

export const COMPONENT_GALLERY_ITEMS: ComponentGalleryItem[] = [
  {
    type: 'Transform',
    title: 'Transform',
    category: 'Core',
    description: '2D Position (x,y), rotation, scale and reverse-order operations stack.',
    createDefault: () => ({
      id: `comp_trans_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type: 'Transform',
      enabled: true,
      x: 0,
      y: 0,
      rotationDeg: 0,
      scaleX: 1,
      scaleY: 1,
      uniformScale: true,
      operations: [],
    }),
  },
  {
    type: 'SpriteRenderer',
    title: 'Sprite Renderer',
    category: 'Rendering',
    description: 'Renders a 2D sprite with dimensions, pivot, tint color, flip, and sorting.',
    createDefault: () => ({
      id: `comp_sprite_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type: 'SpriteRenderer',
      enabled: true,
      spriteId: 'spaceship',
      color: [1, 1, 1, 1],
      width: 80,
      height: 80,
      pivotX: 0.5,
      pivotY: 0.5,
      flipX: false,
      flipY: false,
      sortOrder: 10,
    }),
  },
  {
    type: 'Script',
    title: 'Script Component',
    category: 'Scripting',
    description: 'Runs custom JavaScript game code on update with context (node, dt, time, keys, mouse).',
    createDefault: () => ({
      id: `comp_script_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type: 'Script',
      enabled: true,
      name: 'CustomScript.js',
      sourceCode: SCRIPT_TEMPLATES['WASD Movement'],
      lastError: null,
    }),
  },
  {
    type: 'UIComponent',
    title: 'JSON UI Component',
    category: 'UI',
    description: 'Embeds a declarative JSON UI markup layout into the entity for in-game HUDs/dialogs.',
    createDefault: () => ({
      id: `comp_ui_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type: 'UIComponent',
      enabled: true,
      name: 'EntityHUD.ui.json',
      markupJson: SAMPLE_UI_SCHEMAS['Game HUD'],
    }),
  },
  {
    type: 'RotatorBehavior',
    title: 'Rotator Behavior',
    category: 'Motion',
    description: 'Continuously spins the entity or its transform operation at angular speed.',
    createDefault: () => ({
      id: `comp_rot_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type: 'RotatorBehavior',
      enabled: true,
      speedDegPerSec: 90,
      target: 'base',
    }),
  },
  {
    type: 'OscillatorBehavior',
    title: 'Oscillator Behavior',
    category: 'Motion',
    description: 'Smooth sinusoidal oscillation along X, Y, or both axes.',
    createDefault: () => ({
      id: `comp_osc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type: 'OscillatorBehavior',
      enabled: true,
      amplitude: 40,
      frequency: 1.0,
      axis: 'Y',
    }),
  },
  {
    type: 'Mover2DBehavior',
    title: 'Mover 2D Behavior',
    category: 'Motion',
    description: 'Translates position with constant velocity and optional boundary bounce.',
    createDefault: () => ({
      id: `comp_mov_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type: 'Mover2DBehavior',
      enabled: true,
      velocityX: 50,
      velocityY: 0,
      bounceBounds: true,
      minX: -250,
      maxX: 250,
      minY: -200,
      maxY: 200,
    }),
  },
  {
    type: 'BoxCollider2D',
    title: 'Box Collider 2D',
    category: 'Physics',
    description: 'Axis-aligned 2D bounding box trigger or collision area with debug outline.',
    createDefault: () => ({
      id: `comp_box_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type: 'BoxCollider2D',
      enabled: true,
      width: 80,
      height: 80,
      isTrigger: true,
      showBounds: true,
    }),
  },
  {
    type: 'ParticleEmitter2D',
    title: 'Particle Emitter 2D',
    category: 'VFX',
    description: 'Realtime dynamic 2D particle burst stream with customizable colors and physics.',
    createDefault: () => ({
      id: `comp_part_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type: 'ParticleEmitter2D',
      enabled: true,
      rate: 35,
      speed: 90,
      lifetime: 0.9,
      particleSize: 6,
      color: [1, 0.6, 0.1, 1],
      particles: [],
      accumulator: 0,
    }),
  },
  {
    type: 'OpacityModifier',
    title: 'Opacity Modifier',
    category: 'Visual',
    description: 'Controls transparency multiplier or pulses opacity harmonically.',
    createDefault: () => ({
      id: `comp_opac_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type: 'OpacityModifier',
      enabled: true,
      opacity: 1.0,
      pulse: false,
      pulseMin: 0.2,
      pulseMax: 1.0,
      pulseSpeed: 1.0,
    }),
  },
];

/**
 * Reusable Component List Renderer:
 * Evaluates components in strict order of appearance, with collapsible sections,
 * move up/down, delete, and gallery addition dialog. No emojis.
 */
export function renderComponentList(
  node: SceneNode,
  state: EditorState,
  textures: Map<SpriteId, TextureAsset>,
  onOpenGallery: () => void
): void {
  const components = node.components;

  if (components.length === 0) {
    ImGui.TextDisabled('No components attached.');
    ImGui.TextDisabled('Entities inherit parent identity until components are added.');
  }

  // Iterate strictly in ORDER OF APPEARANCE
  for (let i = 0; i < components.length; i++) {
    const comp = components[i];
    ImGui.PushID(`comp_${comp.id}_${i}`);

    const categoryName = getComponentCategory(comp.type);
    const headerTitle = `${i + 1}. [${comp.type}] (${categoryName})###header_${comp.id}`;

    const isOpen = ImGui.CollapsingHeader(headerTitle, ImGuiTreeNodeFlags.DefaultOpen);

    // Controls bar directly under the header
    const enTuple: [boolean] = [comp.enabled];
    if (ImGui.Checkbox('Enabled##' + comp.id, enTuple)) {
      comp.enabled = enTuple[0];
    }
    ImGui.SameLine();

    // Move Up Button (grayed out if at top)
    const canMoveUp = i > 0;
    ImGui.BeginDisabled(!canMoveUp);
    if (ImGui.SmallButton('Up')) {
      if (canMoveUp) {
        const tmp = components[i];
        components[i] = components[i - 1];
        components[i - 1] = tmp;
      }
    }
    ImGui.EndDisabled();
    ImGui.SameLine();

    // Move Down Button (grayed out if at bottom)
    const canMoveDown = i < components.length - 1;
    ImGui.BeginDisabled(!canMoveDown);
    if (ImGui.SmallButton('Down')) {
      if (canMoveDown) {
        const tmp = components[i];
        components[i] = components[i + 1];
        components[i + 1] = tmp;
      }
    }
    ImGui.EndDisabled();
    ImGui.SameLine();

    // Remove Component Button
    if (ImGui.SmallButton('Remove')) {
      components.splice(i, 1);
      state.logs.unshift(`Removed '${comp.type}' component from '${node.name}'`);
      logInfo(`Removed '${comp.type}' component from '${node.name}'`, 'Hierarchy');
      ImGui.PopID();
      break;
    }

    if (isOpen) {
      ImGui.Spacing();
      switch (comp.type) {
        case 'Transform':
          renderTransformInspector(comp as TransformComponent, state);
          break;
        case 'SpriteRenderer':
          renderSpriteRendererInspector(comp as SpriteRendererComponent, textures);
          break;
        case 'Script':
          renderScriptInspector(comp as ScriptComponent, state);
          break;
        case 'UIComponent':
          renderUIComponentInspector(comp as UIComponent, state);
          break;
        case 'RotatorBehavior':
          renderRotatorInspector(comp as RotatorBehaviorComponent);
          break;
        case 'OscillatorBehavior':
          renderOscillatorInspector(comp as OscillatorBehaviorComponent);
          break;
        case 'Mover2DBehavior':
          renderMoverInspector(comp as Mover2DBehaviorComponent);
          break;
        case 'BoxCollider2D':
          renderBoxColliderInspector(comp as BoxCollider2DComponent);
          break;
        case 'ParticleEmitter2D':
          renderParticleEmitterInspector(comp as ParticleEmitter2DComponent);
          break;
        case 'OpacityModifier':
          renderOpacityModifierInspector(comp as OpacityModifierComponent);
          break;
      }
      ImGui.Spacing();
    }

    ImGui.Separator();
    ImGui.PopID();
  }

  ImGui.Spacing();
  if (ImGui.Button('+ Add Component...', new ImVec2(-1, 26))) {
    onOpenGallery();
  }
}

function getComponentCategory(type: string): string {
  const match = COMPONENT_GALLERY_ITEMS.find((c) => c.type === type);
  return match ? match.category : 'Custom';
}

/**
 * Transform Component Inspector (Unbounded Precision + Operations Stack)
 */
function renderTransformInspector(comp: TransformComponent, state: EditorState): void {
  const posTuple: [number, number] = [comp.x, comp.y];
  if (ImGui.DragFloat2('Position (+X right, +Y up)', posTuple, 1.0, 0, 0, '%.2f')) {
    comp.x = posTuple[0];
    comp.y = posTuple[1];
  }
  ImGui.SameLine();
  if (ImGui.SmallButton('Reset 0,0')) {
    comp.x = 0;
    comp.y = 0;
  }

  const rotTuple: [number] = [comp.rotationDeg];
  if (ImGui.DragFloat('Rotation (deg)', rotTuple, 1.0, 0, 0, '%.2f deg')) {
    comp.rotationDeg = rotTuple[0];
  }

  ImGui.TextDisabled('0 = right (upright sprite), counterclockwise (+):');
  ImGui.SameLine();
  if (ImGui.SmallButton('0 deg (Right)')) comp.rotationDeg = 0;
  ImGui.SameLine();
  if (ImGui.SmallButton('90 deg (Up)')) comp.rotationDeg = 90;
  ImGui.SameLine();
  if (ImGui.SmallButton('180 deg (Left)')) comp.rotationDeg = 180;
  ImGui.SameLine();
  if (ImGui.SmallButton('270 deg (Down)')) comp.rotationDeg = 270;

  const scaleTuple: [number, number] = [comp.scaleX, comp.scaleY];
  if (ImGui.DragFloat2('Scale', scaleTuple, 0.05, 0, 0, '%.3f')) {
    if (comp.uniformScale) {
      const delta = scaleTuple[0] !== comp.scaleX ? scaleTuple[0] / (comp.scaleX || 1) : scaleTuple[1] / (comp.scaleY || 1);
      comp.scaleX = scaleTuple[0];
      comp.scaleY *= delta;
    } else {
      comp.scaleX = scaleTuple[0];
      comp.scaleY = scaleTuple[1];
    }
  }
  ImGui.SameLine();
  if (ImGui.SmallButton('Reset 1:1')) {
    comp.scaleX = 1;
    comp.scaleY = 1;
  }

  const uniformTuple: [boolean] = [!!comp.uniformScale];
  if (ImGui.Checkbox('Uniform Scale', uniformTuple)) {
    comp.uniformScale = uniformTuple[0];
  }
  ImGui.SameLine();
  if (ImGui.SmallButton('Flip X')) comp.scaleX = -comp.scaleX;
  ImGui.SameLine();
  if (ImGui.SmallButton('Flip Y')) comp.scaleY = -comp.scaleY;

  ImGui.Spacing();
  if (ImGui.TreeNodeEx(`Operations Stack (${comp.operations.length})###trans_ops`, ImGuiTreeNodeFlags.DefaultOpen)) {
    ImGui.TextDisabled('Applied in reverse order (bottom to top):');

    for (let opIdx = 0; opIdx < comp.operations.length; opIdx++) {
      const op = comp.operations[opIdx];
      ImGui.PushID(`op_${op.id}_${opIdx}`);

      const opEnTuple: [boolean] = [op.enabled];
      if (ImGui.Checkbox(`##op_en_${opIdx}`, opEnTuple)) {
        op.enabled = opEnTuple[0];
      }
      ImGui.SameLine();
      ImGui.TextColored(new ImVec4(0.9, 0.9, 0.5, 1), `#${opIdx + 1} [${op.type}]`);

      ImGui.SameLine();
      const canOpUp = opIdx > 0;
      ImGui.BeginDisabled(!canOpUp);
      if (ImGui.SmallButton('Up')) {
        if (canOpUp) {
          const t = comp.operations[opIdx];
          comp.operations[opIdx] = comp.operations[opIdx - 1];
          comp.operations[opIdx - 1] = t;
        }
      }
      ImGui.EndDisabled();
      ImGui.SameLine();

      const canOpDown = opIdx < comp.operations.length - 1;
      ImGui.BeginDisabled(!canOpDown);
      if (ImGui.SmallButton('Down')) {
        if (canOpDown) {
          const t = comp.operations[opIdx];
          comp.operations[opIdx] = comp.operations[opIdx + 1];
          comp.operations[opIdx + 1] = t;
        }
      }
      ImGui.EndDisabled();
      ImGui.SameLine();

      if (ImGui.SmallButton('X')) {
        comp.operations.splice(opIdx, 1);
        ImGui.PopID();
        break;
      }

      if (op.type === 'TRANSLATE') {
        const isWorld = op.space === 'world';
        if (ImGui.RadioButton('Local', !isWorld)) op.space = 'local';
        ImGui.SameLine();
        if (ImGui.RadioButton('World', isWorld)) op.space = 'world';

        const tTuple: [number, number] = [op.translateX, op.translateY];
        if (ImGui.DragFloat2('Offset', tTuple, 1.0, 0, 0, '%.2f')) {
          op.translateX = tTuple[0];
          op.translateY = tTuple[1];
        }
      } else if (op.type === 'ROTATE') {
        const rTuple: [number] = [op.rotateDeg];
        if (ImGui.DragFloat('Angle', rTuple, 1.0, 0, 0, '%.2f deg')) {
          op.rotateDeg = rTuple[0];
          op.rotatePreset = 'CUSTOM';
        }
        ImGui.SameLine();
        if (ImGui.SmallButton('90 Deg')) {
          op.rotateDeg = 90;
          op.rotatePreset = 'RIGHT';
        }
      } else if (op.type === 'SCALE') {
        const sTuple: [number, number] = [op.scaleX, op.scaleY];
        if (ImGui.DragFloat2('Factor', sTuple, 0.05, 0, 0, '%.3f')) {
          op.scaleX = sTuple[0];
          op.scaleY = sTuple[1];
        }
      }

      ImGui.PopID();
    }

    ImGui.Spacing();
    if (ImGui.SmallButton('+ Translate')) {
      comp.operations.push({
        id: `op_${Date.now()}`,
        type: 'TRANSLATE',
        enabled: true,
        translateX: 20,
        translateY: 0,
        space: 'local',
        rotateDeg: 0,
        rotatePreset: '0DEG',
        scaleX: 1,
        scaleY: 1,
        uniformScale: true,
      });
    }
    ImGui.SameLine();
    if (ImGui.SmallButton('+ Rotate')) {
      comp.operations.push({
        id: `op_${Date.now()}`,
        type: 'ROTATE',
        enabled: true,
        translateX: 0,
        translateY: 0,
        space: 'local',
        rotateDeg: 45,
        rotatePreset: 'CUSTOM',
        scaleX: 1,
        scaleY: 1,
        uniformScale: true,
      });
    }
    ImGui.SameLine();
    if (ImGui.SmallButton('+ Scale')) {
      comp.operations.push({
        id: `op_${Date.now()}`,
        type: 'SCALE',
        enabled: true,
        translateX: 0,
        translateY: 0,
        space: 'local',
        rotateDeg: 0,
        rotatePreset: '0DEG',
        scaleX: 1.5,
        scaleY: 1.5,
        uniformScale: true,
      });
    }

    ImGui.TreePop();
  }
}

/**
 * Script Component Inspector: Real In-Engine JavaScript Scripting
 */
function renderScriptInspector(comp: ScriptComponent, state: EditorState): void {
  const nameTuple: [string] = [comp.name];
  ImGui.SetNextItemWidth(180);
  if (ImGui.InputText('Script Name', nameTuple, 64)) {
    comp.name = nameTuple[0];
  }

  if (ImGui.BeginCombo('Load Template', 'Select template...')) {
    for (const [tplName, tplCode] of Object.entries(SCRIPT_TEMPLATES)) {
      if (ImGui.Selectable(tplName)) {
        comp.sourceCode = tplCode;
        comp.lastError = null;
        const res = compileScript(comp.sourceCode);
        if (res.fn) comp.compiledFn = res.fn;
        if (res.error) comp.lastError = res.error;
      }
    }
    ImGui.EndCombo();
  }

  const codeBuf: [string] = [comp.sourceCode || ''];
  ImGui.TextDisabled('JavaScript Code (args: node, dt, time, context):');
  if (ImGui.InputTextMultiline('##script_editor', codeBuf, 16384, new ImVec2(-1, 140))) {
    comp.sourceCode = codeBuf[0];
  }

  if (ImGui.Button('Compile & Apply', new ImVec2(130, 22))) {
    comp.sourceCode = codeBuf[0];
    const res = compileScript(comp.sourceCode);
    if (res.fn) {
      comp.compiledFn = res.fn;
      comp.lastError = null;
      state.logs.unshift(`Script '${comp.name}' compiled successfully`);
      logInfo(`Script '${comp.name}' compiled successfully`, 'Script');
    } else {
      comp.compiledFn = undefined;
      comp.lastError = res.error || 'Unknown syntax error';
      state.logs.unshift(`Script compile error in '${comp.name}': ${comp.lastError}`);
      logError(`Script compile error in '${comp.name}': ${comp.lastError}`, 'Script');
    }
  }

  ImGui.SameLine();
  if (comp.lastError) {
    ImGui.TextColored(new ImVec4(1, 0.3, 0.3, 1), `Error: ${comp.lastError}`);
  } else {
    ImGui.TextColored(new ImVec4(0.4, 0.9, 0.4, 1), 'Status: Ready');
  }

  ImGui.TextDisabled('API: context.keys, context.mouse, node.components, context.log()');
}

/**
 * JSON UI Component Inspector
 */
function renderUIComponentInspector(comp: UIComponent, state: EditorState): void {
  const nameTuple: [string] = [comp.name];
  ImGui.SetNextItemWidth(180);
  if (ImGui.InputText('UI Name', nameTuple, 64)) {
    comp.name = nameTuple[0];
  }

  if (ImGui.BeginCombo('Load Schema Preset', 'Choose preset...')) {
    for (const [sName, sJson] of Object.entries(SAMPLE_UI_SCHEMAS)) {
      if (ImGui.Selectable(sName)) {
        comp.markupJson = sJson;
        try {
          comp.parsedNode = JSON.parse(sJson);
        } catch {
          comp.parsedNode = null;
        }
      }
    }
    ImGui.EndCombo();
  }

  const jsonBuf: [string] = [comp.markupJson || ''];
  ImGui.TextDisabled('JSON UI Markup:');
  if (ImGui.InputTextMultiline('##json_ui_editor', jsonBuf, 16384, new ImVec2(-1, 140))) {
    comp.markupJson = jsonBuf[0];
  }

  if (ImGui.Button('Parse & Validate JSON', new ImVec2(160, 22))) {
    comp.markupJson = jsonBuf[0];
    try {
      comp.parsedNode = JSON.parse(comp.markupJson);
      state.logs.unshift(`JSON UI '${comp.name}' parsed successfully`);
      logInfo(`JSON UI '${comp.name}' parsed successfully`, 'UI');
    } catch (err: any) {
      comp.parsedNode = null;
      state.logs.unshift(`JSON UI parse error in '${comp.name}': ${err.message}`);
      logError(`JSON UI parse error in '${comp.name}': ${err.message}`, 'UI');
    }
  }

  ImGui.SameLine();
  if (comp.parsedNode) {
    ImGui.TextColored(new ImVec4(0.4, 0.9, 0.4, 1), 'Valid UI Schema');
  } else {
    ImGui.TextColored(new ImVec4(1, 0.3, 0.3, 1), 'Parse Error');
  }

  // Live in-inspector preview of the parsed UI
  if (comp.parsedNode && ImGui.TreeNodeEx('Live UI Preview', ImGuiTreeNodeFlags.DefaultOpen)) {
    renderUIMarkup(comp.parsedNode as UIElementNode, {
      stateValues: {},
      dispatchAction: (actionId) => {
        state.logs.unshift(`UI Action triggered: ${actionId}`);
        logInfo(`UI Action triggered: ${actionId}`, 'UI');
      },
    });
    ImGui.TreePop();
  }
}

/**
 * Sprite Renderer Inspector
 */
function renderSpriteRendererInspector(
  comp: SpriteRendererComponent,
  textures: Map<SpriteId, TextureAsset>
): void {
  const spriteKeys = Array.from(textures.keys());

  if (ImGui.BeginCombo('Sprite', comp.spriteId)) {
    for (const sid of spriteKeys) {
      const isSelected = comp.spriteId === sid;
      if (ImGui.Selectable(sid, isSelected)) {
        comp.spriteId = sid;
      }
      if (isSelected) ImGui.SetItemDefaultFocus();
    }
    ImGui.EndCombo();
  }

  const sizeTuple: [number, number] = [comp.width, comp.height];
  if (ImGui.DragFloat2('Size (W/H)', sizeTuple, 1.0, 0, 0, '%.1f px')) {
    comp.width = Math.max(1, sizeTuple[0]);
    comp.height = Math.max(1, sizeTuple[1]);
  }

  const pivotTuple: [number, number] = [comp.pivotX, comp.pivotY];
  if (ImGui.SliderFloat2('Pivot (0..1)', pivotTuple, 0.0, 1.0, '%.2f')) {
    comp.pivotX = pivotTuple[0];
    comp.pivotY = pivotTuple[1];
  }
  ImGui.TextDisabled('Pivot: (0.5, 0.5) center | X: 0 left, 1 right | Y: 0 down, 1 up');
  if (ImGui.SmallButton('Center (0.5, 0.5)')) {
    comp.pivotX = 0.5;
    comp.pivotY = 0.5;
  }
  ImGui.SameLine();
  if (ImGui.SmallButton('Bottom (0.5, 0)')) {
    comp.pivotX = 0.5;
    comp.pivotY = 0.0;
  }
  ImGui.SameLine();
  if (ImGui.SmallButton('Top (0.5, 1)')) {
    comp.pivotX = 0.5;
    comp.pivotY = 1.0;
  }
  ImGui.SameLine();
  if (ImGui.SmallButton('Left (0, 0.5)')) {
    comp.pivotX = 0.0;
    comp.pivotY = 0.5;
  }
  ImGui.SameLine();
  if (ImGui.SmallButton('Right (1, 0.5)')) {
    comp.pivotX = 1.0;
    comp.pivotY = 0.5;
  }

  const colorTuple: [number, number, number, number] = [...comp.color];
  if (ImGui.ColorEdit4('Tint Color', colorTuple)) {
    comp.color = [colorTuple[0], colorTuple[1], colorTuple[2], colorTuple[3]];
  }

  const flipXTuple: [boolean] = [comp.flipX];
  if (ImGui.Checkbox('Flip X', flipXTuple)) comp.flipX = flipXTuple[0];
  ImGui.SameLine();
  const flipYTuple: [boolean] = [comp.flipY];
  if (ImGui.Checkbox('Flip Y', flipYTuple)) comp.flipY = flipYTuple[0];

  const sortTuple: [number] = [comp.sortOrder];
  if (ImGui.DragInt('Sort Order', sortTuple, 1, -1000, 1000)) {
    comp.sortOrder = sortTuple[0];
  }
}

/**
 * Rotator Behavior Inspector
 */
function renderRotatorInspector(comp: RotatorBehaviorComponent): void {
  const speedTuple: [number] = [comp.speedDegPerSec];
  if (ImGui.DragFloat('Speed (deg/s)', speedTuple, 2.0, 0, 0, '%.1f')) {
    comp.speedDegPerSec = speedTuple[0];
  }
  ImGui.SameLine();
  if (ImGui.SmallButton('Reverse')) comp.speedDegPerSec = -comp.speedDegPerSec;

  const isBase = comp.target === 'base';
  if (ImGui.RadioButton('Rotate Base', isBase)) comp.target = 'base';
  ImGui.SameLine();
  if (ImGui.RadioButton('Rotate Last Op', !isBase)) comp.target = 'last_rotate_op';
}

/**
 * Oscillator Behavior Inspector
 */
function renderOscillatorInspector(comp: OscillatorBehaviorComponent): void {
  const ampTuple: [number] = [comp.amplitude];
  if (ImGui.DragFloat('Amplitude', ampTuple, 1.0, 0, 0, '%.1f px')) {
    comp.amplitude = Math.max(0, ampTuple[0]);
  }

  const freqTuple: [number] = [comp.frequency];
  if (ImGui.DragFloat('Frequency', freqTuple, 0.1, 0, 0, '%.2f Hz')) {
    comp.frequency = Math.max(0.01, freqTuple[0]);
  }

  if (ImGui.RadioButton('X Axis', comp.axis === 'X')) comp.axis = 'X';
  ImGui.SameLine();
  if (ImGui.RadioButton('Y Axis', comp.axis === 'Y')) comp.axis = 'Y';
  ImGui.SameLine();
  if (ImGui.RadioButton('Both', comp.axis === 'BOTH')) comp.axis = 'BOTH';
}

/**
 * Mover 2D Behavior Inspector
 */
function renderMoverInspector(comp: Mover2DBehaviorComponent): void {
  const velTuple: [number, number] = [comp.velocityX, comp.velocityY];
  if (ImGui.DragFloat2('Velocity (vx, vy)', velTuple, 1.0, 0, 0, '%.1f')) {
    comp.velocityX = velTuple[0];
    comp.velocityY = velTuple[1];
  }

  const bounceTuple: [boolean] = [comp.bounceBounds];
  if (ImGui.Checkbox('Bounce in Screen Bounds', bounceTuple)) {
    comp.bounceBounds = bounceTuple[0];
  }

  if (comp.bounceBounds) {
    const xBounds: [number, number] = [comp.minX, comp.maxX];
    if (ImGui.DragFloat2('Min/Max X', xBounds, 1.0, 0, 0)) {
      comp.minX = xBounds[0];
      comp.maxX = xBounds[1];
    }
    const yBounds: [number, number] = [comp.minY, comp.maxY];
    if (ImGui.DragFloat2('Min/Max Y', yBounds, 1.0, 0, 0)) {
      comp.minY = yBounds[0];
      comp.maxY = yBounds[1];
    }
  }
}

/**
 * Box Collider 2D Inspector
 */
function renderBoxColliderInspector(comp: BoxCollider2DComponent): void {
  const sizeTuple: [number, number] = [comp.width, comp.height];
  if (ImGui.DragFloat2('Box Size (W/H)', sizeTuple, 1.0, 0, 0, '%.1f')) {
    comp.width = Math.max(1, sizeTuple[0]);
    comp.height = Math.max(1, sizeTuple[1]);
  }

  const trigTuple: [boolean] = [comp.isTrigger];
  if (ImGui.Checkbox('Is Trigger', trigTuple)) comp.isTrigger = trigTuple[0];
  ImGui.SameLine();
  const showTuple: [boolean] = [comp.showBounds];
  if (ImGui.Checkbox('Show Bounds in Viewport', showTuple)) comp.showBounds = showTuple[0];
}

/**
 * Particle Emitter 2D Inspector
 */
function renderParticleEmitterInspector(comp: ParticleEmitter2DComponent): void {
  const rateTuple: [number] = [comp.rate];
  if (ImGui.DragFloat('Emission Rate (pts/s)', rateTuple, 1.0, 1, 500, '%.0f')) {
    comp.rate = Math.max(1, rateTuple[0]);
  }

  const spdTuple: [number] = [comp.speed];
  if (ImGui.DragFloat('Particle Speed', spdTuple, 2.0, 0, 0, '%.1f')) {
    comp.speed = Math.max(0, spdTuple[0]);
  }

  const lifeTuple: [number] = [comp.lifetime];
  if (ImGui.DragFloat('Lifetime (s)', lifeTuple, 0.05, 0.05, 20, '%.2f')) {
    comp.lifetime = Math.max(0.05, lifeTuple[0]);
  }

  const szTuple: [number] = [comp.particleSize];
  if (ImGui.DragFloat('Size', szTuple, 0.5, 0.5, 100, '%.1f px')) {
    comp.particleSize = Math.max(0.5, szTuple[0]);
  }

  const colTuple: [number, number, number, number] = [...comp.color];
  if (ImGui.ColorEdit4('Particle Color', colTuple)) {
    comp.color = [colTuple[0], colTuple[1], colTuple[2], colTuple[3]];
  }

  ImGui.TextDisabled(`Active Particles: ${comp.particles.length} / 200`);
}

/**
 * Opacity Modifier Inspector
 */
function renderOpacityModifierInspector(comp: OpacityModifierComponent): void {
  const opacTuple: [number] = [comp.opacity];
  if (ImGui.SliderFloat('Opacity Multiplier', opacTuple, 0.0, 1.0, '%.2f')) {
    comp.opacity = opacTuple[0];
  }

  const pulseTuple: [boolean] = [comp.pulse];
  if (ImGui.Checkbox('Enable Harmonic Pulse', pulseTuple)) {
    comp.pulse = pulseTuple[0];
  }

  if (comp.pulse) {
    const minTuple: [number] = [comp.pulseMin];
    if (ImGui.SliderFloat('Pulse Min', minTuple, 0.0, 1.0, '%.2f')) {
      comp.pulseMin = minTuple[0];
    }
    const maxTuple: [number] = [comp.pulseMax];
    if (ImGui.SliderFloat('Pulse Max', maxTuple, 0.0, 1.0, '%.2f')) {
      comp.pulseMax = maxTuple[0];
    }
    const spdTuple: [number] = [comp.pulseSpeed];
    if (ImGui.SliderFloat('Pulse Speed (Hz)', spdTuple, 0.1, 20, '%.1f')) {
      comp.pulseSpeed = spdTuple[0];
    }
  }
}
