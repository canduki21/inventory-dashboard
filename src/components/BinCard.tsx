import { totalKg } from '../types'
import type { Product } from '../types'

interface Props {
  product: Product
  onEdit: (p: Product) => void
  onDelete: (id: string) => void
}

function stockColor(kg: number) {
  if (kg <= 0)  return { border: '#EF4444', bg: '#FEF2F2', badgeColor: '#DC2626', badgeBg: '#FEE2E2', label: 'OUT' }
  if (kg <= 10) return { border: '#F59E0B', bg: '#FFFBEB', badgeColor: '#B45309', badgeBg: '#FEF3C7', label: 'LOW' }
  if (kg <= 15) return { border: '#EA580C', bg: '#FFF7ED', badgeColor: '#C2410C', badgeBg: '#FFEDD5', label: 'MOD' }
  return                { border: '#16A34A', bg: '#F0FDF4', badgeColor: '#15803D', badgeBg: '#DCFCE7', label: 'OK'  }
}

export default function BinCard({ product, onEdit, onDelete }: Props) {
  const kg = totalKg(product)
  const c  = stockColor(kg)

  return (
    <div
      className="flex flex-col rounded-lg overflow-hidden"
      style={{
        background: '#FFFFFF',
        border: `1px solid #E2E8F0`,
        borderTop: `3px solid ${c.border}`,
        boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
      }}
    >
      {/* Name + badge */}
      <div className="flex items-start justify-between gap-1 px-2.5 pt-2 pb-1" style={{ background: c.bg }}>
        <p className="text-[11px] font-semibold leading-tight line-clamp-2 flex-1" style={{ color: '#1E293B' }}>
          {product.name}
        </p>
        <span className="text-[8px] font-bold tracking-wider px-1.5 py-0.5 rounded shrink-0 mt-0.5"
          style={{ background: c.badgeBg, color: c.badgeColor }}>
          {c.label}
        </span>
      </div>

      {/* SKU */}
      {product.sku ? (
        <p className="text-[9px] font-mono px-2.5 pb-1" style={{ color: '#94A3B8' }}>{product.sku}</p>
      ) : (
        <div className="pb-1" />
      )}

      {/* Counts */}
      <div className="px-2.5 py-1.5 flex items-center gap-1" style={{ borderTop: '1px solid #F1F5F9' }}>
        <span className="text-[11px] font-bold font-mono" style={{ color: '#6366F1' }}>{product.qty1kg}</span>
        <span className="text-[8px] font-mono" style={{ color: '#94A3B8' }}>×1kg</span>
        <span className="text-[9px] mx-0.5" style={{ color: '#E2E8F0' }}>·</span>
        <span className="text-[11px] font-bold font-mono" style={{ color: '#D97706' }}>{product.qty5kg}</span>
        <span className="text-[8px] font-mono" style={{ color: '#94A3B8' }}>×5kg</span>
        <div className="ml-auto flex items-baseline gap-0.5">
          <span className="text-base font-bold font-mono leading-none" style={{ color: c.badgeColor }}>{kg}</span>
          <span className="text-[8px] font-mono" style={{ color: '#94A3B8' }}>kg</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex" style={{ borderTop: '1px solid #F1F5F9' }}>
        <button
          onClick={() => onEdit(product)}
          className="flex-1 py-1 text-[9px] font-bold tracking-wide cursor-pointer transition-colors duration-150"
          style={{ color: '#94A3B8' }}
          onMouseEnter={e => { e.currentTarget.style.background = '#F8FAFC'; e.currentTarget.style.color = '#0F172A' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#94A3B8' }}
          aria-label={`Edit ${product.name}`}
        >
          EDIT
        </button>
        <div style={{ width: '1px', background: '#F1F5F9' }} />
        <button
          onClick={() => onDelete(product.id)}
          className="flex-1 py-1 text-[9px] font-bold tracking-wide cursor-pointer transition-colors duration-150"
          style={{ color: '#94A3B8' }}
          onMouseEnter={e => { e.currentTarget.style.background = '#FEF2F2'; e.currentTarget.style.color = '#EF4444' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#94A3B8' }}
          aria-label={`Delete ${product.name}`}
        >
          DEL
        </button>
      </div>
    </div>
  )
}
