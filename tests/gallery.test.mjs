import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { ContinuousGallery, galleryWindow } from '../public/js/gallery.js';

test('loop window stays bounded for large catalogs', () => {
    for (const count of [8, 227, 1000]) {
        for (const position of [-1000000, -390.1, -0.1, 0, 389.9, 390, count * 390, 1000000]) {
            const window = galleryWindow(position, 390, 1280, count);
            assert.equal(window.indexes.length, 9);
            assert.ok(window.indexes.every(index => index >= 0 && index < count));
            assert.ok(window.offset >= 780 && window.offset < 1170);
            for (let i = 1; i < window.indexes.length; i++) {
                assert.equal(window.indexes[i], (window.indexes[i - 1] + 1) % count);
            }
        }
    }
    assert.deepEqual(galleryWindow(0, 390, 1280, 0).indexes, []);
});

test('last-to-first seam advances by exactly the requested fraction of a pixel', () => {
    const before = galleryWindow(8 * 390 - 0.1, 390, 1280, 8);
    const after = galleryWindow(8 * 390 + 0.1, 390, 1280, 8);
    // The same logical card moves from slot 3 to slot 2 across the recycle boundary.
    assert.ok(Math.abs((2 * 390 - after.offset) - (3 * 390 - before.offset) + 0.2) < 1e-9);
});

function setup(t, count = 1000) {
    const dom = new JSDOM('<div class="gallery-wrapper" style="--card-width:380px;--card-gap:10px"><div class="collection-grid"></div></div>', { pretendToBeVisual: true });
    const { window } = dom;
    const frames = new Map();
    let id = 0;
    const originals = new Map();
    const motion = { matches: false, addEventListener() {} };
    const globals = {
        window, document: window.document,
        getComputedStyle: window.getComputedStyle.bind(window),
        matchMedia: () => motion,
        requestAnimationFrame: callback => { frames.set(++id, callback); return id; },
        cancelAnimationFrame: id => frames.delete(id),
        IntersectionObserver: class { constructor(callback) { this.callback = callback; } observe() {} },
        ResizeObserver: class { observe() {} },
    };
    for (const [key, value] of Object.entries(globals)) { originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, { configurable: true, writable: true, value }); }
    const wrapper = window.document.querySelector('.gallery-wrapper');
    Object.defineProperty(wrapper, 'clientWidth', { configurable: true, value: 1280 });
    wrapper.setPointerCapture = () => {};
    let created = 0;
    const opened = [], shared = [];
    const gallery = new ContinuousGallery(wrapper, item => {
        created++;
        const card = window.document.createElement('div');
        card.className = 'episode-card';
        card.innerHTML = `<a href="/episode/${item.id}">${item.id}</a><button class="episode-share-btn">Share</button>`;
        return card;
    }, item => opened.push(item.id), item => shared.push(item.id));
    gallery.setItems(Array.from({ length: count }, (_, id) => ({ id })));
    t.after(() => {
        clearTimeout(gallery.resumeTimer);
        clearTimeout(gallery.clickTimer);
        dom.window.close();
        for (const [key, descriptor] of originals) {
            if (descriptor) Object.defineProperty(globalThis, key, descriptor);
            else delete globalThis[key];
        }
    });
    return { gallery, wrapper, window, frames, opened, shared, created: () => created,
        tick(time) { const pending = [...frames.values()]; frames.clear(); pending.forEach(fn => fn(time)); } };
}

function pointer(h, target, type, x, time, overrides = {}) {
    const event = new h.window.Event(type, { bubbles: true });
    Object.assign(event, { isPrimary: true, button: 0, pointerId: 1,
        pointerType: 'touch', clientX: x, clientY: 100, ...overrides });
    Object.defineProperty(event, 'timeStamp', { value: time });
    target.dispatchEvent(event);
}

test('artwork theme follows the centered story without updating on every frame', t => {
    const { gallery } = setup(t, 20);
    const centered = [];
    gallery.onCenter = item => centered.push(item?.id ?? null);
    gallery.render();
    assert.deepEqual(centered, [1]);
    gallery.position += 1;
    gallery.render();
    assert.deepEqual(centered, [1]);
    gallery.position += gallery.stride;
    gallery.render();
    assert.deepEqual(centered, [1, 2]);
    gallery.position = -gallery.stride * 2;
    gallery.render();
    assert.equal(centered.at(-1), 19);
    gallery.setItems([{ id: 'only' }]);
    assert.equal(centered.at(-1), 'only');
    gallery.setItems([]);
    assert.equal(centered.at(-1), null);
});

