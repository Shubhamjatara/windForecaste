import { BookOpen, ChevronDown, Wind } from "lucide-react";
export function Methodology() {
  return (
    <>
      <details
        id="methodology"
        className="group mt-6 scroll-mt-6 rounded-xl border border-border bg-white"
      >
        <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-4 text-xs font-medium">
          <BookOpen size={15} className="text-muted-foreground" />
          Understanding the data & methodology
          <ChevronDown
            size={14}
            className="ml-auto text-muted-foreground transition-transform group-open:rotate-180"
          />
        </summary>
        <div className="grid gap-6 border-t border-border px-5 py-5 text-xs leading-6 text-muted-foreground md:grid-cols-3">
          <div>
            <h3 className="mb-1 font-semibold text-foreground">
              Decisions before delivery
            </h3>
            <p>
              Choose a January decision day and a UTC cutoff. Delivery is the
              following calendar day, with 48 half-hour intervals. January 31
              decisions therefore cover February 1. Each interval uses the
              latest revision published at or before that decision time; later
              revisions are excluded. The default 10:00 cutoff is illustrative,
              not a stated market deadline.
            </p>
          </div>
          <div>
            <h3 className="mb-1 font-semibold text-foreground">
              Measuring accuracy fairly
            </h3>
            <p>
              Historical accuracy applies the chosen cutoff separately to every
              decision day and compares those forecasts with archived actuals.
              MAE = mean absolute error; RMSE = square root of mean squared
              error; bias = mean(forecast − actual). Only matched pairs
              contribute, including zero-generation values. Missing data is
              never treated as zero. Day-ahead view hides actuals and errors.
            </p>
          </div>
          <div>
            <h3 className="mb-1 font-semibold text-foreground">
              Elexon archive & coverage
            </h3>
            <p>
              The Python API retrieves WINDFOR forecast publications from December 25 through January 31 and WIND FUELHH actuals for January 2 through February 1. Forecasts and actuals match exact UTC target timestamps; hourly forecast points leave half-hour gaps. No interpolation or forward filling is applied. Actuals use the latest returned publication, not an as-of reconstruction. Cached responses expire after one hour; Refresh requests fresh data. Forecast age over 12 hours is an illustrative freshness warning.
            </p>
          </div>
        </div>
      </details>
      <footer className="flex flex-col gap-3 py-7 text-[10px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <span className="flex items-center gap-1.5">
          <Wind size={14} />
          <span className="font-semibold text-[#627269]">windscope</span>
          <span className="mx-1 text-border">/</span>Clarity in every forecast.
        </span>
        <span>
          UK national wind · All times UTC · Elexon archive
        </span>
      </footer>
    </>
  );
}
