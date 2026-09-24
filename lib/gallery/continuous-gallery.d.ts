import type { Episode } from '../../worker/catalog';
export class ContinuousGallery {
 constructor(wrapper: HTMLElement, createCard: (episode: Episode) => HTMLElement, onOpen: (episode: Episode) => void, onShare: (episode: Episode) => void);
 setItems(items: Episode[]): void;
 pause(reason: string, paused: boolean): void;
 destroy(): void;
}
