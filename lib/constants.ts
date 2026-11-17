export const APP_COLOR_PALETTE = [
  '#2563EB', // Blue
  '#0284C7', // Sky
  '#06B6D4', // Cyan
  '#0D9488', // Teal
  '#10B981', // Emerald
  '#16A34A', // Green
  '#84CC16', // Lime
  '#EAB308', // Yellow
  '#F59E0B', // Amber
  '#F97316', // Orange
  '#EA580C', // Rust
  '#EF4444', // Red
  '#DC2626', // Crimson
  '#E11D48', // Rose
  '#DB2777', // Pink
  '#D946EF', // Fuchsia
  '#A855F7', // Purple
  '#7C3AED', // Violet
  '#6366F1', // Indigo
  '#64748B', // Slate
] as const;

export type AppColor = (typeof APP_COLOR_PALETTE)[number];
