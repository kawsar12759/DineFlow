import mongoose, { Schema, type Model } from "mongoose";

/** Named sequences, e.g. invoice numbers, incremented atomically. */
interface ICounter {
  _id: string;
  value: number;
}

const CounterSchema = new Schema<ICounter>({
  _id: { type: String, required: true },
  value: { type: Number, default: 0 },
});

export const Counter: Model<ICounter> =
  mongoose.models.Counter || mongoose.model<ICounter>("Counter", CounterSchema);

/** The next number in a sequence, starting at 1. */
export async function nextSequence(name: string) {
  const counter = await Counter.findOneAndUpdate(
    { _id: name },
    { $inc: { value: 1 } },
    { new: true, upsert: true }
  ).lean();
  return counter!.value;
}
