export type MeshHealth = {
  ok: boolean;
  serviceMode: string;
};

export type MeshMessage = {
  id: string;
  sender: string;
  senderPeerID?: string;
  content: string;
  timestamp: string;
  isPrivate: boolean;
  direction: "inbound" | "outbound";
};

export type MeshPeer = {
  peerID: string;
  nickname: string;
  isConnected: boolean;
  isReachable: boolean;
};

export type MeshState = {
  nickname: string;
  peerID: string;
  bluetoothState: string;
  peers: MeshPeer[];
  recentMessages: MeshMessage[];
};
