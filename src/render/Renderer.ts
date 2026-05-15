import * as twgl from "twgl.js";
import { fullscreenVert } from "../shaders/fullscreen.vert";
import { commonGlsl } from "../shaders/common";
import type { ShaderPreset, ParamValues, UniformValues } from "../presets/types";
import type { Palette } from "../color/palette";

function buildFragment(presetSource: string): string {
  return `#version 300 es\n${commonGlsl}\nin vec2 v_uv;\nout vec4 fragColor;\n${presetSource}`;
}

function buildForeground(presetSource: string): string {
  return `#version 300 es\nprecision mediump float;\nin vec2 v_uv;\n${presetSource}`;
}

interface ProgramCache {
  presetId: string;
  programInfo: twgl.ProgramInfo;
}

export class Renderer {
  readonly gl: WebGL2RenderingContext;
  private programCache: ProgramCache | null = null;
  private bgProgramCache: ProgramCache | null = null;
  private fgProgramCache: ProgramCache | null = null;
  private vao: WebGLVertexArrayObject | null = null;
  private fbo: WebGLFramebuffer | null = null;
  private fboTex: WebGLTexture | null = null;
  private fboSize: [number, number] = [0, 0];

  constructor(canvas: HTMLCanvasElement | OffscreenCanvas, options: { preserveDrawingBuffer?: boolean } = {}) {
    const gl = (canvas as HTMLCanvasElement).getContext("webgl2", {
      antialias: false,
      alpha: false,
      preserveDrawingBuffer: options.preserveDrawingBuffer ?? false,
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

  private getBgProgram(preset: ShaderPreset): twgl.ProgramInfo {
    if (this.bgProgramCache?.presetId === preset.id) {
      return this.bgProgramCache.programInfo;
    }
    if (this.bgProgramCache) {
      this.gl.deleteProgram(this.bgProgramCache.programInfo.program);
    }
    const programInfo = twgl.createProgramInfo(this.gl, [
      fullscreenVert,
      buildFragment(preset.fragmentShader),
    ]);
    this.bgProgramCache = { presetId: preset.id, programInfo };
    return programInfo;
  }

  private getFgProgram(id: string, shader: string): twgl.ProgramInfo {
    if (this.fgProgramCache?.presetId === id) {
      return this.fgProgramCache.programInfo;
    }
    if (this.fgProgramCache) {
      this.gl.deleteProgram(this.fgProgramCache.programInfo.program);
    }
    const programInfo = twgl.createProgramInfo(this.gl, [
      fullscreenVert,
      buildForeground(shader),
    ]);
    this.fgProgramCache = { presetId: id, programInfo };
    return programInfo;
  }

  private ensureFBO(width: number, height: number): WebGLTexture {
    const gl = this.gl;
    if (this.fboTex && this.fboSize[0] === width && this.fboSize[1] === height) {
      return this.fboTex;
    }
    if (this.fbo) gl.deleteFramebuffer(this.fbo);
    if (this.fboTex) gl.deleteTexture(this.fboTex);

    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);

    const fbo = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    this.fbo = fbo;
    this.fboTex = tex;
    this.fboSize = [width, height];
    return tex;
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

  renderComposite(
    bgPreset: ShaderPreset,
    bgUniforms: UniformValues,
    fgId: string,
    fgShader: string,
    fgUniforms: UniformValues,
    t: number,
    width: number,
    height: number
  ): void {
    const gl = this.gl;
    this.resize(width, height);
    const fboTex = this.ensureFBO(width, height);

    // Pass 1: render background to FBO
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.viewport(0, 0, width, height);
    const bgProg = this.getBgProgram(bgPreset);
    gl.useProgram(bgProg.program);
    twgl.setUniforms(bgProg, {
      u_t: t,
      u_resolution: [width, height],
      u_aspect: width / height,
      ...bgUniforms,
    });
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // Pass 2: render foreground to canvas
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, width, height);
    const fgProg = this.getFgProgram(fgId, fgShader);
    gl.useProgram(fgProg.program);
    twgl.setUniforms(fgProg, {
      ...fgUniforms,
      u_t: t,
      u_resolution: [width, height],
      u_pixelRatio: 1.0,
      u_image: fboTex,
      u_imageAspectRatio: width / height,
    });
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  dispose(): void {
    if (this.programCache) {
      this.gl.deleteProgram(this.programCache.programInfo.program);
      this.programCache = null;
    }
    if (this.bgProgramCache) {
      this.gl.deleteProgram(this.bgProgramCache.programInfo.program);
      this.bgProgramCache = null;
    }
    if (this.fgProgramCache) {
      this.gl.deleteProgram(this.fgProgramCache.programInfo.program);
      this.fgProgramCache = null;
    }
    if (this.fbo) {
      this.gl.deleteFramebuffer(this.fbo);
      this.fbo = null;
    }
    if (this.fboTex) {
      this.gl.deleteTexture(this.fboTex);
      this.fboTex = null;
    }
    if (this.vao) {
      this.gl.deleteVertexArray(this.vao);
      this.vao = null;
    }
  }
}
