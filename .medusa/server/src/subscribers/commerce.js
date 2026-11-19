"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
exports.default = commerce;
const utils_1 = require("@medusajs/framework/utils");
const events_1 = require("../events");
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
];
const ttl = 14 * 86400;
async function read(scope, entity, id, fields) {
    const query = scope.resolve(utils_1.ContainerRegistrationKeys.QUERY);
    const { data } = await query.graph({ entity, fields, filters: { id } });
    return data[0];
}
async function track(scope, name, id) {
    const ga = scope.resolve("googleAnalytics");
    if (name === "order.placed") {
        const order = await read(scope, "order", id, [
            ...fields,
            "cart.id",
            "shipping_total",
            "shipping_tax_total",
            "tax_total",
        ]);
        if (order)
            await ga.send(order.cart?.id || id, [
                (0, events_1.commerceEvent)("purchase", order, order.items, {
                    transaction_id: id,
                    shipping: Number(order.shipping_total) - Number(order.shipping_tax_total),
                    tax: Number(order.tax_total),
                }),
            ]);
        return;
    }
    if (name === "payment.payment-session.created") {
        const session = await read(scope, "payment_session", id, ["payment_collection_id", "provider_id"]);
        if (!session)
            return;
        const collection = await read(scope, "payment_collection", session.payment_collection_id, fields.map((field) => "cart." + field));
        if (collection?.cart)
            await ga.send(collection.cart.id, [
                (0, events_1.commerceEvent)("add_payment_info", collection.cart, collection.cart.items, { payment_type: session.provider_id }),
            ]);
        return;
    }
    const key = "medusa-ga4:cart:" + id;
    await scope.resolve(utils_1.Modules.LOCKING).execute(key, async () => {
        const cart = await read(scope, "cart", id, [
            ...fields,
            "shipping_methods.shipping_option_id",
        ]);
        if (!cart)
            return;
        const cache = scope.hasRegistration(utils_1.Modules.CACHING)
            ? scope.resolve(utils_1.Modules.CACHING)
            : undefined;
        const legacy = cache ? undefined : scope.resolve(utils_1.Modules.CACHE);
        const previous = cache
            ? await cache.get({ key })
            : await legacy.get(key);
        if (previous || name === "cart.created")
            await ga.send(id, (0, events_1.cartEvents)(cart, previous || { items: [], shipping: "" }));
        const data = (0, events_1.snapshot)(cart);
        if (cache)
            await cache.set({ key, data, ttl, computeAutomaticTags: false });
        else
            await legacy.set(key, data, ttl);
    }, { timeout: 10, expire: 30 });
}
async function commerce({ event, container, }) {
    for (const id of [event.data.id].flat())
        await track(container, event.name, id);
}
exports.config = {
    event: [
        "cart.created",
        "cart.updated",
        "payment.payment-session.created",
        "order.placed",
    ],
    context: { subscriberId: "medusa-ga4-commerce" },
};
