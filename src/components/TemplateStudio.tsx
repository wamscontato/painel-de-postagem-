import { useState } from 'react'
import { ArrowUpRight, ImagePlus, Layers3, Plus, Trash2, WandSparkles } from 'lucide-react'
import { CoverComposer, type CoverTemplate } from './CoverComposer'
import './TemplateStudio.css'

type Props = { templates: CoverTemplate[]; onSave: (template: CoverTemplate) => void; onDelete: (id: string) => void; onUse: (template: CoverTemplate) => void }

export function TemplateStudio({ templates, onSave, onDelete, onUse }: Props) {
  const [open, setOpen] = useState(false)
  const [current, setCurrent] = useState<CoverTemplate | null>(null)
  const launch = (template: CoverTemplate | null) => { setCurrent(template); setOpen(true) }
  return <div className="template-studio page">
    <div className="page-heading"><div><span className="eyebrow">modelos / editor visual</span><h1>Uma capa, do seu jeito.</h1><p>Monte composições, salve seus modelos e reutilize capas no criador.</p></div><button className="button button--primary" onClick={() => launch(null)}><Plus size={16}/> Criar capa</button></div>
    <section className="ts-intro"><div className="ts-intro-icon"><WandSparkles size={19}/></div><div><strong>Modelos visuais, prontos para reaplicar</strong><p>Importe sua foto ou PNG, adicione texto, marca-d’água e formas, organize camadas e salve o resultado neste navegador.</p></div><span><Layers3 size={14}/> {templates.length} {templates.length === 1 ? 'modelo salvo' : 'modelos salvos'}</span></section>
    {templates.length ? <section className="ts-gallery" aria-label="Modelos visuais salvos">{templates.map((template) => <article className="ts-card" key={template.id}><div className="ts-preview"><img src={template.previewDataUrl} alt={`Prévia do modelo ${template.name}`} loading="lazy"/><span>{template.width} × {template.height}</span></div><div className="ts-card-copy"><strong title={template.name}>{template.name || 'Capa sem nome'}</strong><span>Atualizado em {new Date(template.updatedAt).toLocaleDateString('pt-BR')}</span><div className="ts-actions"><button className="button button--primary button--compact" onClick={() => onUse(template)}><ArrowUpRight size={14}/> Usar na publicação</button><button className="button button--secondary button--compact" onClick={() => launch(template)}>Editar</button><button className="ts-delete" onClick={() => onDelete(template.id)} aria-label={`Excluir modelo ${template.name}`} title="Excluir modelo"><Trash2 size={15}/></button></div></div></article>)}</section> : <section className="ts-empty"><div className="ts-empty-art"><ImagePlus size={29}/></div><h2>Seu primeiro modelo começa aqui</h2><p>Abra o compositor, escolha o tamanho da rede, carregue uma imagem e construa uma capa reutilizável.</p><button className="button button--primary" onClick={() => launch(null)}><Plus size={16}/> Criar meu primeiro modelo</button></section>}
    <section className="ts-footnote"><strong>Como usar</strong><p>Os modelos e imagens são guardados localmente neste navegador. Em Criar publicação, escolha um modelo salvo no seletor acima de Conteúdo visual para inserir a capa exportada na publicação atual.</p></section>
    {open && <CoverComposer initialTemplate={current} onSaveTemplate={onSave} onClose={() => setOpen(false)}/>}
  </div>
}
