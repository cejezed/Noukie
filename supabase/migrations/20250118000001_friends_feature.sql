-- =====================================================
-- FRIENDS + INVITE SYSTEM MIGRATION
-- =====================================================
-- This migration adds a secure invite-code-based friends system
-- to enable compliments between users who are not in the same classroom.
--
-- Features:
-- - Invite codes for safe friend connections
-- - Symmetric friendships (no pending states)
-- - RLS policies for privacy
-- - Integration with existing compliments feature
-- =====================================================

-- =====================================================
-- 1. FRIEND INVITE CODES TABLE
-- =====================================================
-- Each user can have one unique invite code that they can share
-- with friends to create connections outside the classroom.

CREATE TABLE IF NOT EXISTS public.friend_invite_codes (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  code text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Index for fast code lookups during redemption
CREATE INDEX idx_friend_invite_codes_code ON public.friend_invite_codes(code);

-- =====================================================
-- 2. FRIENDSHIPS TABLE
-- =====================================================
-- Stores symmetric friendships between two users.
-- user_a and user_b are stored in lexicographic order to ensure uniqueness.

CREATE TABLE IF NOT EXISTS public.friendships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  user_b uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),

  -- Ensure user_a < user_b for symmetric relationship
  CONSTRAINT user_order_check CHECK (user_a < user_b),

  -- Ensure each friendship is unique
  CONSTRAINT unique_friendship UNIQUE(user_a, user_b)
);

-- Indexes for fast friend lookups
CREATE INDEX idx_friendships_user_a ON public.friendships(user_a);
CREATE INDEX idx_friendships_user_b ON public.friendships(user_b);

-- =====================================================
-- 3. ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on both tables
ALTER TABLE public.friend_invite_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 3.1 Invite Codes Policies
-- =====================================================

-- Policy: Users can only see their own invite code
CREATE POLICY "user_can_view_own_invite_code"
  ON public.friend_invite_codes
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Policy: Disable client-side inserts for security
-- (Inserts will be done via RPC or backend service-role)
CREATE POLICY "disable_client_invite_code_insert"
  ON public.friend_invite_codes
  FOR INSERT
  TO authenticated
  WITH CHECK (false);

-- Policy: Disable client-side updates
CREATE POLICY "disable_client_invite_code_update"
  ON public.friend_invite_codes
  FOR UPDATE
  TO authenticated
  USING (false);

-- Policy: Disable client-side deletes
CREATE POLICY "disable_client_invite_code_delete"
  ON public.friend_invite_codes
  FOR DELETE
  TO authenticated
  USING (false);

-- =====================================================
-- 3.2 Friendships Policies
-- =====================================================

-- Policy: Users can see friendships they are part of
CREATE POLICY "user_can_view_own_friendships"
  ON public.friendships
  FOR SELECT
  TO authenticated
  USING (
    user_a = auth.uid() OR user_b = auth.uid()
  );

-- Policy: Disable client-side inserts for security
-- (Inserts will be done via RPC or backend service-role)
CREATE POLICY "disable_client_friendship_insert"
  ON public.friendships
  FOR INSERT
  TO authenticated
  WITH CHECK (false);

-- Policy: Disable client-side updates
CREATE POLICY "disable_client_friendship_update"
  ON public.friendships
  FOR UPDATE
  TO authenticated
  USING (false);

-- Policy: Allow users to delete their own friendships
CREATE POLICY "user_can_delete_own_friendships"
  ON public.friendships
  FOR DELETE
  TO authenticated
  USING (
    user_a = auth.uid() OR user_b = auth.uid()
  );

-- =====================================================
-- 4. DATABASE FUNCTIONS
-- =====================================================

-- =====================================================
-- 4.1 Generate Invite Code
-- =====================================================
-- Generates a random invite code in format: XXXX-XXXX-XXXX
-- Uses uppercase alphanumeric characters (excluding ambiguous: 0, O, I, 1)

CREATE OR REPLACE FUNCTION public.generate_invite_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- No 0, O, I, 1
  result text := '';
  i integer;
BEGIN
  -- Generate 3 blocks of 4 characters each
  FOR block IN 1..3 LOOP
    FOR i IN 1..4 LOOP
      result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;

    -- Add hyphen between blocks (but not after last block)
    IF block < 3 THEN
      result := result || '-';
    END IF;
  END LOOP;

  RETURN result;
END;
$$;

-- =====================================================
-- 4.2 Get or Create Invite Code for User
-- =====================================================
-- Returns existing invite code or creates a new one
-- SECURITY DEFINER: Runs with owner privileges to bypass RLS

