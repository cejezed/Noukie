# Friends + Invite System - Integration Test Plan

## Overview
This document provides a comprehensive test plan for the newly implemented Friends + Invite System feature in Noukie. The feature allows users to connect with friends outside their classroom using invite codes and send compliments to each other.

## Security Features (Updated)

This implementation includes enterprise-grade security hardening:

### ✅ Rate Limiting
- **10 attempts per 15 minutes** on invite code redemption
- Per-user + per-IP rate limiting (combined key)
- Automatic 429 response with Dutch error message
- Rate limit info exposed in `RateLimit-*` headers

### ✅ Timing Attack Prevention
- **Constant-time error responses** (~200ms minimum)
- All failed redemption attempts take similar time
- Prevents attackers from determining:
  - Whether a code exists
  - Whether they're already friends
  - Whether they're trying to add themselves

### ✅ Information Leakage Prevention
- **Generic error messages** for all redemption failures
- Client receives: "De uitnodigingscode is ongeldig of kan niet worden gebruikt"
- Specific errors only logged server-side for debugging
- No hints about WHY the redemption failed

### ✅ Failed Attempt Logging
- All failed redemptions logged with:
  - User ID and email
  - IP address
  - Partial code (first 4 chars + `****`)
  - Failure reason (server-side only)
  - Timestamp
- Ready for integration with monitoring services (Sentry, DataDog, etc.)
- Security alerts for rate limit violations

### ✅ Other Security Measures
- JWT authentication required on all endpoints
- RLS policies prevent client-side inserts
- Invite codes use safe character set (no 0, O, I, 1)
- Symmetric friendship enforcement via CHECK constraint
- Lexicographic ordering prevents duplicate friendships

---

## Test Environment Setup

### Prerequisites
1. **Database Migration**:
   ```bash
   # Apply the migration
   supabase db reset
   # OR if using migrations directly:
   psql -h <host> -U <user> -d <database> -f supabase/migrations/20250118000001_friends_feature.sql
   ```

2. **Backend Server**:
   ```bash
   cd server
   npm install
   npm run dev
   ```

3. **Frontend Client**:
   ```bash
   cd client
   npm install
   npm run dev
   ```

4. **Test Users**:
   Create at least 3 test users:
   - User A (alice@test.com) - Student in Class 1
   - User B (bob@test.com) - Student in Class 1
   - User C (charlie@test.com) - Student in Class 2 (different class)
   - User D (diana@test.com) - No classroom assigned

---

## Test Cases

### 1. Database & Migration Tests

#### 1.1 Verify Tables Created
```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('friend_invite_codes', 'friendships');

-- Expected: Both tables should exist
```

#### 1.2 Verify RLS Policies
```sql
-- Check RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('friend_invite_codes', 'friendships');

-- Expected: rowsecurity = true for both tables
```

#### 1.3 Verify Database Functions
```sql
-- List all friend-related functions
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name LIKE '%invite%' OR routine_name LIKE '%friend%';

-- Expected:
-- - generate_invite_code
-- - get_or_create_invite_code
-- - redeem_invite_code
-- - get_user_friends
-- - are_users_friends
```

#### 1.4 Test Invite Code Generation
```sql
-- Generate invite code for User A
SELECT public.get_or_create_invite_code('<user_a_id>');

-- Expected: Returns a code in format XXXX-XXXX-XXXX
-- Run again to verify it returns the SAME code (idempotent)
```

#### 1.5 Test Friendship Creation (Direct DB)
```sql
-- Create friendship between User A and User C (different classes)
SELECT public.redeem_invite_code('<user_c_id>', 'USER_A_CODE');

-- Expected: Returns { success: true, friendship_id: <uuid>, message: "..." }
```

#### 1.6 Test RLS - Users Can Only See Their Own Data
```sql
-- As User A, try to see all invite codes
SET ROLE authenticated;
SET request.jwt.claims = '{"sub": "<user_a_id>"}';

SELECT * FROM public.friend_invite_codes;

-- Expected: Only User A's code is visible
```

---

### 2. Backend API Tests

#### 2.1 GET /api/friends/invite-code

