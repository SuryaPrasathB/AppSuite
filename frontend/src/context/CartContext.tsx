import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiClient } from '../api/apiClient';

export interface CartItem {
  id: string; // unique cart item identifier (product_id + location_id)
  product_id: number;
  product_name: string;
  product_code: string;
  location_id: number;
  location_label: string;
  quantity: number;
  unit: string;
}

interface CartContextType {
  items: CartItem[];
  addToCart: (item: Omit<CartItem, 'id'>) => void;
  removeFromCart: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  checkout: (userName: string, userRole: string) => Promise<string>;
  totalCount: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>([]);

  // Load cart from localStorage on mount
  useEffect(() => {
    const storedCart = localStorage.getItem('smart_store_cart');
    if (storedCart) {
      try {
        setItems(JSON.parse(storedCart));
      } catch (_) {
        localStorage.removeItem('smart_store_cart');
      }
    }
  }, []);

  // Save cart to localStorage when changed
  const saveCart = (newItems: CartItem[]) => {
    setItems(newItems);
    localStorage.setItem('smart_store_cart', JSON.stringify(newItems));
  };

  const addToCart = (newItem: Omit<CartItem, 'id'>) => {
    const id = `${newItem.product_id}-${newItem.location_id}`;
    const existingIndex = items.findIndex(i => i.id === id);

    if (existingIndex > -1) {
      const updated = [...items];
      updated[existingIndex].quantity += newItem.quantity;
      saveCart(updated);
    } else {
      saveCart([...items, { ...newItem, id }]);
    }
  };

  const removeFromCart = (id: string) => {
    saveCart(items.filter(i => i.id !== id));
  };

  const updateQuantity = (id: string, quantity: number) => {
    saveCart(items.map(i => i.id === id ? { ...i, quantity: Math.max(0.01, quantity) } : i));
  };

  const clearCart = () => {
    saveCart([]);
  };

  const checkout = async (userName: string, userRole: string): Promise<string> => {
    if (items.length === 0) throw new Error("Cart is empty.");

    const payload = {
      items: items.map(i => ({
        product_id: i.product_id,
        location_id: i.location_id,
        quantity: i.quantity,
        remarks: `Cart Bulk Extraction (Target Bin: ${i.location_label})`
      })),
      user_name: userName,
      user_role: userRole
    };

    try {
      const res = await apiClient.inventory.bulkStockOut(payload);
      clearCart();
      return res.message || "Bulk extraction completed successfully.";
    } catch (err: any) {
      throw new Error(err.message || "Failed to process bulk extraction.");
    }
  };

  const totalCount = items.reduce((acc, curr) => acc + curr.quantity, 0);

  return (
    <CartContext.Provider value={{
      items,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      checkout,
      totalCount: items.length
    }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
