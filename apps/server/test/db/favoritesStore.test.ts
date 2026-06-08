import { describe, it, expect, afterEach } from 'vitest';
import { FavoritesStore } from '../../src/db/favoritesStore.js';

let store: FavoritesStore | undefined;

afterEach(() => {
  store?.close();
  store = undefined;
});

describe('FavoritesStore', () => {
  it('starts empty', () => {
    store = new FavoritesStore(':memory:');
    expect(store.list()).toEqual([]);
  });

  it('adds in insertion order and is idempotent', () => {
    store = new FavoritesStore(':memory:');
    store.set('light.b', true);
    store.set('light.a', true);
    store.set('light.a', true); // idempotent — does not change order
    expect(store.list()).toEqual(['light.b', 'light.a']);
  });

  it('reorders favorites', () => {
    store = new FavoritesStore(':memory:');
    store.set('light.a', true);
    store.set('light.b', true);
    store.set('light.c', true);
    store.reorder(['light.c', 'light.a', 'light.b']);
    expect(store.list()).toEqual(['light.c', 'light.a', 'light.b']);
  });

  it('removes a favorite', () => {
    store = new FavoritesStore(':memory:');
    store.set('light.a', true);
    store.set('light.a', false);
    expect(store.list()).toEqual([]);
  });

  it('removing a non-existent favorite is a no-op', () => {
    store = new FavoritesStore(':memory:');
    expect(() => store!.set('light.ghost', false)).not.toThrow();
    expect(store.list()).toEqual([]);
  });
});