test('touch capture can transfer from a card to the gallery without ending the swipe', t => {
    const h = setup(t);
    const link = h.wrapper.querySelectorAll('.episode-card a')[2];
    pointer(h, link, 'pointerdown', 200, 0);
    pointer(h, link, 'pointermove', 180, 20);
    assert.equal(h.gallery.pointer.dragging, true);
    // Browsers emit this from the old implicit capture target during transfer.
    pointer(h, link, 'lostpointercapture', 180, 21);
    pointer(h, h.wrapper, 'pointermove', 100, 100);
    h.tick(100);
    assert.equal(h.gallery.position, 100);
    link.click();
    assert.deepEqual(h.opened, [], 'a swipe does not open a story');
    pointer(h, h.wrapper, 'pointerup', 100, 110);
    assert.equal(h.gallery.pointer, null);
});

for (const direction of [-1, 1]) {
    test(`touch flick glides and settles in direction ${direction}`, t => {
        const h = setup(t);
        pointer(h, h.wrapper, 'pointerdown', 200, 0);
        pointer(h, h.wrapper, 'pointermove', 200 - direction * 40, 40);
        h.tick(40);
        pointer(h, h.wrapper, 'pointerup', 200 - direction * 40, 50);
        h.tick(50); h.tick(66);
        assert.ok(direction * h.gallery.position > 40);
        for (let time = 82; time < 1300; time += 16) h.tick(time);
        assert.equal(h.gallery.velocity, 0);
        assert.equal(h.frames.size, 0, 'glide settles instead of animating forever');
    });
}

for (const ending of ['pointercancel', 'lostpointercapture', 'held', 'reduced-motion', 'mouse']) {
    test(`${ending} ends dragging without momentum`, t => {
        const h = setup(t);
        if (ending === 'reduced-motion') h.gallery.motion.matches = true;
        const options = ending === 'mouse' ? { pointerType: 'mouse' } : {};
        pointer(h, h.wrapper, 'pointerdown', 200, 0, options);
        pointer(h, h.wrapper, 'pointermove', 160, 40, options);
        h.tick(40);
        pointer(h, h.wrapper, ['pointercancel', 'lostpointercapture'].includes(ending) ? ending : 'pointerup',
            160, ending === 'held' ? 200 : 50, options);
        h.tick(200);
        assert.equal(h.gallery.position, 40);
        assert.equal(h.gallery.velocity, 0);
        assert.equal(h.gallery.pointer, null);
    });
}

test('new touches and opening a dialog stop an ongoing glide', t => {
    const h = setup(t);
    for (const stop of ['touch', 'modal']) {
        pointer(h, h.wrapper, 'pointerdown', 200, 0);
        pointer(h, h.wrapper, 'pointermove', 160, 40);
        h.tick(40);
        pointer(h, h.wrapper, 'pointerup', 160, 50);
        assert.ok(h.gallery.velocity > 0);
        if (stop === 'touch') pointer(h, h.wrapper, 'pointerdown', 160, 60);
        else h.gallery.pause('modal', true);
        assert.equal(h.gallery.velocity, 0);
        assert.equal(h.frames.size, 0);
    }
});

test('touch momentum stops at the finite catalog boundary', t => {
    const h = setup(t, 3);
    Object.defineProperty(h.wrapper, 'clientWidth', { value: 390 });
    h.gallery.measure();
    h.gallery.position = h.gallery.maxPosition - 50;
    pointer(h, h.wrapper, 'pointerdown', 200, 0);
    pointer(h, h.wrapper, 'pointermove', 160, 40);
    h.tick(40);
    pointer(h, h.wrapper, 'pointerup', 160, 50);
    h.tick(50); h.tick(66);
    assert.equal(h.gallery.position, h.gallery.maxPosition);
    assert.equal(h.gallery.velocity, 0);
    assert.equal(h.frames.size, 0);
});

test('taps still open cards and vertical gestures do not move the gallery', t => {
    const h = setup(t);
    const link = h.wrapper.querySelectorAll('.episode-card a')[2];
    pointer(h, link, 'pointerdown', 200, 0);
    pointer(h, link, 'pointerup', 200, 20);
    link.click();
    assert.deepEqual(h.opened, [0]);
    pointer(h, link, 'pointerdown', 200, 30);
    pointer(h, link, 'pointermove', 195, 50, { clientY: 160 });
    pointer(h, link, 'pointercancel', 195, 60);
    assert.equal(h.gallery.pendingDelta, 0);
    assert.equal(h.gallery.velocity, 0);
});

