/// <reference types="vite/client" />

declare module "*.glsl?raw" {
  const src: string;
  export default src;
}
declare module "*.vert?raw" {
  const src: string;
  export default src;
}
declare module "*.frag?raw" {
  const src: string;
  export default src;
}

interface VideoEncoderConfig {
  codec: string;
  width: number;
  height: number;
  bitrate?: number;
  framerate?: number;
  bitrateMode?: "constant" | "variable" | "quantizer";
  hardwareAcceleration?: "no-preference" | "prefer-hardware" | "prefer-software";
  avc?: { format?: "annexb" | "avc" };
}
