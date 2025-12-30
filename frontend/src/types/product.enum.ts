export const ProductStatus = {
    PAUSE: "PAUSE",
    PROCESS: "PROCESS",
    DELETE: "DELETE",
} as const;

export type ProductStatus = typeof ProductStatus[keyof typeof ProductStatus];

export const ProductCollection = {
    DISH: "DISH",
    SALAD: "SALAD",
    DESSERT: "DESSERT",
    DRINK: "DRINK",
    OTHER: "OTHER",
} as const;

export type ProductCollection = typeof ProductCollection[keyof typeof ProductCollection];
