"use client";

import { useEffect } from "react";
import { clearSavedBasket } from "@/components/BasketProvider";

/** Empties the basket on this phone once the order is confirmed. */
export function ClearBasket() {
  useEffect(() => clearSavedBasket(), []);
  return null;
}
