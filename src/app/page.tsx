import { SalesDashboard } from "@/components/SalesDashboard";

export default function Home() {
  return (
    <SalesDashboard initialToday={new Date().toISOString()} />
  );
}
