import { Loader2 } from "lucide-react";

export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin text-violet-600 mx-auto" />
        <p className="mt-3 text-sm text-gray-500">Loading dashboard…</p>
      </div>
    </div>
  );
}
