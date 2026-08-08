import { Link, Stack } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { typeStyle } from "@/constants/typography";
import { useMd } from "@/theme/useMd";

export default function NotFoundScreen() {
  const md = useMd();

  return (
    <>
      <Stack.Screen options={{ title: "Oops!" }} />
      <View style={[styles.container, { backgroundColor: md.surface }]}>
        <Text style={[styles.title, { color: md.onSurface }]}>
          This screen doesn&apos;t exist.
        </Text>

        <Link href="/" style={styles.link}>
          <Text style={[styles.linkText, { color: md.primary }]}>
            Go to home screen!
          </Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  title: {
    ...typeStyle("titleLarge"),
    fontFamily: "Inter_700Bold",
  },
  link: {
    marginTop: 15,
    paddingVertical: 15,
  },
  linkText: {
    ...typeStyle("bodyMedium"),
  },
});
