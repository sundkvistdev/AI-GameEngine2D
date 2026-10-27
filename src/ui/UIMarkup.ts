/**
 * Vortex2D Game Engine - JSON UI Markup System & In-Engine Designer
 * Declarative JSON format for building HUDs, panels, menus, and game dialogs.
 * Supports anchoring, layout, styling, action dispatching, and live editing.
 */

import {
  ImGui,
  ImGuiChildFlags,
  ImGuiWindowFlags,
  ImVec2,
  ImVec4,
} from '@mori2003/jsimgui';

export type UIElementType =
  | 'container'
  | 'row'
  | 'column'
  | 'text'
  | 'button'
  | 'checkbox'
  | 'slider'
  | 'progressBar'
  | 'input'
  | 'separator';

export type UIAnchor =
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'
  | 'center'
  | 'stretch';

export interface UIElementNode {
  id: string;
  type: UIElementType;
  anchor?: UIAnchor;
  layout?: 'vertical' | 'horizontal';
  width?: number;
  height?: number;
  text?: string;
  label?: string;
  value?: number | boolean | string;
  min?: number;
  max?: number;
  color?: [number, number, number, number];
  actionId?: string;
  children?: UIElementNode[];
}

export interface UIRuntimeContext {
  stateValues: Record<string, any>;
  dispatchAction: (actionId: string, node: UIElementNode) => void;
}

export const SAMPLE_UI_SCHEMAS: Record<string, string> = {
  'Game HUD': JSON.stringify(
    {
      id: 'hud_root',
      type: 'container',
      anchor: 'top-left',
      width: 260,
      children: [
        {
          id: 'title_txt',
          type: 'text',
          text: 'VORTEX PILOT HUD',
          color: [0.3, 0.8, 1, 1],
        },
        { id: 'sep_1', type: 'separator' },
        {
          id: 'score_txt',
          type: 'text',
          text: 'SCORE: 25,400',
          color: [1, 0.9, 0.2, 1],
        },
        {
          id: 'hp_bar',
          type: 'progressBar',
          label: 'HULL INTEGRITY',
          value: 0.78,
          color: [0.2, 0.9, 0.4, 1],
        },
        {
          id: 'shield_bar',
          type: 'progressBar',
          label: 'PLASMA SHIELD',
          value: 0.52,
          color: [0.2, 0.6, 1, 1],
        },
        { id: 'sep_2', type: 'separator' },
        {
          id: 'btn_warp',
          type: 'button',
          label: 'ACTIVATE WARP BOOST',
          actionId: 'ACTION_WARP',
        },
      ],
    },
    null,
    2
  ),
  'Settings Panel': JSON.stringify(
    {
      id: 'settings_root',
      type: 'container',
      anchor: 'center',
      width: 320,
      children: [
        {
          id: 'settings_title',
          type: 'text',
          text: 'AUDIO & GRAPHICS SETTINGS',
          color: [1, 1, 1, 1],
        },
        { id: 'sep_s1', type: 'separator' },
        {
          id: 'chk_sfx',
          type: 'checkbox',
          label: 'Enable Synthesizer SFX',
          value: true,
          actionId: 'TOGGLE_SFX',
        },
        {
          id: 'vol_slider',
          type: 'slider',
          label: 'Master Volume',
          value: 80,
          min: 0,
          max: 100,
          actionId: 'SET_VOLUME',
        },
        {
          id: 'chk_grid',
          type: 'checkbox',
          label: 'Display Viewport Coordinate Grid',
          value: true,
          actionId: 'TOGGLE_GRID',
        },
        { id: 'sep_s2', type: 'separator' },
        {
          id: 'btn_apply_cfg',
          type: 'button',
          label: 'Save Configuration',
          actionId: 'SAVE_CONFIG',
        },
      ],
    },
    null,
    2
  ),
  'Inventory Panel': JSON.stringify(
    {
      id: 'inventory_root',
      type: 'container',
      anchor: 'top-right',
      width: 240,
      children: [
        {
          id: 'inv_title',
          type: 'text',
          text: 'CARGO INVENTORY',
          color: [0.9, 0.7, 0.3, 1],
        },
        { id: 'sep_i1', type: 'separator' },
        { id: 'item_1', type: 'text', text: 'Plasma Fuel: 140 Cells' },
        { id: 'item_2', type: 'text', text: 'Shield Capacitors: 4 Units' },
        { id: 'item_3', type: 'text', text: 'Nanite Repair Kits: 2' },
        { id: 'sep_i2', type: 'separator' },
        {
          id: 'btn_repair',
          type: 'button',
          label: 'Use Repair Kit',
          actionId: 'USE_REPAIR',
        },
      ],
    },
    null,
    2
  ),
};

