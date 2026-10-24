import { Sparkles } from 'lucide-react'

export function BrandMark({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <div className={`brand-lockup ${collapsed ? 'brand-lockup--collapsed' : ''}`} aria-label="Estúdio Social">
      <div className="brand-mark" aria-hidden="true"><Sparkles size={18} strokeWidth={2.5} /></div>
      {!collapsed && <div><strong>ESTÚDIO</strong><span>social planner</span></div>}
    </div>
  )
}