**Test Case**: Get invite code (first time)
```bash
curl -X GET http://localhost:5000/api/friends/invite-code \
  -H "Authorization: Bearer <user_a_token>"

# Expected Response:
{
  "code": "ABCD-EFGH-IJKL"
}
```

**Test Case**: Get invite code (second time - should return same code)
```bash
curl -X GET http://localhost:5000/api/friends/invite-code \
  -H "Authorization: Bearer <user_a_token>"

# Expected: Same code as before
```

**Test Case**: Unauthorized request
```bash
curl -X GET http://localhost:5000/api/friends/invite-code

# Expected: 401 Unauthorized
```

#### 2.2 POST /api/friends/redeem

**Test Case**: Redeem valid invite code (different users)
```bash
curl -X POST http://localhost:5000/api/friends/redeem \
  -H "Authorization: Bearer <user_b_token>" \
  -H "Content-Type: application/json" \
  -d '{"code": "USER_A_CODE"}'

# Expected Response:
{
  "success": true,
  "message": "Vriendschap succesvol aangemaakt!",
  "friendshipId": "<uuid>"
}
```

**Test Case**: Try to redeem own invite code
```bash
curl -X POST http://localhost:5000/api/friends/redeem \
  -H "Authorization: Bearer <user_a_token>" \
  -H "Content-Type: application/json" \
  -d '{"code": "USER_A_CODE"}'

# Expected Response:
{
  "success": false,
  "error": "Je kunt jezelf niet als vriend toevoegen"
}
```

**Test Case**: Redeem invalid code
```bash
curl -X POST http://localhost:5000/api/friends/redeem \
  -H "Authorization: Bearer <user_b_token>" \
  -H "Content-Type: application/json" \
  -d '{"code": "INVALID-CODE-XXX"}'

# Expected Response:
{
  "success": false,
  "error": "Ongeldige uitnodigingscode"
}
```

**Test Case**: Redeem code twice (duplicate friendship)
```bash
# After already creating friendship between User A and User B
curl -X POST http://localhost:5000/api/friends/redeem \
  -H "Authorization: Bearer <user_b_token>" \
  -H "Content-Type: application/json" \
  -d '{"code": "USER_A_CODE"}'

# Expected Response:
{
  "success": false,
  "error": "Je bent al bevriend met deze gebruiker"
}
```

#### 2.3 GET /api/friends

**Test Case**: Get friends list (User A has 1 friend)
```bash
curl -X GET http://localhost:5000/api/friends \
  -H "Authorization: Bearer <user_a_token>"

# Expected Response:
[
  {
    "id": "<user_b_id>",
    "name": "Bob",
    "email": "bob@test.com",
    "avatar_url": null
  }
]
```

**Test Case**: Get friends list (User D has 0 friends)
```bash
curl -X GET http://localhost:5000/api/friends \
  -H "Authorization: Bearer <user_d_token>"

# Expected Response:
[]
```

#### 2.4 DELETE /api/friends/:friendId

**Test Case**: Remove a friend
```bash
curl -X DELETE http://localhost:5000/api/friends/<user_b_id> \
  -H "Authorization: Bearer <user_a_token>"

# Expected Response:
{
  "success": true,
  "message": "Vriendschap verwijderd"
}
```

**Test Case**: Try to remove non-friend
```bash
curl -X DELETE http://localhost:5000/api/friends/<user_c_id> \
  -H "Authorization: Bearer <user_a_token>"

# Expected Response:
{
  "success": true,
  "message": "Vriendschap verwijderd"
}
# Note: This should succeed but do nothing if not friends
```

#### 2.5 GET /api/friends/check/:friendId

**Test Case**: Check if users are friends
```bash
curl -X GET http://localhost:5000/api/friends/check/<user_b_id> \
  -H "Authorization: Bearer <user_a_token>"

# Expected Response:
{
  "areFriends": true
}
```

---

### 3. Frontend UI Tests

#### 3.1 InviteCodeCard Component

