const CUSTOM_RINGTONE_KEY = "wargram-custom-ringtone";

export function getRingtoneSource() {
  const preference = localStorage.getItem("wargram-ringtone") || "wargram";
  if (preference === "silent") return null;
  if (preference === "custom") return localStorage.getItem(CUSTOM_RINGTONE_KEY) || "/ringtone.wav";
  return preference === "classic" ? "/ringtone.wav" : "/ringtone.wav";
}

export function playRingtone(loop = true) {
  const src = getRingtoneSource();
  if (!src) return null;
  const audio = new Audio(src);
  audio.loop = loop;
  audio.play().catch(() => {});
  return audio;
}

export function stopRingtone(audio: HTMLAudioElement | null | undefined) {
  if (!audio) return;
  audio.pause();
  audio.currentTime = 0;
}

export function saveCustomRingtone(file: File): Promise<void> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      localStorage.setItem(CUSTOM_RINGTONE_KEY, String(reader.result || ""));
      localStorage.setItem("wargram-ringtone", "custom");
      resolve();
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
