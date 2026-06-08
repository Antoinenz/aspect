# Aspect — Sidebar Navigation + Map & Settings — Design

**Date:** 2026-06-08
**Status:** Approved (design phase)
**One-liner:** Replace the top tab bar with a sidebar (desktop/tablet) / bottom bar (phone) — **Home · Favorites · Rooms · Map · Settings** — turning Rooms into an overview→detail flow and adding a people-location Map and a Settings page (incl. a theme system).

Builds on the completed UI overhaul; reuses the Frost design language and all existing tiles/controls.

---

## 1. Goals

- A persistent, scalable **sidebar** that scales past the room-tab approach and adds top-level destinations (Map, Settings).
- **Native on every device:** sidebar on desktop/tablet, thumb-friendly bottom bar on phone.
- A calm **Rooms overview** (grid of room cards) that drills into a room and back — better than 13 tabs.
- A **Map** to see where people are, and a **Settings** home for theme, connection, about, and favorites.
- Keep everything already built working (controls, filtering, favorites, summary).

## 2. Navigation model

- **Destinations:** Home, Favorites, Rooms, Map (top group) and Settings (pinned to the bottom on the sidebar).
- **Sidebar** (≥ ~768px): fixed left, ~226px, frosted; brand/logo at top, nav items (MDI icon + label), Settings pinned at the bottom. Active item = **Frost white** (consistent with active tiles/selected state).
- **Bottom bar** (< ~768px): the same 5 items as icons (+ short labels) in a frosted bar fixed to the bottom (safe-area aware). The active item is highlighted.
- **View state:** a small in-app view model `{ section: 'home' | 'favorites' | 'rooms' | 'map' | 'settings'; roomId?: string }` held in `AppShell` (no router dependency in v1; deep-linking/hash-routing is a future enhancement). Selecting a room sets `roomId`; a back control clears it.
- The shared **EntityDetailSheet** continues to overlay any section (open from Home/Favorites/Rooms tiles).

## 3. Sections

- **Home** — the existing Summary content (status pills, who's home, alerts, climate/weather, activity), shown as the default landing section.
- **Favorites** — the existing Quick Access (pinned favorites grid). Renamed "Favorites" in the nav.
- **Rooms** — an **overview page**: a grid of **room cards** (room icon, name, "N on · M devices"). Selecting a card shows that room's tiles (the existing `RoomTab`) with a **back** affordance returning to the overview.
- **Map** — an interactive map of where people are (see §4).
- **Settings** — theme, Home Assistant connection status, About/version, and **manage favorites** (see §5).

## 4. Map page

- **Library:** Leaflet via `react-leaflet`, with free **OpenStreetMap raster tiles** (no API key). (`leaflet`, `react-leaflet`, `@types/leaflet`.)
- **Markers:** every `person` (preferred) and `device_tracker` entity that exposes numeric `latitude`/`longitude` attributes gets a marker; label = friendly name; person avatars (`entity_picture`) used where available. The map auto-fits bounds to the markers; empty state when no GPS entities exist.
- **Scope:** read-only "where is everyone" view. Geofence zones, history trails, and the eventual **3D home map** are out of scope (future).
- **Boundary:** a pure `peoplePlaces(entities, registry)` helper produces the marker list `{ entityId, name, lat, lng, picture }[]`; `MapPage` renders Leaflet from it.

## 5. Settings page

- **Theme:** light / dark / **auto** (follows system). Persisted in `localStorage` and applied via a `data-theme` attribute on `<html>`; `theme.css` gains explicit light/dark token blocks keyed off `:root[data-theme='light'|'dark']` plus the existing `prefers-color-scheme` default for "auto". A small `theme` store exposes the choice + setter.
- **Connection:** show the live server/HA status (from the store: `serverStatus`, `haConnected`, `link`) — e.g. "Connected to Home Assistant" / "Reconnecting…".
- **About:** app name, version (from `package.json`), and a link to the project.
- **Manage favorites:** list current favorites (name + a remove button calling `setFavorite(id, false)`); empty-state hint.

## 6. Components & structure

```
apps/web/src/
  nav/
    navItems.ts        destinations (id, label, MDI icon)
    Sidebar.tsx        desktop/tablet sidebar
    BottomBar.tsx      phone bottom bar
    Nav.tsx            responsive wrapper (renders Sidebar or BottomBar)
  dashboard/
    AppShell.tsx       MOD  view-model + Nav + section switch (replaces Tabs)
    HomeSection.tsx    = current SummaryTab (renamed/rehomed)
    FavoritesSection.tsx = current QuickAccessTab (renamed)
    RoomsOverview.tsx  NEW  room cards grid (+ RoomCard) + pure roomsOverview() stat helper
    RoomView.tsx       NEW  single room (wraps RoomTab) + back control
  map/
    peoplePlaces.ts    NEW  pure: entities -> marker list (+ test)
    MapPage.tsx        NEW  Leaflet map
  settings/
    theme.ts           NEW  theme store (light/dark/auto) + persistence
    SettingsPage.tsx   NEW  theme + connection + about + manage favorites
  ui/theme.css         MOD  data-theme light/dark blocks
```

The old `Tabs`/`TabPanel` primitive remains available but is no longer used for top-level nav (may be reused elsewhere or removed if unused).

## 7. Decomposition into plans

1. **Nav shell** — `Nav`/`Sidebar`/`BottomBar`, AppShell view-model + section switch, Rooms overview→detail, rehome Home/Favorites. (No new external deps.)
2. **Settings + theme** — theme store + `data-theme` CSS, SettingsPage (theme/connection/about/manage-favorites).
3. **Map** — `leaflet`/`react-leaflet`, `peoplePlaces` helper, MapPage.

## 8. Out of scope (future)

- The **3D home map** (its own future project).
- Map geofences/zones and location history; deep-linkable URLs/hash routing; multi-user settings.

## 9. Success criteria

- Sidebar on desktop/tablet and bottom bar on phone, with Home/Favorites/Rooms/Map/Settings; active = Frost.
- Rooms shows an overview that drills into a room and back; all existing controls work.
- Map shows people/device-tracker locations on an OSM map.
- Settings switches theme (persisted), shows connection + about, and manages favorites.
- Tests/typecheck/build stay green.

---

## Decisions Log

| Decision | Choice |
|---|---|
| Nav pattern | Sidebar (desktop/tablet) + bottom bar (phone) |
| Items | Home · Favorites · Rooms · Map · Settings (Settings pinned bottom) |
| Rooms | Overview grid of room cards → room detail + back |
| Map | Real Leaflet + OSM tiles; person/device_tracker GPS markers |
| Settings | Theme (light/dark/auto) + connection + about + manage favorites |
| 3D map | Future, out of scope |
