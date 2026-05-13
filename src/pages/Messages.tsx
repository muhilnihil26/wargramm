import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Send, Image, X, Check, CheckCheck, SmilePlus, Phone, Video as VideoIcon, Paperclip, FileText, Trash2, Palette } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { database } from "@/integrations/firebase/config";
import { useAuth } from "@/contexts/AuthContext";
import { isOnline } from "@/hooks/usePresence";
import { toast } from "sonner";
import wargramLogo from "@/assets/wargram-logo.png";
import { CallModal } from "@/components/CallModal";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { linkify } from "@/lib/linkify";
import { profileAvatar } from "@/lib/avatar";
import { chatService } from "@/services/chatService";
import { searchUsersEverywhere } from "@/lib/userDirectory";
import { listVisibleKnownProfiles } from "@/lib/knownUsers";
import { readFirebasePublicProfile } from "@/lib/firebaseUserData";
import { logCloudAction } from "@/lib/cloudActions";
import { onValue, ref, remove, set } from "firebase/database";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isUuid = (value?: string | null) => !!value && value !== "undefined" && UUID_RE.test(value);
const firebaseRoomId = (a: string, b: string) => `firebase-${[a, b].sort().join("-")}`;
const isFirebaseRoom = (id?: string | null) => !!id?.startsWith("firebase-");
const localChatKey = (roomId: string) => `wargram-local-chat:${roomId}`;

const REACTION_EMOJIS = ["❤️", "😂", "😮", "😢", "👍", "🔥"];

interface Conversation {
  id: string;
  user1_id: string;
  user2_id: string;
  other_user: { user_id: string; username: string; avatar_url: string; last_seen?: string | null; is_verified?: boolean | null };
  last_message?: string;
  last_message_read?: boolean;
  last_message_sender?: string;
  unread_count: number;
  updated_at: string;
}

interface Reaction { id: string; message_id: string; user_id: string; emoji: string; }

interface Message {
  id: string;
  sender_id: string;
  content: string;
  image_url?: string | null;
  read: boolean;
  created_at: string;
}

const localConversationsKey = (userId: string) => `wargram-local-conversations:${userId}`;

const sortMessages = (items: Message[]) =>
  [...items].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

