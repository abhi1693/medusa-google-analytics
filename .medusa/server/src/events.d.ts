export type Line = {
    id: string;
    variant_id?: string;
    product_id?: string;
    quantity: number;
    unit_price: number;
    total?: number;
    tax_total?: number;
};
export type Basket = {
    id: string;
    currency_code: string;
    items: Line[];
    shipping_methods?: {
        shipping_option_id: string;
    }[];
};
export type CommerceEvent = ReturnType<typeof commerceEvent>;
export declare function commerceEvent(name: string, basket: Basket, lines?: Line[], extra?: Record<string, string | number>): {
    name: string;
    params: {
        currency: string;
        value: number;
        items: {
            item_id: string;
            price: number;
            quantity: number;
        }[];
    };
};
export declare function snapshot(basket: Basket): {
    items: {
        id: string;
        variant_id: string | undefined;
        product_id: string | undefined;
        quantity: number;
        unit_price: number;
    }[];
    shipping: string;
};
export declare function cartEvents(basket: Basket, before: ReturnType<typeof snapshot>): {
    name: string;
    params: {
        currency: string;
        value: number;
        items: {
            item_id: string;
            price: number;
            quantity: number;
        }[];
    };
}[];
