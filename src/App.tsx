import { useEffect, useState } from 'react'
import type { Product } from './types'
import { totalKg } from './types'
import BinCard from './components/BinCard'
import AddProductModal from './components/AddProductModal'
import SyncReviewModal, { type SyncPreviewItem, type SyncLogEntry } from './components/SyncReviewModal'

const BINS_PER_ROW = 3
const UNIT_LABELS  = ['A', 'B']

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

type Filter = 'all' | 'low' | 'out'

export default function App() {
  const [products, setProducts]             = useState<Product[]>([])
  const [loading, setLoading]               = useState(true)
  const [syncing, setSyncing]               = useState(false)
  const [importing, setImporting]           = useState(false)
  const [importMsg, setImportMsg]           = useState<string | null>(null)
  const [syncLog, setSyncLog]               = useState<SyncLogEntry[] | null>(null)
  const [syncPreviewItems, setSyncPreview]  = useState<SyncPreviewItem[]>([])
  const [syncOrderIds, setSyncOrderIds]     = useState<number[]>([])
  const [showSyncReview, setShowSyncReview] = useState(false)
  const [error, setError]                   = useState('')
  const [filter, setFilter]                 = useState<Filter>('all')
  const [search, setSearch]                 = useState('')
  const [showAdd, setShowAdd]               = useState(false)
  const [editProduct, setEditProduct]       = useState<Product | null>(null)

  async function load() {
    setLoading(true)
    try {
      const data = await fetch('/api/inventory').then(r => r.json())
      setProducts(data.products ?? [])
    } catch {
      setError('Failed to load inventory')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function importProducts() {
    setImporting(true)
    setImportMsg(null)
    setError('')
    try {
      const res  = await fetch('/api/inventory/import', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setImportMsg(`Imported ${data.added} new product${data.added !== 1 ? 's' : ''} from Shopify (${data.total} total)`)
      await load()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  async function syncOrders() {
    setSyncing(true)
    setError('')
    setSyncLog(null)
    try {
      const res  = await fetch('/api/inventory/sync', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      if (data.items.length === 0) {
        if (data.orderIds.length > 0) {
          await fetch('/api/inventory/sync/apply', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ assignments: [], orderIds: data.orderIds }),
          })
        }
        setSyncLog([])
      } else {
        setSyncPreview(data.items)
        setSyncOrderIds(data.orderIds)
        setShowSyncReview(true)
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  function handleSyncApplied(log: SyncLogEntry[]) {
    setSyncLog(log)
    setShowSyncReview(false)
    setSyncPreview([])
    setSyncOrderIds([])
    load()
  }

  async function deleteProduct(id: string) {
    await fetch(`/api/inventory/product/${id}`, { method: 'DELETE' })
    setProducts(prev => prev.filter(p => p.id !== id))
  }

  function handleSaved(product: Product) {
    setProducts(prev => {
      const idx = prev.findIndex(p => p.id === product.id)
      if (idx >= 0) { const next = [...prev]; next[idx] = product; return next }
      return [...prev, product]
    })
  }

  const outCount = products.filter(p => totalKg(p) <= 0).length
  const lowCount = products.filter(p => totalKg(p) > 0 && totalKg(p) <= 5).length

  const filtered = products.filter(p => {
    const kg = totalKg(p)
    if (filter === 'out' && kg > 0) return false
    if (filter === 'low' && kg > 5) return false
    if (search) {
      const q = search.toLowerCase()
      return p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)
    }
    return true
  })

  const unitGroups = [1, 2]
    .map(u => ({ u, rows: chunk(filtered.filter(p => (p.unit ?? 1) === u), BINS_PER_ROW) }))
    .filter(({ rows }) => rows.length > 0)

  return (
    <div className="min-h-screen" style={{ background: '#F1F5F9' }}>

      {/* ── Header ── */}
      <header style={{ background: '#FFFFFF', borderBottom: '1px solid #E2E8F0', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
        <div className="max-w-screen-2xl mx-auto px-6 py-3 flex flex-wrap gap-4 items-center justify-between">

          {/* Logo + title */}
          <div className="flex items-center gap-3">
            <img
              src="/logo.svg"
              alt="SRT"
              style={{ height: 36, width: 'auto' }}
              onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
            />
            <div style={{ borderLeft: '1px solid #E2E8F0', paddingLeft: 12 }}>
              <h1 className="text-sm font-bold tracking-widest" style={{ color: '#0F172A' }}>STOCK ROOM</h1>
              <p className="text-[11px]" style={{ color: '#94A3B8' }}>
                {products.length} products ·{' '}
                <span style={{ color: '#DC2626' }}>{outCount} out</span>
                {' · '}
                <span style={{ color: '#D97706' }}>{lowCount} low</span>
              </p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Search */}
            <input
              type="text"
              placeholder="Search name or SKU…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="rounded-lg px-3 py-2 text-sm w-48 outline-none transition-all duration-150"
              style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', color: '#0F172A' }}
              onFocus={e => { e.currentTarget.style.borderColor = '#6366F1'; e.currentTarget.style.boxShadow = '0 0 0 3px #6366F115' }}
              onBlur={e => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.boxShadow = 'none' }}
            />

            {/* Filters */}
            {(['all', 'low', 'out'] as Filter[]).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className="px-3 py-2 rounded-lg text-xs font-bold tracking-wide cursor-pointer transition-all duration-150"
                style={filter === f
                  ? { background: '#0F172A', color: '#FFFFFF' }
                  : { background: '#F8FAFC', color: '#64748B', border: '1px solid #E2E8F0' }}>
                {f === 'all' ? 'ALL' : f === 'low' ? `LOW (${lowCount})` : `OUT (${outCount})`}
              </button>
            ))}

            {/* Import */}
            <button onClick={importProducts} disabled={importing}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold cursor-pointer transition-all duration-150 disabled:opacity-40"
              style={{ background: '#EEF2FF', color: '#4F46E5', border: '1px solid #C7D2FE' }}>
              <svg className={`w-3.5 h-3.5 ${importing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              {importing ? 'IMPORTING…' : 'IMPORT SHOPIFY'}
            </button>

            {/* Sync */}
            <button onClick={syncOrders} disabled={syncing}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold cursor-pointer transition-all duration-150 disabled:opacity-40"
              style={{ background: '#F0FDF4', color: '#16A34A', border: '1px solid #BBF7D0' }}>
              <svg className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h5M20 20v-5h-5M4 9a9 9 0 0114.13-3.13M20 15A9 9 0 015.87 18.13" />
              </svg>
              {syncing ? 'SYNCING…' : 'SYNC ORDERS'}
            </button>

            {/* Add */}
            <button onClick={() => setShowAdd(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold cursor-pointer transition-all duration-150"
              style={{ background: '#0F172A', color: '#FFFFFF' }}>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              ADD PRODUCT
            </button>
          </div>
        </div>
      </header>

      {/* ── Import banner ── */}
      {importMsg && (
        <div className="max-w-screen-2xl mx-auto px-6 pt-4">
          <div className="rounded-xl px-5 py-3 flex items-center justify-between"
            style={{ background: '#EEF2FF', border: '1px solid #C7D2FE' }}>
            <span className="text-xs font-semibold" style={{ color: '#4F46E5' }}>{importMsg}</span>
            <button onClick={() => setImportMsg(null)} className="text-sm cursor-pointer ml-4"
              style={{ color: '#A5B4FC' }} aria-label="Dismiss">✕</button>
          </div>
        </div>
      )}

      {/* ── Sync log banner ── */}
      {syncLog !== null && (
        <div className="max-w-screen-2xl mx-auto px-6 pt-4">
          <div className="rounded-xl px-5 py-4" style={{ background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold tracking-widest" style={{ color: '#15803D' }}>
                {syncLog.length === 0
                  ? 'NO NEW ORDERS'
                  : `SYNCED — ${syncLog.filter(l => !l.skipped).length} deducted · ${syncLog.filter(l => l.skipped).length} logged`}
              </span>
              <button onClick={() => setSyncLog(null)} className="text-sm cursor-pointer" style={{ color: '#86EFAC' }}
                aria-label="Dismiss">✕</button>
            </div>
            {syncLog.map((l, i) => (
              <div key={i} className="text-xs font-mono py-1 flex items-center gap-1.5 flex-wrap"
                style={{ color: '#64748B', borderTop: i > 0 ? '1px solid #DCFCE7' : 'none' }}>
                <span style={{ color: '#475569' }}>#{l.order}</span>
                <span>→</span>
                <span style={{ color: '#1E293B', fontWeight: 600 }}>{l.product}</span>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold"
                  style={{
                    background: l.packageType === '5kg' ? '#FEF3C7' : l.packageType === 'bucket' ? '#F1F5F9' : '#EEF2FF',
                    color: l.packageType === '5kg' ? '#B45309' : l.packageType === 'bucket' ? '#64748B' : '#4F46E5',
                  }}>
                  {l.packageType === '1kg' ? '1 KG' : l.packageType === '5kg' ? '5 KG' : 'BUCKET'}
                </span>
                {l.skipped ? (
                  <span style={{ color: '#94A3B8' }}>×{l.deducted} not deducted</span>
                ) : (
                  <>
                    <span style={{ color: '#DC2626' }}>−{l.deducted}</span>
                    <span style={{ color: '#94A3B8' }}>({l.before} → {l.after})</span>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Main ── */}
      <main className="max-w-screen-2xl mx-auto px-4 py-6">

        {error && (
          <div className="mb-4 px-4 py-3 rounded-xl text-sm"
            style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626' }}>
            {error}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-2 gap-6">
            {[1, 2].map(u => (
              <div key={u}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="rounded-lg animate-pulse" style={{ background: '#E2E8F0', width: 100, height: 28 }} />
                  <div className="flex-1 h-px" style={{ background: '#E2E8F0' }} />
                </div>
                <div className="space-y-3 pl-4">
                  {[1, 2, 3].map(r => (
                    <div key={r} className="flex gap-3 items-start">
                      <div className="w-12 shrink-0" />
                      <div className="flex-1 rounded-xl p-3"
                        style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${BINS_PER_ROW}, 1fr)` }}>
                          {Array.from({ length: BINS_PER_ROW }).map((_, i) => (
                            <div key={i} className="rounded-lg animate-pulse" style={{ background: '#F1F5F9', height: 110 }} />
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-28">
            <svg className="w-12 h-12 mx-auto mb-4" style={{ color: '#CBD5E1' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 7l-8-4-8 4m16 0v10l-8 4M4 7v10l8 4" />
            </svg>
            <p className="text-sm font-bold tracking-widest mb-1" style={{ color: '#CBD5E1' }}>STOCK ROOM EMPTY</p>
            <p className="text-xs mb-4" style={{ color: '#E2E8F0' }}>Add your first product to get started</p>
            <button onClick={() => setShowAdd(true)}
              className="px-5 py-2.5 rounded-lg text-xs font-bold cursor-pointer"
              style={{ background: '#0F172A', color: '#FFFFFF' }}>
              + ADD PRODUCT
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24 text-sm font-bold tracking-widest" style={{ color: '#CBD5E1' }}>
            NO PRODUCTS MATCH
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-6">
            {unitGroups.map(({ u, rows }) => (
              <div key={u}>

                {/* Unit header */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
                    style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
                    <span className="text-[9px] font-bold tracking-widest" style={{ color: '#94A3B8' }}>SHELF UNIT</span>
                    <span className="text-sm font-bold font-mono" style={{ color: '#475569' }}>{UNIT_LABELS[u - 1]}</span>
                  </div>
                  <div className="flex-1 h-px" style={{ background: 'linear-gradient(to right, #E2E8F0, transparent)' }} />
                </div>

                {/* Rows */}
                <div className="space-y-3 pl-4">
                  {rows.map((row, ri) => (
                    <div key={ri} className="flex gap-2 items-start">

                      {/* Row label */}
                      <div className="w-12 shrink-0 flex flex-col items-center gap-0.5 pt-2">
                        <span className="text-[8px] font-bold tracking-widest" style={{ color: '#CBD5E1' }}>ROW</span>
                        <span className="text-base font-bold font-mono leading-none" style={{ color: '#94A3B8' }}>
                          {String(ri + 1).padStart(2, '0')}
                        </span>
                        <div className="w-px mt-1" style={{ background: 'linear-gradient(to bottom, #E2E8F0, transparent)', height: 30 }} />
                      </div>

                      {/* Shelf surface */}
                      <div className="flex-1 rounded-xl p-2.5"
                        style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', boxShadow: '0 1px 6px rgba(0,0,0,0.05)' }}>
                        <div className="h-0.5 rounded-full mb-2"
                          style={{ background: 'linear-gradient(to right, #F1F5F9, #CBD5E1, #F1F5F9)' }} />

                        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${BINS_PER_ROW}, 1fr)` }}>
                          {row.map(p => (
                            <BinCard key={p.id} product={p}
                              onEdit={prod => { setEditProduct(prod); setShowAdd(true) }}
                              onDelete={deleteProduct} />
                          ))}
                          {Array.from({ length: BINS_PER_ROW - row.length }).map((_, i) => (
                            <div key={`e-${i}`} className="rounded-lg cursor-pointer transition-colors duration-150"
                              style={{ background: '#FAFAFA', border: '1.5px dashed #E2E8F0', minHeight: 80 }}
                              onClick={() => setShowAdd(true)} />
                          ))}
                        </div>

                        <div className="h-0.5 rounded-full mt-2" style={{ background: '#F1F5F9' }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Modals */}
      {showAdd && (
        <AddProductModal
          editProduct={editProduct}
          onClose={() => { setShowAdd(false); setEditProduct(null) }}
          onAdded={handleSaved}
        />
      )}
      {showSyncReview && (
        <SyncReviewModal
          items={syncPreviewItems}
          orderIds={syncOrderIds}
          onApplied={handleSyncApplied}
          onClose={() => setShowSyncReview(false)}
        />
      )}
    </div>
  )
}
