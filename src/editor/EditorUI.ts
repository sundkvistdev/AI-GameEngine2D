/**
 * Vortex2D Game Engine - Immediate Mode ImGui Editor Interface
 * Dynamic Dock-Panel layout with resizable splitters, full scripting support,
 * unbounded viewport precision, dynamic asset manager, JSON UI designer,
 * strictly compliant dialog convention (buttons aligned right, affirming left, dismissive right),
 * and complete UI event isolation (scrolling on dialogs never bleeds into viewport).
 * Absolutely ZERO emojis.
 */

import {
  ImGui,
  ImGuiWindowFlags,
  ImGuiTreeNodeFlags,
  ImGuiChildFlags,
  ImGuiMouseButton,
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
  UIComponent,
} from '../engine/types.ts';
import {
  worldToScreen,
  screenToWorld,
  transformPoint,
  getNodeTransform,
  createDefaultTransformComponent,
} from '../engine/math.ts';
import { createEmptyScene } from '../engine/presets.ts';
import { playSynthBeep } from '../engine/audio.ts';
import { renderComponentList, COMPONENT_GALLERY_ITEMS } from './ComponentList.ts';
import {
  initializeDefaultAssets,
  renderAssetManagerUI,
  exportSceneToFile,
  triggerFileUpload,
  projectAssets,
} from './AssetManager.ts';
import { uiState } from '../ui/UIState.ts';
import { renderStandardDialog } from '../ui/UIDialog.ts';
import {
  SAMPLE_UI_SCHEMAS,
  renderUIMarkup,
  type UIElementNode,
} from '../ui/UIMarkup.ts';

// Helper to convert RGBA 0..1 to packed ImU32 color
export function packColor(r: number, g: number, b: number, a: number): number {
  const ir = Math.min(255, Math.max(0, Math.floor(r * 255)));
  const ig = Math.min(255, Math.max(0, Math.floor(g * 255)));
  const ib = Math.min(255, Math.max(0, Math.floor(b * 255)));
  const ia = Math.min(255, Math.max(0, Math.floor(a * 255)));
  return (((ia << 24) | (ib << 16) | (ig << 8) | ir) >>> 0);
}

// Mouse dragging state for Gizmo and Viewport Pan
let isDraggingGizmo = false;
let gizmoDragType: 'TRANSLATE_X' | 'TRANSLATE_Y' | 'TRANSLATE_XY' | 'ROTATE' | 'SCALE_XY' | null = null;
let gizmoStartMouse: [number, number] = [0, 0];
let gizmoStartPos: [number, number] = [0, 0];
let gizmoStartRot: number = 0;
let gizmoStartScale: [number, number] = [1, 1];

let isPanningViewport = false;
let panStartMouse: [number, number] = [0, 0];
let panStartCamera: [number, number] = [0, 0];

// Resizable splitter drag states
let isDraggingLeftSplitter = false;
let isDraggingRightSplitter = false;
let isDraggingBottomSplitter = false;

// Buffers
const searchFilter: [string] = [''];
const importJsonBuffer: [string] = [''];
const gallerySearchBuffer: [string] = [''];
let selectedGalleryIndex = 0;

// In-Engine JSON UI Designer buffer
const designerJsonBuffer: [string] = [SAMPLE_UI_SCHEMAS['Game HUD']];
let designerParsedNode: UIElementNode | null = null;
try {
  designerParsedNode = JSON.parse(designerJsonBuffer[0]);
} catch {
  designerParsedNode = null;
}

export function renderEngineEditor(
  nodes: Map<string, SceneNode>,
  state: EditorState,
  textures: Map<SpriteId, TextureAsset>,
  canvasWidth: number,
  canvasHeight: number,
  device: GPUDevice | null | undefined,
  gl: WebGL2RenderingContext | WebGLRenderingContext | null | undefined,
  onResetScene: (newNodes: Map<string, SceneNode>, presetName: string) => void
): void {
  // Reset dialog hover flag at start of frame
  uiState.isHoveringAnyDialog = false;

  // Initialize dynamic project assets on first render
  initializeDefaultAssets(textures);

  // Top bars
  const topMenuBarHeight = 22;
  const toolbarHeight = 32;
  const topBarTotal = topMenuBarHeight + toolbarHeight;

  // Dynamic Dock Layout measurements
  const layout = state.dockLayout;
  const leftW = layout.showLeft ? Math.max(140, Math.min(canvasWidth * 0.45, layout.leftWidth)) : 0;
  const rightW = layout.showRight ? Math.max(180, Math.min(canvasWidth * 0.5, layout.rightWidth)) : 0;
  const bottomH = layout.showBottom ? Math.max(80, Math.min(canvasHeight * 0.6, layout.bottomHeight)) : 0;

  const vpX = leftW;
  const vpY = topBarTotal;
  const vpW = Math.max(150, canvasWidth - leftW - rightW);
  const vpH = Math.max(100, canvasHeight - topBarTotal - bottomH);

  // 1. Main Menu Bar
  drawMainMenuBar(nodes, state, textures, device, gl, onResetScene);

  // 2. Toolbar Window (Top)
  drawToolbar(state, nodes, topMenuBarHeight, canvasWidth, toolbarHeight, onResetScene);

  // 3. Scene Hierarchy Window (Left Dock)
  if (layout.showLeft) {
    drawHierarchyWindow(nodes, state, topBarTotal, leftW, canvasHeight - topBarTotal);
  }

  // 4. Center Viewport Window (Event-isolated: dialog scrolling never affects viewport)
  drawViewportWindow(nodes, state, textures, vpX, vpY, vpW, vpH);

  // 5. Bottom Workspace Dock (Asset Manager, JSON UI Designer, Console)
  if (layout.showBottom) {
    drawBottomDockWindow(
      nodes,
      state,
      textures,
      vpX,
      vpY + vpH,
      vpW,
      bottomH,
      device,
      gl,
      onResetScene
    );
  }

  // 6. Inspector Window (Right Dock)
  if (layout.showRight) {
    drawInspectorWindow(
      nodes,
      state,
      textures,
      canvasWidth - rightW,
      topBarTotal,
      rightW,
      canvasHeight - topBarTotal
    );
  }

  // 7. Interactive Dock Splitters (Draggable Divider Bars)
  handleDockSplitters(canvasWidth, canvasHeight, topBarTotal, state);

  // 8. Component Gallery Modal Dialog (Strict Dialog Convention)
  if (uiState.showComponentGallery || state.showComponentGallery) {
    drawComponentGalleryModal(nodes, state);
  }

  // 9. Import Scene JSON Modal Dialog (Strict Dialog Convention)
  if (uiState.showImportSceneDialog || state.showImportDialog) {
    drawImportSceneModal(nodes, state, onResetScene);
  }

  // 10. Delete Entity Confirmation Dialog (Strict Dialog Convention)
  if (uiState.showDeleteConfirm) {
    drawDeleteConfirmModal(nodes, state);
  }
}

/**
 * Interactive Resizable Dock Splitters
 */
