import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { FileText, TrendingUp, Award, Calculator, Settings, ChevronRight } from "lucide-react-native";

interface MenuItem {
  icon: React.ReactNode;
  label: string;
  description: string;
  route: string;
}

function MenuSection({ title, items }: { title: string; items: MenuItem[] }) {
  const router = useRouter();
  return (
    <View className="mb-6">
      <Text className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 px-4">{title}</Text>
      <View className="bg-white rounded-xl overflow-hidden border border-gray-100">
        {items.map((item, i) => (
          <TouchableOpacity
            key={item.route}
            onPress={() => router.push(item.route as any)}
            className={`flex-row items-center p-4 ${i > 0 ? "border-t border-gray-100" : ""}`}
          >
            <View className="w-9 h-9 rounded-lg bg-gray-100 items-center justify-center mr-3">
              {item.icon}
            </View>
            <View className="flex-1">
              <Text className="text-sm font-semibold text-gray-900">{item.label}</Text>
              <Text className="text-xs text-gray-500">{item.description}</Text>
            </View>
            <ChevronRight size={16} color="#9ca3af" />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

export default function MoreScreen() {
  const reports: MenuItem[] = [
    { icon: <FileText size={18} color="#6b7280" />, label: "Tax Position", description: "Deductions and tax savings", route: "/(tabs)/more/tax-position" },
    { icon: <TrendingUp size={18} color="#6b7280" />, label: "Cash Flow", description: "Monthly income and expenses", route: "/(tabs)/more/cash-flow" },
    { icon: <Award size={18} color="#6b7280" />, label: "Property Scorecard", description: "Performance scores by property", route: "/(tabs)/more/scorecard" },
  ];

  const tools: MenuItem[] = [
    { icon: <Calculator size={18} color="#6b7280" />, label: "Borrowing Power", description: "Estimate your borrowing capacity", route: "/(tabs)/more/borrowing-power" },
  ];

  const settings: MenuItem[] = [
    { icon: <Settings size={18} color="#6b7280" />, label: "Settings", description: "Account, notifications, security", route: "/(tabs)/more/settings" },
  ];

  return (
    <ScrollView className="flex-1 bg-gray-50" contentContainerStyle={{ padding: 16, paddingTop: 24 }}>
      <MenuSection title="Reports" items={reports} />
      <MenuSection title="Tools" items={tools} />
      <MenuSection title="Account" items={settings} />
    </ScrollView>
  );
}
