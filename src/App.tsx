import { useEffect, useState } from 'react'
import type { Product, SyncLog } from './types'
import BinCard from './components/BinCard'
import AddProductModal from './components/AddProductModal'

const BINS_PER_SHELF = 5

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

type Filter = 'all' | 'low' | 'out'

export default function App() {
  const [products, setProducts]   = useState<Product[]>([])
  const [loading, setLoading]     = useState(true)
  const [syncing, setSyncing]     = useState(false)
  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg] = useState<string | null>(null)
  const [syncLog, setSyncLog]     = useState<SyncLog[] | null>(null)
  const [error, setError]         = useState('')
  const [filter, setFilter]       = useState<Filter>('all')
  const [search, setSearch]       = useState('')
  const [showAdd, setShowAdd]     = useState(false)
  const [editProduct, setEditProduct] = useState<Product | null>(null)

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
      const res = await fetch('/api/inventory/import', { method: 'POST' })
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
      const res = await fetch('/api/inventory/sync', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSyncLog(data.log)
      await load()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Sync failed')
    } finally {
      setSyncing(false)
    }
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

  const outCount = products.filter(p => p.quantity <= 0).length
  const lowCount = products.filter(p => p.quantity > 0 && p.quantity <= 5).length

  const filtered = products.filter(p => {
    if (filter === 'out' && p.quantity > 0) return false
    if (filter === 'low' && p.quantity > 5) return false
    if (search) {
      const q = search.toLowerCase()
      return p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)
    }
    return true
  })

  const shelves = chunk(filtered, BINS_PER_SHELF)

  return (
    <div className="min-h-screen" style={{ background: '#020617' }}>

      {/* ── Header ── */}
      <header style={{ background: '#0F172A', borderBottom: '1px solid #1E293B' }}>
        <div className="max-w-screen-2xl mx-auto px-6 py-4 flex flex-wrap gap-4 items-center justify-between">
          <div className="flex items-center gap-3">
            <svg className="w-6 h-6" style={{ color: '#22C55E' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 6h18M3 12h18M3 18h18" />
            </svg>
            <div>
              <h1 className="text-base font-bold tracking-widest font-mono" style={{ color: '#F8FAFC' }}>STOCK ROOM</h1>
              <p className="text-xs" style={{ color: '#475569' }}>
                {products.length} products ·{' '}
                <span style={{ color: '#EF4444' }}>{outCount} out</span> ·{' '}
                <span style={{ color: '#EAB308' }}>{lowCount} low</span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              placeholder="Search name or SKU…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="rounded-lg px-3 py-2 text-sm w-52 outline-none transition-all duration-150"
              style={{ background: '#1E293B', border: '1px solid #334155', color: '#F8FAFC' }}
              onFocus={e => { e.currentTarget.style.borderColor = '#22C55E' }}
              onBlur={e => { e.currentTarget.style.borderColor = '#334155' }}
            />

            {(['all', 'low', 'out'] as Filter[]).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className="px-3 py-2 rounded-lg text-xs font-bold tracking-wide cursor-pointer transition-all duration-150"
                style={filter === f
                  ? { background: '#22C55E', color: '#020617' }
                  : { background: '#1E293B', color: '#94A3B8', border: '1px solid #334155' }}>
                {f === 'all' ? 'ALL' : f === 'low' ? `LOW (${lowCount})` : `OUT (${outCount})`}
              </button>
            ))}

            {/* Import from Shopify */}
            <button onClick={importProducts} disabled={importing}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold cursor-pointer transition-all duration-150 disabled:opacity-40"
              style={{ background: '#1E293B', color: '#818CF8', border: '1px solid #818CF844' }}>
              <svg className={`w-3.5 h-3.5 ${importing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              {importing ? 'IMPORTING…' : 'IMPORT FROM SHOPIFY'}
            </button>

            {/* Sync orders */}
            <button onClick={syncOrders} disabled={syncing}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold cursor-pointer transition-all duration-150 disabled:opacity-40"
              style={{ background: '#1E293B', color: '#22C55E', border: '1px solid #22C55E44' }}>
              <svg className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h5M20 20v-5h-5M4 9a9 9 0 0114.13-3.13M20 15A9 9 0 015.87 18.13" />
              </svg>
              {syncing ? 'SYNCING…' : 'SYNC ORDERS'}
            </button>

            {/* Add product */}
            <button onClick={() => setShowAdd(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold cursor-pointer transition-all duration-150"
              style={{ background: '#22C55E', color: '#020617' }}>
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
            style={{ background: '#0F172A', border: '1px solid #818CF844' }}>
            <span className="text-xs font-bold font-mono" style={{ color: '#818CF8' }}>{importMsg}</span>
            <button onClick={() => setImportMsg(null)} className="text-xs cursor-pointer" style={{ color: '#334155' }}
              aria-label="Dismiss">✕</button>
          </div>
        </div>
      )}

      {/* ── Sync log banner ── */}
      {syncLog !== null && (
        <div className="max-w-screen-2xl mx-auto px-6 pt-4">
          <div className="rounded-xl px-5 py-4" style={{ background: '#0F172A', border: '1px solid #22C55E44' }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold font-mono" style={{ color: '#22C55E' }}>
                {syncLog.length === 0 ? 'NO NEW ORDERS' : `SYNCED — ${syncLog.length} item${syncLog.length !== 1 ? 's' : ''} deducted`}
              </span>
              <button onClick={() => setSyncLog(null)} className="text-xs cursor-pointer" style={{ color: '#334155' }}
                aria-label="Dismiss sync log">✕</button>
            </div>
            {syncLog.map((l, i) => (
              <div key={i} className="text-xs font-mono py-1" style={{ color: '#64748B', borderTop: i > 0 ? '1px solid #1E293B' : 'none' }}>
                <span style={{ color: '#94A3B8' }}>#{l.order}</span>
                {' → '}
                <span style={{ color: '#E2E8F0' }}>{l.product}</span>
                {' '}
                <span style={{ color: '#EF4444' }}>−{l.deducted}</span>
                {' '}
                <span style={{ color: '#334155' }}>({l.before} → {l.after})</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Main ── */}
      <main className="max-w-screen-2xl mx-auto px-4 py-6">

        {error && (
          <div className="mb-4 px-4 py-3 rounded-lg text-sm font-mono"
            style={{ background: '#EF444415', border: '1px solid #EF4444', color: '#FCA5A5' }}>
            {error}
          </div>
        )}

        {loading ? (
          <div className="space-y-5">
            {[1, 2].map(s => (
              <div key={s} className="flex gap-3 items-start">
                <div className="w-14 shrink-0" />
                <div className="flex-1 rounded-xl p-3" style={{ background: '#0F172A', border: '1px solid #1E293B' }}>
                  <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${BINS_PER_SHELF}, 1fr)` }}>
                    {Array.from({ length: BINS_PER_SHELF }).map((_, i) => (
                      <div key={i} className="rounded-lg animate-pulse" style={{ background: '#1E293B', height: 160 }} />
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          /* Empty state */
          <div className="text-center py-28">
            <svg className="w-12 h-12 mx-auto mb-4" style={{ color: '#1E293B' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 7l-8-4-8 4m16 0v10l-8 4M4 7v10l8 4" />
            </svg>
            <p className="text-sm font-bold font-mono mb-1" style={{ color: '#334155' }}>STOCK ROOM EMPTY</p>
            <p className="text-xs mb-4" style={{ color: '#1E293B' }}>Add your first product to get started</p>
            <button onClick={() => setShowAdd(true)}
              className="px-5 py-2.5 rounded-lg text-xs font-bold cursor-pointer"
              style={{ background: '#22C55E', color: '#020617' }}>
              + ADD PRODUCT
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24 font-mono text-sm" style={{ color: '#334155' }}>NO PRODUCTS MATCH</div>
        ) : (
          /* Shelf rows */
          <div className="space-y-5">
            {shelves.map((shelf, si) => (
              <div key={si} className="flex gap-3 items-start">

                {/* Shelf label */}
                <div className="w-14 shrink-0 flex flex-col items-center gap-1 pt-3">
                  <span className="text-[9px] font-bold font-mono tracking-widest" style={{ color: '#334155' }}>SHELF</span>
                  <span className="text-lg font-bold font-mono" style={{ color: '#475569' }}>{String(si + 1).padStart(2, '0')}</span>
                  <div className="w-px mt-1" style={{ background: 'linear-gradient(to bottom, #1E293B, transparent)', height: 40 }} />
                </div>

                {/* Shelf unit */}
                <div className="flex-1 rounded-xl p-3"
                  style={{ background: '#0F172A', border: '1px solid #1E293B', boxShadow: '0 4px 24px rgba(0,0,0,0.4)' }}>
                  <div className="h-1 rounded-full mb-3" style={{ background: 'linear-gradient(to right, #1E293B, #334155, #1E293B)' }} />

                  <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${BINS_PER_SHELF}, 1fr)` }}>
                    {shelf.map(p => (
                      <BinCard key={p.id} product={p}
                        onEdit={prod => { setEditProduct(prod); setShowAdd(true) }}
                        onDelete={deleteProduct} />
                    ))}
                    {Array.from({ length: BINS_PER_SHELF - shelf.length }).map((_, i) => (
                      <div key={`e-${i}`} className="rounded-lg cursor-pointer transition-colors duration-150"
                        style={{ background: '#0A1020', border: '1px dashed #1E293B', height: 160 }}
                        onClick={() => setShowAdd(true)} />
                    ))}
                  </div>

                  <div className="h-0.5 rounded-full mt-3" style={{ background: '#1E293B' }} />
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
    </div>
  )
}
