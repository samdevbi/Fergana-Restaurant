import QRCode from "qrcode";

/**
 * Generate QR code URL for table
 * @param tableId - Table ID
 * @param restaurantId - Restaurant ID
 * @param baseUrl - Base URL of the application (e.g., "https://yourapp.com")
 * @returns QR code URL string
 */
export function generateQRCodeURL(
    tableId: string,
    restaurantId: string,
    baseUrl: string = process.env.CLIENT_URL || "https://clientsideapp.netlify.app"
): string {
    const qrData = `${baseUrl}/order?table=${tableId}&restaurant=${restaurantId}`;
    return qrData;
}

/**
 * Generate QR code as buffer
 * @param tableId - Table ID
 * @param restaurantId - Restaurant ID
 * @param baseUrl - Base URL of the application
 * @returns Promise<Buffer> - QR code image buffer
 */
export async function generateQRCodeBuffer(
    tableId: string,
    restaurantId: string,
    baseUrl: string = process.env.CLIENT_URL || "https://clientsideapp.netlify.app"
): Promise<Buffer> {
    try {
        const qrData = generateQRCodeURL(tableId, restaurantId, baseUrl);
        const buffer = await QRCode.toBuffer(qrData, {
            errorCorrectionLevel: "M",
            type: "png",
            width: 300,
            margin: 1,
        });
        return buffer;
    } catch (err) {
        console.error("Error generating QR code buffer:", err);
        throw new Error("Failed to generate QR code buffer");
    }
}
