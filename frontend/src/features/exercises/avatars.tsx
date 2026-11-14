export type AvatarId = 'man-athletic' | 'woman-casual' | 'wood';
export const avatars = [
  { id: 'man-athletic', name: 'Man · Athletic' },
  { id: 'woman-casual', name: 'Woman · Casual' },
  { id: 'wood', name: 'Mannequin 3D' },
] as const;

export function previewBase(_id?: AvatarId) {
  return '/previews';
}

export function AvatarSelect({
  value,
  onChange,
}: {
  value: AvatarId;
  onChange: (id: AvatarId) => void;
}) {
  return (
    <div className="flex items-center gap-2 text-xs text-slate-300">
      <span className="font-semibold text-emerald-400">3D Avatar:</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as AvatarId)}
        className="bg-slate-900/90 text-slate-100 text-xs px-3 py-1.5 rounded-lg border border-emerald-500/30 focus:border-emerald-400 focus:outline-none cursor-pointer"
      >
        {avatars.map((a) => (
          <option value={a.id} key={a.id} className="bg-slate-900 text-slate-100">
            {a.name}
          </option>
        ))}
      </select>
    </div>
  );
}
