import { ProductStatus } from "../libs/enums/product.enum";
import { shapeIntoMongooseObjectId } from "../libs/config";
import Errors, { HttpCode, Message } from "../libs/Errors";
import { Product, ProductInput, ProductInquiry, ProductUpdateInput } from "../libs/types/product";
import ProductModel from "../schema/Product.model";
import { T } from "../libs/types/common";
import { Types } from "mongoose";
type ObjectId = Types.ObjectId;

class ProductService {
    private readonly productModel;

    constructor() {
        this.productModel = ProductModel;
    }
    public async getProducts(inquiry: ProductInquiry): Promise<Product[]> {
        const match: T = { productStatus: ProductStatus.PROCESS };

        if (inquiry.productCollection)
            match.productCollection = inquiry.productCollection;

        if (inquiry.search) {
            match.$or = [
                { productNameUz: { $regex: new RegExp(inquiry.search, "i") } },
                { productNameKr: { $regex: new RegExp(inquiry.search, "i") } },
            ];
        }

        const sort: T = inquiry.order === "productPrice" ? { [inquiry.order]: 1 } : { [inquiry.order]: -1 };

        const pipeline: any[] = [
            { $match: match },
            { $sort: sort },
        ];

        if (inquiry.page && inquiry.limit) {
            pipeline.push({ $skip: (inquiry.page * 1 - 1) * inquiry.limit });
            pipeline.push({ $limit: inquiry.limit * 1 });
        }

        const result = await this.productModel.aggregate(pipeline).exec();
        if (!result) throw new Errors(HttpCode.NOT_FOUND, Message.NO_DATA_FOUND);

        return result as Product[];

    }

    public async getProductsByAdmin(inquiry: ProductInquiry): Promise<Product[]> {
        const match: T = {};

        if (inquiry.productCollection)
            match.productCollection = inquiry.productCollection;

        if (inquiry.productStatus)
            match.productStatus = inquiry.productStatus;

        if (inquiry.search) {
            match.$or = [
                { productNameUz: { $regex: new RegExp(inquiry.search, "i") } },
                { productNameKr: { $regex: new RegExp(inquiry.search, "i") } },
            ];
        }

        const sort: T = inquiry.order === "productPrice" ? { [inquiry.order]: 1 } : { [inquiry.order]: -1 };

        const pipeline: any[] = [
            { $match: match },
            { $sort: sort },
        ];

        if (inquiry.page && inquiry.limit) {
            pipeline.push({ $skip: (inquiry.page * 1 - 1) * inquiry.limit });
            pipeline.push({ $limit: inquiry.limit * 1 });
        }

        const result = await this.productModel.aggregate(pipeline).exec();
        if (!result) throw new Errors(HttpCode.NOT_FOUND, Message.NO_DATA_FOUND);

        return result as Product[];

    }

    public async getProduct(memberId: ObjectId | null, id: string): Promise<Product> {
        const productId = shapeIntoMongooseObjectId(id);

        const result = await this.productModel.findOne({ _id: productId }).exec();

        if (!result) throw new Errors(HttpCode.NOT_FOUND, Message.NO_DATA_FOUND);

        return result as Product;
    }
    /*SPA*/

    public async createNewProduct(input: ProductInput): Promise<Product> {
        try {
            return (await this.productModel.create(input)) as Product;
        } catch (err) {
            console.error("Error, model:createNewProduct:", err);
            throw new Errors(HttpCode.BAD_REQUEST, Message.CREATE_FAILED)
        }
    }

    public async updateChosenProduct(id: string, input: ProductUpdateInput): Promise<Product> {
        id = shapeIntoMongooseObjectId(id);
        const result = await this.productModel.findOneAndUpdate({ _id: id }, input, { new: true }).exec();
        if (!result) throw new Errors(HttpCode.NOT_MODIFIED, Message.UPDATE_FAILED);
        return result as Product;
    }

    public async deleteProduct(id: string): Promise<Product> {
        const productId = shapeIntoMongooseObjectId(id);
        // Soft delete: update status to DELETE
        const result = await this.productModel
            .findByIdAndUpdate(productId, { productStatus: ProductStatus.DELETE }, { new: true })
            .exec();

        if (!result) throw new Errors(HttpCode.NOT_FOUND, Message.NO_DATA_FOUND);
        return result as Product;
    }

    public async getAllProduct(): Promise<Product[]> {
        const result = await this.productModel.find({ productStatus: ProductStatus.PROCESS }).exec();
        if (!result || result.length === 0) {
            return [];
        }
        return result as Product[];
    }
}


export default ProductService;