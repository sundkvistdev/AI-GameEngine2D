/**
 * Vortex2D Game Engine - Standard Resizable Dialog Framework
 * Strict Convention:
 * 1. Dialogs can be resized smoothly by the user.
 * 2. Content area stretches both ways (horizontally & vertically).
 * 3. Bottom action buttons are aligned flush to the RIGHT.
 * 4. Affirming action is on the LEFT of the group, Dismissive action is on the RIGHT.
 *    Example: [Delete] [Cancel] or [Add Component] [Close]
 * 5. Captures mouse events to prevent bleed-through into viewport.
 */

import {
  ImGui,
  ImGuiWindowFlags,
  ImGuiChildFlags,
  ImGuiCol,
  ImGuiCond,
  ImVec2,
} from '@mori2003/jsimgui';
import type { DialogOptions } from './UIState.ts';
import { uiState } from './UIState.ts';

export function renderStandardDialog(opts: DialogOptions): void {
  const displaySize = ImGui.GetIO().DisplaySize;
  const defaultW = opts.defaultWidth || 480;
  const defaultH = opts.defaultHeight || 380;

  // Center on screen on first appearance
  ImGui.SetNextWindowPos(
    new ImVec2((displaySize.x - defaultW) / 2, (displaySize.y - defaultH) / 2),
    ImGuiCond.Appearing
  );
  ImGui.SetNextWindowSize(new ImVec2(defaultW, defaultH), ImGuiCond.Appearing);

  // Set minimum size constraints so dialog remains usable when resized
  const minW = opts.minWidth || 320;
  const minH = opts.minHeight || 200;
  ImGui.SetNextWindowSizeConstraints(
    new ImVec2(minW, minH),
    new ImVec2(displaySize.x * 0.95, displaySize.y * 0.95)
  );

  // Window flags allow resizing! (No NoResize flag)
  const windowFlags = ImGuiWindowFlags.NoCollapse;
  const isOpenPtr: [boolean] = [true];

  if (ImGui.Begin(`${opts.title}###${opts.id}`, isOpenPtr, windowFlags)) {
    // If closed via title-bar close button
    if (!isOpenPtr[0]) {
      opts.onClose();
      ImGui.End();
      return;
    }

    // Event capture tracking: prevent mouse wheel or clicks from leaking into viewport
    if (ImGui.IsWindowHovered()) {
      uiState.isHoveringAnyDialog = true;
    }

    // 1. Content Area (Anchored to stretch BOTH horizontally and vertically down to button bar)
    const buttonBarHeight = 34;
    ImGui.BeginChild(
      `##dlg_content_${opts.id}`,
      new ImVec2(0, -buttonBarHeight),
      ImGuiChildFlags.None
    );

    opts.onContent();

    ImGui.EndChild();

    ImGui.Separator();

    // 2. Bottom Action Bar: Buttons Aligned Flush RIGHT, Affirming LEFT, Dismissive RIGHT
    const btnPadding = 18;
    const affirmLabel = opts.affirming?.label || '';
    const dismissLabel = opts.dismissive?.label || '';

    const wAffirm = opts.affirming ? Math.max(85, affirmLabel.length * 8 + btnPadding) : 0;
    const wDismiss = opts.dismissive ? Math.max(75, dismissLabel.length * 8 + btnPadding) : 0;
    const spacing = 8;
    const totalButtonWidth =
      (opts.affirming ? wAffirm : 0) +
      (opts.dismissive ? wDismiss : 0) +
      (opts.affirming && opts.dismissive ? spacing : 0);

    const availW = ImGui.GetContentRegionAvail().x;
    if (totalButtonWidth > 0 && availW > totalButtonWidth) {
      ImGui.SetCursorPosX(ImGui.GetCursorPosX() + availW - totalButtonWidth);
    }

    // Affirming Action (on the LEFT of the right-aligned button group)
    if (opts.affirming) {
      if (opts.affirming.isDanger) {
        // Red color for destructive affirming actions like [Delete]
        const colNormal = (((255 << 24) | (40 << 16) | (40 << 8) | 180) >>> 0);
        const colHover = (((255 << 24) | (60 << 16) | (60 << 8) | 220) >>> 0);
        const colActive = (((255 << 24) | (80 << 16) | (80 << 8) | 240) >>> 0);
        ImGui.PushStyleColor(ImGuiCol.Button, colNormal);
        ImGui.PushStyleColor(ImGuiCol.ButtonHovered, colHover);
        ImGui.PushStyleColor(ImGuiCol.ButtonActive, colActive);
      }

      ImGui.BeginDisabled(!!opts.affirming.isDisabled);
      if (ImGui.Button(opts.affirming.label, new ImVec2(wAffirm, 24))) {
        opts.affirming.onClick();
      }
      ImGui.EndDisabled();

      if (opts.affirming.isDanger) {
        ImGui.PopStyleColor(3);
      }
    }

    // Dismissive Action (on the RIGHT of the right-aligned button group)
    if (opts.dismissive) {
      if (opts.affirming) {
        ImGui.SameLine();
      }

      ImGui.BeginDisabled(!!opts.dismissive.isDisabled);
      if (ImGui.Button(opts.dismissive.label, new ImVec2(wDismiss, 24))) {
        opts.dismissive.onClick();
      }
      ImGui.EndDisabled();
    }

    ImGui.End();
  }
}
