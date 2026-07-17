import { NodeDetail } from "@/components/node/NodeDetail";

export default async function NodePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <NodeDetail id={id} />;
}
