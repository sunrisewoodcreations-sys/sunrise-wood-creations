# Supabase auth email templates

These are copies of the branded emails Supabase sends. Supabase does not read them from this repo:
paste each into **Supabase > Authentication > Email Templates** and save.

| File | Template | Subject |
| --- | --- | --- |
| `invite-user.html` | Invite user | You've been invited to Sunrise Wood Creations |
| `reset-password.html` | Reset password | Reset your Sunrise Wood Creations password |

Keep the `{{ .ConfirmationURL }}` placeholders as they are; Supabase fills in the real link.

The reset-password template links straight to `/update-password` with a one-time `token_hash`
(the page verifies it itself), so it does not depend on Supabase's Redirect URLs list. The invite
template still uses `{{ .ConfirmationURL }}`.
