import { SCENARIOS } from "../../../data/scenarios";
import PracticeClient from "./PracticeClient";

export function generateStaticParams() {
  return SCENARIOS.map((s) => ({ scenario: s.id }));
}

export default function PracticePage() {
  return <PracticeClient />;
}