test('recycles in both directions, including multi-card jumps, without growing DOM', t => {
    const h = setup(t);
    assert.equal(h.created(), 9);
    h.gallery.position = 390;
    h.gallery.render();
    assert.equal(h.created(), 10, 'one incoming card per crossed boundary');
    for (const position of [-1170, 100000, -100000, 0, 1000 * 390]) {
        h.gallery.position = position;
        h.gallery.render();
        const nodes = [...h.wrapper.querySelectorAll('.episode-card')];
        assert.equal(nodes.length, 9);
        assert.deepEqual(nodes.map(n => Number(n.dataset.itemIndex)), galleryWindow(position, 390, 1280, 1000).indexes);
    }
});

test('ordinary frames and modal/filter restoration preserve card nodes', t => {
    const h = setup(t, 227);
    const before = [...h.wrapper.querySelectorAll('.episode-card')];
    h.tick(0); h.tick(16); h.tick(32);
    assert.equal(h.created(), 9);
    assert.ok(h.gallery.position > 0);
    h.gallery.pause('modal', true);
    assert.equal(h.frames.size, 0);
    h.gallery.setItems([...h.gallery.items]);
    assert.deepEqual([...h.wrapper.querySelectorAll('.episode-card')], before);
    h.gallery.pause('modal', false);
    const position = h.gallery.position;
    h.tick(100000);
    assert.equal(h.gallery.position, position, 'resume does not catch up time spent hidden');
});

test('height-only mobile viewport changes preserve cards and image elements', t => {
    const h = setup(t, 227);
    h.wrapper.style.setProperty('--card-width', '340px');
    Object.defineProperty(h.wrapper, 'clientWidth', { value: 390 });
    h.gallery.measure();
    const cards = [...h.wrapper.querySelectorAll('.episode-card')];
    const images = cards.map(card => {
        const image = h.window.document.createElement('img');
        image.src = '/images/icon.webp';
        card.prepend(image);
        return image;
    });
    const created = h.created();
    for (const height of [844, 744, 844, 700, 844]) {
        Object.defineProperty(h.window, 'innerHeight', { configurable: true, value: height });
        h.window.dispatchEvent(new h.window.Event('resize'));
        // Also cover a ResizeObserver notification with unchanged width.
        h.gallery.measure();
        assert.deepEqual([...h.wrapper.querySelectorAll('.episode-card')], cards);
        assert.deepEqual([...h.wrapper.querySelectorAll('img')], images);
        assert.equal(h.created(), created);
    }
});

test('reduced motion and offscreen states stop automatic frames but allow manual browsing', t => {
    const h = setup(t);
    h.gallery.pause('motion', true);
    h.gallery.pause('offscreen', true);
    assert.equal(h.frames.size, 0);
    h.gallery.move(780);
    h.tick(100);
    assert.equal(h.gallery.position, 780);
    assert.equal(h.frames.size, 0);
});

test('delegated events resolve the current story after recycling; resize preserves phase', t => {
    const h = setup(t);
    h.gallery.position = 390 * 5 + 195;
    h.gallery.render();
    const card = h.wrapper.querySelectorAll('.episode-card')[2];
    card.querySelector('a').click();
    card.querySelector('button').click();
    assert.deepEqual(h.opened, [5]);
    assert.deepEqual(h.shared, [5]);
    h.wrapper.style.setProperty('--card-width', '340px');
    Object.defineProperty(h.wrapper, 'clientWidth', { value: 390 });
    h.gallery.measure();
    assert.equal(h.gallery.position, 350 * 5.5);
    assert.equal(h.wrapper.querySelectorAll('.episode-card').length, 7);
});

test('empty and small category transitions clear stale cards and retain every story', t => {
    const h = setup(t, 0);
    assert.match(h.wrapper.textContent, /New stories/);
    for (const count of [1, 2, 3, 227, 0]) {
        h.gallery.setItems(Array.from({ length: count }, (_, id) => ({ id })));
        assert.equal(h.wrapper.querySelectorAll('.episode-card').length, count >= 8 ? 9 : count);
        if (count && count < 4) assert.equal(new Set([...h.wrapper.querySelectorAll('.episode-card')].map(n => n.dataset.itemIndex)).size, count);
    }
});