function handleDockSplitters(
  canvasW: number,
  canvasH: number,
  topY: number,
  state: EditorState
) {
  const io = ImGui.GetIO();
  const mouseX = io.MousePos.x;
  const mouseY = io.MousePos.y;
  const isMouseDown = ImGui.IsMouseDown(ImGuiMouseButton.Left);
  const layout = state.dockLayout;

  const splitterThickness = 5;

  // Left Splitter
  if (layout.showLeft) {
    const splitX = layout.leftWidth;
    const isHover = Math.abs(mouseX - splitX) <= splitterThickness && mouseY >= topY;
    if (isHover && isMouseDown && !isDraggingRightSplitter && !isDraggingBottomSplitter) {
      isDraggingLeftSplitter = true;
    }
  }

  if (isDraggingLeftSplitter) {
    if (isMouseDown) {
      layout.leftWidth = Math.max(140, Math.min(canvasW * 0.45, mouseX));
    } else {
      isDraggingLeftSplitter = false;
    }
  }

  // Right Splitter
  if (layout.showRight) {
    const splitX = canvasW - layout.rightWidth;
    const isHover = Math.abs(mouseX - splitX) <= splitterThickness && mouseY >= topY;
    if (isHover && isMouseDown && !isDraggingLeftSplitter && !isDraggingBottomSplitter) {
      isDraggingRightSplitter = true;
    }
  }

  if (isDraggingRightSplitter) {
    if (isMouseDown) {
      layout.rightWidth = Math.max(180, Math.min(canvasW * 0.5, canvasW - mouseX));
    } else {
      isDraggingRightSplitter = false;
    }
  }

  // Bottom Splitter
  if (layout.showBottom) {
    const splitY = canvasH - layout.bottomHeight;
    const leftBound = layout.showLeft ? layout.leftWidth : 0;
    const rightBound = canvasW - (layout.showRight ? layout.rightWidth : 0);
    const isHover = Math.abs(mouseY - splitY) <= splitterThickness && mouseX >= leftBound && mouseX <= rightBound;
    if (isHover && isMouseDown && !isDraggingLeftSplitter && !isDraggingRightSplitter) {
      isDraggingBottomSplitter = true;
    }
  }

  if (isDraggingBottomSplitter) {
    if (isMouseDown) {
      layout.bottomHeight = Math.max(80, Math.min(canvasH * 0.6, canvasH - mouseY));
    } else {
      isDraggingBottomSplitter = false;
    }
  }
}

/**
 * Top Menu Bar - Clean text only, zero emojis
 */
function drawMainMenuBar(
  nodes: Map<string, SceneNode>,
  state: EditorState,
  textures: Map<SpriteId, TextureAsset>,
  device: GPUDevice | null | undefined,
  gl: WebGL2RenderingContext | WebGLRenderingContext | null | undefined,
  onResetScene: (newNodes: Map<string, SceneNode>, presetName: string) => void
) {
  if (ImGui.BeginMainMenuBar()) {
    if (ImGui.BeginMenu('File')) {
      if (ImGui.MenuItem('New Blank Scene', 'Ctrl+N')) {
        onResetScene(createEmptyScene(), 'Blank Scene');
        state.logs.unshift('Created new blank scene with <root>');
        playSynthBeep(520, 0.05);
      }
      ImGui.Separator();

      if (ImGui.MenuItem('Save Scene to File (.vortex.json)')) {
        exportSceneToFile(nodes, state.activePresetName || 'Scene');
        state.logs.unshift('Exported scene to .vortex.json');
        playSynthBeep(700, 0.04);
      }

      if (ImGui.MenuItem('Open Scene from File...')) {
        triggerFileUpload(device, gl, textures, state, onResetScene);
      }

      if (ImGui.MenuItem('Upload Asset Files...')) {
        triggerFileUpload(device, gl, textures, state, onResetScene);
      }

      ImGui.Separator();
      if (ImGui.MenuItem('Import Scene JSON from Text...')) {
        uiState.showImportSceneDialog = true;
        state.showImportDialog = true;
      }
      if (ImGui.MenuItem('Export Scene JSON to Clipboard')) {
        const jsonStr = JSON.stringify(Array.from(nodes.entries()), null, 2);
        try {
          navigator.clipboard.writeText(jsonStr);
          state.logs.unshift('Scene JSON copied to clipboard');
        } catch {
          console.log('Scene JSON:', jsonStr);
          state.logs.unshift('Scene JSON printed to browser console');
        }
        playSynthBeep(780, 0.06);
      }
      ImGui.EndMenu();
    }

    if (ImGui.BeginMenu('Edit')) {
      const selected = state.selectedNodeId ? nodes.get(state.selectedNodeId) : null;
      const canEdit = !!selected && selected.id !== '<root>';

      if (ImGui.MenuItem('Add Child Entity', 'Ctrl+Shift+N', false, !!selected)) {
        if (selected) {
          const newId = `node_${Date.now()}`;
          const newNode: SceneNode = {
            id: newId,
            name: `Entity_${newId.slice(-4)}`,
            enabled: true,
            parentId: selected.id,
            children: [],
            baseTransform: { x: 0, y: 0, rotationDeg: 0, scaleX: 1, scaleY: 1 },
            operations: [],
            components: [createDefaultTransformComponent(0, 0, 0, 1, 1)],
          };
          nodes.set(newId, newNode);
          selected.children.push(newId);
          state.selectedNodeId = newId;
          state.logs.unshift(`Created child entity '${newNode.name}'`);
          playSynthBeep(580, 0.04);
        }
      }

      ImGui.Separator();
      if (ImGui.MenuItem('Duplicate Entity', 'Ctrl+D', false, canEdit)) {
        if (selected && selected.parentId) {
          const newId = `dup_${Date.now()}`;
          const dupNode: SceneNode = JSON.parse(JSON.stringify(selected));
          dupNode.id = newId;
          dupNode.name = `${selected.name}_Copy`;
          const trans = getNodeTransform(dupNode);
          if (trans) {
            trans.x += 20;
            trans.y += 20;
          }
          dupNode.children = [];
          nodes.set(newId, dupNode);
          const parent = nodes.get(selected.parentId);
          if (parent) parent.children.push(newId);
          state.selectedNodeId = newId;
          state.logs.unshift(`Duplicated '${selected.name}'`);
          playSynthBeep(620, 0.05);
        }
      }

      if (ImGui.MenuItem('Delete Entity...', 'Del', false, canEdit)) {
        if (selected && selected.parentId) {
          uiState.deleteTargetNodeId = selected.id;
          uiState.showDeleteConfirm = true;
        }
      }
      ImGui.EndMenu();
    }

    if (ImGui.BeginMenu('Tools')) {
      if (ImGui.MenuItem('Component Gallery...', '', uiState.showComponentGallery)) {
        uiState.showComponentGallery = true;
        state.showComponentGallery = true;
        uiState.galleryTargetNodeId = state.selectedNodeId;
      }
      if (ImGui.MenuItem('JSON UI Designer Tab', '', state.activeBottomTab === 'uidesigner')) {
        state.activeBottomTab = 'uidesigner';
        state.dockLayout.showBottom = true;
      }
      ImGui.EndMenu();
    }

    if (ImGui.BeginMenu('View')) {
      const layout = state.dockLayout;
      if (ImGui.MenuItem('Toggle Hierarchy Panel', '', layout.showLeft)) {
        layout.showLeft = !layout.showLeft;
      }
      if (ImGui.MenuItem('Toggle Inspector Panel', '', layout.showRight)) {
        layout.showRight = !layout.showRight;
      }
      if (ImGui.MenuItem('Toggle Workspace Dock', '', layout.showBottom)) {
        layout.showBottom = !layout.showBottom;
      }
      ImGui.Separator();
      if (ImGui.MenuItem('Reset Camera View', 'Home')) {
        state.camera.x = 0;
        state.camera.y = 0;
        state.camera.zoom = 1.0;
        state.logs.unshift('Camera reset to center (0, 0)');
      }
      ImGui.EndMenu();
    }

    // Right-aligned status
    ImGui.SameLine(ImGui.GetWindowWidth() - 260);
    ImGui.TextDisabled(`${state.backendName} | ${state.fps.toFixed(0)} FPS`);

    ImGui.EndMainMenuBar();
  }
}

/**
 * Compact Single-row Toolbar - Zero emojis
 */
