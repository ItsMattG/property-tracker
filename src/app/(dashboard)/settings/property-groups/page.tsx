"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, FolderOpen } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";
import { getErrorMessage } from "@/lib/errors";

// ── Constants ────────────────────────────────────────────────────────

const COLOURS = [
  "#3B82F6", "#22C55E", "#8B5CF6", "#F97316",
  "#EC4899", "#14B8A6", "#EF4444", "#EAB308",
] as const;

// ── Page ─────────────────────────────────────────────────────────────

export default function PropertyGroupsSettingsPage() {
  const { data: groups, isLoading } = trpc.propertyGroup.list.useQuery();
  const utils = trpc.useUtils();

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [selectedColour, setSelectedColour] = useState<string>(COLOURS[0]);

  // Delete confirmation state
  const [deleteGroupId, setDeleteGroupId] = useState<string | null>(null);
  const deleteGroup = groups?.find((g) => g.id === deleteGroupId);

  // ── Mutations ────────────────────────────────────────────────────

  const createMutation = trpc.propertyGroup.create.useMutation({
    onSuccess: () => {
      utils.propertyGroup.list.invalidate();
      toast.success("Group created");
      setDialogOpen(false);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const updateMutation = trpc.propertyGroup.update.useMutation({
    onSuccess: () => {
      utils.propertyGroup.list.invalidate();
      toast.success("Group updated");
      setDialogOpen(false);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const deleteMutation = trpc.propertyGroup.delete.useMutation({
    onSuccess: () => {
      utils.propertyGroup.list.invalidate();
      toast.success("Group deleted");
      setDeleteGroupId(null);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  // ── Handlers ─────────────────────────────────────────────────────

  function handleOpenCreate() {
    setEditingGroupId(null);
    setName("");
    setSelectedColour(COLOURS[0]);
    setDialogOpen(true);
  }

  function handleOpenEdit(group: { id: string; name: string; colour: string }) {
    setEditingGroupId(group.id);
    setName(group.name);
    setSelectedColour(group.colour);
    setDialogOpen(true);
  }

  function handleSave() {
    const trimmedName = name.trim();
    if (!trimmedName) return;

    if (editingGroupId) {
      updateMutation.mutate({
        id: editingGroupId,
        name: trimmedName,
        colour: selectedColour,
      });
    } else {
      createMutation.mutate({
        name: trimmedName,
        colour: selectedColour,
      });
    }
  }

  function handleDelete() {
    if (!deleteGroupId) return;
    deleteMutation.mutate({ id: deleteGroupId });
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  // ── Render ───────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Property Groups</h1>
          <p className="text-muted-foreground">
            Organise properties into custom groups
          </p>
        </div>
        <Button onClick={handleOpenCreate}>
          <Plus className="w-4 h-4" />
          New Group
        </Button>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="flex items-center gap-3 py-4">
                <Skeleton className="w-4 h-4 rounded-full" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="ml-auto h-4 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && groups && groups.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
              <FolderOpen className="w-6 h-6 text-muted-foreground" />
            </div>
            <h3 className="font-medium mb-1">No property groups yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Group your properties to track performance by portfolio segment
            </p>
            <Button onClick={handleOpenCreate}>
              <Plus className="w-4 h-4" />
              Create your first group
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Group list */}
      {!isLoading && groups && groups.length > 0 && (
        <div className="space-y-2">
          {groups.map((group) => (
            <Card key={group.id}>
              <CardContent className="flex items-center gap-3 py-4">
                {/* Colour dot */}
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: group.colour }}
                />

                {/* Name */}
                <span className="font-medium text-sm">{group.name}</span>

                {/* Property count badge */}
                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                  {group.propertyCount}{" "}
                  {group.propertyCount === 1 ? "property" : "properties"}
                </span>

                {/* Actions */}
                <div className="ml-auto flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleOpenEdit(group)}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setDeleteGroupId(group.id)}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingGroupId ? "Edit Group" : "New Group"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Name input */}
            <div className="space-y-2">
              <label
                htmlFor="group-name"
                className="text-sm font-medium leading-none"
              >
                Name
              </label>
              <Input
                id="group-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Sydney Portfolio"
                maxLength={50}
                autoFocus
              />
            </div>

            {/* Colour picker */}
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none">
                Colour
              </label>
              <div className="flex gap-2">
                {COLOURS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setSelectedColour(c)}
                    className={cn(
                      "w-8 h-8 rounded-full transition-all cursor-pointer",
                      selectedColour === c
                        ? "ring-2 ring-offset-2 ring-primary"
                        : "hover:scale-110"
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!name.trim() || isSaving}
            >
              {isSaving ? "Saving..." : editingGroupId ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deleteGroupId}
        onOpenChange={(open) => {
          if (!open) setDeleteGroupId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete group</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-medium text-foreground">
                {deleteGroup?.name}
              </span>
              ? Properties in this group will not be deleted, but they will be
              unassigned from it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
