import TeamRobotDetailInner from "./TeamRobotDetailInner";

export function generateStaticParams() {
  return [] as Array<{ school: string; robotType: string }>;
}

export default function TeamRobotPage() {
  return <TeamRobotDetailInner />;
}
