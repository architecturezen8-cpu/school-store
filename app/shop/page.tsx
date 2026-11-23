import ShopView, { shopMetadata } from "@/components/pages/ShopView";

export const revalidate = 300;

export const generateMetadata = () => shopMetadata();

export default function Shop() {
  return <ShopView />;
}
