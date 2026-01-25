"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, MoreVertical, Send, Pencil, Trash2, Users, FileText } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { BrokerModal } from "@/components/broker/BrokerModal";
import { GenerateLoanPackModal } from "@/components/loanPack/GenerateLoanPackModal";

export default function BrokerPortalPage() {
  const router = useRouter();
  const [showBrokerModal, setShowBrokerModal] = useState(false);
  const [editingBroker, setEditingBroker] = useState<{
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    company: string | null;
    notes: string | null;
  } | null>(null);
  const [deletingBrokerId, setDeletingBrokerId] = useState<string | null>(null);
  const [showPackModal, setShowPackModal] = useState(false);
  const [packBrokerId, setPackBrokerId] = useState<string | undefined>(undefined);

  const utils = trpc.useUtils();
  const { data: brokers, isLoading } = trpc.broker.list.useQuery();

  const deleteMutation = trpc.broker.delete.useMutation({
    onSuccess: () => {
      toast.success("Broker deleted");
      utils.broker.list.invalidate();
      setDeletingBrokerId(null);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete broker");
    },
  });

  const handleEdit = (broker: typeof editingBroker) => {
    setEditingBroker(broker);
    setShowBrokerModal(true);
  };

  const handleDelete = () => {
    if (deletingBrokerId) {
      deleteMutation.mutate({ id: deletingBrokerId });
    }
  };

  const handleSendPack = (brokerId: string) => {
    setPackBrokerId(brokerId);
    setShowPackModal(true);
  };

  const handleStandalonePack = () => {
    setPackBrokerId(undefined);
    setShowPackModal(true);
  };

  const handleModalClose = () => {
    setShowBrokerModal(false);
    setEditingBroker(null);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-72 mt-2" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Broker Portal</h2>
          <p className="text-muted-foreground">
            Manage your mortgage broker contacts and loan packs
          </p>
        </div>
        <Button onClick={() => setShowBrokerModal(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Broker
        </Button>
      </div>

      {!brokers || brokers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="rounded-full bg-muted p-4 mb-4">
              <Users className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No brokers yet</h3>
            <p className="text-muted-foreground text-center mb-6 max-w-md">
              Add your mortgage broker contacts to easily track loan packs you&apos;ve sent them.
            </p>
            <div className="flex gap-3">
              <Button onClick={() => setShowBrokerModal(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Your First Broker
              </Button>
              <Button variant="outline" onClick={handleStandalonePack}>
                <FileText className="w-4 h-4 mr-2" />
                Generate Standalone Pack
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {brokers.map((broker) => (
              <Card
                key={broker.id}
                className="cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => router.push(`/reports/brokers/${broker.id}`)}
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate">{broker.name}</h3>
                      {broker.company && (
                        <p className="text-sm text-muted-foreground truncate">
                          {broker.company}
                        </p>
                      )}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreVertical className="w-4 h-4" />
                          <span className="sr-only">Open menu</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(broker);
                          }}
                        >
                          <Pencil className="w-4 h-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeletingBrokerId(broker.id);
                          }}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="mt-4 space-y-1 text-sm text-muted-foreground">
                    <p>
                      {broker.packCount} {broker.packCount === 1 ? "pack" : "packs"} sent
                    </p>
                    {broker.lastPackAt && (
                      <p>Last: {format(new Date(broker.lastPackAt), "MMM d, yyyy")}</p>
                    )}
                  </div>

                  <Button
                    className="mt-4 w-full"
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSendPack(broker.id);
                    }}
                  >
                    <Send className="w-4 h-4 mr-2" />
                    Send Pack
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardContent className="flex items-center justify-between p-4">
              <p className="text-sm text-muted-foreground">
                Generate a loan pack without associating it with a broker
              </p>
              <Button variant="outline" size="sm" onClick={handleStandalonePack}>
                <FileText className="w-4 h-4 mr-2" />
                Generate Standalone Pack
              </Button>
            </CardContent>
          </Card>
        </>
      )}

      <BrokerModal
        open={showBrokerModal}
        onOpenChange={handleModalClose}
        broker={editingBroker}
      />

      <GenerateLoanPackModal
        open={showPackModal}
        onOpenChange={setShowPackModal}
        brokerId={packBrokerId}
      />

      <AlertDialog open={!!deletingBrokerId} onOpenChange={(open) => !open && setDeletingBrokerId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Broker</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove this broker contact. Any loan packs previously sent to them will remain accessible but will no longer be associated with this broker.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
