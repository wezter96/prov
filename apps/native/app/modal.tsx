import { Text, View, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";

import { Container } from "@/components/container";
import { NAV_THEME } from "@/lib/constants";
import { useColorScheme } from "@/lib/use-color-scheme";

export default function Modal() {
  const { colorScheme } = useColorScheme();
  const theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light;
  const router = useRouter();

  return (
    <Container>
      <View testID="modal-content" style={styles.container}>
        <View testID="modal-header" style={styles.header}>
          <Text testID="modal-title" style={[styles.title, { color: theme.text }]}>
            Modal
          </Text>
          <Text testID="modal-description" style={[styles.description, { color: theme.text }]}>
            This is a modal presented over the current screen. It demonstrates overlay navigation
            with stable selectors for test automation.
          </Text>
        </View>

        <Pressable
          testID="modal-dismiss-button"
          accessibilityLabel="Dismiss modal"
          accessibilityRole="button"
          onPress={() => router.back()}
          style={[styles.dismissButton, { backgroundColor: theme.primary }]}
        >
          <Text style={styles.dismissText}>Dismiss</Text>
        </Pressable>
      </View>
    </Container>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
  },
  dismissButton: {
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  dismissText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
});
