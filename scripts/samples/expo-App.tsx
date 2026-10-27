import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { theme } from "./src/theme";

interface Task {
  id: string;
  title: string;
  done: boolean;
}

export default function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState("");

  function addTask() {
    if (!title.trim()) return;
    setTasks([{ id: String(Date.now()), title: title.trim(), done: false }, ...tasks]);
    setTitle("");
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>کارهای من</Text>
      <View style={styles.row}>
        <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="کار جدید…" />
        <Pressable style={styles.button} onPress={addTask}>
          <Text style={styles.buttonText}>افزودن</Text>
        </Pressable>
      </View>
      <FlatList
        data={tasks}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Pressable
            style={styles.item}
            onPress={() => setTasks(tasks.map((t) => (t.id === item.id ? { ...t, done: !t.done } : t)))}
          >
            <Text style={[styles.text, item.done && styles.done]}>{item.title}</Text>
          </Pressable>
        )}
      />
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc", paddingTop: 56, paddingHorizontal: 16 },
  title: { fontSize: 24, fontWeight: "700", color: theme.primary, textAlign: "right", marginBottom: 16 },
  row: { flexDirection: "row-reverse", gap: 8, marginBottom: 16 },
  input: { flex: 1, borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 12, padding: 12, textAlign: "right" },
  button: { backgroundColor: theme.primary, borderRadius: 12, paddingHorizontal: 16, justifyContent: "center" },
  buttonText: { color: "#fff", fontWeight: "600" },
  item: { backgroundColor: "#fff", borderRadius: 12, padding: 14, marginBottom: 8 },
  text: { textAlign: "right", writingDirection: "rtl", fontSize: 16 },
  done: { color: "#94a3b8", textDecorationLine: "line-through" },
});