function drawToolbar(
  state: EditorState,
  nodes: Map<string, SceneNode>,
  topY: number,
  width: number,
  height: number,
  onResetScene: (newNodes: Map<string, SceneNode>, presetName: string) => void
) {
  ImGui.SetNextWindowPos(new ImVec2(0, topY));
  ImGui.SetNextWindowSize(new ImVec2(width, height));
  const flags =
    ImGuiWindowFlags.NoTitleBar |
    ImGuiWindowFlags.NoResize |
    ImGuiWindowFlags.NoMove |
    ImGuiWindowFlags.NoScrollbar |
    ImGuiWindowFlags.NoSavedSettings;

  if (ImGui.Begin('##EngineToolbar', null, flags)) {
    if (state.isPlaying) {
      if (ImGui.Button('Pause')) {
        state.isPlaying = false;
        state.logs.unshift('Simulation paused');
        playSynthBeep(420, 0.04);
      }
    } else {
      if (ImGui.Button('Play')) {
        state.isPlaying = true;
        state.logs.unshift('Simulation running');
        playSynthBeep(680, 0.04);
      }
    }

    ImGui.SameLine();
    ImGui.BeginDisabled(state.isPlaying);
    if (ImGui.Button('Step')) {
      state.simulationTime += 1 / 60;
      state.logs.unshift(`Stepped frame (+16.6ms)`);
      playSynthBeep(520, 0.03);
    }
    ImGui.EndDisabled();

    ImGui.SameLine();
    if (ImGui.Button('Reset Time')) {
      state.simulationTime = 0;
      state.logs.unshift('Simulation time reset to 0.0s');
      playSynthBeep(440, 0.03);
    }

    ImGui.SameLine();
    ImGui.TextDisabled('|');
    ImGui.SameLine();

    // Gizmo Modes
    const isTrans = state.gizmoMode === 'TRANSLATE';
    if (ImGui.Button(isTrans ? '[Translate (W)]' : 'Translate (W)')) {
      state.gizmoMode = 'TRANSLATE';
    }
    ImGui.SameLine();

    const isRot = state.gizmoMode === 'ROTATE';
    if (ImGui.Button(isRot ? '[Rotate (E)]' : 'Rotate (E)')) {
      state.gizmoMode = 'ROTATE';
    }
    ImGui.SameLine();

    const isScale = state.gizmoMode === 'SCALE';
    if (ImGui.Button(isScale ? '[Scale (R)]' : 'Scale (R)')) {
      state.gizmoMode = 'SCALE';
    }

    ImGui.SameLine();
    ImGui.TextDisabled('|');
    ImGui.SameLine();

    // Grid snap toggle
    const snapTuple: [boolean] = [state.gridSnap];
    if (ImGui.Checkbox('Snap (16px)', snapTuple)) {
      state.gridSnap = snapTuple[0];
    }

    ImGui.SameLine();
    ImGui.TextDisabled('|');
    ImGui.SameLine();

    if (ImGui.Button('Center View')) {
      state.camera.x = 0;
      state.camera.y = 0;
      state.camera.zoom = 1.0;
    }

    ImGui.SameLine();
    if (ImGui.Button('+ New Entity')) {
      const parentId = state.selectedNodeId || '<root>';
      const parentNode = nodes.get(parentId) || nodes.get('<root>')!;
      const newId = `node_${Date.now()}`;
      const newNode: SceneNode = {
        id: newId,
        name: `Entity_${newId.slice(-4)}`,
        enabled: true,
        parentId: parentNode.id,
        children: [],
        baseTransform: { x: 0, y: 0, rotationDeg: 0, scaleX: 1, scaleY: 1 },
        operations: [],
        components: [createDefaultTransformComponent(0, 0, 0, 1, 1)],
      };
      nodes.set(newId, newNode);
      parentNode.children.push(newId);
      state.selectedNodeId = newId;
      state.logs.unshift(`Created entity '${newNode.name}'`);
      playSynthBeep(600, 0.04);
    }

    ImGui.SameLine();
    if (ImGui.Button('Blank Scene')) {
      onResetScene(createEmptyScene(), 'Blank Scene');
      state.logs.unshift('Scene reset to blank');
      playSynthBeep(480, 0.04);
    }

    ImGui.End();
  }
}

/**
 * Scene Hierarchy Window (Left Dock)
 */
function drawHierarchyWindow(
  nodes: Map<string, SceneNode>,
  state: EditorState,
  topY: number,
  width: number,
  height: number
) {
  ImGui.SetNextWindowPos(new ImVec2(0, topY));
  ImGui.SetNextWindowSize(new ImVec2(width, height));
  const flags = ImGuiWindowFlags.NoMove | ImGuiWindowFlags.NoCollapse;

  if (ImGui.Begin('Hierarchy', null, flags)) {
    ImGui.SetNextItemWidth(-1);
    ImGui.InputTextWithHint('##h_search', 'Filter entities...', searchFilter, 32);

    ImGui.Separator();

    function renderTreeNode(nodeId: string) {
      const node = nodes.get(nodeId);
      if (!node) return;

      const filter = searchFilter[0].trim().toLowerCase();
      if (filter && !node.name.toLowerCase().includes(filter)) {
        const hasMatchingChild = node.children.some((cid) => {
          const c = nodes.get(cid);
          return c && c.name.toLowerCase().includes(filter);
        });
        if (!hasMatchingChild) return;
      }

      const isSelected = state.selectedNodeId === node.id;
      let nodeFlags =
        ImGuiTreeNodeFlags.OpenOnArrow |
        ImGuiTreeNodeFlags.OpenOnDoubleClick |
        ImGuiTreeNodeFlags.SpanAvailWidth;

      if (isSelected) nodeFlags |= ImGuiTreeNodeFlags.Selected;
      if (node.children.length === 0) nodeFlags |= ImGuiTreeNodeFlags.Leaf;
      if (node.id === '<root>') nodeFlags |= ImGuiTreeNodeFlags.DefaultOpen;

      const nodeLabel = `${node.name} (${node.components.length}c)###tree_${node.id}`;
      const isOpen = ImGui.TreeNodeEx(nodeLabel, nodeFlags);

      if (ImGui.IsItemClicked() && !ImGui.IsItemToggledOpen()) {
        state.selectedNodeId = node.id;
        playSynthBeep(700, 0.02);
      }

      if (ImGui.BeginPopupContextItem(`ctx_${node.id}`)) {
        if (ImGui.MenuItem('+ Add Child')) {
          const newId = `node_${Date.now()}`;
          const newNode: SceneNode = {
            id: newId,
            name: `Entity_${newId.slice(-4)}`,
            enabled: true,
            parentId: node.id,
            children: [],
            baseTransform: { x: 0, y: 0, rotationDeg: 0, scaleX: 1, scaleY: 1 },
            operations: [],
            components: [createDefaultTransformComponent(0, 0, 0, 1, 1)],
          };
          nodes.set(newId, newNode);
          node.children.push(newId);
          state.selectedNodeId = newId;
        }

        const canDeleteOrDup = node.id !== '<root>';
        if (ImGui.MenuItem('Duplicate', '', false, canDeleteOrDup)) {
          if (canDeleteOrDup && node.parentId) {
            const newId = `dup_${Date.now()}`;
            const dupNode: SceneNode = JSON.parse(JSON.stringify(node));
            dupNode.id = newId;
            dupNode.name = `${node.name}_Copy`;
            const t = getNodeTransform(dupNode);
            if (t) {
              t.x += 20;
              t.y += 20;
            }
            dupNode.children = [];
            nodes.set(newId, dupNode);
            const parent = nodes.get(node.parentId);
            if (parent) parent.children.push(newId);
            state.selectedNodeId = newId;
          }
        }

        if (ImGui.MenuItem('Delete...', '', false, canDeleteOrDup)) {
          if (canDeleteOrDup && node.parentId) {
            uiState.deleteTargetNodeId = node.id;
            uiState.showDeleteConfirm = true;
          }
        }

        ImGui.EndPopup();
      }

      if (isOpen) {
        for (const childId of node.children) {
          renderTreeNode(childId);
        }
        ImGui.TreePop();
      }
    }

    renderTreeNode('<root>');

    ImGui.Separator();

    // Bottom Quick Buttons
    if (ImGui.Button('+ Child', new ImVec2(65, 22))) {
      const parentId = state.selectedNodeId || '<root>';
      const parentNode = nodes.get(parentId) || nodes.get('<root>')!;
      const newId = `node_${Date.now()}`;
      const newNode: SceneNode = {
        id: newId,
        name: `Entity_${newId.slice(-4)}`,
        enabled: true,
        parentId: parentNode.id,
        children: [],
        baseTransform: { x: 0, y: 0, rotationDeg: 0, scaleX: 1, scaleY: 1 },
        operations: [],
        components: [createDefaultTransformComponent(0, 0, 0, 1, 1)],
      };
      nodes.set(newId, newNode);
      parentNode.children.push(newId);
      state.selectedNodeId = newId;
      playSynthBeep(600, 0.03);
    }

    ImGui.SameLine();
    const canDuplicateOrDelete = Boolean(state.selectedNodeId && state.selectedNodeId !== '<root>');

    ImGui.BeginDisabled(!canDuplicateOrDelete);
    if (ImGui.Button('Duplicate', new ImVec2(75, 22))) {
      if (canDuplicateOrDelete) {
        const cur = nodes.get(state.selectedNodeId!);
        if (cur && cur.parentId) {
          const newId = `dup_${Date.now()}`;
          const dupNode: SceneNode = JSON.parse(JSON.stringify(cur));
          dupNode.id = newId;
          dupNode.name = `${cur.name}_Copy`;
          const t = getNodeTransform(dupNode);
          if (t) {
            t.x += 20;
            t.y += 20;
          }
          nodes.set(newId, dupNode);
          const parent = nodes.get(cur.parentId);
          if (parent) parent.children.push(newId);
          state.selectedNodeId = newId;
          state.logs.unshift(`Duplicated '${cur.name}'`);
          playSynthBeep(640, 0.04);
        }
      }
    }

    ImGui.SameLine();
    if (ImGui.Button('Delete...', new ImVec2(65, 22))) {
      if (canDuplicateOrDelete) {
        uiState.deleteTargetNodeId = state.selectedNodeId;
        uiState.showDeleteConfirm = true;
      }
    }
    ImGui.EndDisabled();

    ImGui.End();
  }
}

