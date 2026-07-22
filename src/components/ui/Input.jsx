export default function Input({ label, error, icon: Icon, className = '', ...props }) {
  return <label className="grid gap-1.5 text-sm font-medium text-sync-text">
    {label}<span className="relative block">{Icon && <Icon className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />}<input className={`w-full rounded-xl border border-sync-border bg-white py-3 outline-none transition placeholder:text-slate-400 focus:border-sync-primary focus:ring-4 focus:ring-blue-100 ${Icon ? 'pl-11 pr-3' : 'px-3'} ${className}`} {...props} /></span>
    {error && <span className="text-xs text-red-600">{error}</span>}
  </label>;
}
