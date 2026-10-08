# Setting up accounts & cloud sync

Quizr works fully without this. Follow these steps once to let people sign in (Google or email) and back up / sync their quizzes. It takes about 20–30 minutes and is free on Supabase's free plan.

You'll need:
- your site's address, e.g. `https://your-app.vercel.app`
- a Google account (for the Google Cloud Console)

Wherever you see `your-app.vercel.app` below, use your real address.

---

## 1. Create a Supabase project

1. Go to **https://supabase.com**, sign up, and click **New project**.
2. Give it a name (e.g. `quizr`), set a strong **database password** (save it somewhere safe), and pick the **region** closest to your users.
3. Wait a minute or two for the project to be ready.

## 2. Create the database tables

1. In your project, open **SQL Editor** → **New query**.
2. Open the file [`supabase/schema.sql`](supabase/schema.sql) from this repository, copy everything, paste it in, and click **Run**.
3. You should see "Success. No rows returned". (It's safe to run again later.)

This creates the `quizzes` table (one row per quiz) and the `quiz_members` table (ready for sharing with co-hosts later), with security rules so each person can only ever see and change their own quizzes.

## 3. Tell Supabase where your site lives

1. Open **Authentication** → **URL Configuration**.
2. **Site URL**: `https://your-app.vercel.app`
3. Under **Redirect URLs**, click **Add URL** and add:
   - `https://your-app.vercel.app/**`
   - (optional, for testing on your computer) `http://localhost:8000/**`
4. Save.

## 4. Email sign-in with confirmation

1. Open **Authentication** → **Sign In / Providers** → **Email**.
2. Make sure **Email** is enabled and **Confirm email** is **on**. People who sign up with email must click the link in their inbox before they can sign in.
3. **Important for real use:** Supabase's built-in email sender only allows a few emails per hour and is meant for testing. Before you invite lots of people, connect a proper email service under **Authentication** → **Emails** → **SMTP Settings**, using any SMTP provider such as Resend, Brevo, Postmark or Gmail SMTP.
4. Optional: under **Authentication** → **Emails** → **Templates**, change the wording of the confirmation and password-reset emails to mention Quizr.

## 5. Google sign-in

### 5a. In Supabase: copy the callback address
1. Open **Authentication** → **Sign In / Providers** → **Google**.
2. Copy the **Callback URL (for OAuth)**. It looks like `https://abcdefghijklmnop.supabase.co/auth/v1/callback`. Keep this page open.

### 5b. In Google Cloud Console: create the sign-in client
1. Go to **https://console.cloud.google.com** and create a project (e.g. `Quizr`).
2. Open **APIs & Services** → **OAuth consent screen**. Depending on Google's current layout, this may appear as **Google Auth Platform**.
   - **App name:** Quizr. **User support email:** your email.
   - **Audience:** External.
   - **Authorized domains:** add `vercel.app` (or your own domain) and `supabase.co`.
   - **Contact email:** your email.
   - Save, then **Publish app** so anyone can sign in, not just test users.
3. Open **Clients** (or **Credentials** → **Create credentials**) → **OAuth client ID**.
   - **Application type:** Web application.
   - **Authorized JavaScript origins:** `https://your-app.vercel.app`
   - **Authorized redirect URIs:** paste the Supabase **Callback URL** from step 5a.
   - Click **Create**, then copy the **Client ID** and **Client secret**.

### 5c. Back in Supabase
1. On the **Google** provider page: switch it **on**, paste the **Client ID** and **Client secret**, and click **Save**.

## 6. Connect the app to your project

1. In Supabase open **Project Settings** → **API Keys** (the project address is also shown under **Connect**). Copy:
   - the **Project URL**, e.g. `https://abcdefghijklmnop.supabase.co`
   - the **Publishable key**, starting `sb_publishable_`. If your project shows the older keys, the **anon public** key works too.
2. Open `js/cloud/config.js` and fill them in:

   ```js
   window.QuizBowl.CloudConfig = {
       supabaseUrl: 'https://abcdefghijklmnop.supabase.co',
       supabaseKey: 'sb_publishable_xxxxxxxxxxxxxxxx'
   };
   ```

   These two values are designed to be public. **Never** put the **secret** key (`sb_secret_…`) or the old **service_role** key in this file. It would give anyone full access to your database.
3. Commit and push. Vercel redeploys automatically.

## 7. Try it

1. Open your site, hard refresh (Ctrl+Shift+R), and go to **Account & Sync** in the sidebar.
2. Click **Continue with Google**, choose your account, and you'll come back signed in.
3. Press **Upload** on a quiz. Open the site on another device, sign in, and press **Download to this device**.

---

## How syncing works (for reference)

- **Signing in is optional.** Nothing leaves a device until someone presses Upload, Sync, or turns on Auto-sync for a quiz.
- **Each quiz** is synced on its own and shows one of these statuses:
  - *Only on this device*
  - *Synced*
  - *Changed here*
  - *Newer in cloud*
  - *Changed in both places*: you choose which version to keep, so nothing is silently overwritten
  - *Only in the cloud*
- **Auto-sync** (per quiz) uploads changes a few seconds after they happen, including points scored on the public display. It also checks for changes from other devices when the app opens, when you come back online, and every two minutes while the app is open.
- **AI API keys** stay on each device and are never uploaded.
- **Signing out** keeps the quizzes on the device.

## Troubleshooting

| Problem | Fix |
|---|---|
| Account & Sync says "Cloud sync isn't set up on this site yet" | Fill in `js/cloud/config.js` (step 6), push, then hard refresh. |
| Google shows `redirect_uri_mismatch` | The **Authorized redirect URI** in Google must exactly match Supabase's **Callback URL** (step 5). |
| After Google sign-in you land on a Supabase error or the wrong page | Add your site to **Redirect URLs** with `/**` at the end (step 3). |
| "Please confirm your email first" | Click the link in the confirmation email, or use **Resend the email**. Check spam. |
| Confirmation emails don't arrive | The built-in sender is rate-limited. Set up custom SMTP (step 4.3). |
| "The cloud database isn't set up yet" | Run `supabase/schema.sql` in the SQL Editor (step 2). |
| Project stopped responding after a quiet week | Free Supabase projects pause after a period of inactivity. Open the Supabase dashboard and click **Restore project**. |
