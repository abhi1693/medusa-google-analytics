import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { type Basket, cartEvents, commerceEvent, snapshot } from "../events"
import type { GoogleAnalytics } from "../transport"

const fields = [
  "id",
  "currency_code",
  "items.id",
  "items.variant_id",
  "items.product_id",
  "items.unit_price",
  "items.quantity",
  "items.total",
  "items.tax_total",
]
const ttl = 14 * 86400

async function read<T>(
  scope: MedusaContainer,
  entity: string,
  id: string,
  fields: string[]
) {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({ entity, fields, filters: { id } })
  return data[0] as T | undefined
}

async function track(scope: MedusaContainer, name: string, id: string) {
  const ga = scope.resolve<GoogleAnalytics>("googleAnalytics")
  if (name === "order.placed") {
    const order = await read<
      Basket & {
        cart?: { id: string }
        shipping_total: number
        shipping_tax_total: number
        tax_total: number
      }
    >(scope, "order", id, [
      ...fields,
      "cart.id",
      "shipping_total",
      "shipping_tax_total",
      "tax_total",
    ])
    if (order)
      await ga.send(order.cart?.id || id, [
        commerceEvent("purchase", order, order.items, {
          transaction_id: id,
          shipping:
            Number(order.shipping_total) - Number(order.shipping_tax_total),
          tax: Number(order.tax_total),
        }),
      ])
    return
  }
  if (name === "payment.payment-session.created") {
    const session = await read<{
      payment_collection_id: string
      provider_id: string
    }>(scope, "payment_session", id, ["payment_collection_id", "provider_id"])
    if (!session) return
    const collection = await read<{ cart?: Basket }>(
      scope,
      "payment_collection",
      session.payment_collection_id,
      fields.map((field) => "cart." + field)
    )
    if (collection?.cart)
      await ga.send(collection.cart.id, [
        commerceEvent(
          "add_payment_info",
          collection.cart,
          collection.cart.items,
          { payment_type: session.provider_id }
        ),
      ])
    return
  }
  const key = "medusa-ga4:cart:" + id
  await scope.resolve(Modules.LOCKING).execute(
    key,
    async () => {
      const cart = await read<Basket>(scope, "cart", id, [
        ...fields,
        "shipping_methods.shipping_option_id",
      ])
      if (!cart) return
      const cache = scope.hasRegistration(Modules.CACHING)
        ? scope.resolve(Modules.CACHING)
        : undefined
      const legacy = cache ? undefined : scope.resolve(Modules.CACHE)
      const previous = cache
        ? await cache.get({ key })
        : await legacy!.get<ReturnType<typeof snapshot>>(key)
      if (previous || name === "cart.created")
        await ga.send(
          id,
          cartEvents(cart, previous || { items: [], shipping: "" })
        )
      const data = snapshot(cart)
      if (cache)
        await cache.set({ key, data, ttl, computeAutomaticTags: false })
      else await legacy!.set(key, data, ttl)
    },
    { timeout: 10, expire: 30 }
  )
}

export default async function commerce({
  event,
  container,
}: SubscriberArgs<{ id: string | string[] }>) {
  for (const id of [event.data.id].flat())
    await track(container, event.name, id)
}

export const config: SubscriberConfig = {
  event: [
    "cart.created",
    "cart.updated",
    "payment.payment-session.created",
    "order.placed",
  ],
  context: { subscriberId: "medusa-ga4-commerce" },
}
