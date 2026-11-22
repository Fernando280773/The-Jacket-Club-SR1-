"use client";

import { useState, type FormEvent } from "react";
import type { Staff } from "@/components/StaffGate";
import { fitWithin, penceToPounds, poundsToPence } from "@/lib/admin";
import { formatPence } from "@/lib/money";
import { staffClient } from "@/lib/staff-client";
import { friendlyError } from "./refresh";

export type AdminItem = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  price_pence: number;
  is_available: boolean;
  is_featured: boolean;
  photo_url: string | null;
  sort: number;
};

/** Shrinks a photo in the browser (max 1200px, WebP) so uploads are small and quick on shop Wi-Fi. */
async function shrinkPhoto(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const size = fitWithin(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, size.width, size.height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.82));
  if (!blob) throw new Error("Couldn't read that photo");
  return blob;
}

export function ItemEditor({ staff, item, onClose, onSaved }: { staff: Staff; item: AdminItem; onClose: () => void; onSaved: (message: string) => void }) {
  const [name, setName] = useState(item.name);
  const [description, setDescription] = useState(item.description ?? "");
  const [price, setPrice] = useState(penceToPounds(item.price_pence));
  const [available, setAvailable] = useState(item.is_available);
  const [featured, setFeatured] = useState(item.is_featured);
  const [photo, setPhoto] = useState(item.photo_url);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<"" | "save" | "photo">("");

  const pricePence = poundsToPence(price);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (pricePence === null) {
      setError("Enter a price from £0 to £100, like 7.50");
      return;
    }
    if (!name.trim()) {
      setError("The item needs a name");
      return;
    }
    setBusy("save");
    const { error } = await staffClient().rpc("admin_update_item", {
      p_item_id: item.id,
      p_name: name,
      p_description: description,
      p_price_pence: pricePence,
      p_is_available: available,
      p_is_featured: featured,
    });
    setBusy("");
    if (error) {
      setError(friendlyError(error.message));
      return;
    }
    onSaved(`${name.trim()} saved${pricePence !== item.price_pence ? ` · now ${formatPence(pricePence)}` : ""}.`);
  };

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setBusy("photo");
    setError("");
    try {
      const blob = await shrinkPhoto(file);
      const db = staffClient();
      const path = `${staff.shopId}/${item.code}-${Date.now()}.webp`;
      const { error: upErr } = await db.storage.from("menu-photos").upload(path, blob, { contentType: "image/webp", cacheControl: "31536000" });
      if (upErr) throw new Error(upErr.message);
      const url = db.storage.from("menu-photos").getPublicUrl(path).data.publicUrl;
      const { error } = await db.rpc("admin_set_item_photo", { p_item_id: item.id, p_photo_url: url });
      if (error) throw new Error(error.message);
      setPhoto(url);
    } catch (err) {
      setError(err instanceof Error && /not allowed|row-level/i.test(err.message) ? "Your login isn't allowed to add photos." : "Couldn't upload that photo. Try a JPG or PNG.");
    }
    setBusy("");
  };

  const removePhoto = async () => {
    setBusy("photo");
    const { error } = await staffClient().rpc("admin_set_item_photo", { p_item_id: item.id, p_photo_url: null });
    setBusy("");
    if (error) setError(friendlyError(error.message));
    else setPhoto(null);
  };

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center sm:items-center">
      <div aria-hidden="true" className="absolute inset-0 bg-club-ink/50" onClick={onClose} />
      <form
        role="dialog"
        aria-modal="true"
        aria-label={`Edit ${item.name}`}
        onSubmit={save}
        className="relative flex max-h-[92dvh] w-full max-w-lg flex-col gap-3 overflow-y-auto rounded-t-3xl bg-club-paper p-5 sm:rounded-3xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl text-club-green">Edit item</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="h-9 w-9 rounded-full bg-club-cream text-lg font-bold">
            ×
          </button>
        </div>

        <label className="flex flex-col gap-1 font-bold">
          Name
          <input data-testid="edit-name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} className="rounded-xl border border-club-line bg-white px-3 py-2 font-normal" />
        </label>
        <label className="flex flex-col gap-1 font-bold">
          Description
          <textarea value={description} maxLength={300} rows={3} onChange={(e) => setDescription(e.target.value)} className="rounded-xl border border-club-line bg-white px-3 py-2 font-normal" />
        </label>
        <label className="flex flex-col gap-1 font-bold">
          Price (£)
          <input
            data-testid="edit-price"
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            aria-invalid={pricePence === null}
            className="w-32 rounded-xl border border-club-line bg-white px-3 py-2 font-normal"
          />
        </label>
        <label className="flex items-center gap-2 font-bold">
          <input type="checkbox" checked={!available} onChange={(e) => setAvailable(!e.target.checked)} className="h-5 w-5 accent-club-green" />
          Sold out
        </label>
        <label className="flex items-center gap-2 font-bold">
          <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} className="h-5 w-5 accent-club-green" />
          Club favourite (shown at the top of the menu)
        </label>

        <div className="flex flex-col gap-2 rounded-2xl bg-club-cream p-3">
          <p className="font-bold">Photo</p>
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt={`Photo of ${name}`} className="h-40 w-full rounded-xl object-cover" />
          ) : (
            <p className="text-sm text-club-muted">No photo yet. The menu shows the item&apos;s initials.</p>
          )}
          <div className="flex flex-wrap gap-2">
            <label className="cursor-pointer rounded-xl bg-club-green px-4 py-2 text-sm font-bold text-club-paper">
              {busy === "photo" ? "Uploading…" : photo ? "Change photo" : "Add photo"}
              <input type="file" accept="image/*" className="sr-only" disabled={busy !== ""} onChange={(e) => upload(e.target.files?.[0])} />
            </label>
            {photo && (
              <button type="button" disabled={busy !== ""} onClick={removePhoto} className="rounded-xl border border-club-line px-4 py-2 text-sm font-bold">
                Remove photo
              </button>
            )}
          </div>
          <p className="text-xs text-club-muted">Photos save straight away. Allergens and options are changed by Claude, checked against supplier labels.</p>
        </div>

        {error && (
          <p role="alert" className="font-bold text-red-700">
            {error}
          </p>
        )}
        <button type="submit" data-testid="save-item" disabled={busy !== ""} className="rounded-2xl bg-club-green px-4 py-3 font-bold text-club-paper disabled:opacity-50">
          {busy === "save" ? "Saving…" : "Save"}
        </button>
      </form>
    </div>
  );
}
