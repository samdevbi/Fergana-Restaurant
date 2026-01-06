import { v2 as cloudinary } from "cloudinary";

// Configuration from environment variables
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Upload an image buffer to Cloudinary
 * @param buffer - Image buffer
 * @param folder - Cloudinary folder (default: 'qrcodes')
 * @returns Promise<string> - The secure URL of the uploaded image
 */
export const uploadBufferToCloudinary = (
    buffer: Buffer,
    folder: string = "qrcodes"
): Promise<string> => {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder: folder,
                resource_type: "image",
            },
            (error, result) => {
                if (error) {
                    console.error("Cloudinary upload error:", error);
                    return reject(error);
                }
                if (!result) {
                    return reject(new Error("Cloudinary upload failed: No result"));
                }
                resolve(result.secure_url);
            }
        );

        uploadStream.end(buffer);
    });
};

export default cloudinary;
