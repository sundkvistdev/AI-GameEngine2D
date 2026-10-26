/**
 * Vortex2D Game Engine - Central UI State & Event Capture System
 * Manages modal stacks, event capturing, docking layout, and UI subscriptions.
 */

export interface DialogAction {
  label: string;
  onClick: () => void;
  isDanger?: boolean;
  isDisabled?: boolean;
}

export interface DialogOptions {
  id: string;
  title: string;
  defaultWidth?: number;
  defaultHeight?: number;
  minWidth?: number;
  minHeight?: number;
  onContent: () => void;
  affirming?: DialogAction;
  dismissive?: DialogAction;
  onClose: () => void;
}

export interface UIDockLayout {
  leftWidth: number;
  rightWidth: number;
  bottomHeight: number;
  showLeft: boolean;
  showRight: boolean;
  showBottom: boolean;
}

export class UIStateManager {
  private activeModals = new Set<string>();

  // Window / Modal Visibility
  public showComponentGallery = false;
  public galleryTargetNodeId: string | null = null;
  public showImportSceneDialog = false;
  public showUIDesigner = false;
  public showDeleteConfirm = false;
  public deleteTargetNodeId: string | null = null;

  // Docking layout configuration
  public dockLayout: UIDockLayout = {
    leftWidth: 250,
    rightWidth: 340,
    bottomHeight: 180,
    showLeft: true,
    showRight: true,
    showBottom: true,
  };

  // Event capturing
  public isHoveringAnyDialog = false;

  public registerModalOpen(modalId: string): void {
    this.activeModals.add(modalId);
  }

  public registerModalClose(modalId: string): void {
    this.activeModals.delete(modalId);
  }

  public isAnyModalActive(): boolean {
    return (
      this.activeModals.size > 0 ||
      this.showComponentGallery ||
      this.showImportSceneDialog ||
      this.showUIDesigner ||
      this.showDeleteConfirm
    );
  }

  public shouldBlockViewportEvents(): boolean {
    return this.isAnyModalActive() || this.isHoveringAnyDialog;
  }
}

export const uiState = new UIStateManager();
