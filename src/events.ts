export type Line = {
  id: string
  variant_id?: string
  product_id?: string
  quantity: number
  unit_price: number
  total?: number
  tax_total?: number
}

export type Basket = {
  id: string
  currency_code: string
  items: Line[]
  shipping_methods?: { shipping_option_id: string }[]
}

function price(line: Line) {
  if (line.quantity > 0 && line.total != null && line.tax_total != null)
    return Number(
      (
        (Number(line.total) - Number(line.tax_total)) /
        Number(line.quantity)
      ).toFixed(6)
    )
  return Number(line.unit_price)
}

export type CommerceEvent = ReturnType<typeof commerceEvent>

export function commerceEvent(
  name: string,
  basket: Basket,
  lines = basket.items,
  extra: Record<string, string | number> = {}
) {
  const items = lines.map((line) => ({
    item_id: line.variant_id || line.product_id || line.id,
    price: price(line),
    quantity: Number(line.quantity),
  }))
  return {
    name,
    params: {
      currency: basket.currency_code.toUpperCase(),
      value: Number(
        items
          .reduce((sum, item) => sum + item.price * item.quantity, 0)
          .toFixed(6)
      ),
      items: items.slice(0, 200),
      ...extra,
    },
  }
}

export function snapshot(basket: Basket) {
  return {
    items: basket.items.map((line) => ({
      id: line.id,
      variant_id: line.variant_id,
      product_id: line.product_id,
      quantity: Number(line.quantity),
      unit_price: price(line),
    })),
    shipping: (basket.shipping_methods || [])
      .map((method) => method.shipping_option_id)
      .sort()
      .join(","),
  }
}

export function cartEvents(
  basket: Basket,
  before: ReturnType<typeof snapshot>
) {
  const current = snapshot(basket)
  const previous = new Map(before.items.map((item) => [item.id, item]))
  const after = new Map(current.items.map((item) => [item.id, item]))
  const events: CommerceEvent[] = []
  for (const [name, source, target] of [
    ["add_to_cart", after, previous],
    ["remove_from_cart", previous, after],
  ] as const) {
    const lines = [...source.values()]
      .map((item) => ({
        ...item,
        quantity: item.quantity - (target.get(item.id)?.quantity || 0),
      }))
      .filter((item) => item.quantity > 0)
    if (lines.length) events.push(commerceEvent(name, basket, lines))
  }
  if (current.shipping && current.shipping !== before.shipping)
    events.push(commerceEvent("add_shipping_info", basket))
  return events
}
