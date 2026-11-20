import type { Metadata } from "next";
import { Suspense } from "react";
import DishScreen from "@/components/cafe/DishScreen";
import { SkeletonRows } from "@/components/cafe/bits";

export const metadata: Metadata = { title: "Plant dish · ChopQuest" };

async function Dish({ params }: { params: PageProps<"/dishes/[id]">["params"] }) {
  const { id } = await params;
  return <DishScreen id={Number(id)} />;
}

export default function DishPage({ params }: PageProps<"/dishes/[id]">) {
  return (
    <Suspense fallback={<SkeletonRows n={4} h="h-28" label="Loading the dish" />}>
      <Dish params={params} />
    </Suspense>
  );
}
