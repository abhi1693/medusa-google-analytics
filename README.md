# Google Analytics 4 for Medusa

A backend plugin for Medusa 2.22.4 and 2.23.0 that sends ecommerce events using the GA4 Measurement Protocol.

## Installation

Install `@abhi1693/medusa-google-analytics` from this Git repository at a commit or tag. The compiled Medusa plugin is included. Register it in `medusa-config.ts` after loading your environment:

```ts
import { ga4Plugins } from "@abhi1693/medusa-google-analytics"

export default defineConfig({
  plugins: [...ga4Plugins(process.env)],
})
```

Set both `GA4_MEASUREMENT_ID` and `GA4_API_SECRET` on the backend and its workers. Blank values disable registration. Set `GA4_DEBUG=true` for validation-only delivery, or leave it unset for collection. Validation failures surface in subscriber logs. The API secret stays on the server. Hosts can also register the package directly with options `{ measurementId, apiSecret, debug }`.

Cart creation and update notifications carry only an ID. The subscriber reads the current cart under a per-cart lock and compares line quantities and shipping options with its last observed snapshot. One delivery can contain adds, removals and a shipping selection. Rapid changes between reads can coalesce. A first update for a pre-existing cart, or after cache eviction, establishes a baseline. Snapshots expire after 14 days. Production uses the configured shared caching service. Payment session creation records the selected provider. Order placement records a purchase with the native order ID as its transaction ID.

Client identity is a pseudonym derived from the cart ID and secret. It connects the backend checkout events for that cart. Browser sessions, page views and marketing campaign attribution require a separate browser integration. No customer IDs, addresses, emails, payment data or cart metadata are sent. Analytics delivery is asynchronous and inherits the host event bus retry policy. Retries after an ambiguous delivery can repeat events.

## Development

Run `npm install`, `npm run build` and `npm test`. Commit the regenerated `.medusa/server` files alongside source changes so a pinned Git dependency works without install scripts.

See [Medusa plugins](https://docs.medusajs.com/learn/fundamentals/plugins) and [Google’s Measurement Protocol validation guide](https://developers.google.com/analytics/devguides/collection/protocol/ga4/validating-events).
