import { useMemo, useRef, useState } from "react";
import { MapPin } from "lucide-react";

const TILE_SIZE = 256;
const DEFAULT_LAT = 13.7563;
const DEFAULT_LNG = 100.5018;
const DEFAULT_ZOOM = 16;

type MapPinPickerProps = {
  latitude?: string | number | null;
  longitude?: string | number | null;
  onChange: (latitude: string, longitude: string) => void;
  heightClass?: string;
};

type Point = { x: number; y: number };

const toNumber = (value?: string | number | null) => {
  if (value === null || value === undefined || value === "") return null;
  const next = Number(value);
  return Number.isFinite(next) ? next : null;
};

const clampLatitude = (lat: number) => Math.max(-85.05112878, Math.min(85.05112878, lat));

const normalizeLongitude = (lng: number) => {
  let next = lng;
  while (next > 180) next -= 360;
  while (next < -180) next += 360;
  return next;
};

const latLngToWorldPixel = (lat: number, lng: number, zoom: number): Point => {
  const scale = TILE_SIZE * 2 ** zoom;
  const sinLat = Math.sin((clampLatitude(lat) * Math.PI) / 180);
  return {
    x: ((normalizeLongitude(lng) + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale,
  };
};

const worldPixelToLatLng = (point: Point, zoom: number) => {
  const scale = TILE_SIZE * 2 ** zoom;
  const lng = normalizeLongitude((point.x / scale) * 360 - 180);
  const n = Math.PI - (2 * Math.PI * point.y) / scale;
  const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  return { latitude: clampLatitude(lat), longitude: lng };
};

export default function MapPinPicker({
  latitude,
  longitude,
  onChange,
  heightClass = "h-56",
}: MapPinPickerProps) {
  const lat = toNumber(latitude) ?? DEFAULT_LAT;
  const lng = toNumber(longitude) ?? DEFAULT_LNG;
  const zoom = DEFAULT_ZOOM;
  const centerPixel = useMemo(() => latLngToWorldPixel(lat, lng, zoom), [lat, lng, zoom]);
  const dragRef = useRef<{ start: Point; center: Point } | null>(null);
  const [dragging, setDragging] = useState(false);

  const tiles = useMemo(() => {
    const centerTileX = Math.floor(centerPixel.x / TILE_SIZE);
    const centerTileY = Math.floor(centerPixel.y / TILE_SIZE);
    const maxTile = 2 ** zoom;
    const list: Array<{ key: string; src: string; left: number; top: number }> = [];

    for (let xOffset = -2; xOffset <= 2; xOffset += 1) {
      for (let yOffset = -2; yOffset <= 2; yOffset += 1) {
        const tileX = centerTileX + xOffset;
        const tileY = centerTileY + yOffset;
        if (tileY < 0 || tileY >= maxTile) continue;
        const wrappedX = ((tileX % maxTile) + maxTile) % maxTile;
        list.push({
          key: `${wrappedX}-${tileY}`,
          src: `https://tile.openstreetmap.org/${zoom}/${wrappedX}/${tileY}.png`,
          left: tileX * TILE_SIZE - centerPixel.x,
          top: tileY * TILE_SIZE - centerPixel.y,
        });
      }
    }
    return list;
  }, [centerPixel.x, centerPixel.y, zoom]);

  const setFromPoint = (point: Point) => {
    const next = worldPixelToLatLng(point, zoom);
    onChange(next.latitude.toFixed(7), next.longitude.toFixed(7));
  };


  return (
    <div className="space-y-2">
      <div
        className={`relative overflow-hidden rounded-lg border border-gray-200 bg-gray-200 touch-none select-none dark:border-gray-700 dark:bg-gray-900 ${heightClass}`}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          dragRef.current = { start: { x: event.clientX, y: event.clientY }, center: centerPixel };
          setDragging(true);
        }}
        onPointerMove={(event) => {
          if (!dragRef.current) return;
          const dx = event.clientX - dragRef.current.start.x;
          const dy = event.clientY - dragRef.current.start.y;
          setFromPoint({ x: dragRef.current.center.x - dx, y: dragRef.current.center.y - dy });
        }}
        onPointerUp={() => {
          dragRef.current = null;
          setDragging(false);
        }}
        onPointerCancel={() => {
          dragRef.current = null;
          setDragging(false);
        }}
      >
        <div className="absolute left-1/2 top-1/2 h-0 w-0">
          {tiles.map((tile) => (
            <img
              key={tile.key}
              alt=""
              draggable={false}
              src={tile.src}
              className="absolute max-w-none"
              style={{ width: TILE_SIZE, height: TILE_SIZE, left: tile.left, top: tile.top }}
            />
          ))}
        </div>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/10" />
        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full">
          <div className="rounded-full bg-primary-500 p-2 text-white shadow-lg shadow-black/30">
            <MapPin size={22} fill="currentColor" />
          </div>
        </div>
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-primary-500 shadow" />
        <div className="absolute bottom-2 left-2 right-2 flex items-center justify-start gap-2">
          <span className="rounded-full bg-white/95 px-3 py-1 text-xs font-medium text-gray-700 shadow dark:bg-gray-950/90 dark:text-gray-200">
            {dragging ? "Drag the map until the pin is on the delivery point" : "Drag map to set delivery pin"}
          </span>
        </div>
      </div>
      <p className="text-xs text-gray-500">The center pin is saved as this location.</p>
    </div>
  );
}

