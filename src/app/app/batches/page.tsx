"use client";

import {CycleWorkspace} from "@/components/flocks/cycle-workspace";

// Retain the old address as a safe entry point; the database also retires
// automatic branch replacement independently of the Today rollout flag.
export default function BatchesPage() {
  return <CycleWorkspace/>;
}
