'use client';
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { sourceLabel, storyEventDate, storyEventStatus, storyMomentAt, type KeyFact, type ScriptChapter, type StoryEvent, type StoryMoment, type StoryPlace } from '@/lib/episode-story';
import { HearStoryMoment, usePlaybackPosition } from './episode-playback';

interface StoryState {
  /** What the audio is covering right now; null before listening or between linked sections. */
  moment: StoryMoment | null;
  selectedPlace: string | null;
  selectPlace(id: string): void;
  /** Select a place and bring the map into view. */
  showPlace(id: string): void;
  showRequest: number;
}
const StoryContext = createContext<StoryState | null>(null);
export function useStory(): StoryState {
  const story = useContext(StoryContext);
  if (!story) throw new Error('useStory must be used inside StoryProvider');
  return story;
}

export function StoryProvider({ moments, places, children }: { moments: StoryMoment[]; places: StoryPlace[]; children: ReactNode }) {
  const index = usePlaybackPosition(seconds => {
    const moment = storyMomentAt(moments, seconds);
    return moment ? moments.indexOf(moment) : -1;
  });
  const moment = index >= 0 ? moments[index] : null;
  const [selectedPlace, selectPlace] = useState(() => places.find(place => place.role === 'primary_setting')?.id ?? places[0]?.id ?? null);
  const [showRequest, setShowRequest] = useState(0);
  const value = useMemo<StoryState>(() => ({ moment, selectedPlace, selectPlace, showRequest,
    showPlace(id) { selectPlace(id); setShowRequest(request => request + 1); } }), [moment, selectedPlace, showRequest]);
  return <StoryContext.Provider value={value}>{children}</StoryContext.Provider>;
}

export function StoryKeyFacts({ facts }: { facts: KeyFact[] }) {
  const { moment } = useStory();
  return <section className="story-section"><h2>Key facts</h2>
    <ul className="story-key-facts">{facts.map(fact => {
      const current = !!moment?.keyFactIds.includes(fact.id);
      return <li key={fact.id} className={current ? 'is-current' : undefined} aria-current={current ? 'true' : undefined}>{fact.text}</li>;
    })}</ul>
  </section>;
}

export function StoryScript({ chapters }: { chapters: ScriptChapter[] }) {
  const { moment } = useStory();
  return <section className="story-section story-script"><h2>The Full Story</h2>
    {chapters.map(chapter => <section key={chapter.id} className="story-chapter">
      {chapter.title && <h3>{chapter.title}</h3>}
      {chapter.segments.map(segment => {
        const current = moment?.segment === segment.key;
        return <div key={segment.key} className={current ? 'story-passage is-current' : 'story-passage'} aria-current={current ? 'true' : undefined}>
          {segment.paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
        </div>;
      })}
    </section>)}
  </section>;
}

export function StoryTimeline({ events, places, playable }: { events: StoryEvent[]; places: StoryPlace[]; playable: boolean }) {
  const { moment, showPlace } = useStory();
  const pins = new Map(places.map((place, index) => [place.id, { place, number: index + 1 }]));
  return <section className="story-section"><h2>Timeline</h2>
    <ol className="story-timeline">{events.map(event => {
      const current = !!moment?.eventIds.includes(event.id);
      // Older releases link places without naming a location; use the mapped place's name.
      const pin = pins.get(event.location?.placeId ?? event.placeIds[0] ?? '');
      const location = event.location?.name || pin?.place.name;
      const status = storyEventStatus(event.status);
      return <li key={event.id} className={current ? 'is-current' : undefined} aria-current={current ? 'true' : undefined}>
        <div className="story-event-copy">
          <div className="story-event-meta"><span>{storyEventDate(event)}</span>{status && <span className="story-label">{status}</span>}</div>
          <h3>{playable && event.startTime !== null ? <HearStoryMoment seconds={event.startTime} title={event.title} /> : event.title}</h3>
          {event.summary && <p>{event.summary}</p>}
          {(location || event.sources.length > 0) && <div className="story-event-links">
            {location && (pin
              ? <button type="button" className="story-event-place" onClick={() => showPlace(pin.place.id)} aria-label={`Show ${location} on the map`}>
                <span className="story-place-number" aria-hidden="true">{pin.number}</span>{location}
              </button>
              : <span className="story-event-place"><PinIcon />{location}</span>)}
            {event.sources.length > 0 && <span className="story-read-more">Read more:{' '}
              {event.sources.map((source, index) => <span key={source.url}>{index > 0 && ', '}
                <a href={source.url} rel="noopener noreferrer" title={source.title}>{sourceLabel(source)}</a>
              </span>)}
            </span>}
          </div>}
        </div>
      </li>;
    })}</ol>
  </section>;
}

function PinIcon() {
  return <svg className="story-pin-icon" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="currentColor">
    <path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z" />
  </svg>;
}
