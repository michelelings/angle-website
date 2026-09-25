'use client';

import { useEffect, useRef, useState } from 'react';
import type { Map as LeafletMap, Marker } from 'leaflet';
import { storyEventDate, storyPlaceRole, storyPlaceZoom, type StoryEvent, type StoryPlace } from '@/lib/episode-story';
import { useStory } from './story-timeline';

export function StoryPlaces({ places, events }: { places: StoryPlace[]; events: StoryEvent[] }) {
  const { moment, selectedPlace, selectPlace, showRequest } = useStory();
  const selected = selectedPlace ?? places[0].id;
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const section = useRef<HTMLElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markers = useRef(new Map<string, Marker>());
  const selection = useRef(selected);
  selection.current = selected;
  const eventsById = new Map(events.map(event => [event.id, event]));

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
          }).addTo(map).on('click', () => selectPlace(place.id));
          markers.current.set(place.id, marker);
        }
        // Precision decides how close to go: an address warrants a street view, a country does not.
        const zoom = Math.max(...places.map(place => storyPlaceZoom(place.precision)));
        if (places.length === 1) map.setView([places[0].latitude, places[0].longitude], zoom);
        else map.fitBounds(L.latLngBounds(places.map(place => [place.latitude, place.longitude])), { padding: [35, 35], maxZoom: zoom });
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
  }, [places, selectPlace]);

  useEffect(() => {
    for (const [id, marker] of markers.current) {
      marker.getElement()?.setAttribute('aria-pressed', String(id === selected));
      marker.getElement()?.classList.toggle('is-current', !!moment?.placeIds.includes(id));
      marker.setZIndexOffset(id === selected ? 1000 : 0);
    }
  }, [selected, moment, ready]);

  function reveal(id: string) {
    const place = places.find(place => place.id === id);
    const map = mapRef.current;
    if (place && map && !map.getBounds().contains([place.latitude, place.longitude])) map.panTo([place.latitude, place.longitude], { animate: false });
  }
  // Follow playback: when the audio reaches a section set somewhere, move to that place.
  const following = moment?.placeIds[0];
  useEffect(() => {
    if (!following) return;
    selectPlace(following);
    reveal(following);
  }, [following, ready]);
  useEffect(() => {
    if (!showRequest) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    section.current?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
    reveal(selection.current);
  }, [showRequest]);

  return <section ref={section} className="story-section story-places"><h2>Where it happens</h2>
    <div className="story-map-wrap">
      <div ref={container} className="story-map" role="region" aria-label="Story locations map" />
      {!ready && <p className="story-map-placeholder">{failed ? 'Map unavailable. Explore the places below.' : 'Loading map…'}</p>}
    </div>
    <ol className="story-place-list">{places.map((place, index) => {
      const happened = place.eventIds.flatMap(id => eventsById.get(id) ?? []);
      const current = !!moment?.placeIds.includes(place.id);
      return <li key={place.id}>
        <button type="button" aria-pressed={selected === place.id} className={current ? 'is-current' : undefined} onClick={() => { selectPlace(place.id); reveal(place.id); }}>
          <span className={`story-place-number${place.role === 'primary_setting' ? ' is-primary' : ''}`}>{index + 1}</span>
          <span><strong>{place.name}</strong>
            {happened.length
              ? <span className="story-place-role">{happened.map(event => event.date ? `${event.title} (${storyEventDate(event)})` : event.title).join(' · ')}</span>
              : <span className="story-place-role">{storyPlaceRole(place.role)}</span>}
          </span>
        </button>
      </li>;
    })}</ol>
  </section>;
}
