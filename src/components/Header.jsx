import { Link } from 'react-router-dom';
import { Zap } from 'lucide-react';

export default function Header() {
  return <header className="fixed inset-x-0 top-0 z-50 border-b border-sync-border/80 bg-sync-bg/85 backdrop-blur-lg">
    <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
      <Link to="/" className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-lg bg-sync-primary"><Zap className="h-5 w-5 fill-white text-white" /></span><span className="text-xl font-bold tracking-tight">SyncSpace<span className="text-sync-accent">.</span></span></Link>
      <div className="hidden items-center gap-6 text-sm font-medium md:flex"><a href="#features" className="hover:text-sync-primary">Features</a><a href="#security" className="hover:text-sync-primary">Security</a><a href="#contact" className="hover:text-sync-primary">Contact</a><Link to="/login" className="hover:text-sync-primary">Log in</Link><Link to="/login" className="rounded-full bg-sync-primary px-4 py-2.5 text-white shadow-sm transition hover:bg-blue-700">Get started free</Link></div>
    </nav>
  </header>;
}
