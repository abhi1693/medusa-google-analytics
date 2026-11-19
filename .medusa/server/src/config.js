"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ga4Plugins = ga4Plugins;
function ga4Plugins(env) {
    const measurementId = env.GA4_MEASUREMENT_ID?.trim();
    const apiSecret = env.GA4_API_SECRET?.trim();
    if (!measurementId || !apiSecret)
        return [];
    const debug = env.GA4_DEBUG?.trim().toLowerCase() || "false";
    if (!["true", "false", "1", "0"].includes(debug))
        throw new Error("GA4_DEBUG must be true, false, 1 or 0");
    return [
        {
            resolve: "@abhi1693/medusa-google-analytics",
            options: {
                measurementId,
                apiSecret,
                debug: debug === "true" || debug === "1",
            },
        },
    ];
}
