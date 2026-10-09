import { Button, Input, Label } from "@geolibre/ui";
import { useState } from "react";

/** Coordinate entry is an alternative to placing an ignition on the native map. */
export function ScenarioIgnitionCoordinates({ disabled, onAdd }: {
  disabled: boolean;
  onAdd: (latitude: number, longitude: number) => void;
}) {
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [error, setError] = useState<string | null>(null);
  const add = () => {
    const lat = Number(latitude);
    const lon = Number(longitude);
    if (!latitude.trim() || !longitude.trim() || !Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
      setError("Enter a valid WGS84 latitude and longitude.");
      return;
    }
    onAdd(lat, lon);
    setError(null);
  };
  return <div className="space-y-2">
    <div className="grid grid-cols-2 gap-2">
      <div className="space-y-1"><Label htmlFor="manual-ignition-lat">Latitude</Label><Input aria-label="Ignition latitude" id="manual-ignition-lat" disabled={disabled} value={latitude} onChange={(event) => setLatitude(event.target.value)} placeholder="Latitude" type="number" step="any" /></div>
      <div className="space-y-1"><Label htmlFor="manual-ignition-lon">Longitude</Label><Input aria-label="Ignition longitude" id="manual-ignition-lon" disabled={disabled} value={longitude} onChange={(event) => setLongitude(event.target.value)} placeholder="Longitude" type="number" step="any" /></div>
    </div>
    {error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}
    <Button variant="outline" disabled={disabled} onClick={add}>Add coordinates</Button>
  </div>;
}
