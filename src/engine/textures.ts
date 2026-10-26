/**
 * Vortex2D Game Engine - Procedural WebGPU Sprite Textures
 * Creates pristine, high-resolution 2D textures directly in WebGPU memory and registers them with ImGui.
 */

import { ImGuiImplWeb } from '@mori2003/jsimgui';
import type { SpriteId, TextureAsset } from './types.ts';

export async function createAllSpriteTextures(
  device?: GPUDevice | null,
  gl?: WebGL2RenderingContext | WebGLRenderingContext | null
): Promise<Map<SpriteId, TextureAsset>> {
  const textureMap = new Map<SpriteId, TextureAsset>();

  const spriteGenerators: Record<SpriteId, { name: string; draw: (ctx: CanvasRenderingContext2D, size: number) => void }> = {
    spaceship: {
      name: 'Spaceship Interceptor',
      draw: (ctx, s) => {
        const c = s / 2;
        // Glow backdrop
        const glow = ctx.createRadialGradient(c, c, 5, c, c, s * 0.45);
        glow.addColorStop(0, 'rgba(56, 189, 248, 0.4)');
        glow.addColorStop(1, 'rgba(56, 189, 248, 0)');
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, s, s);

        // Main hull (pointing UP at 0 deg)
        ctx.save();
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 10;

        // Wings
        ctx.beginPath();
        ctx.moveTo(c, s * 0.12); // nose tip
        ctx.lineTo(s * 0.88, s * 0.78); // right wing tip
        ctx.lineTo(s * 0.72, s * 0.72); // right inner
        ctx.lineTo(s * 0.65, s * 0.88); // right thruster
        ctx.lineTo(c, s * 0.75); // center tail
        ctx.lineTo(s * 0.35, s * 0.88); // left thruster
        ctx.lineTo(s * 0.28, s * 0.72); // left inner
        ctx.lineTo(s * 0.12, s * 0.78); // left wing tip
        ctx.closePath();

        const grad = ctx.createLinearGradient(0, s * 0.1, 0, s * 0.9);
        grad.addColorStop(0, '#f8fafc');
        grad.addColorStop(0.4, '#94a3b8');
        grad.addColorStop(1, '#334155');
        ctx.fillStyle = grad;
        ctx.fill();

        ctx.strokeStyle = '#0284c7';
        ctx.lineWidth = 3;
        ctx.stroke();

        // Cockpit canopy
        ctx.beginPath();
        ctx.ellipse(c, s * 0.42, s * 0.1, s * 0.18, 0, 0, Math.PI * 2);
        const glass = ctx.createLinearGradient(0, s * 0.24, 0, s * 0.6);
        glass.addColorStop(0, '#38bdf8');
        glass.addColorStop(0.5, '#0284c7');
        glass.addColorStop(1, '#082f49');
        ctx.fillStyle = glass;
        ctx.fill();
        ctx.strokeStyle = '#e0f2fe';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Blaster barrels
        ctx.fillStyle = '#0ea5e9';
        ctx.fillRect(s * 0.18, s * 0.65, 4, s * 0.2);
        ctx.fillRect(s * 0.79, s * 0.65, 4, s * 0.2);

        // Thruster flame
        ctx.beginPath();
        ctx.moveTo(c - 8, s * 0.75);
        ctx.lineTo(c + 8, s * 0.75);
        ctx.lineTo(c, s * 0.96);
        ctx.closePath();
        const flameGrad = ctx.createLinearGradient(c, s * 0.75, c, s * 0.96);
        flameGrad.addColorStop(0, '#ffffff');
        flameGrad.addColorStop(0.3, '#38bdf8');
        flameGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = flameGrad;
        ctx.fill();

        ctx.restore();
      },
    },

    knight: {
      name: 'Pixel Knight',
      draw: (ctx, s) => {
        const c = s / 2;
        // Cape
        ctx.fillStyle = '#dc2626';
        ctx.beginPath();
        ctx.moveTo(c - 16, s * 0.35);
        ctx.lineTo(c + 16, s * 0.35);
        ctx.lineTo(c + 24, s * 0.85);
        ctx.lineTo(c - 24, s * 0.85);
        ctx.closePath();
        ctx.fill();

        // Armor body
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(c - 14, s * 0.36, 28, 36);
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 2;
        ctx.strokeRect(c - 14, s * 0.36, 28, 36);

        // Golden Emblem
        ctx.fillStyle = '#eab308';
        ctx.beginPath();
        ctx.arc(c, s * 0.48, 6, 0, Math.PI * 2);
        ctx.fill();

        // Helmet
        ctx.fillStyle = '#cbd5e1';
        ctx.beginPath();
        ctx.arc(c, s * 0.25, 18, Math.PI, 0);
        ctx.lineTo(c + 18, s * 0.35);
        ctx.lineTo(c - 18, s * 0.35);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Visor slit
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(c - 12, s * 0.24, 24, 5);
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(c - 6, s * 0.25, 4, 3);
        ctx.fillRect(c + 2, s * 0.25, 4, 3);

        // Golden Crest / Horns
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.moveTo(c, s * 0.08);
        ctx.lineTo(c + 6, s * 0.16);
        ctx.lineTo(c - 6, s * 0.16);
        ctx.closePath();
        ctx.fill();

        // Shield
        ctx.fillStyle = '#3b82f6';
        ctx.beginPath();
        ctx.moveTo(c - 28, s * 0.4);
        ctx.lineTo(c - 12, s * 0.4);
        ctx.lineTo(c - 14, s * 0.68);
        ctx.lineTo(c - 20, s * 0.78);
        ctx.lineTo(c - 26, s * 0.68);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();

        // Sword
        ctx.strokeStyle = '#f8fafc';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(c + 22, s * 0.78);
        ctx.lineTo(c + 22, s * 0.15);
        ctx.stroke();
        ctx.fillStyle = '#eab308';
        ctx.fillRect(c + 16, s * 0.6, 12, 4);
      },
    },

    coin: {
      name: 'Gold Coin',
      draw: (ctx, s) => {
        const c = s / 2;
        const r = s * 0.4;
        // Outer rim
        const outerGrad = ctx.createLinearGradient(0, 0, s, s);
        outerGrad.addColorStop(0, '#fef08a');
        outerGrad.addColorStop(0.5, '#eab308');
        outerGrad.addColorStop(1, '#a16207');
        ctx.fillStyle = outerGrad;
        ctx.beginPath();
        ctx.arc(c, c, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#713f12';
        ctx.lineWidth = 3;
        ctx.stroke();

        // Inner ridge
        ctx.beginPath();
        ctx.arc(c, c, r * 0.8, 0, Math.PI * 2);
        ctx.fillStyle = '#facc15';
        ctx.fill();
        ctx.strokeStyle = '#ca8a04';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Star emblem
        ctx.save();
        ctx.translate(c, c);
        ctx.fillStyle = '#713f12';
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          const a = (i * 4 * Math.PI) / 5 - Math.PI / 2;
          const rad = r * 0.48;
          if (i === 0) ctx.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
          else ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        // Specular highlight
        ctx.beginPath();
        ctx.ellipse(c - r * 0.35, c - r * 0.35, r * 0.3, r * 0.15, -Math.PI / 4, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.fill();
      },
    },

    asteroid: {
      name: 'Asteroid Rock',
      draw: (ctx, s) => {
        const c = s / 2;
        const r = s * 0.38;
        ctx.fillStyle = '#64748b';
        ctx.beginPath();
        const points = 10;
        const radii = [0.95, 1.1, 0.85, 1.05, 0.9, 1.15, 0.8, 1.0, 0.9, 1.05];
        for (let i = 0; i < points; i++) {
          const angle = (i * Math.PI * 2) / points;
          const dist = r * radii[i];
          const x = c + Math.cos(angle) * dist;
          const y = c + Math.sin(angle) * dist;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 4;
        ctx.stroke();

        // Craters
        const craters = [
          { x: c - 12, y: c - 10, cr: 10 },
          { x: c + 14, y: c - 8, cr: 8 },
          { x: c + 2, y: c + 15, cr: 12 },
          { x: c - 18, y: c + 12, cr: 6 },
        ];
        for (const cr of craters) {
          ctx.beginPath();
          ctx.arc(cr.x, cr.y, cr.cr, 0, Math.PI * 2);
          ctx.fillStyle = '#475569';
          ctx.fill();
          ctx.strokeStyle = '#1e293b';
          ctx.lineWidth = 2;
          ctx.stroke();
          // Shadow inside crater
          ctx.beginPath();
          ctx.arc(cr.x - 1, cr.y - 1, cr.cr * 0.6, 0, Math.PI * 2);
          ctx.fillStyle = '#334155';
          ctx.fill();
        }
      },
    },

    laser: {
      name: 'Laser Beam',
      draw: (ctx, s) => {
        const c = s / 2;
        // Outer energy aura
        const glow = ctx.createRadialGradient(c, c, 4, c, c, s * 0.4);
        glow.addColorStop(0, 'rgba(239, 68, 68, 0.9)');
        glow.addColorStop(0.5, 'rgba(244, 63, 94, 0.4)');
        glow.addColorStop(1, 'rgba(244, 63, 94, 0)');
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, s, s);

        // Core bolt
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(c, c, 7, s * 0.42, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 4;
        ctx.stroke();

        // Spark rings
        ctx.strokeStyle = '#fca5a5';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(c, s * 0.25, 12, 0, Math.PI * 2);
        ctx.arc(c, s * 0.75, 12, 0, Math.PI * 2);
        ctx.stroke();
      },
    },

    shield: {
      name: 'Hex Shield',
      draw: (ctx, s) => {
        const c = s / 2;
        const r = s * 0.4;
        // Outer glow
        const glow = ctx.createRadialGradient(c, c, r * 0.5, c, c, r * 1.15);
        glow.addColorStop(0, 'rgba(6, 182, 212, 0.4)');
        glow.addColorStop(0.8, 'rgba(6, 182, 212, 0.8)');
        glow.addColorStop(1, 'rgba(6, 182, 212, 0)');
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, s, s);

        // Hexagon ring
        ctx.strokeStyle = '#a5f3fc';
        ctx.lineWidth = 3;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (i * Math.PI) / 3;
          const x = c + Math.cos(a) * r;
          const y = c + Math.sin(a) * r;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fillStyle = 'rgba(6, 182, 212, 0.25)';
        ctx.fill();
        ctx.stroke();

        // Inner Hex lines
        for (let i = 0; i < 6; i++) {
          const a = (i * Math.PI) / 3;
          ctx.beginPath();
          ctx.moveTo(c, c);
          ctx.lineTo(c + Math.cos(a) * r, c + Math.sin(a) * r);
          ctx.stroke();
        }
      },
    },

    flame: {
      name: 'Thruster Flame',
      draw: (ctx, s) => {
        const c = s / 2;
        // Outer red flame
        ctx.beginPath();
        ctx.moveTo(c - 16, s * 0.2);
        ctx.bezierCurveTo(c - 28, s * 0.5, c - 24, s * 0.8, c, s * 0.95);
        ctx.bezierCurveTo(c + 24, s * 0.8, c + 28, s * 0.5, c + 16, s * 0.2);
        ctx.closePath();
        ctx.fillStyle = '#dc2626';
        ctx.fill();

        // Orange mid flame
        ctx.beginPath();
        ctx.moveTo(c - 10, s * 0.25);
        ctx.bezierCurveTo(c - 18, s * 0.5, c - 14, s * 0.75, c, s * 0.88);
        ctx.bezierCurveTo(c + 14, s * 0.75, c + 18, s * 0.5, c + 10, s * 0.25);
        ctx.closePath();
        ctx.fillStyle = '#ea580c';
        ctx.fill();

        // Yellow inner flame
        ctx.beginPath();
        ctx.moveTo(c - 6, s * 0.3);
        ctx.bezierCurveTo(c - 10, s * 0.5, c - 6, s * 0.68, c, s * 0.78);
        ctx.bezierCurveTo(c + 6, s * 0.68, c + 10, s * 0.5, c + 6, s * 0.3);
        ctx.closePath();
        ctx.fillStyle = '#fde047';
        ctx.fill();

        // White core
        ctx.beginPath();
        ctx.ellipse(c, s * 0.38, 4, 10, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
      },
    },

    gem: {
      name: 'Crystal Gem',
      draw: (ctx, s) => {
        const c = s / 2;
        // Faceted diamond shape
        ctx.save();
        ctx.shadowColor = '#c084fc';
        ctx.shadowBlur = 12;

        ctx.beginPath();
        ctx.moveTo(c, s * 0.85); // bottom tip
        ctx.lineTo(s * 0.85, s * 0.4); // right corner
        ctx.lineTo(s * 0.72, s * 0.2); // top right
        ctx.lineTo(s * 0.28, s * 0.2); // top left
        ctx.lineTo(s * 0.15, s * 0.4); // left corner
        ctx.closePath();

        const grad = ctx.createLinearGradient(0, s * 0.2, 0, s * 0.85);
        grad.addColorStop(0, '#f3e8ff');
        grad.addColorStop(0.5, '#a855f7');
        grad.addColorStop(1, '#6b21a8');
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.strokeStyle = '#e9d5ff';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Facet lines
        ctx.beginPath();
        ctx.moveTo(s * 0.28, s * 0.2);
        ctx.lineTo(c, s * 0.4);
        ctx.lineTo(s * 0.72, s * 0.2);

        ctx.moveTo(s * 0.15, s * 0.4);
        ctx.lineTo(c, s * 0.4);
        ctx.lineTo(s * 0.85, s * 0.4);

        ctx.moveTo(c, s * 0.4);
        ctx.lineTo(c, s * 0.85);
        ctx.stroke();

        ctx.restore();
      },
    },

    alien: {
      name: 'Alien UFO',
      draw: (ctx, s) => {
        const c = s / 2;
        // Cockpit glass
        ctx.beginPath();
        ctx.arc(c, s * 0.4, 20, Math.PI, 0);
        ctx.fillStyle = 'rgba(56, 189, 248, 0.7)';
        ctx.fill();
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Alien eye inside
        ctx.fillStyle = '#22c55e';
        ctx.beginPath();
        ctx.arc(c, s * 0.35, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(c, s * 0.35, 3, 0, Math.PI * 2);
        ctx.fill();

        // Flying Saucer hull
        ctx.beginPath();
        ctx.ellipse(c, s * 0.52, s * 0.42, s * 0.16, 0, 0, Math.PI * 2);
        const hullGrad = ctx.createLinearGradient(0, s * 0.36, 0, s * 0.68);
        hullGrad.addColorStop(0, '#94a3b8');
        hullGrad.addColorStop(0.5, '#475569');
        hullGrad.addColorStop(1, '#1e293b');
        ctx.fillStyle = hullGrad;
        ctx.fill();
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // Hull lights
        const lightColors = ['#eab308', '#22c55e', '#ef4444', '#3b82f6'];
        for (let i = 0; i < 4; i++) {
          const lx = c - 30 + i * 20;
          ctx.beginPath();
          ctx.arc(lx, s * 0.54, 3.5, 0, Math.PI * 2);
          ctx.fillStyle = lightColors[i];
          ctx.fill();
        }
      },
    },

    platform: {
      name: 'Sci-Fi Girder Platform',
      draw: (ctx, s) => {
        const c = s / 2;
        const w = s * 0.85;
        const h = s * 0.35;
        const x = c - w / 2;
        const y = c - h / 2;

        // Girder body
        ctx.fillStyle = '#334155';
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = 3;
        ctx.strokeRect(x, y, w, h);

        // Hazard stripes on top
        ctx.save();
        ctx.beginPath();
        ctx.rect(x + 2, y + 2, w - 4, 12);
        ctx.clip();
        for (let sx = -s; sx < s * 2; sx += 14) {
          ctx.fillStyle = '#facc15';
          ctx.fillRect(sx, y, 7, 16);
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(sx + 7, y, 7, 16);
        }
        ctx.restore();

        // Rivets
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(x + 6, y + h - 8, 4, 4);
        ctx.fillRect(x + w - 10, y + h - 8, 4, 4);
        ctx.fillRect(c - 2, y + h - 8, 4, 4);
      },
    },

    star: {
      name: 'Radiant Star',
      draw: (ctx, s) => {
        const c = s / 2;
        // Radial aura
        const glow = ctx.createRadialGradient(c, c, 2, c, c, s * 0.45);
        glow.addColorStop(0, 'rgba(253, 224, 71, 0.9)');
        glow.addColorStop(0.3, 'rgba(234, 179, 8, 0.4)');
        glow.addColorStop(1, 'rgba(234, 179, 8, 0)');
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, s, s);

        // 8-pointed star
        ctx.save();
        ctx.translate(c, c);
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const a = (i * Math.PI) / 4;
          const rOuter = (i % 2 === 0) ? s * 0.42 : s * 0.18;
          const x = Math.cos(a) * rOuter;
          const y = Math.sin(a) * rOuter;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();
      },
    },
  };

  const size = 128;
  const offscreen = document.createElement('canvas');
  offscreen.width = size;
  offscreen.height = size;
  const ctx = offscreen.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Could not create 2D canvas context for sprite generation');

  for (const [key, spriteInfo] of Object.entries(spriteGenerators) as [SpriteId, any][]) {
    ctx.clearRect(0, 0, size, size);
    spriteInfo.draw(ctx, size);

    const imgData = ctx.getImageData(0, 0, size, size);
    if (device) {
      const gpuTexture = device.createTexture({
        size: [size, size, 1],
        format: 'rgba8unorm',
        usage: 0x04 | 0x02, // GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST
      });

      device.queue.writeTexture(
        { texture: gpuTexture },
        imgData.data,
        { bytesPerRow: size * 4, rowsPerImage: size },
        [size, size, 1]
      );

      const texRef = ImGuiImplWeb.RegisterTexture(gpuTexture);

      textureMap.set(key, {
        id: key,
        name: spriteInfo.name,
        width: size,
        height: size,
        gpuTexture,
        texRef,
      });
    } else if (gl) {
      const glTexture = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, glTexture);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        size,
        size,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        imgData.data
      );
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

      const texRef = ImGuiImplWeb.RegisterTexture(glTexture);

      textureMap.set(key, {
        id: key,
        name: spriteInfo.name,
        width: size,
        height: size,
        glTexture,
        texRef,
      });
    }
  }

  return textureMap;
}

