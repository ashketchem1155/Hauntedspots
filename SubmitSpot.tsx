import { useState, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { MapView } from "@/components/Map";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { MapPin, Upload, Skull, Ghost, AlertCircle, X } from "lucide-react";

const CATEGORIES = [
  { value: "ghost", label: "Ghost" },
  { value: "poltergeist", label: "Poltergeist" },
  { value: "urban_legend", label: "Urban Legend" },
  { value: "cursed_place", label: "Cursed Place" },
  { value: "demonic", label: "Demonic" },
  { value: "cryptid", label: "Cryptid" },
  { value: "other", label: "Other" },
];

export default function SubmitSpot() {
  const { isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("ghost");
  const [address, setAddress] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [photoMime, setPhotoMime] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);

  const createMutation = trpc.spots.create.useMutation({
    onSuccess: (data) => {
      utils.spots.list.invalidate();
      toast.success("Haunted spot submitted!");
      navigate(`/spot/${data.id}`);
    },
    onError: (e) => toast.error(e.message),
  });

  const handleMapReady = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    geocoderRef.current = new google.maps.Geocoder();

    map.addListener("click", (e: google.maps.MapMouseEvent) => {
      if (!e.latLng) return;
      const latVal = e.latLng.lat();
      const lngVal = e.latLng.lng();
      setLat(latVal);
      setLng(lngVal);

      // Move or create marker
      if (markerRef.current) {
        markerRef.current.setPosition(e.latLng);
      } else {
        markerRef.current = new google.maps.Marker({
          position: e.latLng,
          map,
          icon: {
            path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z",
            fillColor: "#cc2200",
            fillOpacity: 1,
            strokeColor: "rgba(255,255,255,0.5)",
            strokeWeight: 1,
            scale: 2,
            anchor: new google.maps.Point(12, 22),
          },
          animation: google.maps.Animation.DROP,
        });
      }

      // Reverse geocode
      geocoderRef.current?.geocode({ location: e.latLng }, (results, status) => {
        if (status === "OK" && results?.[0]) {
          setAddress(results[0].formatted_address);
        }
      });
    });
  }, []);

  const handleAddressSearch = () => {
    if (!geocoderRef.current || !address.trim()) return;
    geocoderRef.current.geocode({ address }, (results, status) => {
      if (status === "OK" && results?.[0]) {
        const loc = results[0].geometry.location;
        setLat(loc.lat());
        setLng(loc.lng());
        mapRef.current?.setCenter(loc);
        mapRef.current?.setZoom(14);

        if (markerRef.current) {
          markerRef.current.setPosition(loc);
        } else {
          markerRef.current = new google.maps.Marker({
            position: loc,
            map: mapRef.current!,
            icon: {
              path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z",
              fillColor: "#cc2200",
              fillOpacity: 1,
              strokeColor: "rgba(255,255,255,0.5)",
              strokeWeight: 1,
              scale: 2,
              anchor: new google.maps.Point(12, 22),
            },
          });
        }
      } else {
        toast.error("Address not found. Try clicking the map directly.");
      }
    });
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Photo must be under 5MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      setPhotoPreview(result);
      const base64 = result.split(",")[1];
      setPhotoBase64(base64);
      setPhotoMime(file.type);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!lat || !lng) {
      toast.error("Please pin a location on the map");
      return;
    }
    if (!title.trim() || !description.trim()) {
      toast.error("Title and description are required");
      return;
    }
    createMutation.mutate({
      title: title.trim(),
      description: description.trim(),
      lat,
      lng,
      address: address || undefined,
      category: category as "ghost" | "poltergeist" | "urban_legend" | "cursed_place" | "demonic" | "cryptid" | "other",
      photoBase64: photoBase64 ?? undefined,
      photoMime: photoMime ?? undefined,
    });
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-sm">
          <Ghost size={48} className="text-primary mx-auto mb-4" />
          <h2 className="font-heading text-2xl font-bold text-foreground mb-3">Sign In Required</h2>
          <p className="font-body text-muted-foreground mb-6">
            You must be signed in to submit a haunted spot.
          </p>
          <Button
            className="bg-primary hover:bg-primary/80 text-primary-foreground font-ui glow-blood"
            onClick={() => (window.location.href = getLoginUrl())}
          >
            Sign In to Continue
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-10">
      <div className="container max-w-3xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <div className="horror-divider w-6" />
            <span className="font-ui text-xs uppercase tracking-[0.3em] text-primary">New Report</span>
          </div>
          <h1 className="font-heading text-3xl font-bold text-foreground">Submit a Haunted Spot</h1>
          <p className="font-body text-muted-foreground mt-2">
            Document a paranormal location and let the community investigate.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Title */}
          <div className="bg-card rounded-lg p-6 border border-border space-y-4">
            <h2 className="font-heading text-base font-semibold text-foreground flex items-center gap-2">
              <Skull size={14} className="text-primary" /> Basic Information
            </h2>

            <div className="space-y-2">
              <Label className="font-ui text-sm text-foreground">Location Name *</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Abandoned Church on 8th Street"
                className="bg-secondary border-border text-foreground font-ui"
                required
              />
            </div>

            <div className="space-y-2">
              <Label className="font-ui text-sm text-foreground">Category *</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="bg-secondary border-border text-foreground font-ui">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value} className="font-ui text-foreground hover:bg-secondary">
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="font-ui text-sm text-foreground">Story / Description *</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the paranormal activity, history, and any reported encounters..."
                className="bg-secondary border-border text-foreground font-body resize-none"
                rows={5}
                required
              />
              <p className="font-ui text-xs text-muted-foreground">{description.length} characters</p>
            </div>
          </div>

          {/* Location */}
          <div className="bg-card rounded-lg p-6 border border-border space-y-4">
            <h2 className="font-heading text-base font-semibold text-foreground flex items-center gap-2">
              <MapPin size={14} className="text-primary" /> Location
            </h2>

            <div className="flex gap-2">
              <Input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Search address or click the map to pin"
                className="bg-secondary border-border text-foreground font-ui flex-1"
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddressSearch())}
              />
              <Button
                type="button"
                variant="outline"
                className="border-border text-foreground hover:bg-secondary font-ui shrink-0"
                onClick={handleAddressSearch}
              >
                Search
              </Button>
            </div>

            {lat && lng && (
              <div className="flex items-center gap-2 text-xs font-ui text-accent-foreground">
                <MapPin size={10} />
                Pinned: {lat.toFixed(4)}, {lng.toFixed(4)}
              </div>
            )}

            {!lat && (
              <div className="flex items-center gap-2 p-3 rounded-md bg-secondary text-xs font-ui text-muted-foreground">
                <AlertCircle size={12} className="text-primary shrink-0" />
                Click anywhere on the map to drop a pin
              </div>
            )}

            <div className="rounded-lg overflow-hidden border border-border h-64">
              <MapView
                onMapReady={handleMapReady}
                initialCenter={{ lat: 20, lng: 0 }}
                initialZoom={2}
                className="w-full h-full"
              />
            </div>
          </div>

          {/* Photo */}
          <div className="bg-card rounded-lg p-6 border border-border space-y-4">
            <h2 className="font-heading text-base font-semibold text-foreground flex items-center gap-2">
              <Upload size={14} className="text-primary" /> Photo (Optional)
            </h2>

            {photoPreview ? (
              <div className="relative">
                <img src={photoPreview} alt="Preview" className="w-full h-48 object-cover rounded-lg" />
                <button
                  type="button"
                  onClick={() => { setPhotoPreview(null); setPhotoBase64(null); setPhotoMime(null); }}
                  className="absolute top-2 right-2 bg-background/80 rounded-full p-1 text-foreground hover:text-primary"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 transition-colors">
                <Upload size={24} className="text-muted-foreground mb-2" />
                <span className="font-ui text-sm text-muted-foreground">Click to upload a photo</span>
                <span className="font-ui text-xs text-muted-foreground mt-1">Max 5MB, JPG/PNG</span>
                <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
              </label>
            )}
          </div>

          {/* Submit */}
          <Button
            type="submit"
            size="lg"
            className="w-full bg-primary hover:bg-primary/80 text-primary-foreground font-ui glow-blood"
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? (
              <Ghost size={16} className="mr-2 animate-pulse" />
            ) : (
              <Skull size={16} className="mr-2" />
            )}
            {createMutation.isPending ? "Submitting..." : "Submit Haunted Spot"}
          </Button>
        </form>
      </div>
    </div>
  );
}
