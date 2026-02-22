import { ScrollView, View, Text, RefreshControl } from "react-native";
import { useState, useCallback } from "react";
import { trpc } from "../../../lib/trpc";
import { Card } from "../../../components/ui/Card";
import { Badge } from "../../../components/ui/Badge";
import { LoadingScreen } from "../../../components/ui/LoadingScreen";
import { formatCurrency, formatPercent, cn } from "../../../lib/utils";

function ScoreCircle({ score }: { score: number }) {
  const color = score >= 80 ? "text-success" : score >= 60 ? "text-warning" : "text-destructive";
  return (
    <View className="w-14 h-14 rounded-full border-4 border-gray-200 items-center justify-center">
      <Text className={cn("text-lg font-bold", color)}>{score}</Text>
    </View>
  );
}

export default function ScorecardScreen() {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.performanceBenchmarking.getPortfolioScorecard.useQuery();

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await utils.performanceBenchmarking.getPortfolioScorecard.invalidate();
    setRefreshing(false);
  }, [utils]);

  if (isLoading) return <LoadingScreen />;

  const properties = data?.properties ?? [];

  return (
    <ScrollView
      className="flex-1 bg-gray-50"
      contentContainerStyle={{ padding: 16, gap: 12 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {data?.overallScore !== undefined && (
        <Card className="items-center py-6">
          <Text className="text-xs text-gray-500 mb-2">Portfolio Score</Text>
          <ScoreCircle score={data.overallScore} />
        </Card>
      )}

      {properties.map((prop: any) => (
        <Card key={prop.id}>
          <View className="flex-row items-center justify-between mb-2">
            <View className="flex-1 mr-3">
              <Text className="text-sm font-semibold text-gray-900" numberOfLines={1}>{prop.address}</Text>
              <Text className="text-xs text-gray-500">{prop.suburb}, {prop.state}</Text>
            </View>
            <ScoreCircle score={prop.score ?? 0} />
          </View>
          <View className="flex-row flex-wrap gap-1 mt-2">
            {prop.yieldScore !== undefined && (
              <Badge variant={prop.yieldScore >= 70 ? "success" : "warning"}>
                Yield: {prop.yieldScore}
              </Badge>
            )}
            {prop.growthScore !== undefined && (
              <Badge variant={prop.growthScore >= 70 ? "success" : "warning"}>
                Growth: {prop.growthScore}
              </Badge>
            )}
            {prop.cashFlowScore !== undefined && (
              <Badge variant={prop.cashFlowScore >= 70 ? "success" : "warning"}>
                Cash Flow: {prop.cashFlowScore}
              </Badge>
            )}
          </View>
        </Card>
      ))}

      {properties.length === 0 && (
        <View className="items-center py-12">
          <Text className="text-gray-500">Add properties to see performance scores</Text>
        </View>
      )}
    </ScrollView>
  );
}
