import type { CommerceEvent } from "./events";
type Options = {
    measurementId: string;
    apiSecret: string;
    debug: boolean;
};
export declare class GoogleAnalytics {
    private readonly options;
    constructor(_: unknown, options: Options);
    send(cartId: string, events: CommerceEvent[]): Promise<void>;
}
export {};
