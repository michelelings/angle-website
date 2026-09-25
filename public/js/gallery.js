// Geometry is independent of catalog size. Include the gap in every stride,
// including the last-to-first boundary, and support dragging in both directions.
export function galleryWindow(position, stride, width, count, overscan = 2) {
    if (!count) return { start: 0, end: 0, offset: 0, indexes: [] };
    const first = Math.floor(position / stride);
    const size = Math.ceil(width / stride) + 1 + overscan * 2;
    const start = first - overscan;
    return {
        start, end: start + size,
        offset: overscan * stride + position - first * stride,
        indexes: Array.from({ length: size }, (_, i) => ((start + i) % count + count) % count),
    };
}

export class ContinuousGallery {
    constructor(wrapper, createCard, onOpen, onShare, onCenter) {
        this.disposers = [];
        this.listen = (target, event, callback, options) => {
            target.addEventListener(event, callback, options);
            this.disposers.push(() => target.removeEventListener?.(event, callback, options));
        };
        this.wrapper = wrapper;
        this.track = wrapper.querySelector('.collection-grid');
        this.createCard = createCard;
        this.onCenter = onCenter;
        this.items = [];
        this.nodes = new Map();
        this.position = 0;
        this.pendingDelta = 0;
        this.velocity = 0;
        this.frame = null;
        this.lastTime = null;
        this.pauses = new Set();
        this.motion = matchMedia('(prefers-reduced-motion: reduce)');
        this.stride = 390;
        this.width = wrapper.clientWidth;
        wrapper.tabIndex = 0;
        wrapper.setAttribute('role', 'region');
        wrapper.setAttribute('aria-label', 'Stories. Use left and right arrow keys to browse.');

        this.listen(this.track, 'click', e => {
            if (this.suppressClick) { e.preventDefault(); return; }
            const card = e.target.closest('.episode-card');
            if (!card || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
            const item = this.items[Number(card.dataset.itemIndex)];
            if (!item) return;
            e.preventDefault();
            if (e.target.closest('.episode-share-btn')) onShare(item);
            else onOpen(item);
        });
        this.listen(wrapper, 'dragstart', e => e.preventDefault());
        this.listen(wrapper, 'pointerover', e => {
            if (e.pointerType === 'touch') return;
            const card = e.target.closest('.episode-card');
            if (card === this.hoveredCard) return;
            this.hoveredCard = card;
            this.pause('hover', !!card);
            this.notifyCenter();
        });
        this.listen(wrapper, 'pointerleave', () => {
            this.hoveredCard = null;
            this.pause('hover', false);
            this.notifyCenter();
        });
        this.listen(document, 'keydown', () => delete wrapper.dataset.pointerFocus);
        this.listen(wrapper, 'keydown', e => {
            if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
            e.preventDefault();
            wrapper.focus({ preventScroll: true });
            this.pause('focus', true);
            this.move(e.key === 'ArrowRight' ? this.stride : -this.stride);
        });
        this.listen(wrapper, 'focusin', e => {
            this.focusedCard = e.target.closest('.episode-card');
            this.pause('focus', e.target !== wrapper || !this.pointer);
            this.notifyCenter();
        });
        this.listen(wrapper, 'focusout', () => queueMicrotask(() => {
            if (this.destroyed) return;
            this.focusedCard = this.track.contains(document.activeElement)
                ? document.activeElement.closest('.episode-card') : null;
            this.pause('focus', wrapper.contains(document.activeElement));
            this.notifyCenter();
        }));
        const pageScroll = !!wrapper.closest('.catalog-page');
        this.listen(pageScroll ? window : wrapper, 'wheel', e => {
            if (e.defaultPrevented || e.ctrlKey || this.pauses.has('modal')) return;
            if (pageScroll && (wrapper.closest('[hidden]') || e.target.closest?.('.filters, input, textarea, select, dialog'))) return;
            if (!pageScroll && Math.abs(e.deltaX) <= Math.abs(e.deltaY) && !e.shiftKey) return;
            e.preventDefault();
            const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? this.width : 1;
            const delta = pageScroll
                ? (Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX)
                : (e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX);
            this.move(delta * unit);
        }, { passive: false });

        // Capture only after a horizontal drag is recognized: a simple tap still
        // targets the card/link, and native vertical scrolling remains available.
        this.listen(wrapper, 'pointerdown', e => {
            wrapper.dataset.pointerFocus = 'true';
            if (!e.isPrimary || e.button !== 0 || this.mode === 'static') return;
            this.suppressClick = false;
            this.pointer = { id: e.pointerId, type: e.pointerType, x: e.clientX, y: e.clientY,
                last: e.clientX, time: e.timeStamp, velocity: 0, dragging: false };
            if (document.activeElement === wrapper) this.pause('focus', false);
            this.pause('pointer', true);
        });
        this.listen(wrapper, 'pointermove', e => {
            const p = this.pointer;
            if (!p || p.id !== e.pointerId) return;
            const dx = e.clientX - p.x;
            if (!p.dragging && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(e.clientY - p.y)) {
                p.dragging = true;
                this.suppressClick = true;
                wrapper.setPointerCapture(e.pointerId);
                wrapper.classList.add('scrolling');
                wrapper.focus({ preventScroll: true });
                this.pause('focus', false);
            }
            if (p.dragging) {
                const delta = p.last - e.clientX;
                const elapsed = e.timeStamp - p.time;
                if (elapsed > 0) p.velocity = Math.max(-2.5, Math.min(2.5, delta / elapsed));
                this.move(delta);
                p.last = e.clientX;
                p.time = e.timeStamp;
            }
        });
        const release = e => {
            const p = this.pointer;
            if (p?.id !== e.pointerId) return;
            this.pointer = null;
            wrapper.classList.remove('scrolling');
            this.pause('pointer', false);
            if (e.type === 'pointerup' && p.dragging && p.type === 'touch' &&
                e.timeStamp - p.time < 80 && !this.motion.matches &&
                [...this.pauses].every(reason => reason === 'interaction')) {
                this.velocity = Math.abs(p.velocity) >= 0.02 ? p.velocity : 0;
                this.schedule();
            }
            // The synthetic click from pointerup must be suppressed, but not
            // later keyboard activation or a fresh tap.
            clearTimeout(this.clickTimer);
            this.clickTimer = setTimeout(() => { this.suppressClick = false; }, 0);
        };
        this.listen(window, 'pointerup', release);
        this.listen(window, 'pointercancel', release);
        this.listen(wrapper, 'lostpointercapture', e => {
            // Touch implicitly captures the card. Its capture-loss event bubbles
            // here when we transfer capture to the wrapper; the drag is still active.
            if (e.target === wrapper) release(e);
        });
        this.listen(document, 'visibilitychange', () => this.pause('hidden', document.hidden));
        this.listen(this.motion, 'change', () => this.pause('motion', this.motion.matches));
        this.pause('hidden', document.hidden);
        this.pause('motion', this.motion.matches);
        this.intersection = new IntersectionObserver(([entry]) => this.pause('offscreen', !entry.isIntersecting));
        this.intersection.observe(wrapper);
        this.resize = new ResizeObserver(() => this.measure());
        this.resize.observe(wrapper);
        this.measure();
    }

    destroy() {
        this.destroyed = true;
        if (this.frame !== null) cancelAnimationFrame(this.frame);
        clearTimeout(this.resumeTimer);
        clearTimeout(this.clickTimer);
        this.intersection.disconnect?.();
        this.resize.disconnect?.();
        this.disposers.forEach(dispose => dispose());
        this.nodes.clear();
        this.track.replaceChildren();
    }

    measure() {
        this.velocity = 0;
        const oldStride = this.stride;
        this.width = this.wrapper.clientWidth;
        const style = getComputedStyle(this.wrapper);
        this.autoplay = style.getPropertyValue('--gallery-autoplay').trim() !== '0';
        let cardWidth = parseFloat(style.getPropertyValue('--card-width'));
        // Keep CSS and JS geometry aligned without a layout read on each frame.
        if (this.wrapper.dataset.fitHeight && this.wrapper.clientHeight) {
            const height = this.wrapper.clientHeight;
            const caption = this.items.some(item => item.hookLine)
                ? parseFloat(style.getPropertyValue('--hook-caption-space')) || 270
                : parseFloat(style.getPropertyValue('--caption-space')) || 210;
            cardWidth = height < 430
                ? Math.min(420, this.width)
                : Math.min(this.width, 520, Math.max(160, (height - caption) * 0.75));
            this.wrapper.style.setProperty('--card-width', `${cardWidth}px`);
        }
        this.stride = cardWidth + parseFloat(style.getPropertyValue('--card-gap'));
        this.gap = parseFloat(style.getPropertyValue('--card-gap'));
        this.position = this.position / oldStride * this.stride;
        this.updateMode();
        this.render();
        this.schedule();
    }

    updateMode() {
        const contentWidth = Math.max(0, this.items.length * this.stride - this.gap);
        const previous = this.mode;
        this.mode = this.items.length >= 8 && contentWidth >= this.width * 2
            ? 'loop' : contentWidth <= this.width ? 'static' : 'finite';
        this.maxPosition = Math.max(0, contentWidth - this.width);
        this.centerOffset = Math.max(0, (this.width - contentWidth) / 2);
        if (previous === 'loop' && this.mode !== 'loop') {
            const cycle = this.items.length * this.stride;
            this.position = cycle ? ((this.position % cycle) + cycle) % cycle : 0;
        }
        if (this.mode !== 'loop') this.position = Math.max(0, Math.min(this.position, this.maxPosition));
        this.wrapper.dataset.galleryMode = this.mode;
        this.wrapper.setAttribute('aria-label', this.mode === 'static'
            ? 'Stories.' : 'Stories. Use left and right arrow keys to browse.');
        if (previous !== this.mode) {
            if (this.track.contains(document.activeElement)) this.wrapper.focus({ preventScroll: true });
            this.nodes.clear();
            this.track.querySelectorAll('.episode-card').forEach(node => node.remove());
            this.renderedStart = null;
            this.lastTime = null;
        }
        if (this.mode !== 'loop' && this.frame !== null && !this.pendingDelta) {
            cancelAnimationFrame(this.frame);
            this.frame = null;
        }
    }

    setItems(items) {
        const ids = new Set();
        items = items.filter(item => !ids.has(item.id) && ids.add(item.id));
        // Modal close and history restoration can reuse the existing window.
        if (this.initialized && items.length === this.items.length && items.every((item, i) => item === this.items[i])) return;
        this.initialized = true;
        this.items = items;
        this.position = 0;
        this.pendingDelta = 0;
        this.velocity = 0;
        this.nodes.clear();
        this.renderedStart = null;
        this.centeredItem = null;
        this.hoveredCard = null;
        this.focusedCard = null;
        this.pause('hover', false);
        this.track.replaceChildren();
        this.measure();
        if (!items.length) {
            const empty = document.createElement('div');
            empty.className = 'loading';
            empty.textContent = 'New stories are on their way.';
            this.track.append(empty);
            this.track.style.transform = '';
            this.onCenter?.(null, null);
        }
        this.render();
        this.schedule();
    }

    render() {
        if (!this.items.length) return;
        if (this.mode !== 'loop') this.position = Math.max(0, Math.min(this.position, this.maxPosition));
        const win = this.mode === 'loop'
            ? galleryWindow(this.position, this.stride, this.width, this.items.length)
            : { start: 0, end: this.items.length, offset: this.position - this.centerOffset,
                indexes: this.items.map((_, i) => i) };
        const visibleStart = Math.floor(this.position / this.stride);
        const visibleEnd = Math.ceil((this.position + this.width) / this.stride);
        if (win.start === this.renderedStart && win.end === this.renderedEnd && visibleEnd === this.visibleEnd && visibleStart === this.visibleStart) {
            this.track.style.transform = `translateX(${-win.offset}px)`;
            this.notifyCenter();
            return;
        }
        for (const [index, node] of this.nodes) {
            if (index < win.start || index >= win.end) {
                if (node.contains(document.activeElement)) this.wrapper.focus({ preventScroll: true });
                node.remove();
                this.nodes.delete(index);
            }
        }
        for (let index = win.end - 1; index >= win.start; index--) {
            if (this.nodes.has(index)) continue;
            const itemIndex = win.indexes[index - win.start];
            const card = this.createCard(this.items[itemIndex]);
            card.dataset.itemIndex = itemIndex;
            this.nodes.set(index, card);
            const next = this.nodes.get(index + 1);
            this.track.insertBefore(card, next || null);
        }
        this.renderedStart = win.start;
        this.renderedEnd = win.end;
        this.visibleEnd = visibleEnd;
        this.visibleStart = visibleStart;
        for (const [index, node] of this.nodes) node.inert = index < visibleStart || index >= visibleEnd;
        // No geometry reads, image changes, or new DOM on ordinary frames.
        this.track.style.transform = `translateX(${-win.offset}px)`;
        this.notifyCenter();
    }

    notifyCenter() {
        if (!this.onCenter || !this.items.length || this.destroyed) return;
        // Hover/focus owns the palette until interaction ends. Center changes
        // during scrolling must not overwrite the story the reader is inspecting.
        const selected = [this.hoveredCard, this.focusedCard].find(card => card && this.track.contains(card));
        if (selected) {
            const item = this.items[Number(selected.dataset.itemIndex)];
            if (item && item !== this.centeredItem) {
                this.centeredItem = item;
                this.onCenter(item, selected.querySelector('img'));
            }
            return;
        }
        const offset = this.mode === 'loop' ? 0 : this.centerOffset;
        const index = Math.round((this.position + this.width / 2 - offset - (this.stride - this.gap) / 2) / this.stride);
        const itemIndex = this.mode === 'loop' ? ((index % this.items.length) + this.items.length) % this.items.length
            : Math.max(0, Math.min(index, this.items.length - 1));
        const item = this.items[itemIndex];
        if (item === this.centeredItem) return;
        this.centeredItem = item;
        const node = this.nodes.get(this.mode === 'loop' ? index : itemIndex);
        this.onCenter(item, node?.querySelector('img') || null);
    }

    pause(reason, paused) {
        if (paused && reason !== 'interaction') this.velocity = 0;
        if (paused) this.pauses.add(reason);
        else this.pauses.delete(reason);
        this.lastTime = null;
        if (this.pauses.size && this.frame !== null && !this.pendingDelta && !this.velocity) {
            cancelAnimationFrame(this.frame);
            this.frame = null;
        }
        this.schedule();
    }

    move(delta) {
        if (!this.items.length || this.mode === 'static') return;
        this.velocity = 0;
        this.pendingDelta += delta;
        this.pause('interaction', true);
        clearTimeout(this.resumeTimer);
        this.resumeTimer = setTimeout(() => this.pause('interaction', false), 1500);
        this.schedule();
    }

    schedule() {
        if (this.destroyed || this.frame !== null || !this.items.length || ((this.pauses.size || !this.autoplay || this.mode !== 'loop') && !this.pendingDelta && !this.velocity)) return;
        this.frame = requestAnimationFrame(time => {
            this.frame = null;
            if (this.pendingDelta) {
                this.position += this.pendingDelta;
                this.pendingDelta = 0;
            } else if (this.velocity && this.lastTime !== null) {
                const elapsed = Math.min(time - this.lastTime, 50);
                const decay = Math.exp(-elapsed / 220);
                this.position += this.velocity * 220 * (1 - decay);
                this.velocity *= decay;
                if (Math.abs(this.velocity) < 0.02 || (this.mode !== 'loop' &&
                    (this.position <= 0 || this.position >= this.maxPosition))) {
                    this.velocity = 0;
                    // Give the reader a full pause after the glide finishes.
                    this.move(0);
                }
            } else if (this.autoplay && !this.pauses.size && this.lastTime !== null) {
                // Ignore catch-up after suspension or a long task.
                this.position += 15 * Math.min((time - this.lastTime) / 1000, 0.05);
            }
            this.lastTime = time;
            this.render();
            this.schedule();
        });
    }
}
