"use client";

import { StaffGate } from "@/components/StaffGate";
import { KitchenBoard } from "./KitchenBoard";

/** Kitchen tablet: sign in as kitchen staff or owner, then the live board. */
export function KitchenApp() {
  return (
    <StaffGate title="Kitchen sign in" roles={["owner", "kitchen"]}>
      {(staff, signOut) => <KitchenBoard staff={staff} signOut={signOut} />}
    </StaffGate>
  );
}
