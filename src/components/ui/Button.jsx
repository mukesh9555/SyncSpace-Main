import { motion } from 'framer-motion';

const styles = {
  primary: 'bg-sync-primary text-white shadow-sm hover:bg-blue-700',
  secondary: 'border border-sync-border bg-white text-sync-text hover:bg-slate-50',
  ghost: 'text-sync-text hover:bg-slate-100',
};

export default function Button({ children, variant = 'primary', icon: Icon, className = '', ...props }) {
  return <motion.button whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }} className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition ${styles[variant]} ${className}`} {...props}>
    {children}{Icon && <Icon className="h-4 w-4" />}
  </motion.button>;
}