**Test Steps**:
1. Log in as User A
2. Navigate to `/friends`
3. Verify invite code card is displayed
4. Verify code is in format XXXX-XXXX-XXXX
5. Click "Kopiëren" button
6. Verify toast message "Gekopieerd! 📋"
7. Paste in text editor to verify code was copied
8. Click "Delen" button (if on mobile with Share API)
9. Verify share dialog opens

**Expected Results**:
- ✅ Invite code displayed correctly
- ✅ Copy button works
- ✅ Share button works (mobile)
- ✅ Toast notifications appear
- ✅ Loading state shows spinner

#### 3.2 AddFriendForm Component

**Test Steps**:
1. Log in as User B
2. Navigate to `/friends`
3. Enter User A's invite code in the input field
4. Verify input auto-formats to uppercase
5. Click "Vriend Toevoegen"
6. Verify success toast "Vriendschap aangemaakt! 🎉"
7. Verify friends list updates to show User A
8. Try adding same friend again
9. Verify error toast "Je bent al bevriend met deze gebruiker"
10. Try entering invalid code
11. Verify error toast "Ongeldige uitnodigingscode"
12. Try entering empty code
13. Verify error toast "Voer een code in"

**Expected Results**:
- ✅ Input field validates and formats correctly
- ✅ Success flow creates friendship
- ✅ Error handling for all edge cases
- ✅ Friends list updates automatically
- ✅ Form resets after success

#### 3.3 FriendsList Component

**Test Steps**:
1. Log in as User A (with friends)
2. Navigate to `/friends`
3. Verify friends list shows all friends
4. Verify friend cards show: avatar, name, email
5. Click remove button (X icon)
6. Verify confirmation dialog appears
7. Click "Annuleren"
8. Verify dialog closes, friend still in list
9. Click remove button again
10. Click "Verwijderen"
11. Verify friend removed from list
12. Verify success toast "Vriend verwijderd"
13. Log in as User D (no friends)
14. Verify empty state message

**Expected Results**:
- ✅ Friends displayed with correct info
- ✅ Confirmation dialog works
- ✅ Remove functionality works
- ✅ Empty state shown when no friends
- ✅ List updates automatically

#### 3.4 ComplimentDailyGive Component (Updated with Tabs)

**Test Steps - User with classmates and friends**:
1. Log in as User A (in classroom, has friends)
2. Navigate to `/compliments`
3. Click "Compliment Geven" button
4. Verify dialog shows TWO tabs: "Klasgenoten" and "Vrienden"
5. Verify "Klasgenoten" tab is active by default
6. Verify classmate dropdown shows classroom members
7. Click "Vrienden" tab
8. Verify friends dropdown shows friends
9. Select a friend
10. Choose a compliment
11. Click "Verzenden"
12. Verify success toast mentions "vriend"
13. Verify compliment is sent

**Test Steps - User with only friends (no classroom)**:
1. Log in as User D (no classroom, has friends)
2. Navigate to `/compliments`
3. Click "Compliment Geven" button
4. Verify only "Vrienden" tab is shown (no "Klasgenoten")
5. Verify message: "Je zit nog niet in een klas..."
6. Select a friend
7. Send compliment
8. Verify success

**Test Steps - User with no classmates and no friends**:
1. Create new user with no classroom/friends
2. Navigate to `/compliments`
3. Click "Compliment Geven" button
4. Verify empty state message
5. Verify message: "Je bent nog alleen hier 😄"
6. Verify CTA: "Nodig een vriendin uit..."
7. Verify no send button is shown

**Expected Results**:
- ✅ Tabs shown only when both classmates and friends exist
- ✅ Correct recipient list based on active tab
- ✅ Empty state handled gracefully
- ✅ Friend compliments work same as classmate compliments
- ✅ Success messages adapt to context

#### 3.5 Friends Page

**Test Steps**:
1. Navigate to `/friends`
2. Verify page layout:
   - Header "Vrienden 👥"
   - "Naar Complimenten" button
   - Invite code card (left)
   - Add friend form (right)
   - Friends list (bottom, full width)
3. Click "Naar Complimenten" button
4. Verify navigation to `/compliments`
5. Verify responsive layout on mobile (stacked cards)

**Expected Results**:
- ✅ All components render correctly
- ✅ Layout is responsive
- ✅ Navigation works
- ✅ All cards functional

