import rateLimit from "express-rate-limit";

/**
 * Rate limiter for QR order creation
 * Limits: 5 orders per minute per IP address
 */
export const qrOrderRateLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 5, // Limit each IP to 5 requests per windowMs
    message: {
        error: "Too many orders created, please try again later.",
        retryAfter: "1 minute"
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

