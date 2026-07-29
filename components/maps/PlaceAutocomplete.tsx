"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";

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
  onTextChange: (
    value: string
  ) => void;
  onPlaceSelect: (
    place: SelectedPlace
  ) => void;
  resolvedExternally?: boolean;
};

type SearchResult = {
  placeId: string;
  name: string;
  address: string;
};

type PlaceDetailsResponse = {
  placeId?: string;
  name?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  error?: string;
};

function createSessionToken() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID ===
      "function"
  ) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}`;
}

export function PlaceAutocomplete({
  label,
  placeholder,
  value,
  onTextChange,
  onPlaceSelect,
  resolvedExternally = false,
}: PlaceAutocompleteProps) {
  const [
    results,
    setResults,
  ] = useState<SearchResult[]>([]);

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    selected,
    setSelected,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const requestRef = useRef(0);

  const sessionTokenRef =
    useRef<string | null>(null);

  if (
    sessionTokenRef.current === null
  ) {
    sessionTokenRef.current =
      createSessionToken();
  }

  useEffect(() => {
    const query = value.trim();

    if (
      selected ||
      resolvedExternally ||
      query.length < 3
    ) {
      requestRef.current += 1;
      setResults([]);
      setError("");
      setLoading(false);
      return;
    }

    const requestId =
      ++requestRef.current;

    const controller =
      new AbortController();

    const timer =
      window.setTimeout(
        async () => {
          try {
            setLoading(true);
            setError("");

            const params =
              new URLSearchParams({
                q: query,
                sessionToken:
                  sessionTokenRef.current ??
                  createSessionToken(),
              });

            const response =
              await fetch(
                `/api/geocode?${params.toString()}`,
                {
                  method: "GET",
                  cache: "no-store",
                  signal:
                    controller.signal,
                }
              );

            const data =
              (await response.json()) as
                | SearchResult[]
                | {
                    error?: string;
                  };

            if (
              requestId !==
                requestRef.current ||
              controller.signal.aborted
            ) {
              return;
            }

            if (
              !response.ok ||
              !Array.isArray(data)
            ) {
              throw new Error(
                !Array.isArray(data)
                  ? data.error
                  : "No se pudo consultar el buscador."
              );
            }

            setResults(data);

            if (data.length === 0) {
              setError(
                "No encontramos ubicaciones con ese nombre."
              );
            }
          } catch (searchError) {
            if (
              controller.signal.aborted
            ) {
              return;
            }

            console.error(
              "Error buscando ubicaciones:",
              searchError
            );

            if (
              requestId !==
              requestRef.current
            ) {
              return;
            }

            setResults([]);

            setError(
              searchError instanceof Error &&
                searchError.message
                ? searchError.message
                : "No fue posible buscar ubicaciones."
            );
          } finally {
            if (
              requestId ===
                requestRef.current &&
              !controller.signal.aborted
            ) {
              setLoading(false);
            }
          }
        },
        350
      );

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [
    resolvedExternally,
    selected,
    value,
  ]);

  function handleChange(
    nextValue: string
  ) {
    requestRef.current += 1;

    if (selected) {
      sessionTokenRef.current =
        createSessionToken();
    }

    setSelected(false);
    setResults([]);
    setError("");
    onTextChange(nextValue);
  }

  async function handleSelect(
    result: SearchResult
  ) {
    const requestId =
      ++requestRef.current;

    setLoading(true);
    setError("");

    try {
      const params =
        new URLSearchParams({
          placeId: result.placeId,
          sessionToken:
            sessionTokenRef.current ??
            createSessionToken(),
        });

      const response = await fetch(
        `/api/geocode?${params.toString()}`,
        {
          method: "GET",
          cache: "no-store",
        }
      );

      const place =
        (await response.json()) as
          PlaceDetailsResponse;

      if (
        requestId !==
        requestRef.current
      ) {
        return;
      }

      const latitude = Number(
        place.latitude
      );

      const longitude = Number(
        place.longitude
      );

      if (
        !response.ok ||
        !place.placeId ||
        !place.address ||
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude)
      ) {
        throw new Error(
          place.error ||
            "No pudimos obtener las coordenadas del lugar."
        );
      }

      const selectedPlace: SelectedPlace =
        {
          placeId: place.placeId,
          name:
            place.name ||
            result.name ||
            "Ubicación",
          address: place.address,
          latitude,
          longitude,
        };

      setSelected(true);
      setResults([]);
      setError("");

      onTextChange(
        selectedPlace.address
      );

      onPlaceSelect(
        selectedPlace
      );

      sessionTokenRef.current =
        createSessionToken();
    } catch (selectionError) {
      console.error(
        "Error seleccionando ubicación:",
        selectionError
      );

      if (
        requestId !==
        requestRef.current
      ) {
        return;
      }

      setError(
        selectionError instanceof Error &&
          selectionError.message
          ? selectionError.message
          : "No fue posible seleccionar la ubicación."
      );
    } finally {
      if (
        requestId ===
        requestRef.current
      ) {
        setLoading(false);
      }
    }
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
          onChange={(event) =>
            handleChange(
              event.target.value
            )
          }
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

        {(selected ||
          resolvedExternally) &&
          !loading && (
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
              key={result.placeId}
              type="button"
              onMouseDown={(event) => {
                event.preventDefault();

                void handleSelect(
                  result
                );
              }}
              className="flex w-full items-start gap-3 border-b border-slate-100 px-4 py-4 text-left transition last:border-b-0 hover:bg-slate-50"
            >
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-yellow-100 text-yellow-700">
                <MapPin size={17} />
              </span>

              <span className="min-w-0">
                <span className="block truncate text-sm font-black text-slate-950">
                  {result.name}
                </span>

                <span className="mt-1 block text-xs leading-5 text-slate-500">
                  {result.address}
                </span>
              </span>
            </button>
          ))}

          <div className="px-4 py-2 text-right text-[10px] font-bold text-slate-400">
            Powered by Google
          </div>
        </div>
      )}

      {(selected ||
        resolvedExternally) &&
        value && (
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