export default function StockBadge({ qty }: { qty: number }) {
  if (qty <= 0)  return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">Out of stock</span>
  if (qty <= 5)  return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700">Low — {qty}</span>
  return              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">In stock — {qty}</span>
}
