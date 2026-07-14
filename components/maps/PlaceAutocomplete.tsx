"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";
import { APIProvider } from "@vis.gl/react-google-maps";
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
};

export function PlaceAutocomplete({
  label,
  placeholder,
  value,
  onTextChange,
  onPlaceSelect,
}: PlaceAutocompleteProps) {
  const apiKey =
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return (
      <FallbackInput
        label={label}
        placeholder={placeholder}
        value={value}
        onTextChange={onTextChange}
      />
    );
  }

  return (
    <APIProvider
      apiKey={apiKey}
      libraries={["places"]}
      language="es"
      region="MX"
    >
      <PlaceAutocompleteInner
        label={label}
        placeholder={placeholder}
        value={value}
        onTextChange={onTextChange}
        onPlaceSelect={onPlaceSelect}
      />
    </APIProvider>
  );
}

function PlaceAutocompleteInner({
  label,
  placeholder,
  value,
  onTextChange,
  onPlaceSelect,
}: PlaceAutocompleteProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const elementRef =
    useRef<google.maps.places.PlaceAutocompleteElement | null>(
      null
    );

  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    let autocomplete:
      | google.maps.places.PlaceAutocompleteElement
      | null = null;

    const container = containerRef.current;

    async function createAutocomplete() {
      if (!container) return;

      try {
        const { PlaceAutocompleteElement } =
          (await google.maps.importLibrary(
            "places"
          )) as google.maps.PlacesLibrary;

        if (!mounted) {
          return;
        }

        autocomplete =
          new PlaceAutocompleteElement();

        autocomplete.placeholder = placeholder;
        autocomplete.includedRegionCodes = ["mx"];

        autocomplete.locationBias = {
          center: {
            lat: 19.0414,
            lng: -98.2063,
          },
          radius: 100000,
        };

        autocomplete.style.width = "100%";

        const handleSelection = async (
          event: google.maps.places.PlacePredictionSelectEvent
        ) => {
          setError("");

          try {
            const place =
              event.placePrediction.toPlace();

            await place.fetchFields({
              fields: [
                "id",
                "displayName",
                "formattedAddress",
                "location",
              ],
            });

            if (!place.location) {
              setError(
                "No pudimos obtener la ubicación exacta."
              );
              return;
            }

            const address =
              place.formattedAddress ??
              place.displayName ??
              "";

            onTextChange(address);
            setSelected(true);

            onPlaceSelect({
              placeId: place.id ?? "",
              name:
                place.displayName ??
                address,
              address,
              latitude:
                place.location.lat(),
              longitude:
                place.location.lng(),
            });
          } catch (selectionError) {
            console.error(
              "Error seleccionando lugar:",
              selectionError
            );

            setError(
              "No fue posible seleccionar esa ubicación."
            );
          }
        };

        const selectionListener = (
          event: Event
        ) => {
          void handleSelection(
            event as google.maps.places.PlacePredictionSelectEvent
          );
        };

        autocomplete.addEventListener(
          "gmp-select",
          selectionListener
        );

        container.innerHTML = "";
        container.appendChild(autocomplete);

        elementRef.current = autocomplete;
        setLoading(false);
      } catch (creationError) {
        console.error(
          "Error cargando Places:",
          creationError
        );

        setError(
          "Google Places todavía no está habilitado."
        );
        setLoading(false);
      }
    }

    void createAutocomplete();

    return () => {
      mounted = false;

      if (
        autocomplete &&
        container &&
        container.contains(autocomplete)
      ) {
        container.removeChild(autocomplete);
      }

      elementRef.current = null;
    };
  }, [
    onPlaceSelect,
    onTextChange,
    placeholder,
  ]);

  return (
    <div>
      <label className="mb-2 block text-sm font-black text-slate-700">
        {label}
      </label>

      <div className="relative">
        <Search
          size={18}
          className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-slate-400"
        />

        <div
          ref={containerRef}
          className="min-h-14 w-full overflow-visible rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-3"
        />

        {loading && (
          <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2">
            <LoaderCircle
              size={18}
              className="animate-spin text-slate-400"
            />
          </div>
        )}

        {selected && !loading && (
          <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2">
            <CheckCircle2
              size={19}
              className="text-emerald-600"
            />
          </div>
        )}
      </div>

      {value && (
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

function FallbackInput({
  label,
  placeholder,
  value,
  onTextChange,
}: Omit<
  PlaceAutocompleteProps,
  "onPlaceSelect"
>) {
  return (
    <div>
      <label className="mb-2 block text-sm font-black text-slate-700">
        {label}
      </label>

      <div className="relative">
        <MapPin
          size={18}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
        />

        <input
          type="text"
          value={value}
          onChange={(event) =>
            onTextChange(event.target.value)
          }
          placeholder={placeholder}
          className="h-14 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-12 pr-4 font-semibold outline-none focus:border-slate-950 focus:bg-white"
        />
      </div>

      <p className="mt-2 text-xs text-amber-700">
        Falta configurar Google Places.
      </p>
    </div>
  );
}
