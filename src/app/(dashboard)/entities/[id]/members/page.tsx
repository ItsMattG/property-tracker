"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, User } from "lucide-react";
import { EntityTasksSection } from "@/components/tasks/EntityTasksSection";

export default function MembersPage() {
  const params = useParams();
  const entityId = params?.id as string;
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    dateOfBirth: "",
    memberSince: "",
    phase: "accumulation" as "accumulation" | "pension",
    currentBalance: "",
  });

  const { data: entity, isLoading: entityLoading } = trpc.entity.get.useQuery({ entityId });
  const { data: members, isLoading, refetch } = trpc.smsfCompliance.getMembers.useQuery(
    { entityId },
    { enabled: entity?.type === "smsf" }
  );

  const addMember = trpc.smsfCompliance.addMember.useMutation({
    onSuccess: () => {
      refetch();
      setIsOpen(false);
      setFormData({
        name: "",
        dateOfBirth: "",
        memberSince: "",
        phase: "accumulation",
        currentBalance: "",
      });
    },
  });

  if (entityLoading || isLoading) {
    return <Skeleton className="h-96" />;
  }

  if (!entity || entity.type !== "smsf") {
    return (
      <Card>
        <CardContent className="py-6 text-center text-muted-foreground">
          Member management is only available for SMSF entities.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">SMSF Members</h1>
          <p className="text-muted-foreground">{entity.name}</p>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Member
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add SMSF Member</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="dob">Date of Birth</Label>
                <Input
                  id="dob"
                  type="date"
                  value={formData.dateOfBirth}
                  onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="memberSince">Member Since</Label>
                <Input
                  id="memberSince"
                  type="date"
                  value={formData.memberSince}
                  onChange={(e) => setFormData({ ...formData, memberSince: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="phase">Phase</Label>
                <Select
                  value={formData.phase}
                  onValueChange={(v) => setFormData({ ...formData, phase: v as "accumulation" | "pension" })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="accumulation">Accumulation</SelectItem>
                    <SelectItem value="pension">Pension</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="balance">Current Balance</Label>
                <Input
                  id="balance"
                  type="number"
                  value={formData.currentBalance}
                  onChange={(e) => setFormData({ ...formData, currentBalance: e.target.value })}
                />
              </div>
              <Button
                onClick={() => addMember.mutate({
                  entityId,
                  ...formData,
                  currentBalance: parseFloat(formData.currentBalance) || 0,
                })}
                disabled={!formData.name || !formData.dateOfBirth || addMember.isPending}
                className="w-full"
              >
                {addMember.isPending ? "Adding..." : "Add Member"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {members?.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <User className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No members added yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {members?.map((member) => (
            <Card key={member.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <CardTitle>{member.name}</CardTitle>
                  <Badge variant={member.phase === "pension" ? "default" : "secondary"}>
                    {member.phase}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-1 text-sm">
                  <p>DOB: {member.dateOfBirth}</p>
                  <p>Member since: {member.memberSince}</p>
                  <p className="font-medium">Balance: ${parseFloat(member.currentBalance).toLocaleString()}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <EntityTasksSection entityId={entityId} />
    </div>
  );
}