#### 3.6 Navigation Integration

**Test Steps**:
1. Log in as any user
2. Verify bottom navigation shows 9 tabs
3. Verify "👥" (Friends) tab is visible
4. Click Friends tab
5. Verify navigation to `/friends`
6. Verify tab is highlighted
7. Click Compliments tab
8. Verify navigation to `/compliments`
9. Verify tab is highlighted

**Expected Results**:
- ✅ Friends tab visible in navigation
- ✅ Navigation works correctly
- ✅ Active tab highlighting works
- ✅ Grid layout handles 9 tabs

---

### 4. Integration Tests (End-to-End Flows)

#### 4.1 Complete Friendship Flow

**Scenario**: Two users in different classrooms become friends

1. User A logs in
2. User A navigates to `/friends`
3. User A views their invite code: `ABCD-EFGH-IJKL`
4. User A shares code with User C (out of band)
5. User C logs in
6. User C navigates to `/friends`
7. User C enters code `ABCD-EFGH-IJKL` in Add Friend form
8. User C clicks "Vriend Toevoegen"
9. Verify success message
10. Verify User C's friends list shows User A
11. User A refreshes page
12. Verify User A's friends list shows User C
13. User A navigates to `/compliments`
14. User A clicks "Compliment Geven"
15. User A switches to "Vrienden" tab
16. User A sees User C in dropdown
17. User A sends compliment to User C
18. Verify success
19. User C logs in
20. User C navigates to `/compliments`
21. Verify User C received compliment from anonymous sender

**Expected Result**: ✅ Complete flow works end-to-end

#### 4.2 Friendship + Classroom Compliments

**Scenario**: User can send compliments to both classmates and friends

1. User A has classmates (User B in same class)
2. User A has friends (User C in different class)
3. User A navigates to `/compliments`
4. User A clicks "Compliment Geven"
5. On "Klasgenoten" tab, send compliment to User B
6. Verify daily limit prevents second classmate compliment
7. Switch to "Vrienden" tab
8. Try to send compliment to User C
9. Verify error: "Je hebt vandaag al een compliment verstuurd"

**Expected Result**: ✅ Daily limit applies across both classmates and friends

#### 4.3 Remove Friend and Verify Access

**Scenario**: After removing friend, cannot send compliments

1. User A and User C are friends
2. User A removes User C from friends list
3. User A navigates to `/compliments`
4. User A clicks "Compliment Geven"
5. Switch to "Vrienden" tab
6. Verify User C is NOT in dropdown
7. User C logs in
8. User C navigates to `/friends`
9. Verify User A is NOT in friends list

**Expected Result**: ✅ Friendship removal is symmetric and instant

---

### 5. Security Tests

#### 5.1 RLS Policy Enforcement

**Test**: User cannot see other users' invite codes
```sql
-- As User A
SELECT * FROM public.friend_invite_codes WHERE user_id != '<user_a_id>';

-- Expected: Empty result set (RLS blocks)
```

**Test**: User cannot see friendships they're not part of
```sql
-- As User A, try to see friendship between User B and User C
SELECT * FROM public.friendships
WHERE user_a = '<user_b_id>' AND user_b = '<user_c_id>';

-- Expected: Empty result set (RLS blocks)
```

#### 5.2 Client-Side Insert Prevention

**Test**: Direct insert to friendships should fail
```javascript
// In browser console
const { data, error } = await supabase
  .from('friendships')
  .insert({ user_a: 'some-uuid', user_b: 'some-uuid' });

// Expected: error.message = "new row violates row-level security policy"
```

#### 5.3 API Authorization

**Test**: API calls without JWT token
```bash
curl -X GET http://localhost:5000/api/friends

# Expected: 401 Unauthorized
```

**Test**: API calls with expired/invalid token
```bash
curl -X GET http://localhost:5000/api/friends \
  -H "Authorization: Bearer invalid_token_here"

# Expected: 401 Unauthorized
```

#### 5.4 Compliment Validation for Friends

