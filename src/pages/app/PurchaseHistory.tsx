import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList,
  BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Receipt, DollarSign, Search, Menu, ChevronDown, Check,
  LayoutList, Clock, Package as PackageIcon, Eye, ShoppingCart,
  AlertTriangle, ClipboardCheck, FileText, Link2,
} from "lucide-react";

type ViewMode = "all" | "by-list" | "by-date";
type SourceTab = "all" | "orders" | "invoices";

export default function PurchaseHistoryPage() {
  const { currentRestaurant } = useRestaurant();
  const navigate = useNavigate();
  const [purchases, setPurchases] = useState<any[]>([]);
  const [phItems, setPhItems] = useState<Record<string, any[]>>({});
  const [phIssues, setPhIssues] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("all");
  const [sourceTab, setSourceTab] = useState<SourceTab>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!currentRestaurant) return;
    setLoading(true);
    supabase
      .from("purchase_history")
      .select("*, inventory_lists(name), source, smart_order_run_id, po_number, receipt_status, invoice_status")
      .eq("restaurant_id", currentRestaurant.id)
      .order("created_at", { ascending: false })
      .then(async ({ data }) => {
        if (data) {
          setPurchases(data);
          const itemMap: Record<string, any[]> = {};
          const issueMap: Record<string, any[]> = {};
          for (const p of data) {
            const [{ data: items }, { data: issues }] = await Promise.all([
              supabase.from("purchase_history_items").select("*").eq("purchase_history_id", p.id),
              supabase.from("delivery_issues").select("*").eq("purchase_history_id", p.id),
            ]);
            if (items) itemMap[p.id] = items;
            if (issues) issueMap[p.id] = issues;
          }
          setPhItems(itemMap);
          setPhIssues(issueMap);
        }
        setLoading(false);
      });
  }, [currentRestaurant]);

  const totalCost = (items: any[]) =>
    items.reduce((sum, i) => sum + (Number(i.total_cost) || 0), 0);

  // Source tab filter
  const sourceFiltered = purchases.filter(p => {
    if (sourceTab === "orders") return p.source === "smart_order";
    if (sourceTab === "invoices") return p.source !== "smart_order";
    return true;
  });

  // Search filter
  const filteredPurchases = sourceFiltered.filter(p => {
    if (!search) return true;
    const lower = search.toLowerCase();
    const listName = (p.inventory_lists?.name || "").toLowerCase();
    const vendor = (p.vendor_name || "").toLowerCase();
    const po = (p.po_number || "").toLowerCase();
    const items = phItems[p.id] || [];
    const hasItem = items.some((i: any) => (i.item_name || "").toLowerCase().includes(lower));
    return listName.includes(lower) || vendor.includes(lower) || po.includes(lower) || hasItem;
  });

  // Group by view mode
  const getGrouped = (): Record<string, any[]> => {
    if (viewMode === "by-list") {
      const groups: Record<string, any[]> = {};
      filteredPurchases.forEach(p => {
        const key = p.inventory_lists?.name || p.vendor_name || "Unknown";
        if (!groups[key]) groups[key] = [];
        groups[key].push(p);
      });
      return Object.keys(groups).length ? groups : { "All": filteredPurchases };
    }
    if (viewMode === "by-date") {
      const groups: Record<string, any[]> = {};
      filteredPurchases.forEach(p => {
        const key = new Date(p.created_at).toLocaleDateString();
        if (!groups[key]) groups[key] = [];
        groups[key].push(p);
      });
      return Object.keys(groups).length ? groups : { "All": filteredPurchases };
    }
    return { "All": filteredPurchases };
  };

  const grouped = getGrouped();

  const viewModeLabel: Record<ViewMode, string> = {
    all: "All",
    "by-list": "Group by List",
    "by-date": "Group by Date",
  };

  // Receipt status badge for orders
  const orderStatusBadge = (p: any) => {
    if (p.receipt_status === "confirmed") {
      return <Badge className="bg-success/10 text-success border-0 text-[10px]">Fully Received</Badge>;
    }
    if (p.receipt_status === "issues_reported") {
      return <Badge className="bg-orange-500/10 text-orange-600 border-0 text-[10px]">Issues Reported</Badge>;
    }
    if (p.invoice_status === "RECEIVED" || p.invoice_status === "COMPLETE") {
      return <Badge className="bg-muted/60 text-muted-foreground border-0 text-[10px]">Submitted</Badge>;
    }
    return null;
  };

  // Invoice status badge
  const invoiceStatusBadge = (p: any) => {
    const status = p.invoice_status;
    if (status === "COMPLETE") return <Badge className="bg-success/10 text-success border-0 text-[10px]">Posted ✓</Badge>;
    if (status === "RECEIVED") return <Badge className="bg-warning/10 text-warning border-0 text-[10px]">Pending Review</Badge>;
    if (status === "DRAFT") return <Badge className="bg-muted/60 text-muted-foreground border-0 text-[10px]">Draft</Badge>;
    return null;
  };

  if (!currentRestaurant) {
    return (
      <div className="empty-state">
        <PackageIcon className="empty-state-icon" />
        <p className="empty-state-title">Select a restaurant to view purchase history</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-10 w-64" />
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      </div>
    );
  }

  const ordersCount = purchases.filter(p => p.source === "smart_order").length;
  const invoicesCount = purchases.filter(p => p.source !== "smart_order").length;

  return (
    <div className="space-y-5 animate-fade-in">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem><BreadcrumbLink href="/app/dashboard">Home</BreadcrumbLink></BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem><BreadcrumbPage>Purchase History</BreadcrumbPage></BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="page-header">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Purchase History</h1>
          <p className="text-sm text-muted-foreground">Track purchase orders and received invoices</p>
        </div>
      </div>

      {/* Source Tabs */}
      <Tabs value={sourceTab} onValueChange={v => setSourceTab(v as SourceTab)}>
        <TabsList className="h-9">
          <TabsTrigger value="all" className="text-xs gap-1.5">
            All
            <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{purchases.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="orders" className="text-xs gap-1.5">
            <ShoppingCart className="h-3 w-3" /> Orders
            <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{ordersCount}</Badge>
          </TabsTrigger>
          <TabsTrigger value="invoices" className="text-xs gap-1.5">
            <FileText className="h-3 w-3" /> Invoices
            <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{invoicesCount}</Badge>
          </TabsTrigger>
        </TabsList>

        {(["all", "orders", "invoices"] as SourceTab[]).map(tab => (
          <TabsContent key={tab} value={tab} className="mt-4 space-y-4">
            {/* Toolbar */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search orders, items, vendors, PO#..."
                  className="pl-9 h-9"
                />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2 h-9">
                    <Menu className="h-3.5 w-3.5" />
                    {viewModeLabel[viewMode]}
                    <ChevronDown className="h-3 w-3 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-48">
                  <DropdownMenuItem onClick={() => setViewMode("all")} className="gap-2">
                    <LayoutList className="h-4 w-4" /> All
                    {viewMode === "all" && <Check className="h-3.5 w-3.5 ml-auto" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setViewMode("by-list")} className="gap-2">
                    <Receipt className="h-4 w-4" /> Group by List
                    {viewMode === "by-list" && <Check className="h-3.5 w-3.5 ml-auto" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setViewMode("by-date")} className="gap-2">
                    <Clock className="h-4 w-4" /> Group by Date
                    {viewMode === "by-date" && <Check className="h-3.5 w-3.5 ml-auto" />}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {filteredPurchases.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Receipt className="mx-auto h-10 w-10 mb-3 opacity-20" />
                  <p className="text-sm font-medium">
                    {tab === "orders" ? "No purchase orders yet" : tab === "invoices" ? "No invoices yet" : "No records yet"}
                  </p>
                  <p className="text-xs mt-1">
                    {tab === "orders"
                      ? "Submit a Smart Order to generate purchase orders."
                      : tab === "invoices"
                      ? "Upload an invoice from the Invoices page."
                      : "Submit a Smart Order or upload an invoice to get started."}
                  </p>
                </CardContent>
              </Card>
            ) : (
              Object.entries(grouped).map(([groupName, groupPurchases]) => (
                <div key={groupName} className="space-y-2">
                  {Object.keys(grouped).length > 1 && (
                    <div className="flex items-center gap-2 px-1">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{groupName}</h3>
                      <Badge variant="secondary" className="text-[10px]">{groupPurchases.length}</Badge>
                    </div>
                  )}
                  {groupPurchases.map(p => {
                    const isOrder = p.source === "smart_order";
                    const isLinked = !isOrder && p.smart_order_run_id;
                    return (
                      <Card key={p.id} className="overflow-hidden border shadow-sm">
                        <CardContent className="p-0">
                          <div
                            className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/10 transition-colors"
                            onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}
                          >
                            {/* Left: type badge + info */}
                            <div className="flex items-start gap-3 min-w-0">
                              {/* Type indicator */}
                              <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${isOrder ? "bg-blue-500/10" : "bg-success/10"}`}>
                                {isOrder
                                  ? <ShoppingCart className="h-3.5 w-3.5 text-blue-600" />
                                  : <FileText className="h-3.5 w-3.5 text-success" />
                                }
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  {/* ORDER badge */}
                                  {isOrder && (
                                    <Badge className="bg-blue-500/10 text-blue-700 border-0 text-[10px] font-semibold">ORDER</Badge>
                                  )}
                                  {/* INVOICE badge */}
                                  {!isOrder && (
                                    <Badge className="bg-success/10 text-success border-0 text-[10px] font-semibold">INVOICE</Badge>
                                  )}
                                  <p className="font-semibold text-sm truncate">
                                    {p.inventory_lists?.name || p.vendor_name || "Unknown"}
                                  </p>
                                  {p.vendor_name && p.inventory_lists?.name && (
                                    <span className="text-[11px] text-muted-foreground">{p.vendor_name}</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                  {/* PO number — direct from column only (no fallback join) */}
                                  {p.po_number && (
                                    <Badge className="bg-primary/10 text-primary border-0 text-[10px] font-mono">
                                      {p.po_number}
                                    </Badge>
                                  )}
                                  {/* Linked indicator */}
                                  {isLinked && (
                                    <span className="flex items-center gap-0.5 text-[11px] text-primary/70">
                                      <Link2 className="h-3 w-3" />
                                      {p.po_number ? `Linked to ${p.po_number}` : "Linked to PO"}
                                    </span>
                                  )}
                                  {/* Awaiting invoice (order with no linked invoice) */}
                                  {isOrder && !p.receipt_status?.startsWith("confirmed") && (
                                    <span className="text-[11px] text-muted-foreground/60">Awaiting invoice</span>
                                  )}
                                  {/* Status */}
                                  {isOrder ? orderStatusBadge(p) : invoiceStatusBadge(p)}
                                  {p.receipt_status === "issues_reported" && !isOrder && (
                                    <Badge className="bg-orange-500/10 text-orange-600 border-0 text-[10px]">Issues</Badge>
                                  )}
                                  <span className="text-[11px] text-muted-foreground">
                                    {new Date(p.created_at).toLocaleDateString()}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Right: cost + actions */}
                            <div className="flex items-center gap-2 ml-2 shrink-0">
                              <div className="text-right">
                                <p className="text-xs text-muted-foreground">{phItems[p.id]?.length || 0} items</p>
                                <p className="text-sm font-mono font-semibold">${totalCost(phItems[p.id] || []).toFixed(2)}</p>
                              </div>
                              {/* Show Review button for invoices pending review */}
                              {!isOrder && (p.invoice_status === "RECEIVED" || p.receipt_status === "pending" || p.receipt_status === "reviewing") && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 px-2 gap-1 text-[11px]"
                                  onClick={e => { e.stopPropagation(); navigate(`/app/invoices/${p.id}/review`); }}
                                >
                                  <ClipboardCheck className="h-3.5 w-3.5" /> Review
                                </Button>
                              )}
                              <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>

                          {/* Expanded detail */}
                          {expandedId === p.id && (
                            <div className="border-t">
                              <Tabs defaultValue="items" className="w-full">
                                <div className="px-4 pt-3">
                                  <TabsList className="h-8">
                                    <TabsTrigger value="items" className="text-xs h-7 px-3">
                                      Items ({phItems[p.id]?.length || 0})
                                    </TabsTrigger>
                                    <TabsTrigger value="discrepancies" className="text-xs h-7 px-3 gap-1">
                                      {(phIssues[p.id]?.length || 0) > 0 && (
                                        <AlertTriangle className="h-3 w-3 text-orange-500" />
                                      )}
                                      Discrepancies ({phIssues[p.id]?.length || 0})
                                    </TabsTrigger>
                                  </TabsList>
                                </div>
                                <TabsContent value="items" className="mt-0">
                                  <Table>
                                    <TableHeader>
                                      <TableRow className="bg-muted/30">
                                        <TableHead className="text-xs font-semibold">Item</TableHead>
                                        <TableHead className="text-xs font-semibold">Brand</TableHead>
                                        <TableHead className="text-xs font-semibold">Pack Size</TableHead>
                                        <TableHead className="text-xs font-semibold">Qty</TableHead>
                                        <TableHead className="text-xs font-semibold">Unit Cost</TableHead>
                                        <TableHead className="text-xs font-semibold">Total</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {(phItems[p.id] || []).map((item: any) => (
                                        <TableRow key={item.id}>
                                          <TableCell className="font-medium text-sm">{item.item_name}</TableCell>
                                          <TableCell className="text-xs text-muted-foreground">{item.brand_name || "—"}</TableCell>
                                          <TableCell className="text-xs text-muted-foreground">{item.pack_size || "—"}</TableCell>
                                          <TableCell className="font-mono text-sm">{item.quantity}</TableCell>
                                          <TableCell className="font-mono text-sm">{item.unit_cost ? `$${Number(item.unit_cost).toFixed(2)}` : "—"}</TableCell>
                                          <TableCell className="font-mono text-sm">{item.total_cost ? `$${Number(item.total_cost).toFixed(2)}` : "—"}</TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                  <div className="flex items-center justify-end gap-2 p-3 border-t bg-muted/10">
                                    <DollarSign className="h-4 w-4 text-primary" />
                                    <p className="text-sm font-semibold">
                                      Total: <span className="text-primary">${totalCost(phItems[p.id] || []).toFixed(2)}</span>
                                    </p>
                                  </div>
                                </TabsContent>
                                <TabsContent value="discrepancies" className="mt-0">
                                  {(phIssues[p.id]?.length || 0) === 0 ? (
                                    <div className="py-8 text-center text-muted-foreground text-sm">
                                      No issues reported for this delivery.
                                    </div>
                                  ) : (
                                    <Table>
                                      <TableHeader>
                                        <TableRow className="bg-muted/30">
                                          <TableHead className="text-xs font-semibold">Item</TableHead>
                                          <TableHead className="text-xs font-semibold">Issue</TableHead>
                                          <TableHead className="text-xs font-semibold">Notes</TableHead>
                                          <TableHead className="text-xs font-semibold">Reported</TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {(phIssues[p.id] || []).map((iss: any) => (
                                          <TableRow key={iss.id}>
                                            <TableCell className="text-sm font-medium">{iss.item_name}</TableCell>
                                            <TableCell>
                                              <Badge className="bg-orange-500/10 text-orange-600 border-0 text-[10px]">
                                                {iss.issue_type.replace(/_/g, " ")}
                                              </Badge>
                                            </TableCell>
                                            <TableCell className="text-xs text-muted-foreground">{iss.notes || "—"}</TableCell>
                                            <TableCell className="text-xs text-muted-foreground">
                                              {new Date(iss.reported_at).toLocaleDateString()}
                                            </TableCell>
                                          </TableRow>
                                        ))}
                                      </TableBody>
                                    </Table>
                                  )}
                                </TabsContent>
                              </Tabs>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              ))
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
