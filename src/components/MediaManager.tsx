import { useRef, useState } from 'react'
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, horizontalListSortingStrategy, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ArrowDown, ArrowUp, FileImage, ImagePlus, Maximize2, Trash2, UploadCloud, X } from 'lucide-react'

export type MediaItem = { id: string; name: string; src: string; size: string; dimensions: string; type: string }

type Props = { media: MediaItem[]; onChange: (items: MediaItem[]) => void; max?: number; onToast: (message: string) => void }

function toMb(bytes: number) { return `${(bytes / 1024 / 1024).toFixed(1)} MB` }

export function MediaManager({ media, onChange, max = 20, onToast }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [zoomed, setZoomed] = useState<MediaItem | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }))

  const addFiles = (files: FileList | File[]) => {
    const accepted = Array.from(files).filter((file) => ['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
    const rejected = Array.from(files).length - accepted.length
    if (rejected) onToast(`${rejected} arquivo(s) ignorado(s). Use JPEG, PNG ou WebP.`)
    const available = Math.max(0, max - media.length)
    const next = accepted.slice(0, available).map((file, index) => ({
      id: `${file.name}-${file.lastModified}-${index}`,
      name: file.name,
      src: URL.createObjectURL(file),
      size: toMb(file.size),
      dimensions: 'calculando…',
      type: file.type.split('/')[1].toUpperCase(),
    }))
    if (accepted.length > available) onToast(`O carrossel aceita até ${max} imagens.`)
    if (next.length) onChange([...media, ...next])
  }

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= media.length) return
    onChange(arrayMove(media, index, target))
  }

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const oldIndex = media.findIndex((item) => item.id === active.id)
    const newIndex = media.findIndex((item) => item.id === over.id)
    if (oldIndex !== -1 && newIndex !== -1) onChange(arrayMove(media, oldIndex, newIndex))
  }

  return <>
    <section className="panel media-panel" aria-labelledby="media-title">
      <div className="panel-heading">
        <div><span className="eyebrow">01 / material</span><h2 id="media-title">Conteúdo visual</h2></div>
        <span className="counter-badge">{media.length} de {max}</span>
      </div>
      <div className={`dropzone ${isDragging ? 'dropzone--dragging' : ''}`} onDragEnter={(e) => { e.preventDefault(); setIsDragging(true) }} onDragOver={(e) => e.preventDefault()} onDragLeave={() => setIsDragging(false)} onDrop={(e) => { e.preventDefault(); setIsDragging(false); addFiles(e.dataTransfer.files) }}>
        <div className="dropzone-icon"><UploadCloud size={21} /></div>
        <div><strong>Solte seus arquivos aqui</strong><span>JPEG, PNG ou WebP · até 20 imagens</span></div>
        <button className="button button--secondary button--compact" onClick={() => inputRef.current?.click()}><ImagePlus size={16} /> Adicionar imagem</button>
        <input ref={inputRef} hidden type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.currentTarget.value = '' }} />
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={media.map((item) => item.id)} strategy={horizontalListSortingStrategy}>
          <div className="media-strip" aria-label="Imagens carregadas">
            {media.map((item, index) => <SortableMediaItem key={item.id} item={item} index={index} total={media.length} onZoom={() => setZoomed(item)} onRemove={() => onChange(media.filter((entry) => entry.id !== item.id))} onMove={move} />)}
            {media.length < max && <button className="add-media-tile" onClick={() => inputRef.current?.click()} aria-label="Adicionar outra imagem"><PlusGlyph /><span>Adicionar</span></button>}
          </div>
        </SortableContext>
      </DndContext>
      {media.length >= max && <div className="limit-note"><FileImage size={15} /> Limite de {max} imagens atingido. Remova uma para adicionar outra.</div>}
    </section>
    {zoomed && <div className="lightbox" role="dialog" aria-modal="true" aria-label="Visualização ampliada" onClick={() => setZoomed(null)}><button className="lightbox-close" onClick={() => setZoomed(null)} aria-label="Fechar visualização"><X /></button><img src={zoomed.src} alt={zoomed.name} onClick={(e) => e.stopPropagation()} /><span>{zoomed.name} · {zoomed.dimensions} · {zoomed.size}</span></div>}
  </>
}

function SortableMediaItem({ item, index, total, onZoom, onRemove, onMove }: { item: MediaItem; index: number; total: number; onZoom: () => void; onRemove: () => void; onMove: (index: number, direction: -1 | 1) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })
  return <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 2 : undefined }} className={`media-item ${index === 0 ? 'media-item--cover' : ''}`} {...attributes} {...listeners}>
    <div className="media-number">{index + 1}</div>
    <img src={item.src} alt={item.name} onLoad={(e) => { const image = e.currentTarget; if (item.dimensions === 'calculando…') item.dimensions = `${image.naturalWidth} × ${image.naturalHeight}` }} />
    <div className="media-item-actions"><button className="mini-action" onClick={(e) => { e.stopPropagation(); onZoom() }} aria-label={`Ampliar ${item.name}`}><Maximize2 size={13} /></button><button className="mini-action" onClick={(e) => { e.stopPropagation(); onRemove() }} aria-label={`Excluir ${item.name}`}><Trash2 size={13} /></button></div>
    <div className="media-item-footer"><span title={item.name}>{item.name}</span><div className="media-order-actions"><button className="tiny-icon" onClick={(e) => { e.stopPropagation(); onMove(index, -1) }} disabled={index === 0} aria-label="Mover para cima"><ArrowUp size={12} /></button><button className="tiny-icon" onClick={(e) => { e.stopPropagation(); onMove(index, 1) }} disabled={index === total - 1} aria-label="Mover para baixo"><ArrowDown size={12} /></button></div></div>
  </div>
}

function PlusGlyph() { return <span className="plus-glyph">+</span> }