**Test**: User cannot send compliment to non-friend
```bash
# User A tries to send compliment to User D (not friends, not classmates)
curl -X POST http://localhost:5000/api/compliments \
  -H "Authorization: Bearer <user_a_token>" \
  -H "Content-Type: application/json" \
  -d '{"to_user": "<user_d_id>", "message": "Test"}'

# Expected: Error (RLS blocks or validation fails)
```

#### 5.5 Invite Code Brute Force Protection

**✅ IMPLEMENTED**: Rate limiting on redeem endpoint

**Test A**: Rate limiting enforcement
```bash
# Make 15 rapid requests with different codes (limit is 10 per 15 minutes)
for i in {1..15}; do
  curl -X POST http://localhost:5000/api/friends/redeem \
    -H "Authorization: Bearer <token>" \
    -H "Content-Type: application/json" \
    -d "{\"code\": \"TEST-CODE-$i\"}"
done

# Expected:
# - First 10 requests: 400 (invalid code) or 200 (if valid)
# - Request 11-15: 429 Too Many Requests
# - Response: { "error": "Too many attempts", "message": "Te veel pogingen. Probeer het over 15 minuten opnieuw." }
```

**Test B**: Rate limit headers
```bash
curl -i -X POST http://localhost:5000/api/friends/redeem \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"code": "TEST-CODE"}'

# Expected headers in response:
# RateLimit-Limit: 10
# RateLimit-Remaining: 9
# RateLimit-Reset: <timestamp>
```

**Test C**: Failed attempt logging
```bash
# Check server logs after failed attempts
tail -f server.log | grep "SECURITY"

# Expected log entries:
# [SECURITY] Failed invite code redemption: {"userId":"...","ip":"...","code":"TEST****","reason":"...","timestamp":"..."}
# [SECURITY] Rate limit exceeded for redeem endpoint - IP: ..., User: ...
```

#### 5.6 Timing Attack Prevention

**✅ IMPLEMENTED**: Constant-time error responses

**Test**: Measure response times for different error types
```bash
# Test 1: Invalid code (code doesn't exist)
time curl -X POST http://localhost:5000/api/friends/redeem \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"code": "INVALID-CODE"}'

# Test 2: Self-add attempt
time curl -X POST http://localhost:5000/api/friends/redeem \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"code": "YOUR-OWN-CODE"}'

# Test 3: Already friends
time curl -X POST http://localhost:5000/api/friends/redeem \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"code": "ALREADY-FRIEND-CODE"}'

# Expected:
# - All three should return similar response times (~200ms minimum)
# - All return same generic error: "De uitnodigingscode is ongeldig of kan niet worden gebruikt"
# - No information leakage about WHY it failed
```

#### 5.7 Generic Error Messages (Information Leakage Prevention)

**✅ IMPLEMENTED**: All failed redemptions return same generic error

**Test**: Verify no information leakage
```bash
# All different error scenarios should return the SAME error message
# This prevents attackers from determining:
# - Whether a code exists
# - Whether they're already friends with someone
# - Whether they're trying to add themselves

# Expected response for ALL failures:
{
  "error": "Ongeldige code",
  "message": "De uitnodigingscode is ongeldig of kan niet worden gebruikt"
}
```

---

### 6. Performance Tests

#### 6.1 Friends List Query Performance

**Test**: Query performance with large friends list
```sql
-- Create 100 friendships for User A
-- Then query:
EXPLAIN ANALYZE SELECT * FROM public.get_user_friends('<user_a_id>');

-- Expected: Query time < 100ms with proper indexes
```

#### 6.2 Invite Code Uniqueness at Scale

**Test**: Generate 10,000 invite codes and verify uniqueness
```sql
DO $$
DECLARE
  i INTEGER;
  user_id UUID;
BEGIN
  FOR i IN 1..10000 LOOP
    user_id := gen_random_uuid();
    INSERT INTO public.users (id, name, email)
    VALUES (user_id, 'Test User ' || i, 'test' || i || '@example.com');

    PERFORM public.get_or_create_invite_code(user_id);
  END LOOP;
END $$;

-- Check for duplicates
SELECT code, COUNT(*) FROM public.friend_invite_codes GROUP BY code HAVING COUNT(*) > 1;

-- Expected: No duplicates
```

