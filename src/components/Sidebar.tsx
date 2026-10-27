import { Activity, CalendarDays, ChevronLeft, ChevronRight, Clapperboard, FileText, FolderOpen, Grid2X2, LayoutDashboard, LaptopMinimal, Newspaper, Plus, Settings } from 'lucide-react'
import { BrandMark } from './BrandMark'

export type PageId = 'dashboard' | 'create' | 'calendar' | 'scheduled' | 'drafts' | 'media' | 'insights' | 'news' | 'templates' | 'settings' | 'local'

const items: Array<{ id: PageId; label: string; icon: typeof LayoutDashboard }> = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'create', label: 'Criar publicação', icon: Plus },
  { id: 'calendar', label: 'Calendário', icon: CalendarDays },
  { id: 'scheduled', label: 'Agendadas', icon: Clapperboard },
  { id: 'drafts', label: 'Rascunhos', icon: FileText },
  { id: 'media', label: 'Biblioteca de mídia', icon: FolderOpen },
  { id: 'insights', label: 'Métricas e relatórios', icon: Activity },
  { id: 'news', label: 'Notícias Entreverso TV', icon: Newspaper },
  { id: 'templates', label: 'Modelos de publicações', icon: Grid2X2 },
  { id: 'settings', label: 'Conectar contas', icon: Settings },
  { id: 'local', label: 'Modo local', icon: LaptopMinimal },
]

export function Sidebar({ activePage, onNavigate, collapsed, onToggle }: { activePage: PageId; onNavigate: (page: PageId) => void; collapsed: boolean; onToggle: () => void }) {
  return (
    <aside className={`sidebar ${collapsed ? 'sidebar--collapsed' : ''}`}>
      <div className="sidebar-top">
        <BrandMark />
        <button className="icon-button sidebar-collapse" onClick={onToggle} aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'} aria-expanded={!collapsed} title={collapsed ? 'Expandir menu' : 'Recolher menu'}>
          {collapsed ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}
        </button>
      </div>
      <nav className="primary-nav" aria-label="Navegação principal">
        {!collapsed && <span className="nav-section-label">Workspace</span>}
        {items.map(({ id, label, icon: Icon }) => (
          <button key={id} className={`nav-item ${activePage === id ? 'nav-item--active' : ''}`} onClick={() => onNavigate(id)} title={collapsed ? label : undefined} aria-current={activePage === id ? 'page' : undefined}>
            <Icon size={18} strokeWidth={activePage === id ? 2.3 : 1.8} />
            {!collapsed && <span>{label}</span>}
            {!collapsed && id === 'drafts' && <span className="nav-count">4</span>}
          </button>
        ))}
      </nav>
    </aside>
  )
}
