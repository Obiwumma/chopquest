import type { Metadata } from "next";
import CafeteriasScreen from "@/components/cafe/CafeteriasScreen";

export const metadata: Metadata = { title: "Cafeterias · ChopQuest" };

export default function CafeteriasPage() {
  return <CafeteriasScreen />;
}
