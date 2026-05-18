import AsyncStorage from "@react-native-async-storage/async-storage";

import type {
  Checklist,
  ChecklistWithTasks,
  ShiftWithCompletions,
} from "@workspace/api-client-react";

const KEY_LIST = "@end_shift_v4_cl_list";

export class ChecklistCache {
  readonly id: number;

  constructor(id: number) {
    this.id = id;
  }

  private get clKey() {
    return `@end_shift_v4_cl_data_${this.id}`;
  }

  private get shiftKey() {
    return `@end_shift_v4_shift_data_${this.id}`;
  }

  private get historyKey() {
    return `@end_shift_v4_history_${this.id}`;
  }

  async load(): Promise<{
    checklist: ChecklistWithTasks | null;
    shift: ShiftWithCompletions | null;
    history: ShiftWithCompletions[];
  }> {
    const [[, clRaw], [, shiftRaw], [, histRaw]] = await AsyncStorage.multiGet([
      this.clKey,
      this.shiftKey,
      this.historyKey,
    ]);
    let checklist: ChecklistWithTasks | null = null;
    let shift: ShiftWithCompletions | null = null;
    let history: ShiftWithCompletions[] = [];
    try { if (clRaw) checklist = JSON.parse(clRaw); } catch {}
    try { if (shiftRaw) shift = JSON.parse(shiftRaw); } catch {}
    try { if (histRaw) history = JSON.parse(histRaw); } catch {}
    return { checklist, shift, history };
  }

  async saveChecklist(cl: ChecklistWithTasks): Promise<void> {
    await AsyncStorage.setItem(this.clKey, JSON.stringify(cl));
  }

  async saveShift(shift: ShiftWithCompletions): Promise<void> {
    await AsyncStorage.setItem(this.shiftKey, JSON.stringify(shift));
  }

  async saveHistory(history: ShiftWithCompletions[]): Promise<void> {
    await AsyncStorage.setItem(this.historyKey, JSON.stringify(history));
  }

  async clearShift(): Promise<void> {
    await AsyncStorage.removeItem(this.shiftKey);
  }

  async clear(): Promise<void> {
    await AsyncStorage.multiRemove([this.clKey, this.shiftKey, this.historyKey]);
  }

  static async loadList(): Promise<Checklist[] | null> {
    const raw = await AsyncStorage.getItem(KEY_LIST);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  }

  static async saveList(list: Checklist[]): Promise<void> {
    await AsyncStorage.setItem(KEY_LIST, JSON.stringify(list));
  }

  static async clearAllByIds(ids: number[]): Promise<void> {
    const keys = [
      KEY_LIST,
      ...ids.flatMap((id) => [
        `@end_shift_v4_cl_data_${id}`,
        `@end_shift_v4_shift_data_${id}`,
        `@end_shift_v4_history_${id}`,
      ]),
    ];
    if (keys.length) await AsyncStorage.multiRemove(keys);
  }
}
