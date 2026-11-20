import type { Metadata } from "next";
import { Suspense } from "react";
import DishWorkbench from "@/components/cafe/swap/DishWorkbench";
import { SkeletonRows } from "@/components/cafe/bits";

export const metadata: Metadata = { title: "Find a plant swap · ChopQuest" };

async function Workbench({ params }: { params: PageProps<"/kitchen/[slug]/[itemId]">["params"] }) {
  const { slug, itemId } = await params;
  return <DishWorkbench slug={slug} itemId={Number(itemId)} />;
}

export default function DishSwapPage({ params }: PageProps<"/kitchen/[slug]/[itemId]">) {
  return (
    <Suspense fallback={<SkeletonRows n={4} label="Loading the dish" />}>
      <Workbench params={params} />
    </Suspense>
  );
}
