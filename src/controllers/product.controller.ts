import { Request, Response } from "express";
import Errors, { HttpCode, Message } from "../libs/Errors";
import { T } from "../libs/types/common";
import ProductService from "../models/Product.service";
import { Product, ProductInput, ProductInquiry } from "../libs/types/product";
import { AdminRequest, ExtendedRequest } from "../libs/types/member";
import { ProductCollection } from "../libs/enums/product.enum";

const productService = new ProductService();

const productController: T = {}

/*SPA*/

/*SSR*/
productController.getProducts = async (req: Request, res: Response) => {
    try {
        console.log("getProducts");
        const { page, limit, order, productCollection, search } = req.query;
        const pageNum = Number(page);
        const limitNum = Number(limit);

        const inquiry: ProductInquiry = {
            order: String(order) || "createdAt",
        };
        if (pageNum && pageNum > 0) inquiry.page = pageNum;
        if (limitNum && limitNum > 0) inquiry.limit = limitNum;
        if (productCollection) {
            inquiry.productCollection = productCollection as ProductCollection;
        }
        if (search) inquiry.search = String(search);

        const result = await productService.getProductsByAdmin(inquiry);

        res.status(HttpCode.OK).json(result);

    } catch (err) {
        console.log("Error, getProducts:", err);
        if (err instanceof Errors) res.status(err.code).json(err);
        else res.status(Errors.standard.code).json(Errors.standard);
    }
};

productController.getProduct = async (req: ExtendedRequest, res: Response) => {
    try {
        console.log("getProduct");
        const { id } = req.params;
        const memberId = req.member?._id ?? null,
            result = await productService.getProduct(memberId, id);

        res.status(HttpCode.OK).json(result);
    } catch (err) {
        console.log("Error, getProduct:", err);
        if (err instanceof Errors) res.status(err.code).json(err);
        else res.status(Errors.standard.code).json(Errors.standard);
    }
}

productController.createNewProduct = async (req: AdminRequest, res: Response) => {
    try {
        console.log("createNewProduct");

        const data: ProductInput = req.body;

        // Image is now uploaded directly to Cloudinary by frontend
        // and the URL is sent in the request body
        if (!data.productImage) {
            throw new Errors(HttpCode.BAD_REQUEST, "Product image URL is required (Cloudinary)");
        }

        const result = await productService.createNewProduct(data);

        res.status(HttpCode.CREATED).json(result);
    } catch (err) {
        console.log("Error, createNewProduct:", err);
        if (err instanceof Errors) res.status(err.code).json(err);
        else res.status(Errors.standard.code).json(Errors.standard);
    }
};

productController.updateChosenProduct = async (req: Request, res: Response) => {
    try {
        console.log("updateChosenProduct");
        const id = req.params.id;

        const result = await productService.updateChosenProduct(id, req.body);

        res.status(HttpCode.OK).json({ data: result })
    } catch (err) {
        console.log("Error, updateChosenProduct:", err);
        if (err instanceof Errors) res.status(err.code).json(err);
        else res.status(Errors.standard.code).json(Errors.standard);
    }
};

productController.deleteProduct = async (req: ExtendedRequest, res: Response) => {
    try {
        console.log("deleteProduct");
        const { id } = req.params;

        const result = await productService.deleteProduct(id);

        res.status(HttpCode.OK).json({
            message: "Product deleted successfully",
            data: result
        });
    } catch (err) {
        console.log("Error, deleteProduct:", err);
        if (err instanceof Errors) res.status(err.code).json(err);
        else res.status(Errors.standard.code).json(Errors.standard);
    }
};

export default productController;