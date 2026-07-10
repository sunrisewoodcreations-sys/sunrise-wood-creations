import { createClient } from "@/lib/supabase/server";

export default async function GuestMessagesPage() {
  const supabase = createClient();

  const { data: messages } = await supabase
    .from("guest_messages")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div>
      <h1 className="font-display text-2xl text-[#1E3A5F] mb-1">Website chat inquiries</h1>
      <p className="text-sm text-[#1E3A5F]/60 mb-6">
        Messages from the chat bubble on your public site — from people who haven't logged in.
        Reply directly to the notification email you received for each one, or use the link below.
      </p>

      <div className="bg-white border border-[#1E3A5F]/10 rounded-xl overflow-hidden">
        {(!messages || messages.length === 0) && (
          <p className="px-4 py-6 text-center text-sm text-[#1E3A5F]/50">No website chat messages yet.</p>
        )}
        {messages?.map((m: any) => (
          <div key={m.id} className="px-4 py-3 border-t border-[#1E3A5F]/10 first:border-0">
            <div className="flex items-center justify-between mb-1">
              <div className="text-sm font-semibold text-[#1E3A5F]">{m.name} <span className="font-normal text-[#1E3A5F]/50">({m.email})</span></div>
              <div className="text-xs font-mono text-[#1E3A5F]/40">
                {new Date(m.created_at).toLocaleDateString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric" })}
              </div>
            </div>
            <p className="text-sm text-[#1E3A5F]/80 mb-2">{m.body}</p>
            <a
              href={`mailto:${m.email}?subject=${encodeURIComponent("Re: your message to Sunrise Wood Creations")}`}
              className="text-xs font-semibold text-ember hover:underline"
            >
              Reply by email
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}
