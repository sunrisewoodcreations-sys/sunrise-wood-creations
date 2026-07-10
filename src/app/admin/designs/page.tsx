import { createClient } from "@/lib/supabase/server";
import DesignGeneratorForm from "@/components/DesignGeneratorForm";

export default async function DesignsPage() {
  const supabase = createClient();

  const { data: designs } = await supabase
    .from("design_generations")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(30);

  return (
    <div>
      <h1 className="font-display text-2xl text-black mb-1">Cornhole design generator</h1>
      <p className="text-sm text-black/60 mb-6">
        Admin-only. Customers can't see or access this page.
      </p>

      <DesignGeneratorForm />

      {designs && designs.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-black mb-3">Past generations</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {designs.map((d: any) => (
              <a
                key={d.id}
                href={d.result_image_url}
                target="_blank"
                rel="noopener noreferrer"
                className="block bg-white border border-black/10 rounded-lg overflow-hidden hover:opacity-90"
              >
                {d.result_image_url && (
                  <img src={d.result_image_url} alt={d.prompt} className="w-full h-32 object-cover" />
                )}
                <div className="p-2">
                  <p className="text-xs text-black/60 line-clamp-2">{d.prompt}</p>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
