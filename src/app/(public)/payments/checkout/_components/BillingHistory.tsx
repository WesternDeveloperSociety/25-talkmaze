"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/src/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/src/components/ui/table";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { CaretIcon } from "@/src/components/ui/icons";
import Spinner from "@/src/components/ui/Spinner";
import { cn } from "@/src/utils/cn";
import { formatMoney } from "@/src/utils/formatMoney";
import type { InvoiceDTO } from "@/src/lib/payments/server/listInvoicesForAccount";
import { api, apiFetch } from "@/src/lib/api/routes";
import { invoiceStatusBadge } from "./invoiceStatusBadge";

const PAGE_SIZE = 10;

const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

type FetchState = "idle" | "loading" | "ready" | "empty" | "error" | "hidden";

type InvoicesResponse = {
  invoices: InvoiceDTO[];
  hasMore: boolean;
  nextCursor: string | null;
};

/**
 * Collapsible billing-history panel for the checkout Overview. Lazily fetches
 * the account's Stripe invoices on first expand and pages through them with
 * "Load more". Renders nothing for the unauthenticated new-signup flow
 * (studentId === "new") or if the API responds 401.
 */
export function BillingHistory({ className }: { className?: string }) {
  const searchParams = useSearchParams();
  const isNewSignup = searchParams.get("studentId") === "new";

  const [invoices, setInvoices] = useState<InvoiceDTO[]>([]);
  const [state, setState] = useState<FetchState>("idle");
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const hasFetchedRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const loadFirstPage = useCallback(async () => {
    setState("loading");
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await apiFetch(
        api.subscriptions.invoices({ limit: PAGE_SIZE }),
        { signal: controller.signal },
      );
      if (res.status === 401) {
        setState("hidden");
        return;
      }
      if (!res.ok) {
        setState("error");
        return;
      }
      const data: InvoicesResponse = await res.json();
      setInvoices(data.invoices);
      setHasMore(data.hasMore);
      setCursor(data.nextCursor);
      setState(data.invoices.length === 0 ? "empty" : "ready");
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setState("error");
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (!cursor) return;
    setLoadingMore(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await apiFetch(
        api.subscriptions.invoices({ limit: PAGE_SIZE, startingAfter: cursor }),
        { signal: controller.signal },
      );
      if (!res.ok) return; // keep the rows already shown
      const data: InvoicesResponse = await res.json();
      setInvoices((prev) => [...prev, ...data.invoices]);
      setHasMore(data.hasMore);
      setCursor(data.nextCursor);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
    } finally {
      setLoadingMore(false);
    }
  }, [cursor]);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (open && !hasFetchedRef.current) {
        hasFetchedRef.current = true;
        void loadFirstPage();
      }
    },
    [loadFirstPage],
  );

  if (isNewSignup || state === "hidden") return null;

  return (
    <Collapsible
      onOpenChange={handleOpenChange}
      className={cn("rounded-lg bg-white text-black", className)}
    >
      <CollapsibleTrigger className="group flex w-full items-center justify-between p-[15px] text-base font-semibold">
        <span>Billing History</span>
        <span className="flex items-center gap-1.5 text-xs font-normal text-[#666]">
          <span className="group-data-[state=open]:hidden">expand</span>
          <span className="hidden group-data-[state=open]:inline">
            collapse
          </span>
          <span className="flex transition-transform group-data-[state=open]:rotate-90">
            <CaretIcon size={14} color="#1f2e3b" />
          </span>
        </span>
      </CollapsibleTrigger>

      <CollapsibleContent className="px-[15px] pb-[15px]">
        {state === "loading" && (
          <div className="flex items-center gap-2 py-3 text-sm text-grey-3">
            <Spinner className="size-4 text-[#2b4257]" />
            Loading billing history…
          </div>
        )}

        {state === "error" && (
          <p className="py-3 text-sm text-grey-3">
            Couldn&apos;t load billing history.
          </p>
        )}

        {state === "empty" && (
          <p className="py-3 text-sm text-grey-3">No invoices yet.</p>
        )}

        {state === "ready" && (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv) => {
                  const badge = invoiceStatusBadge(inv.status);
                  return (
                    <TableRow key={inv.id}>
                      <TableCell className="text-black">
                        {dateFmt.format(new Date(inv.date))}
                      </TableCell>
                      <TableCell className="font-medium text-black">
                        {formatMoney(inv.total, inv.currency)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={badge.variant} size="sm">
                          {badge.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {inv.hostedInvoiceUrl ? (
                          <Button
                            asChild
                            variant="link"
                            size="sm"
                            className="h-auto p-0 text-sm text-secondary"
                          >
                            <a
                              href={inv.hostedInvoiceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              View
                            </a>
                          </Button>
                        ) : (
                          <span className="text-grey-3">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {hasMore && (
              <div className="pt-3">
                <Button
                  variant="outline-light"
                  size="sm"
                  onClick={loadMore}
                  loading={loadingMore}
                  className="w-full"
                >
                  Load more
                </Button>
              </div>
            )}
          </>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
