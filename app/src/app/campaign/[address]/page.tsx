"use client";

import { use } from "react";
import { OpenOnLoad } from "@/components/os/OS";

export default function CampaignPage({ params }: { params: Promise<{ address: string }> }) {
  const { address } = use(params);
  return <OpenOnLoad kind="campaign" param={address} />;
}
