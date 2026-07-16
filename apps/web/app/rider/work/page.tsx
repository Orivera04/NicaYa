import { redirect } from "next/navigation";

// Kept only for old bookmarks. The operational workspace now lives at /rider.
export default function RiderWorkPage() { redirect("/rider"); }
