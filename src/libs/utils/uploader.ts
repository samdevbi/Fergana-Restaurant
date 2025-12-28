import path from "path";
import multer from "multer";
import { v4 } from "uuid";
import { Request } from "express";

/* MULTER IMAGE UPLOADER*/
function getTargetImageStorage(address: string) {
    return multer.diskStorage({
        destination: function (req: Request, file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) {
            cb(null, `./uploads/${address}`);
        },
        filename: function (req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) {
            const extension = path.parse(file.originalname).ext;
            const random_name = v4() + extension;
            cb(null, random_name);
        },
    });
}

const makeUploader = (address: string) => {
    const storage = getTargetImageStorage(address);
    return multer({ storage: storage });
};

export default makeUploader;

