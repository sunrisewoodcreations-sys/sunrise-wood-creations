# Supabase auth email templates

These are copies of the branded emails Supabase sends. Supabase does not read them from this repo:
paste each into **Supabase > Authentication > Email Templates** and save.

| File | Template | Subject |
| --- | --- | --- |
| `invite-user.html` | Invite user | You've been invited to Sunrise Wood Creations |
| `reset-password.html` | Reset password | Reset your Sunrise Wood Creations password |

Keep the `{{ .ConfirmationURL }}` placeholders as they are; Supabase fills in the real link.
