export type Mt5AccountType = "broker" | "prop_firm";

export type Mt5Broker = {
  id: string;
  name: string;
  accountType: Mt5AccountType;
  servers: readonly string[];
};

export const MT5_BROKERS: readonly Mt5Broker[] = [
  {
    id: "exness",
    name: "Exness",
    accountType: "broker",
    servers: [
      "Exness-MT5Real",
      "Exness-MT5Real2",
      "Exness-MT5Real3",
      "Exness-MT5Real4",
      "Exness-MT5Real5",
      "Exness-MT5Real6",
      "Exness-MT5Real7",
      "Exness-MT5Real8",
      "Exness-MT5Real9",
      "Exness-MT5Real10",
      "Exness-MT5Real11",
      "Exness-MT5Real12",
      "Exness-MT5Real14",
      "Exness-MT5Real15",
      "Exness-MT5Real16",
      "Exness-MT5Real17",
      "Exness-MT5Real18",
      "Exness-MT5Real19",
      "Exness-MT5Real20",
      "Exness-MT5Real21",
      "Exness-MT5Real22",
      "Exness-MT5Real23",
      "Exness-MT5Real24",
      "Exness-MT5Real25",
      "Exness-MT5Real26",
      "Exness-MT5Real27",
      "Exness-MT5Real28",
      "Exness-MT5Real29",
      "Exness-MT5Real30",
      "Exness-MT5Real31",
      "Exness-MT5Real32",
      "Exness-MT5Real33",
      "Exness-MT5Real34",
      "Exness-MT5Real35",
      "Exness-MT5Real36",
      "Exness-MT5Real37",
      "Exness-MT5Real38",
      "Exness-MT5Real39",
      "Exness-MT5Real40",
      "Exness-MT5Real41",
      "Exness-MT5Real42",
      "Exness-MT5Real43",
      "Exness-MT5Real46",
      "Exness-MT5Real51",
      "Exness-MT5Trial",
      "Exness-MT5Trial2",
      "Exness-MT5Trial3",
      "Exness-MT5Trial4",
      "Exness-MT5Trial5",
      "Exness-MT5Trial6",
      "Exness-MT5Trial7",
      "Exness-MT5Trial8",
      "Exness-MT5Trial9",
      "Exness-MT5Trial10",
      "Exness-MT5Trial11",
      "Exness-MT5Trial12",
      "Exness-MT5Trial14",
      "Exness-MT5Trial15",
      "Exness-MT5Trial16",
      "Exness-MT5Trial17",
    ],
  },
  {
    id: "fbs",
    name: "FBS",
    accountType: "broker",
    servers: ["FBS-Real", "FBS-Demo"],
  },
  {
    id: "fundednext",
    name: "FundedNext",
    accountType: "prop_firm",
    servers: [
      "FundedNext-Server",
      "FundedNext-Server 2",
      "FundedNext-Server 3",
    ],
  },
] as const;

export function getMt5Broker(brokerId: unknown) {
  const normalized = String(brokerId ?? "").trim().toLowerCase();
  return MT5_BROKERS.find((broker) => broker.id === normalized) ?? null;
}

export function getMt5BrokerByServer(server: unknown) {
  const normalized = String(server ?? "").trim().toLowerCase();
  return (
    MT5_BROKERS.find((broker) =>
      broker.servers.some((item) => item.toLowerCase() === normalized),
    ) ?? null
  );
}

export function isMt5BrokerServer(brokerId: unknown, server: unknown) {
  const broker = getMt5Broker(brokerId);
  const normalizedServer = String(server ?? "").trim().toLowerCase();
  return Boolean(
    broker?.servers.some((item) => item.toLowerCase() === normalizedServer),
  );
}

export function isMt5AccountType(value: unknown): value is Mt5AccountType {
  return value === "broker" || value === "prop_firm";
}