/**
 * Inspector Window (Right Dock)
 */
function drawInspectorWindow(
  nodes: Map<string, SceneNode>,
  state: EditorState,
  textures: Map<SpriteId, TextureAsset>,
  leftX: number,
  topY: number,
  width: number,
  height: number
) {
  ImGui.SetNextWindowPos(new ImVec2(leftX, topY));
  ImGui.SetNextWindowSize(new ImVec2(width, height));
  const flags = ImGuiWindowFlags.NoMove | ImGuiWindowFlags.NoCollapse;

  if (ImGui.Begin('Inspector', null, flags)) {
    const selectedNode = state.selectedNodeId ? nodes.get(state.selectedNodeId) : null;

    if (!selectedNode) {
      ImGui.TextDisabled('Select an entity from the hierarchy');
      ImGui.End();
      return;
    }

    // Entity Header
    const nameTuple: [string] = [selectedNode.name];
    ImGui.SetNextItemWidth(180);
    if (ImGui.InputText('##EntityName', nameTuple, 64)) {
      selectedNode.name = nameTuple[0];
    }
    ImGui.SameLine();

    const enabledTuple: [boolean] = [selectedNode.enabled];
    if (ImGui.Checkbox('Enabled', enabledTuple)) {
      selectedNode.enabled = enabledTuple[0];
    }

    ImGui.TextDisabled(`ID: ${selectedNode.id} | Parent: ${selectedNode.parentId || 'None (Root)'}`);
    ImGui.Separator();

    // Renders the Reusable Component List
    renderComponentList(selectedNode, state, textures, () => {
      uiState.showComponentGallery = true;
      state.showComponentGallery = true;
      uiState.galleryTargetNodeId = selectedNode.id;
    });

    ImGui.End();
  }
}

/**
 * Bottom Workspace Dock (Tabbed: Asset Manager, JSON UI Designer, Console)
 */
function drawBottomDockWindow(
  nodes: Map<string, SceneNode>,
  state: EditorState,
  textures: Map<SpriteId, TextureAsset>,
  leftX: number,
  topY: number,
  width: number,
  height: number,
  device: GPUDevice | null | undefined,
  gl: WebGL2RenderingContext | WebGLRenderingContext | null | undefined,
  onResetScene: (newNodes: Map<string, SceneNode>, presetName: string) => void
) {
  ImGui.SetNextWindowPos(new ImVec2(leftX, topY));
  ImGui.SetNextWindowSize(new ImVec2(width, height));
  const flags = ImGuiWindowFlags.NoMove | ImGuiWindowFlags.NoCollapse;

  if (ImGui.Begin('Workspace Dock', null, flags)) {
    if (ImGui.BeginTabBar('##DockTabs')) {
      // TAB 1: DYNAMIC ASSET MANAGER
      if (ImGui.BeginTabItem('Asset Manager')) {
        renderAssetManagerUI(nodes, state, textures, device, gl, onResetScene);
        ImGui.EndTabItem();
      }

      // TAB 2: IN-ENGINE JSON UI DESIGNER
      if (ImGui.BeginTabItem('JSON UI Designer')) {
        renderInEngineUIDesignerTab(nodes, state);
        ImGui.EndTabItem();
      }

      // TAB 3: ENGINE CONSOLE & LOGS
      if (ImGui.BeginTabItem('Console & Logs')) {
        if (ImGui.Button('Clear Logs')) {
          state.logs = ['Console cleared'];
          playSynthBeep(440, 0.02);
        }
        ImGui.SameLine();
        ImGui.TextDisabled(`Total entries: ${state.logs.length}`);

        ImGui.Separator();
        ImGui.BeginChild('##LogScroll', new ImVec2(0, 95), ImGuiChildFlags.None);
        for (let i = 0; i < state.logs.length; i++) {
          ImGui.Text(`[${i + 1}] ${state.logs[i]}`);
        }
        ImGui.EndChild();

        ImGui.EndTabItem();
      }

      ImGui.EndTabBar();
    }

    ImGui.End();
  }
}

/**
 * In-Engine JSON UI Designer Tab inside Bottom Workspace Dock
 */
function renderInEngineUIDesignerTab(nodes: Map<string, SceneNode>, state: EditorState) {
  // Preset selector
  if (ImGui.BeginCombo('Load Schema Preset', 'Choose preset...')) {
    for (const [pName, pJson] of Object.entries(SAMPLE_UI_SCHEMAS)) {
      if (ImGui.Selectable(pName)) {
        designerJsonBuffer[0] = pJson;
        try {
          designerParsedNode = JSON.parse(pJson);
        } catch {
          designerParsedNode = null;
        }
        playSynthBeep(640, 0.03);
      }
    }
    ImGui.EndCombo();
  }

  ImGui.SameLine();
  // Action buttons
  const selectedNode = state.selectedNodeId ? nodes.get(state.selectedNodeId) : null;
  ImGui.BeginDisabled(!selectedNode);
  if (ImGui.Button('Attach UI to Selected Entity')) {
    if (selectedNode) {
      selectedNode.components.push({
        id: `comp_ui_${Date.now()}`,
        type: 'UIComponent',
        enabled: true,
        name: 'CustomHUD.ui.json',
        markupJson: designerJsonBuffer[0],
      });
      state.logs.unshift(`Attached JSON UI component to '${selectedNode.name}'`);
      playSynthBeep(680, 0.04);
    }
  }
  ImGui.EndDisabled();

  ImGui.SameLine();
  if (ImGui.Button('Save as Project Asset')) {
    const assetId = `ui_asset_${Date.now()}`;
    projectAssets.set(assetId, {
      id: assetId,
      name: `CustomUI_${assetId.slice(-4)}.ui.json`,
      kind: 'ui',
      extension: 'ui.json',
      sizeBytes: designerJsonBuffer[0].length,
      dateAdded: Date.now(),
      textContent: designerJsonBuffer[0],
    });
    state.logs.unshift('Saved JSON UI into Project Asset Manager');
    playSynthBeep(680, 0.04);
  }

  ImGui.Separator();

  // Split View: Left JSON editor, Right Live Interactive Preview
  const availW = ImGui.GetContentRegionAvail().x;
  const editorW = Math.max(260, availW * 0.5);

  ImGui.BeginChild('##UIEditorLeft', new ImVec2(editorW, 100), ImGuiChildFlags.Borders);
  ImGui.TextDisabled('JSON UI Schema Editor:');
  if (ImGui.InputTextMultiline('##designer_json', designerJsonBuffer, 16384, new ImVec2(-1, 75))) {
    try {
      designerParsedNode = JSON.parse(designerJsonBuffer[0]);
    } catch {
      designerParsedNode = null;
    }
  }
  ImGui.EndChild();

  ImGui.SameLine();

  ImGui.BeginChild('##UIPreviewRight', new ImVec2(0, 100), ImGuiChildFlags.None);
  ImGui.TextDisabled('Live Interactive Preview:');
  if (designerParsedNode) {
    renderUIMarkup(designerParsedNode, {
      stateValues: {},
      dispatchAction: (actionId) => {
        state.logs.unshift(`UI Designer Action: ${actionId}`);
        playSynthBeep(720, 0.03);
      },
    });
  } else {
    ImGui.TextColored(new ImVec4(1, 0.3, 0.3, 1), 'JSON Syntax Error: please check formatting.');
  }
  ImGui.EndChild();
}