---

### 7. Edge Cases & Error Handling

#### 7.1 Concurrency: Two users redeem each other's codes simultaneously
- User A redeems User B's code
- User B redeems User A's code (at the same time)
- Expected: Only ONE friendship created (due to unique constraint)

#### 7.2 User deletes account
- User A and User B are friends
- User A deletes account
- Expected: Friendship automatically deleted (CASCADE)
- User B's friends list no longer shows User A

#### 7.3 Invalid UUID in API calls
```bash
curl -X DELETE http://localhost:5000/api/friends/not-a-uuid \
  -H "Authorization: Bearer <token>"

# Expected: 400 Bad Request
```

#### 7.4 Network failures during friend operations
- Simulate network disconnect during redeem
- Verify no partial state (friendship created without confirmation)
- Verify retry logic works

---

## Automated Test Scripts

### Run All Backend Tests
```bash
cd server
npm test -- --grep "Friends API"
```

### Run All Frontend Tests
```bash
cd client
npm test -- --grep "Friends|InviteCode|FriendsList"
```

### Run E2E Tests (Playwright/Cypress)
```bash
npm run test:e2e -- friends.spec.ts
```

---

## Success Criteria

✅ **All tests pass**
- Database migration successful
- All API endpoints return expected responses
- All UI components render and function correctly
- No security vulnerabilities
- Performance within acceptable limits

✅ **User Experience**
- Intuitive invite code flow
- Clear error messages
- Responsive design works on mobile and desktop
- Navigation is seamless

✅ **Data Integrity**
- Friendships are symmetric
- No orphaned records
- RLS policies enforced
- CASCADE deletes work

✅ **Integration**
- Friends can send compliments
- Daily limit applies across classmates and friends
- Streak system works with friend compliments
- Compliments remain anonymous

---

## Regression Tests

After implementing friends feature, verify these existing features still work:

1. ✅ Regular classroom compliments
2. ✅ Compliment streaks and badges
3. ✅ ComplimentsWall displays correctly
4. ✅ ClassMoodMeter functions
5. ✅ User authentication/signup
6. ✅ Other app features (Planning, Leren, etc.)

---

## Rollback Plan

If critical issues found:

1. **Database**: Revert migration
   ```bash
   # Rollback migration
   psql -h <host> -U <user> -d <database> -c "
   DROP TABLE IF EXISTS public.friendships CASCADE;
   DROP TABLE IF EXISTS public.friend_invite_codes CASCADE;
   DROP FUNCTION IF EXISTS public.generate_invite_code;
   DROP FUNCTION IF EXISTS public.get_or_create_invite_code;
   DROP FUNCTION IF EXISTS public.redeem_invite_code;
   DROP FUNCTION IF EXISTS public.get_user_friends;
   DROP FUNCTION IF EXISTS public.are_users_friends;
   "
   ```

2. **Backend**: Remove friends routes from `server/routes.ts`

3. **Frontend**: Remove Friends route from `App.tsx` and tab from `Layout.tsx`

---

## Post-Launch Monitoring

### Metrics to Track
1. Number of invite codes generated per day
2. Number of friendships created per day
3. Friend-to-friend compliments sent per day
4. Average response time for friend API endpoints
5. Error rate for friend operations

### Alerts
- Spike in 500 errors on friends endpoints
- Slow query performance (> 500ms)
- High rate of failed invite code redemptions

---

## Known Limitations

1. **Daily Limit**: Currently applies globally (1 compliment per day total), not per recipient type
2. **No Friendship Requests**: Auto-accept model (anyone with code can add)
3. **No Friend Suggestions**: Manual invite-code only
4. **No Block Feature**: Users can only remove friends, not block them

---

## Future Enhancements

1. Add friend request/approval flow
2. Add block functionality
3. Add friend suggestions based on school/class
4. Add QR code sharing for invite codes
5. Add analytics dashboard for friend connections
6. Add separate daily limits for classmates vs friends

---

**Document Version**: 1.0
**Last Updated**: 2025-01-18
**Author**: Claude (Noukie Development Team)
