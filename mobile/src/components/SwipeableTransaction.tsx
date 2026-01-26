import React from "react";
import { View, Text, Animated, StyleSheet } from "react-native";
import { RectButton } from "react-native-gesture-handler";
import Swipeable from "react-native-gesture-handler/Swipeable";

interface Transaction {
  id: string;
  description: string;
  amount: string;
  date: string;
  suggestedCategory: string | null;
  suggestionConfidence: string | null;
}

interface Props {
  testID?: string;
  transaction: Transaction;
  onAccept: () => void;
  onReject: () => void;
}

export function SwipeableTransaction({ testID, transaction, onAccept, onReject }: Props) {
  function renderLeftActions(
    _progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>
  ) {
    const scale = dragX.interpolate({
      inputRange: [0, 100],
      outputRange: [0, 1],
      extrapolate: "clamp",
    });

    return (
      <RectButton style={styles.leftAction} onPress={onAccept}>
        <Animated.Text style={[styles.actionText, { transform: [{ scale }] }]}>
          Accept
        </Animated.Text>
      </RectButton>
    );
  }

  function renderRightActions(
    _progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>
  ) {
    const scale = dragX.interpolate({
      inputRange: [-100, 0],
      outputRange: [1, 0],
      extrapolate: "clamp",
    });

    return (
      <RectButton style={styles.rightAction} onPress={onReject}>
        <Animated.Text style={[styles.actionText, { transform: [{ scale }] }]}>
          Personal
        </Animated.Text>
      </RectButton>
    );
  }

  const amount = parseFloat(transaction.amount);
  const isIncome = amount > 0;

  return (
    <Swipeable
      testID={testID}
      renderLeftActions={renderLeftActions}
      renderRightActions={renderRightActions}
      onSwipeableOpen={(direction) => {
        if (direction === "left") onAccept();
        if (direction === "right") onReject();
      }}
    >
      <View testID={testID ? `${testID}-content` : undefined} className="bg-white p-4 border-b border-gray-100">
        <View className="flex-row justify-between items-start">
          <View className="flex-1 mr-4">
            <Text testID={testID ? `${testID}-description` : undefined} className="font-medium" numberOfLines={1}>
              {transaction.description}
            </Text>
            <Text testID={testID ? `${testID}-date` : undefined} className="text-gray-500 text-sm mt-1">
              {transaction.date}
            </Text>
            {transaction.suggestedCategory && (
              <View className="flex-row items-center mt-2">
                <View testID={testID ? `${testID}-category` : undefined} className="bg-blue-100 rounded-full px-2 py-0.5">
                  <Text className="text-blue-700 text-xs">
                    {transaction.suggestedCategory.replace(/_/g, " ")}
                  </Text>
                </View>
                {transaction.suggestionConfidence && (
                  <Text testID={testID ? `${testID}-confidence` : undefined} className="text-gray-400 text-xs ml-2">
                    {Math.round(parseFloat(transaction.suggestionConfidence))}%
                  </Text>
                )}
              </View>
            )}
          </View>
          <Text
            testID={testID ? `${testID}-amount` : undefined}
            className={`font-semibold ${
              isIncome ? "text-green-600" : "text-gray-900"
            }`}
          >
            {isIncome ? "+" : ""}${Math.abs(amount).toFixed(2)}
          </Text>
        </View>
      </View>
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  leftAction: {
    backgroundColor: "#22c55e",
    justifyContent: "center",
    alignItems: "flex-start",
    paddingLeft: 20,
    flex: 1,
  },
  rightAction: {
    backgroundColor: "#6b7280",
    justifyContent: "center",
    alignItems: "flex-end",
    paddingRight: 20,
    flex: 1,
  },
  actionText: {
    color: "white",
    fontWeight: "600",
    fontSize: 14,
  },
});
