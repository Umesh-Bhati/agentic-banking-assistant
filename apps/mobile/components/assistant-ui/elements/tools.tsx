import { View } from "react-native";
import { makeAssistantToolUI } from "@assistant-ui/react-native";
import { StatementCard } from "../../../features/statements/components/StatementCard";

export const StatementCardToolUI = makeAssistantToolUI({
  toolName: "StatementCard",
  render: ({ args }) => {
    return (
      <View style={{ marginVertical: 8 }}>
        <StatementCard data={args as any} />
      </View>
    );
  },
});
