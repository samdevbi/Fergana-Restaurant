import mongoose, { Schema } from "mongoose";
import { ProductCollection, ProductStatus } from "../libs/enums/product.enum";


const productSchema = new Schema(
    {
        productStatus: {
            type: String,
            enum: ProductStatus,
            default: ProductStatus.PAUSE,
        },

        productCollection: {
            type: String,
            enum: ProductCollection,
            required: true,
        },

        productNameUz: {
            type: String,
            required: true,
        },

        productNameKr: {
            type: String,
            required: true,
        },

        productPrice: {
            type: Number,
            required: true,
        },

        productCcal: {
            type: Number,
        },

        productPrepTime: {
            type: Number,
        },

        productDesc: {
            type: String,
        },

        productIngred: {
            type: [String],
            default: [],
        },

        productImage: {
            type: String,
        },

        recommended: {
            type: Boolean,
            default: false,
        },

        forManyPeople: {
            type: Number,
            default: 1,
        },

    },
    { timestamps: true }  // updateAt, createAt
);

productSchema.index(
    { productNameUz: 1, productNameKr: 1 },
    { unique: true });


export default mongoose.model("Product", productSchema);