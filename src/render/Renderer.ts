import * as twgl from "twgl.js";
import { fullscreenVert } from "../shaders/fullscreen.vert";
import { commonGlsl } from "../shaders/common";
import type { ShaderPreset, ParamValues, UniformValues } from "../presets/types";
import type { Palette } from "../color/palette";

function buildFragment(presetSource: string): string {
  return `#version 300 es\n${commonGlsl}\nin vec2 v_uv;\nout vec4 fragColor;\n${presetSource}`;
}

interface ProgramCache {
  presetId: string;
  programInfo: twgl.ProgramInfo;
}

export class Renderer {
  readonly gl: WebGL2RenderingContext;
  private programCache: ProgramCache | null = null;
  private vao: WebGLVertexArrayObject | null = null;

  constructor(canvas: HTMLCanvasElement | OffscreenCanvas) {
    const gl = (canvas as HTMLCanvasElement).getContext("webgl2", {
      antialias: false,
      alpha: false,
      preserveDrawingBuffer: false,
      premultipliedAlpha: true,
    }) as WebGL2RenderingContext | null;
    if (!gl) throw new Error("WebGL2 not supported");
    this.gl = gl;
    // No buffer needed — we use gl_VertexID-driven fullscreen triangle.
    // We do bind an empty VAO since some drivers require one to draw.
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
  }

  resize(width: number, height: number): void {
    const canvas = this.gl.canvas as HTMLCanvasElement | OffscreenCanvas;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    this.gl.viewport(0, 0, width, height);
  }

  private getProgram(preset: ShaderPreset): twgl.ProgramInfo {
    if (this.programCache && this.programCache.presetId === preset.id) {
      return this.programCache.programInfo;
    }
    if (this.programCache) {
      this.gl.deleteProgram(this.programCache.programInfo.program);
    }
    const programInfo = twgl.createProgramInfo(this.gl, [
      fullscreenVert,
      buildFragment(preset.fragmentShader),
    ]);
    this.programCache = { presetId: preset.id, programInfo };
    return programInfo;
  }

  render(
    preset: ShaderPreset,
    params: ParamValues,
    palette: Palette,
    t: number,
    width: number,
    height: number
  ): void {
    this.resize(width, height);
    const gl = this.gl;
    const prog = this.getProgram(preset);
    gl.useProgram(prog.program);

    const presetUniforms = preset.uniforms(params, palette);
    const uniforms: UniformValues = {
      u_t: t,
      u_resolution: [width, height],
      u_aspect: width / height,
      u_palette_bg: palette.rgb.bg,
      u_palette_primary: palette.rgb.primary,
      u_palette_secondary: palette.rgb.secondary,
      u_palette_shade0: palette.rgb.shades[0],
      u_palette_shade1: palette.rgb.shades[1],
      u_palette_shade2: palette.rgb.shades[2],
      u_palette_shade3: palette.rgb.shades[3],
      u_palette_shade4: palette.rgb.shades[4],
      ...presetUniforms,
    };

    twgl.setUniforms(prog, uniforms);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  dispose(): void {
    if (this.programCache) {
      this.gl.deleteProgram(this.programCache.programInfo.program);
      this.programCache = null;
    }
    if (this.vao) {
      this.gl.deleteVertexArray(this.vao);
      this.vao = null;
    }
  }
}
