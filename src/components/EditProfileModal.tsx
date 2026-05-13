import { useState, useRef } from "react";
import { X, Loader2, Camera } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { profileAvatar } from "@/lib/avatar";
import { isUuid } from "@/lib/ids";
import { saveClientProfile } from "@/lib/cloudProfile";

interface EditProfileModalProps {
  profile: {
    username: string | null;
    full_name: string | null;
    bio: string | null;
    avatar_url: string | null;
    website: string | null;
    instagram_username?: string | null;
  };
  onClose: () => void;
}

export function EditProfileModal({ profile, onClose }: EditProfileModalProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [username, setUsername] = useState(profile.username || "");
  const [fullName, setFullName] = useState(profile.full_name || "");
  const [bio, setBio] = useState(profile.bio || "");
  const [website, setWebsite] = useState(profile.website || "");
  const [instagram, setInstagram] = useState(profile.instagram_username || "");
  const [avatarPreview, setAvatarPreview] = useState(profile.avatar_url || "");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);

    try {
      let avatarUrl = profile.avatar_url;

      if (!isUuid(user.id)) {
        if (avatarFile) avatarUrl = await fileToDataUrl(avatarFile);
        else avatarUrl = avatarPreview || avatarUrl || "";
        const { error } = await saveClientProfile(user, { username, full_name: fullName, bio, website, avatar_url: avatarUrl || "", instagram_username: instagram.replace(/^@/, "").trim() || null });
        queryClient.invalidateQueries({ queryKey: ["profile"] });
        queryClient.invalidateQueries({ queryKey: ["profile-settings"] });
        toast.success(error ? "Profile updated here. Apply cloud migration to sync it." : "Profile updated!");
        onClose();
        return;
      }

      if (avatarFile) {
        const ext = avatarFile.name.split(".").pop();
        const path = `${user.id}/avatar.${ext}`;
        await supabase.storage.from("avatars").upload(path, avatarFile, { upsert: true });
        const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
        avatarUrl = publicUrl;
      }

      const { error } = await supabase
        .from("profiles")
        .update({ username, full_name: fullName, bio, website, avatar_url: avatarUrl, instagram_username: instagram.replace(/^@/, "").trim() || null } as any)
        .eq("user_id", user.id);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Profile updated!");
      onClose();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 sm:items-center">
      <div className="w-full max-w-lg rounded-t-2xl sm:rounded-2xl bg-background max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <button onClick={onClose} className="text-foreground"><X className="h-6 w-6" /></button>
          <h2 className="text-lg font-bold text-foreground">Edit Profile</h2>
          <button onClick={handleSave} disabled={saving} className="text-sm font-bold text-primary disabled:opacity-50">
            {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : "Done"}
          </button>
        </div>

        <div className="p-4 space-y-5">
          <div className="flex flex-col items-center">
            <div className="relative" onClick={() => fileInputRef.current?.click()}>
              <img
                src={profileAvatar(avatarPreview, user?.id, username)}
                alt=""
                className="h-20 w-20 rounded-full object-cover"
              />
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40">
                <Camera className="h-6 w-6 text-white" />
              </div>
            </div>
            <input type="file" accept="image/*" ref={fileInputRef} onChange={handleAvatarSelect} className="hidden" />
            <button onClick={() => fileInputRef.current?.click()} className="mt-2 text-sm font-semibold text-primary">
              Change Photo
            </button>
          </div>

          {[
            { label: "Username", value: username, set: setUsername },
            { label: "Name", value: fullName, set: setFullName },
            { label: "Website", value: website, set: setWebsite },
            { label: "Instagram username", value: instagram, set: setInstagram },
          ].map((field) => (
            <div key={field.label}>
              <label className="text-xs text-muted-foreground">{field.label}</label>
              <input
                value={field.value}
                onChange={(e) => field.set(e.target.value)}
                className="mt-1 w-full border-b border-border bg-transparent pb-2 text-sm text-foreground outline-none focus:border-foreground"
              />
            </div>
          ))}

          <div>
            <label className="text-xs text-muted-foreground">Bio</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              className="mt-1 w-full border-b border-border bg-transparent pb-2 text-sm text-foreground outline-none resize-none focus:border-foreground"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
