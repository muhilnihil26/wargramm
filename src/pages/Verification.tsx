import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, BadgeCheck, Loader2, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

const CATEGORIES = ["Business", "Developer", "Creator", "Public figure", "Brand", "Journalist", "Athlete", "Other"];

const Verification = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [reason, setReason] = useState("");
  const [docFile, setDocFile] = useState<File | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ["my-verification-profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("is_verified, verification_status, full_name")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data as any;
    },
  });

  const { data: latestRequest } = useQuery({
    queryKey: ["my-latest-verification", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("verification_requests")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data as any;
    },
  });

  const upload = async (file: File, kind: string) => {
    const ext = file.name.split(".").pop();
    const path = `${user!.id}/${kind}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("verifications").upload(path, file);
    if (error) throw error;
    return supabase.storage.from("verifications").getPublicUrl(path).data.publicUrl;
  };

  const handleSubmit = async () => {
    if (!user) return;
    if (!fullName.trim() || !docFile) { toast.error("Full name and ID document are required"); return; }
    setSubmitting(true);
    try {
      const documentUrl = await upload(docFile, "document");
      let selfieUrl: string | null = null;
      if (selfieFile) selfieUrl = await upload(selfieFile, "selfie");

      const { error: insErr } = await supabase.from("verification_requests").insert({
        user_id: user.id,
        full_legal_name: fullName.trim(),
        category,
        reason: reason.trim() || null,
        document_url: documentUrl,
        selfie_url: selfieUrl,
      } as any);
      if (insErr) throw insErr;

      await supabase.from("profiles").update({ verification_status: "pending" } as any).eq("user_id", user.id);

      toast.success("Submitted! We'll review it shortly.");
      navigate("/profile");
    } catch (e: any) {
      toast.error(e.message);
    } finally { setSubmitting(false); }
  };

  if (profile?.is_verified) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6 text-center">
        <BadgeCheck className="h-20 w-20 text-primary mb-4" />
        <h1 className="text-xl font-bold text-foreground">You're verified</h1>
        <p className="mt-2 text-sm text-muted-foreground max-w-sm">Your account has the verified badge across WarGram.</p>
        <button onClick={() => navigate("/profile")} className="mt-6 rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground">Back to profile</button>
      </div>
    );
  }

  if (latestRequest && latestRequest.status === "pending") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6 text-center">
        <Loader2 className="h-16 w-16 text-primary mb-4 animate-spin" />
        <h1 className="text-xl font-bold text-foreground">Under review</h1>
        <p className="mt-2 text-sm text-muted-foreground max-w-sm">We received your verification request. We'll notify you once it's reviewed.</p>
        <button onClick={() => navigate("/profile")} className="mt-6 rounded-lg bg-secondary px-6 py-2.5 text-sm font-semibold text-foreground">Back</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-border bg-background/95 backdrop-blur-lg px-4 py-3">
        <button onClick={() => navigate(-1)}><ArrowLeft className="h-6 w-6 text-foreground" /></button>
        <h1 className="text-lg font-bold text-foreground">Request verified badge</h1>
      </header>

      <div className="mx-auto max-w-lg p-4 space-y-4">
        <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/10 p-4">
          <BadgeCheck className="h-8 w-8 text-primary shrink-0" />
          <p className="text-xs text-foreground/90">Submit your details and a government-issued ID. Reviews are usually completed within a few days.</p>
        </div>

        {latestRequest?.status === "rejected" && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs text-foreground">
            <p className="font-semibold text-destructive">Previous request rejected</p>
            {latestRequest.admin_note && <p className="mt-1 text-muted-foreground">"{latestRequest.admin_note}"</p>}
            <p className="mt-1 text-muted-foreground">You can submit a new request below.</p>
          </div>
        )}

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Full legal name *</label>
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="As shown on your ID"
            className="w-full rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary" />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Category *</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary">
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Why should you be verified?</label>
          <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)}
            placeholder="Briefly describe your notability, audience, or work."
            className="w-full resize-none rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary" />
        </div>

        <FileField label="Government-issued ID *" file={docFile} onChange={setDocFile} />
        <FileField label="Selfie holding the ID (optional)" file={selfieFile} onChange={setSelfieFile} />

        <button onClick={handleSubmit} disabled={submitting}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3 text-sm font-bold text-primary-foreground disabled:opacity-50">
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <BadgeCheck className="h-4 w-4" />}
          Submit for review
        </button>

        <p className="text-[10px] text-center text-muted-foreground">Your documents are stored securely and only viewed by admins.</p>
      </div>
    </div>
  );
};

function FileField({ label, file, onChange }: { label: string; file: File | null; onChange: (f: File | null) => void }) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-muted-foreground">{label}</label>
      <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-border bg-secondary px-3 py-3">
        <Upload className="h-5 w-5 text-primary" />
        <span className="flex-1 text-sm text-foreground truncate">{file ? file.name : "Choose a photo or PDF"}</span>
        <input type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => onChange(e.target.files?.[0] || null)} />
      </label>
      {file && file.type.startsWith("image/") && (
        <img src={URL.createObjectURL(file)} alt="preview" className="mt-2 max-h-32 rounded-lg object-cover" />
      )}
    </div>
  );
}

export default Verification;
