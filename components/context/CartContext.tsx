"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Product } from "@/data/seed";

export type CartItem = {
  /**
   * `slug|colour|size`.
   *
   * A line used to be keyed by slug alone, which meant the second hoodie — a
   * large navy one — quietly joined the first. With stock counted per colour and
   * per size, that was a bag that could not be fulfilled: the shop checked one
   * shelf cell and the customer received two.
   */
  id: string;
  slug: string;
  name: string;
  price: number;
  image: string;
  qty: number;
  /** The display label, e.g. "Navy / L". */
  variant?: string;
  colour: string;
  size: string;
};

export type CartChoice = { colour?: string; size?: string };

type CartContextValue = {
  items: CartItem[];
  count: number;
  subtotal: number;
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  add: (product: Product, choice?: CartChoice, qty?: number) => void;
  remove: (id: string) => void;
  setQty: (id: string, qty: number) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setOpen] = useState(false);

  /**
   * `qty` is the number in the stepper next to the button.
   *
   * It used to be ignored: "3" then Add to bag put one in the bag, three times
   * over. The bag is where the customer checks what they are buying, so the
   * number they chose has to be the number that arrives.
   */
  const add = useCallback((product: Product, choice: CartChoice = {}, qty = 1) => {
    const colour = (choice.colour ?? "").trim();
    const size = (choice.size ?? "").trim();
    const id = `${product.slug}|${colour}|${size}`;
    const variant = [colour, size].filter(Boolean).join(" / ");
    const wanted = Math.max(1, Math.round(qty) || 1);

    setItems((prev) => {
      const existing = prev.find((i) => i.id === id);
      if (existing) {
        return prev.map((i) => (i.id === id ? { ...i, qty: i.qty + wanted } : i));
      }
      return [
        ...prev,
        {
          id,
          slug: product.slug,
          name: product.name,
          price: product.price,
          image: product.image,
          qty: wanted,
          variant,
          colour,
          size,
        },
      ];
    });
  }, []);

  const remove = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const setQty = useCallback((id: string, qty: number) => {
    setItems((prev) =>
      qty <= 0
        ? prev.filter((i) => i.id !== id)
        : prev.map((i) => (i.id === id ? { ...i, qty } : i))
    );
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const { count, subtotal } = useMemo(
    () => ({
      count: items.reduce((acc, i) => acc + i.qty, 0),
      subtotal: items.reduce((acc, i) => acc + i.qty * i.price, 0),
    }),
    [items]
  );

  const value = useMemo(
    () => ({ items, count, subtotal, isOpen, setOpen, add, remove, setQty, clear }),
    [items, count, subtotal, isOpen, add, remove, setQty, clear]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