/**
 * Component Gallery Modal Dialog - Conforms strictly to Dialog Convention
 * 1. Resizable!
 * 2. Content area stretches both ways (horizontally & vertically).
 * 3. Buttons aligned flush RIGHT.
 * 4. Affirming action on the LEFT of the group, Dismissive on the RIGHT: [Add to Entity]  [Close]
 */
function drawComponentGalleryModal(nodes: Map<string, SceneNode>, state: EditorState) {
  const targetNode = nodes.get(uiState.galleryTargetNodeId || state.selectedNodeId || '<root>');

  renderStandardDialog({
    id: 'comp_gallery',
    title: `Component Gallery - Target: ${targetNode ? targetNode.name : '<none>'}`,
    defaultWidth: 500,
    defaultHeight: 420,
    minWidth: 360,
    minHeight: 250,
    onContent: () => {
      ImGui.SetNextItemWidth(-1);
      ImGui.InputTextWithHint('##gallery_filter', 'Search components (e.g. transform, sprite, script, ui)...', gallerySearchBuffer, 48);

      ImGui.Separator();

      const query = gallerySearchBuffer[0].trim().toLowerCase();
      const filteredItems = COMPONENT_GALLERY_ITEMS.filter((item) => {
        if (!query) return true;
        return (
          item.title.toLowerCase().includes(query) ||
          item.category.toLowerCase().includes(query) ||
          item.description.toLowerCase().includes(query)
        );
      });

      if (filteredItems.length === 0) {
        ImGui.TextDisabled('No matching components found.');
      }

      // Selectable list stretching both ways
      for (let i = 0; i < filteredItems.length; i++) {
        const item = filteredItems[i];
        const isSelected = selectedGalleryIndex === i;

        ImGui.PushID(`g_item_${i}`);
        if (ImGui.Selectable(`[${item.category}] ${item.title}###sel_${i}`, isSelected)) {
          selectedGalleryIndex = i;
          playSynthBeep(600, 0.02);
        }

        ImGui.TextDisabled(item.description);
        ImGui.Separator();
        ImGui.PopID();
      }
    },
    affirming: {
      label: '+ Add Component',
      onClick: () => {
        if (targetNode) {
          const query = gallerySearchBuffer[0].trim().toLowerCase();
          const filteredItems = COMPONENT_GALLERY_ITEMS.filter((item) => {
            if (!query) return true;
            return (
              item.title.toLowerCase().includes(query) ||
              item.category.toLowerCase().includes(query) ||
              item.description.toLowerCase().includes(query)
            );
          });
          const item = filteredItems[selectedGalleryIndex] || filteredItems[0];
          if (item) {
            const newComp = item.createDefault();
            targetNode.components.push(newComp);
            state.logs.unshift(`Added component '${item.title}' to '${targetNode.name}'`);
            playSynthBeep(650, 0.04);
            uiState.showComponentGallery = false;
            state.showComponentGallery = false;
          }
        }
      },
      isDisabled: !targetNode,
    },
    dismissive: {
      label: 'Close',
      onClick: () => {
        uiState.showComponentGallery = false;
        state.showComponentGallery = false;
      },
    },
    onClose: () => {
      uiState.showComponentGallery = false;
      state.showComponentGallery = false;
    },
  });
}

/**
 * Import Scene JSON Modal Dialog - Conforms strictly to Dialog Convention
 * 1. Resizable!
 * 2. Text editor stretches both ways.
 * 3. Buttons aligned flush RIGHT: [Import Scene]  [Cancel]
 */
function drawImportSceneModal(
  nodes: Map<string, SceneNode>,
  state: EditorState,
  onResetScene: (newNodes: Map<string, SceneNode>, presetName: string) => void
) {
  renderStandardDialog({
    id: 'import_scene_dlg',
    title: 'Import Scene JSON',
    defaultWidth: 520,
    defaultHeight: 380,
    minWidth: 380,
    minHeight: 240,
    onContent: () => {
      ImGui.Text('Paste exported Scene JSON array below:');
      ImGui.InputTextMultiline(
        '##import_json_area',
        importJsonBuffer,
        65536,
        new ImVec2(-1, -1)
      );
    },
    affirming: {
      label: 'Import Scene',
      onClick: () => {
        try {
          const raw = importJsonBuffer[0].trim();
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            const importedMap = new Map<string, SceneNode>(parsed);
            if (importedMap.has('<root>')) {
              onResetScene(importedMap, 'Imported Scene');
              state.logs.unshift('Successfully imported scene from JSON');
              uiState.showImportSceneDialog = false;
              state.showImportDialog = false;
              playSynthBeep(680, 0.06);
            } else {
              state.logs.unshift('Import failed: missing <root> node in JSON');
            }
          }
        } catch (err: any) {
          state.logs.unshift(`JSON Parse error: ${err.message}`);
        }
      },
    },
    dismissive: {
      label: 'Cancel',
      onClick: () => {
        uiState.showImportSceneDialog = false;
        state.showImportDialog = false;
      },
    },
    onClose: () => {
      uiState.showImportSceneDialog = false;
      state.showImportDialog = false;
    },
  });
}

/**
 * Delete Entity Confirmation Modal Dialog - Conforms strictly to Dialog Convention
 * 1. Resizable!
 * 2. Details stretch both ways.
 * 3. Buttons aligned flush RIGHT: [Delete Entity]  [Cancel] (Delete is red affirming on left, Cancel dismissive on right)
 */
