import { Check, Info, X } from 'lucide-react'

export function Toast({ message, onClose, kind = 'success' }: { message: string; onClose: () => void; kind?: 'success' | 'info' }) {
  return <div className="toast" role="status"><span className={`toast-icon toast-icon--${kind}`}>{kind === 'success' ? <Check size={16} /> : <Info size={16} />}</span><span>{message}</span><button className="toast-close" onClick={onClose} aria-label="Fechar aviso"><X size={15} /></button></div>
}
