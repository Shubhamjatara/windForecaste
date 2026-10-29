import { CalendarSearch, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function EmptyState({ onReset }: { onReset: () => void }) {
  return (
    <Card className="my-6 shadow-none">
      <CardContent
        className="flex flex-col items-center px-5 py-12 text-center"
        role="status"
      >
        <span className="mb-4 flex size-12 items-center justify-center rounded-xl bg-muted">
          <CalendarSearch className="text-muted-foreground" size={24} />
        </span>
        <h2 className="text-lg font-semibold">No forecast data available</h2>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
          No records were returned for this selection. Reset the filters or refresh to try again.
        </p>
        <Button onClick={onReset} className="mt-6 gap-2">
          <RotateCcw size={14} />
          Reset to January 2026
        </Button>
      </CardContent>
    </Card>
  );
}
