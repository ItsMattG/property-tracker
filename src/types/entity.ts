export type EntityType = "personal" | "trust" | "smsf" | "company";

export interface Entity {
  id: string;
  userId: string;
  type: EntityType;
  name: string;
  abn: string | null;
  tfn: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TrustDetails {
  id: string;
  entityId: string;
  trusteeType: "individual" | "corporate";
  trusteeName: string;
  settlementDate: string | null;
  trustDeedDate: string | null;
}

export interface SmsfDetails {
  id: string;
  entityId: string;
  fundName: string;
  fundAbn: string | null;
  establishmentDate: string | null;
  auditorName: string | null;
  auditorContact: string | null;
}

export interface EntityMember {
  id: string;
  entityId: string;
  userId: string;
  role: "owner" | "admin" | "member" | "accountant";
  invitedBy: string | null;
  invitedAt: Date;
  joinedAt: Date | null;
}

export type EntityWithDetails = Entity & {
  trustDetails?: TrustDetails | null;
  smsfDetails?: SmsfDetails | null;
};
