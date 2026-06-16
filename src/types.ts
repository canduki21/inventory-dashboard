export interface Product {
  id: string
  name: string
  sku: string
  qty1kg: number
  qty5kg: number
  unit?: number
}

export function totalKg(p: Product) {
  return p.qty1kg * 1 + p.qty5kg * 5
}

