export default function Input({ label, error, className = '', ...props }) {
  return <label className="grid gap-1.5 text-sm font-medium text-sync-text">
    {label}<input className={`rounded-xl border border-sync-border bg-white px-3 py-2.5 outline-none transition placeholder:text-slate-400 focus:border-sync-primary focus:ring-4 focus:ring-blue-100 ${className}`} {...props} />
    {error && <span className="text-xs text-red-600">{error}</span>}
  </label>;
}