/**
 * Registers an uploaded or custom generated image as an ImGui texture
 */
export function registerCustomImageTexture(
  id: string,
  name: string,
  source: HTMLImageElement | HTMLCanvasElement | ImageBitmap,
  device?: GPUDevice | null,
  gl?: WebGL2RenderingContext | WebGLRenderingContext | null
): TextureAsset {
  const width = 'naturalWidth' in source ? (source.naturalWidth || source.width) : source.width;
  const height = 'naturalHeight' in source ? (source.naturalHeight || source.height) : source.height;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(source, 0, 0);
  const imgData = ctx.getImageData(0, 0, width, height);

  if (device) {
    const gpuTexture = device.createTexture({
      size: [width, height, 1],
      format: 'rgba8unorm',
      usage: 0x04 | 0x02, // TEXTURE_BINDING | COPY_DST
    });

    device.queue.writeTexture(
      { texture: gpuTexture },
      imgData.data,
      { bytesPerRow: width * 4, rowsPerImage: height },
      [width, height, 1]
    );

    const texRef = ImGuiImplWeb.RegisterTexture(gpuTexture);
    return {
      id,
      name,
      width,
      height,
      gpuTexture,
      texRef,
    };
  } else if (gl) {
    const glTexture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, glTexture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      width,
      height,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      imgData.data
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    const texRef = ImGuiImplWeb.RegisterTexture(glTexture);
    return {
      id,
      name,
      width,
      height,
      glTexture,
      texRef,
    };
  } else {
    throw new Error('No active GPU or WebGL context for texture registration');
  }
}

