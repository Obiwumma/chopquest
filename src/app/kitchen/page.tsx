import type { Metadata } from "next";
import KitchenHome from "@/components/cafe/KitchenHome";

export const metadata: Metadata = { title: "Kitchen · ChopQuest" };

export default function KitchenPage() {
  return <KitchenHome />;
}
