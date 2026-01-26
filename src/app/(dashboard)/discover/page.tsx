"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, SlidersHorizontal } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { SimilarPropertyCard, AddListingModal } from "@/components/similar-properties";

const STATES = ["NSW", "VIC", "QLD", "SA", "WA", "TAS", "NT", "ACT"];
const PROPERTY_TYPES = ["house", "townhouse", "unit"] as const;

export default function DiscoverPage() {
  const [showAddModal, setShowAddModal] = useState(false);
  const [source, setSource] = useState<"portfolio" | "community" | "both">("both");
  const [filters, setFilters] = useState({
    states: [] as string[],
    priceMin: undefined as number | undefined,
    priceMax: undefined as number | undefined,
    propertyTypes: [] as typeof PROPERTY_TYPES[number][],
  });

  const { data: properties, isLoading, refetch } = trpc.similarProperties.discoverProperties.useQuery({
    source,
    filters: {
      states: filters.states.length > 0 ? filters.states : undefined,
      priceMin: filters.priceMin,
      priceMax: filters.priceMax,
      propertyTypes: filters.propertyTypes.length > 0 ? filters.propertyTypes : undefined,
    },
    limit: 20,
  });

  const { data: externalListings } = trpc.similarProperties.listExternalListings.useQuery();

  return (
    <div className="container mx-auto py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Discover Properties</h1>
          <p className="text-muted-foreground">
            Find similar properties from your portfolio and the community
          </p>
        </div>
        <Button onClick={() => setShowAddModal(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Listing
        </Button>
      </div>

      <div className="flex gap-6">
        {/* Filters Sidebar */}
        <Card className="w-64 h-fit shrink-0">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-sm">States</Label>
              <div className="space-y-2 mt-2">
                {STATES.map((state) => (
                  <div key={state} className="flex items-center space-x-2">
                    <Checkbox
                      id={state}
                      checked={filters.states.includes(state)}
                      onCheckedChange={(checked) => {
                        setFilters({
                          ...filters,
                          states: checked
                            ? [...filters.states, state]
                            : filters.states.filter((s) => s !== state),
                        });
                      }}
                    />
                    <Label htmlFor={state} className="text-sm font-normal">
                      {state}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-sm">Price Range</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <Input
                  type="number"
                  placeholder="Min"
                  value={filters.priceMin || ""}
                  onChange={(e) =>
                    setFilters({ ...filters, priceMin: Number(e.target.value) || undefined })
                  }
                />
                <Input
                  type="number"
                  placeholder="Max"
                  value={filters.priceMax || ""}
                  onChange={(e) =>
                    setFilters({ ...filters, priceMax: Number(e.target.value) || undefined })
                  }
                />
              </div>
            </div>

            <div>
              <Label className="text-sm">Property Type</Label>
              <div className="space-y-2 mt-2">
                {PROPERTY_TYPES.map((type) => (
                  <div key={type} className="flex items-center space-x-2">
                    <Checkbox
                      id={type}
                      checked={filters.propertyTypes.includes(type)}
                      onCheckedChange={(checked) => {
                        setFilters({
                          ...filters,
                          propertyTypes: checked
                            ? [...filters.propertyTypes, type]
                            : filters.propertyTypes.filter((t) => t !== type),
                        });
                      }}
                    />
                    <Label htmlFor={type} className="text-sm font-normal capitalize">
                      {type}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Content */}
        <div className="flex-1">
          <div className="flex items-center gap-4 mb-4">
            <Tabs value={source} onValueChange={(v) => setSource(v as typeof source)}>
              <TabsList>
                <TabsTrigger value="portfolio">My Portfolio</TabsTrigger>
                <TabsTrigger value="community">Community</TabsTrigger>
                <TabsTrigger value="both">Both</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* External Listings */}
          {externalListings && externalListings.length > 0 && (
            <div className="mb-6">
              <h2 className="text-lg font-semibold mb-3">Your Saved Listings</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {externalListings.map((listing) => (
                  <SimilarPropertyCard
                    key={listing.id}
                    property={{
                      id: listing.id,
                      type: "external",
                      suburb: listing.suburb,
                      state: listing.state,
                      propertyType: listing.propertyType as "house" | "townhouse" | "unit",
                      priceBracket: listing.price
                        ? `$${Number(listing.price).toLocaleString()}`
                        : "Unknown",
                      yield: listing.estimatedYield ? Number(listing.estimatedYield) : null,
                      growth: listing.estimatedGrowth ? Number(listing.estimatedGrowth) : null,
                      distance: 0,
                      similarityScore: 100,
                      isEstimated: listing.isEstimated,
                      externalListingId: listing.id,
                      sourceUrl: listing.sourceUrl || undefined,
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Discovery Results */}
          <div>
            <h2 className="text-lg font-semibold mb-3">Discover</h2>
            {isLoading ? (
              <div className="text-center py-12 text-muted-foreground">Loading...</div>
            ) : properties && properties.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {properties.map((property) => (
                  <Card key={property.id} className="p-4">
                    <div className="text-sm">
                      <span className="font-medium">
                        {property.suburb}, {property.state}
                      </span>
                      <span className="ml-2 text-muted-foreground capitalize">
                        {property.type}
                      </span>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                No properties found. Try adjusting your filters.
              </div>
            )}
          </div>
        </div>
      </div>

      <AddListingModal
        open={showAddModal}
        onOpenChange={setShowAddModal}
        onSuccess={() => refetch()}
      />
    </div>
  );
}
