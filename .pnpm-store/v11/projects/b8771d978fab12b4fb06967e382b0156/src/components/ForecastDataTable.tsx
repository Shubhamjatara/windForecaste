import { useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Download,
  Table2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  createCSV,
  formatMW,
  formatSignedMW,
  formatTimestamp,
  STALE_HOURS,
} from "@/lib/forecast";
import type { ForecastRow } from "@/types/forecast";

export function ForecastDataTable({ rows }: { rows: ForecastRow[] }) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "targetTime", desc: false },
  ]);
  const columns = useMemo<ColumnDef<ForecastRow>[]>(
    () => [
      {
        accessorKey: "targetTime",
        header: "Target Time",
        cell: ({ row }) => (
          <span className="font-medium">
            {formatTimestamp(row.original.targetTime, true)}
          </span>
        ),
      },
      {
        id: "publishTime",
        accessorFn: (row) => row.publishTime ?? undefined,
        sortUndefined: "last",
        header: "Forecast Publish Time",
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.publishTime
              ? formatTimestamp(row.original.publishTime, true)
              : "No eligible forecast"}
          </span>
        ),
      },
      {
        id: "forecastMW",
        accessorFn: (row) => row.forecastMW ?? undefined,
        sortUndefined: "last",
        header: "Forecast Generation",
        cell: ({ getValue }) =>
          getValue() === undefined
            ? "Unavailable"
            : formatMW(getValue<number>()),
      },
      {
        id: "actualMW",
        accessorFn: (row) => row.actualMW ?? undefined,
        sortUndefined: "last",
        header: "Actual Generation",
        cell: ({ row }) =>
          row.original.actualMW === null ? (
            <span className="text-muted-foreground">
              {row.original.actualStatus === "hidden"
                ? "Not yet known"
                : row.original.actualStatus === "pending"
                  ? "Pending"
                  : "Missing"}
            </span>
          ) : (
            formatMW(row.original.actualMW)
          ),
      },
      {
        id: "errorMW",
        accessorFn: (row) => row.errorMW ?? undefined,
        sortUndefined: "last",
        header: "Forecast Error",
        cell: ({ getValue }) =>
          getValue() === undefined ? (
            <span aria-label="Not evaluable">—</span>
          ) : (
            <span
              className={`inline-flex min-w-16 justify-end rounded px-1.5 py-1 ${getValue<number>() >= 0 ? "bg-[#edf5f0] text-[#327351]" : "bg-[#f3f0f7] text-[#79638f]"}`}
            >
              {formatSignedMW(getValue<number>())}
            </span>
          ),
      },
      {
        id: "absoluteErrorMW",
        accessorFn: (row) => row.absoluteErrorMW ?? undefined,
        sortUndefined: "last",
        header: "Absolute Error",
        cell: ({ getValue }) =>
          getValue() === undefined ? (
            <span aria-label="Not evaluable">—</span>
          ) : (
            formatMW(getValue<number>())
          ),
      },
      {
        accessorKey: "decisionTime",
        header: "Decision Time",
        cell: ({ row }) => formatTimestamp(row.original.decisionTime, true),
      },
      {
        id: "ageHours",
        accessorFn: (row) => row.ageHours ?? undefined,
        sortUndefined: "last",
        header: "Forecast Age",
        cell: ({ row }) =>
          row.original.ageHours === null ? (
            "—"
          ) : (
            <span
              className={
                row.original.ageHours > STALE_HOURS
                  ? "font-medium text-amber-800"
                  : ""
              }
            >
              {row.original.ageHours.toFixed(1)} h
              {row.original.ageHours > STALE_HOURS ? " · Stale" : ""}
            </span>
          ),
      },
      { accessorKey: "eligibleRevisions", header: "Eligible Revisions" },
    ],
    [],
  );
  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 8 } },
  });
  const { pageIndex, pageSize } = table.getState().pagination;

  function exportData() {
    const blob = new Blob(
      [
        "\uFEFF",
        createCSV(table.getSortedRowModel().rows.map((row) => row.original)),
      ],
      { type: "text/csv;charset=utf-8;" },
    );
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = 'windscope-elexon-forecast-data.csv';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <Card
      id="data"
      className="scroll-mt-6 gap-0 overflow-hidden rounded-xl border-border py-0 shadow-none"
    >
      <CardHeader className="flex flex-col justify-between gap-4 px-5 py-5 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2.5">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Table2 size={16} className="text-muted-foreground" />
              Detailed Forecast Data
            </CardTitle>
            <Badge
              variant="secondary"
              className="rounded-md px-1.5 py-0.5 text-[10px] font-medium"
            >
              {rows.length} intervals
            </Badge>
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Latest eligible revision per interval. Scroll for decision time, age
            and revision count. All timestamps in UTC.
          </p>
        </div>
        <Button
          variant="outline"
          className="h-8 gap-2 self-start rounded-lg px-3 text-xs shadow-none sm:self-auto"
          onClick={exportData}
          disabled={!rows.length}
        >
          <Download size={13} />
          Export CSV
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <Table className="min-w-[1480px] text-xs">
          <TableHeader>
            <TableRow className="border-y border-border bg-[#f7f9f8] hover:bg-[#f7f9f8]">
              {table.getHeaderGroups()[0].headers.map((header, index) => (
                <TableHead
                  key={header.id}
                  aria-sort={
                    header.column.getIsSorted() === "asc"
                      ? "ascending"
                      : header.column.getIsSorted() === "desc"
                        ? "descending"
                        : "none"
                  }
                  className={`h-14 px-5 ${index > 1 ? "text-right" : ""}`}
                >
                  <button
                    className={`inline-flex items-center gap-1.5 rounded py-2 text-[11px] font-medium text-muted-foreground ${index > 1 ? "justify-end" : ""}`}
                    onClick={header.column.getToggleSortingHandler()}
                    aria-label={`Sort by ${header.column.columnDef.header}`}
                  >
                    <span>
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                      <span className="ml-1 text-[10px] font-normal">
                        {header.id.endsWith("MW")
                          ? "(MW)"
                          : header.id.endsWith("Time")
                            ? "(UTC)"
                            : ""}
                      </span>
                    </span>
                    {header.column.getIsSorted() === "asc" ? (
                      <ArrowUp size={12} />
                    ) : header.column.getIsSorted() === "desc" ? (
                      <ArrowDown size={12} />
                    ) : (
                      <ArrowUpDown size={12} className="opacity-50" />
                    )}
                  </button>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                className="h-[51px] border-border hover:bg-[#fafcfb]"
              >
                {row.getVisibleCells().map((cell, index) => (
                  <TableCell
                    key={cell.id}
                    className={`px-5 tabular-nums ${index > 1 ? "text-right" : ""}`}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="flex flex-col gap-4 border-t border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11px] text-muted-foreground" aria-live="polite">
            Showing{" "}
            <span className="font-medium text-foreground">
              {rows.length ? pageIndex * pageSize + 1 : 0}–
              {Math.min((pageIndex + 1) * pageSize, rows.length)}
            </span>{" "}
            of{" "}
            <span className="font-medium text-foreground">{rows.length}</span>{" "}
            intervals
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Label
                htmlFor="page-size"
                className="text-[11px] font-normal text-muted-foreground"
              >
                Rows per page
              </Label>
              <select
                id="page-size"
                value={pageSize}
                onChange={(event) =>
                  table.setPageSize(Number(event.target.value))
                }
                className="h-7 rounded-md border border-border bg-white px-2 text-[11px]"
              >
                {[8, 16, 32].map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </div>
            <span className="text-[11px] text-muted-foreground">
              Page {pageIndex + 1} of {table.getPageCount()}
            </span>
            <div className="flex gap-1.5">
              <Button
                variant="outline"
                size="icon"
                className="size-7 shadow-none"
                onClick={() => table.firstPage()}
                disabled={!table.getCanPreviousPage()}
                aria-label="First page"
              >
                <ChevronsLeft size={13} />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="size-7 shadow-none"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
                aria-label="Previous page"
              >
                <ChevronLeft size={13} />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="size-7 shadow-none"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
                aria-label="Next page"
              >
                <ChevronRight size={13} />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="size-7 shadow-none"
                onClick={() => table.lastPage()}
                disabled={!table.getCanNextPage()}
                aria-label="Last page"
              >
                <ChevronsRight size={13} />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
