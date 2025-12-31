import { ObjectId } from "mongoose";
import { shapeIntoMongooseObjectId } from "../libs/config";
import ProductService from "./Product.service";
import Errors, { HttpCode, Message } from "../libs/Errors";

export interface CartItem {
  productId: string;
  productNameUz?: string;
  productNameKr?: string;
  itemQuantity: number;
  itemPrice: number;
  total: number;
}

export interface Cart {
  tableId: string;
  items: CartItem[];
  total: number;
  createdAt: Date;
  updatedAt: Date;
}

class CartService {
  // In-memory cart storage: tableId -> Cart
  private carts: Map<string, Cart> = new Map();
  private productService: ProductService;

  constructor() {
    this.productService = new ProductService();
  }

  /**
   * Get cart for table
   */
  public async getCart(tableId: string): Promise<Cart> {
    const cart = this.carts.get(tableId);
    
    if (!cart) {
      return {
        tableId,
        items: [],
        total: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }

    // Recalculate total
    cart.total = cart.items.reduce((sum, item) => sum + item.total, 0);
    cart.updatedAt = new Date();

    return cart;
  }

  /**
   * Add item to cart
   */
  public async addToCart(tableId: string, productId: string, quantity: number = 1): Promise<Cart> {
    // Get product info
    const product = await this.productService.getProduct(null, productId);
    
    if (!product) {
      throw new Errors(HttpCode.NOT_FOUND, Message.NO_DATA_FOUND);
    }

    // Get or create cart
    let cart = this.carts.get(tableId);
    if (!cart) {
      cart = {
        tableId,
        items: [],
        total: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }

    // Check if product already in cart
    const existingItemIndex = cart.items.findIndex(
      item => item.productId === productId
    );

    if (existingItemIndex >= 0) {
      // Update quantity
      cart.items[existingItemIndex].itemQuantity += quantity;
      cart.items[existingItemIndex].total = 
        cart.items[existingItemIndex].itemQuantity * cart.items[existingItemIndex].itemPrice;
    } else {
      // Add new item
      const newItem: CartItem = {
        productId: productId,
        productNameUz: product.productNameUz,
        productNameKr: product.productNameKr,
        itemQuantity: quantity,
        itemPrice: product.productPrice,
        total: product.productPrice * quantity,
      };
      cart.items.push(newItem);
    }

    // Recalculate total
    cart.total = cart.items.reduce((sum, item) => sum + item.total, 0);
    cart.updatedAt = new Date();

    this.carts.set(tableId, cart);
    return cart;
  }

  /**
   * Update item quantity in cart
   */
  public async updateCartItem(
    tableId: string,
    productId: string,
    quantity: number
  ): Promise<Cart> {
    const cart = this.carts.get(tableId);
    
    if (!cart) {
      throw new Errors(HttpCode.NOT_FOUND, "Cart not found");
    }

    const itemIndex = cart.items.findIndex(item => item.productId === productId);
    
    if (itemIndex < 0) {
      throw new Errors(HttpCode.NOT_FOUND, "Item not found in cart");
    }

    if (quantity <= 0) {
      // Remove item if quantity is 0 or less
      cart.items.splice(itemIndex, 1);
    } else {
      // Update quantity
      cart.items[itemIndex].itemQuantity = quantity;
      cart.items[itemIndex].total = cart.items[itemIndex].itemPrice * quantity;
    }

    // Recalculate total
    cart.total = cart.items.reduce((sum, item) => sum + item.total, 0);
    cart.updatedAt = new Date();

    this.carts.set(tableId, cart);
    return cart;
  }

  /**
   * Remove item from cart
   */
  public async removeCartItem(tableId: string, productId: string): Promise<Cart> {
    const cart = this.carts.get(tableId);
    
    if (!cart) {
      throw new Errors(HttpCode.NOT_FOUND, "Cart not found");
    }

    const itemIndex = cart.items.findIndex(item => item.productId === productId);
    
    if (itemIndex < 0) {
      throw new Errors(HttpCode.NOT_FOUND, "Item not found in cart");
    }

    cart.items.splice(itemIndex, 1);

    // Recalculate total
    cart.total = cart.items.reduce((sum, item) => sum + item.total, 0);
    cart.updatedAt = new Date();

    this.carts.set(tableId, cart);
    return cart;
  }

  /**
   * Clear cart
   */
  public async clearCart(tableId: string): Promise<void> {
    this.carts.delete(tableId);
  }

  /**
   * Get cart items as OrderItemInput format
   */
  public async getCartAsOrderItems(tableId: string): Promise<any[]> {
    const cart = await this.getCart(tableId);
    
    return cart.items.map(item => ({
      productId: shapeIntoMongooseObjectId(item.productId),
      itemQuantity: item.itemQuantity,
      itemPrice: item.itemPrice,
    }));
  }
}

export default CartService;

