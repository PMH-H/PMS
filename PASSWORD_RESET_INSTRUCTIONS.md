# How to Reset Test User Passwords

Your existing test users don't have the password `password123`, which is why you're getting "Invalid login credentials".

## Option 1: Run SQL Script (Recommended)

1. Open Supabase Dashboard: https://supabase.com/dashboard
2. Go to your project → SQL Editor
3. Copy and paste the contents of `supabase/reset_test_passwords.sql`
4. Click "Run" to execute

## Option 2: Use Supabase CLI

```bash
npx supabase db execute --file supabase/reset_test_passwords.sql
```

## After Running the Script

All your test users will have the password: `password123`

You can login with:
- **admin@pharmai.com** (role: admin)
- **bms@pharmai.com** (role: super_admin_bms)
- **customer@gmail.com** (role: customer)
- **dev@pharmai.com** (role: super_admin_dev)
- **patient@pharmai.com** (role: customer)
- **pharmacist@pharmai.com** (role: pharmacist)

## Alternative: Reset Individual Password via Supabase Dashboard

1. Go to Authentication → Users
2. Click on a user
3. Click "Send Password Reset Email"
4. Check your email and reset the password

## Why This Happened

The users in your database were created without the `password123` password. They either:
- Were created with a different password
- Were created without a password set
- Need their passwords reset

The SQL script above will set all test users to use `password123` for easy testing.
