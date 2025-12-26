import QRCode from "qrcode";
import path from "path";
import fs from "fs";
import { v4 } from "uuid";

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
    baseUrl: string = process.env.FRONTEND_URL || "http://localhost:3000"
): string {
    const qrData = `${baseUrl}/order?table=${tableId}&restaurant=${restaurantId}`;
    return qrData;
}

/**
 * Generate QR code as data URL (base64 image)
 * @param tableId - Table ID
 * @param restaurantId - Restaurant ID
 * @param baseUrl - Base URL of the application
 * @returns Promise<string> - Base64 data URL
 */
export async function generateQRCodeDataURL(
    tableId: string,
    restaurantId: string,
    baseUrl: string = process.env.FRONTEND_URL || "http://localhost:3000"
): Promise<string> {
    try {
        const qrData = generateQRCodeURL(tableId, restaurantId, baseUrl);
        const dataURL = await QRCode.toDataURL(qrData, {
            errorCorrectionLevel: "M",
            type: "image/png",
            width: 300,
            margin: 1,
        });
        return dataURL;
    } catch (err) {
        console.error("Error generating QR code data URL:", err);
        throw new Error("Failed to generate QR code");
    }
}

/**
 * Generate QR code and save to file system
 * @param tableId - Table ID
 * @param restaurantId - Restaurant ID
 * @param baseUrl - Base URL of the application
 * @param outputDir - Directory to save QR code images (default: "./uploads/qrcodes")
 * @returns Promise<string> - File path of saved QR code
 */
export async function generateQRCodeFile(
    tableId: string,
    restaurantId: string,
    baseUrl: string = process.env.FRONTEND_URL || "http://localhost:3000",
    outputDir: string = "./uploads/qrcodes"
): Promise<string> {
    try {
        // Create directory if it doesn't exist
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const qrData = generateQRCodeURL(tableId, restaurantId, baseUrl);
        const fileName = `qr-${tableId}-${restaurantId}-${v4()}.png`;
        const filePath = path.join(outputDir, fileName);

        await QRCode.toFile(filePath, qrData, {
            errorCorrectionLevel: "M",
            type: "png",
            width: 300,
            margin: 1,
        });

        // Return relative path for database storage
        return filePath.replace(/\\/g, "/");
    } catch (err) {
        console.error("Error generating QR code file:", err);
        throw new Error("Failed to generate QR code file");
    }
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
    baseUrl: string = process.env.FRONTEND_URL || "http://localhost:3000"
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