/**
 * Renders an arbitrary JSON UI element tree into Dear ImGui
 */
export function renderUIMarkup(
  node: UIElementNode,
  context: UIRuntimeContext
): void {
  ImGui.PushID(`ui_elem_${node.id}`);

  switch (node.type) {
    case 'container':
    case 'column': {
      if (node.width) {
        ImGui.BeginChild(`##box_${node.id}`, new ImVec2(node.width, node.height || 0), ImGuiChildFlags.Borders);
      }
      if (node.children) {
        for (const child of node.children) {
          renderUIMarkup(child, context);
        }
      }
      if (node.width) {
        ImGui.EndChild();
      }
      break;
    }

    case 'row': {
      if (node.children && node.children.length > 0) {
        for (let i = 0; i < node.children.length; i++) {
          if (i > 0) ImGui.SameLine();
          renderUIMarkup(node.children[i], context);
        }
      }
      break;
    }

    case 'text': {
      if (node.color) {
        ImGui.TextColored(
          new ImVec4(node.color[0], node.color[1], node.color[2], node.color[3]),
          node.text || ''
        );
      } else {
        ImGui.Text(node.text || '');
      }
      break;
    }

    case 'separator': {
      ImGui.Separator();
      break;
    }

    case 'button': {
      const btnLabel = node.label || 'Button';
      const w = node.width ? node.width : 0;
      if (ImGui.Button(btnLabel, new ImVec2(w, node.height || 22))) {
        if (node.actionId) {
          context.dispatchAction(node.actionId, node);
        }
      }
      break;
    }

    case 'checkbox': {
      const curVal = context.stateValues[node.id] !== undefined
        ? Boolean(context.stateValues[node.id])
        : Boolean(node.value);
      const chkTuple: [boolean] = [curVal];
      if (ImGui.Checkbox(node.label || '', chkTuple)) {
        context.stateValues[node.id] = chkTuple[0];
        if (node.actionId) {
          context.dispatchAction(node.actionId, node);
        }
      }
      break;
    }

    case 'slider': {
      const minV = node.min ?? 0;
      const maxV = node.max ?? 100;
      const curV = context.stateValues[node.id] !== undefined
        ? Number(context.stateValues[node.id])
        : Number(node.value || 0);
      const valTuple: [number] = [curV];
      if (ImGui.SliderFloat(node.label || '', valTuple, minV, maxV, '%.0f')) {
        context.stateValues[node.id] = valTuple[0];
        if (node.actionId) {
          context.dispatchAction(node.actionId, node);
        }
      }
      break;
    }

    case 'progressBar': {
      const frac = typeof node.value === 'number' ? node.value : 0.5;
      const overlayText = node.label ? `${node.label} (${Math.round(frac * 100)}%)` : '';
      ImGui.ProgressBar(frac, new ImVec2(node.width || -1, node.height || 16), overlayText);
      break;
    }

    case 'input': {
      const curStr = context.stateValues[node.id] !== undefined
        ? String(context.stateValues[node.id])
        : String(node.value || '');
      const strTuple: [string] = [curStr];
      if (ImGui.InputText(node.label || '', strTuple, 128)) {
        context.stateValues[node.id] = strTuple[0];
        if (node.actionId) {
          context.dispatchAction(node.actionId, node);
        }
      }
      break;
    }
  }

  ImGui.PopID();
}
