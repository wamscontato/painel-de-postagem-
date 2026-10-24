import { useEffect, useRef, useState } from 'react'
import { readLocalRecord, saveLocalRecord } from '../lib/storage'
import { Copy, Download, FileImage, ImagePlus, MoreVertical, Pencil, Search, Upload, X } from 'lucide-react'
import sunrise from '../assets/sunrise.svg'
import grid from '../assets/grid.svg'
import texture from '../assets/texture.svg'

type MediaItem = { id: string; name: string; alt: string; src: string; fileName: string }
type LibraryRecord = MediaItem[]
type LibraryItem = { id: string; name: string; alt: string; src: string; fileName: string }
type Props = { onCreate: (item?: LibraryItem) => void }
type ModalState = { kind: 'edit' | 'delete'; id: string } | null

const initialMedia: MediaItem[] = [
  { id: 'sunrise', name: 'Luz da manhã', alt: 'Ilustração de um sol nascente', src: sunrise, fileName: 'sunrise.svg' },
  { id: 'grid', name: 'Grade geométrica', alt: 'Padrão de grade geométrica', src: grid, fileName: 'grid.svg' },
  { id: 'texture', name: 'Textura suave', alt: 'Textura abstrata em tons suaves', src: texture, fileName: 'texture.svg' },
]

const acceptedTypes = ['image/jpeg', 'image/png', 'image/webp']

