import { useEffect, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { Check, ChevronDown, CircleCheck, FileImage, Image, ImagePlus, Link2, ListPlus, LockKeyhole, Plus, ShieldCheck, Trash2, Video } from 'lucide-react'
import { readLocalRecord, saveLocalRecord } from '../lib/storage'
import type { PageId } from './Sidebar'
import './YouTubeCommunityComposer.css'

type CommunityKind = 'image' | 'image-poll' | 'text-poll' | 'quiz' | 'video'
type ChoiceKind = 'image-poll' | 'text-poll' | 'quiz'
type Visibility = 'public' | 'unlisted' | 'private'
type CommunityImage = { id: string; name: string; mime: string; dataUrl: string; width: number; height: number }
type Choice = { id: string; text: string; image: CommunityImage | null }
type ChoiceSets = Record<ChoiceKind, Choice[]>
type Descriptions = Record<CommunityKind, string>
type CommunityDraft = {
  id: string
  type: CommunityKind
  visibility: Visibility
  descriptions: Descriptions
  images: CommunityImage[]
  choicesByKind: ChoiceSets
  correctOptionId: string | null
  videoUrl: string
  updatedAt: string
}

type Props = { onToast: (message: string, kind?: 'success' | 'info') => void; onOpenSettings: (page: PageId) => void }

const DRAFT_RECORD_ID = 'youtube-community:drafts:v1'
const MAX_IMAGES = 10
const MAX_FILE_BYTES = 8 * 1024 * 1024
const ACCEPTED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif'
const KIND_ORDER: CommunityKind[] = ['image', 'image-poll', 'text-poll', 'quiz', 'video']
const KIND_COPY: Record<CommunityKind, { label: string; short: string; description: string }> = {
  image: { label: 'Imagem', short: 'Imagem', description: 'Compartilhe uma imagem ou um conjunto de imagens.' },
  'image-poll': { label: 'Enquete com imagem', short: 'Enquete com imagem', description: 'Monte uma opção visual para cada resposta da enquete.' },
  'text-poll': { label: 'Enquete com texto', short: 'Enquete com texto', description: 'Escreva alternativas curtas para sua comunidade escolher.' },
  quiz: { label: 'Teste', short: 'Teste', description: 'Crie respostas e marque qual delas está correta.' },
  video: { label: 'Vídeo', short: 'Vídeo', description: 'Adicione o endereço de um vídeo do YouTube.' },
}
const VISIBILITY_COPY: Record<Visibility, string> = { public: 'Pública', unlisted: 'Não listada', private: 'Privada' }
const CHOICE_KINDS: ChoiceKind[] = ['image-poll', 'text-poll', 'quiz']

function makeId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `yt-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}
function makeChoice(): Choice { return { id: makeId(), text: '', image: null } }
function freshChoices(): ChoiceSets {
  return {
    'image-poll': [makeChoice(), makeChoice()],
    'text-poll': [makeChoice(), makeChoice()],
    quiz: [makeChoice(), makeChoice()],
  }
}
function freshDescriptions(): Descriptions { return { image: '', 'image-poll': '', 'text-poll': '', quiz: '', video: '' } }
function isCommunityKind(value: unknown): value is CommunityKind { return typeof value === 'string' && KIND_ORDER.includes(value as CommunityKind) }
function isVisibility(value: unknown): value is Visibility { return value === 'public' || value === 'unlisted' || value === 'private' }
function isChoiceKind(value: unknown): value is ChoiceKind { return typeof value === 'string' && CHOICE_KINDS.includes(value as ChoiceKind) }
function isCommunityImage(value: unknown): value is CommunityImage {
  if (!value || typeof value !== 'object') return false
  const image = value as Partial<CommunityImage>
  return typeof image.id === 'string' && typeof image.name === 'string' && typeof image.mime === 'string'
    && typeof image.dataUrl === 'string' && image.dataUrl.startsWith('data:image/')
    && Number.isFinite(image.width) && Number.isFinite(image.height)
}
function isChoice(value: unknown): value is Choice {
  if (!value || typeof value !== 'object') return false
  const choice = value as Partial<Choice>
  return typeof choice.id === 'string' && typeof choice.text === 'string'
    && (choice.image === null || isCommunityImage(choice.image))
}
function isCommunityDraft(value: unknown): value is CommunityDraft {
  if (!value || typeof value !== 'object') return false
  const draft = value as Partial<CommunityDraft>
  if (typeof draft.id !== 'string' || !isCommunityKind(draft.type) || !isVisibility(draft.visibility)
    || !draft.descriptions || typeof draft.descriptions !== 'object' || !Array.isArray(draft.images)
    || !draft.choicesByKind || typeof draft.choicesByKind !== 'object' || typeof draft.videoUrl !== 'string'
    || !(draft.correctOptionId === null || typeof draft.correctOptionId === 'string')
    || typeof draft.updatedAt !== 'string' || !Number.isFinite(Date.parse(draft.updatedAt))) return false
  const descriptions = draft.descriptions as Partial<Descriptions>
  if (!KIND_ORDER.every((kind) => typeof descriptions[kind] === 'string')) return false
  if (!draft.images.every(isCommunityImage)) return false
  const choices = draft.choicesByKind as Partial<ChoiceSets>
  return CHOICE_KINDS.every((kind) => Array.isArray(choices[kind]) && choices[kind]!.every(isChoice))
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Não foi possível ler este arquivo.'))
    reader.readAsDataURL(file)
  })
}
function imageDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new window.Image()
    image.onload = () => {
      if (!image.naturalWidth || !image.naturalHeight) reject(new Error('A imagem não tem dimensões válidas.'))
      else resolve({ width: image.naturalWidth, height: image.naturalHeight })
    }
    image.onerror = () => reject(new Error('O navegador não conseguiu abrir esta imagem.'))
    image.src = dataUrl
  })
}
async function readCommunityImage(file: File): Promise<CommunityImage> {
  if (!ACCEPTED_MIME.has(file.type.toLowerCase())) throw new Error('Use JPEG, PNG, WebP ou GIF.')
  if (file.size > MAX_FILE_BYTES) throw new Error('Cada arquivo pode ter no máximo 8 MB.')
  const dataUrl = await fileToDataUrl(file)
  const { width, height } = await imageDimensions(dataUrl)
  const ratio = width / height
  if (ratio < 0.4 || ratio > 2.5) throw new Error('A proporção precisa ficar entre 2:5 e 5:2.')
  return { id: makeId(), name: file.name, mime: file.type, dataUrl, width, height }
}
function youtubeVideoId(value: string): string | null {
  try {
    const url = new URL(value.trim())
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    const host = url.hostname.toLowerCase().replace(/^www\./, '')
    if (host !== 'youtu.be' && host !== 'youtube.com' && host !== 'm.youtube.com' && host !== 'youtube-nocookie.com') return null
    let id = ''
    if (host === 'youtu.be') id = url.pathname.split('/').filter(Boolean)[0] ?? ''
    else if (url.pathname === '/watch') id = url.searchParams.get('v') ?? ''
    else id = url.pathname.match(/^\/(?:shorts|embed|live)\/([^/?]+)/)?.[1] ?? ''
    return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null
  } catch { return null }
}
function kindIcon(kind: CommunityKind) {
  if (kind === 'image') return <Image size={17} aria-hidden="true" />
  if (kind === 'image-poll') return <ImagePlus size={17} aria-hidden="true" />
  if (kind === 'text-poll') return <ListPlus size={17} aria-hidden="true" />
  if (kind === 'quiz') return <CircleCheck size={17} aria-hidden="true" />
  return <Video size={17} aria-hidden="true" />
}
function draftTitle(draft: CommunityDraft) {
  const description = draft.descriptions[draft.type]?.trim()
  return description ? description.slice(0, 52) : `${KIND_COPY[draft.type].label} · ${new Date(draft.updatedAt).toLocaleDateString('pt-BR')}`
}

export function YouTubeCommunityComposer({ onToast, onOpenSettings }: Props) {
  const [kind, setKind] = useState<CommunityKind>('image')
  const [visibility, setVisibility] = useState<Visibility>('public')
  const [descriptions, setDescriptions] = useState<Descriptions>(freshDescriptions)
  const [images, setImages] = useState<CommunityImage[]>([])
  const [choicesByKind, setChoicesByKind] = useState<ChoiceSets>(freshChoices)
  const [correctOptionId, setCorrectOptionId] = useState<string | null>(null)
  const [videoUrl, setVideoUrl] = useState('')
  const [videoTouched, setVideoTouched] = useState(false)
  const [videoError, setVideoError] = useState('')
  const [uploadMessage, setUploadMessage] = useState('')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [choiceTouched, setChoiceTouched] = useState<string[]>([])
  const [savedDrafts, setSavedDrafts] = useState<CommunityDraft[]>([])
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState('')

  useEffect(() => {
    let active = true
    void readLocalRecord<unknown>(DRAFT_RECORD_ID).then((value) => {
      if (!active || !Array.isArray(value)) return
      setSavedDrafts(value.filter(isCommunityDraft))
    }).catch(() => undefined)
    return () => { active = false }
  }, [])

  const currentChoices = isChoiceKind(kind) ? choicesByKind[kind] : []
  const selectedVideoId = youtubeVideoId(videoUrl)
  const hasContent = Boolean(kind !== 'image' || visibility !== 'public' || images.length || videoUrl.trim() || Object.values(descriptions).some((text) => text.trim())
    || CHOICE_KINDS.some((choiceKind) => choicesByKind[choiceKind].some((choice) => choice.text.trim() || choice.image)))

  function updateChoices(choiceKind: ChoiceKind, updater: (current: Choice[]) => Choice[]) {
    setChoicesByKind((current) => ({ ...current, [choiceKind]: updater(current[choiceKind]) }))
  }
  function removeChoice(choiceKind: ChoiceKind, choiceId: string) {
    const current = choicesByKind[choiceKind]
    if (current.length <= 2) return
    const next = current.filter((choice) => choice.id !== choiceId)
    updateChoices(choiceKind, () => next)
    if (choiceKind === 'quiz' && correctOptionId === choiceId) setCorrectOptionId(next[0]?.id ?? null)
    setChoiceTouched((currentTouched) => currentTouched.filter((id) => id !== choiceId))
  }
  function addChoice(choiceKind: ChoiceKind) {
    updateChoices(choiceKind, (current) => [...current, makeChoice()])
  }
  function choiceFileChanged(choiceKind: ChoiceKind, choiceId: string, file?: File) {
    if (!file) return
    setUploading(true)
    setUploadMessage('')
    void readCommunityImage(file).then((image) => {
      updateChoices(choiceKind, (current) => current.map((choice) => choice.id === choiceId ? { ...choice, image } : choice))
    }).catch((reason: unknown) => {
      setUploadMessage(reason instanceof Error ? `${file.name}: ${reason.message}` : `Não foi possível abrir ${file.name}.`)
    }).finally(() => setUploading(false))
  }
  function removeChoiceImage(choiceKind: ChoiceKind, choiceId: string) {
    updateChoices(choiceKind, (current) => current.map((choice) => choice.id === choiceId ? { ...choice, image: null } : choice))
  }
  async function addImages(fileList: FileList | File[]) {
    const incoming = Array.from(fileList)
    if (!incoming.length) return
    const remaining = MAX_IMAGES - images.length
    if (remaining <= 0) {
      setUploadMessage('Limite de 10 imagens ou GIFs atingido. Remova um arquivo para continuar.')
      return
    }
    setUploading(true)
    setUploadMessage('')
    const accepted = incoming.slice(0, remaining)
    const added: CommunityImage[] = []
    const errors: string[] = []
    for (const file of accepted) {
      try { added.push(await readCommunityImage(file)) }
      catch (reason) { errors.push(`${file.name}: ${reason instanceof Error ? reason.message : 'arquivo inválido.'}`) }
    }
    if (added.length) setImages((current) => [...current, ...added].slice(0, MAX_IMAGES))
    if (incoming.length > remaining) errors.push(`O limite deste formato é ${MAX_IMAGES} arquivos.`)
    setUploadMessage(errors.join(' '))
    setUploading(false)
  }
  function removeImage(imageId: string) { setImages((current) => current.filter((image) => image.id !== imageId)) }
  function setDescription(value: string) { setDescriptions((current) => ({ ...current, [kind]: value })) }
  function changeKind(next: CommunityKind) {
    setKind(next)
    setUploadMessage('')
    setVideoError('')
  }
  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    const nextIndex = (index + (event.key === 'ArrowRight' ? 1 : -1) + KIND_ORDER.length) % KIND_ORDER.length
    const next = KIND_ORDER[nextIndex]
    changeKind(next)
    window.requestAnimationFrame(() => document.getElementById(`ytc-tab-${next}`)?.focus())
  }
  function resetForm() {
    setKind('image')
    setVisibility('public')
    setDescriptions(freshDescriptions())
    setImages([])
    setChoicesByKind(freshChoices())
    setCorrectOptionId(null)
    setVideoUrl('')
    setVideoTouched(false)
    setVideoError('')
    setUploadMessage('')
    setChoiceTouched([])
    setActiveDraftId(null)
    setDeleteError('')
  }
  async function saveDraft(quiet = false): Promise<boolean> {
    setSaving(true)
    setDeleteError('')
    const updatedAt = new Date().toISOString()
    const draft: CommunityDraft = {
      id: activeDraftId ?? makeId(), type: kind, visibility, descriptions,
      images, choicesByKind, correctOptionId, videoUrl, updatedAt,
    }
    const next = [draft, ...savedDrafts.filter((item) => item.id !== draft.id)]
    try {
      await saveLocalRecord({ id: DRAFT_RECORD_ID, kind: 'draft', payload: next, updatedAt })
      setSavedDrafts(next)
      setActiveDraftId(draft.id)
      if (!quiet) onToast('Rascunho do YouTube salvo neste dispositivo.')
      return true
    } catch {
      setDeleteError('Não foi possível salvar neste navegador. O conteúdo continua aberto; tente novamente.')
      if (!quiet) onToast('O navegador não conseguiu salvar este rascunho. O conteúdo continua aberto.', 'info')
      return false
    } finally { setSaving(false) }
  }
  function restoreDraft(draft: CommunityDraft) {
    setKind(draft.type)
    setVisibility(draft.visibility)
    setDescriptions({ ...freshDescriptions(), ...draft.descriptions })
    setImages(draft.images)
    setChoicesByKind(draft.choicesByKind)
    setCorrectOptionId(draft.correctOptionId)
    setVideoUrl(draft.videoUrl)
    setVideoTouched(false)
    setVideoError('')
    setUploadMessage('')
    setChoiceTouched([])
    setActiveDraftId(draft.id)
    setDeleteError('')
    onToast('Rascunho local carregado.')
  }
  async function deleteDraft(draftId: string) {
    if (!window.confirm('Excluir este rascunho local deste dispositivo?')) return
    const next = savedDrafts.filter((draft) => draft.id !== draftId)
    const updatedAt = new Date().toISOString()
    try {
      await saveLocalRecord({ id: DRAFT_RECORD_ID, kind: 'draft', payload: next, updatedAt })
      setSavedDrafts(next)
      setDeleteError('')
      if (activeDraftId === draftId) resetForm()
      onToast('Rascunho removido deste dispositivo.')
    } catch {
      setDeleteError('Não foi possível excluir o rascunho. Ele continua salvo neste dispositivo.')
      onToast('Não foi possível excluir o rascunho local.', 'info')
    }
  }
  async function openAccountSettings() {
    if (hasContent) {
      const saved = await saveDraft(true)
      if (!saved) return
      onToast('Rascunho salvo localmente antes de abrir as conexões.', 'info')
    }
    onOpenSettings('settings')
  }
  function validateVideoOnBlur() {
    setVideoTouched(true)
    setVideoError(videoUrl.trim() && !youtubeVideoId(videoUrl) ? 'Informe um endereço válido: youtube.com/watch, youtu.be ou youtube.com/shorts.' : '')
  }

  return <section className="ytc-panel" aria-labelledby="ytc-title">
    <div className="ytc-heading">
      <div className="ytc-heading-mark"><Video size={21} aria-hidden="true" /></div>
      <div className="ytc-heading-copy"><span className="eyebrow">CANAL / YOUTUBE</span><h2 id="ytc-title">Publicação para a comunidade</h2><p>Monte e salve um rascunho local para o YouTube.</p></div>
      <span className="ytc-local-badge"><span className="status-dot" /> modo local</span>
    </div>

    <div className="ytc-account-row">
      <div className="ytc-account-icon"><Video size={19} aria-hidden="true" /></div>
      <div className="ytc-account-copy"><strong>Conta e API do YouTube</strong><span>As credenciais de publicação ainda não foram configuradas.</span></div>
      <div className="ytc-account-state"><LockKeyhole size={14} aria-hidden="true" /><span>Publicação desativada</span></div>
      <button className="ytc-account-button" type="button" onClick={() => void openAccountSettings()}>Conectar contas</button>
    </div>
    <p className="ytc-api-note"><ShieldCheck size={14} aria-hidden="true" /> A conexão de leitura de métricas não permite publicar. Nenhuma chave será solicitada ou armazenada no navegador.</p>

    <div className="ytc-toolbar">
      <div className="ytc-visibility"><label htmlFor="ytc-visibility">Visibilidade</label><select id="ytc-visibility" value={visibility} onChange={(event) => setVisibility(event.target.value as Visibility)}><option value="public">Pública</option><option value="unlisted">Não listada</option><option value="private">Privada</option></select><ChevronDown size={15} aria-hidden="true" /></div>
      <span className="ytc-account-caption">Canal não conectado para publicação</span>
    </div>

    <div className="ytc-tabs" role="tablist" aria-label="Formato da publicação para YouTube">
      {KIND_ORDER.map((item, index) => <button key={item} id={`ytc-tab-${item}`} type="button" role="tab" aria-selected={kind === item} aria-controls="ytc-mode-panel" className={`ytc-tab ${kind === item ? 'ytc-tab--active' : ''}`} onClick={() => changeKind(item)} onKeyDown={(event) => handleTabKeyDown(event, index)}>{kindIcon(item)}<span>{KIND_COPY[item].short}</span></button>)}
    </div>

    <div className="ytc-layout">
      <div className="ytc-builder" id="ytc-mode-panel" role="tabpanel" tabIndex={0} aria-labelledby={`ytc-tab-${kind}`}>
        <div className="ytc-mode-intro"><h3>{KIND_COPY[kind].label}</h3><p>{KIND_COPY[kind].description}</p></div>
        <label className="ytc-field-label" htmlFor={`ytc-description-${kind}`}>Descrição</label>
        <textarea id={`ytc-description-${kind}`} className="ytc-textarea" value={descriptions[kind]} onChange={(event) => setDescription(event.target.value)} placeholder={kind === 'image' ? 'Escreva algo para sua comunidade…' : 'Descreva esta publicação…'} rows={4} />
        <div className="ytc-field-help"><span>A descrição fica salva neste formato.</span><span>{descriptions[kind].length} caracteres</span></div>

        {kind === 'image' && <div className="ytc-mode-content">
          <div className="ytc-section-title"><div><h4>Imagens da publicação</h4><p>JPEG, PNG, WebP ou GIF · até 8 MB por arquivo · proporção de 2:5 a 5:2 · até 10 arquivos.</p></div><span className="ytc-count">{images.length}/{MAX_IMAGES}</span></div>
          <div className={`ytc-dropzone ${uploading ? 'ytc-dropzone--busy' : ''}`} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); void addImages(event.dataTransfer.files) }}>
            <input id="ytc-image-upload" className="ytc-file-input" type="file" accept={IMAGE_ACCEPT} multiple disabled={uploading || images.length >= MAX_IMAGES} aria-label="Enviar até dez imagens ou GIFs" onChange={(event) => { const files = event.currentTarget.files; if (files) void addImages(files); event.currentTarget.value = '' }} />
            <FileImage size={20} aria-hidden="true" />
            <div><strong>{uploading ? 'Lendo arquivo…' : 'Arraste as imagens para cá'}</strong><span>Os arquivos permanecem neste dispositivo.</span></div>
            <label className="ytc-upload-button" htmlFor="ytc-image-upload">{uploading ? 'Aguarde' : 'Escolher arquivos'}</label>
          </div>
          {uploadMessage && <p className="ytc-inline-message" role="status" aria-live="polite">{uploadMessage}</p>}
          {images.length > 0 && <div className="ytc-image-grid" aria-label="Imagens selecionadas">{images.map((image, index) => <figure className="ytc-image-tile" key={image.id}>
            <img src={image.dataUrl} alt={`${image.name}, ${image.width} por ${image.height} pixels`} />
            <figcaption><span title={image.name}>{image.name}</span><small>{image.width} × {image.height} · {image.mime === 'image/gif' ? 'GIF' : image.mime.split('/')[1].toUpperCase()}</small></figcaption>
            <button className="ytc-remove-button" type="button" aria-label={`Remover ${image.name}`} title={`Remover ${image.name}`} onClick={() => removeImage(image.id)}><Trash2 size={16} /></button>
          </figure>)}</div>}
          {images.length === 0 && <div className="ytc-empty-hint">Nenhuma imagem selecionada. A prévia quadriculada do navegador não faz parte do arquivo.</div>}
        </div>}

        {kind === 'image-poll' && <ChoiceImageFields kind="image-poll" choices={choicesByKind['image-poll']} uploading={uploading} onAdd={addChoice} onRemove={removeChoice} onFile={choiceFileChanged} onRemoveImage={removeChoiceImage} uploadMessage={uploadMessage} />}
        {kind === 'text-poll' && <ChoiceTextFields kind="text-poll" choices={choicesByKind['text-poll']} touched={choiceTouched} uploading={uploading} uploadMessage={uploadMessage} onTouch={(id) => setChoiceTouched((current) => current.includes(id) ? current : [...current, id])} onUpdate={(id, text) => updateChoices('text-poll', (current) => current.map((choice) => choice.id === id ? { ...choice, text } : choice))} onAdd={addChoice} onRemove={removeChoice} onFile={(id, file) => choiceFileChanged('text-poll', id, file)} onRemoveImage={(id) => removeChoiceImage('text-poll', id)} />}
        {kind === 'quiz' && <QuizFields choices={choicesByKind.quiz} correctOptionId={correctOptionId} touched={choiceTouched} uploading={uploading} uploadMessage={uploadMessage} onTouch={(id) => setChoiceTouched((current) => current.includes(id) ? current : [...current, id])} onUpdate={(id, text) => updateChoices('quiz', (current) => current.map((choice) => choice.id === id ? { ...choice, text } : choice))} onCorrect={setCorrectOptionId} onAdd={() => addChoice('quiz')} onRemove={(id) => removeChoice('quiz', id)} onFile={(id, file) => choiceFileChanged('quiz', id, file)} onRemoveImage={(id) => removeChoiceImage('quiz', id)} />}
        {kind === 'video' && <div className="ytc-mode-content ytc-video-form">
          <label className="ytc-field-label" htmlFor="ytc-video-url">Link do vídeo do YouTube</label>
          <div className="ytc-url-field"><Link2 size={16} aria-hidden="true" /><input id="ytc-video-url" type="url" value={videoUrl} onChange={(event) => { setVideoUrl(event.target.value); if (videoTouched) setVideoError(event.target.value.trim() && !youtubeVideoId(event.target.value) ? 'Informe um endereço válido do YouTube.' : '') }} onBlur={validateVideoOnBlur} aria-invalid={Boolean(videoError)} aria-describedby={videoError ? 'ytc-video-error' : 'ytc-video-help'} placeholder="https://www.youtube.com/watch?v=…" /></div>
          {videoError && <p id="ytc-video-error" className="ytc-inline-message ytc-inline-message--error" role="alert">{videoError}</p>}
          {!videoError && <p id="ytc-video-help" className="ytc-field-help">Aceita endereços youtube.com/watch, youtube.com/shorts e youtu.be.</p>}
          {selectedVideoId && <div className="ytc-video-preview"><div><Video size={22} aria-hidden="true" /><span>Prévia local do vídeo</span></div><code>ID: {selectedVideoId}</code><small>O vídeo não é carregado nem enviado durante a edição.</small></div>}
        </div>}
      </div>

      <aside className="ytc-preview" aria-label="Prévia local da publicação">
        <div className="ytc-preview-heading"><div><span className="eyebrow">PRÉVIA LOCAL</span><strong>Comunidade</strong></div><span className="ytc-visibility-chip">{VISIBILITY_COPY[visibility]}</span></div>
        <div className="ytc-post-card">
          <div className="ytc-post-account"><span className="ytc-post-avatar"><Video size={17} aria-hidden="true" /></span><div><strong>Seu canal</strong><small>Prévia neste dispositivo</small></div><span className="ytc-post-menu" aria-hidden="true">•••</span></div>
          <p className="ytc-post-description">{descriptions[kind].trim() || 'A descrição deste formato aparece aqui.'}</p>
          {kind === 'image' && <div className={`ytc-preview-images ${images.length === 1 ? 'ytc-preview-images--single' : ''}`}>{images.length ? images.slice(0, 6).map((image) => <img key={image.id} src={image.dataUrl} alt="" />) : <div className="ytc-preview-empty"><Image size={24} aria-hidden="true" /><span>As imagens aparecerão aqui</span></div>}</div>}
          {kind === 'image-poll' && <div className="ytc-preview-choice-grid">{choicesByKind['image-poll'].map((choice, index) => <div className="ytc-preview-choice" key={choice.id}>{choice.image ? <img src={choice.image.dataUrl} alt="" /> : <span><ImagePlus size={19} aria-hidden="true" /> Opção {index + 1}</span>}</div>)}</div>}
          {kind === 'text-poll' && <div className="ytc-preview-text-options">{choicesByKind['text-poll'].map((choice, index) => <div key={choice.id}>{choice.text.trim() || `Opção ${index + 1}`}<span /></div>)}</div>}
          {kind === 'quiz' && <div className="ytc-preview-text-options">{choicesByKind.quiz.map((choice, index) => <div key={choice.id} className={correctOptionId === choice.id ? 'ytc-preview-correct' : ''}>{choice.image && <img src={choice.image.dataUrl} alt="" />}{choice.text.trim() || `Resposta ${index + 1}`}{correctOptionId === choice.id && <Check size={14} aria-label="Resposta correta" />}</div>)}</div>}
          {kind === 'video' && <div className="ytc-preview-video">{selectedVideoId ? <><Video size={25} aria-hidden="true" /><span>Link do YouTube</span><code>{selectedVideoId}</code></> : <><Video size={25} aria-hidden="true" /><span>O vídeo aparecerá aqui depois de adicionar um link válido.</span></>}</div>}
          <div className="ytc-post-actions"><span>♡</span><span>◯</span><span>↗</span><span>▱</span></div>
        </div>
        <p className="ytc-preview-note">A prévia representa o rascunho; nada é publicado.</p>
      </aside>
    </div>

    <div className="ytc-footer">
      <div className="ytc-footer-note"><ShieldCheck size={15} aria-hidden="true" /><span>Rascunho privado neste dispositivo. Nenhum conteúdo é enviado ao YouTube.</span></div>
      <div className="ytc-footer-actions"><button className="ytc-save-button" type="button" onClick={() => void saveDraft()} disabled={saving || uploading}>{saving ? 'Salvando…' : 'Salvar rascunho local'}</button><button className="ytc-post-button" type="button" disabled aria-describedby="ytc-publish-explanation">Postar <ChevronDown size={15} aria-hidden="true" /></button></div>
    </div>
    <p className="ytc-publish-explanation" id="ytc-publish-explanation">A publicação direta fica bloqueada até configurar credenciais seguras e autorizar permissões de escrita.</p>
    {deleteError && <p className="ytc-inline-message ytc-inline-message--error" role="alert">{deleteError}</p>}

    {savedDrafts.length > 0 && <section className="ytc-saved-drafts" aria-labelledby="ytc-saved-title">
      <div className="ytc-saved-heading"><div><h3 id="ytc-saved-title">Rascunhos do YouTube</h3><p>Guardados somente neste dispositivo.</p></div><button className="ytc-new-button" type="button" onClick={resetForm}><Plus size={15} aria-hidden="true" /> Novo rascunho</button></div>
      <div className="ytc-draft-list">{savedDrafts.map((draft) => <div className={`ytc-draft-row ${activeDraftId === draft.id ? 'ytc-draft-row--active' : ''}`} key={draft.id}>
        <button className="ytc-draft-open" type="button" onClick={() => restoreDraft(draft)}><span className="ytc-draft-kind">{kindIcon(draft.type)}</span><span className="ytc-draft-copy"><strong>{draftTitle(draft)}</strong><small>{KIND_COPY[draft.type].label} · {new Date(draft.updatedAt).toLocaleString('pt-BR')}</small></span></button>
        <button className="ytc-remove-button ytc-draft-delete" type="button" aria-label={`Excluir rascunho ${draftTitle(draft)}`} title="Excluir rascunho deste dispositivo" onClick={() => void deleteDraft(draft.id)}><Trash2 size={16} /></button>
      </div>)}</div>
    </section>}
  </section>
}

function ChoiceImageFields({ kind, choices, uploading, uploadMessage, onAdd, onRemove, onFile, onRemoveImage }: {
  kind: ChoiceKind
  choices: Choice[]
  uploading: boolean
  uploadMessage: string
  onAdd: (kind: ChoiceKind) => void
  onRemove: (kind: ChoiceKind, id: string) => void
  onFile: (kind: ChoiceKind, id: string, file?: File) => void
  onRemoveImage: (kind: ChoiceKind, id: string) => void
}) {
  return <div className="ytc-mode-content">
    <div className="ytc-section-title"><div><h4>Imagens da enquete</h4><p>Adicione uma imagem em cada opção. Use proporção de 2:5 a 5:2.</p></div><span className="ytc-count">{choices.filter((choice) => choice.image).length}/{choices.length}</span></div>
    <div className="ytc-options-list">{choices.map((choice, index) => <div className="ytc-image-choice-row" key={choice.id}>
      <div className="ytc-option-number">{index + 1}</div>
      {choice.image ? <div className="ytc-option-image"><img src={choice.image.dataUrl} alt={`Imagem da opção ${index + 1}: ${choice.image.name}`} /><span>{choice.image.width} × {choice.image.height}</span><button type="button" className="ytc-inline-remove" aria-label={`Remover imagem da opção ${index + 1}`} onClick={() => onRemoveImage(kind, choice.id)}><Trash2 size={15} /></button></div> : <div className="ytc-option-upload"><input id={`ytc-choice-${choice.id}`} className="ytc-file-input" type="file" accept={IMAGE_ACCEPT} disabled={uploading} aria-label={`Carregar imagem para a opção ${index + 1}`} onChange={(event) => { const file = event.currentTarget.files?.[0]; onFile(kind, choice.id, file); event.currentTarget.value = '' }} /><label htmlFor={`ytc-choice-${choice.id}`}><ImagePlus size={17} /><span>{uploading ? 'Lendo…' : 'Carregar imagem'}</span></label></div>}
      <button className="ytc-remove-button" type="button" disabled={choices.length <= 2} aria-label={`Excluir opção ${index + 1}`} title="Excluir opção" onClick={() => onRemove(kind, choice.id)}><Trash2 size={16} /></button>
    </div>)}</div>
    {uploadMessage && <p className="ytc-inline-message" role="status" aria-live="polite">{uploadMessage}</p>}
    <button className="ytc-add-option" type="button" onClick={() => onAdd(kind)}><Plus size={16} aria-hidden="true" /> Adicionar opção de imagem</button>
  </div>
}

function ChoiceTextFields({ kind, choices, touched, uploading, uploadMessage, onTouch, onUpdate, onAdd, onRemove, onFile, onRemoveImage }: {
  kind: ChoiceKind
  choices: Choice[]
  touched: string[]
  uploading: boolean
  uploadMessage: string
  onTouch: (id: string) => void
  onUpdate: (id: string, text: string) => void
  onAdd: (kind: ChoiceKind) => void
  onRemove: (kind: ChoiceKind, id: string) => void
  onFile: (id: string, file?: File) => void
  onRemoveImage: (id: string) => void
}) {
  return <div className="ytc-mode-content">
    <div className="ytc-section-title"><div><h4>Opções de resposta</h4><p>Cada alternativa aceita até 65 caracteres e pode ter uma imagem.</p></div><span className="ytc-count">{choices.length} opções</span></div>
    <div className="ytc-options-list">{choices.map((choice, index) => <div className="ytc-text-choice-row" key={choice.id}>
      <div className="ytc-option-number">{index + 1}</div>
      <div className="ytc-text-choice-main">
        <div className="ytc-choice-input-wrap"><label className="sr-only" htmlFor={`ytc-text-choice-${choice.id}`}>Texto da opção {index + 1}</label><input id={`ytc-text-choice-${choice.id}`} type="text" maxLength={65} value={choice.text} onChange={(event) => onUpdate(choice.id, event.target.value)} onBlur={() => onTouch(choice.id)} aria-invalid={touched.includes(choice.id) && !choice.text.trim()} placeholder={`Opção ${index + 1}`} /><small>{choice.text.length}/65</small></div>
        {choice.image ? <div className="ytc-quiz-image-preview"><img src={choice.image.dataUrl} alt={`Imagem da opção ${index + 1}: ${choice.image.name}`} /><span>{choice.image.width} × {choice.image.height}</span><button className="ytc-inline-remove" type="button" aria-label={`Remover imagem da opção ${index + 1}`} onClick={() => onRemoveImage(choice.id)}><Trash2 size={15} /></button></div> : <div className="ytc-quiz-image-upload"><input id={`ytc-text-image-${choice.id}`} className="ytc-file-input" type="file" accept={IMAGE_ACCEPT} disabled={uploading} aria-label={`Adicionar imagem à opção ${index + 1}`} onChange={(event) => { const file = event.currentTarget.files?.[0]; onFile(choice.id, file); event.currentTarget.value = '' }} /><label htmlFor={`ytc-text-image-${choice.id}`}><ImagePlus size={15} aria-hidden="true" /> Adicionar imagem opcional</label></div>}
        {touched.includes(choice.id) && !choice.text.trim() && <span className="ytc-choice-error" role="alert">Digite uma alternativa.</span>}
      </div>
      <button className="ytc-remove-button" type="button" disabled={choices.length <= 2} aria-label={`Excluir opção ${index + 1}`} title="Excluir opção" onClick={() => onRemove(kind, choice.id)}><Trash2 size={16} /></button>
    </div>)}</div>
    {uploadMessage && <p className="ytc-inline-message" role="status" aria-live="polite">{uploadMessage}</p>}
    <button className="ytc-add-option" type="button" onClick={() => onAdd(kind)}><Plus size={16} aria-hidden="true" /> Adicionar opção</button>
  </div>
}
function QuizFields({ choices, correctOptionId, touched, uploading, uploadMessage, onTouch, onUpdate, onCorrect, onAdd, onRemove, onFile, onRemoveImage }: {
  choices: Choice[]
  correctOptionId: string | null
  touched: string[]
  uploading: boolean
  uploadMessage: string
  onTouch: (id: string) => void
  onUpdate: (id: string, text: string) => void
  onCorrect: (id: string) => void
  onAdd: () => void
  onRemove: (id: string) => void
  onFile: (id: string, file?: File) => void
  onRemoveImage: (id: string) => void
}) {
  return <div className="ytc-mode-content">
    <div className="ytc-section-title"><div><h4>Alternativas do teste</h4><p>Inclua texto de até 65 caracteres, imagem opcional e marque uma resposta correta.</p></div><span className="ytc-count">{choices.length} opções</span></div>
    <div className="ytc-options-list">{choices.map((choice, index) => <div className={`ytc-quiz-choice ${correctOptionId === choice.id ? 'ytc-quiz-choice--correct' : ''}`} key={choice.id}>
      <div className="ytc-quiz-main"><div className="ytc-choice-input-wrap"><label className="sr-only" htmlFor={`ytc-quiz-choice-${choice.id}`}>Texto da alternativa {index + 1}</label><input id={`ytc-quiz-choice-${choice.id}`} type="text" maxLength={65} value={choice.text} onChange={(event) => onUpdate(choice.id, event.target.value)} onBlur={() => onTouch(choice.id)} aria-invalid={touched.includes(choice.id) && !choice.text.trim()} placeholder={`Alternativa ${index + 1}`} /><small>{choice.text.length}/65</small></div>
        <label className="ytc-correct-toggle"><input type="radio" name="ytc-correct-answer" value={choice.id} checked={correctOptionId === choice.id} onChange={() => onCorrect(choice.id)} /><span className="ytc-correct-check"><Check size={13} aria-hidden="true" /></span><span>Correta</span></label>
        <button className="ytc-remove-button" type="button" disabled={choices.length <= 2} aria-label={`Excluir alternativa ${index + 1}`} title="Excluir alternativa" onClick={() => onRemove(choice.id)}><Trash2 size={16} /></button>
      </div>
      <div className="ytc-quiz-image-line">{choice.image ? <div className="ytc-quiz-image-preview"><img src={choice.image.dataUrl} alt={`Imagem da alternativa ${index + 1}: ${choice.image.name}`} /><span>{choice.image.width} × {choice.image.height}</span><button className="ytc-inline-remove" type="button" aria-label={`Remover imagem da alternativa ${index + 1}`} onClick={() => onRemoveImage(choice.id)}><Trash2 size={15} /></button></div> : <div className="ytc-quiz-image-upload"><input id={`ytc-quiz-image-${choice.id}`} className="ytc-file-input" type="file" accept={IMAGE_ACCEPT} disabled={uploading} aria-label={`Adicionar imagem à alternativa ${index + 1}`} onChange={(event) => { const file = event.currentTarget.files?.[0]; onFile(choice.id, file); event.currentTarget.value = '' }} /><label htmlFor={`ytc-quiz-image-${choice.id}`}><ImagePlus size={15} /> Adicionar imagem à alternativa</label></div>}
        {touched.includes(choice.id) && !choice.text.trim() && <span className="ytc-choice-error" role="alert">Digite uma alternativa.</span>}
      </div>
    </div>)}</div>
    {uploadMessage && <p className="ytc-inline-message" role="status" aria-live="polite">{uploadMessage}</p>}
    <button className="ytc-add-option" type="button" onClick={onAdd}><Plus size={16} aria-hidden="true" /> Adicionar alternativa</button>
    {!correctOptionId && <p className="ytc-field-help">Marque uma opção como correta para completar o teste.</p>}
  </div>
}
