import ProductImage from "@/components/ProductImage";
import TrackedLink from "@/components/TrackedLink";

// Photo-first category tile used in the homepage grid: big square photo,
// category name in the accent colour underneath, one short line below.
export default function ProductTile({
  slug,
  name,
  shortDesc,
  imageUrl
}: {
  slug: string;
  name: string;
  shortDesc: string;
  imageUrl: string | null;
}) {
  return (
    <TrackedLink
      href={`/products/${slug}`}
      eventName="product_category_click"
      eventParams={{ category: slug }}
      className="group block text-center"
    >
      <div className="rounded overflow-hidden group-hover:shadow-lg transition-shadow">
        <ProductImage imageUrl={imageUrl} name={name} areaClassName="aspect-square" iconSize={32} />
      </div>
      <h3 className="font-display text-lg sm:text-xl font-semibold text-accent mt-3 break-words">{name}</h3>
      <p className="text-[13px] sm:text-sm text-walnut/70 mt-0.5 px-1 break-words">{shortDesc}</p>
    </TrackedLink>
  );
}
