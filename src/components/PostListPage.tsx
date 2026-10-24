import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { CalendarClock, Check, Copy, MoreHorizontal, Pencil, RefreshCw, Trash2, Undo2, X } from 'lucide-react'

export type PostListItem = { id: string; name: string; type: string; next: string; updated: string }
type Props = { page: 'drafts' | 'scheduled'; onCreate: () => void; onEdit: (item: PostListItem) => void }
type Dialog = { kind: 'schedule' | 'delete'; item: PostListItem } | null

const initialDrafts: PostListItem[] = [
  { id: 'draft-notas', name: 'Notas de fim de semana', type: 'Carrossel', next: 'Revisar legenda', updated: 'há 8 min' },
  { id: 'draft-campanha', name: 'Campanha de novembro', type: 'Story', next: 'Adicionar mídia', updated: 'ontem' },
  { id: 'draft-bastidores', name: 'Bastidores do estúdio', type: 'Reel', next: 'Definir capa', updated: 'há 3 dias' },
  { id: 'draft-guia', name: 'Guia de referências', type: 'Imagem única', next: 'Pronto para agendar', updated: 'há 5 dias' },
]
const initialScheduled: PostListItem[] = [
  { id: 'schedule-notas', name: 'Notas de fim de semana', type: 'Carrossel', next: '28 out · 09:30', updated: 'há 8 min' },
  { id: 'schedule-briefing', name: 'Antes do briefing', type: 'Reel', next: '30 out · 18:00', updated: 'há 1 h' },
  { id: 'schedule-checklist', name: 'Checklist de novembro', type: 'Imagem única', next: '02 nov · 08:15', updated: 'ontem' },
]

function loadItems(key: string, fallback: PostListItem[]) {
  try {
    const saved = localStorage.getItem(key)
    return saved ? JSON.parse(saved) as PostListItem[] : fallback
  } catch { return fallback }
}
const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }

