import { NextResponse } from "next/server";
import { oracleAnswer, pushOracleMessage } from "@/lib/oracle";
import { getStore, updateStore } from "@/lib/store";

export async function GET() {
  const store = await getStore();
  return NextResponse.json({ messages: store.oracleMessages });
}

export async function POST(request: Request) {
  const body = await request.json();
  const question = String(body.question ?? "").trim();
  if (!question) {
    return NextResponse.json({ error: "question required" }, { status: 400 });
  }

  const store = await getStore();
  const reply = await oracleAnswer(store, question);

  await updateStore((s) => {
    pushOracleMessage(s, "user", question);
    pushOracleMessage(s, "assistant", reply.content, reply.contextUsed);
  });

  const updated = await getStore();
  return NextResponse.json({
    reply: reply.content,
    contextUsed: reply.contextUsed,
    messages: updated.oracleMessages.slice(-20),
  });
}
