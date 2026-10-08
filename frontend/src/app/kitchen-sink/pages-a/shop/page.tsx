import { ShopPreview } from "./ShopPreview";

export default async function ShopKitchenSinkPage({ searchParams }: { searchParams: Promise<{ state?: string }> }) {
  const { state } = await searchParams;
  return <ShopPreview requested={state} />;
}
