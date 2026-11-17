import type { ReactNode } from "react";
import { ArenaLeaveGuardHost } from "../../components/arena/ArenaLeaveGuardHost";

export default function ArenaLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <ArenaLeaveGuardHost />
    </>
  );
}
