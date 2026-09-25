'use client';

import { useEffect, useRef, useState } from 'react';
import type { Map as LeafletMap, Marker } from 'leaflet';
import { storyPlaceRole, type StoryPlace } from '@/lib/episode-story';

export function StoryPlaces({ places }: { places: StoryPlace[] }) {
  const [selected, setSelected] = useState(places.find(place => place.role === 'primary_setting')?.id || places[0].id);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markers = useRef(new Map<string, Marker>());
  const selection = useRef(selected);
  selection.current = selected;

  useEffect(() => {
    const node = container.current;
    if (!node) return;
    setReady(false);
    setFailed(false);
    let disposed = false;
    let resize: ResizeObserver | undefined;
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      observer.disconnect();
      void import('leaflet').then(L => {
        if (disposed) return;
        const map = L.map(node, { scrollWheelZoom: false });
        mapRef.current = map;
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }).addTo(map);
        for (const [index, place] of places.entries()) {
          const marker = L.marker([place.latitude, place.longitude], {
            icon: L.divIcon({ className: `story-map-pin${place.role === 'primary_setting' ? ' is-primary' : ''}`, html: `<span>${index + 1}</span>`, iconSize: [44, 44], iconAnchor: [22, 22] }),
            title: place.name, alt: place.name, keyboard: true,
          }).addTo(map).on('click', () => setSelected(place.id));
          markers.current.set(place.id, marker);
        }
        if (places.length === 1) map.setView([places[0].latitude, places[0].longitude], 7);
        else map.fitBounds(L.latLngBounds(places.map(place => [place.latitude, place.longitude])), { padding: [35, 35], maxZoom: 8 });
        for (const place of places) {
          markers.current.get(place.id)?.getElement()?.setAttribute('aria-label', place.name);
          markers.current.get(place.id)?.getElement()?.setAttribute('aria-pressed', String(place.id === selection.current));
        }
        resize = new ResizeObserver(() => map.invalidateSize());
        resize.observe(node);
        setReady(true);
      }).catch(() => { if (!disposed) setFailed(true); });
    }, { rootMargin: '160px' });
    observer.observe(node);
    return () => { disposed = true; observer.disconnect(); resize?.disconnect(); mapRef.current?.remove(); mapRef.current = null; markers.current.clear(); };
  }, [places]);

  useEffect(() => {
    for (const [id, marker] of markers.current) {
      marker.getElement()?.setAttribute('aria-pressed', String(id === selected));
      marker.setZIndexOffset(id === selected ? 1000 : 0);
    }
  }, [selected, ready]);

  function selectPlace(place: StoryPlace) {
    setSelected(place.id);
    const map = mapRef.current;
    if (map && !map.getBounds().contains([place.latitude, place.longitude])) map.panTo([place.latitude, place.longitude], { animate: false });
  }

  return <section className="story-section story-places"><h2>Where it happens</h2>
    <div className="story-map-wrap">
      <div ref={container} className="story-map" role="region" aria-label="Story locations map" />
      {!ready && <p className="story-map-placeholder">{failed ? 'Map unavailable. Explore the places below.' : 'Loading map…'}</p>}
    </div>
    <ol className="story-place-list">{places.map((place, index) => <li key={place.id}>
      <button type="button" aria-pressed={selected === place.id} onClick={() => selectPlace(place)}>
        <span className={`story-place-number${place.role === 'primary_setting' ? ' is-primary' : ''}`}>{index + 1}</span>
        <span><strong>{place.name}</strong><span className="story-place-role">{storyPlaceRole(place.role)}</span></span>
      </button>
    </li>)}</ol>
  </section>;
}
