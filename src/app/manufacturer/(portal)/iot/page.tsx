import {
  CONNECTED_UNITS,
  FIRMWARE_VERSIONS,
  iotStats,
  topAlerts,
  fleetHealthByModel,
  type ConnectedUnitStatus,
} from "@/lib/manufacturer/mock-data";
import IoTClient from "./IoTClient";

export default async function IoTPage() {
  const stats = iotStats();
  const alerts = topAlerts(12);
  const fleetByModel = fleetHealthByModel();

  const statusCounts: Record<ConnectedUnitStatus, number> = {
    online: 0, offline: 0, degraded: 0, maintenance: 0, never_connected: 0,
  };
  for (const u of CONNECTED_UNITS) statusCounts[u.status]++;

  return (
    <IoTClient
      units={CONNECTED_UNITS}
      stats={stats}
      topAlerts={alerts}
      firmwareVersions={FIRMWARE_VERSIONS}
      fleetByModel={fleetByModel}
      statusCounts={statusCounts}
    />
  );
}
