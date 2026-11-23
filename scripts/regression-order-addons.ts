import { normalizeAddOnItems, retitleOrder, isProductLine } from "../src/lib/orderAddOns";
const eq = (a: any, b: any, m: string) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(m + ": " + JSON.stringify(a)); };

eq(retitleOrder("Cut It Up Cornhole Boards + 2 more items", ["Cut It Up Cornhole Boards", "b", "c", "d"]), "Cut It Up Cornhole Boards + 3 more items", "plural");
eq(retitleOrder("Test", ["Test", "Cornhole bags — Set of 4"]), "Test + 1 more item", "single to two");
eq(retitleOrder("Hand typed title", ["Test", "x"]), "Hand typed title", "custom title untouched");
eq(isProductLine("Delivery fee", 1000), false, "delivery");
eq(isProductLine("Coupon", -500), false, "discount");
eq(isProductLine("Bags", 3000), true, "product");

const ok = normalizeAddOnItems([{ title: " Bags ", quantity: "2", priceCents: 6000, productType: "cornhole" }]);
if (!ok.ok) throw new Error("should be ok");
eq(ok.items[0].quantity, 2, "qty"); eq(ok.items[0].lineTotalCents, 6000, "cents"); eq(ok.items[0].title, "Bags", "trim");
eq(normalizeAddOnItems([]).ok, false, "empty");
eq(normalizeAddOnItems([{ title: "", priceCents: 100 }]).ok, false, "no title");
eq(normalizeAddOnItems([{ title: "x", priceCents: -5 }]).ok, false, "negative");
console.log("order add-ons ok");
