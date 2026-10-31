import { WalletFaceAvatar } from "../../packages/sdk/src/react";
export function DaoDirectory({
  addresses,
  apiUrl = "",
}: {
  addresses: string[];
  apiUrl?: string;
}) {
  return (
    <ul>
      {addresses.map((address) => (
        <li className="person" key={address}>
          <WalletFaceAvatar address={address} baseUrl={apiUrl} />
          <a href={"/u/" + address}>{address}</a>
        </li>
      ))}
    </ul>
  );
}
