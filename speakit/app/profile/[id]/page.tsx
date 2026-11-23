import { notFound } from "next/navigation";
import { PublicProfileView } from "../../../components/profile/PublicProfileView";
import { getPublicPlayerProfile } from "../../../lib/public-profile";

export const dynamic = "force-dynamic";

export default async function PublicProfilePage({
  params,
}: {
  params: { id: string };
}) {
  const profile = await getPublicPlayerProfile(params.id);
  if (!profile) {
    notFound();
  }

  return <PublicProfileView profile={profile} />;
}
