import TeamDetailInner from "./TeamDetailInner";

export function generateStaticParams() {
  return [] as Array<{ school: string }>;
}

export default function TeamDetailPage() {
  return <TeamDetailInner />;
}