test('pointer focus on the track does not permanently disable autoplay after dragging', t => {
    const h = setup(t);
    const pointer = new h.window.Event('pointerdown', { bubbles: true });
    Object.assign(pointer, { isPrimary: true, button: 0, pointerId: 1, clientX: 200, clientY: 100 });
    h.wrapper.dispatchEvent(pointer);
    h.wrapper.focus();
    assert.equal(h.gallery.pauses.has('focus'), false);
    const release = new h.window.Event('pointerup', { bubbles: true });
    Object.assign(release, { pointerId: 1 });
    h.wrapper.dispatchEvent(release);
    assert.equal(h.gallery.pauses.size, 0);
    assert.equal(h.frames.size, 1);
    h.wrapper.dispatchEvent(new h.window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    assert.equal(h.gallery.pauses.has('focus'), true, 'keyboard focus intentionally pauses autoplay');
});

test('small catalogs show each story once, centered and without idle animation', t => {
    const h = setup(t, 0);
    for (const count of [1, 2, 3]) {
        h.gallery.setItems(Array.from({ length: count }, (_, id) => ({ id })));
        assert.equal(h.gallery.mode, 'static');
        assert.equal(h.frames.size, 0);
        assert.equal(h.wrapper.querySelectorAll('.episode-card').length, count);
        assert.equal(h.gallery.track.style.transform, `translateX(${(1280 - (count * 390 - 10)) / 2}px)`);
        h.gallery.move(10000);
        h.tick(100);
        assert.equal(h.gallery.position, 0);
        assert.equal(h.frames.size, 0);
    }
});

test('mobile finite browsing clamps both ends and still opens and shares the right story', t => {
    const h = setup(t, 3);
    Object.defineProperty(h.wrapper, 'clientWidth', { value: 390 });
    h.wrapper.style.setProperty('--card-width', '340px');
    h.gallery.measure();
    assert.equal(h.gallery.mode, 'finite');
    assert.equal(h.frames.size, 0);
    h.gallery.move(10000); h.tick(0);
    assert.equal(h.gallery.position, 650);
    assert.equal(h.frames.size, 0);
    const last = h.wrapper.querySelectorAll('.episode-card')[2];
    assert.equal(last.inert, false);
    last.querySelector('a').click(); last.querySelector('button').click();
    assert.deepEqual(h.opened, [2]); assert.deepEqual(h.shared, [2]);
    h.wrapper.dispatchEvent(new h.window.KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    h.tick(16);
    assert.equal(h.gallery.position, 300);
    h.gallery.move(-10000); h.tick(32);
    assert.equal(h.gallery.position, 0);
    h.gallery.pause('interaction', false);
    assert.equal(h.frames.size, 0, 'finite browsing never resumes autoplay');
});

test('loop needs eight unique stories and two screen widths; resizing keeps a valid position', t => {
    const h = setup(t, 7);
    assert.equal(h.gallery.mode, 'finite');
    assert.equal(h.frames.size, 0);
    const items = Array.from({ length: 8 }, (_, id) => ({ id }));
    h.gallery.setItems([...items, items[0]]);
    assert.equal(h.gallery.items.length, 8);
    assert.equal(h.gallery.mode, 'loop');
    h.gallery.position = 8 * 390 + 195;
    Object.defineProperty(h.wrapper, 'clientWidth', { value: 1800 });
    h.gallery.measure();
    assert.equal(h.gallery.mode, 'finite');
    assert.equal(h.gallery.position, 195);
    assert.equal(h.frames.size, 0);
    assert.equal(h.wrapper.querySelectorAll('.episode-card').length, 8);
    Object.defineProperty(h.wrapper, 'clientWidth', { value: 1280 });
    h.gallery.measure();
    assert.equal(h.gallery.mode, 'loop');
    assert.equal(h.gallery.position, 195);
    assert.equal(h.frames.size, 1);
    h.gallery.setItems(items.slice(0, 2));
    assert.equal(h.gallery.mode, 'static');
    assert.equal(h.frames.size, 0);
    assert.equal(h.wrapper.querySelectorAll('.episode-card').length, 2);
});

test('React unmount disposes animation, global handlers and pending resume work', t => {
    const { gallery, frames } = setup(t);
    gallery.move(100);
    gallery.destroy();
    assert.equal(frames.size, 0);
    assert.equal(gallery.track.childElementCount, 0);
    gallery.schedule();
    assert.equal(frames.size, 0);
});
