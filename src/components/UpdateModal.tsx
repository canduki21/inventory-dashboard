import { useState } from 'react'
import type { InventoryItem, Location } from '../types'

interface Props {
  item: InventoryItem
  locations: Location[]
  onClose: () => void
  onSaved: (itemId: number, qty: number) => void
}

export default function UpdateModal({ item, locations, onClose, onSaved }: Props) {
  const [qty, setQty]           = useState(String(item.quantity))
  const [locationId, setLocationId] = useState(locations[0]?.id ?? '')
  const [target, setTarget]     = useState<'shopify' | 'shipstation'>('shopify')
  const [status, setStatus]     = useState<'idle' | 'saving' | 'done' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  async function save() {
    const q = parseInt(qty, 10)
    if (isNaN(q) || q < 0) return
    setStatus('saving')
    setErrorMsg('')
    try {
      if (target === 'shopify') {
        const res = await fetch('/api/inventory/shopify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ inventoryItemId: item.inventoryItemId, locationId, quantity: q }),
        })
        if (!res.ok) throw new Error((await res.json()).error)
      } else {
        const ssRes = await fetch('/api/shipstation/products')
        const ssProducts = await ssRes.json()
        const match = ssProducts.find((p: { sku: string }) => p.sku === item.sku)
        if (!match) throw new Error(`SKU "${item.sku}" not found in ShipStation`)
        const res = await fetch('/api/inventory/shipstation', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productId: match.productId, warehouseQuantity: q }),
        })
        if (!res.ok) throw new Error((await res.json()).error)
      }
      setStatus('done')
      onSaved(item.inventoryItemId, q)
      setTimeout(onClose, 700)
    } catch (e: unknown) {
      setStatus('error')
      setErrorMsg(e instanceof Error ? e.message : 'Unknown error')
    }
  }

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ background: 'rgba(2,6,23,0.85)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm mx-4 rounded-2xl p-6"
        style={{ background: '#0F172A', border: '1px solid #1E293B', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Product info */}
        <div className="flex gap-3 mb-5">
          {item.image && (
            <img src={item.image} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" style={{ background: '#1E293B' }} />
          )}
          <div>
            <h2 className="font-bold text-sm leading-tight" style={{ color: '#F8FAFC' }}>{item.title}</h2>
            {item.variantTitle !== 'Default Title' && (
              <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>{item.variantTitle}</p>
            )}
            {item.sku && (
              <p className="text-xs font-mono mt-0.5" style={{ color: '#475569' }}>{item.sku}</p>
            )}
          </div>
        </div>

        {/* Quantity input */}
        <label className="block text-xs font-bold tracking-widest mb-1.5" style={{ color: '#64748B' }}>NEW QUANTITY</label>
        <input
          type="number"
          min="0"
          value={qty}
          onChange={e => setQty(e.target.value)}
          className="w-full rounded-lg px-4 py-3 text-3xl font-bold font-mono text-center outline-none mb-4 transition-all duration-150"
          style={{ background: '#1E293B', border: '1px solid #334155', color: '#22C55E' }}
          onFocus={e => { e.currentTarget.style.borderColor = '#22C55E'; e.currentTarget.style.boxShadow = '0 0 0 2px #22C55E33' }}
          onBlur={e => { e.currentTarget.style.borderColor = '#334155'; e.currentTarget.style.boxShadow = 'none' }}
          autoFocus
        />

        {/* Location selector */}
        {locations.length > 1 && target === 'shopify' && (
          <>
            <label className="block text-xs font-bold tracking-widest mb-1.5" style={{ color: '#64748B' }}>LOCATION</label>
            <select
              value={locationId}
              onChange={e => setLocationId(Number(e.target.value))}
              className="w-full rounded-lg px-3 py-2 text-sm mb-4 outline-none cursor-pointer"
              style={{ background: '#1E293B', border: '1px solid #334155', color: '#F8FAFC' }}
            >
              {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </>
        )}

        {/* Target toggle */}
        <label className="block text-xs font-bold tracking-widest mb-1.5" style={{ color: '#64748B' }}>UPDATE IN</label>
        <div className="flex gap-2 mb-5">
          {(['shopify', 'shipstation'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTarget(t)}
              className="flex-1 py-2 rounded-lg text-xs font-bold tracking-wide transition-all duration-150 cursor-pointer"
              style={target === t
                ? { background: '#22C55E', color: '#020617' }
                : { background: '#1E293B', color: '#64748B', border: '1px solid #334155' }}
            >
              {t === 'shopify' ? 'SHOPIFY' : 'SHIPSTATION'}
            </button>
          ))}
        </div>

        {status === 'error' && (
          <p className="text-xs font-mono mb-3 px-3 py-2 rounded-lg" style={{ background: '#EF444415', color: '#FCA5A5' }}>{errorMsg}</p>
        )}

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-lg text-xs font-bold tracking-wide cursor-pointer transition-all duration-150"
            style={{ background: '#1E293B', color: '#64748B', border: '1px solid #334155' }}
          >
            CANCEL
          </button>
          <button
            onClick={save}
            disabled={status === 'saving' || status === 'done'}
            className="flex-1 py-2.5 rounded-lg text-xs font-bold tracking-wide cursor-pointer transition-all duration-150 disabled:opacity-50"
            style={{ background: status === 'done' ? '#16A34A' : '#22C55E', color: '#020617' }}
          >
            {status === 'saving' ? 'SAVING…' : status === 'done' ? 'SAVED ✓' : 'SAVE'}
          </button>
        </div>
      </div>
    </div>
  )
}
