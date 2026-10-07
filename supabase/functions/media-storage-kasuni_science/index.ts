import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const ALLOWED_FOLDERS = ["products", "videos", "welcome", "faq"];
const MAX_BYTES = 50 * 1024 * 1024;

/** FAQ attachments live in their own dedicated bucket, separate from product/welcome media. */
function bucketFor(ownerId: string, folder?: string) {
  return folder === "faq" ? `faqmedia-${ownerId}` : `biz-${ownerId}`;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function ensureBucket(admin: any, bucket: string) {
  const { data: b, error } = await admin.storage.getBucket(bucket);
  if (error || !b) {
    const { error: createError } = await admin.storage.createBucket(bucket, {
      public: true,
      fileSizeLimit: MAX_BYTES,
    });
    if (createError && !createError.message?.includes("already exists")) {
      console.warn(`Bucket create warning for ${bucket}:`, createError);
    }
  }
}

/** Resolves the business owner id for the caller (staff resolve to their owner). */
async function resolveOwner(req: Request): Promise<{ ownerId: string; userId: string } | null> {
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;

  const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    db: { schema: "kasuni_science" },
  });
  const { data, error } = await authClient.auth.getClaims(token);
  const userId = (data as any)?.claims?.sub;
  if (error || !userId) return null;

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    db: { schema: "kasuni_science" },
  });
  const { data: staff } = await admin
    .from("staff_accounts")
    .select("owner_id")
    .eq("staff_user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  return { ownerId: staff?.owner_id || userId, userId };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "upload";

    const auth = await resolveOwner(req);
    if (!auth) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
      db: { schema: "kasuni_science" },
    });
    const ownedBuckets = [bucketFor(auth.ownerId), bucketFor(auth.ownerId, "faq")];

    if (action === "upload") {
      const form = await req.formData();
      const file = form.get("file");
      const folderRaw = String(form.get("folder") || "products");
      if (!(file instanceof File)) return json({ error: "Missing file" }, 400);
      if (!ALLOWED_FOLDERS.includes(folderRaw)) return json({ error: "Invalid folder" }, 400);
      if (file.size > MAX_BYTES) return json({ error: "File exceeds 50MB limit" }, 400);

      const bucket = bucketFor(auth.ownerId, folderRaw);
      await ensureBucket(admin, bucket);

      const ext = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
      let key = "";
      if (ext === "pdf") {
        const safeName = file.name.replace(/[^a-zA-Z0-9_.-]/g, "_");
        key = `${folderRaw}/${safeName}`;
      } else {
        key = `${folderRaw}/${crypto.randomUUID()}.${ext}`;
      }
      const body = new Uint8Array(await file.arrayBuffer());

      const { error: uploadError } = await admin.storage
        .from(bucket)
        .upload(key, body, {
          contentType: file.type || "application/octet-stream",
          upsert: true,
        });

      if (uploadError) {
        console.error("Upload error:", uploadError);
        return json({ error: uploadError.message }, 500);
      }

      const { data: publicData } = admin.storage.from(bucket).getPublicUrl(key);
      const publicUrl = publicData.publicUrl.replace(
        SUPABASE_URL,
        "https://supabase.buildstart.io"
      );

      console.log(`Uploaded ${publicUrl} (${body.length} bytes)`);
      return json({ url: publicUrl, key, bucket });
    }

    if (action === "delete") {
      const { url: fileUrl } = await req.json();
      let matchedBucket: string | undefined;
      let key: string | undefined;

      for (const b of ownedBuckets) {
        const marker = `/${b}/`;
        const idx = typeof fileUrl === "string" ? fileUrl.indexOf(marker) : -1;
        if (idx !== -1) {
          matchedBucket = b;
          key = fileUrl.slice(idx + marker.length);
          break;
        }
      }

      if (!matchedBucket || !key) {
        return json({ error: "Invalid or forbidden file URL" }, 400);
      }

      const { error: delError } = await admin.storage.from(matchedBucket).remove([key]);
      if (delError) {
        console.error("Delete error:", delError);
        return json({ error: delError.message }, 500);
      }
      return json({ success: true });
    }

    if (action === "ensure-bucket") {
      const folder = url.searchParams.get("folder") || "products";
      const bucket = bucketFor(auth.ownerId, folder);
      await ensureBucket(admin, bucket);
      return json({ success: true, bucket });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (error) {
    console.error("media-storage error:", error);
    return json({ error: (error as Error).message }, 500);
  }
});
