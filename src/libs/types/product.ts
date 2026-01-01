import { ObjectId } from "mongoose";
import { ProductCollection, ProductStatus } from "../enums/product.enum";


export interface Product {
    _id: ObjectId;
    productNameUz: string,
    productNameKr: string,
    productPrice: number,
    productStatus: ProductStatus,
    productCollection: ProductCollection,
    productCcal: number,
    productPrepTime: number,
    productDesc: string,
    productIngred: [string],
    productImage: string,
    recommended: boolean,
    forManyPeople: number,
}

export interface ProductInquiry {
    order: string;
    page: number;
    limit: number;
    productCollection?: ProductCollection;
    productStatus?: ProductStatus;
    search?: string;
}


export interface ProductInput {
    productNameUz: string,
    productNameKr: string,
    productPrice: number,
    productStatus: ProductStatus,
    productCollection: ProductCollection,
    productCcal?: number,
    productPrepTime?: number,
    productDesc?: string,
    productIngred?: [string],
    productImage?: string,
    recommended?: boolean,
    forManyPeople?: number,
}

export interface ProductUpdateInput {
    _id: ObjectId;
    productNameUz?: string,
    productNameKr?: string,
    productPrice?: number,
    productStatus?: ProductStatus,
    productCollection?: ProductCollection,
    productCcal?: number,
    productPrepTime?: number,
    productDesc?: string,
    productIngred?: [string],
    productImage?: string,
    recommended?: boolean,
    forManyPeople?: number,
}