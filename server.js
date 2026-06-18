import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { randomUUID } from 'crypto'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DB_FILE = path.join(__dirname, 'inventory.json')

const app = express()
app.use(cors())
app.use(express.json())

const SHOPIFY_DOMAIN = process.env.SHOPIFY_DOMAIN
const SHOPIFY_TOKEN  = process.env.SHOPIFY_ACCESS_TOKEN

// ── Local DB helpers ─────────────────────────────────────────────────────────

function readDB() {
  if (!fs.existsSync(DB_FILE)) return { products: [], processedOrderIds: [] }
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'))
}

function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2))
}

// ── Shopify ──────────────────────────────────────────────────────────────────

async function shopifyGet(path) {
  const res = await fetch(`https://${SHOPIFY_DOMAIN}/admin/api/2024-01${path}`, {
    headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN },
  })
  if (!res.ok) throw new Error(`Shopify ${res.status}: ${await res.text()}`)
  return res.json()
}

// ── Inventory routes ─────────────────────────────────────────────────────────

// GET /api/inventory
app.get('/api/inventory', (req, res) => {
  res.json(readDB())
})

// POST /api/inventory/product — add a product
app.post('/api/inventory/product', (req, res) => {
  const { name, sku, qty1kg, qty5kg, unit } = req.body
  if (!name) return res.status(400).json({ error: 'name required' })
  const db = readDB()
  const product = { id: randomUUID(), name, sku: sku ?? '', qty1kg: Number(qty1kg ?? 0), qty5kg: Number(qty5kg ?? 0), unit: Number(unit ?? 1) }
  db.products.push(product)
  writeDB(db)
  res.json(product)
})

// PUT /api/inventory/product/:id — update quantity or details
app.put('/api/inventory/product/:id', (req, res) => {
  const db = readDB()
  const idx = db.products.findIndex(p => p.id === req.params.id)
  if (idx === -1) return res.status(404).json({ error: 'not found' })
  const { name, sku, qty1kg, qty5kg } = req.body
  db.products[idx] = {
    ...db.products[idx],
    ...(name != null && { name }),
    ...(sku != null && { sku }),
    ...(qty1kg != null && { qty1kg: Number(qty1kg) }),
    ...(qty5kg != null && { qty5kg: Number(qty5kg) }),
    id: req.params.id,
  }
  writeDB(db)
  res.json(db.products[idx])
})

// DELETE /api/inventory/product/:id
app.delete('/api/inventory/product/:id', (req, res) => {
  const db = readDB()
  db.products = db.products.filter(p => p.id !== req.params.id)
  writeDB(db)
  res.json({ ok: true })
})

// POST /api/inventory/import — pull products from Shopify and import into local inventory
app.post('/api/inventory/import', async (req, res) => {
  try {
    const db = readDB()
    const existingSkus = new Set(db.products.map(p => p.sku.trim().toLowerCase()))

    const { products } = await shopifyGet(
      '/products.json?limit=250&fields=id,title,variants,status'
    )

    let added = 0
    for (const p of products) {
      if (p.status !== 'active') continue
      for (const v of p.variants) {
        const sku = (v.sku ?? '').trim()
        const skuKey = sku.toLowerCase()
        if (existingSkus.has(skuKey)) continue

        const name = p.variants.length > 1 && v.title !== 'Default Title'
          ? `${p.title} — ${v.title}`
          : p.title

        db.products.push({ id: randomUUID(), name, sku, qty1kg: 0, qty5kg: 0, unit: 1 })
        existingSkus.add(skuKey)
        added++
      }
    }

    writeDB(db)
    res.json({ added, total: db.products.length })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/inventory/sync — preview new orders (no DB writes)
app.post('/api/inventory/sync', async (req, res) => {
  try {
    const db = readDB()
    const { orders } = await shopifyGet(
      `/orders.json?status=open&limit=250&fields=id,order_number,fulfillment_status,line_items`
    )
    const newOrders = orders.filter(o => !db.processedOrderIds.includes(o.id))

    const items = []
    for (const order of newOrders) {
      for (const item of order.line_items) {
        const sku = (item.sku ?? '').trim()
        if (!sku) continue
        const match = db.products.find(p => p.sku.trim().toLowerCase() === sku.toLowerCase())
        items.push({
          orderId: order.id,
          orderNumber: order.order_number,
          sku,
          qty: item.quantity,
          productId: match?.id ?? null,
          productName: match?.name ?? sku,
        })
      }
    }

    res.json({ newOrderCount: newOrders.length, items, orderIds: newOrders.map(o => o.id) })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/inventory/sync/apply — apply packaging assignments and mark orders processed
app.post('/api/inventory/sync/apply', (req, res) => {
  try {
    const { assignments = [], orderIds = [] } = req.body
    const db = readDB()
    const log = []

    for (const a of assignments) {
      if (!a.productId) continue
      if (a.packageType === 'bucket') {
        log.push({ order: a.orderNumber, product: a.productName, sku: a.sku, deducted: a.qty, packageType: 'bucket', skipped: true })
        continue
      }
      const match = db.products.find(p => p.id === a.productId)
      if (match) {
        const field = a.packageType === '5kg' ? 'qty5kg' : 'qty1kg'
        const before = match[field]
        match[field] = Math.max(0, before - a.qty)
        log.push({ order: a.orderNumber, product: match.name, sku: match.sku, deducted: a.qty, before, after: match[field], packageType: a.packageType })
      }
    }

    for (const id of orderIds) {
      if (!db.processedOrderIds.includes(id)) db.processedOrderIds.push(id)
    }

    writeDB(db)
    res.json({ log })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.listen(3001, () => console.log('API server → http://localhost:3001'))
