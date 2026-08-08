import { getCapacitySettings, getUtilizationForRange, usableMinutesPerDay } from "@/lib/productionCapacity";
import ProductionCapacityForm from "@/components/ProductionCapacityForm";

export default async function ProductionCapacityPage() {
  const settings = await getCapacitySettings();

  const todayStr = new Date().toISOString().slice(0, 10);
  const endStr = new Date(Date.now() + 13 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const utilization = await getUtilizationForRange(todayStr, endStr);

  return (
    <ProductionCapacityForm
      settings={settings}
      usableMinutesPerDay={usableMinutesPerDay(settings)}
      utilization={utilization}
    />
  );
}