export function PostListPage({ page, onCreate, onEdit }: Props) {
  const isDraft = page === 'drafts'
  const [drafts, setDrafts] = useState(() => loadItems('social-studio:list:drafts', initialDrafts))
  const [scheduled, setScheduled] = useState(() => loadItems('social-studio:list:scheduled', initialScheduled))
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [menuAnchor, setMenuAnchor] = useState<{ id: string; top: number; left: number; placement: 'above' | 'below' } | null>(null)
  const [dialog, setDialog] = useState<Dialog>(null)
  const [scheduleDate, setScheduleDate] = useState(todayISO())
  const [scheduleTime, setScheduleTime] = useState('09:30')
  const [notice, setNotice] = useState('')
  const [query, setQuery] = useState('')
  const items = isDraft ? drafts : scheduled
  const filteredItems = items.filter(item => `${item.name} ${item.type}`.toLocaleLowerCase('pt-BR').includes(query.trim().toLocaleLowerCase('pt-BR')))
  const menuItem = items.find(item => item.id === openMenu)
  const menuHeight = isDraft ? 154 : 190

  useEffect(() => {
    if (!openMenu) return
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpenMenu(null); setMenuAnchor(null) } }
    const outside = (event: MouseEvent) => { if (!(event.target as HTMLElement).closest('.post-action-menu, .post-menu-trigger')) { setOpenMenu(null); setMenuAnchor(null) } }
    const onScroll = () => { setOpenMenu(null); setMenuAnchor(null) }
    window.addEventListener('keydown', close); window.addEventListener('mousedown', outside); window.addEventListener('scroll', onScroll, true); window.addEventListener('resize', onScroll)
    return () => { window.removeEventListener('keydown', close); window.removeEventListener('mousedown', outside); window.removeEventListener('scroll', onScroll, true); window.removeEventListener('resize', onScroll) }
  }, [openMenu])

  useEffect(() => { localStorage.setItem('social-studio:list:drafts', JSON.stringify(drafts)) }, [drafts])
  useEffect(() => { localStorage.setItem('social-studio:list:scheduled', JSON.stringify(scheduled)) }, [scheduled])

  const toggleMenu = (item: PostListItem, button: HTMLButtonElement) => {
    if (openMenu === item.id) { setOpenMenu(null); setMenuAnchor(null); return }
    const rect = button.getBoundingClientRect()
    const width = Math.min(225, window.innerWidth - 24)
    const left = Math.max(12, Math.min(window.innerWidth - width - 12, rect.right - width))
    const placement = rect.bottom + menuHeight + 10 <= window.innerHeight ? 'below' : 'above'
    const top = placement === 'below' ? rect.bottom + 6 : Math.max(12, rect.top - menuHeight - 6)
    setMenuAnchor({ id: item.id, top, left, placement }); setOpenMenu(item.id)
  }
  const announce = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(''), 2800) }
  const openScheduleDialog = (item: PostListItem) => { setScheduleDate(todayISO()); setScheduleTime('09:30'); setDialog({ kind: 'schedule', item }); setOpenMenu(null) }
  const duplicate = (item: PostListItem) => {
    const clone = { ...item, id: `${item.id}-copy-${Date.now()}`, name: `${item.name} (cópia)`, updated: 'agora' }
    if (isDraft) setDrafts(current => [clone, ...current]); else setScheduled(current => [clone, ...current])
    setOpenMenu(null); announce('Publicação duplicada neste dispositivo.')
  }
  const remove = (item: PostListItem) => {
    if (isDraft) setDrafts(current => current.filter(row => row.id !== item.id))
    else setScheduled(current => current.filter(row => row.id !== item.id))
    setDialog(null); setOpenMenu(null); announce('Publicação excluída da lista local.')
  }
  const commitSchedule = () => {
    if (!dialog || dialog.kind !== 'schedule' || !scheduleDate || !scheduleTime) return
    const dateLabel = new Date(`${scheduleDate}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '')
    const next = `${dateLabel} · ${scheduleTime}`
    if (isDraft) {
      const item = { ...dialog.item, next, updated: 'agora' }
      setDrafts(current => current.filter(row => row.id !== dialog.item.id))
      setScheduled(current => [item, ...current.filter(row => row.id !== item.id)])
      announce('Agendamento local criado.')
    } else {
      setScheduled(current => current.map(row => row.id === dialog.item.id ? { ...row, next, updated: 'agora' } : row))
      announce('Horário atualizado localmente.')
    }
    setDialog(null)
  }
  const moveToDrafts = (item: PostListItem) => {
    setScheduled(current => current.filter(row => row.id !== item.id))
    setDrafts(current => [{ ...item, id: `draft-${item.id}-${Date.now()}`, next: 'Revisar antes de agendar', updated: 'agora' }, ...current])
    setOpenMenu(null); announce('Publicação movida para rascunhos.')
  }

  return <div className="page">
    <div className="page-heading"><div><span className="eyebrow">workspace / {isDraft ? 'drafts' : 'local queue'}</span><h1>{isDraft ? 'Rascunhos que ainda respiram.' : 'O que vem a seguir.'}</h1><p>{isDraft ? 'Ideias em processo, preservadas para quando voltarem a fazer sentido.' : 'Seus planejamentos locais, organizados por próximo passo.'}</p></div><button className="button button--primary" onClick={onCreate}>＋ Criar publicação</button></div>
    <div className="filter-row"><div className="search-field"><span aria-hidden="true">⌕</span><input aria-label="Buscar publicações" placeholder="Buscar por título ou tipo" value={query} onChange={event => setQuery(event.target.value)} /></div><span className="helper-text">{items.length} {isDraft ? 'rascunhos' : 'agendamentos locais'}</span></div>
    <div className="list-surface"><div className="list-header"><span>Publicação</span><span>Formato</span><span>Próximo passo</span><span>Atualizada</span><span aria-label="Ações" /></div>
      {filteredItems.length ? filteredItems.map((item, index) => <div className="list-row post-list-row" data-search={`${item.name} ${item.type}`.toLocaleLowerCase('pt-BR')} key={item.id}>
        <div className="list-title"><div className={`list-thumb list-thumb--${index % 4}`} /><div><strong>{item.name}</strong><span>Estúdio Social · local</span></div></div>
        <span className="list-type">{item.type}</span>
        <span className="list-next"><i className={isDraft ? 'status-dot status-dot--yellow' : 'status-dot'} />{item.next}</span>
        <span className="list-updated">{item.updated}</span>
        <div className="post-menu-wrap"><button className="icon-button post-menu-trigger" aria-label={`Mais opções: ${item.name}`} aria-haspopup="menu" aria-expanded={openMenu === item.id} onClick={event => toggleMenu(item, event.currentTarget)}><MoreHorizontal size={17} /></button></div>
      </div>) : <div className="post-list-empty">{items.length === 0 ? (isDraft ? 'Nenhum rascunho por aqui. Crie uma publicação para começar.' : 'Nenhum agendamento local encontrado.') : 'Nenhuma publicação corresponde à sua busca.'}</div>}
    </div>

    {openMenu && menuItem && menuAnchor?.id === openMenu && createPortal(<div className={`post-action-menu post-action-menu--${menuAnchor.placement}`} style={{ top: menuAnchor.top, left: menuAnchor.left }} role="menu" aria-label={`Ações para ${menuItem.name}`}><button role="menuitem" onClick={() => { setOpenMenu(null); setMenuAnchor(null); onEdit(menuItem) }}><Pencil size={14} />Editar publicação</button><button role="menuitem" onClick={() => duplicate(menuItem)}><Copy size={14} />Duplicar</button>{isDraft ? <button role="menuitem" onClick={() => openScheduleDialog(menuItem)}><CalendarClock size={14} />Agendar publicação</button> : <><button role="menuitem" onClick={() => openScheduleDialog(menuItem)}><RefreshCw size={14} />Reagendar</button><button role="menuitem" onClick={() => moveToDrafts(menuItem)}><Undo2 size={14} />Mover para rascunhos</button></>}<button role="menuitem" className="post-delete-action" onClick={() => { setDialog({ kind: 'delete', item: menuItem }); setOpenMenu(null); setMenuAnchor(null) }}><Trash2 size={14} />Excluir</button></div>, document.body)}
    {notice && <div className="post-list-notice" role="status">{notice}</div>}
    {dialog && <div className="post-list-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setDialog(null) }}><section className="post-list-dialog" role="dialog" aria-modal="true" aria-labelledby="post-list-dialog-title">
      <button className="post-list-dialog-close" aria-label="Fechar" onClick={() => setDialog(null)}><X size={16} /></button>
      {dialog.kind === 'schedule' ? <><span className="eyebrow">{isDraft ? 'NOVO AGENDAMENTO LOCAL' : 'AJUSTAR HORÁRIO'}</span><h2 id="post-list-dialog-title">{isDraft ? 'Escolha quando publicar.' : 'Reagendar publicação.'}</h2><p>{dialog.item.name}</p><div className="post-list-date-fields"><label>Data<input type="date" value={scheduleDate} min={todayISO()} onChange={event => setScheduleDate(event.target.value)} /></label><label>Horário<input type="time" value={scheduleTime} onChange={event => setScheduleTime(event.target.value)} /></label></div><div className="post-list-dialog-actions"><button className="button button--secondary" onClick={() => setDialog(null)}>Cancelar</button><button className="button button--primary" onClick={commitSchedule}><Check size={15} />{isDraft ? 'Agendar localmente' : 'Salvar horário'}</button></div></> : <><span className="eyebrow">AÇÃO LOCAL</span><h2 id="post-list-dialog-title">Excluir esta publicação?</h2><p>“{dialog.item.name}” será removida da lista neste dispositivo. Essa ação não publica nem altera uma conta social.</p><div className="post-list-dialog-actions"><button className="button button--secondary" onClick={() => setDialog(null)}>Manter</button><button className="button post-list-confirm-delete" onClick={() => remove(dialog.item)}><Trash2 size={15} />Excluir</button></div></>}
    </section></div>}
  </div>
}
