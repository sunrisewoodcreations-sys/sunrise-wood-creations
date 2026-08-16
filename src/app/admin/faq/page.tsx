import { createClient } from "@/lib/supabase/server";
import AdminFaqManager from "@/components/AdminFaqManager";

export const dynamic = "force-dynamic";

export default async function AdminFaqPage() {
  const supabase = createClient();
  const { data: questions } = await supabase.from("faq_questions").select("*").order("created_at", { ascending: false });

  return (
    <div>
      <h1 className="font-display text-2xl text-[#1E3A5F] mb-1">FAQ Questions</h1>
      <p className="text-sm text-[#1E3A5F]/60 mb-6">Answer submitted questions. Saving sends the answer directly to the person by email.</p>
      <AdminFaqManager questions={questions || []} />
    </div>
  );
}
