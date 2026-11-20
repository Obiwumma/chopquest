import type { Metadata } from "next";
import { Suspense } from "react";
import CafeteriaScreen from "@/components/cafe/CafeteriaScreen";
import { SkeletonRows } from "@/components/cafe/bits";

export const metadata: Metadata = { title: "Cafeteria · ChopQuest" };

async function Cafe({ params }: { params: PageProps<"/cafeterias/[slug]">["params"] }) {
  const { slug } = await params;
  return <CafeteriaScreen slug={slug} />;
}

export default function CafeteriaPage({ params }: PageProps<"/cafeterias/[slug]">) {
  return (
    <Suspense fallback={<SkeletonRows n={4} label="Loading the cafeteria" />}>
      <Cafe params={params} />
    </Suspense>
  );
}