CREATE OR REPLACE FUNCTION public.get_or_create_invite_code(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  existing_code text;
  new_code text;
  max_attempts integer := 10;
  attempt integer := 0;
BEGIN
  -- Check if user exists
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Try to get existing code
  SELECT code INTO existing_code
  FROM public.friend_invite_codes
  WHERE user_id = p_user_id;

  IF existing_code IS NOT NULL THEN
    RETURN existing_code;
  END IF;

  -- Generate new unique code with retry logic
  LOOP
    new_code := generate_invite_code();
    attempt := attempt + 1;

    BEGIN
      INSERT INTO public.friend_invite_codes (user_id, code)
      VALUES (p_user_id, new_code);

      RETURN new_code;
    EXCEPTION
      WHEN unique_violation THEN
        -- Code already exists, try again
        IF attempt >= max_attempts THEN
          RAISE EXCEPTION 'Failed to generate unique invite code after % attempts', max_attempts;
        END IF;
        CONTINUE;
    END;
  END LOOP;
END;
$$;

-- =====================================================
-- 4.3 Redeem Invite Code (Create Friendship)
-- =====================================================
-- Validates and redeems an invite code to create a friendship
-- SECURITY DEFINER: Runs with owner privileges to bypass RLS

CREATE OR REPLACE FUNCTION public.redeem_invite_code(
  p_redeemer_id uuid,
  p_code text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  code_owner_id uuid;
  friendship_user_a uuid;
  friendship_user_b uuid;
  friendship_id uuid;
BEGIN
  -- Validate inputs
  IF p_redeemer_id IS NULL OR p_code IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid input: user_id and code are required'
    );
  END IF;

  -- Normalize code (uppercase, trim)
  p_code := upper(trim(p_code));

  -- Find the owner of the invite code
  SELECT user_id INTO code_owner_id
  FROM public.friend_invite_codes
  WHERE code = p_code;

  -- Check if code exists
  IF code_owner_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Ongeldige uitnodigingscode'
    );
  END IF;

  -- Check if user is trying to add themselves
  IF code_owner_id = p_redeemer_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Je kunt jezelf niet als vriend toevoegen'
    );
  END IF;

  -- Determine user_a and user_b (lexicographic order)
  IF p_redeemer_id < code_owner_id THEN
    friendship_user_a := p_redeemer_id;
    friendship_user_b := code_owner_id;
  ELSE
    friendship_user_a := code_owner_id;
    friendship_user_b := p_redeemer_id;
  END IF;

  -- Check if friendship already exists
  IF EXISTS (
    SELECT 1 FROM public.friendships
    WHERE user_a = friendship_user_a
    AND user_b = friendship_user_b
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Je bent al bevriend met deze gebruiker'
    );
  END IF;

  -- Create the friendship
  INSERT INTO public.friendships (user_a, user_b)
  VALUES (friendship_user_a, friendship_user_b)
  RETURNING id INTO friendship_id;

  RETURN jsonb_build_object(
    'success', true,
    'friendship_id', friendship_id,
    'message', 'Vriendschap succesvol aangemaakt!'
  );
END;
$$;

-- =====================================================
-- 4.4 Get User's Friends List
-- =====================================================
-- Returns a list of friends for a given user with basic profile info
-- SECURITY DEFINER: Runs with owner privileges to bypass RLS

CREATE OR REPLACE FUNCTION public.get_user_friends(p_user_id uuid)
RETURNS TABLE (
  id uuid,
  name text,
  email text,
  avatar_url text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id,
    u.name,
    u.email,
    u.avatar_url
  FROM public.users u
  INNER JOIN public.friendships f ON (
    (f.user_a = p_user_id AND f.user_b = u.id) OR
    (f.user_b = p_user_id AND f.user_a = u.id)
  )
  WHERE u.id != p_user_id
  ORDER BY u.name ASC;
END;
$$;

-- =====================================================
-- 4.5 Check if Two Users are Friends
-- =====================================================
-- Utility function to check friendship status

CREATE OR REPLACE FUNCTION public.are_users_friends(
  p_user_id_1 uuid,
  p_user_id_2 uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_a uuid;
  user_b uuid;
BEGIN
  -- Determine lexicographic order
  IF p_user_id_1 < p_user_id_2 THEN
    user_a := p_user_id_1;
    user_b := p_user_id_2;
  ELSE
    user_a := p_user_id_2;
    user_b := p_user_id_1;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.friendships
    WHERE user_a = user_a
    AND user_b = user_b
  );
END;
$$;

-- =====================================================
-- 5. UPDATE COMPLIMENTS TABLE FOR FRIENDS
-- =====================================================
-- Add nullable classroom_id to allow compliments between friends
-- who may not share a classroom

-- Make classroom_id nullable (if not already)
ALTER TABLE public.compliments
ALTER COLUMN classroom_id DROP NOT NULL;

-- Add index for friend-based compliment queries
CREATE INDEX IF NOT EXISTS idx_compliments_from_to ON public.compliments(from_user, to_user);

-- =====================================================
-- 6. UPDATE COMPLIMENTS RLS POLICIES FOR FRIENDS
-- =====================================================

-- Drop existing INSERT policy if it exists
DROP POLICY IF EXISTS "Students can send compliments in their classroom" ON public.compliments;

-- New policy: Students can send compliments to classmates OR friends
CREATE POLICY "Students can send compliments to classmates or friends"
  ON public.compliments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Same classroom
    (
      classroom_id IS NOT NULL AND
      EXISTS (
        SELECT 1 FROM public.users
        WHERE users.id = auth.uid()
        AND users.classroom_id = compliments.classroom_id
      )
    )
    OR
    -- Friends (no classroom required)
    (
      classroom_id IS NULL AND
      public.are_users_friends(auth.uid(), to_user)
    )
  );

-- =====================================================
-- 7. GRANT EXECUTE PERMISSIONS ON FUNCTIONS
-- =====================================================

GRANT EXECUTE ON FUNCTION public.generate_invite_code() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_or_create_invite_code(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_invite_code(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_friends(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.are_users_friends(uuid, uuid) TO authenticated;

-- =====================================================
-- 8. COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE public.friend_invite_codes IS 'Stores unique invite codes for each user to share with friends';
COMMENT ON TABLE public.friendships IS 'Stores symmetric friendships between users (user_a < user_b enforced)';
COMMENT ON FUNCTION public.get_or_create_invite_code(uuid) IS 'Returns existing invite code or generates a new one for the user';
COMMENT ON FUNCTION public.redeem_invite_code(uuid, text) IS 'Validates and redeems an invite code to create a friendship';
COMMENT ON FUNCTION public.get_user_friends(uuid) IS 'Returns a list of friends with basic profile information';
COMMENT ON FUNCTION public.are_users_friends(uuid, uuid) IS 'Checks if two users are friends';

-- =====================================================
-- END OF MIGRATION
-- =====================================================
