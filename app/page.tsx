"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getActiveCreatorId } from "@/lib/creatorContext";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const creatorId = getActiveCreatorId();
    if (creatorId) {
      router.push("/overview");
    } else {
      router.push("/connect");
    }
  }, [router]);

  return (
    <div className="flex items-center justify-center h-screen bg-charcoal">
      <div className="text-foreground/60">Loading...</div>
    </div>
  );
}
