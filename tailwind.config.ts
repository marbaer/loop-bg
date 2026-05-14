import type { Config } from "tailwindcss";

const alpha = (rgbVar: string) => `rgb(var(${rgbVar}) / <alpha-value>)`;
const opacityScaled = (rgbVar: string, alphaVar: string) =>
  `rgb(var(${rgbVar}) / calc(var(${alphaVar}) * <alpha-value>))`;

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: ["class", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        surface: alpha("--surface"),
        "surface-raised": alpha("--surface-raised"),
        "surface-popover": alpha("--surface-popover"),
        border: opacityScaled("--border", "--border-alpha"),
        "border-strong": opacityScaled("--border-strong", "--border-strong-alpha"),
        "border-input": opacityScaled("--border-input", "--border-input-alpha"),
        text: alpha("--text"),
        "text-muted": alpha("--text-muted"),
        "text-subtle": alpha("--text-subtle"),
        "overlay-1": opacityScaled("--overlay-base", "--overlay-1-alpha"),
        "overlay-2": opacityScaled("--overlay-base", "--overlay-2-alpha"),
        "overlay-3": opacityScaled("--overlay-base", "--overlay-3-alpha"),
        accent: alpha("--accent"),
        "accent-text": alpha("--accent-text"),
        danger: alpha("--danger"),
      },
      borderColor: {
        DEFAULT: opacityScaled("--border", "--border-alpha"),
      },
      fontFamily: {
        sans: [
          "Lato",
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "sans-serif",
        ],
        headline: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
        mono: [
          "Roboto Mono",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "monospace",
        ],
      },
      fontSize: {
        xs: ["11px", { lineHeight: "15px" }],
        sm: ["13px", { lineHeight: "19px" }],
        base: ["14px", { lineHeight: "21px" }],
        headline: ["18px", { lineHeight: "24px" }],
        display: ["24px", { lineHeight: "32px" }],
      },
      borderRadius: {
        sm: "6px",
        DEFAULT: "8px",
        lg: "12px",
      },
      boxShadow: {
        panel:
          "0 1px 2px 0 rgba(13,14,19,0.02), 0 2px 6px 0 rgba(13,14,19,0.06), 0 0 0 1px rgba(13,14,19,0.04)",
      },
    },
  },
  plugins: [],
} satisfies Config;
