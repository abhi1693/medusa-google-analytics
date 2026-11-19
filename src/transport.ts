import { createHmac } from "node:crypto"
import type { CommerceEvent } from "./events"

type Options = { measurementId: string; apiSecret: string; debug: boolean }

export class GoogleAnalytics {
  constructor(
    _: unknown,
    private readonly options: Options
  ) {}

  async send(cartId: string, events: CommerceEvent[]) {
    if (!events.length) return
    const { measurementId, apiSecret, debug } = this.options
    const url = new URL(
      debug ? "/debug/mp/collect" : "/mp/collect",
      "https://www.google-analytics.com"
    )
    url.searchParams.set("measurement_id", measurementId)
    url.searchParams.set("api_secret", apiSecret)
    const clientId = createHmac("sha256", apiSecret)
      .update(cartId)
      .digest("hex")
      .slice(0, 32)
    let response: Response
    try {
      response = await fetch(url, {
        method: "POST",
        redirect: "error",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(5000),
        body: JSON.stringify({
          client_id: clientId,
          events,
          ...(debug ? { validation_behavior: "ENFORCE_RECOMMENDATIONS" } : {}),
        }),
      })
    } catch {
      throw new Error("GA4 delivery failed")
    }
    if (!response.ok) throw new Error(`GA4 returned HTTP ${response.status}`)
    if (debug) {
      const { validationMessages } = await response.json()
      if (!Array.isArray(validationMessages) || validationMessages.length)
        throw new Error("GA4 rejected the event during validation")
    }
  }
}
