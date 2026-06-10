import { StatusBar } from "expo-status-bar";
import { SafeAreaView, StyleSheet, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ChoiceOnboarding } from "./src/components/ChoiceOnboarding";

export default function App() {
  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="light" />
        <View style={styles.backgroundOrbTop} />
        <View style={styles.backgroundOrbCenter} />
        <View style={styles.backgroundOrbBottom} />
        <ChoiceOnboarding />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#0f0b0d",
  },
  backgroundOrbTop: {
    position: "absolute",
    top: -110,
    right: -30,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: "rgba(66, 212, 255, 0.18)",
  },
  backgroundOrbBottom: {
    position: "absolute",
    bottom: -150,
    left: -54,
    width: 330,
    height: 330,
    borderRadius: 165,
    backgroundColor: "rgba(255, 66, 124, 0.20)",
  },
  backgroundOrbCenter: {
    position: "absolute",
    top: "30%",
    left: "34%",
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: "rgba(214, 92, 255, 0.12)",
  },
});
