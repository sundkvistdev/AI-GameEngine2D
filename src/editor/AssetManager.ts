/**
 * Vortex2D Game Engine - Dynamic Asset Manager & Scene Serializer
 * Supports uploading, dynamic data storage, asset creation, audio preview,
 * scene save/export, and load/open. Absolutely zero emojis.
 */

import {
  ImGui,
  ImGuiChildFlags,
  ImVec2,
  ImVec4,
} from '@mori2003/jsimgui';
import type {
  SceneNode,
  EditorState,
  ProjectAsset,
  TextureAsset,
  SpriteId,
  AssetKind,
} from '../engine/types.ts';
import { playSynthBeep, decodeAudioBuffer, playAudioBuffer } from '../engine/audio.ts';
import { registerCustomImageTexture } from '../engine/textures.ts';
import { createDefaultTransformComponent, getNodeTransform } from '../engine/math.ts';
import { SAMPLE_UI_SCHEMAS, renderUIMarkup, type UIElementNode } from '../ui/UIMarkup.ts';

// Dynamic project asset store
export const projectAssets = new Map<string, ProjectAsset>();

let isInitializedWithDefaults = false;

/**
 * Initializes the asset manager with default procedural textures and sample assets
 */
export function initializeDefaultAssets(textures: Map<SpriteId, TextureAsset>): void {
  if (isInitializedWithDefaults) return;
  isInitializedWithDefaults = true;

  // Add procedural sprite textures as initial image assets
  textures.forEach((tex, id) => {
    projectAssets.set(`tex_${id}`, {
      id: `tex_${id}`,
      name: `${id}.png`,
      kind: 'image',
      extension: 'png',
      sizeBytes: tex.width * tex.height * 4,
      dateAdded: Date.now(),
      textureAsset: tex,
    });
  });

  // Add sample script
  projectAssets.set('script_orbit', {
    id: 'script_orbit',
    name: 'OrbitController.js',
    kind: 'script',
    extension: 'js',
    sizeBytes: 340,
    dateAdded: Date.now(),
    textContent: `// OrbitController.js
const trans = node.components.find(c => c.type === 'Transform');
if (trans) {
  const rad = 140;
  trans.x = Math.cos(time * 2.0) * rad;
  trans.y = Math.sin(time * 2.0) * rad;
  trans.rotationDeg = (time * 2.0 * 180 / Math.PI) - 90;
}`,
  });

  // Add sample JSON UI asset
  projectAssets.set('ui_game_hud', {
    id: 'ui_game_hud',
    name: 'GameHUD.ui.json',
    kind: 'ui',
    extension: 'ui.json',
    sizeBytes: SAMPLE_UI_SCHEMAS['Game HUD'].length,
    dateAdded: Date.now(),
    textContent: SAMPLE_UI_SCHEMAS['Game HUD'],
  });
}

/**
 * Opens a native browser file picker to upload any asset files
 */