function drawDeleteConfirmModal(nodes: Map<string, SceneNode>, state: EditorState) {
  const target = uiState.deleteTargetNodeId ? nodes.get(uiState.deleteTargetNodeId) : null;

  renderStandardDialog({
    id: 'delete_confirm_dlg',
    title: 'Confirm Entity Deletion',
    defaultWidth: 420,
    defaultHeight: 220,
    minWidth: 320,
    minHeight: 180,
    onContent: () => {
      if (!target) {
        ImGui.Text('No entity selected.');
        return;
      }
      ImGui.TextColored(new ImVec4(1, 0.4, 0.4, 1), `Permanently delete entity: '${target.name}'?`);
      ImGui.TextDisabled(`Entity ID: ${target.id}`);
      ImGui.TextDisabled(`Children: ${target.children.length} entities will also be deleted.`);
      ImGui.TextDisabled(`Attached Components: ${target.components.length}`);
      ImGui.Spacing();
      ImGui.Text('This action cannot be undone.');
    },
    affirming: {
      label: 'Delete Entity',
      isDanger: true,
      onClick: () => {
        if (target && target.parentId) {
          const parent = nodes.get(target.parentId);
          if (parent) {
            parent.children = parent.children.filter((id) => id !== target.id);
          }
          deleteNodeRecursive(target.id, nodes);
          state.selectedNodeId = target.parentId;
          state.logs.unshift(`Deleted entity '${target.name}'`);
          playSynthBeep(320, 0.05);
          uiState.showDeleteConfirm = false;
          uiState.deleteTargetNodeId = null;
        }
      },
      isDisabled: !target || target.id === '<root>',
    },
    dismissive: {
      label: 'Cancel',
      onClick: () => {
        uiState.showDeleteConfirm = false;
        uiState.deleteTargetNodeId = null;
      },
    },
    onClose: () => {
      uiState.showDeleteConfirm = false;
      uiState.deleteTargetNodeId = null;
    },
  });
}

/**
 * Center Viewport Window - Proper UI Event Handling & Event Isolation
 * Scrolling on a dialog or other window NEVER bleeds into the viewport!
 */
function drawViewportWindow(
  nodes: Map<string, SceneNode>,
  state: EditorState,
  textures: Map<SpriteId, TextureAsset>,
  leftX: number,
  topY: number,
  width: number,
  height: number
) {
  ImGui.SetNextWindowPos(new ImVec2(leftX, topY));
  ImGui.SetNextWindowSize(new ImVec2(width, height));
  const flags =
    ImGuiWindowFlags.NoTitleBar |
    ImGuiWindowFlags.NoResize |
    ImGuiWindowFlags.NoMove |
    ImGuiWindowFlags.NoScrollbar |
    ImGuiWindowFlags.NoScrollWithMouse;

  if (ImGui.Begin('##ViewportWindow', null, flags)) {
    const drawList = ImGui.GetWindowDrawList();
    const winPos = ImGui.GetWindowPos();
    const winSize = ImGui.GetWindowSize();
    const io = ImGui.GetIO();

    const mouseX = io.MousePos.x;
    const mouseY = io.MousePos.y;
    const isMouseInViewport =
      mouseX >= winPos.x &&
      mouseX <= winPos.x + winSize.x &&
      mouseY >= winPos.y &&
      mouseY <= winPos.y + winSize.y;

    // PROPER EVENT ISOLATION:
    // If any modal/dialog is open, or if mouse is hovering ANY dialog/window,
    // viewport scrolling and panning MUST NOT trigger!
    const isHoveringOtherWindow = io.WantCaptureMouse && !ImGui.IsWindowHovered();
    const canInteractWithViewport =
      isMouseInViewport &&
      !uiState.shouldBlockViewportEvents() &&
      !isHoveringOtherWindow;

    const bgCol = packColor(0.06, 0.07, 0.1, 1.0);
    drawList.AddRectFilled(winPos, new ImVec2(winPos.x + winSize.x, winPos.y + winSize.y), bgCol);

    // 1. Grid lines and axes
    drawViewportGrid(drawList, state.camera, winPos.x, winPos.y, winSize.x, winSize.y);

    // 2. Render all Scene Sprites
    const renderList: { node: SceneNode; spriteComp: SpriteRendererComponent }[] = [];
    nodes.forEach((node) => {
      if (!node.enabled) return;
      for (const comp of node.components) {
        if (comp.type === 'SpriteRenderer' && comp.enabled) {
          renderList.push({ node, spriteComp: comp });
        }
      }
    });

    renderList.sort((a, b) => a.spriteComp.sortOrder - b.spriteComp.sortOrder);

    for (const item of renderList) {
      drawNodeSprite(item.node, item.spriteComp, drawList, textures, state.camera, winPos, winSize);
    }

    // 3. Render Particles & Box Colliders
    nodes.forEach((node) => {
      if (!node.enabled) return;
      for (const comp of node.components) {
        if (!comp.enabled) continue;
        if (comp.type === 'BoxCollider2D' && comp.showBounds) {
          drawBoxCollider(node, comp, drawList, state.camera, winPos, winSize);
        } else if (comp.type === 'ParticleEmitter2D') {
          drawParticles(node, comp, drawList, state.camera, winPos, winSize);
        }
      }
    });

    // 4. Viewport Mouse Panning (Only when viewport interaction is permitted!)
    const isMiddleDown = ImGui.IsMouseDown(ImGuiMouseButton.Middle);
    const isRightDown = ImGui.IsMouseDown(ImGuiMouseButton.Right);
    const isAltLeftDown = io.KeyAlt && ImGui.IsMouseDown(ImGuiMouseButton.Left);

    if (canInteractWithViewport && (isMiddleDown || isRightDown || isAltLeftDown)) {
      if (!isPanningViewport) {
        isPanningViewport = true;
        panStartMouse = [mouseX, mouseY];
        panStartCamera = [state.camera.x, state.camera.y];
      } else {
        const dx = (mouseX - panStartMouse[0]) / state.camera.zoom;
        const dy = (mouseY - panStartMouse[1]) / state.camera.zoom;
        state.camera.x = panStartCamera[0] - dx;
        state.camera.y = panStartCamera[1] + dy;
      }
    } else {
      isPanningViewport = false;
    }

    // Zoom with mouse wheel - STRICTLY gated to viewport interaction!
    // Never zooms when hovering a dialog on top of the viewport!
    if (canInteractWithViewport && io.MouseWheel !== 0) {
      const zoomFactor = io.MouseWheel > 0 ? 1.15 : 0.87;
      state.camera.zoom = Math.max(1e-5, Math.min(1e6, state.camera.zoom * zoomFactor));
    }

    // 5. Gizmo Transformation Handle for selected entity
    const selectedNode = state.selectedNodeId ? nodes.get(state.selectedNodeId) : null;
    if (selectedNode && selectedNode.id !== '<root>') {
      const transComp = getNodeTransform(selectedNode);
      if (transComp && transComp.enabled) {
        handleGizmoInteraction(
          selectedNode,
          transComp,
          state,
          drawList,
          winPos,
          winSize,
          mouseX,
          mouseY,
          canInteractWithViewport
        );
      }
    }

    // 6. Viewport HUD overlay (top-left) - Clean text only
    const hudX = winPos.x + 8;
    const hudY = winPos.y + 8;
    drawList.AddRectFilled(
      new ImVec2(hudX, hudY),
      new ImVec2(hudX + 230, hudY + 44),
      packColor(0.08, 0.09, 0.12, 0.85)
    );
    drawList.AddRect(
      new ImVec2(hudX, hudY),
      new ImVec2(hudX + 230, hudY + 44),
      packColor(0.2, 0.25, 0.35, 0.8)
    );

    const [cursorWorldX, cursorWorldY] = screenToWorld(
      mouseX,
      mouseY,
      state.camera,
      winSize.x,
      winSize.y,
      winPos.x,
      winPos.y
    );

    drawList.AddText(
      new ImVec2(hudX + 6, hudY + 5),
      packColor(0.9, 0.9, 0.9, 1.0),
      `Camera: (${state.camera.x.toFixed(1)}, ${state.camera.y.toFixed(1)}) | Zoom: ${(state.camera.zoom * 100).toFixed(0)}%`
    );
    drawList.AddText(
      new ImVec2(hudX + 6, hudY + 23),
      packColor(0.5, 0.8, 1.0, 1.0),
      `World Pos: (${cursorWorldX.toFixed(2)}, ${cursorWorldY.toFixed(2)})`
    );

    ImGui.End();
  }
}

/**
 * Grid rendering with axes
 */