const readLocalMessages = (roomId: string): Message[] => {
  try {
    const parsed = JSON.parse(localStorage.getItem(localChatKey(roomId)) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeLocalMessages = (roomId: string, items: Message[]) => {
  localStorage.setItem(localChatKey(roomId), JSON.stringify(sortMessages(items).slice(-150)));
};

const persistLocalMessage = (roomId: string, message: Message) => {
  const next = sortMessages([...readLocalMessages(roomId).filter((m) => m.id !== message.id), message]);
  writeLocalMessages(roomId, next);
  return next;
};

const mergeRemoteAndLocal = (roomId: string, remote: Message[]) => {
  const local = readLocalMessages(roomId).filter((localMsg) => (
    !remote.some((remoteMsg) => (
      remoteMsg.sender_id === localMsg.sender_id
      && remoteMsg.content === localMsg.content
      && Math.abs(new Date(remoteMsg.created_at).getTime() - new Date(localMsg.created_at).getTime()) < 15000
    ))
  ));
  return sortMessages([...local, ...remote]);
};

const readLocalConversations = (userId: string): Conversation[] => {
  try {
    const parsed = JSON.parse(localStorage.getItem(localConversationsKey(userId)) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeLocalConversations = (userId: string, items: Conversation[]) => {
  const sorted = [...items].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  localStorage.setItem(localConversationsKey(userId), JSON.stringify(sorted.slice(0, 50)));
};

const rememberLocalConversation = (userId: string, convo: Conversation, message: Message) => {
  const existing = readLocalConversations(userId).filter((c) => c.id !== convo.id);
  const next: Conversation = {
    ...convo,
    last_message: message.content || (message.image_url ? "Photo" : ""),
    last_message_read: true,
    last_message_sender: message.sender_id,
    unread_count: 0,
    updated_at: message.created_at,
  };
  writeLocalConversations(userId, [next, ...existing]);
};

const Messages = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvo, setActiveConvo] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [searchUsers, setSearchUsers] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [otherTyping, setOtherTyping] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [pickerForMsg, setPickerForMsg] = useState<string | null>(null);
  const [otherProfile, setOtherProfile] = useState<{ last_seen?: string | null; is_verified?: boolean | null } | null>(null);
  const [callMode, setCallMode] = useState<"audio" | "video" | null>(null);
  const [callInitiator, setCallInitiator] = useState(true);
  const [incomingCall, setIncomingCall] = useState<{ mode: "audio" | "video"; from: string; conversationId: string; peer?: Conversation["other_user"] } | null>(null);
  const [attachFile, setAttachFile] = useState<File | null>(null);
  const [showBgPicker, setShowBgPicker] = useState(false);
  const [chatBg, setChatBg] = useState(() => localStorage.getItem("wargram-chat-bg") || "default");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { if (user) loadConversations(); }, [user]);

  useEffect(() => {
    if (!user) return;
    const invitesRef = ref(database, `callInvites/${user.id}`);
    const unsubscribe = onValue(invitesRef, async (snapshot) => {
      const invites = snapshot.val();
      if (!invites) return;
      const latest = Object.values(invites)
        .filter((invite: any) => invite?.status === "ringing" && invite.from !== user.id)
        .sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0))[0] as any;
      if (!latest) return;
      const peer = await resolvePeerProfile(latest.from);
      setIncomingCall({
        mode: latest.mode || "audio",
        from: latest.from,
        conversationId: latest.conversationId,
        peer,
      });
    });
    return unsubscribe;
  }, [user]);

  // Live-sync inbox badges: refresh conversations on any message insert/update
  // for any conversation the user belongs to. Only runs when no chat is open.
  useEffect(() => {
    if (!user || activeConvo) return;
    const ch = supabase
      .channel(`inbox-sync:${user.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        const m: any = payload.new;
        const inList = conversations.some((c) => c.id === m.conversation_id);
        if (inList && m.sender_id !== user.id) loadConversations();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages" }, (payload) => {
        const m: any = payload.new;
        const inList = conversations.some((c) => c.id === m.conversation_id);
        if (inList) loadConversations();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, activeConvo, conversations.length]);

  // Deep-link: /messages?to=<userId> opens (or creates) that conversation
  useEffect(() => {
    if (!user) return;
    const to = new URLSearchParams(window.location.search).get("to");
    if (!to || to === user.id) {
      if (to) window.history.replaceState({}, "", "/messages");
      return;
    }
    (async () => {
      const [u1, u2] = user.id < to ? [user.id, to] : [to, user.id];
      let otherProfile: any = null;
      if (isUuid(to)) {
        const { data: profile } = await supabase.from("profiles").select("user_id, username, avatar_url, last_seen, is_verified").eq("user_id", to).maybeSingle();
        otherProfile = profile;
      } else {
        const profile = await readFirebasePublicProfile(to).catch(() => null);
        const known = listVisibleKnownProfiles().find((p) => p.user_id === to);
        otherProfile = profile
          ? { user_id: to, username: profile.username || profile.email?.split("@")[0] || "User", avatar_url: profile.avatar_url || "", last_seen: null, is_verified: profile.is_verified }
          : known || null;
      }
      otherProfile = otherProfile || { user_id: to, username: "User", avatar_url: "", last_seen: null, is_verified: false };
      if (!isUuid(user.id) || !isUuid(to)) {
        setActiveConvo({ id: firebaseRoomId(user.id, to), user1_id: user.id, user2_id: to, other_user: otherProfile as any, updated_at: new Date().toISOString(), unread_count: 0 });
        window.history.replaceState({}, "", "/messages");
        return;
      }
      const { data: existing, error: existingError } = await supabase.from("conversations").select("*").eq("user1_id", u1).eq("user2_id", u2).maybeSingle();
      if (existingError) {
        toast.error(existingError.message);
        return;
      }
      if (existing) {
        setActiveConvo({ id: existing.id, user1_id: existing.user1_id, user2_id: existing.user2_id, other_user: otherProfile as any, updated_at: existing.updated_at, unread_count: 0 });
      } else {
        const { data: created, error: createError } = await supabase.from("conversations").insert({ user1_id: u1, user2_id: u2 }).select().single();
        if (createError) {
          toast.error(createError.message);
          return;
        }
        if (created) setActiveConvo({ id: created.id, user1_id: created.user1_id, user2_id: created.user2_id, other_user: otherProfile as any, updated_at: created.updated_at, unread_count: 0 });
      }
      window.history.replaceState({}, "", "/messages");
    })();
  }, [user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Active conversation: load messages, subscribe to realtime, mark as read
  useEffect(() => {
    if (!activeConvo || !user) return;
    if (isFirebaseRoom(activeConvo.id)) {
      setMessages(readLocalMessages(activeConvo.id));
      try {
        const unsubscribe = chatService.onMessages(activeConvo.id, (items) => {
          const remote = items.map((m) => ({
            id: m.id,
            sender_id: m.senderId,
            content: m.text,
            image_url: m.mediaUrl || null,
            read: true,
            created_at: new Date(m.timestamp).toISOString(),
          }));
          setMessages((prev) => sortMessages(mergeRemoteAndLocal(activeConvo.id, [...prev, ...remote])));
        });
        return unsubscribe;
      } catch {
        toast.info("Realtime chat is blocked. Cloud messages will still load after migration.");
        return;
      }
    }
    loadMessages(activeConvo.id);
    loadReactions(activeConvo.id);
    markMessagesRead(activeConvo.id);
    // Load other user's last_seen + verification for online status & badge
    supabase.from("profiles").select("last_seen, is_verified").eq("user_id", activeConvo.other_user.user_id).maybeSingle()
      .then(({ data }) => setOtherProfile(data as any));

    const msgChannel = supabase
      .channel(`msgs:${activeConvo.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${activeConvo.id}` }, (payload) => {
        const msg = payload.new as Message;
        setMessages((prev) => prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]);
        if (msg.sender_id !== user.id) markMessagesRead(activeConvo.id);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages", filter: `conversation_id=eq.${activeConvo.id}` }, (payload) => {
        setMessages((prev) => prev.map((m) => m.id === payload.new.id ? { ...m, ...payload.new } as Message : m));
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "messages", filter: `conversation_id=eq.${activeConvo.id}` }, (payload) => {
        setMessages((prev) => prev.filter((m) => m.id !== (payload.old as any).id));
      })
      .subscribe();

    // Reactions realtime channel
    const reactionChannel = supabase
      .channel(`reactions:${activeConvo.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "message_reactions" }, () => {
        loadReactions(activeConvo.id);
      })
      .subscribe();

    // Typing indicator + last_seen via realtime channel updates (poll only for typing)
    const isUser1 = activeConvo.user1_id === user.id;
    const typingCol = isUser1 ? "user2_typing_at" : "user1_typing_at";

    const pollInterval = setInterval(async () => {
      const { data } = await supabase.from("conversations").select(typingCol).eq("id", activeConvo.id).single();
      if (data) {
        const typingAt = (data as any)[typingCol];
        setOtherTyping(typingAt ? Date.now() - new Date(typingAt).getTime() < 4000 : false);
      }
    }, 2000);

    // Poll last_seen less aggressively
    const presenceInterval = setInterval(async () => {
      const { data: prof } = await supabase.from("profiles").select("last_seen, is_verified").eq("user_id", activeConvo.other_user.user_id).maybeSingle();
      if (prof) setOtherProfile(prof as any);
    }, 15000);

    // Listen for incoming call invites on the call channel
    const callChannel = supabase
      .channel(`call-invite:${activeConvo.id}`, { config: { broadcast: { self: false } } })
      .on("broadcast", { event: "invite" }, ({ payload }) => {
        if (payload.from === user.id) return;
        setIncomingCall({ mode: payload.mode, from: payload.from, conversationId: activeConvo.id, peer: activeConvo.other_user });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(msgChannel);
      supabase.removeChannel(reactionChannel);
      supabase.removeChannel(callChannel);
      clearInterval(pollInterval);
      clearInterval(presenceInterval);
    };
  }, [activeConvo]);

  const startCall = async (mode: "audio" | "video") => {
    if (!activeConvo || !user) return;
    const peerId = activeConvo.other_user.user_id;
    await set(ref(database, `callInvites/${peerId}/${activeConvo.id}`), {
      from: user.id,
      to: peerId,
      conversationId: activeConvo.id,
      mode,
      status: "ringing",
      createdAt: Date.now(),
    }).catch(() => {});
    // Send invite broadcast so the other side can show the incoming-call UI.
    try {
      const ch = supabase.channel(`call-invite:${activeConvo.id}`);
      await new Promise<void>((resolve) => {
        ch.subscribe((s) => { if (s === "SUBSCRIBED" || s === "CHANNEL_ERROR") resolve(); });
      });
      await ch.send({ type: "broadcast", event: "invite", payload: { from: user.id, mode } });
      supabase.removeChannel(ch);
    } catch {
      toast.info("Starting call without invite signal.");
    }
    setCallInitiator(true);
    setCallMode(mode);
  };

  const resolvePeerProfile = async (userId: string): Promise<Conversation["other_user"]> => {
    if (isUuid(userId)) {
      const { data } = await supabase.from("profiles").select("user_id, username, avatar_url, last_seen, is_verified").eq("user_id", userId).maybeSingle();
      if (data) return data as any;
    }
    const profile = await readFirebasePublicProfile(userId).catch(() => null);
    const known = listVisibleKnownProfiles().find((p) => p.user_id === userId);
    return profile
      ? { user_id: userId, username: profile.username || profile.email?.split("@")[0] || "User", avatar_url: profile.avatar_url || "", last_seen: null, is_verified: profile.is_verified }
      : known || { user_id: userId, username: "User", avatar_url: "", last_seen: null, is_verified: false };
  };

  const acceptIncomingCall = async () => {
    if (!user || !incomingCall) return;
    const peer = incomingCall.peer || await resolvePeerProfile(incomingCall.from);
    await remove(ref(database, `callInvites/${user.id}/${incomingCall.conversationId}`)).catch(() => {});
    setActiveConvo({
      id: incomingCall.conversationId,
      user1_id: user.id,
      user2_id: incomingCall.from,
      other_user: peer,
      updated_at: new Date().toISOString(),
      unread_count: 0,
    });
    const mode = incomingCall.mode;
    setIncomingCall(null);
    setCallInitiator(false);
    setCallMode(mode);
  };

  const rejectIncomingCall = async () => {
    if (!user || !incomingCall) return;
    await remove(ref(database, `callInvites/${user.id}/${incomingCall.conversationId}`)).catch(() => {});
    setIncomingCall(null);
  };

  const loadReactions = async (convoId: string) => {
    if (!isUuid(convoId)) return;
    const { data: msgs } = await supabase.from("messages").select("id").eq("conversation_id", convoId);
    if (!msgs || msgs.length === 0) { setReactions([]); return; }
    const { data } = await supabase.from("message_reactions").select("*").in("message_id", msgs.map((m: any) => m.id));
    setReactions((data as Reaction[]) || []);
  };

  const toggleReaction = async (messageId: string, emoji: string) => {
    if (!user) return;
    const existing = reactions.find((r) => r.message_id === messageId && r.user_id === user.id && r.emoji === emoji);
    if (existing) {
      await supabase.from("message_reactions").delete().eq("id", existing.id);
      await logCloudAction(user, "message_reaction_remove", { message_id: messageId, emoji }).catch(() => {});
    } else {
      await supabase.from("message_reactions").insert({ message_id: messageId, user_id: user.id, emoji } as any);
      await logCloudAction(user, "message_reaction_add", { message_id: messageId, emoji }).catch(() => {});
    }
    setPickerForMsg(null);
    loadReactions(activeConvo!.id);
  };

  const loadConversations = async () => {
    if (!user) return;
    if (!isUuid(user.id)) {
      setConversations(readLocalConversations(user.id));
      return;
    }
    const { data: convos } = await supabase
      .from("conversations").select("*")
      .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
      .order("updated_at", { ascending: false });
    if (!convos) return;

    const enriched = await Promise.all(convos.map(async (c) => {
      const otherId = c.user1_id === user.id ? c.user2_id : c.user1_id;
      const { data: profile } = await supabase.from("profiles").select("user_id, username, avatar_url, last_seen, is_verified").eq("user_id", otherId).maybeSingle();
      const { data: lastMsg } = await supabase.from("messages").select("content, read, sender_id").eq("conversation_id", c.id).order("created_at", { ascending: false }).limit(1).single();
      const { count } = await supabase.from("messages").select("*", { count: "exact", head: true }).eq("conversation_id", c.id).eq("read", false).neq("sender_id", user.id);
      return {
        id: c.id, user1_id: c.user1_id, user2_id: c.user2_id,
        other_user: profile || { user_id: otherId, username: "User", avatar_url: "", last_seen: null, is_verified: false },
        last_message: lastMsg?.content, last_message_read: lastMsg?.read, last_message_sender: lastMsg?.sender_id,
        unread_count: count || 0, updated_at: c.updated_at,
      };
    }));
    const local = readLocalConversations(user.id);
    setConversations(
      [...local, ...enriched.filter((c) => !local.some((l) => l.id === c.id))]
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    );
  };

  const loadMessages = async (convoId: string) => {
    if (!isUuid(convoId)) return;
    const { data } = await supabase.from("messages").select("*").eq("conversation_id", convoId).order("created_at", { ascending: true });
    setMessages(mergeRemoteAndLocal(convoId, (data as Message[]) || []));
  };

  const markMessagesRead = async (convoId: string) => {
    if (!user || !isUuid(convoId)) return;
    await supabase.from("messages").update({ read: true } as any).eq("conversation_id", convoId).neq("sender_id", user.id).eq("read", false);
  };

  const deleteMessage = async (id: string) => {
    if (!confirm("Delete this message?")) return;
    setMessages((prev) => prev.filter((m) => m.id !== id));
    if (id.startsWith("local-") && activeConvo) {
      writeLocalMessages(activeConvo.id, readLocalMessages(activeConvo.id).filter((m) => m.id !== id));
      await logCloudAction(user, "message_delete", { message_id: id, conversation_id: activeConvo.id, local_fallback: true }).catch(() => {});
      return;
    }
    const { error } = await supabase.from("messages").delete().eq("id", id);
    if (error) { toast.error(error.message); loadMessages(activeConvo!.id); }
    else if (user && activeConvo) await logCloudAction(user, "message_delete", { message_id: id, conversation_id: activeConvo.id }).catch(() => {});
  };

  const sendTypingIndicator = useCallback(async () => {
    if (!activeConvo || !user) return;
    const isUser1 = activeConvo.user1_id === user.id;
    const col = isUser1 ? "user1_typing_at" : "user2_typing_at";
    await supabase.from("conversations").update({ [col]: new Date().toISOString() } as any).eq("id", activeConvo.id);
  }, [activeConvo, user]);

  const handleInputChange = (value: string) => {
    setNewMessage(value);
    sendTypingIndicator();
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(async () => {
      if (!activeConvo || !user) return;
      const isUser1 = activeConvo.user1_id === user.id;
      const col = isUser1 ? "user1_typing_at" : "user2_typing_at";
      await supabase.from("conversations").update({ [col]: null } as any).eq("id", activeConvo.id);
    }, 3000);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { setImageFile(file); setImagePreview(URL.createObjectURL(file)); }
  };

  const sendMessage = async () => {
    if ((!newMessage.trim() && !imageFile && !attachFile) || !activeConvo || !user) return;

    const draft = newMessage.trim();
    const hasUpload = !!(imageFile || attachFile);
    setUploading(hasUpload);

    if (isFirebaseRoom(activeConvo.id)) {
      if (hasUpload) {
        toast.error("File messages need Supabase chat setup first. Text chat is ready.");
        setUploading(false);
        return;
      }
      const localMessage: Message = {
        id: `local-${Date.now()}`,
        sender_id: user.id,
        content: draft,
        image_url: null,
        read: false,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => sortMessages([...prev, localMessage]));
      rememberLocalConversation(user.id, activeConvo, localMessage);
      setNewMessage("");
      try {
        await chatService.sendMessage(activeConvo.id, {
          senderId: user.id,
          senderName: user.displayName || user.email || "User",
          text: draft,
          type: "text",
        });
        await logCloudAction(user, "message_send", { conversation_id: activeConvo.id, type: "text", firebase_room: true }).catch(() => {});
      } catch {
        persistLocalMessage(activeConvo.id, localMessage);
        await logCloudAction(user, "message_send", { conversation_id: activeConvo.id, type: "text", local_fallback: true }).catch(() => {});
        toast.info("Message saved here. Chat sync permission is blocked.");
      }
      setUploading(false);
      return;
    }

    // Optimistic insert: text-only messages appear instantly.
    if (!hasUpload && draft) {
      const tempId = `temp-${Date.now()}`;
      setMessages((prev) => [...prev, {
        id: tempId, sender_id: user.id, content: draft, image_url: null, read: false,
        created_at: new Date().toISOString(),
      }]);
      setNewMessage("");
      const { data, error } = await supabase.from("messages").insert({
        conversation_id: activeConvo.id, sender_id: user.id, content: draft, image_url: null,
      } as any).select().single();
      if (error) {
        const localMessage: Message = {
          id: `local-${Date.now()}`,
          sender_id: user.id,
          content: draft,
          image_url: null,
          read: false,
          created_at: new Date().toISOString(),
        };
        persistLocalMessage(activeConvo.id, localMessage);
        rememberLocalConversation(user.id, activeConvo, localMessage);
        setMessages((prev) => prev.map((m) => m.id === tempId ? localMessage : m));
        await logCloudAction(user, "message_send", { conversation_id: activeConvo.id, type: "text", local_fallback: true }).catch(() => {});
        toast.info("Message saved here. Chat database permission is blocked.");
        return;
      }
      setMessages((prev) => prev.map((m) => m.id === tempId ? (data as Message) : m));
      await logCloudAction(user, "message_send", { conversation_id: activeConvo.id, type: "text" }).catch(() => {});
      // Clear typing
      const isUser1 = activeConvo.user1_id === user.id;
      const col = isUser1 ? "user1_typing_at" : "user2_typing_at";
      supabase.from("conversations").update({ [col]: null } as any).eq("id", activeConvo.id);
      return;
    }

    let imageUrl: string | null = null;
    let fileMessage = "";
    try {
      if (imageFile) {
        const ext = imageFile.name.split(".").pop();
        const path = `${user.id}/${Date.now()}.${ext}`;
        const { error } = await supabase.storage.from("chat-images").upload(path, imageFile);
        if (error) throw new Error("Image upload failed");
        imageUrl = supabase.storage.from("chat-images").getPublicUrl(path).data.publicUrl;
      }
      if (attachFile) {
        const safeName = attachFile.name.replace(/[^\w.\-]/g, "_");
        const path = `${user.id}/${Date.now()}-${safeName}`;
        const { error } = await supabase.storage.from("chat-images").upload(path, attachFile);
        if (error) throw new Error("File upload failed");
        const url = supabase.storage.from("chat-images").getPublicUrl(path).data.publicUrl;
        fileMessage = `📎 ${attachFile.name} ${url}`;
      }
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
      setUploading(false);
      return;
    }

    const content = [draft, fileMessage].filter(Boolean).join("\n").trim()
      || (imageUrl ? "📷 Photo" : "");

    const { error: insertErr } = await supabase.from("messages").insert({
      conversation_id: activeConvo.id,
      sender_id: user.id,
      content,
      image_url: imageUrl,
    } as any);
    if (insertErr) {
      const localMessage: Message = {
        id: `local-${Date.now()}`,
        sender_id: user.id,
        content,
        image_url: imageUrl,
        read: false,
        created_at: new Date().toISOString(),
      };
      persistLocalMessage(activeConvo.id, localMessage);
      rememberLocalConversation(user.id, activeConvo, localMessage);
      setMessages((prev) => sortMessages([...prev, localMessage]));
      await logCloudAction(user, "message_send", { conversation_id: activeConvo.id, type: imageUrl ? "image" : attachFile ? "file" : "text", local_fallback: true }).catch(() => {});
      toast.info("Message saved here. Chat database permission is blocked.");
      setNewMessage("");
      setImageFile(null);
      setImagePreview(null);
      setAttachFile(null);
      setUploading(false);
      return;
    }

    setNewMessage("");
    setImageFile(null);
    setImagePreview(null);
    setAttachFile(null);
    setUploading(false);
    await logCloudAction(user, "message_send", { conversation_id: activeConvo.id, type: imageUrl ? "image" : attachFile ? "file" : "text" }).catch(() => {});

    const isUser1 = activeConvo.user1_id === user.id;
    const col = isUser1 ? "user1_typing_at" : "user2_typing_at";
    await supabase.from("conversations").update({ [col]: null } as any).eq("id", activeConvo.id);
  };

  const searchForUsers = async (query: string) => {
    setSearchUsers(query);
    if (!user || query.length < 2) { setSearchResults([]); return; }
    setSearchResults(await searchUsersEverywhere(query, user.id, 10));
  };

  const startConversation = async (otherUserId: string) => {
    if (!user || otherUserId === user.id) return;
    const other = searchResults.find((r) => r.user_id === otherUserId);
    if (!isUuid(user.id) || !isUuid(otherUserId)) {
      setActiveConvo({
        id: firebaseRoomId(user.id, otherUserId),
        user1_id: user.id,
        user2_id: otherUserId,
        other_user: other || { user_id: otherUserId, username: "User", avatar_url: "", last_seen: null, is_verified: false },
        updated_at: new Date().toISOString(),
        unread_count: 0,
      });
      setSearchUsers("");
      setSearchResults([]);
      return;
    }
    const [u1, u2] = user.id < otherUserId ? [user.id, otherUserId] : [otherUserId, user.id];
    const { data: existing, error: existingError } = await supabase.from("conversations").select("*").eq("user1_id", u1).eq("user2_id", u2).maybeSingle();
    if (existingError) {
      toast.error(existingError.message);
      return;
    }
    if (existing) {
      setActiveConvo({ id: existing.id, user1_id: existing.user1_id, user2_id: existing.user2_id, other_user: other, updated_at: existing.updated_at, unread_count: 0 });
    } else {
      const { data: newConvo, error: createError } = await supabase.from("conversations").insert({ user1_id: u1, user2_id: u2 }).select().single();
      if (createError) {
        toast.error(createError.message);
        return;
      }
      if (newConvo) setActiveConvo({ id: newConvo.id, user1_id: newConvo.user1_id, user2_id: newConvo.user2_id, other_user: other, updated_at: newConvo.updated_at, unread_count: 0 });
    }
    setSearchUsers(""); setSearchResults([]);
  };

  const formatTime = (d: string) => {
    const date = new Date(d);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const formatLastSeen = (d: string) => {
    const diff = Date.now() - new Date(d).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const days = Math.floor(h / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(d).toLocaleDateString();
  };

  const chatBgClass = chatBg === "rose"
    ? "bg-rose-50 dark:bg-rose-950/30"
    : chatBg === "green"
      ? "bg-emerald-50 dark:bg-emerald-950/30"
      : chatBg === "blue"
        ? "bg-sky-50 dark:bg-sky-950/30"
        : "bg-secondary/40 dark:bg-background";

  // Chat view (WhatsApp-like)
  if (activeConvo) {
    return (
      <div className="fixed inset-0 z-40 flex flex-col bg-background text-foreground" style={{ height: "100dvh", maxHeight: "100dvh" }}>
        <header className="flex items-center gap-2 border-b border-border bg-background/95 px-2 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] shadow-sm backdrop-blur shrink-0">
          <button onClick={() => { setActiveConvo(null); loadConversations(); }} aria-label="Back" className="p-1.5 rounded-full hover:bg-secondary">
            <ArrowLeft className="h-6 w-6" />
          </button>
          <div className="relative shrink-0">
            <img src={profileAvatar(activeConvo.other_user.avatar_url, activeConvo.other_user.user_id, activeConvo.other_user.username)} alt="" className="h-10 w-10 rounded-full object-cover" />
            {isOnline(otherProfile?.last_seen) && (
              <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-background" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <span className="font-semibold text-sm inline-flex items-center gap-1 truncate">
              {activeConvo.other_user.username}
              <VerifiedBadge verified={otherProfile?.is_verified || activeConvo.other_user.is_verified} />
            </span>
            {otherTyping
              ? <p className="text-xs opacity-90 animate-pulse">typing…</p>
              : <p className="text-[11px] opacity-80">{
                  isOnline(otherProfile?.last_seen)
                    ? "online"
                    : otherProfile?.last_seen
                      ? `last seen ${formatLastSeen(otherProfile.last_seen)}`
                      : "offline"
                }</p>}
          </div>
          <button onClick={() => startCall("video")} aria-label="Video call" className="flex h-10 w-10 items-center justify-center rounded-full text-primary hover:bg-secondary">
            <VideoIcon className="h-5 w-5" />
          </button>
          <button onClick={() => setShowBgPicker((v) => !v)} aria-label="Chat background" className="flex h-10 w-10 items-center justify-center rounded-full text-primary hover:bg-secondary">
            <Palette className="h-5 w-5" />
          </button>
          <button onClick={() => startCall("audio")} aria-label="Voice call" className="flex h-10 w-10 items-center justify-center rounded-full text-primary hover:bg-secondary">
            <Phone className="h-5 w-5" />
          </button>
        </header>
        {showBgPicker && (
          <div className="flex items-center gap-2 border-b border-border bg-background px-4 py-2">
            {[
              { id: "default", label: "Default", cls: "bg-secondary" },
              { id: "rose", label: "Rose", cls: "bg-rose-300" },
              { id: "green", label: "Green", cls: "bg-emerald-300" },
              { id: "blue", label: "Blue", cls: "bg-sky-300" },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => { setChatBg(item.id); localStorage.setItem("wargram-chat-bg", item.id); if (user) logCloudAction(user, "chat_background_update", { background: item.id }).catch(() => {}); setShowBgPicker(false); }}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${chatBg === item.id ? "border-primary text-primary" : "border-border text-foreground"}`}
              >
                <span className={`h-3 w-3 rounded-full ${item.cls}`} /> {item.label}
              </button>
            ))}
          </div>
        )}

        <div className={`flex-1 overflow-y-auto px-3 py-3 ${chatBgClass}`}>
          {messages.map((msg) => {
            const isMine = msg.sender_id === user?.id;
            const msgReactions = reactions.filter((r) => r.message_id === msg.id);
            const grouped = msgReactions.reduce<Record<string, number>>((acc, r) => { acc[r.emoji] = (acc[r.emoji] || 0) + 1; return acc; }, {});
            const showDelete = isMine && !msg.id.startsWith("temp-");
            return (
              <div key={msg.id} className={`mb-2 flex ${isMine ? "justify-end" : "justify-start"}`}>
                <div className="max-w-[78%] group relative">
                  <div className={`shadow-sm ${
                    isMine
                      ? "bg-primary text-primary-foreground rounded-2xl rounded-br-sm"
                      : "bg-card text-card-foreground border border-border rounded-2xl rounded-bl-sm"
                  } px-3 pt-2 pb-1.5`}>
                    {msg.image_url && (
                      <img src={msg.image_url} alt="" className="mb-1 max-h-72 w-full rounded-xl object-cover" />
                    )}
                    {msg.content && msg.content !== "📷 Photo" && (
                      <div className="text-sm whitespace-pre-wrap break-words">
                        {linkify(msg.content)}
                      </div>
                    )}
                    <div className="mt-1 flex items-center justify-end gap-1">
                      <span className="text-[10px] opacity-60">{formatTime(msg.created_at)}</span>
                      {isMine && (
                        msg.read
                          ? <CheckCheck className="h-3.5 w-3.5 text-primary-foreground/80" />
                          : <Check className="h-3.5 w-3.5 opacity-60" />
                      )}
                    </div>
                  </div>

                  {/* Action row — always visible on touch, hover on desktop */}
                  <div className={`mt-1 flex items-center gap-3 ${isMine ? "justify-end" : "justify-start"} opacity-90 md:opacity-0 md:group-hover:opacity-100 transition-opacity`}>
                    <button
                      onClick={() => setPickerForMsg(pickerForMsg === msg.id ? null : msg.id)}
                      className="text-[11px] inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                      aria-label="Add reaction"
                    >
                      <SmilePlus className="h-3.5 w-3.5" /> React
                    </button>
                    {showDelete && (
                      <button
                        onClick={() => deleteMessage(msg.id)}
                        className="text-[11px] inline-flex items-center gap-1 text-destructive hover:underline"
                        aria-label="Delete message"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                      </button>
                    )}
                  </div>

                  {pickerForMsg === msg.id && (
                    <div className={`absolute top-full mt-1 ${isMine ? "right-0" : "left-0"} z-30 flex gap-1 rounded-full bg-popover border border-border p-1 shadow-lg`}>
                      {REACTION_EMOJIS.map((e) => (
                        <button key={e} onClick={() => toggleReaction(msg.id, e)} className="hover:scale-125 transition-transform text-lg">{e}</button>
                      ))}
                    </div>
                  )}
                  {Object.keys(grouped).length > 0 && (
                    <div className={`mt-1 flex flex-wrap gap-1 ${isMine ? "justify-end" : "justify-start"}`}>
                      {Object.entries(grouped).map(([emoji, count]) => {
                        const mine = msgReactions.some((r) => r.emoji === emoji && r.user_id === user?.id);
                        return (
                          <button key={emoji} onClick={() => toggleReaction(msg.id, emoji)}
                            className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${mine ? "bg-primary/20 border border-primary" : "bg-secondary border border-transparent"}`}>
                            <span>{emoji}</span>{count > 1 && <span className="text-[10px] text-muted-foreground">{count}</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {otherTyping && (
            <div className="mb-3 flex justify-start">
              <div className="rounded-2xl rounded-bl-sm bg-card border border-border px-4 py-3 flex gap-1 shadow-sm">
                <span className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Attachment previews */}
        {(imagePreview || attachFile) && (
          <div className="border-t border-border bg-background px-4 py-2 flex items-center gap-2 flex-wrap">
            {imagePreview && (
              <div className="relative inline-block">
                <img src={imagePreview} alt="" className="h-20 rounded-lg object-cover" />
                <button onClick={() => { setImageFile(null); setImagePreview(null); }} className="absolute -right-2 -top-2 rounded-full bg-destructive p-1">
                  <X className="h-3 w-3 text-destructive-foreground" />
                </button>
              </div>
            )}
            {attachFile && (
              <div className="relative inline-flex items-center gap-2 rounded-lg bg-secondary px-3 py-2 max-w-full">
                <FileText className="h-5 w-5 text-primary shrink-0" />
                <span className="text-xs text-foreground truncate max-w-[200px]">{attachFile.name}</span>
                <button onClick={() => setAttachFile(null)} className="absolute -right-2 -top-2 rounded-full bg-destructive p-1">
                  <X className="h-3 w-3 text-destructive-foreground" />
                </button>
              </div>
            )}
          </div>
        )}

        <div className="border-t border-border bg-background px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shrink-0">
          <div className="mx-auto flex max-w-lg items-center gap-2">
            <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageSelect} className="hidden" />
            <input type="file" ref={attachInputRef} onChange={(e) => { const f = e.target.files?.[0]; if (f) setAttachFile(f); }} className="hidden" />
            <button onClick={() => fileInputRef.current?.click()} aria-label="Send photo" className="text-muted-foreground hover:text-foreground shrink-0">
              <Image className="h-6 w-6" />
            </button>
            <button onClick={() => attachInputRef.current?.click()} aria-label="Attach file" className="text-muted-foreground hover:text-foreground shrink-0">
              <Paperclip className="h-6 w-6" />
            </button>
            <input
              type="text" placeholder="Message..." value={newMessage}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              className="flex-1 min-w-0 rounded-full border border-border bg-secondary px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none"
            />
            <button onClick={sendMessage} disabled={(!newMessage.trim() && !imageFile && !attachFile) || uploading} className="text-primary disabled:opacity-30 shrink-0" aria-label="Send">
              <Send className="h-6 w-6" />
            </button>
          </div>
        </div>

        {callMode && (
          <CallModal
            selfId={user!.id}
            peerId={activeConvo.other_user.user_id}
            peerName={activeConvo.other_user.username}
            peerAvatar={profileAvatar(activeConvo.other_user.avatar_url, activeConvo.other_user.user_id, activeConvo.other_user.username)}
            conversationId={activeConvo.id}
            mode={callMode}
            initiator={callInitiator}
            onClose={() => setCallMode(null)}
          />
        )}

        {incomingCall && !callMode && (
          <div className="fixed inset-0 z-[180] flex items-center justify-center bg-black/80">
            <div className="rounded-2xl bg-background p-6 max-w-sm w-[90%] text-center space-y-4">
              <img src={profileAvatar((incomingCall.peer || activeConvo.other_user).avatar_url, incomingCall.from, (incomingCall.peer || activeConvo.other_user).username)} alt="" className="mx-auto h-20 w-20 rounded-full object-cover" />
              <div>
                <p className="font-semibold text-foreground">{(incomingCall.peer || activeConvo.other_user).username}</p>
                <p className="text-sm text-muted-foreground">Incoming {incomingCall.mode} call…</p>
              </div>
              <div className="flex justify-center gap-4">
                <button onClick={rejectIncomingCall} className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500 text-white">
                  <X className="h-6 w-6" />
                </button>
                <button
                  onClick={acceptIncomingCall}
                  className="flex h-14 w-14 items-center justify-center rounded-full bg-green-500 text-white"
                >
                  <Phone className="h-6 w-6" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Inbox view
  return (
    <div className="min-h-screen bg-background pb-16">
      <header className="sticky top-0 z-50 flex items-center justify-between border-b border-border bg-background/95 backdrop-blur-lg px-4 py-3">
        <button onClick={() => navigate("/")}><ArrowLeft className="h-6 w-6 text-foreground" /></button>
        <h1 className="text-lg font-bold text-foreground">Messages</h1>
        <div className="w-6" />
      </header>

      <div className="px-4 py-3">
        <input type="text" placeholder="Search users..." value={searchUsers} onChange={(e) => searchForUsers(e.target.value)}
          className="w-full rounded-lg bg-secondary px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none" />
      </div>

      {searchResults.length > 0 && (
        <div className="border-b border-border px-4 pb-3">
          {searchResults.map((u) => (
            <button key={u.user_id} onClick={() => startConversation(u.user_id)} className="flex w-full items-center gap-3 rounded-lg p-2 transition-colors hover:bg-secondary">
              <img src={profileAvatar(u.avatar_url, u.user_id, u.username)} alt="" className="h-10 w-10 rounded-full object-cover" />
              <span className="text-sm font-semibold text-foreground inline-flex items-center gap-1">
                {u.username}
                <VerifiedBadge verified={u.is_verified} />
              </span>
            </button>
          ))}
        </div>
      )}

      <div>
        {conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <img src={wargramLogo} alt="" className="mb-4 h-16 w-16 opacity-30" />
            <p className="text-sm">No messages yet</p>
            <p className="text-xs">Search for users to start chatting</p>
          </div>
        ) : (
          conversations.map((convo) => (
            <button
              key={convo.id}
              onClick={() => {
                // Optimistically clear the inbox badge as soon as the user opens the chat
                setConversations((prev) => prev.map((c) => c.id === convo.id ? { ...c, unread_count: 0, last_message_read: true } : c));
                setActiveConvo({ ...convo, unread_count: 0 });
              }}
              className="flex w-full items-center gap-3 px-4 py-3 transition-colors hover:bg-secondary/50"
            >
              <div className="relative">
                <img src={profileAvatar(convo.other_user.avatar_url, convo.other_user.user_id, convo.other_user.username)} alt="" className="h-14 w-14 rounded-full object-cover" />
                {isOnline(convo.other_user.last_seen) && (
                  <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-green-500 ring-2 ring-background" />
                )}
                {convo.unread_count > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">{convo.unread_count}</span>
                )}
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className={`text-sm ${convo.unread_count > 0 ? "font-bold" : "font-semibold"} text-foreground inline-flex items-center gap-1`}>
                  {convo.other_user.username}
                  <VerifiedBadge verified={convo.other_user.is_verified} />
                </p>
                {convo.last_message && (
                  <div className="flex items-center gap-1 mt-0.5">
                    {convo.last_message_sender === user?.id && (
                      convo.last_message_read
                        ? <CheckCheck className="h-3 w-3 text-primary shrink-0" />
                        : <Check className="h-3 w-3 text-muted-foreground shrink-0" />
                    )}
                    <p className={`truncate text-xs ${convo.unread_count > 0 ? "text-foreground font-medium" : "text-muted-foreground"}`}>{convo.last_message}</p>
                  </div>
                )}
              </div>
              {convo.unread_count > 0 && (
                <span className="ml-2 inline-flex min-w-[22px] h-[22px] px-1.5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground shrink-0">
                  {convo.unread_count > 99 ? "99+" : convo.unread_count}
                </span>
              )}
            </button>
          ))
        )}
      </div>
      {incomingCall && !callMode && (
        <div className="fixed inset-0 z-[180] flex items-center justify-center bg-black/80">
          <div className="rounded-2xl bg-background p-6 max-w-sm w-[90%] text-center space-y-4">
            <img src={profileAvatar(incomingCall.peer?.avatar_url, incomingCall.from, incomingCall.peer?.username)} alt="" className="mx-auto h-20 w-20 rounded-full object-cover" />
            <div>
              <p className="font-semibold text-foreground">{incomingCall.peer?.username || "Incoming call"}</p>
              <p className="text-sm text-muted-foreground">Incoming {incomingCall.mode} call...</p>
            </div>
            <div className="flex justify-center gap-4">
              <button onClick={rejectIncomingCall} className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500 text-white">
                <X className="h-6 w-6" />
              </button>
              <button onClick={acceptIncomingCall} className="flex h-14 w-14 items-center justify-center rounded-full bg-green-500 text-white">
                <Phone className="h-6 w-6" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Messages;
