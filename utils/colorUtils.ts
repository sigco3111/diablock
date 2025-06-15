// utils/colorUtils.ts
const tailwindColorMap: Record<string, string> = {
  'bg-green-700': '#15803d', // Adjusted to Tailwind v3 default
  'bg-gray-500': '#6b7280',  // Adjusted to Tailwind v3 default
  'bg-red-700': '#b91c1c', 
  'bg-purple-700': '#7e22ce', // Adjusted to Tailwind v3 default
  'bg-red-900': '#7f1d1d', 
  'bg-emerald-700': '#047857',
  // New Monster Colors from diablockConstants (and their Tailwind v3 hex values)
  'bg-lime-600': '#65a30d',
  'bg-cyan-600': '#0891b2',
  'bg-stone-500': '#78716c',
  'bg-indigo-700': '#4338ca',
  'bg-amber-700': '#b45309',
  'bg-teal-700': '#0f766e',
  'bg-orange-600': '#ea580c',
  'bg-sky-700': '#0369a1',
  'bg-neutral-600': '#525252',
  'bg-rose-700': '#be123c',
  'bg-slate-400': '#94a3b8',
  'bg-red-500': '#ef4444',
  'bg-fuchsia-500': '#d946ef',
  'bg-green-500': '#22c55e',
  // Fallback default color for monsters if their color class is not in the map
  'default': '#CCCCCC' 
};

export const tailwindToHex = (tailwindClass: string | undefined): string => {
  if (!tailwindClass) return tailwindColorMap['default'];
  return tailwindColorMap[tailwindClass] || tailwindColorMap['default'];
};
