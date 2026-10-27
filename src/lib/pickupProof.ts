import { createAdminClient } from "@/lib/supabase/admin";

// Photos proving a customer picked up (or received) an order. Stored in a
// PRIVATE bucket and only ever read through the admin order page, so they
// are never visible to the customer. The upload time is recorded by the
// storage server itself (not by the browser), which is what makes it
// usable as a timestamp if there is ever a dispute.
export const PROOF_BUCKET = "pickup-proof";

export type ProofPhoto = { path: string; url: string; takenAt: string };

export async function ensureProofBucket() {
  const admin = createAdminClient();
  await admin.storage.createBucket(PROOF_BUCKET, { public: false }).catch(() => {});
}

export async function listProofPhotos(orderId: string): Promise<ProofPhoto[]> {
  const admin = createAdminClient();
  const { data: files, error } = await admin.storage
    .from(PROOF_BUCKET)
    .list(orderId, { limit: 100, sortBy: { column: "created_at", order: "desc" } });
  if (error || !files || files.length === 0) return [];

  const paths = files.filter(f => f.name && !f.name.startsWith(".")).map(f => `${orderId}/${f.name}`);
  if (paths.length === 0) return [];
  const { data: signed } = await admin.storage.from(PROOF_BUCKET).createSignedUrls(paths, 3600);
  const urlByPath: Record<string, string> = {};
  (signed || []).forEach(s => { if (s.path && s.signedUrl) urlByPath[s.path] = s.signedUrl; });

  return files
    .filter(f => urlByPath[`${orderId}/${f.name}`])
    .map(f => ({
      path: `${orderId}/${f.name}`,
      url: urlByPath[`${orderId}/${f.name}`],
      takenAt: (f as any).created_at || (f as any).updated_at || ""
    }));
}
