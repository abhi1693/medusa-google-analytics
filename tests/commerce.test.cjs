const assert = require("node:assert/strict")
const test = require("node:test")
const { ga4Plugins } = require("..")
const { GoogleAnalytics } = require("../.medusa/server/src/transport")
const commerce = require("../.medusa/server/src/subscribers/commerce").default

const env = { GA4_MEASUREMENT_ID: " G-TEST ", GA4_API_SECRET: " fixture " }

test("requires both credentials and validates the debug flag", () => {
  for (const key of Object.keys(env))
    assert.deepEqual(ga4Plugins({ ...env, [key]: " " }), [])
  for (const [flag, expected] of [
    [undefined, false],
    ["TRUE", true],
    ["1", true],
    ["0", false],
    ["false", false],
  ]) {
    assert.deepEqual(ga4Plugins({ ...env, GA4_DEBUG: flag })[0].options, {
      measurementId: "G-TEST",
      apiSecret: "fixture",
      debug: expected,
    })
  }
  assert.throws(() => ga4Plugins({ ...env, GA4_DEBUG: "invalid" }), /GA4_DEBUG/)
})

test("delivers the checkout sequence and ignores unchanged snapshots", async (t) => {
  const http = t.mock.method(
    globalThis,
    "fetch",
    async () => new Response(null, { status: 204 })
  )
  const item = {
    id: "line",
    quantity: 2,
    unit_price: 12,
    total: 20,
    tax_total: 2,
  }
  const cart = {
    id: "cart",
    currency_code: "inr",
    items: [item],
    shipping_methods: [],
  }
  const rows = {
    cart,
    order: {
      ...cart,
      cart: { id: "cart" },
      tax_total: 2,
      shipping_total: 5,
      shipping_tax_total: 1,
    },
    payment_session: { provider_id: "manual", payment_collection_id: "pay" },
    payment_collection: { cart },
  }
  let saved
  const services = {
    query: { graph: ({ entity }) => ({ data: [rows[entity]] }) },
    locking: { execute: (_, fn) => fn() },
    cache: {
      get: () => saved,
      set: (_, data) => {
        saved = data
      },
    },
    googleAnalytics: new GoogleAnalytics({}, ga4Plugins(env)[0].options),
  }
  const container = {
    hasRegistration: () => false,
    resolve: (key) => services[key],
  }
  const fire = (name) =>
    commerce({
      container,
      event: { name, data: { id: name.startsWith("cart.") ? "cart" : "id" } },
    })
  await fire("cart.created")
  await fire("cart.updated")
  Object.assign(item, { quantity: 1, total: 10, tax_total: 1 })
  await fire("cart.updated")
  cart.shipping_methods.push({ shipping_option_id: "standard" })
  await fire("cart.updated")
  await fire("payment.payment-session.created")
  await fire("order.placed")
  const payloads = http.mock.calls.map(({ arguments: [url, options] }) => {
    assert.equal(url.pathname, "/mp/collect")
    assert.equal(url.searchParams.get("api_secret"), "fixture")
    return JSON.parse(options.body)
  })
  assert.equal(new Set(payloads.map((p) => p.client_id)).size, 1)
  assert.deepEqual(
    payloads.map((p) => [p.events[0].name, p.events[0].params.value]),
    [
      ["add_to_cart", 18],
      ["remove_from_cart", 9],
      ["add_shipping_info", 9],
      ["add_payment_info", 9],
      ["purchase", 9],
    ]
  )
  assert.equal(payloads[4].events[0].params.transaction_id, "id")
})

test("debug only uses validation and surfaces rejected events", async (t) => {
  const http = t.mock.method(globalThis, "fetch", async () =>
    Response.json({ validationMessages: [{}] })
  )
  const ga = new GoogleAnalytics(
    {},
    ga4Plugins({ ...env, GA4_DEBUG: "true" })[0].options
  )
  await assert.rejects(
    ga.send("cart", [{ name: "purchase", params: {} }]),
    /validation/
  )
  assert.equal(http.mock.calls[0].arguments[0].pathname, "/debug/mp/collect")
})