export function triggerFileUpload(
  device: GPUDevice | null | undefined,
  gl: WebGL2RenderingContext | WebGLRenderingContext | null | undefined,
  textures: Map<SpriteId, TextureAsset>,
  state: EditorState,
  onSceneLoaded?: (nodes: Map<string, SceneNode>, sceneName: string) => void
): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.multiple = true;
  input.accept = 'image/*,audio/*,.js,.json,.vortex.json,.prefab,.txt,.ui.json';

  input.onchange = async () => {
    const files = input.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = file.name.split('.').pop()?.toLowerCase() || '';

      if (['png', 'jpg', 'jpeg', 'webp', 'svg', 'bmp'].includes(ext)) {
        // Image Upload
        const reader = new FileReader();
        reader.onload = () => {
          const img = new Image();
          img.onload = () => {
            const assetId = `custom_img_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
            try {
              const texAsset = registerCustomImageTexture(assetId, file.name, img, device, gl);
              textures.set(assetId, texAsset);
              projectAssets.set(assetId, {
                id: assetId,
                name: file.name,
                kind: 'image',
                extension: ext,
                sizeBytes: file.size,
                dateAdded: Date.now(),
                textureAsset: texAsset,
              });
              state.activeAssetId = assetId;
              state.logs.unshift(`Imported image asset: ${file.name} (${texAsset.width}x${texAsset.height})`);
              playSynthBeep(680, 0.04);
            } catch (err: any) {
              state.logs.unshift(`Failed to register texture for ${file.name}: ${err.message}`);
            }
          };
          img.src = reader.result as string;
        };
        reader.readAsDataURL(file);
      } else if (['wav', 'mp3', 'ogg', 'm4a'].includes(ext)) {
        // Audio Upload
        const reader = new FileReader();
        reader.onload = async () => {
          const arrayBuf = reader.result as ArrayBuffer;
          const audioBuf = await decodeAudioBuffer(arrayBuf);
          if (audioBuf) {
            const assetId = `custom_audio_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
            projectAssets.set(assetId, {
              id: assetId,
              name: file.name,
              kind: 'audio',
              extension: ext,
              sizeBytes: file.size,
              dateAdded: Date.now(),
              audioBuffer: audioBuf,
            });
            state.activeAssetId = assetId;
            state.logs.unshift(`Imported audio asset: ${file.name} (${audioBuf.duration.toFixed(1)}s)`);
            playSynthBeep(720, 0.04);
          } else {
            state.logs.unshift(`Failed to decode audio file: ${file.name}`);
          }
        };
        reader.readAsArrayBuffer(file);
      } else if (ext === 'vortex' || file.name.endsWith('.vortex.json') || (ext === 'json' && file.name.includes('scene'))) {
        // Scene JSON File
        const text = await file.text();
        try {
          const parsed = JSON.parse(text);
          if (Array.isArray(parsed)) {
            const map = new Map<string, SceneNode>(parsed);
            if (map.has('<root>')) {
              onSceneLoaded?.(map, file.name.replace(/\.[^/.]+$/, ''));
              state.logs.unshift(`Loaded scene from file: ${file.name}`);
              playSynthBeep(640, 0.05);
            }
          }
        } catch (err: any) {
          state.logs.unshift(`Failed to parse scene JSON: ${err.message}`);
        }
      } else if (file.name.endsWith('.ui.json')) {
        // JSON UI File
        const text = await file.text();
        const assetId = `custom_ui_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        projectAssets.set(assetId, {
          id: assetId,
          name: file.name,
          kind: 'ui',
          extension: 'ui.json',
          sizeBytes: file.size,
          dateAdded: Date.now(),
          textContent: text,
        });
        state.activeAssetId = assetId;
        state.logs.unshift(`Imported JSON UI asset: ${file.name}`);
        playSynthBeep(600, 0.03);
      } else if (['js', 'ts', 'txt'].includes(ext)) {
        // Script / Text File
        const text = await file.text();
        const assetId = `custom_script_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        projectAssets.set(assetId, {
          id: assetId,
          name: file.name,
          kind: 'script',
          extension: ext,
          sizeBytes: file.size,
          dateAdded: Date.now(),
          textContent: text,
        });
        state.activeAssetId = assetId;
        state.logs.unshift(`Imported script asset: ${file.name}`);
        playSynthBeep(600, 0.03);
      } else {
        // Generic JSON / Data
        const text = await file.text();
        const assetId = `custom_data_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        projectAssets.set(assetId, {
          id: assetId,
          name: file.name,
          kind: 'json',
          extension: ext,
          sizeBytes: file.size,
          dateAdded: Date.now(),
          textContent: text,
        });
        state.activeAssetId = assetId;
        state.logs.unshift(`Imported file asset: ${file.name}`);
        playSynthBeep(600, 0.03);
      }
    }
  };

  input.click();
}

/**
 * Exports current scene to a downloadable .vortex.json file
 */
export function exportSceneToFile(nodes: Map<string, SceneNode>, sceneName: string = 'Scene'): void {
  const jsonStr = JSON.stringify(Array.from(nodes.entries()), null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${sceneName}.vortex.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Downloads a specific asset to user's computer
 */
export function exportAssetToFile(asset: ProjectAsset): void {
  let blob: Blob;
  if (asset.textContent) {
    blob = new Blob([asset.textContent], { type: 'text/plain' });
  } else if (asset.jsonData) {
    blob = new Blob([JSON.stringify(asset.jsonData, null, 2)], { type: 'application/json' });
  } else {
    blob = new Blob([JSON.stringify(asset, null, 2)], { type: 'application/json' });
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = asset.name;
  a.click();
  URL.revokeObjectURL(url);
}

const assetSearchBuffer: [string] = [''];

/**
 * Renders the Dynamic Asset Manager inside the bottom workspace dock
 */
export function renderAssetManagerUI(
  nodes: Map<string, SceneNode>,
  state: EditorState,
  textures: Map<SpriteId, TextureAsset>,
  device: GPUDevice | null | undefined,
  gl: WebGL2RenderingContext | WebGLRenderingContext | null | undefined,
  onSceneLoaded: (newNodes: Map<string, SceneNode>, presetName: string) => void
): void {
  // Top Action Buttons
  if (ImGui.Button('Upload Files...')) {
    triggerFileUpload(device, gl, textures, state, onSceneLoaded);
  }
  ImGui.SameLine();

  if (ImGui.Button('Save Scene (.vortex.json)')) {
    exportSceneToFile(nodes, state.activePresetName || 'MyScene');
    state.logs.unshift('Exported scene to .vortex.json');
    playSynthBeep(700, 0.04);
  }
  ImGui.SameLine();

  if (ImGui.Button('Open Scene...')) {
    triggerFileUpload(device, gl, textures, state, onSceneLoaded);
  }
  ImGui.SameLine();

  if (ImGui.Button('+ New Script')) {
    const assetId = `script_${Date.now()}`;
    const newScript: ProjectAsset = {
      id: assetId,
      name: `Script_${assetId.slice(-4)}.js`,
      kind: 'script',
      extension: 'js',
      sizeBytes: 120,
      dateAdded: Date.now(),
      textContent: `// Custom Script\nconst trans = node.components.find(c => c.type === 'Transform');\nif (trans) {\n  trans.rotationDeg += 45 * dt;\n}`,
    };
    projectAssets.set(assetId, newScript);
    state.activeAssetId = assetId;
    state.logs.unshift(`Created new script asset: ${newScript.name}`);
    playSynthBeep(620, 0.03);
  }
  ImGui.SameLine();

  if (ImGui.Button('+ New JSON UI')) {
    const assetId = `ui_${Date.now()}`;
    const newUI: ProjectAsset = {
      id: assetId,
      name: `HUD_${assetId.slice(-4)}.ui.json`,
      kind: 'ui',
      extension: 'ui.json',
      sizeBytes: SAMPLE_UI_SCHEMAS['Game HUD'].length,
      dateAdded: Date.now(),
      textContent: SAMPLE_UI_SCHEMAS['Game HUD'],
    };
    projectAssets.set(assetId, newUI);
    state.activeAssetId = assetId;
    state.logs.unshift(`Created new JSON UI asset: ${newUI.name}`);
    playSynthBeep(620, 0.03);
  }
  ImGui.SameLine();

  const selectedNode = state.selectedNodeId ? nodes.get(state.selectedNodeId) : null;
  const canSavePrefab = Boolean(selectedNode && selectedNode.id !== '<root>');
  ImGui.BeginDisabled(!canSavePrefab);
  if (ImGui.Button('+ Save as Prefab')) {
    if (selectedNode) {
      const prefabId = `prefab_${Date.now()}`;
      const clone = JSON.parse(JSON.stringify(selectedNode));
      const newPrefab: ProjectAsset = {
        id: prefabId,
        name: `${selectedNode.name}.prefab`,
        kind: 'prefab',
        extension: 'prefab',
        sizeBytes: JSON.stringify(clone).length,
        dateAdded: Date.now(),
        jsonData: clone,
      };
      projectAssets.set(prefabId, newPrefab);
      state.activeAssetId = prefabId;
      state.logs.unshift(`Saved prefab '${newPrefab.name}' from entity '${selectedNode.name}'`);
      playSynthBeep(640, 0.04);
    }
  }
  ImGui.EndDisabled();

  ImGui.Separator();

  // Search Filter & Kind Tabs
  ImGui.SetNextItemWidth(180);
  ImGui.InputTextWithHint('##filter_assets', 'Filter assets...', assetSearchBuffer, 32);
  const filter = assetSearchBuffer[0].trim().toLowerCase();

  ImGui.SameLine();
  const allCount = projectAssets.size;
  let imgCount = 0, audCount = 0, scrCount = 0, pfbCount = 0, uiCount = 0;
  projectAssets.forEach((a) => {
    if (a.kind === 'image') imgCount++;
    else if (a.kind === 'audio') audCount++;
    else if (a.kind === 'script') scrCount++;
    else if (a.kind === 'prefab') pfbCount++;
    else if (a.kind === 'ui') uiCount++;
  });

  const tabBtn = (label: string, kind: typeof state.activeAssetTab) => {
    const isAct = state.activeAssetTab === kind;
    if (ImGui.SmallButton(isAct ? `[${label}]` : label)) {
      state.activeAssetTab = kind;
    }
    ImGui.SameLine();
  };

  tabBtn(`All (${allCount})`, 'all');
  tabBtn(`Images (${imgCount})`, 'images');
  tabBtn(`Audio (${audCount})`, 'audio');
  tabBtn(`Scripts (${scrCount})`, 'scripts');
  tabBtn(`UI (${uiCount})`, 'ui');
  tabBtn(`Prefabs (${pfbCount})`, 'prefabs');
  ImGui.NewLine();

  // Split View: Left List of Assets, Right Inspector / Actions
  const listWidth = 320;
  ImGui.BeginChild('##AssetListContainer', new ImVec2(listWidth, 100), ImGuiChildFlags.Borders);

  const assetList: ProjectAsset[] = [];
  projectAssets.forEach((asset) => {
    if (state.activeAssetTab === 'images' && asset.kind !== 'image') return;
    if (state.activeAssetTab === 'audio' && asset.kind !== 'audio') return;
    if (state.activeAssetTab === 'scripts' && asset.kind !== 'script') return;
    if (state.activeAssetTab === 'ui' && asset.kind !== 'ui') return;
    if (state.activeAssetTab === 'prefabs' && asset.kind !== 'prefab') return;
    if (filter && !asset.name.toLowerCase().includes(filter) && !asset.kind.includes(filter)) return;
    assetList.push(asset);
  });

  if (assetList.length === 0) {
    ImGui.TextDisabled('No matching assets.');
  }

  for (const asset of assetList) {
    const isSelected = state.activeAssetId === asset.id;
    const label = `[${asset.kind.toUpperCase()}] ${asset.name} (${formatBytes(asset.sizeBytes)})###asset_${asset.id}`;
    if (ImGui.Selectable(label, isSelected)) {
      state.activeAssetId = asset.id;
      playSynthBeep(600, 0.02);
    }
  }
  ImGui.EndChild();

  ImGui.SameLine();

  // Right Side: Selected Asset Inspector & Purposeful Actions
  ImGui.BeginChild('##AssetDetailContainer', new ImVec2(0, 100), ImGuiChildFlags.None);
  const curAsset = state.activeAssetId ? projectAssets.get(state.activeAssetId) : null;

  if (!curAsset) {
    ImGui.TextDisabled('Select an asset to view details and available actions.');
  } else {
    ImGui.TextColored(new ImVec4(1, 0.9, 0.4, 1), `Asset: ${curAsset.name}`);
    ImGui.TextDisabled(`Type: ${curAsset.kind.toUpperCase()} | Size: ${formatBytes(curAsset.sizeBytes)}`);

    if (curAsset.kind === 'image' && curAsset.textureAsset) {
      const tex = curAsset.textureAsset;
      ImGui.Image(tex.texRef, new ImVec2(48, 48));
      ImGui.SameLine();
      ImGui.BeginGroup();
      ImGui.Text(`Dimensions: ${tex.width} x ${tex.height} px`);

      const selectedEntity = state.selectedNodeId ? nodes.get(state.selectedNodeId) : null;
      const spriteComp = selectedEntity?.components.find((c) => c.type === 'SpriteRenderer');
      const canApply = Boolean(selectedEntity && spriteComp);

      ImGui.BeginDisabled(!canApply);
      if (ImGui.SmallButton('Apply to Selected SpriteRenderer')) {
        if (spriteComp && spriteComp.type === 'SpriteRenderer') {
          spriteComp.spriteId = tex.id;
          state.logs.unshift(`Assigned '${curAsset.name}' to '${selectedEntity!.name}'`);
          playSynthBeep(640, 0.04);
        }
      }
      ImGui.EndDisabled();

      ImGui.SameLine();
      if (ImGui.SmallButton('+ Spawn as Entity')) {
        const parentId = state.selectedNodeId || '<root>';
        const parentNode = nodes.get(parentId) || nodes.get('<root>')!;
        const newId = `node_${Date.now()}`;
        const newNode: SceneNode = {
          id: newId,
          name: `${curAsset.name.replace(/\.[^/.]+$/, '')}_${newId.slice(-4)}`,
          enabled: true,
          parentId: parentNode.id,
          children: [],
          baseTransform: { x: 0, y: 0, rotationDeg: 0, scaleX: 1, scaleY: 1 },
          operations: [],
          components: [
            createDefaultTransformComponent(0, 0, 0, 1, 1),
            {
              id: `comp_spr_${Date.now()}`,
              type: 'SpriteRenderer',
              enabled: true,
              spriteId: tex.id,
              color: [1, 1, 1, 1],
              width: tex.width,
              height: tex.height,
              pivotX: 0.5,
              pivotY: 0.5,
              flipX: false,
              flipY: false,
              sortOrder: 10,
            },
          ],
        };
        nodes.set(newId, newNode);
        parentNode.children.push(newId);
        state.selectedNodeId = newId;
        state.logs.unshift(`Spawned entity '${newNode.name}' with sprite '${curAsset.name}'`);
        playSynthBeep(660, 0.04);
      }
      ImGui.EndGroup();
    } else if (curAsset.kind === 'audio' && curAsset.audioBuffer) {
      const buf = curAsset.audioBuffer;
      ImGui.Text(`Duration: ${buf.duration.toFixed(2)} seconds | Sample Rate: ${buf.sampleRate} Hz`);

      if (ImGui.SmallButton('Play Audio Preview')) {
        playAudioBuffer(buf, 0.8);
      }
    } else if (curAsset.kind === 'script' && curAsset.textContent) {
      ImGui.TextDisabled(`${curAsset.textContent.split('\n').length} lines of code`);

      const target = state.selectedNodeId ? nodes.get(state.selectedNodeId) : null;
      ImGui.BeginDisabled(!target);
      if (ImGui.SmallButton('Attach Script to Selected Entity')) {
        if (target) {
          target.components.push({
            id: `comp_scr_${Date.now()}`,
            type: 'Script',
            enabled: true,
            name: curAsset.name,
            sourceCode: curAsset.textContent,
            lastError: null,
          });
          state.logs.unshift(`Attached script '${curAsset.name}' to '${target.name}'`);
          playSynthBeep(640, 0.04);
        }
      }
      ImGui.EndDisabled();
    } else if (curAsset.kind === 'ui' && curAsset.textContent) {
      ImGui.TextDisabled('Declarative JSON UI Layout File');

      const target = state.selectedNodeId ? nodes.get(state.selectedNodeId) : null;
      ImGui.BeginDisabled(!target);
      if (ImGui.SmallButton('Attach UI to Selected Entity')) {
        if (target) {
          target.components.push({
            id: `comp_ui_${Date.now()}`,
            type: 'UIComponent',
            enabled: true,
            name: curAsset.name,
            markupJson: curAsset.textContent,
          });
          state.logs.unshift(`Attached JSON UI '${curAsset.name}' to '${target.name}'`);
          playSynthBeep(640, 0.04);
        }
      }
      ImGui.EndDisabled();

      ImGui.SameLine();
      if (ImGui.SmallButton('Open in UI Designer Tab')) {
        state.activeBottomTab = 'uidesigner';
      }
    } else if (curAsset.kind === 'prefab' && curAsset.jsonData) {
      const template = curAsset.jsonData as SceneNode;
      ImGui.Text(`Template Entity: '${template.name}' with ${template.components.length} components`);

      if (ImGui.SmallButton('Instantiate Prefab into Scene')) {
        const parentId = state.selectedNodeId || '<root>';
        const parentNode = nodes.get(parentId) || nodes.get('<root>')!;
        const newId = `inst_${Date.now()}`;
        const instantiated: SceneNode = JSON.parse(JSON.stringify(template));
        instantiated.id = newId;
        instantiated.name = `${template.name}_Instance`;
        instantiated.parentId = parentNode.id;
        instantiated.children = [];
        const t = getNodeTransform(instantiated);
        if (t) {
          t.x += 15;
          t.y += 15;
        }
        nodes.set(newId, instantiated);
        parentNode.children.push(newId);
        state.selectedNodeId = newId;
        state.logs.unshift(`Instantiated prefab '${curAsset.name}' as '${instantiated.name}'`);
        playSynthBeep(660, 0.04);
      }
    }

    ImGui.Spacing();
    if (ImGui.SmallButton('Export Asset File')) {
      exportAssetToFile(curAsset);
      state.logs.unshift(`Exported asset file '${curAsset.name}'`);
    }
    ImGui.SameLine();

    const isCustom = !curAsset.id.startsWith('tex_');
    ImGui.BeginDisabled(!isCustom);
    if (ImGui.SmallButton('Delete Asset')) {
      projectAssets.delete(curAsset.id);
      state.logs.unshift(`Deleted asset '${curAsset.name}'`);
      state.activeAssetId = null;
      playSynthBeep(320, 0.04);
    }
    ImGui.EndDisabled();
  }

  ImGui.EndChild();
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
