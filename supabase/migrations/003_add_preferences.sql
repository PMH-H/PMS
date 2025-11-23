-- Add preferences column to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{"shareBrowsing": true, "sharePurchaseHistory": true, "allowAI": true, "anonymousMode": false, "allowCamera": false}'::jsonb;

-- Comment
COMMENT ON COLUMN profiles.preferences IS 'User privacy and UI preferences (JSON)';
