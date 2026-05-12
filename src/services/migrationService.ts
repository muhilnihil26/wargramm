import { supabase } from '../integrations/supabase/client';
import { database } from '../integrations/firebase/config';
import { ref, set, push } from 'firebase/database';

// Initialize Firebase (this should be done before calling migration functions)
import '../integrations/firebase/config';

async function migrateUsers() {
  console.log('Starting user migration...');

  // Get profiles from Supabase (since we can't access auth.users directly)
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('*');

  if (error) {
    console.error('Error fetching profiles:', error);
    return;
  }

  for (const profile of profiles) {
    const userData = {
      uid: profile.user_id,
      email: '', // We can't get email from profiles table
      emailVerified: false,
      displayName: profile.full_name || '',
      photoURL: profile.avatar_url || '',
      username: profile.username || '',
      bio: profile.bio || '',
      website: profile.website || '',
      createdAt: profile.created_at,
      updatedAt: profile.updated_at,
    };

    // Save to Firebase Realtime Database
    await set(ref(database, `users/${profile.user_id}`), userData);
    console.log(`Migrated user: ${profile.username || profile.user_id}`);
  }

  console.log('User migration completed');
}

async function migratePosts() {
  console.log('Starting posts migration...');

  const { data: posts, error } = await supabase
    .from('posts')
    .select('*');

  if (error) {
    console.error('Error fetching posts:', error);
    return;
  }

  for (const post of posts) {
    const postData = {
      id: post.id,
      userId: post.user_id,
      imageUrl: post.image_url,
      caption: post.caption || '',
      createdAt: post.created_at,
    };

    await set(ref(database, `posts/${post.id}`), postData);
    console.log(`Migrated post: ${post.id}`);
  }

  console.log('Posts migration completed');
}

async function migrateFollows() {
  console.log('Starting follows migration...');

  const { data: follows, error } = await supabase
    .from('follows')
    .select('*');

  if (error) {
    console.error('Error fetching follows:', error);
    return;
  }

  for (const follow of follows) {
    const followData = {
      id: follow.id,
      followerId: follow.follower_id,
      followingId: follow.following_id,
      createdAt: follow.created_at,
    };

    await set(ref(database, `follows/${follow.id}`), followData);
    console.log(`Migrated follow: ${follow.id}`);
  }

  console.log('Follows migration completed');
}

async function migrateConversations() {
  console.log('Starting conversations migration...');

  const { data: conversations, error } = await supabase
    .from('conversations')
    .select('*');

  if (error) {
    console.error('Error fetching conversations:', error);
    return;
  }

  for (const conversation of conversations) {
    const conversationData = {
      id: conversation.id,
      user1Id: conversation.user1_id,
      user2Id: conversation.user2_id,
      createdAt: conversation.created_at,
      updatedAt: conversation.updated_at,
    };

    await set(ref(database, `conversations/${conversation.id}`), conversationData);
    console.log(`Migrated conversation: ${conversation.id}`);
  }

  console.log('Conversations migration completed');
}

async function migrateMessages() {
  console.log('Starting messages migration...');

  const { data: messages, error } = await supabase
    .from('messages')
    .select('*');

  if (error) {
    console.error('Error fetching messages:', error);
    return;
  }

  for (const message of messages) {
    const messageData = {
      id: message.id,
      conversationId: message.conversation_id,
      senderId: message.sender_id,
      content: message.content,
      read: message.read,
      createdAt: message.created_at,
    };

    await set(ref(database, `messages/${message.id}`), messageData);
    console.log(`Migrated message: ${message.id}`);
  }

  console.log('Messages migration completed');
}

async function migrateLikes() {
  console.log('Starting likes migration...');

  const { data: likes, error } = await supabase
    .from('likes')
    .select('*');

  if (error) {
    console.error('Error fetching likes:', error);
    return;
  }

  for (const like of likes) {
    const likeData = {
      id: like.id,
      userId: like.user_id,
      postId: like.post_id,
      createdAt: like.created_at,
    };

    await set(ref(database, `likes/${like.id}`), likeData);
    console.log(`Migrated like: ${like.id}`);
  }

  console.log('Likes migration completed');
}

async function migrateComments() {
  console.log('Starting comments migration...');

  const { data: comments, error } = await supabase
    .from('comments')
    .select('*');

  if (error) {
    console.error('Error fetching comments:', error);
    return;
  }

  for (const comment of comments) {
    const commentData = {
      id: comment.id,
      userId: comment.user_id,
      postId: comment.post_id,
      content: comment.content,
      createdAt: comment.created_at,
    };

    await set(ref(database, `comments/${comment.id}`), commentData);
    console.log(`Migrated comment: ${comment.id}`);
  }

  console.log('Comments migration completed');
}

async function migrateNotifications() {
  console.log('Starting notifications migration...');

  const { data: notifications, error } = await supabase
    .from('notifications')
    .select('*');

  if (error) {
    console.error('Error fetching notifications:', error);
    return;
  }

  for (const notification of notifications) {
    const notificationData = {
      id: notification.id,
      userId: notification.user_id,
      actorId: notification.actor_id,
      type: notification.type,
      postId: notification.post_id,
      read: notification.read,
      createdAt: notification.created_at,
    };

    await set(ref(database, `notifications/${notification.id}`), notificationData);
    console.log(`Migrated notification: ${notification.id}`);
  }

  console.log('Notifications migration completed');
}

export async function migrateAllData() {
  try {
    console.log('Starting data migration from Supabase to Firebase...');

    await migrateUsers();
    await migratePosts();
    await migrateFollows();
    await migrateConversations();
    await migrateMessages();
    await migrateLikes();
    await migrateComments();
    await migrateNotifications();

    console.log('All data migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
  }
}