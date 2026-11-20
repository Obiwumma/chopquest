import type { Metadata } from "next";
import { Suspense } from "react";
import MenuBoard from "@/components/cafe/MenuBoard";
import { SkeletonRows } from "@/components/cafe/bits";

export const metadata: Metadata = { title: "Menu board · ChopQuest" };

// params is runtime data: read it inside Suspense so the page shell can prerender.
async function Board({ params }: { params: PageProps<"/kitchen/[slug]">["params"] }) {
  const { slug } = await params;
  return <MenuBoard slug={slug} />;
}

export default function MenuBoardPage({ params }: PageProps<"/kitchen/[slug]">) {
  return (
    <Suspense fallback={<SkeletonRows n={5} label="Loading the menu" />}>
      <Board params={params} />
    </Suspense>
  );
}
