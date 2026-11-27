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
import { stockFor } from "@/lib/stock-core";

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
  /**
   * How many of this shelf cell exist, when the shop counts stock. null = not
   * counted, so the bag does not police it.
   *
   * Kept on the line because the bag is where a quantity is raised and lowered by
   * hand: without it, "+" could walk a hoodie past the three that are on the
   * shelf, and the customer only found out at the till.
   */
  cap?: number | null;
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
    // The shelf decides the ceiling, not the stepper: three left is three, even
    // if the number box was set to five. Nothing is added when there is none.
    const available = stockFor(product, colour, size);
    const cap = available === null ? null : available;
    if (cap === 0) return;
    const fit = (n: number) => (cap === null ? n : Math.min(n, cap));

    setItems((prev) => {
      const existing = prev.find((i) => i.id === id);
      if (existing) {
        return prev.map((i) =>
          i.id === id ? { ...i, qty: fit(i.qty + wanted), cap } : i
        );
      }
      return [
        ...prev,
        {
          id,
          slug: product.slug,
          name: product.name,
          price: product.price,
          image: product.image,
          qty: fit(wanted),
          variant,
          colour,
          size,
          cap,
        },
      ];
    });
  }, []);

  const remove = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  /**
   * Sets a line's quantity, never above what the shelf holds.
   *
   * The bag's own "+" button goes through here, so it stops at the stock exactly
   * as the product page's stepper does — one rule, wherever the number is raised.
   */
  const setQty = useCallback((id: string, qty: number) => {
    setItems((prev) =>
      qty <= 0
        ? prev.filter((i) => i.id !== id)
        : prev.map((i) =>
            i.id === id
              ? { ...i, qty: i.cap === null || i.cap === undefined ? qty : Math.min(qty, i.cap) }
              : i
          )
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
