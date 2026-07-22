export default function Card({ children, className = '' }) {
  return <section className={`rounded-2xl border border-sync-border bg-white shadow-premium ${className}`}>{children}</section>;
}
