import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { randomUUID } from 'crypto'

const app = express()
app.use(cors())
app.use(express.json())

const SHOPIFY_DOMAIN = process.env.SHOPIFY_DOMAIN
const SHOPIFY_TOKEN  = process.env.SHOPIFY_ACCESS_TOKEN
const GH_TOKEN       = process.env.GITHUB_TOKEN
const GH_OWNER       = 'canduki21'
const GH_REPO        = 'inventory-dashboard'
const GH_FILE        = 'inventory.json'

const GH_HEADERS = {
  Authorization: `Bearer ${GH_TOKEN}`,
  Accept: 'application/vnd.github.v3+json',
  'Content-Type': 'application/json',
}

async function shopifyGet(path) {
  const res = await fetch(`https://${SHOPIFY_DOMAIN}/admin/api/2024-01${path}`, {
    headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN },
  })
  if (!res.ok) throw new Error(`Shopify ${res.status}: ${await res.text()}`)
  return res.json()
}

async function readDB() {
  const res = await fetch(
    `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/${GH_FILE}`,
    { headers: GH_HEADERS }
  )
  if (!res.ok) throw new Error(`GitHub read ${res.status}`)
  const json = await res.json()
  const data = JSON.parse(Buffer.from(json.content, 'base64').toString('utf8'))
  return { data, sha: json.sha }
}

async function writeDB(data, sha) {
  const content = Buffer.from(JSON.stringify(data, null, 2)).toString('base64')
  const res = await fetch(
    `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/${GH_FILE}`,
    {
      method: 'PUT',
      headers: GH_HEADERS,
      body: JSON.stringify({ message: 'Update inventory [skip ci]', content, sha }),
    }
  )
  if (!res.ok) throw new Error(`GitHub write ${res.status}: ${await res.text()}`)
  const result = await res.json()
  return result.content.sha
}

// GET /api/inventory
app.get('/api/inventory', async (req, res) => {
  try {
    const { data } = await readDB()
    res.json({ products: data.products ?? [] })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/inventory/product
app.post('/api/inventory/product', async (req, res) => {
  try {
    const { name, sku, qty1kg, qty5kg, unit } = req.body
    if (!name) return res.status(400).json({ error: 'name required' })
    const { data, sha } = await readDB()
    const product = { id: randomUUID(), name, sku: sku ?? '', qty1kg: Number(qty1kg ?? 0), qty5kg: Number(qty5kg ?? 0), unit: Number(unit ?? 1) }
    data.products.push(product)
    await writeDB(data, sha)
    res.json(product)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/inventory/product/:id
app.put('/api/inventory/product/:id', async (req, res) => {
  try {
    const { data, sha } = await readDB()
    const idx = data.products.findIndex(p => p.id === req.params.id)
    if (idx === -1) return res.status(404).json({ error: 'not found' })
    const { name, sku, qty1kg, qty5kg, unit } = req.body
    if (name != null) data.products[idx].name = name
    if (sku != null) data.products[idx].sku = sku
    if (qty1kg != null) data.products[idx].qty1kg = Number(qty1kg)
    if (qty5kg != null) data.products[idx].qty5kg = Number(qty5kg)
    if (unit != null) data.products[idx].unit = Number(unit)
    await writeDB(data, sha)
    res.json(data.products[idx])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/inventory/product/:id
app.delete('/api/inventory/product/:id', async (req, res) => {
  try {
    const { data, sha } = await readDB()
    data.products = data.products.filter(p => p.id !== req.params.id)
    await writeDB(data, sha)
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/inventory/import — pull products from Shopify
app.post('/api/inventory/import', async (req, res) => {
  try {
    const { data, sha } = await readDB()
    const existingSkus = new Set(data.products.map(p => p.sku.trim().toLowerCase()))
    const { products } = await shopifyGet('/products.json?limit=250&fields=id,title,variants,status')

    const toAdd = []
    for (const p of products) {
      if (p.status !== 'active') continue
      for (const v of p.variants) {
        const sku = (v.sku ?? '').trim()
        if (existingSkus.has(sku.toLowerCase())) continue
        const name = p.variants.length > 1 && v.title !== 'Default Title'
          ? `${p.title} — ${v.title}` : p.title
        toAdd.push({ id: randomUUID(), name, sku, qty1kg: 0, qty5kg: 0, unit: 1 })
        existingSkus.add(sku.toLowerCase())
      }
    }

    data.products.push(...toAdd)
    await writeDB(data, sha)
    res.json({ added: toAdd.length, total: data.products.length })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/inventory/sync — preview new orders (no writes)
app.post('/api/inventory/sync', async (req, res) => {
  try {
    const { data } = await readDB()
    const processedIds = data.processedOrderIds ?? []
    const { orders } = await shopifyGet(`/orders.json?fulfillment_status=unfulfilled&status=open&limit=250&fields=id,order_number,fulfillment_status,line_items`)
    const newOrders = orders.filter(o => o.fulfillment_status === null && !processedIds.includes(o.id))

    const items = []
    for (const order of newOrders) {
      for (const item of order.line_items) {
        const sku = (item.sku ?? '').trim()
        if (!sku) continue
        const match = data.products.find(p => p.sku.trim().toLowerCase() === sku.toLowerCase())
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

// POST /api/inventory/sync/apply — deduct stock and mark orders processed
app.post('/api/inventory/sync/apply', async (req, res) => {
  try {
    const { assignments = [], orderIds = [] } = req.body
    const { data, sha } = await readDB()
    if (!data.processedOrderIds) data.processedOrderIds = []
    const log = []

    for (const a of assignments) {
      if (!a.productId) continue
      if (a.packageType === 'bucket') {
        log.push({ order: a.orderNumber, product: a.productName, sku: a.sku, deducted: a.qty, packageType: 'bucket', skipped: true })
        continue
      }
      const match = data.products.find(p => p.id === a.productId)
      if (match) {
        const field = a.packageType === '5kg' ? 'qty5kg' : 'qty1kg'
        const before = match[field]
        match[field] = Math.max(0, before - a.qty)
        log.push({ order: a.orderNumber, product: match.name, sku: match.sku, deducted: a.qty, before, after: match[field], packageType: a.packageType })
      }
    }

    for (const id of orderIds) {
      if (!data.processedOrderIds.includes(id)) data.processedOrderIds.push(id)
    }

    await writeDB(data, sha)
    res.json({ log })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default app
