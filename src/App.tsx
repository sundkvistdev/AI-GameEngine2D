/**
 * Vortex2D Game Engine - Main Application Entry
 * 2D Game Engine & Editor with Dear ImGui on WebGPU with WebGL/WebGL2 Fallback.
 * Default minimal styling: crisp zero-rounding, standard compact padding, clutter-free.
 * Zero emojis across all UI, errors, and logs.
 */

import { useEffect, useRef, useState } from 'react';
import { ImGui, ImGuiImplWeb, ImVec2 } from '@mori2003/jsimgui';
import type { SceneNode, EditorState } from './engine/types.ts';
import { updateSceneMatrices } from './engine/math.ts';
import { createEmptyScene } from './engine/presets.ts';
import { createAllSpriteTextures } from './engine/textures.ts';
import { renderEngineEditor } from './editor/EditorUI.ts';
import { uiState } from './ui/UIState.ts';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    let animId: number;
    let isCancelled = false;

    async function startEngine() {
      const canvas = canvasRef.current;
      if (!canvas) return;

      let backendType: 'webgpu' | 'webgl2' | 'webgl' = 'webgpu';
      let backendLabel = 'WebGPU';
      let gpuDevice: GPUDevice | null = null;
      let gpuContext: GPUCanvasContext | null = null;
      let glContext: WebGL2RenderingContext | WebGLRenderingContext | null = null;

      // 1. Attempt WebGPU first
      if (typeof navigator !== 'undefined' && navigator.gpu) {
        try {
          const adapter = await navigator.gpu.requestAdapter({
            powerPreference: 'high-performance',
          });
          if (adapter) {
            const device = await adapter.requestDevice();
            const ctx = canvas.getContext('webgpu') as GPUCanvasContext | null;
            if (ctx && device) {
              const format = navigator.gpu.getPreferredCanvasFormat();
              ctx.configure({
                device,
                format,
                alphaMode: 'opaque',
              });
              gpuDevice = device;
              gpuContext = ctx;
              backendType = 'webgpu';
              backendLabel = 'WebGPU';
            }
          }
        } catch (err) {
          console.warn('WebGPU initialization failed, falling back to WebGL:', err);
          gpuDevice = null;
          gpuContext = null;
        }
      }

      // 2. Fallback to WebGL2 or WebGL if WebGPU is unavailable
      if (!gpuDevice || !gpuContext) {
        const gl = (canvas.getContext('webgl2') || canvas.getContext('webgl')) as
          | WebGL2RenderingContext
          | WebGLRenderingContext
          | null;

        if (!gl) {
          setInitError('Neither WebGPU nor WebGL is supported by your browser or display driver.');
          return;
        }

        glContext = gl;
        backendType = gl instanceof WebGL2RenderingContext ? 'webgl2' : 'webgl';
        backendLabel = gl instanceof WebGL2RenderingContext ? 'WebGL2 (Fallback)' : 'WebGL (Fallback)';
      }

      try {
        // 1. Initialize Dear ImGui with active backend FIRST so Mod.export is ready
        await ImGuiImplWeb.Init({
          canvas,
          device: gpuDevice || undefined,
          backend: backendType,
        });

        // 2. Generate procedural sprite textures for active backend & register with ImGui
        const textureMap = await createAllSpriteTextures(gpuDevice, glContext);

        // 3. Classical, minimal, zero-rounding default Dear ImGui theme
        ImGui.StyleColorsDark();
        const style = ImGui.GetStyle();
        style.WindowRounding = 0.0;
        style.ChildRounding = 0.0;
        style.FrameRounding = 0.0;
        style.PopupRounding = 0.0;
        style.ScrollbarRounding = 0.0;
        style.GrabRounding = 0.0;
        style.TabRounding = 0.0;
        style.WindowBorderSize = 1.0;
        style.FrameBorderSize = 0.0;
        style.WindowPadding = new ImVec2(6, 6);
        style.FramePadding = new ImVec2(5, 3);
        style.ItemSpacing = new ImVec2(6, 4);
        style.ItemInnerSpacing = new ImVec2(4, 4);

        // 4. Initial Scene & Editor State (Starts 100% blank with <root>)
        let sceneNodes: Map<string, SceneNode> = createEmptyScene();

        const editorState: EditorState = {
          backendName: backendLabel,
          selectedNodeId: '<root>',
          isPlaying: false,
          simulationTime: 0,
          gizmoMode: 'TRANSLATE',
          gridSnap: true,
          snapSize: 16,
          camera: { x: 0, y: 0, zoom: 1.0 },
          dockLayout: uiState.dockLayout,
          activePresetName: 'Blank Scene',
          showDemoWindow: false,
          showTransformGuide: false,
          showProfiler: false,
          showAssetPalette: true,
          showImportDialog: false,
          showComponentGallery: false,
          showUIDesigner: false,
          galleryTargetNodeId: null,
          galleryFilterText: '',
          activeAssetId: null,
          activeAssetTab: 'all',
          activeBottomTab: 'assets',
          logs: [
            `Vortex2D Engine Ready [${backendLabel}]`,
            'Scene initialized blank with <root> node',
            'Select an entity and click [+ Add Component] to add components from the gallery',
          ],
          fps: 60,
          frameTimeMs: 16.6,
        };

        const handleResetScene = (newNodes: Map<string, SceneNode>, presetName: string) => {
          sceneNodes = newNodes;
          editorState.activePresetName = presetName;
          editorState.selectedNodeId = '<root>';
        };

        // Keyboard hotkeys
        const onKeyDown = (e: KeyboardEvent) => {
          if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

          if (e.key === ' ' || e.code === 'Space') {
            e.preventDefault();
            editorState.isPlaying = !editorState.isPlaying;
            editorState.logs.unshift(editorState.isPlaying ? 'Simulation started' : 'Simulation paused');
          } else if (e.key === 'w' || e.key === 'W') {
            editorState.gizmoMode = 'TRANSLATE';
          } else if (e.key === 'e' || e.key === 'E') {
            editorState.gizmoMode = 'ROTATE';
          } else if (e.key === 'r' || e.key === 'R') {
            editorState.gizmoMode = 'SCALE';
          } else if (e.key === 'Home') {
            editorState.camera.x = 0;
            editorState.camera.y = 0;
            editorState.camera.zoom = 1.0;
          }
        };
        window.addEventListener('keydown', onKeyDown);

        let lastTime = performance.now();
        let frameCounter = 0;
        let lastFpsUpdate = performance.now();

        // 5. Main Render Loop
        const renderLoop = (now: number) => {
          if (isCancelled) return;

          const dt = Math.min(0.1, (now - lastTime) / 1000);
          lastTime = now;

          if (editorState.isPlaying) {
            editorState.simulationTime += dt;
          }

          // Compute FPS
          frameCounter++;
          if (now - lastFpsUpdate >= 400) {
            editorState.fps = (frameCounter * 1000) / (now - lastFpsUpdate);
            editorState.frameTimeMs = 1000 / Math.max(1, editorState.fps);
            frameCounter = 0;
            lastFpsUpdate = now;
          }

          // Evaluate scene transforms, scripts, and components strictly in order of appearance
          updateSceneMatrices(
            sceneNodes,
            '<root>',
            editorState.simulationTime,
            dt,
            editorState.isPlaying
          );

          // Resize canvas for display pixel ratio
          const dpr = window.devicePixelRatio || 1;
          const displayW = Math.floor(canvas.clientWidth * dpr);
          const displayH = Math.floor(canvas.clientHeight * dpr);
          if (canvas.width !== displayW || canvas.height !== displayH) {
            canvas.width = displayW;
            canvas.height = displayH;
          }

          // Render using active backend
          if (backendType === 'webgpu' && gpuDevice && gpuContext) {
            const commandEncoder = gpuDevice.createCommandEncoder();
            const currentTexture = gpuContext.getCurrentTexture();
            const textureView = currentTexture.createView();

            const renderPass = commandEncoder.beginRenderPass({
              colorAttachments: [
                {
                  view: textureView,
                  clearValue: { r: 0.08, g: 0.09, b: 0.12, a: 1.0 },
                  loadOp: 'clear',
                  storeOp: 'store',
                },
              ],
            });

            ImGuiImplWeb.BeginRender();
            renderEngineEditor(
              sceneNodes,
              editorState,
              textureMap,
              canvas.clientWidth,
              canvas.clientHeight,
              gpuDevice,
              glContext,
              handleResetScene
            );
            ImGuiImplWeb.EndRender(renderPass);

            renderPass.end();
            gpuDevice.queue.submit([commandEncoder.finish()]);
          } else if (glContext) {
            // WebGL / WebGL2 Fallback rendering
            glContext.viewport(0, 0, canvas.width, canvas.height);
            glContext.clearColor(0.08, 0.09, 0.12, 1.0);
            glContext.clear(glContext.COLOR_BUFFER_BIT);

            ImGuiImplWeb.BeginRender();
            renderEngineEditor(
              sceneNodes,
              editorState,
              textureMap,
              canvas.clientWidth,
              canvas.clientHeight,
              gpuDevice,
              glContext,
              handleResetScene
            );
            ImGuiImplWeb.EndRender(); // Pass-less for WebGL
          }

          animId = requestAnimationFrame(renderLoop);
        };

        animId = requestAnimationFrame(renderLoop);

        return () => {
          window.removeEventListener('keydown', onKeyDown);
        };
      } catch (err: any) {
        console.error('Engine initialization error:', err);
        setInitError(err?.message || String(err));
      }
    }

    startEngine();

    return () => {
      isCancelled = true;
      if (animId) cancelAnimationFrame(animId);
    };
  }, []);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#0e1017] select-none">
      {/* The single base canvas: All UI and scene graphics rendered inside Dear ImGui */}
      <canvas
        ref={canvasRef}
        id="engine-canvas"
        className="w-full h-full block touch-none outline-none"
        tabIndex={0}
      />

      {/* Critical error notice only if both WebGPU and WebGL failed */}
      {initError && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-6 bg-black/90">
          <div className="max-w-xl p-6 bg-[#161822] border border-red-500 rounded text-white font-mono text-center space-y-4">
            <h2 className="text-xl font-bold tracking-tight text-red-400">
              [Graphics Backend Error]
            </h2>
            <div className="p-3 bg-red-950/60 border border-red-500/50 text-left text-sm text-red-200 font-mono">
              <p>{initError}</p>
            </div>
            <p className="text-xs text-zinc-400">
              Please check your browser hardware acceleration settings or graphics drivers.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
