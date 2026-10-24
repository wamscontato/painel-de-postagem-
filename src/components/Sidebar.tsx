import { Activity, CalendarDays, ChevronLeft, ChevronRight, Clapperboard, FileText, FolderOpen, Grid2X2, LayoutDashboard, Moon, Newspaper, Plus, Settings, Sun } from 'lucide-react'
import { BrandMark } from './BrandMark'

export type PageId = 'dashboard' | 'create' | 'calendar' | 'scheduled' | 'drafts' | 'media' | 'insights' | 'news' | 'templates' | 'settings'

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
]

export function Sidebar({ activePage, onNavigate, collapsed, onToggle, darkMode, onToggleDark }: { activePage: PageId; onNavigate: (page: PageId) => void; collapsed: boolean; onToggle: () => void; darkMode: boolean; onToggleDark: () => void }) {
  return (
    <aside className={`sidebar ${collapsed ? 'sidebar--collapsed' : ''}`}>
      <div className="sidebar-top">
        <BrandMark collapsed={collapsed} />
        <button className="icon-button sidebar-collapse" onClick={onToggle} aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'} title={collapsed ? 'Expandir menu' : 'Recolher menu'}>
          {collapsed ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}
        </button>
      </div>
      <div className="workspace-switcher">
        <div className="workspace-avatar">S</div>
        {!collapsed && <div className="workspace-copy"><strong>Estúdio Social</strong><span>Workspace principal</span></div>}
        {!collapsed && <ChevronRight size={15} className="muted-icon" />}
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
      <div className="sidebar-bottom">
        {!collapsed && <div className="local-status"><span className="status-dot" /> <span>Modo local</span><span className="local-status-pill">OAuth pendente</span></div>}
        <button className={`nav-item ${activePage === 'settings' ? 'nav-item--active' : ''}`} onClick={() => onNavigate('settings')} title={collapsed ? 'Estúdio pessoal' : undefined} aria-current={activePage === 'settings' ? 'page' : undefined}>
          <Settings size={18} /><span className={collapsed ? 'sr-only' : ''}>Estúdio pessoal</span>
        </button>
        <button className="nav-item" onClick={onToggleDark} title={darkMode ? 'Usar tema claro' : 'Usar tema escuro'}>
          {darkMode ? <Sun size={18} /> : <Moon size={18} />}<span className={collapsed ? 'sr-only' : ''}>{darkMode ? 'Tema claro' : 'Tema escuro'}</span>
        </button>
      </div>
    </aside>
  )
}
