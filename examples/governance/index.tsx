import { WalletFaceAvatar } from "../../packages/sdk/src/react";
export function ProposalAuthor({
  address,
  title,
  apiUrl = "",
}: {
  address: string;
  title: string;
  apiUrl?: string;
}) {
  return (
    <article className="person">
      <WalletFaceAvatar address={address} baseUrl={apiUrl} />
      <div>
        <strong>{title}</strong>
        <p>Author: {address}</p>
      </div>
    </article>
  );
}
