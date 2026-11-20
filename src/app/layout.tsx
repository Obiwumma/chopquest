import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Nunito } from "next/font/google";
import "./globals.css";
import VineNav from "@/components/nav/VineNav";
import PlantBackdrop from "@/components/nav/PlantBackdrop";

const nunito = Nunito({ variable: "--font-nunito", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ChopQuest",
  description: "Keep your jollof, upgrade your protein.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#16a34a",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${nunito.variable} h-full antialiased`}>
      <body className="relative isolate min-h-full flex flex-col font-sans md:pl-60">
        <PlantBackdrop />
        {/* Phone: room for the seed button. Laptop: the vine rail sits on the left (md:pl-60). */}
        <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pt-6 pb-[calc(env(safe-area-inset-bottom)+7rem)] md:max-w-3xl md:px-8 md:pb-10 lg:max-w-5xl">
          {children}
        </main>
        {/* The nav reads the URL, so it streams in on dynamic routes (/kitchen/[slug] ...). */}
        <Suspense fallback={null}>
          <VineNav />
        </Suspense>
      </body>
    </html>
  );
}
