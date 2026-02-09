"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";
import { format } from "date-fns";
import { Pencil, Trash2, MessageSquare } from "lucide-react";

interface DiscussionNotesModalProps {
  transactionId: string;
  transactionDescription: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DiscussionNotesModal({
  transactionId,
  transactionDescription,
  open,
  onOpenChange,
}: DiscussionNotesModalProps) {
  const [newNote, setNewNote] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");

  const utils = trpc.useUtils();

  const { data: notes, isLoading } = trpc.transaction.listNotes.useQuery(
    { transactionId },
    { enabled: open }
  );

  const addNote = trpc.transaction.addNote.useMutation({
    onSuccess: () => {
      toast.success("Note added");
      setNewNote("");
      utils.transaction.listNotes.invalidate({ transactionId });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const updateNote = trpc.transaction.updateNote.useMutation({
    onSuccess: () => {
      toast.success("Note updated");
      setEditingId(null);
      setEditContent("");
      utils.transaction.listNotes.invalidate({ transactionId });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const deleteNote = trpc.transaction.deleteNote.useMutation({
    onSuccess: () => {
      toast.success("Note deleted");
      utils.transaction.listNotes.invalidate({ transactionId });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const handleAddNote = () => {
    if (!newNote.trim()) return;
    addNote.mutate({ transactionId, content: newNote.trim() });
  };

  const handleUpdateNote = (noteId: string) => {
    if (!editContent.trim()) return;
    updateNote.mutate({ noteId, content: editContent.trim() });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Discussion Notes
          </DialogTitle>
          <DialogDescription className="truncate">
            {transactionDescription}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 max-h-[400px] overflow-y-auto">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="h-16 rounded bg-muted animate-pulse" />
              ))}
            </div>
          ) : notes && notes.length > 0 ? (
            notes.map((note) => (
              <div
                key={note.id}
                className="rounded-lg border p-3 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary">
                      {(note.user as any)?.name?.[0]?.toUpperCase() ?? "?"}
                    </div>
                    <span className="text-sm font-medium">
                      {(note.user as any)?.name ?? "Unknown"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(note.createdAt), "dd MMM yyyy, HH:mm")}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => {
                        setEditingId(note.id);
                        setEditContent(note.content);
                      }}
                    >
                      <Pencil className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-destructive"
                      onClick={() => deleteNote.mutate({ noteId: note.id })}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
                {editingId === note.id ? (
                  <div className="space-y-2">
                    <Textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      rows={2}
                      className="text-sm"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleUpdateNote(note.id)}
                        disabled={updateNote.isPending}
                      >
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditingId(null);
                          setEditContent("");
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                )}
              </div>
            ))
          ) : (
            <div className="text-center py-6 text-muted-foreground text-sm">
              No notes yet. Add one below.
            </div>
          )}
        </div>

        {/* New note input */}
        <div className="space-y-2 border-t pt-4">
          <Textarea
            placeholder="Add a note..."
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            rows={2}
            className="text-sm"
          />
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Close
            </Button>
            <Button
              size="sm"
              onClick={handleAddNote}
              disabled={!newNote.trim() || addNote.isPending}
            >
              Add Note
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