export function MediaLibrary({ onCreate }: Props) {
  const [items, setItems] = useState(initialMedia)
  const [loaded, setLoaded] = useState(false)
  const [query, setQuery] = useState('')
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [modal, setModal] = useState<ModalState>(null)
  const [draftName, setDraftName] = useState('')
  const [draftAlt, setDraftAlt] = useState('')
  const [notice, setNotice] = useState('')
  const uploadRef = useRef<HTMLInputElement>(null)
  const replaceRef = useRef<HTMLInputElement>(null)
  const replaceTarget = useRef<string | null>(null)

  useEffect(() => { readLocalRecord<LibraryRecord>('library:items').then((saved) => { if (saved) setItems(saved); setLoaded(true) }).catch(() => setLoaded(true)) }, [])
  useEffect(() => { if (loaded) void saveLocalRecord({ id: 'library:items', kind: 'media', payload: items, updatedAt: new Date().toISOString() }) }, [items, loaded])
  const toDataUrl = (file: File) => new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error); reader.readAsDataURL(file) })

  const filtered = items.filter((item) => item.name.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR')))
  const announce = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(''), 3000) }
  const addFiles = async (files: FileList | null) => {
    if (!files) return
    const valid = Array.from(files).filter((file) => acceptedTypes.includes(file.type) && file.size <= 8 * 1024 * 1024)
    if (valid.length !== files.length) announce('Alguns arquivos foram ignorados. Use JPEG, PNG ou WebP até 8 MB cada.')
    if (valid.length) { const additions = await Promise.all(valid.map(async (file) => ({ id: `${Date.now()}-${Math.random()}`, name: file.name.replace(/\.[^.]+$/, ''), alt: '', src: await toDataUrl(file), fileName: file.name }))); setItems((current) => [...current, ...additions]) }
  }
  const edit = (item: MediaItem) => { setDraftName(item.name); setDraftAlt(item.alt); setModal({ kind: 'edit', id: item.id }); setOpenMenu(null) }
  const saveEdit = () => {
    if (!modal) return
    setItems((current) => current.map((item) => item.id === modal.id ? { ...item, name: draftName.trim() || item.name, alt: draftAlt } : item))
    setModal(null)
  }
  const replaceFile = async (files: FileList | null) => {
    const file = files?.[0]
    if (!file || !replaceTarget.current) return
    if (!acceptedTypes.includes(file.type) || file.size > 8 * 1024 * 1024) { announce('Use JPEG, PNG ou WebP de até 8 MB.'); return }
    const id = replaceTarget.current
    const src = await toDataUrl(file)
    setItems((current) => current.map((item) => item.id === id ? { ...item, src, fileName: file.name, name: file.name.replace(/\.[^.]+$/, '') } : item))
    setOpenMenu(null)
  }

  return <section className="media-lib-library" aria-labelledby="media-lib-title">
    <header className="media-lib-header">
      <div><p className="media-lib-eyebrow">ARQUIVOS LOCAIS</p><h1 id="media-lib-title">Biblioteca de mídia</h1><p className="media-lib-description">Organize imagens para usar nas suas publicações.</p></div>
      <button type="button" className="media-lib-upload-button" onClick={() => uploadRef.current?.click()}><ImagePlus size={17} aria-hidden="true" /> Enviar arquivos</button>
      <input ref={uploadRef} className="media-lib-visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" multiple aria-label="Selecionar imagens para enviar" onChange={(event) => { addFiles(event.currentTarget.files); event.currentTarget.value = '' }} />
    </header>

    <div className="media-lib-toolbar">
      <label className="media-lib-search"><Search size={17} aria-hidden="true" /><span className="media-lib-visually-hidden">Buscar por nome</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nome" /></label>
      <span className="media-lib-count">{items.length} {items.length === 1 ? 'arquivo' : 'arquivos'}</span>
    </div>

    {filtered.length ? <div className="media-lib-grid" aria-label="Arquivos de mídia">
      {filtered.map((item) => <article className="media-lib-card" key={item.id}>
        <div className="media-lib-preview"><img src={item.src} alt={item.alt || item.name} /></div>
        <div className="media-lib-card-info"><FileImage size={16} aria-hidden="true" /><div className="media-lib-file-label"><strong title={item.name}>{item.name}</strong><span>{item.fileName}</span></div>
          <div className="media-lib-menu-wrap"><button type="button" className="media-lib-menu-trigger" aria-label={`Ações para ${item.name}`} aria-haspopup="menu" aria-expanded={openMenu === item.id} onClick={() => setOpenMenu(openMenu === item.id ? null : item.id)}><MoreVertical size={19} aria-hidden="true" /></button>
            {openMenu === item.id && <div className="media-lib-menu" role="menu" aria-label={`Ações para ${item.name}`}>
              <button type="button" role="menuitem" onClick={() => edit(item)}><Pencil size={15} aria-hidden="true" />Editar detalhes</button>
              <button type="button" role="menuitem" onClick={() => { replaceTarget.current = item.id; replaceRef.current?.click() }}><Upload size={15} aria-hidden="true" />Substituir arquivo</button>
              <button type="button" role="menuitem" onClick={() => { setItems((current) => [...current, { ...item, id: `${Date.now()}-${Math.random()}`, name: `${item.name} (cópia)`, fileName: item.fileName.replace(/(\.[^.]+)?$/, ' - copia$1') }]); setOpenMenu(null) }}><Copy size={15} aria-hidden="true" />Duplicar</button>
              <a className="media-lib-menu-link" role="menuitem" href={item.src} download={item.fileName} onClick={() => setOpenMenu(null)}><Download size={15} aria-hidden="true" />Baixar arquivo</a>
              <button type="button" role="menuitem" onClick={() => { setOpenMenu(null); onCreate(item) }}><ImagePlus size={15} aria-hidden="true" />Usar em publicação</button>
              <button type="button" role="menuitem" className="media-lib-delete-action" onClick={() => { setModal({ kind: 'delete', id: item.id }); setOpenMenu(null) }}><X size={15} aria-hidden="true" />Excluir</button>
            </div>}
          </div>
        </div>
      </article>)}
    </div> : <div className="media-lib-empty" role="status">{query ? 'Nenhum arquivo encontrado.' : 'Sua biblioteca está vazia. Envie uma imagem para começar.'}</div>}

    <input ref={replaceRef} className="media-lib-visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" aria-label="Selecionar arquivo para substituir" onChange={(event) => { replaceFile(event.currentTarget.files); event.currentTarget.value = '' }} />
    {notice && <p className="media-lib-notice" role="status">{notice}</p>}

    {modal && <div className="media-lib-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setModal(null) }}><section className="media-lib-modal" role="dialog" aria-modal="true" aria-labelledby="media-lib-modal-title">
      {modal.kind === 'edit' ? <><h2 id="media-lib-modal-title">Editar detalhes</h2><label className="media-lib-field">Nome<input autoFocus value={draftName} onChange={(event) => setDraftName(event.target.value)} /></label><label className="media-lib-field">Texto alternativo<input value={draftAlt} onChange={(event) => setDraftAlt(event.target.value)} placeholder="Descreva a imagem" /></label><div className="media-lib-modal-actions"><button type="button" onClick={() => setModal(null)}>Cancelar</button><button type="button" onClick={saveEdit}>Salvar</button></div></> : <><h2 id="media-lib-modal-title">Excluir arquivo?</h2><p>Este arquivo será removido da biblioteca.</p><div className="media-lib-modal-actions"><button type="button" onClick={() => setModal(null)}>Cancelar</button><button type="button" className="media-lib-delete-action" onClick={() => { setItems((current) => current.filter((item) => item.id !== modal.id)); setModal(null) }}>Excluir arquivo</button></div></>}
    </section></div>}
  </section>
}
