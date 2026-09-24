"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Armchair, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { api, ApiClientError } from "@/lib/api-client";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  TableFormDialog,
  type TableRecord,
} from "@/components/dashboard/tables/table-form-dialog";

interface BranchOption {
  _id: string;
  name: string;
  capacity: number;
}

export default function TablesPage() {
  const queryClient = useQueryClient();
  const [branchId, setBranchId] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TableRecord | null>(null);
  const [deleting, setDeleting] = useState<TableRecord | null>(null);

  const { data: branchData } = useQuery({
    queryKey: ["branches", "all"],
    queryFn: () => api.get<BranchOption[]>("/api/branches?limit=100"),
  });
  const branches = useMemo(() => branchData?.data ?? [], [branchData]);

  useEffect(() => {
    if (!branchId && branches.length > 0) setBranchId(branches[0]._id);
  }, [branches, branchId]);

  const { data, isLoading } = useQuery({
    queryKey: ["tables", branchId],
    queryFn: () => api.get<TableRecord[]>(`/api/tables?branchId=${branchId}`),
    enabled: !!branchId,
  });
  const tables = data?.data ?? [];

  const toggleActive = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/api/tables/${id}`, { isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tables"] }),
    onError: (error) =>
      toast.error(
        error instanceof ApiClientError ? error.message : "Could not update table"
      ),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/api/tables/${id}`),
    onSuccess: () => {
      toast.success("Table deleted");
      queryClient.invalidateQueries({ queryKey: ["tables"] });
      setDeleting(null);
    },
    onError: (error) => {
      toast.error(
        error instanceof ApiClientError ? error.message : "Could not delete table"
      );
      setDeleting(null);
    },
  });

  const activeTables = tables.filter((table) => table.isActive);
  const seats = activeTables.reduce((sum, table) => sum + table.seats, 0);
  const branch = branches.find((item) => item._id === branchId);

  const zones = [...new Set(tables.map((table) => table.zone ?? "Unzoned"))].sort();

  return (
    <>
      <PageHeader
        title="Tables"
        description="The tables bookings are seated at, per branch."
      >
        <Button
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
          disabled={!branchId}
        >
          <Plus className="h-4 w-4" />
          New table
        </Button>
      </PageHeader>

      <div className="flex flex-wrap items-center gap-3">
        <Select value={branchId} onValueChange={setBranchId}>
          <SelectTrigger className="w-full sm:w-64" aria-label="Branch">
            <SelectValue placeholder="Choose a branch" />
          </SelectTrigger>
          <SelectContent>
            {branches.map((item) => (
              <SelectItem key={item._id} value={item._id}>
                {item.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {branch && (
          <p className="text-sm text-muted-foreground">
            {activeTables.length} active {activeTables.length === 1 ? "table" : "tables"} ·{" "}
            {seats} seats
            {seats !== branch.capacity && (
              <span className="text-amber-600 dark:text-amber-500">
                {" "}
                · branch capacity is {branch.capacity}
              </span>
            )}
          </p>
        )}
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-28 w-full" />
          ))}
        </div>
      ) : tables.length === 0 ? (
        <EmptyState
          icon={Armchair}
          title="No tables yet"
          description="Add tables so bookings can be seated. Without tables, bookings only count against the branch's total seats."
          action={
            <Button onClick={() => setFormOpen(true)} disabled={!branchId}>
              <Plus className="h-4 w-4" />
              Add your first table
            </Button>
          }
        />
      ) : (
        <div className="space-y-8">
          {zones.map((zone) => (
            <section key={zone}>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {zone}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {tables
                  .filter((table) => (table.zone ?? "Unzoned") === zone)
                  .map((table) => (
                    <Card key={table._id} className={table.isActive ? "" : "opacity-60"}>
                      <CardContent className="space-y-3 p-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="text-lg font-semibold">{table.name}</div>
                            <Badge variant="secondary" className="mt-1">
                              {table.seats} {table.seats === 1 ? "seat" : "seats"}
                            </Badge>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label={`Actions for ${table.name}`}
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => {
                                  setEditing(table);
                                  setFormOpen(true);
                                }}
                              >
                                <Pencil />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => setDeleting(table)}
                              >
                                <Trash2 />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        <div className="flex items-center gap-2">
                          <Switch
                            id={`active-${table._id}`}
                            checked={table.isActive}
                            onCheckedChange={(checked) =>
                              toggleActive.mutate({ id: table._id, isActive: checked })
                            }
                          />
                          <label
                            htmlFor={`active-${table._id}`}
                            className="text-xs text-muted-foreground"
                          >
                            {table.isActive ? "In service" : "Out of service"}
                          </label>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <TableFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        branchId={branchId}
        table={editing}
      />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete ${deleting?.name}?`}
        description="Tables with upcoming bookings cannot be deleted — take them out of service instead."
        confirmLabel="Delete"
        onConfirm={() => {
          if (deleting) remove.mutate(deleting._id);
        }}
      />
    </>
  );
}
