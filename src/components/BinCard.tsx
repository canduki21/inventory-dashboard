import type { Product } from '../types'

interface Props {
  product: Product
  onEdit: (p: Product) => void
  onDelete: (id: string) => void
}

function stockColor(qty: number) {
  if (qty <= 0) return { border: '#EF4444', bg: '#EF444412', badge: 'OUT', badgeColor: '#F87171', badgeBg: '#EF444422' }
  if (qty <= 5) return { border: '#EAB308', bg: '#EAB30812', badge: 'LOW', badgeColor: '#FCD34D', badgeBg: '#EAB30822' }
  return             { border: '#22C55E', bg: '#22C55E0D', badge: 'OK',  badgeColor: '#4ADE80', badgeBg: '#22C55E22' }
}

export default function BinCard({ product, onEdit, onDelete }: Props) {
  const c = stockColor(product.quantity)

  return (
    <div className="relative flex flex-col rounded-lg overflow-hidden transition-all duration-200 hover:scale-[1.02]"
      style={{ background: '#0F172A', borderLeft: `4px solid ${c.border}`, boxShadow: `0 0 0 1px #1E293B, 0 2px 8px rgba(0,0,0,0.4)` }}>

      {/* Color band */}
      <div className="w-full h-1.5" style={{ background: c.border, opacity: 0.4 }} />

      {/* Body */}
      <div className="flex flex-col gap-1.5 px-3 pt-3 pb-2 flex-1" style={{ background: c.bg }}>
        <div className="flex items-start justify-between gap-1">
          <p className="text-xs font-semibold leading-tight" style={{ color: '#E2E8F0' }}>{product.name}</p>
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0"
            style={{ background: c.badgeBg, color: c.badgeColor }}>{c.badge}</span>
        </div>
        {product.sku && (
          <p className="text-[10px] font-mono" style={{ color: '#475569' }}>{product.sku}</p>
        )}
      </div>

      {/* Quantity */}
      <div className="px-3 py-2" style={{ borderTop: '1px solid #1E293B20' }}>
        <span className="text-3xl font-bold font-mono leading-none" style={{ color: c.border }}>
          {product.quantity}
        </span>
        <span className="text-[10px] ml-1 font-mono" style={{ color: '#334155' }}>units</span>
      </div>

      {/* Actions */}
      <div className="flex" style={{ borderTop: '1px solid #1E293B' }}>
        <button
          onClick={() => onEdit(product)}
          className="flex-1 py-2 text-[10px] font-bold tracking-wide cursor-pointer transition-colors duration-150"
          style={{ color: '#475569' }}
          onMouseEnter={e => { e.currentTarget.style.background = '#1E293B'; e.currentTarget.style.color = '#F8FAFC' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#475569' }}
          aria-label={`Edit ${product.name}`}
        >
          EDIT
        </button>
        <div style={{ width: '1px', background: '#1E293B' }} />
        <button
          onClick={() => onDelete(product.id)}
          className="flex-1 py-2 text-[10px] font-bold tracking-wide cursor-pointer transition-colors duration-150"
          style={{ color: '#475569' }}
          onMouseEnter={e => { e.currentTarget.style.background = '#EF444415'; e.currentTarget.style.color = '#F87171' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#475569' }}
          aria-label={`Delete ${product.name}`}
        >
          DEL
        </button>
      </div>
    </div>
  )
}
