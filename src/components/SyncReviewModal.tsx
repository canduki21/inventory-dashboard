import { useState } from 'react'

export type PackageType = '1kg' | '5kg' | 'bucket'

export interface SyncPreviewItem {
  orderId: number
  orderNumber: number
  productId: string | null
  productName: string
  sku: string
  qty: number
}

export interface SyncLogEntry {
  order: number
  product: string
  sku: string
  deducted: number
  before?: number
  after?: number
  packageType: PackageType
  skipped?: boolean
}

interface Assignment extends SyncPreviewItem {
  packageType: PackageType
}

interface Props {
  items: SyncPreviewItem[]
  orderIds: number[]
  onApplied: (log: SyncLogEntry[]) => void
  onClose: () => void
}

const PKG: Record<PackageType, { label: string; activeColor: string; activeBg: string }> = {
  '1kg':    { label: '1 KG',   activeColor: '#FFFFFF', activeBg: '#6366F1' },
  '5kg':    { label: '5 KG',   activeColor: '#FFFFFF', activeBg: '#D97706' },
  'bucket': { label: 'BUCKET', activeColor: '#FFFFFF', activeBg: '#64748B' },
}

export default function SyncReviewModal({ items, orderIds, onApplied, onClose }: Props) {
  const [assignments, setAssignments] = useState<Assignment[]>(
    items.map(item => ({ ...item, packageType: '1kg' as PackageType }))
  )
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState('')

  function setPkg(idx: number, packageType: PackageType) {
    setAssignments(prev => {
      const next = [...prev]
      next[idx] = { ...next[idx], packageType }
      return next
    })
  }

  async function apply() {
    setApplying(true)
    setError('')
    try {
      const res = await fetch('/api/inventory/sync/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignments, orderIds }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      onApplied(data.log)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Apply failed')
    } finally {
      setApplying(false)
    }
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50"
      style={{ background: 'rgba(15,23,42,0.4)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}>
      <div className="w-full max-w-xl mx-4 rounded-2xl flex flex-col"
        style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', maxHeight: '80vh' }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4" style={{ borderBottom: '1px solid #F1F5F9' }}>
          <div>
            <h2 className="text-sm font-bold tracking-widest" style={{ color: '#0F172A' }}>
              NEW ORDERS — HOW WAS IT PACKAGED?
            </h2>
            <p className="text-[11px] mt-1" style={{ color: '#64748B' }}>
              {assignments.length} line item{assignments.length !== 1 ? 's' : ''} — select packaging then confirm
            </p>
          </div>
          <button onClick={onClose} className="cursor-pointer ml-4 mt-0.5 text-lg leading-none"
            style={{ color: '#CBD5E1' }} aria-label="Close">✕</button>
        </div>

        {/* Items */}
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-2">
          {assignments.map((a, i) => (
            <div key={i} className="rounded-xl px-4 py-3 flex items-center gap-3"
              style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', opacity: a.productId ? 1 : 0.5 }}>

              <span className="text-[10px] font-bold font-mono shrink-0" style={{ color: '#94A3B8' }}>
                #{a.orderNumber}
              </span>

              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold truncate" style={{ color: '#1E293B' }}>{a.productName}</p>
                {a.sku && <p className="text-[9px] font-mono" style={{ color: '#94A3B8' }}>{a.sku}</p>}
                {!a.productId && (
                  <p className="text-[9px] font-mono" style={{ color: '#EF4444' }}>not in inventory — will be skipped</p>
                )}
              </div>

              <span className="text-sm font-bold font-mono shrink-0" style={{ color: '#16A34A' }}>×{a.qty}</span>

              {a.productId ? (
                <div className="flex gap-1 shrink-0">
                  {(['1kg', '5kg', 'bucket'] as PackageType[]).map(pt => (
                    <button key={pt} onClick={() => setPkg(i, pt)}
                      className="px-2 py-1 rounded-lg text-[10px] font-bold tracking-wide cursor-pointer transition-all duration-150"
                      style={a.packageType === pt
                        ? { background: PKG[pt].activeBg, color: PKG[pt].activeColor }
                        : { background: '#FFFFFF', color: '#94A3B8', border: '1px solid #E2E8F0' }}>
                      {PKG[pt].label}
                    </button>
                  ))}
                </div>
              ) : (
                <span className="text-[9px] font-mono shrink-0" style={{ color: '#CBD5E1' }}>SKIP</span>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 flex items-center gap-3" style={{ borderTop: '1px solid #F1F5F9' }}>
          {error && <p className="text-xs font-mono flex-1" style={{ color: '#DC2626' }}>{error}</p>}
          <div className="ml-auto flex gap-2">
            <button onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-bold tracking-wide cursor-pointer"
              style={{ background: '#F8FAFC', color: '#64748B', border: '1px solid #E2E8F0' }}>
              CANCEL
            </button>
            <button onClick={apply} disabled={applying}
              className="px-4 py-2 rounded-lg text-xs font-bold tracking-wide cursor-pointer disabled:opacity-40"
              style={{ background: '#0F172A', color: '#FFFFFF' }}>
              {applying ? 'APPLYING…' : 'CONFIRM DEDUCTIONS'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
