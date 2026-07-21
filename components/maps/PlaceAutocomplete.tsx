"use client";

import { useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  LoaderCircle,
  MapPin,
  Search,
} from "lucide-react";

export type SelectedPlace = {
  placeId: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
};

type PlaceAutocompleteProps = {
  label: string;
  placeholder: string;
  value: string;
  onTextChange: (value: string) => void;
  onPlaceSelect: (place: SelectedPlace) => void;
  resolvedExternally?: boolean;
};

type SearchResult = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  name?: string;
  type?: string;
};

export function PlaceAutocomplete({
  label,
  placeholder,
  value,
  onTextChange,
  onPlaceSelect,
  resolvedExternally = false,
}: PlaceAutocompleteProps) {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(false);
  const [error, setError] = useState("");
  const requestRef = useRef(0);

  useEffect(() => {
    const query = value.trim();

    if (
      selected ||
      resolvedExternally ||
      query.length < 3
    ) {
      setResults([]);
      setError("");
      setLoading(false);
      return;
    }

    const requestId = ++requestRef.current;

    const timer = window.setTimeout(async () => {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(
          `/api/geocode?q=${encodeURIComponent(query)}`
        );

        if (!response.ok) {
          throw new Error("No se pudo consultar el buscador");
        }

        const data = (await response.json()) as SearchResult[];

        if (requestId !== requestRef.current) {
          return;
        }

        setResults(Array.isArray(data) ? data : []);

        if (!Array.isArray(data) || data.length === 0) {
          setError("No encontramos ubicaciones con ese nombre.");
        }
      } catch (searchError) {
        console.error("Error buscando ubicaciones:", searchError);

        if (requestId !== requestRef.current) {
          return;
        }

        setResults([]);
        setError("No fue posible buscar ubicaciones.");
      } finally {
        if (requestId === requestRef.current) {
          setLoading(false);
        }
      }
    }, 500);

    return () => {
      window.clearTimeout(timer);
    };
  }, [value, selected, resolvedExternally]);

  function handleChange(nextValue: string) {
    setSelected(false);
    setError("");
    onTextChange(nextValue);
  }

  function handleSelect(result: SearchResult) {
    const latitude = Number(result.lat);
    const longitude = Number(result.lon);

    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude)
    ) {
      setError("No pudimos obtener las coordenadas del lugar.");
      return;
    }

    const address = result.display_name;
    const name =
      result.name ||
      result.display_name.split(",")[0] ||
      "Ubicación";

    setSelected(true);
    setResults([]);
    setError("");

    onTextChange(address);

    onPlaceSelect({
      placeId: String(result.place_id),
      name,
      address,
      latitude,
      longitude,
    });
  }

  return (
    <div className="relative">
      <label className="mb-2 block text-sm font-black text-slate-700">
        {label}
      </label>

      <div className="relative">
        <Search
          size={18}
          className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-slate-400"
        />

        <input
          type="text"
          value={value}
          onChange={(event) => handleChange(event.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          className="h-14 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-12 pr-12 font-semibold text-slate-950 outline-none transition focus:border-slate-950 focus:bg-white"
        />

        {loading && (
          <LoaderCircle
            size={18}
            className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 animate-spin text-slate-400"
          />
        )}

        {(selected || resolvedExternally) && !loading && (
          <CheckCircle2
            size={19}
            className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-emerald-600"
          />
        )}
      </div>

      {results.length > 0 && (
        <div className="absolute left-0 right-0 top-[82px] z-[2000] max-h-80 overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">
          {results.map((result) => (
            <button
              key={result.place_id}
              type="button"
              onMouseDown={(event) => {
                event.preventDefault();
                handleSelect(result);
              }}
              className="flex w-full items-start gap-3 border-b border-slate-100 px-4 py-4 text-left transition last:border-b-0 hover:bg-slate-50"
            >
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-yellow-100 text-yellow-700">
                <MapPin size={17} />
              </span>

              <span className="min-w-0">
                <span className="block truncate text-sm font-black text-slate-950">
                  {result.name || result.display_name.split(",")[0]}
                </span>

                <span className="mt-1 block text-xs leading-5 text-slate-500">
                  {result.display_name}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}

      {(selected || resolvedExternally) && value && (
        <div className="mt-2 flex items-start gap-2 text-xs text-slate-500">
          <MapPin
            size={14}
            className="mt-0.5 shrink-0"
          />
          <span>{value}</span>
        </div>
      )}

      {error && (
        <p className="mt-2 text-xs font-semibold text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

