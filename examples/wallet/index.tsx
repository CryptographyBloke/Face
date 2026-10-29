import { useEffect, useState } from "react";
import { FaceClient, type Profile } from "../../packages/sdk/src/index";
import { WalletFaceAvatar } from "../../packages/sdk/src/react";
export function WalletAccount({
  address,
  apiUrl = "",
}: {
  address: string;
  apiUrl?: string;
}) {
  const [profile, setProfile] = useState<Profile>();
  useEffect(() => {
    let active = true;
    new FaceClient(apiUrl)
      .resolveProfile({ address })
      .then((p) => {
        if (active) setProfile(p);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [address, apiUrl]);
  return (
    <section className="person">
      <WalletFaceAvatar address={address} baseUrl={apiUrl} />
      <div>
        {profile?.profile.name || address}
        <p>Source: {profile?.avatar.source || "loading"}</p>
      </div>
    </section>
  );
}
