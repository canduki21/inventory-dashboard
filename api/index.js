import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { createClient } from '@supabase/supabase-js'

const app = express()
app.use(cors())
app.use(express.json())

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

const SHOPIFY_DOMAIN = process.env.SHOPIFY_DOMAIN
const SHOPIFY_TOKEN  = process.env.SHOPIFY_ACCESS_TOKEN

async function shopifyGet(path) {
  const res = await fetch(`https://${SHOPIFY_DOMAIN}/admin/api/2024-01${path}`, {
    headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN },
  })
  if (!res.ok) throw new Error(`Shopify ${res.status}: ${await res.text()}`)
  return res.json()
}

// GET /api/inventory
app.get('/api/inventory', async (req, res) => {
  const { data, error } = await supabase.from('products').select('*').order('name')
  if (error) return res.status(500).json({ error: error.message })
  res.json({ products: data })
})

// POST /api/inventory/product
app.post('/api/inventory/product', async (req, res) => {
  const { name, sku, quantity } = req.body
  if (!name || quantity == null) return res.status(400).json({ error: 'name and quantity required' })
  const { data, error } = await supabase
    .from('products')
    .insert({ name, sku: sku ?? '', quantity: Number(quantity) })
    .select().single()
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// PUT /api/inventory/product/:id
app.put('/api/inventory/product/:id', async (req, res) => {
  const { id } = req.params
  const { name, sku, quantity } = req.body
  const { data, error } = await supabase
    .from('products')
    .update({ name, sku, quantity })
    .eq('id', id)
    .select().single()
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// DELETE /api/inventory/product/:id
app.delete('/api/inventory/product/:id', async (req, res) => {
  const { error } = await supabase.from('products').delete().eq('id', req.params.id)
  if (error) return res.status(500).json({ error: error.message })
  res.json({ ok: true })
})

// POST /api/inventory/import — pull products from Shopify
app.post('/api/inventory/import', async (req, res) => {
  try {
    const { data: existing } = await supabase.from('products').select('sku')
    const existingSkus = new Set((existing ?? []).map(p => p.sku.trim().toLowerCase()))

    const { products } = await shopifyGet('/products.json?limit=250&fields=id,title,variants,status')

    const toInsert = []
    for (const p of products) {
      if (p.status !== 'active') continue
      for (const v of p.variants) {
        const sku = (v.sku ?? '').trim()
        if (existingSkus.has(sku.toLowerCase())) continue
        const name = p.variants.length > 1 && v.title !== 'Default Title'
          ? `${p.title} — ${v.title}`
          : p.title
        toInsert.push({ name, sku, quantity: 0 })
        existingSkus.add(sku.toLowerCase())
      }
    }

    if (toInsert.length > 0) await supabase.from('products').insert(toInsert)
    const { count } = await supabase.from('products').select('*', { count: 'exact', head: true })
    res.json({ added: toInsert.length, total: count })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/inventory/sync — deduct quantities from new Shopify orders
app.post('/api/inventory/sync', async (req, res) => {
  try {
    const { data: processed } = await supabase.from('processed_orders').select('order_id')
    const processedIds = new Set((processed ?? []).map(r => r.order_id))

    const { orders } = await shopifyGet(
      '/orders.json?status=any&limit=250&fields=id,order_number,line_items'
    )

    const newOrders = orders.filter(o => !processedIds.has(o.id))
    const log = []

    for (const order of newOrders) {
      for (const item of order.line_items) {
        const sku = (item.sku ?? '').trim().toLowerCase()
        if (!sku) continue

        const { data: match } = await supabase
          .from('products')
          .select('id, name, sku, quantity')
          .ilike('sku', sku)
          .single()

        if (match) {
          const newQty = Math.max(0, match.quantity - item.quantity)
          await supabase.from('products').update({ quantity: newQty }).eq('id', match.id)
          log.push({ order: order.order_number, product: match.name, sku: match.sku, deducted: item.quantity, before: match.quantity, after: newQty })
        }
      }
      await supabase.from('processed_orders').insert({ order_id: order.id })
    }

    res.json({ synced: newOrders.length, log })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default app
