import {
  ArrowUpRight,
  CalendarDays,
  ChevronRight,
  Database,
  RefreshCw,
  Wind,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatPeriod } from "@/lib/forecast";
import type { DateRange } from "@/types/forecast";

interface Props {
  range: DateRange;
  loading: boolean;
  onRefresh: () => void;
}

export function DashboardHeader({ range, loading, onRefresh }: Props) {
  return (
    <>
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-6 px-5 sm:px-8 lg:px-12">
          <a
            href="#overview"
            className="flex shrink-0 items-center gap-2.5 py-5"
            aria-label="Windscope overview"
          >
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-white">
              <Wind size={22} />
            </span>
            <span className="text-xl font-bold tracking-[-0.7px]">
              windscope<span className="text-primary">.</span>
            </span>
          </a>
          <nav
            aria-label="Main navigation"
            className="hidden items-stretch gap-8 self-stretch md:flex"
          >
            <a
              href="#overview"
              className="nav-link border-b-2 border-primary font-semibold text-primary"
            >
              Overview
            </a>
            <a href="#data" className="nav-link text-muted-foreground">
              Data explorer
            </a>
            <a href="#methodology" className="nav-link text-muted-foreground">
              Methodology
            </a>
          </nav>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="hidden sm:inline">ENERGY INTELLIGENCE</span>
            <span
              className="flex size-8 items-center justify-center rounded-full border border-border bg-muted text-[11px] font-semibold text-foreground"
              aria-label="United Kingdom"
            >
              UK
            </span>
          </div>
        </div>
      </header>
      <div
        className="mb-7 mt-7 flex items-center gap-2 text-xs text-muted-foreground"
        aria-label="Breadcrumb"
      >
        <span>Analytics</span>
        <ChevronRight size={13} />
        <span className="text-foreground">Wind generation</span>
      </div>
      <section
        className="mb-7 flex flex-col justify-between gap-5 lg:flex-row lg:items-center"
        aria-labelledby="dashboard-title"
      >
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-3">
            <h1
              id="dashboard-title"
              className="text-[27px] font-semibold tracking-[-1px] sm:text-[32px]"
            >
              Wind Forecast Analytics
            </h1>
            <Badge
              variant="outline"
              className="rounded-md border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-emerald-800"
            >
              ELEXON ARCHIVE
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
            <span>UK National Wind Generation</span>
            <span aria-hidden="true" className="text-border">
              |
            </span>
            <Badge
              variant="outline"
              className="gap-1.5 rounded-md border-border bg-white font-normal text-muted-foreground"
            >
              <Database size={12} />
              Elexon <span className="text-[10px]">· WINDFOR / FUELHH</span>
            </Badge>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2 text-xs font-medium sm:text-sm">
            <CalendarDays className="size-4 text-muted-foreground" />
            {formatPeriod(range)}
          </span>
          <Button
            variant="outline"
            disabled={loading}
            onClick={onRefresh}
            className="h-9 gap-2 bg-white px-3 text-xs shadow-none"
            aria-label="Refresh Elexon data"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            {loading ? "Refreshing…" : "Refresh"}
          </Button>
        </div>
      </section>
    </>
  );
}

export function SourceNotice() {
  return (
    <div className="mb-6 flex items-start gap-3 rounded-lg border border-[#dce9e3] bg-[#f1f7f4] px-4 py-3 text-xs leading-relaxed text-[#476455]">
      <span className="mt-1 size-1.5 shrink-0 rounded-full bg-[#45836a]" />
      <p className="flex-1">
        <span className="font-semibold text-[#284a3a]">
          A clear view of forecast performance.
        </span>{" "}
        Source: Elexon WINDFOR forecasts and WIND FUELHH actuals, retrieved
        through the Python API. Forecasts are selected as of your decision time.
      </p>
      <a
        href="#methodology"
        className="hidden shrink-0 items-center gap-1 font-medium text-[#284a3a] sm:flex"
      >
        About this data <ArrowUpRight size={13} />
      </a>
    </div>
  );
}
