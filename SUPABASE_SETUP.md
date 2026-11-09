# EFTNIX production setup (Supabase)

## Current status
The marketplace UI and interactive concept demos are in `index.html`. This branch adds a Supabase-backed quote intake, authenticated payment-proof submissions, private proof storage, and an admin review UI. This is not live until the SQL migration is applied, Auth is configured, and Vercel deploys this branch.

## 1. Apply database setup
In Supabase Dashboard → SQL Editor, run `supabase/migrations/202611090001_eftnix_core.sql`.

## 2. Configure Auth
- Enable Email provider in Authentication → Providers.
- Configure the production Site URL and redirect URLs for your Vercel domain and eventual custom domain.
- Create your own admin user via Authentication → Users.
- After creating your admin user, assign the trusted role from the Supabase SQL Editor (replace the email):
  `update auth.users set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"eftnix_admin"}'::jsonb where email = 'YOUR_ADMIN_EMAIL';`
- Do not use user_metadata and never expose service_role keys in frontend code.
- Public visitors can submit quotation requests. Customers must sign in to submit payment proof.

## 3. Payment safety
The bKash/Nagad number is shown as a manual payment destination only. Submissions are stored as `pending`; verify transaction ID and amount in the official merchant/personal account before approving. A screenshot is not proof of settlement. Never ask customers for PIN or OTP.

## 4. Deploy
Vercel should build the branch preview. Test quote submission, customer signup/login, private file upload, customer isolation, admin access and review actions before merging to main. The publishable key in `supabase-client.js` is designed for browser use; RLS policies are the security boundary. No service_role secret is included.

## 5. Important limitations
- The catalogue prices are indicative starting prices; quotations remain subject to scope.
- Demo workspaces use fictional data and are not production business apps.
- Admin role assignment and SQL application are manual dashboard steps; this repository integration cannot perform those actions in your Supabase project.