function drawViewportGrid(
  drawList: any,
  camera: { x: number; y: number; zoom: number },
  vx: number,
  vy: number,
  vw: number,
  vh: number
) {
  let step = 64;
  if (camera.zoom > 2.0) step = 16;
  else if (camera.zoom > 1.0) step = 32;
  else if (camera.zoom < 0.2) step = 512;
  else if (camera.zoom < 0.4) step = 256;

  const [minWx, maxWy] = screenToWorld(vx, vy, camera, vw, vh, vx, vy);
  const [maxWx, minWy] = screenToWorld(vx + vw, vy + vh, camera, vw, vh, vx, vy);

  const startX = Math.floor(minWx / step) * step;
  const endX = Math.ceil(maxWx / step) * step;
  const startY = Math.floor(minWy / step) * step;
  const endY = Math.ceil(maxWy / step) * step;

  const gridCol = packColor(0.14, 0.16, 0.22, 0.7);

  for (let x = startX; x <= endX; x += step) {
    if (x === 0) continue;
    const [sx1] = worldToScreen(x, 0, camera, vw, vh, vx, vy);
    drawList.AddLine(new ImVec2(sx1, vy), new ImVec2(sx1, vy + vh), gridCol, 1.0);
  }

  for (let y = startY; y <= endY; y += step) {
    if (y === 0) continue;
    const [, sy1] = worldToScreen(0, y, camera, vw, vh, vx, vy);
    drawList.AddLine(new ImVec2(vx, sy1), new ImVec2(vx + vw, sy1), gridCol, 1.0);
  }

  // Origin Axes
  const [origX, origY] = worldToScreen(0, 0, camera, vw, vh, vx, vy);
  drawList.AddLine(new ImVec2(vx, origY), new ImVec2(vx + vw, origY), packColor(0.85, 0.2, 0.2, 0.9), 1.5);
  drawList.AddLine(new ImVec2(origX, vy), new ImVec2(origX, vy + vh), packColor(0.2, 0.85, 0.3, 0.9), 1.5);
}

/**
 * Draws a Sprite quad in viewport using ImDrawList.AddImageQuad
 */
function drawNodeSprite(
  node: SceneNode,
  sprite: SpriteRendererComponent,
  drawList: any,
  textures: Map<SpriteId, TextureAsset>,
  camera: { x: number; y: number; zoom: number },
  winPos: { x: number; y: number },
  winSize: { x: number; y: number }
) {
  const tex = textures.get(sprite.spriteId);
  if (!tex) return;

  const w = sprite.width;
  const h = sprite.height;
  const px = sprite.pivotX;
  const py = sprite.pivotY;

  const localP1: [number, number] = [-px * w, -py * h];
  const localP2: [number, number] = [(1 - px) * w, -py * h];
  const localP3: [number, number] = [(1 - px) * w, (1 - py) * h];
  const localP4: [number, number] = [-px * w, (1 - py) * h];

  const wMat = node.worldMatrix || [1, 0, 0, 1, 0, 0];
  const w1 = transformPoint(wMat, localP1[0], localP1[1]);
  const w2 = transformPoint(wMat, localP2[0], localP2[1]);
  const w3 = transformPoint(wMat, localP3[0], localP3[1]);
  const w4 = transformPoint(wMat, localP4[0], localP4[1]);

  const s1 = worldToScreen(w1[0], w1[1], camera, winSize.x, winSize.y, winPos.x, winPos.y);
  const s2 = worldToScreen(w2[0], w2[1], camera, winSize.x, winSize.y, winPos.x, winPos.y);
  const s3 = worldToScreen(w3[0], w3[1], camera, winSize.x, winSize.y, winPos.x, winPos.y);
  const s4 = worldToScreen(w4[0], w4[1], camera, winSize.x, winSize.y, winPos.x, winPos.y);

  let u0 = 0, u1 = 1, v0 = 0, v1 = 1;
  if (sprite.flipX) { u0 = 1; u1 = 0; }
  if (sprite.flipY) { v0 = 1; v1 = 0; }

  const effectiveAlpha = (node.effectiveOpacity ?? 1.0) * sprite.color[3];
  const tint = packColor(
    sprite.color[0],
    sprite.color[1],
    sprite.color[2],
    Math.max(0, Math.min(1, effectiveAlpha))
  );

  drawList.AddImageQuad(
    tex.texRef,
    new ImVec2(s1[0], s1[1]),
    new ImVec2(s2[0], s2[1]),
    new ImVec2(s3[0], s3[1]),
    new ImVec2(s4[0], s4[1]),
    new ImVec2(u0, v1),
    new ImVec2(u1, v1),
    new ImVec2(u1, v0),
    new ImVec2(u0, v0),
    tint
  );
}

/**
 * Draws BoxCollider2D visual bounds
 */
function drawBoxCollider(
  node: SceneNode,
  comp: { width: number; height: number; isTrigger: boolean },
  drawList: any,
  camera: { x: number; y: number; zoom: number },
  winPos: { x: number; y: number },
  winSize: { x: number; y: number }
) {
  const hw = comp.width / 2;
  const hh = comp.height / 2;
  const wMat = node.worldMatrix || [1, 0, 0, 1, 0, 0];

  const w1 = transformPoint(wMat, -hw, -hh);
  const w2 = transformPoint(wMat, hw, -hh);
  const w3 = transformPoint(wMat, hw, hh);
  const w4 = transformPoint(wMat, -hw, hh);

  const s1 = worldToScreen(w1[0], w1[1], camera, winSize.x, winSize.y, winPos.x, winPos.y);
  const s2 = worldToScreen(w2[0], w2[1], camera, winSize.x, winSize.y, winPos.x, winPos.y);
  const s3 = worldToScreen(w3[0], w3[1], camera, winSize.x, winSize.y, winPos.x, winPos.y);
  const s4 = worldToScreen(w4[0], w4[1], camera, winSize.x, winSize.y, winPos.x, winPos.y);

  const col = comp.isTrigger
    ? packColor(0.2, 0.9, 0.5, 0.8)
    : packColor(0.9, 0.5, 0.2, 0.8);

  drawList.AddLine(new ImVec2(s1[0], s1[1]), new ImVec2(s2[0], s2[1]), col, 1.5);
  drawList.AddLine(new ImVec2(s2[0], s2[1]), new ImVec2(s3[0], s3[1]), col, 1.5);
  drawList.AddLine(new ImVec2(s3[0], s3[1]), new ImVec2(s4[0], s4[1]), col, 1.5);
  drawList.AddLine(new ImVec2(s4[0], s4[1]), new ImVec2(s1[0], s1[1]), col, 1.5);
}

/**
 * Draws dynamic particle bursts
 */
function drawParticles(
  node: SceneNode,
  comp: { particles: any[] },
  drawList: any,
  camera: { x: number; y: number; zoom: number },
  winPos: { x: number; y: number },
  winSize: { x: number; y: number }
) {
  const wPos = node.worldPos || [0, 0];
  for (const p of comp.particles) {
    const [sx, sy] = worldToScreen(
      wPos[0] + p.x,
      wPos[1] + p.y,
      camera,
      winSize.x,
      winSize.y,
      winPos.x,
      winPos.y
    );
    const alpha = (p.life / p.maxLife) * p.color[3];
    const pCol = packColor(p.color[0], p.color[1], p.color[2], Math.max(0, alpha));
    drawList.AddCircleFilled(new ImVec2(sx, sy), Math.max(1, p.size * camera.zoom), pCol);
  }
}

/**
 * Interactive Transform Gizmos (Translate, Rotate, Scale)
 */
