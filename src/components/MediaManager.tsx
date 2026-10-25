import { useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, horizontalListSortingStrategy, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ArrowDown, ArrowUp, Crop, FileImage, ImagePlus, Maximize2, Pencil, Plus, UploadCloud, X } from 'lucide-react'
import { PhotoStudio, type CropState, type PhotoAjustes, type PhotoEditResult } from './PhotoStudio'
import './MediaManager.css'

export type MediaItem = { id: string; name: string; src: string; size: string; dimensions: string; type: string; originalSrc?: string; photoAdjustments?: PhotoAjustes; photoCrop?: CropState }
type EditMode = 'adjust' | 'crop'
type Props = { media: MediaItem[]; onChange: (items: MediaItem[]) => void; max?: number; onToast: (message: string) => void }

function toMb(bytes: number) { return `${(bytes / 1024 / 1024).toFixed(1)} MB` }
function toDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('Falha ao ler a imagem.'))
    reader.readAsDataURL(file)
  })
}

export function MediaManager({ media, onChange, max = 20, onToast }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [zoomed, setZoomed] = useState<MediaItem | null>(null)
  const [editing, setEditing] = useState<{ itemId: string; mode: EditMode } | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }))
  const editingItem = editing ? media.find((item) => item.id === editing.itemId) ?? null : null

  const addFiles = async (files: FileList | File[]) => {
    const all = Array.from(files)
    const accepted = all.filter((file) => ['image/jpeg', 'image/png', 'image/webp'].includes(file.type) && file.size <= 8 * 1024 * 1024)
    const rejected = all.length - accepted.length
    if (rejected) onToast(`${rejected} arquivo(s) ignorado(s). Use JPEG, PNG ou WebP de até 8 MB cada.`)
    const available = Math.max(0, max - media.length)
    const selected = accepted.slice(0, available)
    const next = await Promise.all(selected.map(async (file, index) => {
      const src = await toDataUrl(file)
      return { id: `${file.name}-${file.lastModified}-${index}-${crypto.randomUUID?.() ?? Date.now()}`, name: file.name, src, originalSrc: src, size: toMb(file.size), dimensions: 'calculando…', type: file.type.split('/')[1].toUpperCase() }
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

  const applyPhotoEdit = (result: PhotoEditResult) => {
    if (!editingItem) return
    onChange(media.map((item) => item.id === editingItem.id ? { ...item, src: result.src, originalSrc: item.originalSrc ?? result.originalSrc, photoAdjustments: { ...result.adjustments }, photoCrop: { ...result.crop }, dimensions: `${result.width} × ${result.height}`, type: result.format.replace('image/', '').toUpperCase() } : item))
    onToast('Edição aplicada à cópia desta publicação. O arquivo original da biblioteca permanece intacto.')
    setEditing(null)
  }

  return <>
    <section className="panel media-panel" aria-labelledby="media-title">
      <div className="panel-heading">
        <div><span className="eyebrow">01 / material</span><h2 id="media-title">Conteúdo visual</h2></div>
        <span className="counter-badge">{media.length} de {max}</span>
      </div>
      <div className={`dropzone ${isDragging ? 'dropzone--dragging' : ''}`} onDragEnter={(e) => { e.preventDefault(); setIsDragging(true) }} onDragOver={(e) => e.preventDefault()} onDragLeave={() => setIsDragging(false)} onDrop={(e) => { e.preventDefault(); setIsDragging(false); void addFiles(e.dataTransfer.files) }}>
        <div className="dropzone-icon"><UploadCloud size={21} /></div>
        <div><strong>Solte seus arquivos aqui</strong><span>JPEG, PNG ou WebP · até 8 MB por arquivo · máximo de 20 imagens</span></div>
        <button className="button button--secondary button--compact" type="button" onClick={() => inputRef.current?.click()}><ImagePlus size={16} /> Adicionar imagem</button>
        <input ref={inputRef} hidden type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(e) => { if (e.target.files) void addFiles(e.target.files); e.currentTarget.value = '' }} />
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={media.map((item) => item.id)} strategy={horizontalListSortingStrategy}>
          <div className="media-strip" aria-label="Imagens carregadas">
            {media.map((item, index) => <SortableMediaItem key={item.id} item={item} index={index} total={media.length} onZoom={() => setZoomed(item)} onRemove={() => onChange(media.filter((entry) => entry.id !== item.id))} onEdit={(mode) => setEditing({ itemId: item.id, mode })} onMove={move} />)}
            {media.length < max && <button className="add-media-tile" type="button" onClick={() => inputRef.current?.click()} aria-label="Adicionar outra imagem"><PlusGlyph /><span>Adicionar</span></button>}
          </div>
        </SortableContext>
      </DndContext>
      {media.length >= max && <div className="limit-note"><FileImage size={15} /> Limite de {max} imagens atingido. Remova uma para adicionar outra.</div>}
    </section>
    {editingItem && editing && <PhotoStudio source={editingItem.originalSrc ?? editingItem.src} fileName={editingItem.name} initialTab={editing.mode} initialAdjustments={editingItem.photoAdjustments} initialCrop={editingItem.photoCrop} onApply={applyPhotoEdit} onClose={() => setEditing(null)} />}
    {zoomed && <div className="lightbox" role="dialog" aria-modal="true" aria-label="Visualização ampliada" onClick={() => setZoomed(null)}><button className="lightbox-close" type="button" onClick={() => setZoomed(null)} aria-label="Fechar visualização"><X /></button><img src={zoomed.src} alt={zoomed.name} onClick={(e) => e.stopPropagation()} /><span>{zoomed.name} · {zoomed.dimensions} · {zoomed.size}</span></div>}
  </>
}

function SortableMediaItem({ item, index, total, onZoom, onRemove, onEdit, onMove }: { item: MediaItem; index: number; total: number; onZoom: () => void; onRemove: () => void; onEdit: (mode: EditMode) => void; onMove: (index: number, direction: -1 | 1) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })
  const stopDrag = (event: PointerEvent<HTMLButtonElement>) => event.stopPropagation()
  return <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 2 : undefined }} className={`media-item ${index === 0 ? 'media-item--cover' : ''}`} {...attributes} {...listeners}>
    <div className="media-number">{index + 1}</div>
    <img src={item.src} alt={item.name} onLoad={(e) => { const image = e.currentTarget; if (item.dimensions === 'calculando…') item.dimensions = `${image.naturalWidth} × ${image.naturalHeight}` }} />
    <button type="button" className="media-remove-action" onPointerDown={stopDrag} onClick={(e) => { e.stopPropagation(); onRemove() }} aria-label={`Remover ${item.name} do carrossel`} title="Remover do carrossel"><X size={15} /></button>
    <button type="button" className="media-edit-action media-edit-action--color" onPointerDown={stopDrag} onClick={(e) => { e.stopPropagation(); onEdit('adjust') }} aria-label={`Editar cores de ${item.name}`} title="Editar fotografia"><Pencil size={15} /><span>Editar</span></button>
    <button type="button" className="media-edit-action media-edit-action--crop" onPointerDown={stopDrag} onClick={(e) => { e.stopPropagation(); onEdit('crop') }} aria-label={`Ajustar enquadramento de ${item.name}`} title="Ajustar enquadramento"><Crop size={15} /></button>
    <button type="button" className="media-zoom-action" onPointerDown={stopDrag} onClick={(e) => { e.stopPropagation(); onZoom() }} aria-label={`Ampliar ${item.name}`} title="Ampliar"><Maximize2 size={14} /></button>
    <div className="media-item-footer"><span title={item.name}>{item.name}</span><div className="media-order-actions"><button className="tiny-icon" type="button" onPointerDown={stopDrag} onClick={(e) => { e.stopPropagation(); onMove(index, -1) }} disabled={index === 0} aria-label="Mover para cima"><ArrowUp size={12} /></button><button className="tiny-icon" type="button" onPointerDown={stopDrag} onClick={(e) => { e.stopPropagation(); onMove(index, 1) }} disabled={index === total - 1} aria-label="Mover para baixo"><ArrowDown size={12} /></button></div></div>
  </div>
}

function PlusGlyph() { return <span className="plus-glyph" aria-hidden="true">+</span> }
