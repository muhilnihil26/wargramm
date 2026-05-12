import { ref, push, onValue, off, update, remove, query, orderByChild, limitToLast } from 'firebase/database';
import { database } from '../integrations/firebase/config';

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
  type: 'text' | 'image' | 'video' | 'audio';
  mediaUrl?: string;
  isLocked?: boolean;
}

export interface ChatRoom {
  id: string;
  name: string;
  participants: string[];
  lastMessage?: ChatMessage;
  createdAt: number;
  isLocked?: boolean;
}

export class ChatService {
  private messagesRef = ref(database, 'messages');
  private roomsRef = ref(database, 'rooms');

  // Send a message
  async sendMessage(roomId: string, message: Omit<ChatMessage, 'id' | 'timestamp'>) {
    if (!roomId || roomId === 'undefined') {
      throw new Error('Chat room is not ready');
    }
    if (!message.senderId || message.senderId === 'undefined') {
      throw new Error('Sender is not ready');
    }
    const roomMessagesRef = ref(database, `messages/${roomId}`);
    const newMessageRef = push(roomMessagesRef);

    const messageData: ChatMessage = {
      senderId: message.senderId,
      senderName: message.senderName || 'User',
      text: message.text || '',
      type: message.type || 'text',
      ...(message.mediaUrl ? { mediaUrl: message.mediaUrl } : {}),
      ...(typeof message.isLocked === 'boolean' ? { isLocked: message.isLocked } : {}),
      id: newMessageRef.key!,
      timestamp: Date.now(),
    };

    await update(newMessageRef, messageData);

    // Update room's last message
    await update(ref(database, `rooms/${roomId}`), {
      lastMessage: messageData,
    });

    return messageData;
  }

  // Listen to messages in a room
  onMessages(roomId: string, callback: (messages: ChatMessage[]) => void) {
    const roomMessagesRef = ref(database, `messages/${roomId}`);
    const messagesQuery = query(roomMessagesRef, orderByChild('timestamp'), limitToLast(50));

    onValue(messagesQuery, (snapshot) => {
      const messages: ChatMessage[] = [];
      snapshot.forEach((childSnapshot) => {
        messages.push(childSnapshot.val());
      });
      callback(messages);
    });

    return () => off(messagesQuery);
  }

  // Create a new chat room
  async createRoom(room: Omit<ChatRoom, 'id' | 'createdAt'>) {
    const newRoomRef = push(this.roomsRef);
    const roomData: ChatRoom = {
      ...room,
      id: newRoomRef.key!,
      createdAt: Date.now(),
    };

    await update(newRoomRef, roomData);
    return roomData;
  }

  // Get user's rooms
  onUserRooms(userId: string, callback: (rooms: ChatRoom[]) => void) {
    const userRoomsRef = ref(database, `userRooms/${userId}`);

    onValue(userRoomsRef, (snapshot) => {
      const roomIds: string[] = [];
      snapshot.forEach((childSnapshot) => {
        roomIds.push(childSnapshot.key!);
      });

      // Get room details for each room ID
      const rooms: ChatRoom[] = [];
      roomIds.forEach((roomId) => {
        const roomRef = ref(database, `rooms/${roomId}`);
        onValue(roomRef, (roomSnapshot) => {
          if (roomSnapshot.exists()) {
            rooms.push(roomSnapshot.val());
            if (rooms.length === roomIds.length) {
              callback(rooms);
            }
          }
        }, { onlyOnce: true });
      });
    });

    return () => off(userRoomsRef);
  }

  // Add user to room
  async addUserToRoom(userId: string, roomId: string) {
    await update(ref(database, `userRooms/${userId}/${roomId}`), true);
    await update(ref(database, `rooms/${roomId}/participants`), {
      [userId]: true
    });
  }

  // Lock/unlock chat
  async setChatLock(roomId: string, isLocked: boolean) {
    await update(ref(database, `rooms/${roomId}`), { isLocked });
  }

  // Lock/unlock message
  async setMessageLock(roomId: string, messageId: string, isLocked: boolean) {
    await update(ref(database, `messages/${roomId}/${messageId}`), { isLocked });
  }

  // Delete message
  async deleteMessage(roomId: string, messageId: string) {
    await remove(ref(database, `messages/${roomId}/${messageId}`));
  }
}

export const chatService = new ChatService();
