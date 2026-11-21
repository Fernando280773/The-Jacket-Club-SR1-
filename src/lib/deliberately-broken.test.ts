import { expect, it } from "vitest";
import { formatPence } from "./money";
// Deliberately wrong, to prove a failing test stops a merge. Removed in the next commit.
it("deliberately broken check", () => { expect(formatPence(795)).toBe("£7.96"); });
