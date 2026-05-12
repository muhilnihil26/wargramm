# Data Migration from Supabase to Firebase

This guide will help you migrate your existing Supabase data to Firebase.

## Prerequisites

1. Ensure your Supabase project is still active and accessible
2. Firebase project is set up with Realtime Database enabled
3. All environment variables are configured in `.env`

## Important Notes

- **Users**: Since we can't access Supabase auth users directly, user data is migrated from the `profiles` table. Email addresses and verification status are not migrated.
- **Auth**: Users will need to re-register in Firebase Auth. The migration only moves profile data to the database.
- **Storage**: Media files (posts, avatars) need to be manually migrated from Supabase Storage to Firebase Storage.

## Running the Migration

1. Make sure your Supabase credentials are in `.env`:
   ```
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_key
   ```

2. Export data to JSON files (optional, for backup/review):
   ```bash
   npm run export
   ```
   This creates `supabase-export-*.json` files in the root directory.

3. Run the migration:
   ```bash
   npm run migrate
   ```
   ```bash
   npm run migrate
   ```

3. The script will migrate:
   - User profiles
   - Posts
   - Follows
   - Conversations
   - Messages
   - Likes
   - Comments
   - Notifications

## Manual Steps Required

### 1. Migrate Media Files
- Download all files from Supabase Storage buckets (`posts`, `avatars`)
- Upload them to Firebase Storage
- Update the URLs in the migrated posts and user profiles

### 2. User Authentication
- Users need to create new accounts in Firebase Auth
- You may need to implement a user matching system or ask users to re-register

### 3. Update App Code
- The app is already configured to use Firebase
- Test all features after migration

## Troubleshooting

- If you get permission errors, ensure your Supabase service key has the necessary permissions
- Check Firebase Realtime Database rules allow writes during migration
- Monitor the console output for any failed migrations