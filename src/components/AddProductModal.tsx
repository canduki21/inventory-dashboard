import { useState } from 'react'
import type { Product } from '../types'

interface Props {
  onClose: () => void
  onAdded: (product: Product) => void
  editProduct?: Product | null
}

export default function AddProductModal({ onClose, onAdded, editProduct }: Props) {
  const [name, setName]     = useState(editProduct?.name ?? '')
  const [sku, setSku]       = useState(editProduct?.sku ?? '')
  const [qty, setQty]       = useState(String(editProduct?.quantity ?? ''))
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  async function save() {
    if (!name.trim() || qty === '') return
    setSaving(true)
    setError('')
    try {
      const isEdit = !!editProduct
      const res = await fetch(
        isEdit ? `/api/inventory/product/${editProduct!.id}` : '/api/inventory/product',
        {
          method: isEdit ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name.trim(), sku: sku.trim(), quantity: Number(qty) }),
        }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      onAdded(data)
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50"
      style={{ background: 'rgba(2,6,23,0.85)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}>
      <div className="w-full max-w-sm mx-4 rounded-2xl p-6"
        style={{ background: '#0F172A', border: '1px solid #1E293B', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}
        onClick={e => e.stopPropagation()}>

        <h2 className="text-sm font-bold font-mono tracking-widest mb-5" style={{ color: '#F8FAFC' }}>
          {editProduct ? 'EDIT PRODUCT' : 'ADD PRODUCT'}
        </h2>

        <label className="block text-xs font-bold tracking-widest mb-1" style={{ color: '#64748B' }}>PRODUCT NAME</label>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. LHS-1 Lunar Simulant"
          className="w-full rounded-lg px-3 py-2.5 text-sm outline-none mb-4 transition-all duration-150"
          style={{ background: '#1E293B', border: '1px solid #334155', color: '#F8FAFC' }}
          onFocus={e => { e.currentTarget.style.borderColor = '#22C55E' }}
          onBlur={e => { e.currentTarget.style.borderColor = '#334155' }}
          autoFocus
        />

        <label className="block text-xs font-bold tracking-widest mb-1" style={{ color: '#64748B' }}>SKU <span style={{ color: '#334155' }}>(must match Shopify)</span></label>
        <input
          value={sku}
          onChange={e => setSku(e.target.value)}
          placeholder="e.g. LHS-1-25A"
          className="w-full rounded-lg px-3 py-2.5 text-sm outline-none mb-4 transition-all duration-150 font-mono"
          style={{ background: '#1E293B', border: '1px solid #334155', color: '#F8FAFC' }}
          onFocus={e => { e.currentTarget.style.borderColor = '#22C55E' }}
          onBlur={e => { e.currentTarget.style.borderColor = '#334155' }}
        />

        <label className="block text-xs font-bold tracking-widest mb-1" style={{ color: '#64748B' }}>QUANTITY IN STOCK</label>
        <input
          type="number"
          min="0"
          value={qty}
          onChange={e => setQty(e.target.value)}
          className="w-full rounded-lg px-3 py-3 text-3xl font-bold font-mono text-center outline-none mb-5 transition-all duration-150"
          style={{ background: '#1E293B', border: '1px solid #334155', color: '#22C55E' }}
          onFocus={e => { e.currentTarget.style.borderColor = '#22C55E'; e.currentTarget.style.boxShadow = '0 0 0 2px #22C55E33' }}
          onBlur={e => { e.currentTarget.style.borderColor = '#334155'; e.currentTarget.style.boxShadow = 'none' }}
        />

        {error && <p className="text-xs font-mono mb-3 px-3 py-2 rounded-lg" style={{ background: '#EF444415', color: '#FCA5A5' }}>{error}</p>}

        <div className="flex gap-2">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-lg text-xs font-bold tracking-wide cursor-pointer"
            style={{ background: '#1E293B', color: '#64748B', border: '1px solid #334155' }}>
            CANCEL
          </button>
          <button onClick={save} disabled={saving || !name.trim() || qty === ''}
            className="flex-1 py-2.5 rounded-lg text-xs font-bold tracking-wide cursor-pointer disabled:opacity-40"
            style={{ background: '#22C55E', color: '#020617' }}>
            {saving ? 'SAVING…' : editProduct ? 'SAVE CHANGES' : 'ADD TO STOCK'}
          </button>
        </div>
      </div>
    </div>
  )
}
