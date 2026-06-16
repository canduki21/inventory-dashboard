export interface Product {
  id: string
  name: string
  sku: string
  quantity: number
}

export interface SyncLog {
  order: number
  product: string
  sku: string
  deducted: number
  before: number
  after: number
}

export interface SyncResult {
  synced: number
  log: SyncLog[]
}
