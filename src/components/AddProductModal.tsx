import { useState } from 'react'
import type { Product } from '../types'

interface Props {
  onClose: () => void
  onAdded: (product: Product) => void
  editProduct?: Product | null
}

export default function AddProductModal({ onClose, onAdded, editProduct }: Props) {
  const [name, setName]       = useState(editProduct?.name ?? '')
  const [sku, setSku]         = useState(editProduct?.sku ?? '')
  const [qty1kg, setQty1kg]   = useState(String(editProduct?.qty1kg ?? '0'))
  const [qty5kg, setQty5kg]   = useState(String(editProduct?.qty5kg ?? '0'))
  const [unit, setUnit]       = useState(editProduct?.unit ?? 1)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')

  async function save() {
    if (!name.trim()) return
    setSaving(true)
    setError('')
    try {
      const isEdit = !!editProduct
      const res = await fetch(
        isEdit ? `/api/inventory/product/${editProduct!.id}` : '/api/inventory/product',
        {
          method: isEdit ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name.trim(), sku: sku.trim(), qty1kg: Number(qty1kg), qty5kg: Number(qty5kg), unit }),
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

  const labelStyle = { color: '#64748B', display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', marginBottom: 4 }
  const inputStyle = { background: '#F8FAFC', border: '1px solid #E2E8F0', color: '#0F172A', outline: 'none', transition: 'border-color 0.15s' }

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50"
      style={{ background: 'rgba(15,23,42,0.4)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}>
      <div className="w-full max-w-sm mx-4 rounded-2xl p-6"
        style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}
        onClick={e => e.stopPropagation()}>

        <h2 className="text-sm font-bold tracking-widest mb-5" style={{ color: '#0F172A' }}>
          {editProduct ? 'EDIT PRODUCT' : 'ADD PRODUCT'}
        </h2>

        {/* Shelf Unit */}
        <label style={labelStyle}>SHELF UNIT</label>
        <div className="flex gap-2 mb-4">
          {([1, 2] as const).map(u => (
            <button key={u} onClick={() => setUnit(u)}
              className="flex-1 py-2 rounded-lg text-xs font-bold tracking-wide cursor-pointer transition-all duration-150"
              style={unit === u
                ? { background: '#0F172A', color: '#FFFFFF' }
                : { background: '#F8FAFC', color: '#64748B', border: '1px solid #E2E8F0' }}>
              UNIT {u === 1 ? 'A' : 'B'}
            </button>
          ))}
        </div>

        {/* Name */}
        <label style={labelStyle}>PRODUCT NAME</label>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. LHS-1"
          className="w-full rounded-lg px-3 py-2.5 text-sm mb-4"
          style={inputStyle}
          onFocus={e => { e.currentTarget.style.borderColor = '#6366F1' }}
          onBlur={e => { e.currentTarget.style.borderColor = '#E2E8F0' }}
          autoFocus
        />

        {/* SKU */}
        <label style={labelStyle}>SKU <span style={{ color: '#CBD5E1', fontWeight: 400 }}>(must match Shopify)</span></label>
        <input
          value={sku}
          onChange={e => setSku(e.target.value)}
          placeholder="e.g. LC-M9RA-IUOW"
          className="w-full rounded-lg px-3 py-2.5 text-sm mb-4 font-mono"
          style={inputStyle}
          onFocus={e => { e.currentTarget.style.borderColor = '#6366F1' }}
          onBlur={e => { e.currentTarget.style.borderColor = '#E2E8F0' }}
        />

        {/* Quantities */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div>
            <label style={{ ...labelStyle, color: '#6366F1' }}>1 KG BAGS</label>
            <input
              type="number" min="0"
              value={qty1kg}
              onChange={e => setQty1kg(e.target.value)}
              className="w-full rounded-lg px-3 py-3 text-2xl font-bold font-mono text-center"
              style={{ ...inputStyle, color: '#6366F1' }}
              onFocus={e => { e.currentTarget.style.borderColor = '#6366F1'; e.currentTarget.style.boxShadow = '0 0 0 3px #6366F120' }}
              onBlur={e => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.boxShadow = 'none' }}
            />
          </div>
          <div>
            <label style={{ ...labelStyle, color: '#D97706' }}>5 KG BAGS</label>
            <input
              type="number" min="0"
              value={qty5kg}
              onChange={e => setQty5kg(e.target.value)}
              className="w-full rounded-lg px-3 py-3 text-2xl font-bold font-mono text-center"
              style={{ ...inputStyle, color: '#D97706' }}
              onFocus={e => { e.currentTarget.style.borderColor = '#F59E0B'; e.currentTarget.style.boxShadow = '0 0 0 3px #F59E0B20' }}
              onBlur={e => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.boxShadow = 'none' }}
            />
          </div>
        </div>

        {error && (
          <p className="text-xs font-mono mb-3 px-3 py-2 rounded-lg"
            style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}>
            {error}
          </p>
        )}

        <div className="flex gap-2">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-lg text-xs font-bold tracking-wide cursor-pointer"
            style={{ background: '#F8FAFC', color: '#64748B', border: '1px solid #E2E8F0' }}>
            CANCEL
          </button>
          <button onClick={save} disabled={saving || !name.trim()}
            className="flex-1 py-2.5 rounded-lg text-xs font-bold tracking-wide cursor-pointer disabled:opacity-40"
            style={{ background: '#0F172A', color: '#FFFFFF' }}>
            {saving ? 'SAVING…' : editProduct ? 'SAVE CHANGES' : 'ADD TO STOCK'}
          </button>
        </div>
      </div>
    </div>
  )
}
