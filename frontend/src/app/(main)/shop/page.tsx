import type { Metadata } from "next";
import { ShopPage } from "@/features/shop/ShopPage";

export const metadata: Metadata = { title: "Shop" };

export default function ShopRoute() {
  return <ShopPage />;
}