function handleGizmoInteraction(
  node: SceneNode,
  transComp: TransformComponent,
  state: EditorState,
  drawList: any,
  winPos: { x: number; y: number },
  winSize: { x: number; y: number },
  mouseX: number,
  mouseY: number,
  canInteract: boolean
) {
  const [worldX, worldY] = node.worldPos || [transComp.x, transComp.y];
  const [screenX, screenY] = worldToScreen(
    worldX,
    worldY,
    state.camera,
    winSize.x,
    winSize.y,
    winPos.x,
    winPos.y
  );

  const isMouseDown = ImGui.IsMouseDown(ImGuiMouseButton.Left);
  const io = ImGui.GetIO();

  if (state.gizmoMode === 'TRANSLATE') {
    const arrowLen = 50;
    const arrowHead = 10;

    // X Axis Handle (Red, Points Right)
    const xEnd = new ImVec2(screenX + arrowLen, screenY);
    const isHoverX = Math.abs(mouseY - screenY) < 8 && mouseX >= screenX && mouseX <= screenX + arrowLen;
    const colX = isHoverX ? packColor(1, 0.4, 0.4, 1) : packColor(0.9, 0.2, 0.2, 1);

    drawList.AddLine(new ImVec2(screenX, screenY), xEnd, colX, 2.5);
    drawList.AddTriangleFilled(
      new ImVec2(xEnd.x + arrowHead, xEnd.y),
      new ImVec2(xEnd.x, xEnd.y - 5),
      new ImVec2(xEnd.x, xEnd.y + 5),
      colX
    );

    // Y Axis Handle (Green, Points Up)
    const yEnd = new ImVec2(screenX, screenY - arrowLen);
    const isHoverY = Math.abs(mouseX - screenX) < 8 && mouseY <= screenY && mouseY >= screenY - arrowLen;
    const colY = isHoverY ? packColor(0.4, 1, 0.4, 1) : packColor(0.2, 0.9, 0.2, 1);

    drawList.AddLine(new ImVec2(screenX, screenY), yEnd, colY, 2.5);
    drawList.AddTriangleFilled(
      new ImVec2(yEnd.x, yEnd.y - arrowHead),
      new ImVec2(yEnd.x - 5, yEnd.y),
      new ImVec2(yEnd.x + 5, yEnd.y),
      colY
    );

    // Center handle (Free 2D Drag)
    const isHoverCenter = Math.hypot(mouseX - screenX, mouseY - screenY) < 10;
    const colCenter = isHoverCenter ? packColor(1, 1, 0.4, 1) : packColor(0.9, 0.8, 0.2, 0.8);
    drawList.AddCircleFilled(new ImVec2(screenX, screenY), 5, colCenter);

    if (canInteract && !io.KeyAlt && isMouseDown && !isDraggingGizmo) {
      if (isHoverCenter) {
        isDraggingGizmo = true;
        gizmoDragType = 'TRANSLATE_XY';
        gizmoStartMouse = [mouseX, mouseY];
        gizmoStartPos = [transComp.x, transComp.y];
      } else if (isHoverX) {
        isDraggingGizmo = true;
        gizmoDragType = 'TRANSLATE_X';
        gizmoStartMouse = [mouseX, mouseY];
        gizmoStartPos = [transComp.x, transComp.y];
      } else if (isHoverY) {
        isDraggingGizmo = true;
        gizmoDragType = 'TRANSLATE_Y';
        gizmoStartMouse = [mouseX, mouseY];
        gizmoStartPos = [transComp.x, transComp.y];
      }
    }

    if (isDraggingGizmo && isMouseDown) {
      const dx = (mouseX - gizmoStartMouse[0]) / state.camera.zoom;
      const dy = -(mouseY - gizmoStartMouse[1]) / state.camera.zoom;

      let newX = gizmoStartPos[0];
      let newY = gizmoStartPos[1];

      if (gizmoDragType === 'TRANSLATE_X' || gizmoDragType === 'TRANSLATE_XY') newX += dx;
      if (gizmoDragType === 'TRANSLATE_Y' || gizmoDragType === 'TRANSLATE_XY') newY += dy;

      if (state.gridSnap) {
        newX = Math.round(newX / state.snapSize) * state.snapSize;
        newY = Math.round(newY / state.snapSize) * state.snapSize;
      }

      transComp.x = Number(newX.toFixed(2));
      transComp.y = Number(newY.toFixed(2));
    } else {
      isDraggingGizmo = false;
      gizmoDragType = null;
    }
  } else if (state.gizmoMode === 'ROTATE') {
    const radius = 55;
    const isHoverRing = Math.abs(Math.hypot(mouseX - screenX, mouseY - screenY) - radius) < 8;
    const ringCol = isHoverRing ? packColor(0.4, 0.8, 1, 1) : packColor(0.3, 0.6, 0.9, 0.8);

    drawList.AddCircle(new ImVec2(screenX, screenY), radius, ringCol, 36, 2.0);

    const rad = (transComp.rotationDeg * Math.PI) / 180;
    const tickX = screenX + Math.cos(rad) * radius;
    const tickY = screenY - Math.sin(rad) * radius;
    drawList.AddCircleFilled(new ImVec2(tickX, tickY), 6, packColor(1, 0.8, 0.2, 1));

    if (canInteract && !io.KeyAlt && isMouseDown && !isDraggingGizmo && isHoverRing) {
      isDraggingGizmo = true;
      gizmoDragType = 'ROTATE';
      gizmoStartRot = transComp.rotationDeg;
      gizmoStartMouse = [mouseX, mouseY];
    }

    if (isDraggingGizmo && isMouseDown && gizmoDragType === 'ROTATE') {
      const curAngleRad = Math.atan2(-(mouseY - screenY), mouseX - screenX);
      let curAngleDeg = (curAngleRad * 180) / Math.PI;
      if (curAngleDeg < 0) curAngleDeg += 360;

      if (state.gridSnap) {
        curAngleDeg = Math.round(curAngleDeg / 15) * 15;
      }
      transComp.rotationDeg = Number(curAngleDeg.toFixed(2));
    } else if (!isMouseDown) {
      isDraggingGizmo = false;
      gizmoDragType = null;
    }
  } else if (state.gizmoMode === 'SCALE') {
    const armLen = 50;
    const boxSize = 8;

    const boxX = screenX + armLen;
    const boxY = screenY - armLen;
    const isHoverScale = Math.hypot(mouseX - boxX, mouseY - boxY) < 12;
    const colScale = isHoverScale ? packColor(1, 0.5, 0.8, 1) : packColor(0.8, 0.3, 0.7, 0.9);

    drawList.AddLine(new ImVec2(screenX, screenY), new ImVec2(boxX, boxY), colScale, 2.0);
    drawList.AddRectFilled(
      new ImVec2(boxX - boxSize / 2, boxY - boxSize / 2),
      new ImVec2(boxX + boxSize / 2, boxY + boxSize / 2),
      colScale
    );

    if (canInteract && !io.KeyAlt && isMouseDown && !isDraggingGizmo && isHoverScale) {
      isDraggingGizmo = true;
      gizmoDragType = 'SCALE_XY';
      gizmoStartMouse = [mouseX, mouseY];
      gizmoStartScale = [transComp.scaleX, transComp.scaleY];
    }

    if (isDraggingGizmo && isMouseDown && gizmoDragType === 'SCALE_XY') {
      const delta = (mouseX - gizmoStartMouse[0]) * 0.02;
      let newScale = Math.max(0.001, gizmoStartScale[0] + delta);
      if (state.gridSnap) {
        newScale = Math.round(newScale / 0.1) * 0.1;
      }
      transComp.scaleX = Number(newScale.toFixed(3));
      transComp.scaleY = Number(newScale.toFixed(3));
    } else if (!isMouseDown) {
      isDraggingGizmo = false;
      gizmoDragType = null;
    }
  }

  // Draw node label above origin
  drawList.AddText(
    new ImVec2(screenX + 12, screenY - 20),
    packColor(1, 1, 1, 0.9),
    `[${node.name}]`
  );
}

/**
 * Recursive delete helper
 */
function deleteNodeRecursive(nodeId: string, nodes: Map<string, SceneNode>) {
  const node = nodes.get(nodeId);
  if (!node) return;
  for (const childId of node.children) {
    deleteNodeRecursive(childId, nodes);
  }
  nodes.delete(nodeId);
}
