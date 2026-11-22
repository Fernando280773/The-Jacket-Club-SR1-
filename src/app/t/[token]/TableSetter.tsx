"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { saveTable } from "@/components/BasketProvider";

export function TableSetter({ token, number }: { token: string; number: number }) {
  const router = useRouter();
  useEffect(() => {
    saveTable({ token, number });
    router.replace("/");
  }, [router, token, number]);
  return <p className="p-8 text-center">Table {number}: opening the menu…</p>;
}
