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
